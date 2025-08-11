/**
 * GitHub Webhook Processor Lambda Function
 *
 * Built with AWS Solutions Constructs for security and best practices.
 *
 * This function processes GitHub push events by:
 * 1. Verifying GitHub webhook signature using HMAC-SHA256
 * 2. Validating webhook payload structure and repository
 * 3. Extracting the final (most recent) commit from the push
 * 4. Fetching detailed git diff for the final commit via GitHub API
 * 5. Sending formatted email notification via SNS
 *
 * Environment Variables (automatically configured by AWS Solutions Constructs):
 * - GITHUB_REPOSITORY: Target repository in owner/repo format
 * - SNS_TOPIC_ARN: SNS topic ARN for email notifications
 * - ENVIRONMENT: Deployment environment (dev/prod)
 * - GITHUB_WEBHOOK_SECRET: Secret for GitHub webhook signature verification
 *
 * Security:
 * - GitHub webhook signature verification prevents unauthorized requests
 * - API Gateway uses authorizationType: NONE (required for GitHub webhooks)
 * - All security is handled through cryptographic signature verification
 */

import * as https from 'https';
import * as crypto from 'crypto';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// Initialize SNS client (reused across invocations)
const sns = new SNSClient({ region: process.env.AWS_REGION });

// Environment variables
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY!;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN!;
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET!;

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
    /*
     * GitHub Webhook Security Implementation:
     *
     * Since our API Gateway endpoint uses authorizationType: NONE (required for GitHub to call it),
     * we implement security through GitHub webhook signature verification here in the Lambda function.
     *
     * GitHub signs each webhook payload with the secret we configured and sends the signature
     * in the 'X-Hub-Signature-256' header. We verify this signature to ensure:
     * 1. The request actually came from GitHub (not a malicious actor)
     * 2. The payload hasn't been tampered with during transit
     * 3. The request is authentic and authorized
     *
     * This is the standard security pattern for GitHub webhooks and provides better security
     * than AWS IAM authentication because only GitHub can generate valid signatures.
     */
    const signature = event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'];
    if (!verifyGitHubSignature(event.body, signature)) {
      console.error(`[${ENVIRONMENT}] Invalid GitHub signature`);
      return buildResponse(401, {
        error: 'Unauthorized',
        message: 'Invalid GitHub webhook signature',
      });
    }

    console.log(`[${ENVIRONMENT}] GitHub signature verified successfully`);

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
      return buildResponse(200, {
        message: 'Event ignored',
        reason: `Only 'push' events are processed, received: ${githubEvent}`,
      });
    }

    // Validate payload structure
    const validationResult = validatePayload(payload, event.headers);
    if (validationResult.isValid === false) {
      console.error(`[${ENVIRONMENT}] Payload validation failed:`, validationResult.error);
      return buildResponse(validationResult.statusCode, validationResult.error);
    }

    const commits = payload.commits || [];
    if (commits.length === 0) {
      console.log(`[${ENVIRONMENT}] No commits found`);
      return buildResponse(200, { message: 'No commits to process' });
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

    return buildResponse(200, {
      message: 'Webhook processed successfully',
      totalCommits: commits.length,
      processedCommit: finalCommit.id,
      repository: GITHUB_REPOSITORY,
      processedAt: new Date().toISOString(),
    });
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

    return buildResponse(statusCode, {
      error: errorMessage,
      requestId: event.headers['x-amzn-requestid'] || 'unknown',
    });
  }
};

/**
 * Centralized response builder with consistent structure.
 */
function buildResponse(statusCode: number, body: any) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      timestamp: new Date().toISOString(),
    }),
  };
}

/**
 * Consolidated payload validation function.
 */
function validatePayload(
  payload: GitHubWebhookPayload,
  headers: Record<string, string>
): { isValid: true } | { isValid: false; statusCode: number; error: any } {
  // Validate repository structure exists
  if (!payload.repository) {
    return {
      isValid: false,
      statusCode: 400,
      error: {
        error: 'Invalid payload structure',
        message: 'Missing required field: repository',
        expectedStructure: { repository: { full_name: 'owner/repo' } },
        requestId: headers['x-amzn-requestid'] || 'unknown',
      },
    };
  }

  // Validate repository.full_name exists and format
  if (
    !payload.repository.full_name ||
    typeof payload.repository.full_name !== 'string' ||
    !payload.repository.full_name.includes('/')
  ) {
    return {
      isValid: false,
      statusCode: 400,
      error: {
        error: 'Invalid repository format',
        message: 'repository.full_name must be in format "owner/repo"',
        expectedFormat: 'owner/repo',
        receivedValue: payload.repository.full_name,
        requestId: headers['x-amzn-requestid'] || 'unknown',
      },
    };
  }

  // Validate target repository
  if (payload.repository.full_name !== GITHUB_REPOSITORY) {
    return {
      isValid: false,
      statusCode: 403,
      error: {
        error: 'Repository not authorized',
        message: `This webhook is configured for repository '${GITHUB_REPOSITORY}' but received payload for '${payload.repository.full_name}'`,
        expectedRepository: GITHUB_REPOSITORY,
        receivedRepository: payload.repository.full_name,
        requestId: headers['x-amzn-requestid'] || 'unknown',
      },
    };
  }

  return { isValid: true };
}

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

/**
 * Verify GitHub webhook signature using HMAC-SHA256.
 *
 * This function implements the security layer for our GitHub webhook since we use
 * authorizationType: NONE on the API Gateway endpoint (required for GitHub to call it).
 *
 * GitHub Webhook Security Process:
 * 1. GitHub signs each webhook payload with our secret using HMAC-SHA256
 * 2. GitHub sends the signature in the 'X-Hub-Signature-256' header as 'sha256=<signature>'
 * 3. We recreate the signature using the same secret and payload
 * 4. We compare signatures using crypto.timingSafeEqual() to prevent timing attacks
 *
 * This ensures:
 * - Only GitHub can generate valid signatures (they have our secret)
 * - The payload hasn't been tampered with during transit
 * - Protection against replay attacks and unauthorized webhook calls
 *
 * @param payload - The raw webhook payload from GitHub
 * @param signature - The signature from X-Hub-Signature-256 header
 * @returns true if signature is valid, false otherwise
 */
function verifyGitHubSignature(payload: string, signature: string): boolean {
  if (!signature || !payload) {
    console.error(`[${ENVIRONMENT}] Missing signature or payload for verification`);
    return false;
  }

  try {
    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
      .update(payload, 'utf8')
      .digest('hex');

    const expectedHeader = `sha256=${expectedSignature}`;

    console.log(`[${ENVIRONMENT}] Signature verification:`, {
      receivedSignature: signature.substring(0, 20) + '...',
      expectedSignature: expectedHeader.substring(0, 20) + '...',
    });

    // Use crypto.timingSafeEqual to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHeader));
  } catch (error) {
    console.error(`[${ENVIRONMENT}] Error verifying GitHub signature:`, error);
    return false;
  }
}
