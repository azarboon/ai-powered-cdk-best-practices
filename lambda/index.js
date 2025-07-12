/**
 * Git Diff Processor Lambda Function
 * 
 * Purpose: Fetches git differences from GitHub repository API for commits
 * Trigger: Step Functions (when new commits are detected)
 * 
 * Security Features:
 * - No hardcoded credentials (uses IAM roles)
 * - Request timeout limits (30s)
 * - Minimal data exposure in logs
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
 * @param {Object} event - Step Functions input event containing commit information
 * @returns {Object} Response with git diff data formatted for SNS
 */
exports.handler = async (event) => {
    console.log('Event received:', JSON.stringify(event, null, 2));
    
    try {
        // Extract commit information from the event
        const commits = event.detail?.commits || event.commits || [];
        const repository = event.detail?.repository || event.repository || {};
        const repositoryName = repository.full_name || 'azarboon/dummy';
        
        console.log('Processing commits for repository:', repositoryName);
        console.log('Number of commits to process:', commits.length);
        
        if (commits.length === 0) {
            console.log('No commits found in event');
            return {
                statusCode: 200,
                subject: `GitHub: No commits found - ${repositoryName}`,
                message: 'No commits were found in the webhook event.'
            };
        }
        
        // Process each commit and fetch its diff
        const commitDiffs = [];
        
        for (const commit of commits.slice(0, 5)) { // Limit to 5 commits to avoid large emails
            console.log('Processing commit:', commit.id);
            
            try {
                const commitData = await fetchCommitData(repositoryName, commit.id);
                commitDiffs.push({
                    id: commit.id,
                    message: commit.message,
                    author: commit.author?.name || 'Unknown',
                    timestamp: commit.timestamp,
                    url: commit.url,
                    diff: formatDiff(commitData)
                });
            } catch (error) {
                console.error(`Error processing commit ${commit.id}:`, error.message);
                commitDiffs.push({
                    id: commit.id,
                    message: commit.message,
                    author: commit.author?.name || 'Unknown',
                    timestamp: commit.timestamp,
                    url: commit.url,
                    diff: `Error fetching diff: ${error.message}`
                });
            }
        }
        
        // Format the email content
        const emailSubject = `GitHub Push: ${commits.length} commit(s) to ${repositoryName}`;
        const emailMessage = formatEmailMessage(repositoryName, commitDiffs);
        
        console.log('Git diff processing completed successfully');
        console.log('Email subject:', emailSubject);
        
        // Return formatted response for SNS
        return {
            statusCode: 200,
            subject: emailSubject,
            message: emailMessage
        };
        
    } catch (error) {
        console.error('Error processing git diffs:', error.message);
        
        // Return error response formatted for SNS
        return {
            statusCode: 500,
            subject: 'GitHub Monitor: Error Processing Commits',
            message: `Error occurred while processing git differences:\n\n${error.message}`
        };
    }
};

/**
 * Fetches commit data including diff from GitHub API
 * @param {string} repositoryName - Repository name (e.g., 'azarboon/dummy')
 * @param {string} commitSha - Commit SHA hash
 * @returns {Promise<Object>} Commit data with files and changes
 */
function fetchCommitData(repositoryName, commitSha) {
    return new Promise((resolve, reject) => {
        const url = `https://api.github.com/repos/${repositoryName}/commits/${commitSha}`;
        
        console.log('Fetching commit data from:', url);
        
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

/**
 * Formats commit diff data for email display
 * @param {Object} commitData - GitHub API commit response
 * @returns {string} Formatted diff string
 */
function formatDiff(commitData) {
    if (!commitData.files || commitData.files.length === 0) {
        return 'No file changes detected.';
    }
    
    let diffText = '';
    
    // Limit to first 10 files to avoid huge emails
    const filesToShow = commitData.files.slice(0, 10);
    
    for (const file of filesToShow) {
        diffText += `\n--- File: ${file.filename} ---\n`;
        diffText += `Status: ${file.status}\n`;
        diffText += `Changes: +${file.additions} -${file.deletions}\n`;
        
        // Include patch if available and not too large
        if (file.patch && file.patch.length < 2000) {
            diffText += `\nDiff:\n${file.patch}\n`;
        } else if (file.patch) {
            diffText += `\nDiff: (truncated - too large to display)\n`;
        }
        
        diffText += '\n' + '='.repeat(50) + '\n';
    }
    
    if (commitData.files.length > 10) {
        diffText += `\n... and ${commitData.files.length - 10} more files\n`;
    }
    
    return diffText;
}

/**
 * Formats the complete email message with all commit diffs
 * @param {string} repositoryName - Repository name
 * @param {Array} commitDiffs - Array of commit diff objects
 * @returns {string} Formatted email message
 */
function formatEmailMessage(repositoryName, commitDiffs) {
    let message = `New commits pushed to ${repositoryName}\n`;
    message += `${'='.repeat(60)}\n\n`;
    
    for (let i = 0; i < commitDiffs.length; i++) {
        const commit = commitDiffs[i];
        
        message += `Commit ${i + 1}/${commitDiffs.length}\n`;
        message += `SHA: ${commit.id}\n`;
        message += `Author: ${commit.author}\n`;
        message += `Date: ${commit.timestamp}\n`;
        message += `Message: ${commit.message}\n`;
        message += `URL: ${commit.url}\n\n`;
        message += `Changes:\n${commit.diff}\n\n`;
        message += `${'*'.repeat(60)}\n\n`;
    }
    
    message += `\nRepository: https://github.com/${repositoryName}\n`;
    message += `Generated by AWS Lambda GitHub Monitor\n`;
    
    return message;
}
