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
        
        cd "$INSTALL_DIR"
        
        # Stop service
        echo -e "${YELLOW}Stopping service...${NC}"
        systemctl stop "$SERVICE_NAME"
        
        # Pull latest changes (if using git)
        if [ -d ".git" ]; then
            echo -e "${YELLOW}Pulling latest changes...${NC}"
            git pull
        else
            echo -e "${YELLOW}Not a git repository, skipping pull${NC}"
        fi
        
        # Install dependencies
        echo -e "${YELLOW}Installing dependencies...${NC}"
        npm ci --legacy-peer-deps --production=false
        
        # Build
        echo -e "${YELLOW}Building application...${NC}"
        npm run build
        
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

