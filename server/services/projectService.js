const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const simpleGit = require('simple-git');
const crypto = require('crypto');

const execAsync = promisify(exec);

// Create directory
async function createDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return { success: true, path: dirPath };
  } catch (error) {
    throw new Error(`Failed to create directory: ${error.message}`);
  }
}

// Clone repository with live output
async function cloneRepository(token, repoUrl, targetDir, io, sessionId) {
  try {
    const git = simpleGit();
    
    // Add token to URL for private repos
    const authUrl = repoUrl.replace('https://', `https://${token}@`);
    
    await git.clone(authUrl, targetDir, {
      onProgress: (progress) => {
        if (io && sessionId) {
          io.to(sessionId).emit('terminal-output', {
            data: progress.toString()
          });
        }
      }
    });

    return { success: true, path: targetDir };
  } catch (error) {
    throw new Error(`Failed to clone repository: ${error.message}`);
  }
}

// Detect project type
async function detectProjectType(projectPath) {
  try {
    const files = await fs.readdir(projectPath);
    
    // Check for Docker files first (highest priority)
    if (files.includes('docker-compose.yml') || files.includes('docker-compose.yaml')) {
      return {
        type: 'docker',
        framework: 'docker-compose',
        hasDockerCompose: true
      };
    }
    
    if (files.includes('Dockerfile')) {
      return {
        type: 'docker',
        framework: 'docker',
        hasDockerfile: true
      };
    }
    
    // Check for package.json (Node.js)
    if (files.includes('package.json')) {
      const packageJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
      return {
        type: 'nodejs',
        framework: detectNodeFramework(packageJson),
        hasBuildScript: !!packageJson.scripts?.build,
        hasStartScript: !!packageJson.scripts?.start
      };
    }
    
    // Check for Python frameworks
    if (files.includes('manage.py')) {
      return { type: 'python', framework: 'django' };
    }
    
    if (files.includes('requirements.txt')) {
      const requirements = await fs.readFile(path.join(projectPath, 'requirements.txt'), 'utf8');
      if (requirements.includes('django')) {
        return { type: 'python', framework: 'django' };
      }
      if (requirements.includes('flask')) {
        return { type: 'python', framework: 'flask' };
      }
      if (requirements.includes('fastapi')) {
        return { type: 'python', framework: 'fastapi' };
      }
      return { type: 'python', framework: 'generic' };
    }
    
    // Check for PHP frameworks
    if (files.includes('composer.json')) {
      const composerJson = JSON.parse(await fs.readFile(path.join(projectPath, 'composer.json'), 'utf8'));
      const deps = { ...composerJson.require, ...composerJson['require-dev'] };
      
      if (deps['laravel/framework'] || deps['laravel/laravel']) {
        return { type: 'php', framework: 'laravel' };
      }
      if (deps['wordpress']) {
        return { type: 'php', framework: 'wordpress' };
      }
      if (deps['symfony']) {
        return { type: 'php', framework: 'symfony' };
      }
      if (deps['slim/slim']) {
        return { type: 'php', framework: 'slim' };
      }
      return { type: 'php', framework: 'generic' };
    }
    
    // Check for WordPress specifically
    if (files.includes('wp-config.php') || files.includes('wp-config-sample.php')) {
      return { type: 'php', framework: 'wordpress' };
    }
    
    // Check for Gemfile (Ruby)
    if (files.includes('Gemfile')) {
      const gemfile = await fs.readFile(path.join(projectPath, 'Gemfile'), 'utf8');
      if (gemfile.includes('rails')) {
        return { type: 'ruby', framework: 'rails' };
      }
      if (gemfile.includes('sinatra')) {
        return { type: 'ruby', framework: 'sinatra' };
      }
      return { type: 'ruby', framework: 'generic' };
    }
    
    // Check for go.mod (Go)
    if (files.includes('go.mod')) {
      return { type: 'go', framework: 'generic' };
    }
    
    // Check for Cargo.toml (Rust)
    if (files.includes('Cargo.toml')) {
      return { type: 'rust', framework: 'generic' };
    }
    
    // Check for pom.xml (Java/Maven)
    if (files.includes('pom.xml')) {
      return { type: 'java', framework: 'maven' };
    }
    
    // Check for build.gradle (Java/Gradle)
    if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
      return { type: 'java', framework: 'gradle' };
    }
    
    // Check for index.html (Static)
    if (files.includes('index.html')) {
      return { type: 'static', framework: 'html' };
    }
    
    return { type: 'static', framework: 'unknown' };
  } catch (error) {
    throw new Error('Failed to detect project type');
  }
}

function detectNodeFramework(packageJson) {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (deps.next) return 'nextjs';
  if (deps.react || deps['react-dom']) return 'react';
  if (deps.vue) return 'vue';
  if (deps['@angular/core']) return 'angular';
  if (deps.nuxt) return 'nuxtjs';
  if (deps.svelte) return 'svelte';
  if (deps.express) return 'express';
  if (deps['fastify']) return 'fastify';
  if (deps.koa) return 'koa';
  
  return 'vanilla';
}

// Detect build commands
async function detectBuildCommands(projectPath) {
  try {
    const files = await fs.readdir(projectPath);
    
    // Docker
    if (files.includes('docker-compose.yml') || files.includes('docker-compose.yaml')) {
      return {
        install: 'docker-compose build',
        build: 'docker-compose build',
        start: 'docker-compose up -d',
        framework: 'docker-compose'
      };
    }
    
    if (files.includes('Dockerfile')) {
      return {
        install: 'docker build -t app .',
        build: 'docker build -t app .',
        start: 'docker run -p 3000:3000 app',
        framework: 'docker'
      };
    }
    
    // Node.js
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (await fileExists(packageJsonPath)) {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      const scripts = packageJson.scripts || {};
      
      return {
        install: 'npm install',
        build: scripts.build || null,
        start: scripts.start || scripts.dev || 'node index.js',
        scripts,
        framework: 'nodejs'
      };
    }
    
    // Python Django
    if (files.includes('manage.py')) {
      return {
        install: 'pip install -r requirements.txt',
        build: 'python manage.py collectstatic --noinput',
        start: 'gunicorn wsgi:application',
        framework: 'django'
      };
    }
    
    // Python generic
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    if (await fileExists(requirementsPath)) {
      const requirements = await fs.readFile(requirementsPath, 'utf8');
      if (requirements.includes('flask')) {
        return {
          install: 'pip install -r requirements.txt',
          build: null,
          start: 'gunicorn app:app',
          framework: 'flask'
        };
      }
      if (requirements.includes('fastapi')) {
        return {
          install: 'pip install -r requirements.txt',
          build: null,
          start: 'uvicorn main:app --host 0.0.0.0 --port 3000',
          framework: 'fastapi'
        };
      }
      return {
        install: 'pip install -r requirements.txt',
        build: null,
        start: 'python app.py',
        framework: 'python'
      };
    }
    
    // PHP Laravel
    if (files.includes('artisan')) {
      return {
        install: 'composer install && npm install',
        build: 'npm run build && php artisan key:generate && php artisan migrate --force',
        start: 'php artisan serve --host=0.0.0.0 --port=8000',
        framework: 'laravel'
      };
    }
    
    // PHP WordPress
    if (files.includes('wp-config.php') || files.includes('wp-config-sample.php')) {
      return {
        install: null,
        build: null,
        start: null,
        framework: 'wordpress',
        note: 'WordPress requires web server configuration (Apache/Nginx + PHP)'
      };
    }
    
    // PHP generic
    const composerJsonPath = path.join(projectPath, 'composer.json');
    if (await fileExists(composerJsonPath)) {
      return {
        install: 'composer install',
        build: null,
        start: 'php -S localhost:8000 -t public',
        framework: 'php'
      };
    }
    
    // Ruby Rails
    if (files.includes('Gemfile')) {
      const gemfile = await fs.readFile(path.join(projectPath, 'Gemfile'), 'utf8');
      if (gemfile.includes('rails')) {
        return {
          install: 'bundle install',
          build: 'rails assets:precompile',
          start: 'rails server -b -p 3000',
          framework: 'rails'
        };
      }
      return {
        install: 'bundle install',
        build: null,
        start: 'ruby app.rb',
        framework: 'ruby'
      };
    }
    
    // Go
    if (files.includes('go.mod')) {
      return {
        install: 'go mod download',
        build: 'go build -o app',
        start: './app',
        framework: 'go'
      };
    }
    
    // Rust
    if (files.includes('Cargo.toml')) {
      return {
        install: null,
        build: 'cargo build --release',
        start: './target/release/app',
        framework: 'rust'
      };
    }
    
    // Java Maven
    if (files.includes('pom.xml')) {
      return {
        install: 'mvn install',
        build: 'mvn package',
        start: 'java -jar target/*.jar',
        framework: 'maven'
      };
    }
    
    // Java Gradle
    if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
      return {
        install: 'gradle build',
        build: 'gradle build',
        start: 'gradle run',
        framework: 'gradle'
      };
    }
    
    // Static HTML
    if (files.includes('index.html')) {
      return {
        install: null,
        build: null,
        start: null,
        framework: 'static',
        note: 'Static files - served directly by web server'
      };
    }
    
    return {
      install: null,
      build: null,
      start: null,
      framework: 'unknown'
    };
  } catch (error) {
    throw new Error('Failed to detect build commands');
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Install dependencies with live output
async function installDependencies(projectPath, projectType, framework, io, sessionId) {
  try {
    let command;
    
    switch (projectType) {
      case 'docker':
        if (framework === 'docker-compose') {
          command = `cd ${projectPath} && docker-compose build`;
        } else {
          command = `cd ${projectPath} && docker build -t app .`;
        }
        break;
      case 'nodejs':
        command = `cd ${projectPath} && npm install`;
        break;
      case 'python':
        if (framework === 'django') {
          command = `cd ${projectPath} && pip install -r requirements.txt`;
        } else if (framework === 'flask') {
          command = `cd ${projectPath} && pip install -r requirements.txt`;
        } else if (framework === 'fastapi') {
          command = `cd ${projectPath} && pip install -r requirements.txt`;
        } else {
          command = `cd ${projectPath} && pip install -r requirements.txt`;
        }
        break;
      case 'php':
        if (framework === 'laravel') {
          command = `cd ${projectPath} && composer install && npm install`;
        } else if (framework === 'wordpress') {
          return { success: true, message: 'WordPress dependencies managed via admin panel' };
        } else {
          command = `cd ${projectPath} && composer install`;
        }
        break;
      case 'ruby':
        command = `cd ${projectPath} && bundle install`;
        break;
      case 'go':
        command = `cd ${projectPath} && go mod download`;
        break;
      case 'rust':
        command = `cd ${projectPath} && cargo fetch`;
        break;
      case 'java':
        if (framework === 'maven') {
          command = `cd ${projectPath} && mvn install`;
        } else if (framework === 'gradle') {
          command = `cd ${projectPath} && gradle build`;
        }
        break;
      case 'static':
        return { success: true, message: 'No dependencies to install for static site' };
      default:
        return { success: true, message: 'No dependencies to install' };
    }
    
    if (!command) {
      return { success: true, message: 'No install command for this framework' };
    }
    
    const { stdout, stderr } = await execAsync(command);
    
    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', { data: stdout });
      if (stderr) {
        io.to(sessionId).emit('terminal-output', { data: stderr });
      }
    }
    
    return { success: true, output: stdout };
  } catch (error) {
    throw new Error(`Failed to install dependencies: ${error.message}`);
  }
}

// Parse environment file
async function parseEnvFile(envContent) {
  try {
    const lines = envContent.split('\n');
    const envVars = {};
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          envVars[key.trim()] = value;
        }
      }
    });
    
    // Detect keys and values
    const detected = Object.entries(envVars).map(([key, value]) => ({
      key,
      value,
      isSecret: isSecretKey(key),
      isUrl: isUrl(value),
      isNumber: !isNaN(value)
    }));
    
    return {
      envVars,
      detected
    };
  } catch (error) {
    throw new Error('Failed to parse environment file');
  }
}

function isSecretKey(key) {
  const secretPatterns = ['key', 'secret', 'token', 'password', 'api', 'private'];
  return secretPatterns.some(pattern => key.toLowerCase().includes(pattern));
}

function isUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// Generate SSH key for GitHub
async function generateSSHKey(email) {
  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    // Format public key for GitHub
    const githubPublicKey = publicKey
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\n/g, '')
      .replace(/\r/g, '');
    
    return {
      publicKey: `ssh-rsa ${githubPublicKey} ${email}`,
      privateKey,
      comment: email
    };
  } catch (error) {
    throw new Error('Failed to generate SSH key');
  }
}

module.exports = {
  createDirectory,
  cloneRepository,
  detectProjectType,
  detectBuildCommands,
  installDependencies,
  parseEnvFile,
  generateSSHKey
};
