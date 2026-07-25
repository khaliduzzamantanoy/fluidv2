const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Framework-specific deployment configurations
const deploymentConfigs = {
  'docker-compose': {
    name: 'Docker Compose',
    icon: '🐳',
    requiresDocker: true,
    preDeploy: [
      'docker --version',
      'docker-compose --version'
    ],
    deploy: 'docker-compose up -d',
    postDeploy: [
      'docker-compose ps'
    ],
    portDetection: 'docker-compose'
  },
  'docker': {
    name: 'Docker',
    icon: '🐳',
    requiresDocker: true,
    preDeploy: [
      'docker --version'
    ],
    deploy: 'docker run -d -p 3000:3000 --name app app',
    postDeploy: [
      'docker ps'
    ],
    portDetection: 'docker'
  },
  'nextjs': {
    name: 'Next.js',
    icon: '⚛️',
    requiresNode: true,
    preDeploy: [
      'node --version',
      'npm --version'
    ],
    build: 'npm run build',
    start: 'npm start',
    port: 3000
  },
  'react': {
    name: 'React',
    icon: '⚛️',
    requiresNode: true,
    preDeploy: [
      'node --version',
      'npm --version'
    ],
    build: 'npm run build',
    start: 'npm start',
    port: 3000
  },
  'vue': {
    name: 'Vue.js',
    icon: '💚',
    requiresNode: true,
    preDeploy: [
      'node --version',
      'npm --version'
    ],
    build: 'npm run build',
    start: 'npm run serve',
    port: 8080
  },
  'angular': {
    name: 'Angular',
    icon: '🅰️',
    requiresNode: true,
    preDeploy: [
      'node --version',
      'npm --version'
    ],
    build: 'npm run build',
    start: 'npm run serve',
    port: 4200
  },
  'nuxtjs': {
    name: 'Nuxt.js',
    icon: '🟢',
    requiresNode: true,
    preDeploy: [
      'node --version',
      'npm --version'
    ],
    build: 'npm run build',
    start: 'npm run start',
    port: 3000
  },
  'laravel': {
    name: 'Laravel',
    icon: '🎨',
    requiresPHP: true,
    requiresComposer: true,
    preDeploy: [
      'php --version',
      'composer --version',
      'npm --version'
    ],
    build: 'npm run build && php artisan key:generate && php artisan migrate --force',
    start: 'php artisan serve --host=0.0.0.0 --port=8000',
    port: 8000,
    webServer: 'nginx',
    phpConfig: true
  },
  'wordpress': {
    name: 'WordPress',
    icon: '📝',
    requiresPHP: true,
    requiresMySQL: true,
    preDeploy: [
      'php --version',
      'mysql --version'
    ],
    build: null,
    start: null,
    port: 80,
    webServer: 'nginx',
    phpConfig: true,
    databaseConfig: true,
    note: 'WordPress requires manual database setup via admin panel'
  },
  'django': {
    name: 'Django',
    icon: '🐍',
    requiresPython: true,
    preDeploy: [
      'python3 --version',
      'pip3 --version'
    ],
    build: 'python manage.py collectstatic --noinput',
    start: 'gunicorn wsgi:application',
    port: 8000,
    webServer: 'nginx',
    pythonConfig: true
  },
  'flask': {
    name: 'Flask',
    icon: '🐍',
    requiresPython: true,
    preDeploy: [
      'python3 --version',
      'pip3 --version'
    ],
    build: null,
    start: 'gunicorn app:app',
    port: 5000,
    webServer: 'nginx'
  },
  'fastapi': {
    name: 'FastAPI',
    icon: '⚡',
    requiresPython: true,
    preDeploy: [
      'python3 --version',
      'pip3 --version'
    ],
    build: null,
    start: 'uvicorn main:app --host 0.0.0.0 --port 3000',
    port: 3000,
    webServer: 'nginx'
  },
  'rails': {
    name: 'Ruby on Rails',
    icon: '💎',
    requiresRuby: true,
    preDeploy: [
      'ruby --version',
      'bundle --version'
    ],
    build: 'rails assets:precompile',
    start: 'rails server -b -p 3000',
    port: 3000,
    webServer: 'nginx'
  },
  'go': {
    name: 'Go',
    icon: '🔵',
    requiresGo: true,
    preDeploy: [
      'go version'
    ],
    build: 'go build -o app',
    start: './app',
    port: 8080,
    webServer: 'nginx'
  },
  'rust': {
    name: 'Rust',
    icon: '🦀',
    requiresRust: true,
    preDeploy: [
      'rustc --version',
      'cargo --version'
    ],
    build: 'cargo build --release',
    start: './target/release/app',
    port: 8080,
    webServer: 'nginx'
  },
  'maven': {
    name: 'Java (Maven)',
    icon: '☕',
    requiresJava: true,
    preDeploy: [
      'java -version',
      'mvn --version'
    ],
    build: 'mvn package',
    start: 'java -jar target/*.jar',
    port: 8080,
    webServer: 'nginx'
  },
  'gradle': {
    name: 'Java (Gradle)',
    icon: '🐘',
    requiresJava: true,
    preDeploy: [
      'java -version',
      'gradle --version'
    ],
    build: 'gradle build',
    start: 'gradle run',
    port: 8080,
    webServer: 'nginx'
  },
  'static': {
    name: 'Static Site',
    icon: '📄',
    preDeploy: [],
    build: null,
    start: null,
    port: 80,
    webServer: 'nginx',
    note: 'Static files served directly by web server'
  }
};

// Get deployment configuration for a framework
function getDeploymentConfig(framework) {
  return deploymentConfigs[framework] || deploymentConfigs['static'];
}

// Check system requirements for a framework
async function checkSystemRequirements(framework, io, sessionId) {
  const config = getDeploymentConfig(framework);
  const results = [];

  if (config.preDeploy && config.preDeploy.length > 0) {
    for (const command of config.preDeploy) {
      try {
        if (io && sessionId) {
          io.to(sessionId).emit('terminal-output', {
            data: `Checking: ${command}\n`
          });
        }
        
        const { stdout } = await execAsync(command);
        results.push({
          command,
          success: true,
          output: stdout.trim()
        });

        if (io && sessionId) {
          io.to(sessionId).emit('terminal-output', {
            data: `✓ ${command}: OK\n`
          });
        }
      } catch (error) {
        results.push({
          command,
          success: false,
          error: error.message
        });

        if (io && sessionId) {
          io.to(sessionId).emit('terminal-output', {
            data: `✗ ${command}: FAILED\n`
          });
        }
      }
    }
  }

  return {
    framework,
    results,
    allPassed: results.every(r => r.success)
  };
}

// Generate Nginx configuration for a framework
function generateNginxConfig(domain, projectPath, framework, port) {
  const config = getDeploymentConfig(framework);
  
  let nginxConfig = `
server {
    listen 80;
    server_name ${domain} www.${domain};

    location / {
        proxy_pass http://localhost:${port || config.port || 3000};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-Forwarded-For $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
`;

  // Framework-specific nginx configurations
  if (framework === 'wordpress') {
    nginxConfig = `
server {
    listen 80;
    server_name ${domain} www.${domain};
    root ${projectPath};
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico)$ {
        expires max;
        log_not_found off;
    }
}
`;
  }

  if (framework === 'django' || framework === 'flask' || framework === 'fastapi') {
    nginxConfig = `
server {
    listen 80;
    server_name ${domain} www.${domain};

    location /static/ {
        alias ${projectPath}/static/;
    }

    location /media/ {
        alias ${projectPath}/media/;
    }

    location / {
        proxy_pass http://localhost:${port || config.port || 8000};
        proxy_set_header Host $host;
        proxy_set_header X-Real-Forwarded-For $remote_addr;
    }
}
`;
  }

  if (framework === 'laravel') {
    nginxConfig = `
server {
    listen 80;
    server_name ${domain} www.${domain};
    root ${projectPath}/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \\.php$ {
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\\.ht {
        deny all;
    }
}
`;
  }

  if (framework === 'static') {
    nginxConfig = `
server {
    listen 80;
    server_name ${domain} www.${domain};
    root ${projectPath};
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires max;
        log_not_found off;
    }
}
`;
  }

  return nginxConfig;
}

// Get all supported frameworks
function getSupportedFrameworks() {
  return Object.entries(deploymentConfigs).map(([key, value]) => ({
    id: key,
    name: value.name,
    icon: value.icon,
    requires: {
      docker: value.requiresDocker,
      node: value.requiresNode,
      php: value.requiresPHP,
      python: value.requiresPython,
      ruby: value.requiresRuby,
      go: value.requiresGo,
      rust: value.requiresRust,
      java: value.requiresJava,
      composer: value.requiresComposer,
      mysql: value.requiresMySQL
    }
  }));
}

module.exports = {
  getDeploymentConfig,
  checkSystemRequirements,
  generateNginxConfig,
  getSupportedFrameworks
};
