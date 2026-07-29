# Fluid VPS Portal

A complete, self-hosted VPS management platform — like Vercel for your own server. Deploy, manage, and monitor multiple GitHub projects with auto-deploy, SSL, custom domains, and real-time analytics. Zero-dependency setup with SQLite + Prisma ORM, JWT authentication, and a beautiful dark-themed dashboard.

## Features

### 🚀 Project Management
- **Multi-Project Dashboard** - Manage all your deployments from one place
- **One-Click Deploy** - Deploy any GitHub repo with framework auto-detection
- **Environment Variables** - Per-project encrypted env vars with bulk editing
- **Auto-Deploy via Webhooks** - GitHub push & PR triggers auto-pull and redeploy
- **Rollback** - Instantly rollback to any previous successful deployment
- **Deployment History** - Full logs, duration, status for every deployment

### 🌐 Domain & SSL
- **Unlimited Domains** - Add multiple domains per project
- **DNS Verification** - Auto-check A records point to your VPS
- **Let's Encrypt SSL** - One-click SSL issuance and auto-renewal
- **Nginx Config** - Auto-generate and write reverse proxy configs to disk
- **HTTP/HTTPS Redirects** - Force HTTPS, WWW redirect, HSTS support

### 📊 Server Monitoring
- **Real-Time Stats** - CPU, memory, disk, PM2 process health
- **30-Day History** - Time-series metrics stored in SQLite
- **PM2 Integration** - Process monitoring with auto-restart

### 🔐 Security & Auth
- **JWT Authentication** - httpOnly cookies with bcrypt password hashing
- **Admin Account** - First-user setup wizard on initial boot
- **Activity Log** - Full audit trail of every action (deployments, env changes, domain changes)
- **Encrypted Secrets** - Environment values encrypted at rest

### 💻 Tech Stack
- **Next.js 14** - React framework with App Router and TypeScript
- **Fastify** - High-performance Node.js web framework
- **SQLite + Prisma** - Embedded database with type-safe ORM, zero setup
- **xterm.js** - Real-time terminal emulation for live command output
- **Tailwind CSS** - Utility-first dark-themed UI
- **PM2** - Process management with cluster mode support

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icon library
- **xterm.js** - Terminal emulation for live command output
- **Framer Motion** - Smooth animations and transitions

### Backend
- **Fastify** - High-performance Node.js web framework
- **SQLite** - Embedded database, zero configuration, just a file
- **Prisma** - Type-safe ORM with auto-generated client
- **JWT** - JSON Web Token authentication
- **bcryptjs** - Password hashing
- **WebSocket** - Real-time bidirectional communication
- **node-pty** - PTY process spawning for terminal emulation

## Installation

### One-Click Install (Ubuntu VPS)

The fastest way to install Fluid Portal on your Ubuntu VPS:

```bash
curl -fsSL https://github.com/khaliduzzamantanoy/fluidv2/archive/refs/heads/main.tar.gz | tar -xz --strip-components=1 && bash install.sh
```

This command will:
- Install Node.js 20 LTS, PM2, and Nginx
- Build the frontend and initialize the SQLite database
- Create a systemd service for automatic startup
- Start the Fluid Portal on port 6776

After installation, login with:
- **Username:** `admin`
- **Password:** `hellofluid` (you'll be prompted to change it on first login)

### Prerequisites
- Ubuntu 22.04+ VPS (or any Debian-based system)
- Root SSH access
- GitHub account (for deployment)

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/khaliduzzamantanoy/fluidv2.git
cd fluidv2
```

2. **Install dependencies**
```bash
npm install
```

3. **Run development server**
```bash
npm run dev
```

The application will be available at `http://localhost:3000` (frontend) and the Fastify backend runs on port `6776`.

### Production Build

```bash
npm run build        # Build static frontend
npm start            # Start Fastify server (port 6776)
```

## Configuration

### Environment Variables

The `.env` file is auto-generated during installation, but you can customize:

```env
# Server
PORT=6776
HOST=0.0.0.0
PUBLIC_URL=https://panel.yourdomain.com

# SQLite (auto-configured by setup:db)
DATABASE_URL=file:/opt/fluid/fluid.db

# Security (auto-generated)
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
COOKIE_SECRET=your-cookie-secret

# GitHub OAuth (optional - for repo access)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

### Nginx Reverse Proxy (Optional)

For production, use Nginx as a reverse proxy to Fluid:

```nginx
server {
    listen 80;
    server_name panel.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:6776;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Usage

### Portal Dashboard

After login, you'll be greeted with an overview dashboard showing:

- **Server Health** - CPU, memory, PM2 process status
- **Deployment Stats** - Total/success/failure counts
- **Recent Deployments** - Last 5 deployments across all projects
- **Quick Actions** - Create new project, navigate to settings

### Managing Projects

1. **Create Project** - Click "New Project" to start the guided wizard
2. **Project Detail** - Click any project to view its settings, deployments, env vars, and domains
3. **Deploy** - Hit the "Deploy" button to trigger a manual deployment
4. **Rollback** - Rollback to any previous successful deployment
5. **Delete** - Archive projects you no longer need

### Environment Variables

Per-project encrypted environment variables:
- Add, edit, delete variables with secret masking
- Bulk import/update variables
- Encrypted at rest using AES

### Domains & SSL

1. **Add Domain** - Attach a domain to any project
2. **DNS Verify** - Automatically check A records point to your VPS
3. **SSL** - One-click Let's Encrypt certificate issuance via Certbot
4. **Nginx Config** - Auto-generate and write reverse proxy configuration

### GitHub Webhooks (Auto-Deploy)

1. Go to your project settings and enable auto-deploy
2. Fluid registers a GitHub webhook automatically
3. On every push to the configured branch, Fluid pulls, builds, and redeploys
4. Optionally deploy pull request previews

### Real-Time Terminal

Every operation streams live output to the terminal component:
- **PTY Support** - Full terminal emulation with colors (node-pty)
- **REST Fallback** - Falls back to REST API when PTY unavailable
- **Copy Output** - Copy any terminal output to clipboard
- **Retry** - Failed commands can be retried

### Server Monitoring

- Stats collected every 60 seconds automatically
- View real-time CPU, memory, and process metrics
- 30-day history stored in SQLite

## Development

### Project Structure

```
fluidv2/
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── layout.tsx    # Root layout with metadata
│   │   ├── page.tsx      # Auth-aware main page
│   │   └── globals.css   # Global styles & Tailwind
│   ├── components/       # React components
│   │   ├── AppShell.tsx  # Sidebar + topbar shell
│   │   ├── AuthPage.tsx  # Login / first-time setup
│   │   ├── DashboardHome.tsx   # Stats overview
│   │   ├── ProjectsPage.tsx    # Project listing
│   │   ├── ProjectDetail.tsx   # Project settings
│   │   ├── DomainPage.tsx      # Domain overview
│   │   ├── ActivityPage.tsx    # Activity log
│   │   ├── SettingsPage.tsx    # User settings
│   │   ├── Terminal.tsx  # xterm.js terminal
│   │   ├── Wizard.tsx    # Legacy deployment wizard
│   │   └── steps/        # 14 wizard step components
├── prisma/
│   └── schema.prisma     # Prisma schema (10 models)
├── server/
│   ├── index.js          # Fastify server (entry point)
│   ├── setup-db.js       # SQLite init + admin user creation
│   ├── setup-first-user.js   # Admin account creation CLI
│   ├── routes/           # API route handlers
│   │   ├── auth.js       # Login, setup, logout
│   │   ├── projects.js   # Project CRUD
│   │   ├── deployments.js # Deploy, rollback, logs
│   │   ├── domains.js    # Domain & SSL management
│   │   ├── env-vars.js   # Encrypted env vars
│   │   ├── webhooks.js   # GitHub webhook receiver
│   │   └── monitoring.js # Server stats & overview
│   ├── middleware/
│   │   └── auth.js       # JWT authentication middleware
│   └── services/
│       ├── database.js   # Prisma client connection manager
│       └── auth.js       # JWT token utilities
├── install.sh            # One-click installation script
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

### Available Scripts

```bash
# Development
npm run dev          # Start Next.js dev server (port 3000)
npm run build        # Build frontend for production
npm start            # Start Fastify production server (port 6776)

# Database
npm run setup:db     # Initialize SQLite database + create admin user
npm run setup:auth   # Create admin user (CLI wizard)
npx prisma studio    # Open Prisma Studio (DB browser)

# Server Management (on VPS)
systemctl status fluid        # Check Fluid service status
journalctl -u fluid -f        # Follow Fluid logs
systemctl restart fluid       # Restart Fluid service
```

## Troubleshooting

### WebSocket / Terminal Issues

- **Verify the server is running**: Check `systemctl status fluid` or `pgrep -f "node server/index.js"`
- **Check port availability**: `ss -tlnp | grep 6776`
- **node-pty not available**: Falls back to spawn, but colors may be limited. Install with `npm rebuild node-pty`

### Database Issues

- **Database corrupted**: Delete `fluid.db` and run `npm run setup:db` from `/opt/fluid`
- **Prisma schema not pushed**: Run `npx prisma db push` from `/opt/fluid`
- **Connection string**: Check `.env` file for `DATABASE_URL`

### Deployment Failures

- **Check deployment logs** in the portal UI under the project's Deployments tab
- **Verify git clone URL** has proper permissions (public repo or token configured)
- **Check disk space**: `df -h`
- **Build timeout**: Default is 5 minutes for frontend builds, 10 minutes for backend commands

### GitHub Webhook Issues

- **Signature mismatch**: Re-register the webhook from project settings
- **Webhook not firing**: Verify webhook is active in GitHub repo settings
- **SSL issues**: Ensure your portal URL has a valid certificate or disable SSL verification in GitHub webhook settings

### Port Conflicts

If port 6776 is already in use:
```bash
fuser -k 6776/tcp    # Kill process on port
systemctl restart fluid  # Restart Fluid
```

## Security Considerations

- **Authentication**: All API routes require JWT authentication (except setup and login)
- **Passwords**: Hashed with bcrypt (12 rounds) — never stored in plaintext
- **Environment Variables**: Encrypted at rest using AES via crypto-js
- **Sessions**: httpOnly cookies prevent XSS token theft
- **SQLite**: Local file-based database — no network exposure
- **GitHub Tokens**: Stored in database with restricted scope; never logged
- **Firewall**: Install.sh opens only ports 22, 80, 443, and 6776
- **Webhooks**: SHA-256 signature verification for all incoming GitHub webhooks
- **Rate Limiting**: Configurable in global settings (default: 100 req / 15 min)
- **Password Policy**: Minimum 8 characters, enforced on server and client

## Contributing

Contributions welcome! Submit PRs at https://github.com/khaliduzzamantanoy/fluidv2

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ by khaliduzzamantanoy**
