const axios = require('axios');

// Get user repositories
async function getUserRepos(token) {
  try {
    const response = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      },
      params: {
        sort: 'updated',
        per_page: 100
      }
    });

    return response.data.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      owner: repo.owner.login,
      description: repo.description,
      private: repo.private,
      url: repo.html_url,
      clone_url: repo.clone_url,
      ssh_url: repo.ssh_url,
      language: repo.language,
      updated_at: repo.updated_at
    }));
  } catch (error) {
    throw new Error('Failed to fetch repositories');
  }
}

// Get repository details
async function getRepoDetails(token, owner, repo) {
  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch repository details');
  }
}

// Check repository access with specific permissions
async function checkRepoAccess(token, owner, repo, permissions = ['read']) {
  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    const repoPermissions = response.data.permissions;
    const hasAccess = permissions.every(perm => repoPermissions[perm]);

    return {
      hasAccess,
      permissions: repoPermissions,
      repo: response.data
    };
  } catch (error) {
    return {
      hasAccess: false,
      permissions: {},
      error: 'Failed to check repository access'
    };
  }
}

module.exports = {
  getUserRepos,
  getRepoDetails,
  checkRepoAccess
};
