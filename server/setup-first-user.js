#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
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

function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          const value = trimmed.substring(eqIndex + 1).trim();
          if (!process.env[key]) process.env[key] = value;
        }
      }
    }
  }
}

async function main() {
  console.log('\n==================================================');
  console.log('  FLUID VPS PORTAL - FIRST USER SETUP');
  console.log('==================================================\n');

  loadEnv();

  // Check MongoDB is running
  try {
    await runCommand('mongosh', ['--eval', 'db.adminCommand("ping")', '--quiet']);
    console.log('[OK] MongoDB is running\n');
  } catch {
    console.log('[WARN] MongoDB not detected. Make sure to run npm run setup:db first.\n');
  }

  // Ask for admin credentials
  console.log('Create your admin account for the Fluid VPS Portal:\n');

  let username = '';
  while (!username || username.length < 3) {
    username = await ask('  Username (min 3 chars): ');
    if (username.length < 3) console.log('  Username must be at least 3 characters.\n');
  }

  let password = '';
  while (!password || password.length < 8) {
    password = await ask('  Password (min 8 chars): ');
    if (password.length < 8) console.log('  Password must be at least 8 characters.\n');
  }

  let passwordConfirm = '';
  while (passwordConfirm !== password) {
    passwordConfirm = await ask('  Confirm Password: ');
    if (passwordConfirm !== password) console.log('  Passwords do not match.\n');
  }

  let email = await ask('  Email (optional): ');

  rl.close();

  // Connect to MongoDB and create user
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fluid';
  console.log('\n[1/2] Connecting to MongoDB...');

  try {
    const mongoose = (await import('mongoose')).default;
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('[OK] Connected to MongoDB\n');

    const User = (await import('./models/User.js')).default;

    const existingCount = await User.countDocuments();
    if (existingCount > 0) {
      console.log('[INFO] Admin user already exists. Creating additional user.\n');
    }

    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      console.error(`[ERROR] Username '${username}' is already taken.\n`);
      process.exit(1);
    }

    // Create the user
    const user = await User.create({
      username: username.toLowerCase(),
      email: email?.toLowerCase() || undefined,
      passwordHash: password,
      fullName: username,
      role: 'owner'
    });

    console.log(`[OK] Admin user '${username}' created successfully!\n`);

    // Update .env with JWT info
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      const now = new Date().toISOString();
      if (!envContent.includes('ADMIN_USERNAME=')) {
        envContent += `\nADMIN_USERNAME=${username}`;
      }
      if (!envContent.includes('ADMIN_CREATED_AT=')) {
        envContent += `\nADMIN_CREATED_AT=${now}`;
      }
      fs.writeFileSync(envPath, envContent.trim() + '\n');
      console.log('[OK] Credentials saved to .env\n');
    }

    // Delete credentials file
    const credsPath = '/root/fluid-credentials.txt';
    if (fs.existsSync(credsPath)) {
      try { fs.rmSync(credsPath, { force: true }); } catch (e) {}
      console.log('[OK] Temporary credentials file removed\n');
    }

    await mongoose.disconnect();

    console.log('==================================================');
    console.log('  SETUP COMPLETE!');
    console.log('==================================================');
    console.log('\n  You can now login to the Fluid VPS Portal at:');
    console.log('  http://your-vps-ip:6776\n');
    console.log(`  Username: ${username}`);
    console.log('  Password: (the one you just set)\n');

  } catch (err) {
    console.error(`[ERROR] Failed to create user: ${err.message}\n`);
    process.exit(1);
  }
}

main();