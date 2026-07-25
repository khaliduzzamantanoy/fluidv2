# Fluid Central Server Deployment Guide

This guide will help you deploy the Fluid central server to your VPS.

## Prerequisites

- Ubuntu VPS (20.04+ recommended)
- Domain name: fluid.swe.bd
- GitHub OAuth app configured
- SSH access to VPS

## Quick Deployment

### Option 1: Automated Deployment (Recommended)

Run this command on your VPS:

```bash
curl -fsSL https://fluid.swe.bd/deploy.sh | bash
```

This will:
- Install all dependencies
- Clone the repository
- Build the frontend
- Configure Nginx
- Setup systemd service
- Start the server

### Option 2: Manual Deployment

#### Step 1: SSH into your VPS

```bash
ssh root@your-vps-ip
```

#### Step 2: Install Dependencies

```bash
apt update
apt install -y curl git nodejs npm nginx
```

#### Step 3: Clone Repository

```bash
git clone https://github.com/khaliduzzamantanoy/ubuntufluid.git /opt/fluid
cd /opt/fluid
```

#### Step 4: Install Node.js Dependencies

```bash
npm install
cd server && npm install
cd ../client && npm install
```

#### Step 5: Build Frontend

```bash
cd /opt/fluid/client
npm run build
```

#### Step 6: Configure Environment

```bash
cd /opt/fluid/server
nano .env
```

Add your GitHub OAuth credentials:
```env
PORT=3000
CLIENT_URL=https://fluid.swe.bd
GITHUB_CLIENT_ID=Ov23lixc10ZT3lahfJtf
GITHUB_CLIENT_SECRET=aef5fe2a78eba62cd79ba05532cebd45468ab2ce
GITHUB_CALLBACK_URL=https://fluid.swe.bd
SERVER_URL=https://fluid.swe.bd
```

#### Step 7: Setup Nginx

```bash
cp /opt/fluid/nginx.conf /etc/nginx/sites-available/fluid
ln -s /etc/nginx/sites-available/fluid /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

#### Step 8: Setup Systemd Service

```bash
cp /opt/fluid/fluid.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable fluid
systemctl start fluid
```

## Post-Deployment Steps

### Step 1: Configure DNS

Go to your domain registrar and add:
- **Type**: A
- **Name**: @ (or fluid.swe.bd)
- **Value**: Your VPS IP address

### Step 2: Configure SSL

```bash
sudo certbot --nginx -d fluid.swe.bd
```

### Step 3: Test the Deployment

1. Access `https://fluid.swe.bd`
2. Test GitHub authentication
3. Connect a test VPS
4. Deploy a test project

## Service Management

```bash
# Start service
sudo systemctl start fluid

# Stop service
sudo systemctl stop fluid

# Restart service
sudo systemctl restart fluid

# Check status
sudo systemctl status fluid

# View logs
sudo journalctl -u fluid -f
```

## Updating the Server

To update to the latest version:

```bash
cd /opt/fluid
git pull
npm install
cd server && npm install
cd ../client && npm install
npm run build
sudo systemctl restart fluid
```

## Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u fluid -n 50

# Check if port 3000 is in use
sudo netstat -tlnp | grep 3000
```

### Nginx errors

```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### GitHub OAuth issues

- Verify your OAuth app callback URL matches your domain
- Check that Device Flow is enabled
- Ensure your credentials are correct in `.env`

## Security Notes

- Keep your `.env` file secure and never commit it
- Use strong passwords for SSH access
- Keep your system updated: `apt update && apt upgrade`
- Configure firewall: `ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable`

## Support

For issues or questions, please open an issue on GitHub.
