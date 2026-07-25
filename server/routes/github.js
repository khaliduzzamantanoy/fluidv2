const express = require('express');
const router = express.Router();
const { getUserRepos, getRepoDetails, checkRepoAccess } = require('../services/githubService');

// Get user repositories
router.get('/repos', async (req, res) => {
  try {
    const { token } = req.headers;
    const repos = await getUserRepos(token);
    res.json(repos);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get repository details
router.get('/repos/:owner/:repo', async (req, res) => {
  try {
    const { token } = req.headers;
    const { owner, repo } = req.params;
    const details = await getRepoDetails(token, owner, repo);
    res.json(details);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Check repository access with specific permissions
router.post('/check-access', async (req, res) => {
  try {
    const { token, owner, repo, permissions } = req.body;
    const access = await checkRepoAccess(token, owner, repo, permissions);
    res.json(access);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
