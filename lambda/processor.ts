/**
 * GitHub Webhook Processor - Minimal Powertools + Middy Implementation
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

// Minimal signature verification middleware
const signatureVerification = () => ({
  before: async (request: any) => {
    const signature =
      request.event.headers['x-hub-signature-256'] || request.event.headers['X-Hub-Signature-256'];
    if (!verifySignature(request.event.body, signature)) {
      metrics.addMetric('InvalidSignature', MetricUnit.Count, 1);
      throw new Error('Invalid signature');
    }
  },
});

// Main handler
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
async function fetchCommitDiff(commitSha: string): Promise<any> {
  const url = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/commits/${commitSha}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': `GitHub-Monitor/${process.env.ENVIRONMENT || 'dev'}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

async function sendNotification(commitDetails: any, totalCommits: number): Promise<void> {
  const subject = `GitHub Push: ${totalCommits} commit(s) to ${process.env.GITHUB_REPOSITORY}`;
  const message = formatEmail(commitDetails, totalCommits);

  await sns.send(
    new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Subject: subject,
      Message: message,
    })
  );
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

function verifySignature(payload: string, signature: string): boolean {
  if (!signature || !payload) return false;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET!)
      .update(payload, 'utf8')
      .digest('hex');

    const expectedHeader = `sha256=${expectedSignature}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHeader));
  } catch (error) {
    logger.error('Signature verification error', { error });
    return false;
  }
}

// Middy handler with proper Powertools order
export const handler = middy(baseHandler)
  .use(httpCors())
  .use(signatureVerification()) // 1st: Verify signature on raw body
  .use(parser({ schema: APIGatewayProxyEventSchema })) // 2nd: Parse and validate after verification
  .use(httpJsonBodyParser()) // 3rd: Parse JSON body
  .use(captureLambdaHandler(tracer)) // 4th: Tracer
  .use(injectLambdaContext(logger)) // 5th: Logger
  .use(logMetrics(metrics)) // 6th: Metrics
  .use(httpErrorHandler())
  .onError(async () => {
    metrics.publishStoredMetrics();
  });
