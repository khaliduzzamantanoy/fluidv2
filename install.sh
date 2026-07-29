#!/usr/bin/env bash

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "=============================================================================="
echo "                   FLUID -- VPS PORTAL (v2.0)                                 "
echo "=============================================================================="
echo -e "${NC}"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run as root (e.g. sudo bash)${NC}"; exit 1
fi

if [ -f /etc/os-release ]; then
  . /etc/os-release; OS=$NAME; VER=$VERSION_ID
else
  echo -e "${RED}[ERROR] Cannot detect OS. Ubuntu 22.04+ recommended.${NC}"; exit 1
fi
echo -e "${GREEN}[1/6] OS:${NC} $OS $VER"

echo -e "${GREEN}[2/6] Installing core dependencies...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl wget git build-essential nginx ufw

NODE_NEED_INSTALL=true
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  [ "$NODE_VER" -ge 18 ] && NODE_NEED_INSTALL=false
fi
if [ "$NODE_NEED_INSTALL" = true ]; then
  echo -e "${GREEN}[INFO] Installing Node.js 20 LTS...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo -e "${GREEN}[INFO] Installing PM2...${NC}"
npm install -g pm2 >/dev/null 2>&1 || true

# Enable PM2 startup to resurrect processes on reboot
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
pm2 save >/dev/null 2>&1 || true

FLUID_DIR="/opt/fluid"
echo -e "${GREEN}[3/6] Setting up Fluid at ${FLUID_DIR}...${NC}"

if [ -d "./server" ] && [ -f "./package.json" ]; then
  cp -r ./* "$FLUID_DIR/" 2>/dev/null || true
fi

if [ ! -f "$FLUID_DIR/package.json" ]; then
  mkdir -p "$FLUID_DIR"
  curl -fsSL https://github.com/khaliduzzamantanoy/fluidv2/archive/refs/heads/main.tar.gz | tar -xz -C "$FLUID_DIR" --strip-components=1 2>/dev/null || {
    git clone --depth 1 https://github.com/khaliduzzamantanoy/fluidv2.git "$FLUID_DIR" || {
      echo -e "${RED}[ERROR] Failed to download Fluid${NC}"; exit 1
    }
  }
fi

cd "$FLUID_DIR"

echo -e "${GREEN}[4/6] Installing Node.js dependencies...${NC}"
npm install --include=dev 2>&1 | tail -3

echo -e "${GREEN}[INFO] Configuring database...${NC}"
ADMIN_PASSWORD=""
node server/setup-db.js 2>&1 | tee /tmp/fluid-setup.log
ADMIN_PASSWORD=$(grep "^FLUID_ADMIN_PASSWORD=" /tmp/fluid-setup.log | tail -1 | cut -d= -f2)
rm -f /tmp/fluid-setup.log

echo -e "${GREEN}[INFO] Building frontend...${NC}"
npm run build 2>&1 | tail -5

echo -e "${GREEN}[INFO] Configuring firewall...${NC}"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 6776/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw allow 22/tcp >/dev/null 2>&1 || true
fi

echo -e "${GREEN}[5/6] Creating systemd service...${NC}"
cat > /etc/systemd/system/fluid.service << 'SERVICEEOF'
[Unit]
Description=Fluid VPS Portal
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/fluid
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
KillMode=process
StandardOutput=append:/var/log/fluid.log
StandardError=append:/var/log/fluid.error.log

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable fluid

echo -e "${GREEN}[6/6] Starting Fluid service...${NC}"
systemctl start fluid || {
  echo -e "${YELLOW}[WARN] Service start failed. Starting manually...${NC}"
  nohup node server/index.js > /var/log/fluid.log 2>&1 &
}

sleep 3

if systemctl is-active --quiet fluid 2>/dev/null || pgrep -f "node server/index.js" > /dev/null; then
  echo -e "${GREEN}[OK] Fluid is running${NC}"
else
  echo -e "${YELLOW}[WARN] Checking /var/log/fluid.log for details${NC}"
fi

VPS_IP=$(curl -s --max-time 3 https://api.ipify.org || curl -s --max-time 3 https://ifconfig.me || echo "VPS_IP")

echo -e "${GREEN}${BOLD}"
echo "=============================================================================="
echo "             FLUID VPS PORTAL IS READY!                                       "
echo "=============================================================================="
echo -e "${NC}"
echo -e "  Open your browser and navigate to:"
echo -e "  ${CYAN}${BOLD}http://${VPS_IP}:6776${NC}"
echo ""

if [ -n "$ADMIN_PASSWORD" ]; then
  echo -e "  ${BOLD}Login credentials:${NC}"
  echo -e "  Username: ${CYAN}admin${NC}"
  echo -e "  Password: ${CYAN}${ADMIN_PASSWORD}${NC}"
  echo -e "  ${YELLOW}⚠ You will be prompted to change this password on first login.${NC}"
  echo ""
fi

echo -e "  Manage your projects, domains, deployments, and server all in one place."
echo ""
echo -e "  ${YELLOW}Useful commands:${NC}"
echo -e "  systemctl status fluid   # Check service status"
echo -e "  journalctl -u fluid -f   # Follow logs"
echo "=============================================================================="
