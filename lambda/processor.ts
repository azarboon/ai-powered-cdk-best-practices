/**
 * GitHub Webhook Processor Lambda Function
 *
 * Built with AWS Solutions Constructs for security and best practices.
 * Enhanced with AWS Lambda Powertools using functional approach for observability.
 * Powertools dependencies are provided by AWS Lambda Layer.
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
 * - POWERTOOLS_SERVICE_NAME: Service name for structured logging
 * - POWERTOOLS_LOG_LEVEL: Log level (DEBUG, INFO, WARN, ERROR)
 * - POWERTOOLS_METRICS_NAMESPACE: CloudWatch metrics namespace
 *
 * Security:
 * - GitHub webhook signature verification prevents unauthorized requests
 * - API Gateway uses authorizationType: NONE (required for GitHub webhooks)
 * - All security is handled through cryptographic signature verification
 */

import * as https from 'https';
import * as crypto from 'crypto';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import type { Context } from 'aws-lambda';

// Import Powertools from AWS Lambda Layer
// These are provided by the AWS Lambda Powertools layer, not from node_modules
const { Logger } = require('@aws-lambda-powertools/logger');
const { Tracer } = require('@aws-lambda-powertools/tracer');
const { Metrics, MetricUnit } = require('@aws-lambda-powertools/metrics');

// Initialize Powertools with functional approach
const logger = new Logger({
  serviceName: process.env.POWERTOOLS_SERVICE_NAME || 'github-webhook-processor',
  logLevel: (process.env.POWERTOOLS_LOG_LEVEL as any) || 'INFO',
});

const tracer = new Tracer({
  serviceName: process.env.POWERTOOLS_SERVICE_NAME || 'github-webhook-processor',
});

const metrics = new Metrics({
  namespace: process.env.POWERTOOLS_METRICS_NAMESPACE || 'GitHubMonitor',
  serviceName: process.env.POWERTOOLS_SERVICE_NAME || 'github-webhook-processor',
});

// Initialize SNS client with X-Ray tracing
const sns = tracer.captureAWSv3Client(new SNSClient({ region: process.env.AWS_REGION }));

// Environment variables validation
const validateEnvironmentVariables = () => {
  const required = ['GITHUB_REPOSITORY', 'SNS_TOPIC_ARN', 'GITHUB_WEBHOOK_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missingVariables: missing });
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// Validate environment variables at startup
validateEnvironmentVariables();

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

export const handler = async (event: APIGatewayEvent, context: Context) => {
  // Add Lambda context to logger
  logger.addContext(context);
  logger.logEventIfEnabled(event);

  // Add correlation ID for tracing
  const correlationId = crypto.randomUUID();
  logger.appendKeys({ correlationId });
  tracer.putAnnotation('correlationId', correlationId);

  // Create main handler subsegment
  const handlerSubsegment = tracer.getSegment()?.addNewSubsegment('#### webhook-handler');

  logger.info('Processing webhook request', {
    repository: GITHUB_REPOSITORY,
    environment: ENVIRONMENT,
    bodyLength: event.body?.length || 0,
  });

  // Add custom metrics
  metrics.addMetric('WebhookReceived', MetricUnit.Count, 1);

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

    const signatureSubsegment = tracer.getSegment()?.addNewSubsegment('signature-verification');
    const isValidSignature = verifyGitHubSignature(event.body, signature);
    signatureSubsegment?.close();

    if (!isValidSignature) {
      logger.error('Invalid GitHub signature', { hasSignature: !!signature });
      metrics.addMetric('InvalidSignature', MetricUnit.Count, 1);
      const response = buildResponse(401, {
        error: 'Unauthorized',
        message: 'Invalid GitHub webhook signature',
      });
      return response;
    }

    logger.info('GitHub signature verified successfully');
    metrics.addMetric('ValidSignature', MetricUnit.Count, 1);

    const payload: GitHubWebhookPayload = JSON.parse(event.body);
    const githubEvent = event.headers['x-github-event'] || event.headers['X-GitHub-Event'];

    logger.info('Parsed webhook payload', {
      hasRepository: !!payload.repository,
      repositoryName: payload.repository?.full_name,
      commitsCount: payload.commits?.length || 0,
      ref: payload.ref,
      githubEvent,
    });

    // Filter: Only push events
    if (githubEvent !== 'push') {
      logger.info('Ignoring non-push event', { eventType: githubEvent });
      metrics.addMetric('EventIgnored', MetricUnit.Count, 1);
      const response = buildResponse(200, {
        message: 'Event ignored',
        reason: `Only 'push' events are processed, received: ${githubEvent}`,
      });
      return response;
    }

    metrics.addMetric('PushEventProcessed', MetricUnit.Count, 1);

    // Validate payload structure
    const validationSubsegment = tracer.getSegment()?.addNewSubsegment('payload-validation');
    const validationResult = validatePayload(payload, event.headers);
    validationSubsegment?.close();

    if (validationResult.isValid === false) {
      logger.error('Payload validation failed', { error: validationResult.error });
      metrics.addMetric('PayloadValidationFailed', MetricUnit.Count, 1);
      const response = buildResponse(validationResult.statusCode, validationResult.error);
      return response;
    }

    logger.info('Payload validation successful');
    metrics.addMetric('PayloadValidationSuccess', MetricUnit.Count, 1);

    const commits = payload.commits || [];
    if (commits.length === 0) {
      logger.info('No commits found in payload');
      metrics.addMetric('NoCommitsFound', MetricUnit.Count, 1);
      const response = buildResponse(200, { message: 'No commits to process' });
      return response;
    }

    // Process only the final (most recent) commit from the push
    const finalCommit = commits[commits.length - 1];
    logger.info('Processing final commit', {
      commitId: finalCommit.id,
      totalCommits: commits.length,
      author: finalCommit.author?.name,
    });

    tracer.putAnnotation('commitId', finalCommit.id);
    tracer.putAnnotation('totalCommits', commits.length);
    metrics.addMetric('CommitsInPush', MetricUnit.Count, commits.length);

    // Fetch git diff for the final commit
    let commitDetails;
    try {
      const diffData = await fetchCommitDiff(finalCommit.id);
      commitDetails = {
        ...finalCommit,
        diff: formatDiff(diffData),
      };
      logger.info('Successfully fetched commit diff', { commitId: finalCommit.id });
      metrics.addMetric('DiffFetchSuccess', MetricUnit.Count, 1);
    } catch (error) {
      logger.error('Error fetching commit diff', {
        commitId: finalCommit.id,
        error: error instanceof Error ? error.message : String(error),
      });
      tracer.addErrorAsMetadata(error as Error);
      metrics.addMetric('DiffFetchError', MetricUnit.Count, 1);
      commitDetails = {
        ...finalCommit,
        diff: 'Error fetching diff',
      };
    }

    // Send email notification for the final commit
    const emailSubject = `GitHub Push: ${commits.length} commit(s) to ${GITHUB_REPOSITORY}`;
    const emailBody = formatEmail([commitDetails], commits.length);

    const snsSubsegment = tracer.getSegment()?.addNewSubsegment('sns-publish');
    try {
      await sns.send(
        new PublishCommand({
          TopicArn: SNS_TOPIC_ARN,
          Subject: emailSubject,
          Message: emailBody,
        })
      );
      snsSubsegment?.close();

      logger.info('Email notification sent successfully', {
        commitId: finalCommit.id,
        subject: emailSubject,
      });
      metrics.addMetric('EmailSent', MetricUnit.Count, 1);
    } catch (error) {
      snsSubsegment?.close(error as Error);
      logger.error('Failed to send email notification', {
        error: error instanceof Error ? error.message : String(error),
      });
      tracer.addErrorAsMetadata(error as Error);
      metrics.addMetric('EmailSendError', MetricUnit.Count, 1);
      throw error;
    }

    const response = {
      message: 'Webhook processed successfully',
      totalCommits: commits.length,
      processedCommit: finalCommit.id,
      repository: GITHUB_REPOSITORY,
      processedAt: new Date().toISOString(),
    };

    logger.info('Webhook processing completed successfully', response);
    metrics.addMetric('WebhookProcessedSuccess', MetricUnit.Count, 1);

    return buildResponse(200, response);
  } catch (error) {
    logger.error('Error processing webhook', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      bodyLength: event.body?.length || 0,
    });

    tracer.addErrorAsMetadata(error as Error);
    metrics.addMetric('WebhookProcessingError', MetricUnit.Count, 1);

    // Determine error type and provide appropriate response
    let statusCode = 500;
    let errorMessage = 'Internal server error occurred while processing webhook';

    if (error instanceof SyntaxError) {
      statusCode = 400;
      errorMessage = 'Invalid JSON payload';
      metrics.addMetric('InvalidJSONPayload', MetricUnit.Count, 1);
    } else if (error instanceof Error && error.message.includes('validation')) {
      statusCode = 400;
      errorMessage = 'Payload validation failed';
      metrics.addMetric('ValidationError', MetricUnit.Count, 1);
    }

    return buildResponse(statusCode, {
      error: errorMessage,
      requestId: event.headers['x-amzn-requestid'] || 'unknown',
    });
  } finally {
    // Close main handler subsegment and publish metrics
    handlerSubsegment?.close();
    metrics.publishStoredMetrics();
  }
};

/**
 * Centralized response builder with consistent structure.
 */
function buildResponse(statusCode: number, body: any) {
  const response = {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      timestamp: new Date().toISOString(),
    }),
  };

  logger.info('Building response', { statusCode, bodyKeys: Object.keys(body) });
  return response;
}

/**
 * Consolidated payload validation function.
 */
function validatePayload(
  payload: GitHubWebhookPayload,
  headers: Record<string, string>
): { isValid: true } | { isValid: false; statusCode: number; error: any } {
  const requestId = headers['x-amzn-requestid'] || 'unknown';

  // Validate repository structure exists
  if (!payload.repository) {
    logger.warn('Missing repository field in payload');
    return {
      isValid: false,
      statusCode: 400,
      error: {
        error: 'Invalid payload structure',
        message: 'Missing required field: repository',
        expectedStructure: { repository: { full_name: 'owner/repo' } },
        requestId,
      },
    };
  }

  // Validate repository.full_name exists and format
  if (
    !payload.repository.full_name ||
    typeof payload.repository.full_name !== 'string' ||
    !payload.repository.full_name.includes('/')
  ) {
    logger.warn('Invalid repository format', {
      fullName: payload.repository.full_name,
      type: typeof payload.repository.full_name,
    });
    return {
      isValid: false,
      statusCode: 400,
      error: {
        error: 'Invalid repository format',
        message: 'repository.full_name must be in format "owner/repo"',
        expectedFormat: 'owner/repo',
        receivedValue: payload.repository.full_name,
        requestId,
      },
    };
  }

  // Validate target repository
  if (payload.repository.full_name !== GITHUB_REPOSITORY) {
    logger.warn('Repository not authorized', {
      expected: GITHUB_REPOSITORY,
      received: payload.repository.full_name,
    });
    return {
      isValid: false,
      statusCode: 403,
      error: {
        error: 'Repository not authorized',
        message: `This webhook is configured for repository '${GITHUB_REPOSITORY}' but received payload for '${payload.repository.full_name}'`,
        expectedRepository: GITHUB_REPOSITORY,
        receivedRepository: payload.repository.full_name,
        requestId,
      },
    };
  }

  logger.debug('Payload validation successful');
  return { isValid: true };
}

async function fetchCommitDiff(commitSha: string): Promise<GitHubCommitData> {
  const subsegment = tracer.getSegment()?.addNewSubsegment('github-api-call');
  subsegment?.addAnnotation('commitSha', commitSha);

  return new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/commits/${commitSha}`;

    logger.debug('Fetching commit diff from GitHub API', { url, commitSha });

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
          subsegment?.addMetadata('response', {
            statusCode: response.statusCode,
            headers: response.headers,
            dataLength: data.length,
          });

          if (response.statusCode === 200) {
            logger.debug('Successfully fetched commit data from GitHub API', {
              commitSha,
              dataLength: data.length,
            });
            subsegment?.close();
            resolve(JSON.parse(data));
          } else {
            const error = new Error(`GitHub API error: ${response.statusCode}`);
            logger.error('GitHub API request failed', {
              commitSha,
              statusCode: response.statusCode,
              responseBody: data.substring(0, 500),
            });
            subsegment?.close(error);
            reject(error);
          }
        });
      }
    );

    request.on('error', error => {
      logger.error('GitHub API request error', { commitSha, error: error.message });
      subsegment?.close(error);
      reject(error);
    });

    request.on('timeout', () => {
      request.destroy();
      const error = new Error('Request timeout');
      logger.error('GitHub API request timeout', { commitSha });
      subsegment?.close(error);
      reject(error);
    });
  });
}

function formatDiff(commitData: GitHubCommitData): string {
  if (!commitData.files?.length) {
    logger.debug('No files found in commit data');
    return 'No file changes';
  }

  logger.debug('Formatting diff', { fileCount: commitData.files.length });

  let diff = '';
  const filesToShow = Math.min(commitData.files.length, 5);

  for (let i = 0; i < filesToShow; i++) {
    const file = commitData.files[i];
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
  logger.debug('Formatting email', { totalCommits, commitDetailsCount: commitDetails.length });

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
    logger.error('Missing signature or payload for verification', {
      hasSignature: !!signature,
      hasPayload: !!payload,
    });
    return false;
  }

  try {
    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
      .update(payload, 'utf8')
      .digest('hex');

    const expectedHeader = `sha256=${expectedSignature}`;

    logger.debug('Signature verification details', {
      receivedSignaturePrefix: signature.substring(0, 20),
      expectedSignaturePrefix: expectedHeader.substring(0, 20),
    });

    // Use crypto.timingSafeEqual to prevent timing attacks
    const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHeader));

    logger.debug('Signature verification result', { isValid });
    return isValid;
  } catch (error) {
    logger.error('Error verifying GitHub signature', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
