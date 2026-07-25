# Fluid VPS Installer

A professional-grade web-based VPS installer for Ubuntu that simplifies deploying web applications from GitHub repositories with automated SSL, DNS configuration, and process management.

## Features

- **🔐 GitHub Authentication** - Support for both personal access tokens and device code flow
- **📦 Repository Management** - Select repositories with permission management
- **📁 Project Setup** - Automatic directory creation and git cloning
- **🔧 Environment Variables** - Smart parsing with auto-detection of keys, URLs, and secrets
- **🌐 Domain Configuration** - VPS IP auto-detection with domain setup
- **🔍 DNS Verification** - Real-time DNS checking and propagation monitoring
- **🛡️ SSL Management** - Let's Encrypt, Cloudflare, and self-signed certificate support
- **🏗️ Build Automation** - Auto-detection of project types and build commands
- **📺 Live Terminal** - Real-time terminal output via WebSocket streaming
- **🔑 SSH Key Generation** - Automatic SSH key generation for GitHub access
- **⚡ PM2 Integration** - Process management with auto-startup configuration
- **🚀 One-Click Deployment** - Complete automated deployment pipeline

## Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **Socket.io** - Real-time terminal streaming
- **Axios** - HTTP client for GitHub API
- **simple-git** - Git operations
- **node-pty** - Terminal emulation

### Frontend
- **React** - UI framework
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Lucide React** - Icons
- **Socket.io Client** - Real-time communication

## Prerequisites

- Ubuntu Server (20.04+ recommended)
- Node.js 18+ and npm
- Git
- Domain name (optional but recommended)
- GitHub account with repository access

## Installation

### Quick Install (One-Line Curl Command)

The fastest way to install Fluid on your Ubuntu VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/fluid-vps-installer/main/install.sh | bash
```

This single command will:
- Install all system dependencies (Node.js, Docker, Nginx, etc.)
- Clone and set up the Fluid installer
- Configure systemd service
- Setup Nginx reverse proxy
- Start the web interface
- Provide you with the access URL

**After installation**, the Fluid installer will:
- Deploy your project using the web interface
- Automatically remove itself from your VPS after successful deployment
- Keep your deployed application running in the background

### Manual Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/fluid-vps-installer.git
cd fluid-vps-installer
```

#### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the `server` directory:

```bash
cd server
cp .env.example .env
```

Edit `.env` with your configuration:

```env
PORT=3000
CLIENT_URL=http://localhost:5173
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### 4. GitHub OAuth Setup

To use the device code flow authentication:

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create a new OAuth App
3. Set the callback URL to: `http://your-server-ip:3000`
4. Copy the Client ID and Client Secret to your `.env` file

## Usage

### Development Mode

Run both frontend and backend in development mode:

```bash
# From project root
npm run dev
```

This will start:
- Backend server on `http://localhost:3000`
- Frontend dev server on `http://localhost:5173`

### Production Mode

Build and start the production server:

```bash
# Build the project
npm run build

# Start the server
npm start
```

The application will be available at `http://your-server-ip:3000`

## Deployment Guide

### Step-by-Step Installation Flow

1. **GitHub Authentication**
   - Choose between personal access token or device code flow
   - Grant repository permissions

2. **Repository Selection**
   - Browse and select your GitHub repository
   - Configure required permissions (read/write/admin)

3. **Project Directory**
   - Specify the installation directory on the VPS
   - Directory is created automatically if it doesn't exist

4. **Environment Variables**
   - Paste your `.env` file content
   - System auto-detects keys, URLs, and secret values

5. **Domain Configuration**
   - VPS IP is auto-detected
   - Configure primary和 www domains
   - DNS instructions are provided

6. **DNS Verification**
   - Check if domain is pointing to the VPS
   - Monitor DNS propagation across multiple servers

7. **SSL Setup**
   - Choose SSL provider (Let's Encrypt, Cloudflare, Self-Signed)
   - Automatic certificate installation and configuration

8. **Build & Deploy**
   - Repository cloning with live progress
   - Project type detection (Node.js, Python, etc.)
   - Dependency installation
   - Build command execution
   - Nginx configuration
   - SSL certificate setup
   - PM2 process management

9. **Completion**
   - SSH key generation for GitHub access
   - Access links to your live website
   - Background operation confirmation

## API Endpoints

### Authentication
- `POST /api/auth/token` - Authenticate with personal access token
- `POST /api/auth/device/initiate` - Start device code flow
- `POST /api/auth/device/poll` - Poll for device flow completion

### GitHub
- `GET /api/github/repos` - Get user repositories
- `GET /api/github/repos/:owner/:repo` - Get repository details
- `POST /api/github/check-access` - Check repository permissions

### System
- `GET /api/system/info` - Get system information
- `GET /api/system/check-ubuntu` - Verify Ubuntu installation
- `GET /api/system/ip` - Get VPS IP address
- `GET /api/system/disk` - Check disk space
- `GET /api/system/memory` - Check memory usage

### Project
- `POST /api/project/directory` - Create project directory
- `POST /api/project/clone` - Clone repository
- `POST /api/project/detect-type` - Detect project type
- `POST /api/project/detect-build` - Detect build commands
- `POST /api/project/install-deps` - Install dependencies
- `POST /api/project/parse-env` - Parse environment variables
- `POST /api/project/ssh-key` - Generate SSH key

### Domain
- `POST /api/domain/check-dns` - Check DNS records
- `POST /api/domain/check-propagation` - Check DNS propagation
- `POST /api/domain/detect-ssl` - Detect SSL provider

### SSL
- `POST /api/ssl/install` - Install SSL certificate
- `POST /api/ssl/configure-nginx` - Configure Nginx
- `GET /api/ssl/status/:domain` - Check SSL status

### PM2
- `GET /api/pm2/check` - Check PM2 installation
- `POST /api/pm2/install` - Install PM2
- `POST /api/pm2/start` - Start application with PM2
- `POST /api/pm2/startup` - Setup PM2 startup script
- `GET /api/pm2/list` - Get PM2 process list
- `POST /api/pm2/stop` - Stop application
- `POST /api/pm2/restart` - Restart application
- `POST /api/pm2/delete` - Delete application
- `GET /api/pm2/logs/:appName` - Get application logs

## WebSocket Events

### Client → Server
- `join-terminal` - Join terminal session
- `terminal-command` - Execute terminal command

### Server → Client
- `terminal-output` - Terminal output stream

## Project Structure

```
fluid-vps-installer/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthStep.jsx
│   │   │   ├── RepoStep.jsx
│   │   │   ├── DirectoryStep.jsx
│   │   │   ├── EnvStep.jsx
│   │   │   ├── DomainStep.jsx
│   │   │   ├── DnsStep.jsx
│   │   │   ├── SslStep.jsx
│   │   │   ├── BuildStep.jsx
│   │   │   ├── TerminalStep.jsx
│   │   │   └── CompleteStep.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
├── server/
│   ├── routes/
│   │   ├── auth.js
│   │   ├── github.js
│   │   ├── system.js
│   │   ├── project.js
│   │   ├── domain.js
│   │   ├── ssl.js
│   │   └── pm2.js
│   ├── services/
│   │   ├── githubAuth.js
│   │   ├── githubService.js
│   │   ├── systemService.js
│   │   ├── projectService.js
│   │   ├── domainService.js
│   │   ├── sslService.js
│   │   └── pm2Service.js
│   ├── index.js
│   ├── package.json
│   └── .env.example
├── package.json
└── README.md
```

## Supported Frameworks

Fluid VPS Installer supports a wide range of frameworks and technologies with automatic detection and deployment:

### 🐳 Docker & Containerization
- **Docker** - Dockerfile-based deployments
- **Docker Compose** - Multi-container applications

### ⚛️ JavaScript/TypeScript Frameworks
- **Next.js** - React framework with SSR
- **React** - Single-page applications
- **Vue.js** - Progressive JavaScript framework
- **Angular** - Full-stack web framework
- **Nuxt.js** - Vue.js meta-framework
- **Svelte** - Cybernetically enhanced web apps
- **Express** - Node.js web framework
- **Fastify** - Fast Node.js web framework
- **Koa** - Next-generation Node.js framework

### 🎨 PHP Frameworks
- **Laravel** - Elegant PHP web framework
- **WordPress** - Content management system
- **Symfony** - PHP web framework
- **Slim** - PHP micro-framework

### 🐍 Python Frameworks
- **Django** - High-level Python web framework
- **Flask** - Python micro-framework
- **FastAPI** - Modern Python web framework

### 💎 Ruby Frameworks
- **Ruby on Rails** - Full-stack Ruby framework
- **Sinatra** - Ruby DSL for web apps

### 🔵 Go
- **Standard Go** - Go applications with go.mod

### 🦀 Rust
- **Rust** - Systems programming language with Cargo

### ☕ Java
- **Maven** - Java project management
- **Gradle** - Build automation for Java

### 📄 Static Sites
- **HTML/CSS/JavaScript** - Static websites

### Framework-Specific Features

Each framework has optimized deployment configurations:

- **Auto-detection** of framework from project files
- **Framework-specific build commands**
- **Optimized Nginx configurations**
- **System requirement checks**
- **Port detection and configuration**
- **Web server integration** (Apache/Nginx)
- **Database configuration** where needed
- **Asset compilation** for frontend frameworks
- **Process management** via PM2 or systemd

## Security Considerations

- GitHub tokens are never stored permanently
- SSH keys are generated per installation
- Environment variables are parsed and stored securely
- SSL certificates are auto-renewed when possible
- All terminal operations are logged

## Auto-Cleanup Feature

Fluid includes a self-cleaning mechanism to keep your VPS clean:

### How It Works

1. **Installation**: The curl command installs the Fluid installer temporarily
2. **Deployment**: You deploy your project through the web interface
3. **Cleanup**: After successful deployment, you can remove the installer with one click
4. **Result**: Your application continues running, but the installer is gone

### Cleanup Process

When you click "Remove Installer from VPS" in the completion screen:

- Stops and disables the Fluid systemd service
- Removes systemd service files
- Removes Nginx configuration for the installer
- Deletes all Fluid files from `/opt/fluid`
- Cleans up temporary files
- **Your deployed application continues running via PM2**

### Safety Checks

Before cleanup, the system verifies:
- PM2 processes are running (your deployments)
- It's safe to remove the installer
- Your applications won't be affected

## One-Line Installation Details

The curl installation command performs these steps automatically:

### System Dependencies
- Node.js & npm
- Git
- Python3 & pip
- Build tools
- Nginx
- Certbot (for SSL)
- Docker & Docker Compose
- PM2 (process manager)

### Setup Steps
1. **Auto-detects server IP** using public IP detection service
2. Clones Fluid repository to temp directory
3. Installs Node.js dependencies
4. Builds React frontend
5. Copies files to `/opt/fluid`
6. **Configures dynamic IP** in environment variables
7. Creates systemd service
8. Configures Nginx reverse proxy
9. Starts the service
10. Displays access URL with detected IP

### Dynamic IP Handling

The installer automatically handles dynamic server IPs:

- **Installation Phase**: Detects public IP using `api.ipify.org`
- **Configuration**: Sets `SERVER_IP` and `GITHUB_CALLBACK_URL` in `.env`
- **Runtime**: Server auto-detects IP if not configured
- **GitHub OAuth**: Callback URL automatically configured with detected IP
- **No Manual IP Entry**: Users don't need to know their IP beforehand

### Environment Variables
You can optionally provide GitHub OAuth credentials:

```bash
export GITHUB_CLIENT_ID="your_client_id"
export GITHUB_CLIENT_SECRET="your_client_secret"
curl -fsSL https://raw.githubusercontent.com/yourusername/fluid-vps-installer/main/install.sh | bash
```

**Important**: Since this is an open-source project, each user needs their own GitHub OAuth credentials. See the GitHub OAuth Setup section below.

### Installation Logs
All installation steps are logged to `/tmp/fluid-install.log` for troubleshooting.

## GitHub OAuth Setup

Since Fluid is an open-source project, each user needs their own GitHub OAuth credentials to use the device code flow authentication. Here's how to set it up:

### Option 1: Provide OAuth Credentials During Installation

```bash
export GITHUB_CLIENT_ID="your_github_client_id"
export GITHUB_CLIENT_SECRET="your_github_client_secret"
curl -fsSL https://raw.githubusercontent.com/yourusername/fluid-vps-installer/main/install.sh | bash
```

### Option 2: Configure After Installation

If you didn't provide OAuth credentials during installation, you can configure them manually:

1. **SSH into your VPS**
2. **Edit the environment file**:
   ```bash
   sudo nano /opt/fluid/server/.env
   ```
3. **Add your GitHub OAuth credentials**:
   ```env
   GITHUB_CLIENT_ID=your_actual_client_id
   GITHUB_CLIENT_SECRET=your_actual_client_secret
   GITHUB_CALLBACK_URL=http://auto-detected-ip:3000
   SERVER_IP=auto-detected-ip
   ```
   - The `SERVER_IP` is auto-detected during installation
   - Check the server logs or run `curl https://api.ipify.org` to get your IP
4. **Restart the Fluid service**:
   ```bash
   sudo systemctl restart fluid-installer
   ```

### Creating Your GitHub OAuth App

1. **Go to GitHub Settings**: https://github.com/settings/developers
2. **Click "New OAuth App"**
3. **Fill in the application details**:
   - **Application name**: Fluid VPS Installer (or any name you prefer)
   - **Homepage URL**: `http://your-server-ip:3000` (IP will be auto-detected)
   - **Application description**: VPS deployment tool
   - **Authorization callback URL**: `http://your-server-ip:3000` (IP will be auto-detected)
4. **Click "Register application"**
5. **Copy your Client ID and generate a Client Secret**
6. **Use these credentials** in the installation or configuration

**Note**: The installer automatically detects your server's public IP during installation and configures the GitHub callback URL accordingly. You don't need to know your IP beforehand.

### GitHub OAuth Scopes Required

The OAuth app needs the following scopes:
- `repo` - Full control of private repositories
- `user` - Read user information
- `read:org` - Read org membership (optional)

### Authentication Methods

Fluid supports two authentication methods:

#### 1. Personal Access Token (Simple)
- Generate a token at: https://github.com/settings/tokens
- Select scopes: `repo` and `user`
- Use the token directly in the Fluid UI
- No OAuth app required

#### 2. Device Code Flow (Recommended for Multi-User)
- Requires GitHub OAuth app setup (as described above)
- More secure for shared installations
- Users authenticate on their own devices
- Better for production environments

### Security Notes

- **Never commit** your GitHub OAuth credentials to public repositories
- **Each user** should create their own OAuth app for their VPS
- **Personal access tokens** are simpler but less secure for shared use
- **Device code flow** is the recommended method for open-source usage

## Troubleshooting

### GitHub Authentication Issues
- Ensure your GitHub token has `repo` and `user` scopes
- For device flow, verify your OAuth app is properly configured

### DNS Propagation Delays
- DNS propagation can take 5-30 minutes
- Use the DNS check step to monitor progress
- Verify your domain registrar's DNS settings

### SSL Certificate Issues
- Ensure domain is properly pointed to VPS IP
- Let's Encrypt has rate limits (use staging for testing)
- Check that port 80 is not blocked

### PM2 Process Issues
- Verify Node.js is installed on the VPS
- Check that the start command is correct for your project
- Review PM2 logs: `pm2 logs app-name`

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this project for your own purposes.

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting section

## Roadmap

- [ ] Multi-server deployment support
- [ ] Database integration (MySQL, PostgreSQL, MongoDB)
- [ ] CI/CD pipeline integration
- [ ] Monitoring and logging dashboard
- [ ] Backup and restore functionality
- [ ] Container support (Docker)
- [ ] Load balancer configuration
- [ ] CDN integration

## Acknowledgments

- GitHub API for repository management
- Let's Encrypt for free SSL certificates
- PM2 for process management
- Socket.io for real-time communication
- The open-source community
