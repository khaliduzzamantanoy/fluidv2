#!/bin/bash

# Fluid VPS Agent
# This script prepares a VPS for connection to the Fluid central server
# Users run this on their VPS to enable remote deployment

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
        log_error "This agent is designed for Ubuntu only."
        exit 1
    fi

    log_success "Ubuntu detected"
}

# Install basic dependencies
install_dependencies() {
    log "Installing basic dependencies..."
    
    apt-get update >> /tmp/fluid-agent.log 2>&1
    
    apt-get install -y \
        curl \
        git \
        python3 \
        python3-pip \
        build-essential \
        >> /tmp/fluid-agent.log 2>&1
    
    log_success "Basic dependencies installed"
}

# Install Node.js
install_nodejs() {
    log "Installing Node.js..."
    
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash - >> /tmp/fluid-agent.log 2>&1
        apt-get install -y nodejs >> /tmp/fluid-agent.log 2>&1
        log_success "Node.js installed"
    else
        log_success "Node.js already installed"
    fi
}

# Install Docker (optional)
install_docker() {
    log "Installing Docker..."
    
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com | bash >> /tmp/fluid-agent.log 2>&1
        log_success "Docker installed"
    else
        log_success "Docker already installed"
    fi
}

# Install PM2
install_pm2() {
    log "Installing PM2..."
    
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2 >> /tmp/fluid-agent.log 2>&1
        log_success "PM2 installed"
    else
        log_success "PM2 already installed"
    fi
}

# Install Nginx
install_nginx() {
    log "Installing Nginx..."
    
    if ! command -v nginx &> /dev/null; then
        apt-get install -y nginx >> /tmp/fluid-agent.log 2>&1
        log_success "Nginx installed"
    else
        log_success "Nginx already installed"
    fi
}

# Configure SSH for Fluid
configure_ssh() {
    log "Configuring SSH for Fluid..."
    
    # Ensure SSH directory exists
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh
    
    log_success "SSH configured"
}

# Setup firewall
setup_firewall() {
    log "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw allow 22/tcp >> /tmp/fluid-agent.log 2>&1
        ufw allow 80/tcp >> /tmp/fluid-agent.log 2>&1
        ufw allow 443/tcp >> /tmp/fluid-agent.log 2>&1
        log_success "Firewall configured"
    else
        log_warning "UFW not found, skipping firewall configuration"
    fi
}

# Display completion message
show_completion() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}          VPS Agent Setup Complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BLUE}Your VPS is now ready for Fluid deployment.${NC}"
    echo ""
    echo -e "${BLUE}What's Next:${NC}"
    echo -e "  1. Go to your Fluid central server"
    echo -e "  2. Connect this VPS using the SSH credentials"
    echo -e "  3. Select your GitHub repository"
    echo -e "  4. Deploy your project with one click"
    echo ""
    echo -e "${BLUE}VPS Information:${NC}"
    echo -e "  IP Address: $(curl -s https://api.ipify.org)"
    echo -e "  OS: $(lsb_release -d | cut -f2)"
    echo ""
    echo -e "${BLUE}Installed Components:${NC}"
    echo -e "  ✓ Node.js $(node --version)"
    echo -e "  ✓ npm $(npm --version)"
    echo -e "  ✓ Git $(git --version)"
    echo -e "  ✓ Python 3 $(python3 --version)"
    echo -e "  ✓ PM2 $(pm2 --version)"
    echo -e "  ✓ Nginx $(nginx --version)"
    if command -v docker &> /dev/null; then
        echo -e "  ✓ Docker $(docker --version)"
    fi
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Main installation process
main() {
    log "Starting Fluid VPS Agent setup..."
    
    check_root
    check_ubuntu
    install_dependencies
    install_nodejs
    install_docker
    install_pm2
    install_nginx
    configure_ssh
    setup_firewall
    show_completion
    
    log "VPS Agent setup complete. Your VPS is ready for Fluid deployment."
}

# Run main function
main
