#!/bin/bash

# Fluid Central Server Deployment Script
# This script deploys the Fluid central server to your VPS

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✓ $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✗ $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ⚠ $1"
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
        log_error "This deployment script is designed for Ubuntu only."
        exit 1
    fi

    log_success "Ubuntu detected"
}

# Install system dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    apt-get update >> /tmp/fluid-deploy.log 2>&1
    
    apt-get install -y \
        curl \
        git \
        nodejs \
        npm \
        nginx \
        >> /tmp/fluid-deploy.log 2>&1
    
    log_success "System dependencies installed"
}

# Clone repository
clone_repository() {
    log "Cloning Fluid repository..."
    
    if [ -d "/opt/fluid" ]; then
        log_warning "Fluid directory already exists, pulling latest changes..."
        cd /opt/fluid
        git pull >> /tmp/fluid-deploy.log 2>&1
    else
        git clone https://github.com/khaliduzzamantanoy/ubuntufluid.git /opt/fluid >> /tmp/fluid-deploy.log 2>&1
        cd /opt/fluid
    fi
    
    log_success "Repository cloned/updated"
}

# Install Node.js dependencies
install_node_dependencies() {
    log "Installing Node.js dependencies..."
    
    cd /opt/fluid
    npm install >> /tmp/fluid-deploy.log 2>&1
    
    cd /opt/fluid/server
    npm install >> /tmp/fluid-deploy.log 2>&1
    
    cd /opt/fluid/client
    npm install >> /tmp/fluid-deploy.log 2>&1
    
    log_success "Node.js dependencies installed"
}

# Build frontend
build_frontend() {
    log "Building frontend..."
    
    cd /opt/fluid/client
    npm run build >> /tmp/fluid-deploy.log 2>&1
    
    log_success "Frontend built"
}

# Setup environment
setup_environment() {
    log "Setting up environment..."
    
    if [ ! -f "/opt/fluid/server/.env" ]; then
        log_warning ".env file not found. Creating with defaults..."
        cp /opt/fluid/server/.env.example /opt/fluid/server/.env
        log_success ".env file created with default values"
    fi
    
    log_success "Environment setup complete"
}

# Setup Nginx
setup_nginx() {
    log "Setting up Nginx..."
    
    cat > /etc/nginx/sites-available/fluid << 'EOF'
server {
    listen 80;
    server_name fluid.swe.bd;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
    
    ln -sf /etc/nginx/sites-available/fluid /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    nginx -t >> /tmp/fluid-deploy.log 2>&1
    systemctl reload nginx >> /tmp/fluid-deploy.log 2>&1
    
    log_success "Nginx configured"
}

# Setup systemd service
setup_systemd() {
    log "Setting up systemd service..."
    
    cat > /etc/systemd/system/fluid.service << 'EOF'
[Unit]
Description=Fluid VPS Installer Central Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/fluid/server
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload >> /tmp/fluid-deploy.log 2>&1
    systemctl enable fluid >> /tmp/fluid-deploy.log 2>&1
    systemctl restart fluid >> /tmp/fluid-deploy.log 2>&1
    
    log_success "Systemd service configured and started"
}

# Display completion message
show_completion() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}          Fluid Central Server Deployment Complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo -e "  1. Set up DNS for fluid.swe.bd pointing to this VPS"
    echo -e "  2. Configure SSL: sudo certbot --nginx -d fluid.swe.bd"
    echo -e "  3. Access your Fluid server: https://fluid.swe.bd"
    echo ""
    echo -e "${BLUE}Service Management:${NC}"
    echo -e "  Start:   sudo systemctl start fluid"
    echo -e "  Stop:    sudo systemctl stop fluid"
    echo -e "  Restart: sudo systemctl restart fluid"
    echo -e "  Status:  sudo systemctl status fluid"
    echo -e "  Logs:    sudo journalctl -u fluid -f"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Main deployment process
main() {
    log "Starting Fluid Central Server deployment..."
    
    check_root
    check_ubuntu
    install_dependencies
    clone_repository
    install_node_dependencies
    build_frontend
    setup_environment
    setup_nginx
    setup_systemd
    show_completion
    
    log "Fluid Central Server deployment complete!"
}

# Run main function
main
