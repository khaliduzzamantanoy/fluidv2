const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Check if PM2 is installed
async function checkPM2() {
  try {
    await execAsync('which pm2');
    return { installed: true };
  } catch {
    return { installed: false };
  }
}

// Install PM2
async function installPM2(io, sessionId) {
  try {
    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', {
        data: 'Installing PM2...\n'
      });
    }

    await execAsync('sudo npm install -g pm2');

    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', {
        data: 'PM2 installed successfully\n'
      });
    }

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to install PM2: ${error.message}`);
  }
}

// Start application with PM2
async function startApp(projectPath, appName, command, io, sessionId) {
  try {
    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', {
        data: `Starting application with PM2: ${appName}\n`
      });
    }

    const { stdout, stderr } = await execAsync(
      `cd ${projectPath} && pm2 start "${command}" --name ${appName}`,
      { cwd: projectPath }
    );

    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', { data: stdout });
      if (stderr) {
        io.to(sessionId).emit('terminal-output', { data: stderr });
      }
    }

    // Save PM2 process list
    await execAsync('pm2 save');

    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', {
        data: 'PM2 process list saved\n'
      });
    }

    return { success: true, appName };
  } catch (error) {
    throw new Error(`Failed to start application with PM2: ${error.message}`);
  }
}

// Setup PM2 to start on system boot
async function setupStartup(io, sessionId) {
  try {
    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', {
        data: 'Setting up PM2 startup script...\n'
      });
    }

    // Generate startup script
    const { stdout } = await execAsync('pm2 startup');

    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', { data: stdout });
    }

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to setup PM2 startup: ${error.message}`);
  }
}

// Get PM2 process list
async function getProcessList() {
  try {
    const { stdout } = await execAsync('pm2 list --json');
    const processes = JSON.parse(stdout);
    return { success: true, processes };
  } catch (error) {
    return { success: false, processes: [], error: error.message };
  }
}

// Stop application
async function stopApp(appName, io, sessionId) {
  try {
    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', {
        data: `Stopping application: ${appName}\n`
      });
    }

    const { stdout } = await execAsync(`pm2 stop ${appName}`);

    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', { data: stdout });
    }

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to stop application: ${error.message}`);
  }
}

// Restart application
async function restartApp(appName, io, sessionId) {
  try {
    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', {
        data: `Restarting application: ${appName}\n`
      });
    }

    const { stdout } = await execAsync(`pm2 restart ${appName}`);

    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', { data: stdout });
    }

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to restart application: ${error.message}`);
  }
}

// Delete application
async function deleteApp(appName, io, sessionId) {
  try {
    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', {
        data: `Deleting application: ${appName}\n`
      });
    }

    const { stdout } = await execAsync(`pm2 delete ${appName}`);

    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', { data: stdout });
    }

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete application: ${error.message}`);
  }
}

// Get application logs
async function getAppLogs(appName, lines = 100) {
  try {
    const { stdout } = await execAsync(`pm2 logs ${appName} --lines ${lines} --nostream`);
    return { success: true, logs: stdout };
  } catch (error) {
    return { success: false, logs: '', error: error.message };
  }
}

module.exports = {
  checkPM2,
  installPM2,
  startApp,
  setupStartup,
  getProcessList,
  stopApp,
  restartApp,
  deleteApp,
  getAppLogs
};
