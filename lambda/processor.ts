/**
 * GitHub Webhook Processor
 */

import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
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

// Environment variable validation
const validateEnvironment = (): void => {
  const required = ['GITHUB_REPOSITORY', 'SNS_TOPIC_ARN', 'GITHUB_WEBHOOK_SECRET', 'AWS_REGION'];
  const missing = required.filter(env => !process.env[env]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);

  if (!process.env.GITHUB_REPOSITORY?.includes('/')) {
    throw new Error('GITHUB_REPOSITORY must be in format "owner/repo"');
  }
  if (!process.env.SNS_TOPIC_ARN?.startsWith('arn:aws:sns:')) {
    throw new Error('SNS_TOPIC_ARN must be a valid SNS topic ARN');
  }
};

validateEnvironment();

// Initialize Powertools and clients
const logger = new Logger({ serviceName: 'github-webhook-processor' });
const tracer = new Tracer({ serviceName: 'github-webhook-processor' });
const metrics = new Metrics({
  namespace: 'GitHubMonitor',
  serviceName: 'github-webhook-processor',
});
const sns = tracer.captureAWSv3Client(
  new SNSClient({
    region: process.env.AWS_REGION,
    requestHandler: new NodeHttpHandler(),
  })
);

// Utility functions
const logError = (message: string, error: any, context?: any) => {
  logger.error(message, {
    error: error instanceof Error ? error.message : String(error),
    ...context,
  });
};

const buildResponse = (statusCode: number, message: string, data?: any): APIGatewayProxyResult => ({
  statusCode,
  body: JSON.stringify({ message, ...data }),
});

const verifySignature = (payload: string | Buffer, signature: string): boolean => {
  if (!signature || !payload) return false;
  try {
    const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET!);
    const expectedSignature = hmac.update(payload).digest('hex');
    const expectedHeader = `sha256=${expectedSignature}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHeader));
  } catch (error) {
    logError('Signature verification error', error);
    return false;
  }
};

// Middleware functions
const captureRawBody = () => ({
  before: async (request: any) => {
    const { body, isBase64Encoded } = request.event;
    request.context.rawBodyBuffer = Buffer.from(body, isBase64Encoded ? 'base64' : 'utf8');
  },
});

const signatureVerification = () => ({
  before: async (request: any) => {
    const signature =
      request.event.headers['x-hub-signature-256'] || request.event.headers['X-Hub-Signature-256'];

    if (!verifySignature(request.context.rawBodyBuffer, signature)) {
      metrics.addMetric('InvalidSignature', MetricUnit.Count, 1);
      throw new Error('Invalid signature');
    }
  },
});

// GitHub API with retry logic
const fetchWithRetry = async (url: string, options: any, retries = 3): Promise<any> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info('GitHub API request', { url, attempt, retries });
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });

      if (!response.ok)
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);

      const data = (await response.json()) as any;
      logger.info('GitHub API success', { url, filesCount: data.files?.length || 0 });
      return data;
    } catch (error) {
      logError('GitHub API request failed', error, { url, attempt, retries });

      if (attempt === retries) throw error;

      const backoffMs = Math.pow(2, attempt) * 1000;
      logger.info('Retrying GitHub API request', { url, backoffMs, nextAttempt: attempt + 1 });
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
};

const fetchCommitDiff = async (commitSha: string): Promise<any> => {
  const url = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/commits/${commitSha}`;
  return fetchWithRetry(url, {
    headers: {
      'User-Agent': `GitHub-Monitor/${process.env.ENVIRONMENT || 'dev'}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
};

const formatDiff = (commitData: any): string => {
  if (!commitData.files?.length) return 'No file changes';

  const filesToShow = Math.min(commitData.files.length, 5);
  let diff = '';

  for (let i = 0; i < filesToShow; i++) {
    const file = commitData.files[i];
    diff += `\n--- ${file.filename} ---\n`;
    diff += `Status: ${file.status} (+${file.additions} -${file.deletions})\n`;
    if (file.patch && file.patch.length < 1000) diff += `\n${file.patch}\n`;
    diff += '\n' + '='.repeat(40) + '\n';
  }

  if (commitData.files.length > 5) {
    diff += `\n... and ${commitData.files.length - 5} more files\n`;
  }

  return diff;
};

const formatEmail = (commitDetails: any, totalCommits: number): string => {
  const { id, author, message, url, diff } = commitDetails;
  let email = `New commits pushed to ${process.env.GITHUB_REPOSITORY}\n`;
  email += `Environment: ${process.env.ENVIRONMENT || 'dev'}\n\n`;

  if (totalCommits > 1) email += `Total commits: ${totalCommits} (showing final commit)\n\n`;

  email += `Final Commit:\n`;
  email += `SHA: ${id}\n`;
  email += `Author: ${author?.name || 'Unknown'}\n`;
  email += `Message: ${message}\n`;
  email += `URL: ${url}\n\n`;
  email += `Changes:\n${diff}\n`;

  return email;
};

const sendNotification = async (commitDetails: any, totalCommits: number): Promise<void> => {
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
    logError('Failed to send SNS notification', error, {
      commitId: commitDetails.id,
      topicArn: process.env.SNS_TOPIC_ARN,
    });
    throw error;
  }
};

// Main handler
const lambdaHandler = async (event: any): Promise<APIGatewayProxyResult> => {
  metrics.addMetric('WebhookReceived', MetricUnit.Count, 1);

  const payload = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  const githubEvent = event.headers['x-github-event'] || event.headers['X-GitHub-Event'];

  // Only process push events
  if (githubEvent !== 'push') {
    metrics.addMetric('EventIgnored', MetricUnit.Count, 1);
    return buildResponse(200, 'Event ignored');
  }

  // Validate repository
  if (payload.repository?.full_name !== process.env.GITHUB_REPOSITORY) {
    throw new Error('Repository not authorized');
  }

  const commits = payload.commits || [];
  if (commits.length === 0) {
    return buildResponse(200, 'No commits to process');
  }

  // Process final commit
  const finalCommit = commits[commits.length - 1];
  logger.info('Processing commit', { commitId: finalCommit.id, totalCommits: commits.length });

  try {
    const diffData = await fetchCommitDiff(finalCommit.id);
    const commitDetails = { ...finalCommit, diff: formatDiff(diffData) };
    metrics.addMetric('DiffFetchSuccess', MetricUnit.Count, 1);

    await sendNotification(commitDetails, commits.length);
    metrics.addMetric('EmailSent', MetricUnit.Count, 1);

    return buildResponse(200, 'Webhook processed successfully', {
      totalCommits: commits.length,
      processedCommit: finalCommit.id,
    });
  } catch (error) {
    logError('Error processing webhook', error, { commitId: finalCommit.id });

    // Send notification with error info
    const commitDetails = { ...finalCommit, diff: 'Error fetching diff' };
    metrics.addMetric('DiffFetchError', MetricUnit.Count, 1);

    try {
      await sendNotification(commitDetails, commits.length);
      metrics.addMetric('EmailSent', MetricUnit.Count, 1);
    } catch (notificationError) {
      logError('Failed to send error notification', notificationError);
    }

    return buildResponse(200, 'Webhook processed with errors', {
      totalCommits: commits.length,
      processedCommit: finalCommit.id,
      error: 'Failed to fetch commit diff',
    });
  }
};

// Middleware chain. The order of middlewares matter and reordering them may cause error
export const handler = middy()
  .use(captureRawBody()) // 1st: Preserve raw bytes
  .use(captureLambdaHandler(tracer)) // 2nd: Start tracing
  .use(injectLambdaContext(logger)) // 3rd: Logger context
  .use(logMetrics(metrics)) // 4th: Metrics setup
  .use(signatureVerification()) // 5th: HMAC verification
  .use(parser({ schema: APIGatewayProxyEventSchema })) // 6th: Validate schema
  .use(httpJsonBodyParser()) // 7th: Parse JSON body
  .use(httpErrorHandler()) // 8th: Error handling
  .handler(lambdaHandler)
  .onError(() => {
    metrics.publishStoredMetrics();
  });
