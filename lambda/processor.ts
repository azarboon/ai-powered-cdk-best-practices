/**
 * GitHub Webhook Processor Lambda Function.
 *
 * Processes GitHub push events by:
 * 1. Validating webhook payload
 * 2. Extracting the final (most recent) commit from the push
 * 3. Fetching detailed git diff for the final commit
 * 4. Sending formatted email notification via SNS
 *@azarboon: remove duplications in the code. clean it up
 */

import * as https from 'https';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const sns = new SNSClient({ region: process.env.AWS_REGION });

const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY!;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN!;
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

interface APIGatewayEvent {
  body: string;
  headers: Record<string, string>;
}

interface GitHubWebhookPayload {
  repository?: { full_name: string };
  commits?: Array<{
    id: string;
    message: string;
    author?: { name: string };
    timestamp: string;
    url: string;
  }>;
  ref?: string;
}

interface GitHubCommitData {
  files?: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>;
}

export const handler = async (event: APIGatewayEvent) => {
  console.log(`[${ENVIRONMENT}] Processing webhook for ${GITHUB_REPOSITORY}`);

  // Enhanced logging: Log entire request for troubleshooting
  console.log(`[${ENVIRONMENT}] Request details:`, {
    headers: event.headers,
    bodyLength: event.body?.length || 0,
    timestamp: new Date().toISOString(),
  });

  try {
    const payload: GitHubWebhookPayload = JSON.parse(event.body);
    const githubEvent = event.headers['x-github-event'] || event.headers['X-GitHub-Event'];

    // Log parsed payload structure (without sensitive data)
    console.log(`[${ENVIRONMENT}] Parsed payload structure:`, {
      hasRepository: !!payload.repository,
      repositoryName: payload.repository?.full_name,
      commitsCount: payload.commits?.length || 0,
      ref: payload.ref,
      githubEvent,
    });

    // Filter: Only push events
    if (githubEvent !== 'push') {
      console.log(`[${ENVIRONMENT}] Ignoring ${githubEvent} event`);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Event ignored',
          reason: `Only 'push' events are processed, received: ${githubEvent}`,
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Validate repository structure exists in payload
    if (!payload.repository) {
      console.error(`[${ENVIRONMENT}] Missing 'repository' object in payload`);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Invalid payload structure',
          message: 'Missing required field: repository',
          expectedStructure: { repository: { full_name: 'owner/repo' } },
          timestamp: new Date().toISOString(),
          requestId: event.headers['x-amzn-requestid'] || 'unknown',
        }),
      };
    }

    // @azarboon can you marge the following two checks?

    // Validate repository.full_name exists and is not empty
    if (!payload.repository.full_name || typeof payload.repository.full_name !== 'string') {
      console.error(
        `[${ENVIRONMENT}] Missing or invalid repository.full_name in payload:`,
        payload.repository.full_name
      );
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Invalid payload structure',
          message: 'Missing or invalid required field: repository.full_name',
          expectedFormat: 'owner/repo',
          receivedValue: payload.repository.full_name,
          timestamp: new Date().toISOString(),
          requestId: event.headers['x-amzn-requestid'] || 'unknown',
        }),
      };
    }

    // Validate repository.full_name format (should be owner/repo)
    if (!payload.repository.full_name.includes('/')) {
      console.error(
        `[${ENVIRONMENT}] Invalid repository.full_name format:`,
        payload.repository.full_name
      );
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Invalid repository format',
          message: 'repository.full_name must be in format "owner/repo"',
          expectedFormat: 'owner/repo',
          receivedValue: payload.repository.full_name,
          timestamp: new Date().toISOString(),
          requestId: event.headers['x-amzn-requestid'] || 'unknown',
        }),
      };
    }

    // Filter: Only target repository with detailed validation
    if (payload.repository.full_name !== GITHUB_REPOSITORY) {
      console.log(
        `[${ENVIRONMENT}] Repository mismatch - Expected: ${GITHUB_REPOSITORY}, Received: ${payload.repository.full_name}`
      );
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Repository not authorized',
          message: `This webhook is configured for repository '${GITHUB_REPOSITORY}' but received payload for '${payload.repository.full_name}'`,
          expectedRepository: GITHUB_REPOSITORY,
          receivedRepository: payload.repository.full_name,
          timestamp: new Date().toISOString(),
          requestId: event.headers['x-amzn-requestid'] || 'unknown',
        }),
      };
    }

    const commits = payload.commits || [];
    if (commits.length === 0) {
      console.log(`[${ENVIRONMENT}] No commits found`);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'No commits to process',
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Process only the final (most recent) commit from the push
    const finalCommit = commits[commits.length - 1];
    console.log(`[${ENVIRONMENT}] Processing final commit: ${finalCommit.id}`);

    // Fetch git diff for the final commit
    let commitDetails;
    try {
      const diffData = await fetchCommitDiff(finalCommit.id);
      commitDetails = {
        ...finalCommit,
        diff: formatDiff(diffData),
      };
    } catch (error) {
      console.error(`[${ENVIRONMENT}] Error fetching diff for ${finalCommit.id}:`, error);
      commitDetails = {
        ...finalCommit,
        diff: 'Error fetching diff',
      };
    }

    // Send email notification for the final commit
    const emailSubject = `GitHub Push: ${commits.length} commit(s) to ${GITHUB_REPOSITORY}`;
    const emailBody = formatEmail([commitDetails], commits.length);

    await sns.send(
      new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: emailSubject,
        Message: emailBody,
      })
    );

    console.log(`[${ENVIRONMENT}] Email sent successfully for final commit: ${finalCommit.id}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Webhook processed successfully',
        totalCommits: commits.length,
        processedCommit: finalCommit.id,
        repository: GITHUB_REPOSITORY,
        processedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error(`[${ENVIRONMENT}] Error processing webhook:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      requestHeaders: event.headers,
      bodyLength: event.body?.length || 0,
    });

    // Determine error type and provide appropriate response
    let statusCode = 500;
    let errorMessage = 'Internal server error occurred while processing webhook';

    if (error instanceof SyntaxError) {
      statusCode = 400;
      errorMessage = 'Invalid JSON payload';
    } else if (error instanceof Error && error.message.includes('validation')) {
      statusCode = 400;
      errorMessage = 'Payload validation failed';
    }

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString(),
        requestId: event.headers['x-amzn-requestid'] || 'unknown',
      }),
    };
  }
};

async function fetchCommitDiff(commitSha: string): Promise<GitHubCommitData> {
  return new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/commits/${commitSha}`;

    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': `GitHub-Monitor/${ENVIRONMENT}`,
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 10000,
      },
      response => {
        let data = '';
        response.on('data', chunk => (data += chunk));
        response.on('end', () => {
          if (response.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`GitHub API error: ${response.statusCode}`));
          }
        });
      }
    );

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function formatDiff(commitData: GitHubCommitData): string {
  if (!commitData.files?.length) return 'No file changes';

  let diff = '';
  for (const file of commitData.files.slice(0, 5)) {
    diff += `\n--- ${file.filename} ---\n`;
    diff += `Status: ${file.status} (+${file.additions} -${file.deletions})\n`;

    if (file.patch && file.patch.length < 1000) {
      diff += `\n${file.patch}\n`;
    } else if (file.patch) {
      diff += '\n(diff too large to display)\n';
    }
    diff += '\n' + '='.repeat(40) + '\n';
  }

  if (commitData.files.length > 5) {
    diff += `\n... and ${commitData.files.length - 5} more files\n`;
  }

  return diff;
}

function formatEmail(commitDetails: any[], totalCommits: number): string {
  let message = `New commits pushed to ${GITHUB_REPOSITORY}\n`;
  message += `Environment: ${ENVIRONMENT}\n`;

  if (totalCommits > 1) {
    message += `Total commits in push: ${totalCommits} (showing final commit only)\n`;
  }

  message += '='.repeat(50) + '\n\n';

  // Process the single commit (final commit)
  const commit = commitDetails[0];
  message += 'Final Commit:\n';
  message += `SHA: ${commit.id}\n`;
  message += `Author: ${commit.author?.name || 'Unknown'}\n`;
  message += `Message: ${commit.message}\n`;
  message += `URL: ${commit.url}\n\n`;
  message += `Changes:\n${commit.diff}\n\n`;

  message += `Repository: https://github.com/${GITHUB_REPOSITORY}\n`;
  return message;
}
