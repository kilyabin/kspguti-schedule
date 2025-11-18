#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/kspguti-schedule"
SERVICE_USER="www-data"
SERVICE_GROUP="www-data"
SERVICE_NAME="kspguti-schedule"
NODE_VERSION="20"

echo -e "${GREEN}=== KSPGUTI Schedule Installation Script ===${NC}\n"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Detect distribution and suggest ICU installation if needed
detect_and_suggest_icu() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        case $ID in
            arch|manjaro)
                echo -e "${YELLOW}Detected Arch Linux. Installing ICU library...${NC}"
                pacman -Sy --noconfirm icu 2>/dev/null || {
                    echo -e "${YELLOW}Could not auto-install ICU. Please run manually:${NC}"
                    echo -e "${GREEN}sudo pacman -S icu${NC}"
                }
                ;;
            ubuntu|debian)
                echo -e "${YELLOW}Detected Debian/Ubuntu. Installing ICU library...${NC}"
                apt-get update -qq && apt-get install -y libicu-dev 2>/dev/null || {
                    echo -e "${YELLOW}Could not auto-install ICU. Please run manually:${NC}"
                    echo -e "${GREEN}sudo apt-get install libicu-dev${NC}"
                }
                ;;
            fedora|rhel|centos)
                echo -e "${YELLOW}Detected Fedora/RHEL/CentOS. Installing ICU library...${NC}"
                dnf install -y libicu 2>/dev/null || yum install -y libicu 2>/dev/null || {
                    echo -e "${YELLOW}Could not auto-install ICU. Please run manually:${NC}"
                    echo -e "${GREEN}sudo dnf install libicu${NC} or ${GREEN}sudo yum install libicu${NC}"
                }
                ;;
            *)
                echo -e "${YELLOW}Unknown distribution. Please install ICU library manually.${NC}"
                ;;
        esac
    fi
}

# Check Node.js version
echo -e "${YELLOW}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js ${NODE_VERSION}+ first.${NC}"
    exit 1
fi

# Try to get Node.js version, handle errors gracefully
NODE_VERSION_OUTPUT=$(node -v 2>&1)
if [ $? -ne 0 ]; then
    echo -e "${RED}Error running Node.js: $NODE_VERSION_OUTPUT${NC}"
    echo -e "${YELLOW}This might be due to missing system libraries (ICU).${NC}"
    echo -e "${YELLOW}Attempting to install ICU library...${NC}"
    detect_and_suggest_icu
    echo -e "${YELLOW}Retrying Node.js check...${NC}"
    sleep 2
    NODE_VERSION_OUTPUT=$(node -v 2>&1)
    if [ $? -ne 0 ]; then
        echo -e "${RED}Still cannot run Node.js. Please install ICU library manually and try again.${NC}"
        exit 1
    fi
fi

NODE_VER=$(echo "$NODE_VERSION_OUTPUT" | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VER" ] || ! [[ "$NODE_VER" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}Could not determine Node.js version. Output: $NODE_VERSION_OUTPUT${NC}"
    exit 1
fi

if [ "$NODE_VER" -lt "$NODE_VERSION" ]; then
    echo -e "${RED}Node.js version ${NODE_VERSION}+ is required. Current version: $NODE_VERSION_OUTPUT${NC}"
    exit 1
fi

echo -e "${GREEN}Node.js version: $NODE_VERSION_OUTPUT${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed.${NC}"
    exit 1
fi

# Try to get npm version, handle errors gracefully
NPM_VERSION_OUTPUT=$(npm -v 2>&1)
if [ $? -ne 0 ]; then
    echo -e "${RED}Error running npm: $NPM_VERSION_OUTPUT${NC}"
    echo -e "${YELLOW}This might be due to missing system libraries (ICU).${NC}"
    echo -e "${YELLOW}Attempting to install ICU library...${NC}"
    detect_and_suggest_icu
    echo -e "${YELLOW}Retrying npm check...${NC}"
    sleep 2
    NPM_VERSION_OUTPUT=$(npm -v 2>&1)
    if [ $? -ne 0 ]; then
        echo -e "${RED}Still cannot run npm. Please install ICU library manually and try again.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}npm version: $NPM_VERSION_OUTPUT${NC}\n"

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo -e "${YELLOW}Project directory: $PROJECT_DIR${NC}"
echo -e "${YELLOW}Installation directory: $INSTALL_DIR${NC}\n"

# Create installation directory
echo -e "${YELLOW}Creating installation directory...${NC}"
mkdir -p "$INSTALL_DIR"

# Copy project files
echo -e "${YELLOW}Copying project files...${NC}"
rsync -av --exclude='node_modules' \
          --exclude='.next' \
          --exclude='.git' \
          --exclude='*.log' \
          --exclude='.env.local' \
          --exclude='.env.development' \
          --exclude='.env.development.local' \
          --exclude='.env.test' \
          --exclude='.env.test.local' \
          --exclude='*.md' \
          "$PROJECT_DIR/" "$INSTALL_DIR/"

# Handle .env file
if [ -f "$PROJECT_DIR/.env" ] && [ ! -f "$INSTALL_DIR/.env" ]; then
    echo -e "${YELLOW}Copying .env file...${NC}"
    cp "$PROJECT_DIR/.env" "$INSTALL_DIR/.env"
elif [ -f "$INSTALL_DIR/.env" ]; then
    echo -e "${GREEN}Using existing .env file in installation directory${NC}"
else
    echo -e "${YELLOW}No .env file found. Creating from example...${NC}"
    if [ -f "$INSTALL_DIR/.env.production.example" ]; then
        cp "$INSTALL_DIR/.env.production.example" "$INSTALL_DIR/.env"
        echo -e "${YELLOW}Please edit $INSTALL_DIR/.env with your configuration${NC}"
    fi
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$INSTALL_DIR"
npm ci --legacy-peer-deps --production=false

# Build the application
echo -e "${YELLOW}Building the application...${NC}"
npm run build

# Ensure public directory is accessible in standalone build
echo -e "${YELLOW}Setting up static files...${NC}"
# In standalone mode, public should be in the root, which is already copied
# But we need to ensure .next/static is properly linked/copied
if [ -d "$INSTALL_DIR/.next/standalone" ]; then
    # Copy public to standalone directory if it's not there
    if [ ! -d "$INSTALL_DIR/.next/standalone/public" ]; then
        cp -r "$INSTALL_DIR/public" "$INSTALL_DIR/.next/standalone/public" 2>/dev/null || true
    fi
    # Ensure .next/static is accessible from standalone
    if [ ! -d "$INSTALL_DIR/.next/standalone/.next" ]; then
        mkdir -p "$INSTALL_DIR/.next/standalone/.next"
    fi
    if [ ! -d "$INSTALL_DIR/.next/standalone/.next/static" ]; then
        cp -r "$INSTALL_DIR/.next/static" "$INSTALL_DIR/.next/standalone/.next/static" 2>/dev/null || true
    fi
fi

# Check if service user exists, create if not
echo -e "${YELLOW}Checking service user...${NC}"
if ! id "$SERVICE_USER" &>/dev/null; then
    echo -e "${YELLOW}User $SERVICE_USER does not exist. Creating...${NC}"
    # Try to create user, fallback to current user if fails
    if useradd -r -s /bin/false -d "$INSTALL_DIR" "$SERVICE_USER" 2>/dev/null; then
        echo -e "${GREEN}User $SERVICE_USER created${NC}"
    else
        echo -e "${YELLOW}Could not create user $SERVICE_USER. Using current user instead.${NC}"
        SERVICE_USER=$(whoami)
        SERVICE_GROUP=$(id -gn)
    fi
else
    echo -e "${GREEN}User $SERVICE_USER exists${NC}"
fi

# Set ownership
echo -e "${YELLOW}Setting ownership...${NC}"
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"

# Install systemd service
echo -e "${YELLOW}Installing systemd service...${NC}"
# Create temporary service file with correct user/group
cp "$INSTALL_DIR/systemd/$SERVICE_NAME.service" "/tmp/$SERVICE_NAME.service"
# Update user/group in service file
sed -i "s/^User=.*/User=$SERVICE_USER/g; s/^Group=.*/Group=$SERVICE_GROUP/g" "/tmp/$SERVICE_NAME.service"
cp "/tmp/$SERVICE_NAME.service" "/etc/systemd/system/$SERVICE_NAME.service"
rm -f "/tmp/$SERVICE_NAME.service"
systemctl daemon-reload

# Enable service
echo -e "${YELLOW}Enabling service...${NC}"
systemctl enable "$SERVICE_NAME.service"

echo -e "\n${GREEN}=== Installation completed successfully! ===${NC}\n"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Edit environment variables: ${GREEN}$INSTALL_DIR/.env${NC}"
echo -e "2. Update systemd service if needed: ${GREEN}/etc/systemd/system/$SERVICE_NAME.service${NC}"
echo -e "3. Start the service: ${GREEN}systemctl start $SERVICE_NAME${NC}"
echo -e "4. Check status: ${GREEN}systemctl status $SERVICE_NAME${NC}"
echo -e "5. View logs: ${GREEN}journalctl -u $SERVICE_NAME -f${NC}\n"

