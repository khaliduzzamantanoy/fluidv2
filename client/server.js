const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.FRONTEND_PORT || 5173;

// Check if dist directory exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.error('Error: dist directory not found. Please run "npm run build" first.');
  process.exit(1);
}

// Serve static files from the dist directory
app.use(express.static(distPath));

// Handle client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
});
