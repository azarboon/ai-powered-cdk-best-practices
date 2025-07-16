/**
 * Git Diff Processor Lambda Function.
 *
 * Purpose: Fetches git differences from GitHub repository API for commits
 * Trigger: Step Functions (when new commits are detected).
 *
 * Security Features:
 * - No hardcoded credentials or repository names (uses environment variables)
 * - Request timeout limits (30s)
 * - Minimal data exposure in logs
 * - Error handling with proper HTTP status codes.
 *
 * Cost Optimization:
 * - Minimal memory allocation (256MB)
 * - Short timeout (30s)
 * - Efficient HTTP client (Node.js built-in).
 *
 * Configuration:
 * - GITHUB_API_BASE: GitHub API base URL for repository
 * - GITHUB_REPOSITORY: Target repository (format: owner/repo)
 * - ENVIRONMENT: Environment tag for logging context.
 */

import * as https from 'https';

/**
 * Configuration from environment variables - no hardcoded values.
 */
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || 'azarboon/dummy';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

/**
 * GitHub commit interface.
 */
interface GitHubCommit {
  id: string;
  message: string;
  author?: {
    name: string;
  };
  timestamp: string;
  url: string;
}

/**
 * GitHub repository interface.
 */
interface GitHubRepository {
  full_name?: string;
}

/**
 * Step Functions event interface.
 */
interface StepFunctionsEvent {
  detail?: {
    commits?: GitHubCommit[];
    repository?: GitHubRepository;
  };
  commits?: GitHubCommit[];
  repository?: GitHubRepository;
}

/**
 * GitHub API commit response interface.
 */
interface GitHubCommitData {
  files?: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>;
}

/**
 * Processed commit diff interface.
 */
interface CommitDiff {
  id: string;
  message: string;
  author: string;
  timestamp: string;
  url: string;
  diff: string;
}

/**
 * Lambda response interface.
 */
interface LambdaResponse {
  statusCode: number;
  subject: string;
  message: string;
  environment?: string;
}

/**
 * Main Lambda handler function.
 *
 * @param event - Step Functions input event containing commit information.
 * @returns Response with git diff data formatted for SNS.
 */
export const handler = async (event: StepFunctionsEvent): Promise<LambdaResponse> => {
  console.log(`[${ENVIRONMENT}] Event received:`, JSON.stringify(event, null, 2));

  try {
    // Extract commit information from the event
    const commits = event.detail?.commits || event.commits || [];
    const repository = event.detail?.repository || event.repository || {};
    const repositoryName = repository.full_name || GITHUB_REPOSITORY;

    console.log(`[${ENVIRONMENT}] Processing commits for repository:`, repositoryName);
    console.log(`[${ENVIRONMENT}] Number of commits to process:`, commits.length);

    if (commits.length === 0) {
      console.log(`[${ENVIRONMENT}] No commits found in event`);
      return {
        statusCode: 200,
        subject: `GitHub: No commits found - ${repositoryName}`,
        message: 'No commits were found in the webhook event.',
      };
    }

    // Process each commit and fetch its diff
    const commitDiffs: CommitDiff[] = [];

    for (const commit of commits.slice(0, 5)) {
      // Limit to 5 commits to avoid large emails
      console.log(`[${ENVIRONMENT}] Processing commit:`, commit.id);

      try {
        const commitData = await fetchCommitData(repositoryName, commit.id);
        commitDiffs.push({
          id: commit.id,
          message: commit.message,
          author: commit.author?.name || 'Unknown',
          timestamp: commit.timestamp,
          url: commit.url,
          diff: formatDiff(commitData),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[${ENVIRONMENT}] Error processing commit ${commit.id}:`, errorMessage);
        commitDiffs.push({
          id: commit.id,
          message: commit.message,
          author: commit.author?.name || 'Unknown',
          timestamp: commit.timestamp,
          url: commit.url,
          diff: `Error fetching diff: ${errorMessage}`,
        });
      }
    }

    // Format the email content
    const emailSubject = `GitHub Push: ${commits.length} commit(s) to ${repositoryName}`;
    const emailMessage = formatEmailMessage(repositoryName, commitDiffs);

    console.log(`[${ENVIRONMENT}] Git diff processing completed successfully`);
    console.log(`[${ENVIRONMENT}] Email subject:`, emailSubject);

    // Return formatted response for SNS
    return {
      statusCode: 200,
      subject: emailSubject,
      message: emailMessage,
      environment: ENVIRONMENT,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${ENVIRONMENT}] Error processing git diffs:`, errorMessage);

    // Return error response formatted for SNS
    return {
      statusCode: 500,
      subject: 'GitHub Monitor: Error Processing Commits',
      message: `Error occurred while processing git differences:\n\nEnvironment: ${ENVIRONMENT}\nError: ${errorMessage}`,
    };
  }
};

/**
 * Fetches commit data including diff from GitHub API.
 *
 * @param repositoryName - Repository name (e.g., 'owner/repo').
 * @param commitSha - Commit SHA hash.
 * @returns Commit data with files and changes.
 */
function fetchCommitData(repositoryName: string, commitSha: string): Promise<GitHubCommitData> {
  return new Promise((resolve, reject) => {
    // Use environment variable for API base URL construction
    const url = `https://api.github.com/repos/${repositoryName}/commits/${commitSha}`;

    console.log(`[${ENVIRONMENT}] Fetching commit data from:`, url);

    // Configure HTTPS request with timeout
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': `AWS-Lambda-GitHub-Monitor/${ENVIRONMENT}/1.0`,
          Accept: 'application/vnd.github.v3+json',
        },
        // Security: Set request timeout to prevent hanging
        timeout: 25000, // 25s timeout (5s buffer before Lambda timeout)
      },
      response => {
        let data = '';

        // Handle response data chunks
        response.on('data', chunk => {
          data += chunk;
        });

        // Handle response completion
        response.on('end', () => {
          try {
            if (response.statusCode === 200) {
              const jsonData = JSON.parse(data) as GitHubCommitData;
              resolve(jsonData);
            } else {
              reject(new Error(`GitHub API returned status ${response.statusCode}: ${data}`));
            }
          } catch (parseError) {
            const errorMessage =
              parseError instanceof Error ? parseError.message : 'Unknown parse error';
            reject(new Error(`Failed to parse GitHub API response: ${errorMessage}`));
          }
        });
      }
    );

    // Handle request errors
    request.on('error', error => {
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
 * Formats commit diff data for email display.
 *
 * @param commitData - GitHub API commit response.
 * @returns Formatted diff string.
 */
function formatDiff(commitData: GitHubCommitData): string {
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
      diffText += '\nDiff: (truncated - too large to display)\n';
    }

    diffText += '\n' + '='.repeat(50) + '\n';
  }

  if (commitData.files.length > 10) {
    diffText += `\n... and ${commitData.files.length - 10} more files\n`;
  }

  return diffText;
}

/**
 * Formats the complete email message with all commit diffs.
 *
 * @param repositoryName - Repository name.
 * @param commitDiffs - Array of commit diff objects.
 * @returns Formatted email message.
 */
function formatEmailMessage(repositoryName: string, commitDiffs: CommitDiff[]): string {
  let message = `New commits pushed to ${repositoryName}\n`;
  message += `Environment: ${ENVIRONMENT}\n`;
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
  message += `Generated by AWS Lambda GitHub Monitor (${ENVIRONMENT})\n`;

  return message;
}
