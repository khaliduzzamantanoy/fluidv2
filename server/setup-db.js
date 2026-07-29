#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m', reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { ...options, stdio: 'pipe' });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `Command failed with code ${code}`));
    });
    proc.on('error', reject);
  });
}

function runCommandSafe(command, args = [], options = {}) {
  return runCommand(command, args, options).catch(() => '');
}

function generateSecurePassword(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function checkPostgreSQLInstalled() {
  try {
    await runCommand('psql', ['--version']);
    return true;
  } catch {
    return false;
  }
}

async function installPostgreSQL() {
  log('cyan', '[1/5] Installing PostgreSQL...');
  try {
    await runCommand('apt-get', ['update', '-y']);
    await runCommand('apt-get', ['install', '-y', 'postgresql', 'postgresql-contrib']);
    log('green', 'PostgreSQL installed');
  } catch (err) {
    log('red', `PostgreSQL installation failed: ${err.message}`);
    throw err;
  }
}

async function setupPostgreSQL() {
  const dbName = 'fluid';
  const username = 'fluid';
  const password = generateSecurePassword(32);

  log('cyan', '[2/5] Starting PostgreSQL...');
  await runCommand('systemctl', ['enable', 'postgresql']).catch(() => {});
  await runCommand('systemctl', ['start', 'postgresql']).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  log('cyan', '[3/5] Creating database and user...');
  await runCommandSafe('su', ['-', 'postgres', '-c', `psql -c "CREATE USER ${username} WITH PASSWORD '${password}';"`]);
  await runCommandSafe('su', ['-', 'postgres', '-c', `psql -c "CREATE DATABASE ${dbName} OWNER ${username};"`]);
  await runCommandSafe('su', ['-', 'postgres', '-c', `psql -c "GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${username};"`]);

  const dbUrl = `postgresql://${username}:${password}@127.0.0.1:5432/${dbName}`;

  log('cyan', '[4/5] Running Prisma schema push...');
  const envPath = path.join(__dirname, '../.env');
  let envContent = '';
  if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, 'utf8');

  const jwtSecret = generateSecurePassword(64);
  const encryptionKey = generateSecurePassword(32);
  const cookieSecret = generateSecurePassword(32);
  const adminPassword = 'hellofluid';

  const updates = {
    DATABASE_URL: dbUrl,
    JWT_SECRET: jwtSecret,
    ENCRYPTION_KEY: encryptionKey,
    COOKIE_SECRET: cookieSecret
  };

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*`, 'm');
    if (regex.test(envContent)) envContent = envContent.replace(regex, `${key}=${value}`);
    else envContent += `\n${key}=${value}`;
  }
  fs.writeFileSync(envPath, envContent.trim() + '\n');

  try {
    await runCommand('npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: dbUrl }
    });
    log('green', 'Prisma schema pushed');
  } catch (err) {
    log('yellow', `[WARN] Prisma push: ${err.message}`);
  }

  log('cyan', '[5/5] Creating admin user...');
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    await prisma.$connect();

    const existing = await prisma.user.count();
    if (existing === 0) {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash(adminPassword, 12);
      await prisma.user.create({
        data: {
          username: 'admin',
          passwordHash: hash,
          fullName: 'Administrator',
          role: 'owner',
          mustChangePassword: true
        }
      });
      log('green', 'Default admin user created');
    } else {
      log('yellow', 'Admin user already exists, skipping creation');
    }

    await prisma.$disconnect();
  } catch (err) {
    log('yellow', `[WARN] Could not create admin user: ${err.message}`);
  }

  return { dbUrl, adminPassword };
}

async function main() {
  log('bold', '\n==================================================');
  log('bold', '  FLUID VPS PORTAL - SETUP');
  log('bold', '==================================================\n');

  try {
    const isInstalled = await checkPostgreSQLInstalled();
    if (!isInstalled) await installPostgreSQL();
    else log('green', '[1/5] PostgreSQL already installed');

    const result = await setupPostgreSQL();

    log('bold', '\n==================================================');
    log('green', '  SETUP COMPLETE!');
    log('bold', '==================================================\n');
    log('cyan', '  Login credentials:');
    log('bold', `  Username: admin`);
    log('bold', `  Password: ${result.adminPassword}`);
    log('yellow', '\n  ⚠ You will be prompted to change this password on first login.\n');
    log('cyan', '  Open http://your-vps-ip:6776 to continue.\n');

    console.log(`FLUID_ADMIN_PASSWORD=${result.adminPassword}`);

  } catch (err) {
    log('red', `\nSetup failed: ${err.message}`);
    process.exit(1);
  }
}

main();
