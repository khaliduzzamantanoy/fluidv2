# Fluid VPS Installer

A centralized Vercel-like deployment platform for Ubuntu VPS. Deploy your GitHub projects to your VPS with a single click through a beautiful web interface.

## Features

- **🔐 GitHub Authentication** - Central OAuth app for all users (device code flow + personal tokens)
- **🖥️ VPS Connection** - Connect multiple VPSs via SSH with secure authentication
- **📦 Repository Management** - Select repositories with permission management
- **📁 Remote Setup** - Automatic directory creation and git cloning on remote VPS
- **🔧 Environment Variables** - Smart parsing with auto-detection of keys, URLs, and secrets
- **🌐 Domain Configuration** - VPS IP auto-detection with domain setup
- **🔍 DNS Verification** - Real-time DNS checking and propagation monitoring
- **🛡️ SSL Management** - Let's Encrypt, Cloudflare, and self-signed certificate support
- **🏗️ Build Automation** - Auto-detection of project types and build commands
- **📺 Live Terminal** - Real-time terminal output via WebSocket streaming
- **⚡ PM2 Integration** - Process management with auto-startup configuration
- **🚀 One-Click Deployment** - Complete automated deployment pipeline to remote VPS

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

### For Central Server
- Node.js 18+ and npm
- GitHub OAuth app
- Domain name (recommended for production)

### For User VPS
- Ubuntu Server (20.04+ recommended)
- SSH access (root or sudo user)
- Domain name (optional but recommended)
- GitHub account with repository access

## Installation

### Central Server Setup

#### 1. Clone and Setup Central Server

```bash
git clone https://github.com/khaliduzzamantanoy/ubuntufluid.git
cd ubuntufluid

# Install dependencies
npm install
cd server && npm install
cd ../client && npm install

# Build frontend
npm run build
```

#### 2. Configure Environment

```bash
cd server
cp .env.example .env
```

Edit `.env` with your GitHub OAuth credentials:
```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://your-domain.com
SERVER_URL=https://your-domain.com
```

#### 3. Start Central Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### User VPS Setup

Users can prepare their VPS by running the agent script:

```bash
curl -fsSL https://raw.githubusercontent.com/khaliduzzamantanoy/ubuntufluid/main/vps-agent.sh | bash
```

This will:
- Install Node.js, Docker, Nginx, PM2
- Configure SSH access
- Setup firewall rules
- Prepare the VPS for remote deployment

### Manual Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/khaliduzzamantanoy/ubuntufluid.git
cd ubuntufluid
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

## How It Works

### Central Server Architecture

Fluid uses a centralized architecture similar to Vercel:

1. **Central Server** - Hosted by you with a single GitHub OAuth app
2. **User VPSs** - Users connect their VPSs via SSH to your central server
3. **Remote Deployment** - Your central server deploys projects to connected VPSs
4. **No Per-VPS Installation** - Users don't need to install Fluid on their VPSs

### User Workflow

1. **User prepares VPS** - Runs the agent script to install dependencies
2. **User connects VPS** - Provides SSH credentials to your central server
3. **User authenticates** - Uses your central OAuth app (or personal token)
4. **User selects repo** - Chooses a GitHub repository
5. **One-click deploy** - Your central server deploys to their VPS remotely

### VPS Agent Script

Users run this on their VPS to prepare it for deployment:

```bash
curl -fsSL https://raw.githubusercontent.com/khaliduzzamantanoy/ubuntufluid/main/vps-agent.sh | bash
```

This installs:
- Node.js, Docker, Nginx, PM2
- Configures SSH access
- Sets up firewall rules
- Prepares for remote deployment

## GitHub OAuth Setup

Since Fluid is a centralized service, you need to create a single GitHub OAuth app for your central server. All users will authenticate through your OAuth app.

### Creating Your GitHub OAuth App

1. **Go to GitHub Settings**: https://github.com/settings/developers
2. **Click "New OAuth App"**
3. **Fill in the application details**:
   - **Application name**: Fluid VPS Installer (or your brand name)
   - **Homepage URL**: `https://your-fluid-domain.com`
   - **Application description**: VPS deployment platform
   - **Authorization callback URL**: `https://your-fluid-domain.com`
4. **Enable Device Flow**: Check "Allow this OAuth App to authorize users via the device flow"
5. **Click "Register application"**
6. **Copy your Client ID and generate a Client Secret**
7. **Add credentials to your central server's `.env` file**:
   ```env
   GITHUB_CLIENT_ID=your_actual_client_id
   GITHUB_CLIENT_SECRET=your_actual_client_secret
   GITHUB_CALLBACK_URL=https://your-fluid-domain.com
   SERVER_URL=https://your-fluid-domain.com
   ```

### GitHub OAuth Scopes Required

The OAuth app needs the following scopes:
- `repo` - Full control of private repositories
- `user` - Read user information
- `read:org` - Read org membership (optional)

### Authentication Methods

Fluid supports two authentication methods for users:

#### 1. Personal Access Token (Simple)
- Users generate their own token at: https://github.com/settings/tokens
- Select scopes: `repo` and `user`
- Use the token directly in the Fluid UI
- No OAuth app setup required for users

#### 2. Device Code Flow (Recommended)
- Uses your central OAuth app
- More secure for production
- Users authenticate on their own devices
- Better for multi-user environments

### Security Notes

- **Never commit** your GitHub OAuth credentials to public repositories
- **Keep your OAuth app secret secure** on the central server
- **Users authenticate through your OAuth app** - they don't need their own
- **Personal access tokens** are stored only in session, not persisted

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
