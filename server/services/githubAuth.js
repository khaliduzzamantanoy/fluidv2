const axios = require('axios');

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// Authenticate with personal access token
async function authenticateWithToken(token) {
  try {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    return {
      success: true,
      user: response.data,
      token: token
    };
  } catch (error) {
    throw new Error('Invalid GitHub token');
  }
}

// Initiate GitHub device flow
async function initiateDeviceFlow() {
  try {
    const response = await axios.post('https://github.com/login/device/code', {
      client_id: GITHUB_CLIENT_ID,
      scope: 'repo user read:org'
    }, {
      headers: {
        Accept: 'application/json'
      }
    });

    return {
      success: true,
      deviceCode: response.data.device_code,
      userCode: response.data.user_code,
      verificationUri: response.data.verification_uri,
      expiresIn: response.data.expires_in,
      interval: response.data.interval
    };
  } catch (error) {
    throw new Error('Failed to initiate device flow');
  }
}

// Poll for device flow completion
async function pollDeviceFlow(deviceCode, interval) {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const response = await axios.post('https://github.com/login/oauth/access_token', {
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        }, {
          headers: {
            Accept: 'application/json'
          }
        });

        if (response.data.access_token) {
          // Get user info
          const userResponse = await axios.get('https://api.github.com/user', {
            headers: {
              Authorization: `token ${response.data.access_token}`,
              Accept: 'application/vnd.github.v3+json'
            }
          });

          resolve({
            success: true,
            token: response.data.access_token,
            user: userResponse.data
          });
        }
      } catch (error) {
        if (error.response && error.response.data.error === 'authorization_pending') {
          // Continue polling
          setTimeout(poll, interval * 1000);
        } else {
          reject(new Error('Device flow failed'));
        }
      }
    };

    poll();
  });
}

module.exports = {
  authenticateWithToken,
  initiateDeviceFlow,
  pollDeviceFlow
};
