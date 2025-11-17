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

# Check Node.js version
echo -e "${YELLOW}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js ${NODE_VERSION}+ first.${NC}"
    exit 1
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt "$NODE_VERSION" ]; then
    echo -e "${RED}Node.js version ${NODE_VERSION}+ is required. Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}Node.js version: $(node -v)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed.${NC}"
    exit 1
fi

echo -e "${GREEN}npm version: $(npm -v)${NC}\n"

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
          --exclude='.env*' \
          --exclude='*.md' \
          "$PROJECT_DIR/" "$INSTALL_DIR/"

# Create .env.production if it doesn't exist
if [ ! -f "$INSTALL_DIR/.env.production" ]; then
    echo -e "${YELLOW}Creating .env.production from example...${NC}"
    if [ -f "$INSTALL_DIR/.env.production.example" ]; then
        cp "$INSTALL_DIR/.env.production.example" "$INSTALL_DIR/.env.production"
        echo -e "${YELLOW}Please edit $INSTALL_DIR/.env.production with your configuration${NC}"
    fi
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$INSTALL_DIR"
npm ci --legacy-peer-deps --production=false

# Build the application
echo -e "${YELLOW}Building the application...${NC}"
npm run build

# Set ownership
echo -e "${YELLOW}Setting ownership...${NC}"
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"

# Install systemd service
echo -e "${YELLOW}Installing systemd service...${NC}"
cp "$INSTALL_DIR/systemd/$SERVICE_NAME.service" "/etc/systemd/system/"
systemctl daemon-reload

# Enable service
echo -e "${YELLOW}Enabling service...${NC}"
systemctl enable "$SERVICE_NAME.service"

echo -e "\n${GREEN}=== Installation completed successfully! ===${NC}\n"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Edit environment variables: ${GREEN}$INSTALL_DIR/.env.production${NC}"
echo -e "2. Update systemd service if needed: ${GREEN}/etc/systemd/system/$SERVICE_NAME.service${NC}"
echo -e "3. Start the service: ${GREEN}systemctl start $SERVICE_NAME${NC}"
echo -e "4. Check status: ${GREEN}systemctl status $SERVICE_NAME${NC}"
echo -e "5. View logs: ${GREEN}journalctl -u $SERVICE_NAME -f${NC}\n"

