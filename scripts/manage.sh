#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SERVICE_NAME="kspguti-schedule"
INSTALL_DIR="/opt/kspguti-schedule"

show_usage() {
    echo -e "${BLUE}Usage: $0 {start|stop|restart|status|logs|update|enable|disable}${NC}"
    echo ""
    echo "Commands:"
    echo "  start    - Start the service"
    echo "  stop     - Stop the service"
    echo "  restart  - Restart the service"
    echo "  status   - Show service status"
    echo "  logs     - Show service logs (use -f for follow)"
    echo "  update   - Update the application (pull, install, build, restart)"
    echo "  enable   - Enable service to start on boot"
    echo "  disable  - Disable service from starting on boot"
    exit 1
}

check_root() {
    if [ "$1" != "status" ] && [ "$1" != "logs" ] && [ "$EUID" -ne 0 ]; then
        echo -e "${RED}This command requires root privileges (use sudo)${NC}"
        exit 1
    fi
}

case "$1" in
    start)
        check_root "$1"
        echo -e "${YELLOW}Starting $SERVICE_NAME...${NC}"
        systemctl start "$SERVICE_NAME"
        systemctl status "$SERVICE_NAME" --no-pager
        ;;
    stop)
        check_root "$1"
        echo -e "${YELLOW}Stopping $SERVICE_NAME...${NC}"
        systemctl stop "$SERVICE_NAME"
        echo -e "${GREEN}Service stopped${NC}"
        ;;
    restart)
        check_root "$1"
        echo -e "${YELLOW}Restarting $SERVICE_NAME...${NC}"
        systemctl restart "$SERVICE_NAME"
        systemctl status "$SERVICE_NAME" --no-pager
        ;;
    status)
        systemctl status "$SERVICE_NAME" --no-pager
        ;;
    logs)
        if [ "$2" == "-f" ]; then
            journalctl -u "$SERVICE_NAME" -f
        else
            journalctl -u "$SERVICE_NAME" -n 50 --no-pager
        fi
        ;;
    update)
        check_root "$1"
        echo -e "${YELLOW}Updating $SERVICE_NAME...${NC}"
        
        if [ ! -d "$INSTALL_DIR" ]; then
            echo -e "${RED}Installation directory not found: $INSTALL_DIR${NC}"
            exit 1
        fi
        
        # Get the directory where the script is located (project root)
        SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
        PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
        
        echo -e "${YELLOW}Project directory: $PROJECT_DIR${NC}"
        echo -e "${YELLOW}Installation directory: $INSTALL_DIR${NC}"
        
        # Stop service
        echo -e "${YELLOW}Stopping service...${NC}"
        systemctl stop "$SERVICE_NAME"
        
        # Pull latest changes in project root (if using git)
        cd "$PROJECT_DIR"
        if [ -d ".git" ]; then
            echo -e "${YELLOW}Pulling latest changes from git...${NC}"
            git pull
        else
            echo -e "${YELLOW}Not a git repository, skipping pull${NC}"
        fi
        
        # Copy updated files to installation directory
        echo -e "${YELLOW}Copying updated files to installation directory...${NC}"
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
                  --exclude='.dependencies.hash' \
                  "$PROJECT_DIR/" "$INSTALL_DIR/"
        
        # Handle .env file (preserve existing if present)
        if [ -f "$INSTALL_DIR/.env" ]; then
            echo -e "${GREEN}Preserving existing .env file${NC}"
        elif [ -f "$PROJECT_DIR/.env" ]; then
            echo -e "${YELLOW}Copying .env file...${NC}"
            cp "$PROJECT_DIR/.env" "$INSTALL_DIR/.env"
        fi
        
        # Change to installation directory for build
        cd "$INSTALL_DIR"
        
        # Install dependencies (with check)
        echo -e "${YELLOW}Checking dependencies...${NC}"
        
        # Check if node_modules exists and is up to date
        NEED_INSTALL=true
        LOCK_FILE=""
        DEPENDENCY_HASH_FILE="$INSTALL_DIR/.dependencies.hash"
        
        if [ -f "package-lock.json" ]; then
            LOCK_FILE="package-lock.json"
        elif [ -f "pnpm-lock.yaml" ]; then
            LOCK_FILE="pnpm-lock.yaml"
        fi
        
        if [ -d "node_modules" ] && [ -n "$LOCK_FILE" ] && [ -f "package.json" ] && [ -f "$LOCK_FILE" ]; then
            # Calculate hash of package files (content-based, not timestamp)
            CURRENT_HASH=$(cat package.json "$LOCK_FILE" 2>/dev/null | md5sum | cut -d' ' -f1)
            
            # Check if hash file exists and matches
            if [ -f "$DEPENDENCY_HASH_FILE" ]; then
                SAVED_HASH=$(cat "$DEPENDENCY_HASH_FILE" 2>/dev/null)
                if [ "$CURRENT_HASH" = "$SAVED_HASH" ]; then
                    # Hash matches, check if key dependencies exist
                    if [ -d "node_modules/.bin" ] && [ "$(ls -A node_modules/.bin 2>/dev/null | wc -l)" -gt 0 ]; then
                        if [ -d "node_modules/next" ] && [ -d "node_modules/react" ] && [ -d "node_modules/typescript" ]; then
                            echo -e "${GREEN}Dependencies are up to date (content unchanged), skipping installation...${NC}"
                            NEED_INSTALL=false
                        else
                            echo -e "${YELLOW}Hash matches but some dependencies missing, reinstalling...${NC}"
                            NEED_INSTALL=true
                        fi
                    else
                        echo -e "${YELLOW}Hash matches but node_modules incomplete, reinstalling...${NC}"
                        NEED_INSTALL=true
                    fi
                else
                    echo -e "${YELLOW}Dependency files changed (content differs), reinstalling...${NC}"
                    NEED_INSTALL=true
                fi
            else
                echo -e "${YELLOW}No hash file found, need to install dependencies...${NC}"
                NEED_INSTALL=true
            fi
        fi
        
        if [ "$NEED_INSTALL" = true ]; then
            echo -e "${YELLOW}Installing dependencies...${NC}"
            npm ci --legacy-peer-deps --production=false
            
            # Save hash after successful installation
            if [ -n "$LOCK_FILE" ] && [ -f "package.json" ] && [ -f "$LOCK_FILE" ]; then
                cat package.json "$LOCK_FILE" 2>/dev/null | md5sum | cut -d' ' -f1 > "$DEPENDENCY_HASH_FILE"
                echo -e "${GREEN}Saved dependency hash for future checks${NC}"
            fi
        else
            echo -e "${GREEN}Dependencies are up to date, skipping installation${NC}"
        fi
        
        # Build
        echo -e "${YELLOW}Building application...${NC}"
        if ! npm run build; then
            echo -e "${RED}Build failed! Please check the error messages above.${NC}"
            echo -e "${RED}The .next/standalone directory will not be created if the build fails.${NC}"
            exit 1
        fi
        
        # Ensure public directory and static files are accessible in standalone build
        echo -e "${YELLOW}Setting up static files...${NC}"
        if [ -d "$INSTALL_DIR/.next/standalone" ]; then
            # Copy public directory to standalone (always update)
            if [ -d "$INSTALL_DIR/public" ]; then
                echo -e "${YELLOW}Copying public directory to standalone...${NC}"
                cp -r "$INSTALL_DIR/public" "$INSTALL_DIR/.next/standalone/public" 2>/dev/null || true
            fi
            # Copy .next/static to standalone/.next/static (always update)
            if [ -d "$INSTALL_DIR/.next/static" ]; then
                echo -e "${YELLOW}Copying .next/static to standalone...${NC}"
                mkdir -p "$INSTALL_DIR/.next/standalone/.next"
                cp -r "$INSTALL_DIR/.next/static" "$INSTALL_DIR/.next/standalone/.next/static" 2>/dev/null || true
            else
                echo -e "${RED}Warning: .next/static directory not found!${NC}"
            fi
        else
            echo -e "${RED}Error: .next/standalone directory not found!${NC}"
            echo -e "${RED}This usually means the build failed or output: 'standalone' is not configured correctly.${NC}"
            echo -e "${RED}Please check next.config.js and ensure the build completed successfully.${NC}"
            exit 1
        fi
        
        # Set ownership
        chown -R www-data:www-data "$INSTALL_DIR"
        
        # Reload systemd and restart
        systemctl daemon-reload
        echo -e "${YELLOW}Starting service...${NC}"
        systemctl start "$SERVICE_NAME"
        
        echo -e "${GREEN}Update completed!${NC}"
        systemctl status "$SERVICE_NAME" --no-pager
        ;;
    enable)
        check_root "$1"
        echo -e "${YELLOW}Enabling $SERVICE_NAME to start on boot...${NC}"
        systemctl enable "$SERVICE_NAME"
        echo -e "${GREEN}Service enabled${NC}"
        ;;
    disable)
        check_root "$1"
        echo -e "${YELLOW}Disabling $SERVICE_NAME from starting on boot...${NC}"
        systemctl disable "$SERVICE_NAME"
        echo -e "${GREEN}Service disabled${NC}"
        ;;
    *)
        show_usage
        ;;
esac

exit 0

