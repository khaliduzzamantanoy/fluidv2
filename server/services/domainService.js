const dns = require('dns').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');

const execAsync = promisify(exec);

// Check DNS records
async function checkDNS(domain, expectedIP) {
  try {
    const records = await dns.resolve4(domain);
    const isPointed = records.includes(expectedIP);
    
    return {
      domain,
      records,
      isPointed,
      expectedIP
    };
  } catch (error) {
    return {
      domain,
      records: [],
      isPointed: false,
      expectedIP,
      error: 'DNS resolution failed'
    };
  }
}

// Check domain propagation across multiple DNS servers
async function checkDomainPropagation(domain, expectedIP) {
  const dnsServers = [
    '8.8.8.8',      // Google
    '1.1.1.1',      // Cloudflare
    '208.67.222.222' // OpenDNS
  ];
  
  const results = await Promise.allSettled(
    dnsServers.map(async (server) => {
      try {
        const { stdout } = await execAsync(`nslookup ${domain} ${server}`);
        return { server, success: true, output: stdout };
      } catch (error) {
        return { server, success: false, error: error.message };
      }
    })
  );
  
  const propagated = results.every(r => r.status === 'fulfilled' && r.value.success);
  
  return {
    domain,
    expectedIP,
    propagated,
    results: results.map(r => r.status === 'fulfilled' ? r.value : r.reason)
  };
}

// Detect SSL provider
async function detectSSLProvider(domain) {
  try {
    // Check SSL certificate
    const response = await axios.get(`https://${domain}`, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    const certInfo = response.request.socket.getPeerCertificate();
    
    if (certInfo && Object.keys(certInfo).length > 0) {
      const issuer = certInfo.issuer;
      let provider = 'Unknown';
      
      if (issuer.CN) {
        if (issuer.CN.includes('Cloudflare')) {
          provider = 'Cloudflare';
        } else if (issuer.CN.includes("Let's Encrypt")) {
          provider = "Let's Encrypt";
        } else if (issuer.CN.includes('DigiCert')) {
          provider = 'DigiCert';
        } else if (issuer.CN.includes('Amazon')) {
          provider = 'AWS Certificate Manager';
        }
      }
      
      return {
        hasSSL: true,
        provider,
        issuer: issuer.CN || issuer.O,
        validTo: certInfo.valid_to,
        validFrom: certInfo.valid_from
      };
    }
    
    return {
      hasSSL: false,
      provider: null
    };
  } catch (error) {
    // Domain might not be accessible yet
    return {
      hasSSL: false,
      provider: null,
      error: 'Could not check SSL certificate'
    };
  }
}

module.exports = {
  checkDNS,
  checkDomainPropagation,
  detectSSLProvider
};
