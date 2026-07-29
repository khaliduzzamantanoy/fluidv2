#!/usr/bin/env bash

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "=============================================================================="
echo "                   FLUID -- VPS PORTAL (v2.0)                                 "
echo "                   PostgreSQL + Prisma Edition                                "
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
echo -e "${GREEN}[1/8] OS:${NC} $OS $VER"

echo -e "${GREEN}[2/8] Installing core dependencies...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl wget git build-essential python3 python3-pip software-properties-common nginx certbot python3-certbot-nginx ufw gnupg

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
npm install -g pm2 pnpm >/dev/null 2>&1 || true

echo -e "${GREEN}[3/8] Installing PostgreSQL...${NC}"
if ! command -v psql >/dev/null 2>&1; then
  apt-get install -y postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql
  echo -e "${GREEN}[OK] PostgreSQL installed and running${NC}"
else
  echo -e "${GREEN}[OK] PostgreSQL already installed${NC}"
  systemctl start postgresql 2>/dev/null || true
fi

FLUID_DIR="/opt/fluid"
echo -e "${GREEN}[4/8] Setting up Fluid at ${FLUID_DIR}...${NC}"

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

echo -e "${GREEN}[5/8] Installing Node.js dependencies...${NC}"
npm install --include=dev 2>&1 | tail -3

echo -e "${GREEN}[INFO] Generating Prisma client...${NC}"
npx prisma generate 2>&1 | tail -3

echo -e "${GREEN}[6/8] Configuring database...${NC}"
node server/setup-db.js 2>&1 || echo -e "${YELLOW}[WARN] PostgreSQL setup incomplete - run manually with: npm run setup:db${NC}"

echo -e "${GREEN}[INFO] Building frontend...${NC}"
npm run build 2>&1 | tail -10 || {
  echo -e "${YELLOW}[WARN] First build failed, retrying with clean install...${NC}"
  rm -rf node_modules .next
  npm install 2>&1 | tail -3
  npx prisma generate 2>&1 | tail -2
  npm run build 2>&1 | tail -5 || echo -e "${YELLOW}[WARN] Build still failing - check logs at /var/log/fluid.error.log${NC}"
}

echo -e "${GREEN}[INFO] Configuring firewall...${NC}"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 6776/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw allow 22/tcp >/dev/null 2>&1 || true
fi

echo -e "${GREEN}[7/8] Creating systemd service...${NC}"
cat > /etc/systemd/system/fluid.service << 'SERVICEEOF'
[Unit]
Description=Fluid VPS Portal
After=network.target postgresql.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/fluid
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=append:/var/log/fluid.log
StandardError=append:/var/log/fluid.error.log

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable fluid

echo -e "${GREEN}[8/8] Starting Fluid service...${NC}"
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
echo -e "  If this is the first time, create your admin account at the setup page."
echo -e "  Manage your projects, domains, deployments, and server all in one place."
echo ""
echo -e "  ${YELLOW}Useful commands:${NC}"
echo -e "  systemctl status fluid   # Check service status"
echo -e "  journalctl -u fluid -f   # Follow logs"
echo -e "  npm run setup:auth       # Create additional admin users"
echo "=============================================================================="
