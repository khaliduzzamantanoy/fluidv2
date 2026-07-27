#!/usr/bin/env bash

# ==============================================================================
# FLUID — ONE TIME VPS DEPLOYMENT ASSISTANT
# One-liner automated installation script for Ubuntu VPS
# Usage: curl -fsSL https://fluid.yourdomain.com/install | bash
# Version: 1.0.3
# ==============================================================================

set -e

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "=============================================================================="
echo "                   FLUID — VPS DEPLOYMENT ASSISTANT                           "
echo "                              Version 1.0.3                                   "
echo "=============================================================================="
echo -e "${NC}"

# 1. OS & PERMISSION CHECK
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run this installer as root (e.g. sudo bash)${NC}"
  exit 1
fi

if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$NAME
  VER=$VERSION_ID
else
  echo -e "${RED}[ERROR] Cannot detect OS version. Ubuntu 22.04+ recommended.${NC}"
  exit 1
fi

echo -e "${GREEN}[1/5] OS Detected:${NC} $OS $VER"

if [[ "$ID" != "ubuntu" && "$ID_LIKE" != *"ubuntu"* ]]; then
  echo -e "${YELLOW}[WARNING] System is not Ubuntu ($ID). Continuing anyway...${NC}"
fi

# 2. UPDATE & INSTALL DEPENDENCIES
echo -e "${GREEN}[2/5] Updating package index & installing core dependencies...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl wget git build-essential python3 python3-pip software-properties-common nginx certbot python3-certbot-nginx ufw

# Install Node.js Latest LTS via NodeSource if node is missing or older than v18
NODE_NEED_INSTALL=true
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -ge 18 ]; then
    NODE_NEED_INSTALL=false
    echo -e "${GREEN}[INFO] Node.js $(node -v) is already installed.${NC}"
  fi
fi

if [ "$NODE_NEED_INSTALL" = true ]; then
  echo -e "${GREEN}[INFO] Installing Node.js LTS...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Install Global Package Managers & PM2
echo -e "${GREEN}[INFO] Installing PM2 and pnpm...${NC}"
npm install -g pm2 pnpm >/dev/null 2>&1 || true

# 3. SET UP TEMPORARY WORKSPACE
FLUID_DIR="/tmp/fluid"
echo -e "${GREEN}[3/5] Setting up temporary workspace at ${FLUID_DIR}...${NC}"
rm -rf "$FLUID_DIR"
mkdir -p "$FLUID_DIR"

# Download or clone Fluid codebase into /tmp/fluid
if [ -d "./server" ] && [ -f "./package.json" ]; then
  # Local copy if executing inside repository
  cp -r ./* "$FLUID_DIR/"
else
  # Remote archive download from repo
  echo -e "${GREEN}[INFO] Downloading Fluid codebase archive...${NC}"
  curl -fsSL https://github.com/khaliduzzamantanoy/fluidv2/archive/refs/heads/main.tar.gz | tar -xz -C "$FLUID_DIR" --strip-components=1 2>/dev/null || {
    git clone --depth 1 https://github.com/khaliduzzamantanoy/fluidv2.git "$FLUID_DIR" || {
      echo -e "${RED}[ERROR] Failed to download fluidv2.${NC}"
      exit 1
    }
  }
fi

cd "$FLUID_DIR"

# 4. BUILD & START FLUID SERVICE
echo -e "${GREEN}[4/5] Building Fluid GUI & launching setup service...${NC}"
npm install --silent
npm run build || true

# Open firewall port 6776 if ufw is active
if command -v ufw >/dev/null 2>&1; then
  ufw allow 6776/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
fi

# 5. GET VPS PUBLIC IP & DISPLAY SUCCESS
VPS_IP=$(curl -s --max-time 3 https://api.ipify.org || curl -s --max-time 3 https://ifconfig.me || echo "VPS_IP")

# Launch Fastify server in background / daemon
nohup node server/index.js > /tmp/fluid_server.log 2>&1 &

sleep 2

echo -e "${GREEN}${BOLD}"
echo "=============================================================================="
echo "             FLUID SETUP SERVICE IS READY & LISTENING!                        "
echo "=============================================================================="
echo -e "${NC}"
echo -e "Open your web browser and navigate to:"
echo -e "${CYAN}${BOLD}http://${VPS_IP}:6776${NC}"
echo -e "http://localhost:6776"
echo ""
echo -e "${YELLOW}Follow the guided 13-step wizard to complete project deployment.${NC}"
echo -e "Fluid will self-destruct automatically when deployment finishes."
echo "=============================================================================="
