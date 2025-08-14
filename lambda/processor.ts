/**
 * GitHub Webhook Processor
 */

import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import httpCors from '@middy/http-cors';
import * as crypto from 'crypto';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import type { APIGatewayProxyResult } from 'aws-lambda';

// Import Powertools from AWS Lambda Layer
const { Logger } = require('@aws-lambda-powertools/logger');
const { injectLambdaContext } = require('@aws-lambda-powertools/logger/middleware');
const { Metrics, MetricUnit } = require('@aws-lambda-powertools/metrics');
const { logMetrics } = require('@aws-lambda-powertools/metrics/middleware');
const { Tracer } = require('@aws-lambda-powertools/tracer');
const { captureLambdaHandler } = require('@aws-lambda-powertools/tracer/middleware');
const { parser } = require('@aws-lambda-powertools/parser/middleware');
const { APIGatewayProxyEventSchema } = require('@aws-lambda-powertools/parser/schemas');

// Environment variable validation at startup
const requiredEnvVars = [
  'GITHUB_REPOSITORY',
  'SNS_TOPIC_ARN',
  'GITHUB_WEBHOOK_SECRET',
  'AWS_REGION',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Additional validation for specific formats
if (!process.env.GITHUB_REPOSITORY?.includes('/')) {
  throw new Error('GITHUB_REPOSITORY must be in format "owner/repo"');
}

if (!process.env.SNS_TOPIC_ARN?.startsWith('arn:aws:sns:')) {
  throw new Error('SNS_TOPIC_ARN must be a valid SNS topic ARN');
}

// Initialize Powertools
const logger = new Logger({ serviceName: 'github-webhook-processor' });
const tracer = new Tracer({ serviceName: 'github-webhook-processor' });
const metrics = new Metrics({
  namespace: 'GitHubMonitor',
  serviceName: 'github-webhook-processor',
});

// Initialize clients
const sns = tracer.captureAWSv3Client(
  new SNSClient({
    region: process.env.AWS_REGION,
    requestHandler: new NodeHttpHandler(),
  })
);

// Use Powertools built-in API Gateway schema
type GitHubEvent = any; // Will be validated by Powertools APIGatewayProxyEventSchema

// Capture raw body middleware - read-only, preserves event.body bytes
const captureRawBody = () => ({
  before: async (request: any) => {
    // Preserve the exact raw request bytes
    const event = request.event;
    let rawBodyBuffer: Buffer;

    if (event.isBase64Encoded) {
      // Handle base64-encoded payloads
      rawBodyBuffer = Buffer.from(event.body, 'base64');
    } else {
      // Handle plain UTF-8 payloads
      rawBodyBuffer = Buffer.from(event.body, 'utf8');
    }

    // Store in context for later use by signature verification
    request.context.rawBodyBuffer = rawBodyBuffer;
  },
});

// Signature verification middleware - uses preserved bytes
const signatureVerification = () => ({
  before: async (request: any) => {
    const signature =
      request.event.headers['x-hub-signature-256'] || request.event.headers['X-Hub-Signature-256'];

    // Use preserved raw body buffer for HMAC computation
    const rawBodyBuffer = request.context.rawBodyBuffer;

    if (!verifySignatureWithBuffer(rawBodyBuffer, signature)) {
      metrics.addMetric('InvalidSignature', MetricUnit.Count, 1);
      throw new Error('Invalid signature');
    }
  },
});

const baseHandler = async (event: GitHubEvent): Promise<APIGatewayProxyResult> => {
  metrics.addMetric('WebhookReceived', MetricUnit.Count, 1);

  // Parse JSON body (will be string after Powertools validation)
  const payload = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

  const githubEvent = event.headers['x-github-event'] || event.headers['X-GitHub-Event'];

  // Only process push events
  if (githubEvent !== 'push') {
    metrics.addMetric('EventIgnored', MetricUnit.Count, 1);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Event ignored' }),
    };
  }

  // Validate repository
  if (payload.repository?.full_name !== process.env.GITHUB_REPOSITORY) {
    throw new Error('Repository not authorized');
  }

  const commits = payload.commits || [];
  if (commits.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'No commits to process' }),
    };
  }

  // Process final commit
  const finalCommit = commits[commits.length - 1];
  logger.info('Processing commit', { commitId: finalCommit.id, totalCommits: commits.length });

  let commitDetails;
  try {
    const diffData = await fetchCommitDiff(finalCommit.id);
    commitDetails = { ...finalCommit, diff: formatDiff(diffData) };
    metrics.addMetric('DiffFetchSuccess', MetricUnit.Count, 1);
  } catch (error) {
    logger.error('Error fetching diff', { error });
    commitDetails = { ...finalCommit, diff: 'Error fetching diff' };
    metrics.addMetric('DiffFetchError', MetricUnit.Count, 1);
  }

  // Send notification
  await sendNotification(commitDetails, commits.length);
  metrics.addMetric('EmailSent', MetricUnit.Count, 1);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Webhook processed successfully',
      totalCommits: commits.length,
      processedCommit: finalCommit.id,
    }),
  };
};

// Utility functions
async function fetchCommitDiff(commitSha: string, retries = 3): Promise<any> {
  const url = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/commits/${commitSha}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info('Fetching commit diff', { commitSha, attempt, retries });

      const response = await fetch(url, {
        headers: {
          'User-Agent': `GitHub-Monitor/${process.env.ENVIRONMENT || 'dev'}`,
          Accept: 'application/vnd.github.v3+json',
        },
        // Add timeout
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any; // GitHub API response
      logger.info('Successfully fetched commit diff', {
        commitSha,
        filesCount: data.files?.length || 0,
      });
      return data;
    } catch (error) {
      logger.warn('GitHub API request failed', {
        commitSha,
        attempt,
        retries,
        error: error instanceof Error ? error.message : String(error),
      });

      if (attempt === retries) {
        logger.error('All GitHub API retry attempts failed', { commitSha, error });
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const backoffMs = Math.pow(2, attempt) * 1000;
      logger.info('Retrying GitHub API request', {
        commitSha,
        backoffMs,
        nextAttempt: attempt + 1,
      });
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
}

async function sendNotification(commitDetails: any, totalCommits: number): Promise<void> {
  const subject = `GitHub Push: ${totalCommits} commit(s) to ${process.env.GITHUB_REPOSITORY}`;
  const message = formatEmail(commitDetails, totalCommits);

  try {
    logger.info('Sending SNS notification', {
      topicArn: process.env.SNS_TOPIC_ARN,
      commitId: commitDetails.id,
      totalCommits,
    });

    await sns.send(
      new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Subject: subject,
        Message: message,
      })
    );

    logger.info('SNS notification sent successfully', { commitId: commitDetails.id });
  } catch (error) {
    logger.error('Failed to send SNS notification', {
      error: error instanceof Error ? error.message : String(error),
      commitId: commitDetails.id,
      topicArn: process.env.SNS_TOPIC_ARN,
    });
    throw error;
  }
}

function formatDiff(commitData: any): string {
  if (!commitData.files?.length) return 'No file changes';

  let diff = '';
  const filesToShow = Math.min(commitData.files.length, 5);

  for (let i = 0; i < filesToShow; i++) {
    const file = commitData.files[i];
    diff += `\n--- ${file.filename} ---\n`;
    diff += `Status: ${file.status} (+${file.additions} -${file.deletions})\n`;

    if (file.patch && file.patch.length < 1000) {
      diff += `\n${file.patch}\n`;
    }
    diff += '\n' + '='.repeat(40) + '\n';
  }

  if (commitData.files.length > 5) {
    diff += `\n... and ${commitData.files.length - 5} more files\n`;
  }

  return diff;
}

function formatEmail(commitDetails: any, totalCommits: number): string {
  const commit = commitDetails;
  let message = `New commits pushed to ${process.env.GITHUB_REPOSITORY}\n`;
  message += `Environment: ${process.env.ENVIRONMENT || 'dev'}\n\n`;

  if (totalCommits > 1) {
    message += `Total commits: ${totalCommits} (showing final commit)\n\n`;
  }

  message += `Final Commit:\n`;
  message += `SHA: ${commit.id}\n`;
  message += `Author: ${commit.author?.name || 'Unknown'}\n`;
  message += `Message: ${commit.message}\n`;
  message += `URL: ${commit.url}\n\n`;
  message += `Changes:\n${commit.diff}\n`;

  return message;
}

function verifySignatureWithBuffer(rawBodyBuffer: Buffer, signature: string): boolean {
  if (!signature || !rawBodyBuffer) return false;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET!)
      .update(rawBodyBuffer)
      .digest('hex');

    const expectedHeader = `sha256=${expectedSignature}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHeader));
  } catch (error) {
    logger.error('Signature verification error', { error });
    return false;
  }
}

/*

DO NOT REMOVE OR ALTER THIS COMMENT

We preserve the exact raw request body here (read-only) before any parsing,
so we can compute the GitHub HMAC signature on the original bytes as delivered
by API Gateway (decode if isBase64Encoded). This middleware MUST remain strictly
read-only: no logging, no metrics, no errors.

Signature verification is intentionally placed AFTER Tracer/Logger/Metrics to retain
full Powertools instrumentation, but BEFORE httpJsonBodyParser/validation so the body
is still unmodified when computing the HMAC. If we ever need to reject requests early,
we do it in the signature verification middleware (post-Tracer) so rejections are still
traced and logged.

Re-stringifying after parsing is avoided because it cannot reliably reproduce the original
byte sequence (JSON reformatting, encoding differences, middleware side effects), which
would break HMAC equality. Note: if any upstream proxy rewrites payload bytes before API
Gateway, verification must occur there instead.
*/

export const handler = middy(baseHandler)
  .use(captureRawBody()) // 1st: Read-only, preserves event.body bytes; handles isBase64Encoded
  .use(captureLambdaHandler(tracer)) // 2nd: Start tracing
  .use(injectLambdaContext(logger)) // 3rd: Logger context
  .use(logMetrics(metrics)) // 4th: Metrics setup
  .use(signatureVerification()) // 5th: Compute HMAC over preserved bytes
  .use(parser({ schema: APIGatewayProxyEventSchema })) // 6th: Validate schema (on string body)
  .use(httpJsonBodyParser()) // 7th: Parse JSON body (after validation)
  .use(httpErrorHandler()) // 8th: Error handling
  .use(httpCors()) // 9th: CORS (flexible positioning)
  .onError(async () => {
    // Ensure metrics are published even on error
    try {
      metrics.publishStoredMetrics();
    } catch (metricsError) {
      logger.error('Failed to publish metrics on error', { metricsError });
    }
  });
