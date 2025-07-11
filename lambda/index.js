/**
 * README Reader Lambda Function
 * 
 * Purpose: Fetches README content from GitHub repository API
 * Trigger: Step Functions (when new commits are detected)
 * 
 * Security Features:
 * - No hardcoded credentials (uses IAM roles)
 * - Request timeout limits (30s)
 * - Content preview only in logs (no full content exposure)
 * - Error handling with proper HTTP status codes
 * 
 * Cost Optimization:
 * - Minimal memory allocation (256MB)
 * - Short timeout (30s)
 * - Efficient HTTP client (Node.js built-in)
 */

const https = require('https');

/**
 * Main Lambda handler function
 * @param {Object} event - Step Functions input event
 * @returns {Object} Response with status and README metadata
 */
exports.handler = async (event) => {
    console.log('Event received:', JSON.stringify(event, null, 2));
    
    try {
        // GitHub API endpoint for README content
        // Using environment variable for flexibility and security
        const repoUrl = process.env.GITHUB_REPO_URL || 'https://api.github.com/repos/azarboon/dummy/readme';
        
        console.log('Fetching README from:', repoUrl);
        
        // Fetch README content from GitHub API
        const readmeContent = await fetchGitHubReadme(repoUrl);
        
        // Decode base64 content (GitHub API returns README in base64)
        const decodedContent = Buffer.from(readmeContent.content, 'base64').toString('utf-8');
        
        console.log('README content fetched successfully');
        // Security: Only log content preview, not full content
        console.log('Content preview:', decodedContent.substring(0, 200) + '...');
        console.log('Content length:', decodedContent.length, 'characters');
        
        // Return minimal response data (security best practice)
        return {
            statusCode: 200,
            body: {
                message: 'README content fetched successfully',
                repository: 'azarboon/dummy',
                contentLength: decodedContent.length,
                lastModified: readmeContent.sha,
                // Security: Don't return full content in response to avoid log exposure
                contentPreview: decodedContent.substring(0, 100) + '...'
            }
        };
        
    } catch (error) {
        console.error('Error fetching README:', error.message);
        
        // Return error response with minimal information
        return {
            statusCode: 500,
            body: {
                error: 'Failed to fetch README content',
                message: error.message
            }
        };
    }
};

/**
 * Fetches README content from GitHub API using HTTPS
 * @param {string} url - GitHub API URL for README
 * @returns {Promise<Object>} README content and metadata
 */
function fetchGitHubReadme(url) {
    return new Promise((resolve, reject) => {
        // Configure HTTPS request with timeout
        const request = https.get(url, {
            headers: {
                'User-Agent': 'AWS-Lambda-GitHub-Monitor/1.0',
                'Accept': 'application/vnd.github.v3+json'
            },
            // Security: Set request timeout to prevent hanging
            timeout: 25000 // 25s timeout (5s buffer before Lambda timeout)
        }, (response) => {
            let data = '';
            
            // Handle response data chunks
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            // Handle response completion
            response.on('end', () => {
                try {
                    if (response.statusCode === 200) {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } else {
                        reject(new Error(`GitHub API returned status ${response.statusCode}: ${data}`));
                    }
                } catch (parseError) {
                    reject(new Error(`Failed to parse GitHub API response: ${parseError.message}`));
                }
            });
        });
        
        // Handle request errors
        request.on('error', (error) => {
            reject(new Error(`HTTPS request failed: ${error.message}`));
        });
        
        // Handle request timeout
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('GitHub API request timed out'));
        });
    });
}
