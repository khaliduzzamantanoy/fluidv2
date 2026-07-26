# FLUID — ONE TIME VPS DEPLOYMENT ASSISTANT

## ROLE

Act as a senior DevOps engineer and full-stack engineer.

Build a simple temporary VPS deployment assistant.

The goal is NOT to create a hosting platform.

The goal is NOT to create a SaaS.

The goal is:

"Install one GitHub project on a VPS automatically with a GUI wizard."

Keep the system simple.

Do not add unnecessary databases, accounts, dashboards, users, or long-term management features.

---

# CORE IDEA

Fluid is a temporary installation assistant.

The user installs Fluid on a VPS.

Fluid opens a web GUI.

The user completes a guided setup.

Fluid:

* connects GitHub
* downloads project
* installs requirements
* builds project
* configures runtime
* configures domain
* configures SSL
* finishes deployment

After completion:

The application runs independently.

Fluid itself is no longer needed.

---

# INSTALLATION

User runs:

```bash
curl -fsSL https://fluid.yourdomain.com/install | bash
```

The installer should:

1. Detect VPS OS.

Support:

* Ubuntu 22.04
* Ubuntu 24.04

2. Install required tools:

* Git
* Node.js
* npm/pnpm
* Python if required
* Nginx
* Certbot
* PM2

3. Download Fluid temporary installer.

4. Start local setup service.

5. Open:

```
http://VPS_IP:6776
```

---

# IMPORTANT

No database.

No SQLite.

No PostgreSQL.

No Prisma.

No user accounts.

No authentication system.

No project history.

No stored deployments.

No permanent control panel.

Use only temporary files.

Example:

```
/tmp/fluid/
```

After completion:

Clean temporary files.

---

# GUI WIZARD FLOW

## STEP 1 — GitHub Login

Use GitHub Device Authorization Flow.

Login:

```
https://github.com/login/device
```

Only require:

```
GITHUB_CLIENT_ID
```

No:

* client secret
* personal token
* database storage

Flow:

1. User clicks:

```
Login with GitHub
```

2. GitHub device code generated.

3. User approves.

4. Fluid receives temporary access token.

5. Repository list appears.

---

# STEP 2 — Repository Selection

Show:

* repositories
* private repositories
* public repositories

User selects:

```
Repository
Branch
```

---

# STEP 3 — Project Directory

Ask:

Example:

```
/var/www/my-project
```

Check:

If exists:

* ask permission

If missing:

* create directory

Clone repository:

```
git clone repository directory
```

---

# STEP 4 — Project Detection

Automatically analyze project.

Detect:

## Node.js

Files:

```
package.json
```

Detect:

* Next.js
* React
* Vue
* Express

## Python

Files:

```
requirements.txt
pyproject.toml
```

Detect:

* Flask
* Django

## PHP

Files:

```
composer.json
```

## Docker

Files:

```
Dockerfile
docker-compose.yml
```

Do not guess.

Show detected information:

Example:

```
Detected:

Framework:
Next.js

Install:
npm install

Build:
npm run build

Start:
npm start

Port:
3000
```

---

# STEP 5 — Installation

Run detected commands.

Examples:

Node:

```
npm install
npm run build
```

Python:

```
pip install -r requirements.txt
```

Docker:

```
docker compose up
```

All terminal output must appear live in GUI.

---

# STEP 6 — Runtime Setup

Detect required process manager.

Default:

PM2

Configure:

```
pm2 start
pm2 save
pm2 startup
```

The application must continue running after Fluid exits.

---

# STEP 7 — Domain Setup

Ask:

Primary domain:

```
example.com
```

Second field:

```
www.example.com
```

If user skips:

Automatically create:

```
www.example.com
```

---

# STEP 8 — VPS IP Detection

Automatically detect:

Example:

```
Your VPS IP:

123.123.123.123
```

Show DNS instructions:

```
Create A Record:

@
123.123.123.123


www
123.123.123.123
```

---

# STEP 9 — DNS CHECK

Provide button:

```
Check Domain
```

Verify:

* DNS exists
* points to VPS IP
* propagation complete

Continue only after successful check.

---

# STEP 10 — SSL Detection

Fluid checks:

* existing SSL
* Cloudflare proxy
* existing certificates
* HTTPS availability

If no SSL exists:

Show options:

Option 1:

```
Let's Encrypt
```

Option 2:

```
Existing certificate
```

Option 3:

```
Custom certificate
```

Option 4:

```
Cloudflare managed SSL
```

Option 5:

```
Skip SSL
```

---

# STEP 11 — Nginx Configuration

Automatically create:

* server block
* reverse proxy
* domain mapping
* SSL redirect

Example:

```
example.com

        |
        |
      Nginx

        |
        |
   localhost:3000
```

---

# STEP 12 — Final Setup

Before finishing:

Ask user:

```
Generate SSH deployment key for GitHub?

Enable automatic startup?

Continue?
```

---

# STEP 13 — Completion

Show:

```
Deployment Completed Successfully

Project:
my-project

Domain:
https://example.com

Status:
LIVE

You can now close this installer.
```

---

# LIVE TERMINAL SYSTEM

Every command must stream to GUI.

Display:

* command
* stdout
* stderr
* progress
* success/failure

Use:

Backend:

WebSocket

Frontend:

xterm.js

---

# ERROR HANDLING

If any step fails:

Show:

```
Step failed:

Command:
npm run build

Error:
xxxx
```

Allow:

* retry
* edit settings
* continue manually

---

# FINAL CLEANUP

After successful deployment:

Remove:

```
/tmp/fluid
installer files
temporary tokens
temporary logs
```

Stop Fluid service.

The deployed project continues running through:

* PM2
* Nginx
* system services

---

# TECHNOLOGY

Frontend:

* Next.js
* TypeScript
* Tailwind
* xterm.js

Backend:

* Node.js
* Fastify
* WebSocket

No database.

No persistent storage.

No user system.

No unnecessary complexity.

---

# FINAL PRODUCT DESCRIPTION

Fluid is:

"A one-time VPS deployment wizard that connects GitHub, installs a project, configures the server, attaches a domain, enables SSL, and leaves the application running automatically."

Build only this.
