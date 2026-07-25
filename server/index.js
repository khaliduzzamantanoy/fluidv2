const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

// Import routes
const authRoutes = require('./routes/auth');
const githubRoutes = require('./routes/github');
const systemRoutes = require('./routes/system');
const projectRoutes = require('./routes/project');
const domainRoutes = require('./routes/domain');
const sslRoutes = require('./routes/ssl');
const pm2Routes = require('./routes/pm2');
const deploymentRoutes = require('./routes/deployment');
const cleanupRoutes = require('./routes/cleanup');
const vpsRoutes = require('./routes/vps');

dotenv.config();

const PORT = process.env.BACKEND_PORT || process.env.PORT || 3000;

// Auto-detect server IP if not provided
async function detectServerIP() {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    const publicIP = response.data.ip;
    
    // Update environment if not set
    if (!process.env.SERVER_IP) {
      process.env.SERVER_IP = publicIP;
      console.log(`Auto-detected server IP: ${publicIP}`);
    }
    
    // Update GitHub callback URL if using localhost and OAuth is configured
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CALLBACK_URL === 'http://localhost:3000' && publicIP) {
      process.env.GITHUB_CALLBACK_URL = `http://${publicIP}:3000`;
      console.log(`Updated GitHub callback URL: ${process.env.GITHUB_CALLBACK_URL}`);
    }
    
    // Update SERVER_URL if not set
    if (!process.env.SERVER_URL && publicIP) {
      process.env.SERVER_URL = `http://${publicIP}:3000`;
      console.log(`Updated SERVER_URL: ${process.env.SERVER_URL}`);
    }
    
    return publicIP;
  } catch (error) {
    console.error('Failed to detect server IP:', error.message);
    console.log('Using SERVER_URL from environment for production');
    return null;
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/domain', domainRoutes);
app.use('/api/ssl', sslRoutes);
app.use('/api/pm2', pm2Routes);
app.use('/api/deployment', deploymentRoutes);
app.use('/api/cleanup', cleanupRoutes);
app.use('/api/vps', vpsRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-terminal', (sessionId) => {
    socket.join(sessionId);
    console.log(`Socket ${socket.id} joined terminal session ${sessionId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Start server with IP detection
async function startServer() {
  await detectServerIP();
  
  server.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Server IP: ${process.env.SERVER_IP || 'localhost'}`);
    console.log(`GitHub Callback URL: ${process.env.GITHUB_CALLBACK_URL}`);
  });
}

startServer();

module.exports = { app, io };
