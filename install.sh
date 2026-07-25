#!/bin/bash

# Fluid VPS Installer - Self-Installing Script
# This script installs the Fluid environment and cleans up after deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FLUID_DIR="/tmp/fluid-installer"
INSTALL_DIR="/opt/fluid"
LOG_FILE="/tmp/fluid-install.log"
CLEANUP=true

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✓ $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✗ $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ⚠ $1" | tee -a "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run as root or with sudo"
        exit 1
    fi
}

# Check if Ubuntu
check_ubuntu() {
    if [ ! -f /etc/os-release ]; then
        log_error "Cannot detect OS. /etc/os-release not found."
        exit 1
    fi

    if ! grep -q "Ubuntu" /etc/os-release; then
        log_error "This installer is designed for Ubuntu only."
        exit 1
    fi

    log_success "Ubuntu detected"
}

# Install system dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    apt-get update >> "$LOG_FILE" 2>&1
    
    # Install essential packages
    apt-get install -y \
        curl \
        git \
        nodejs \
        npm \
        python3 \
        python3-pip \
        build-essential \
        nginx \
        certbot \
        python3-certbot-nginx \
        docker.io \
        docker-compose \
        >> "$LOG_FILE" 2>&1
    
    # Install PM2 globally
    npm install -g pm2 >> "$LOG_FILE" 2>&1
    
    log_success "System dependencies installed"
}

# Clone Fluid installer
clone_fluid() {
    log "Cloning Fluid installer..."
    
    # Create temp directory
    mkdir -p "$FLUID_DIR"
    cd "$FLUID_DIR"
    
    # Clone the repository (replace with actual repo URL)
    git clone https://github.com/yourusername/fluid-vps-installer.git . >> "$LOG_FILE" 2>&1
    
    log_success "Fluid installer cloned"
}

# Install Node.js dependencies
install_node_dependencies() {
    log "Installing Node.js dependencies..."
    
    cd "$FLUID_DIR/server"
    npm install >> "$LOG_FILE" 2>&1
    
    cd "$FLUID_DIR/client"
    npm install >> "$LOG_FILE" 2>&1
    
    # Build the frontend
    npm run build >> "$LOG_FILE" 2>&1
    
    log_success "Node.js dependencies installed and frontend built"
}

# Setup environment
setup_environment() {
    log "Setting up environment..."
    
    # Create installation directory
    mkdir -p "$INSTALL_DIR"
    
    # Copy files to installation directory
    cp -r "$FLUID_DIR/server" "$INSTALL_DIR/"
    cp -r "$FLUID_DIR/client/dist" "$INSTALL_DIR/client/"
    
    # Create .env file with user-provided or placeholder credentials
    cat > "$INSTALL_DIR/server/.env" << EOF
PORT=3000
CLIENT_URL=http://localhost:3000
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID:-your_github_client_id}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET:-your_github_client_secret}
GITHUB_CALLBACK_URL=http://$SERVER_IP:3000
SERVER_IP=$SERVER_IP
EOF
    
    if [ -z "$GITHUB_CLIENT_ID" ] || [ -z "$GITHUB_CLIENT_SECRET" ]; then
        log_warning "GitHub OAuth credentials not provided. Users will need to configure them manually."
        log_warning "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables before running this script."
    else
        log_success "GitHub OAuth credentials configured"
    fi
    
    log_success "Environment setup complete with dynamic IP: $SERVER_IP"
}

# Setup systemd service
setup_systemd_service() {
    log "Setting up systemd service..."
    
    cat > /etc/systemd/system/fluid-installer.service << EOF
[Unit]
Description=Fluid VPS Installer
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/server
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload >> "$LOG_FILE" 2>&1
    systemctl enable fluid-installer >> "$LOG_FILE" 2>&1
    systemctl start fluid-installer >> "$LOG_FILE" 2>&1
    
    log_success "Systemd service configured and started"
}

# Setup Nginx for Fluid UI
setup_nginx() {
    log "Setting up Nginx for Fluid UI..."
    
    cat > /etc/nginx/sites-available/fluid-installer << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    
    ln -sf /etc/nginx/sites-available/fluid-installer /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    nginx -t >> "$LOG_FILE" 2>&1
    systemctl reload nginx >> "$LOG_FILE" 2>&1
    
    log_success "Nginx configured for Fluid UI"
}

# Get server IP
get_server_ip() {
    SERVER_IP=$(curl -s https://api.ipify.org)
    log_success "Server IP: $SERVER_IP"
}

# Display completion message
show_completion() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}          Fluid VPS Installer Installation Complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BLUE}Access the Fluid Installer:${NC}"
    echo -e "  URL: ${YELLOW}http://$SERVER_IP${NC}"
    echo ""
    echo -e "${BLUE}What's Next:${NC}"
    echo -e "  1. Open the URL in your browser"
    echo -e "  2. Authenticate with GitHub"
    echo -e "  3. Select your repository"
    echo -e "  4. Follow the deployment wizard"
    echo ""
    echo -e "${BLUE}Auto-Cleanup:${NC}"
    echo -e "  The installer will automatically remove itself after"
    echo -e "  completing your first deployment."
    echo ""
    echo -e "${BLUE}Logs:${NC}"
    echo -e "  Installation log: $LOG_FILE"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Cleanup function
cleanup() {
    if [ "$CLEANUP" = true ]; then
        log "Starting cleanup process..."
        
        # Stop and disable the service
        systemctl stop fluid-installer >> "$LOG_FILE" 2>&1
        systemctl disable fluid-installer >> "$LOG_FILE" 2>&1
        
        # Remove systemd service file
        rm -f /etc/systemd/system/fluid-installer.service
        systemctl daemon-reload >> "$LOG_FILE" 2>&1
        
        # Remove Nginx config
        rm -f /etc/nginx/sites-available/fluid-installer
        rm -f /etc/nginx/sites-enabled/fluid-installer
        systemctl reload nginx >> "$LOG_FILE" 2>&1
        
        # Remove installation directory
        rm -rf "$INSTALL_DIR"
        
        # Remove temp directory
        rm -rf "$FLUID_DIR"
        
        log_success "Cleanup complete. Fluid installer removed from system."
    fi
}

# Main installation process
main() {
    log "Starting Fluid VPS Installer installation..."
    
    check_root
    check_ubuntu
    install_dependencies
    clone_fluid
    install_node_dependencies
    setup_environment
    setup_systemd_service
    setup_nginx
    get_server_ip
    show_completion
    
    # Note: Cleanup will be called after first deployment via the web UI
    log "Fluid installer is now running. Access it to deploy your project."
    log "The installer will auto-cleanup after your first deployment."
}

# Run main function
main
