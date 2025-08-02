/**
 * GitHub Webhook Processor Lambda Function.
 *
 * Handles: Webhook validation → Git diff fetching → Email notification
 * Replaces: Webhook receiver + EventBridge + Step Functions + Git diff processor
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

  try {
    const payload: GitHubWebhookPayload = JSON.parse(event.body);
    const githubEvent = event.headers['x-github-event'] || event.headers['X-GitHub-Event'];

    // Filter: Only push events
    if (githubEvent !== 'push') {
      console.log(`[${ENVIRONMENT}] Ignoring ${githubEvent} event`);
      return { statusCode: 200, body: 'Event ignored' };
    }

    // Filter: Only target repository
    if (payload.repository?.full_name !== GITHUB_REPOSITORY) {
      console.log(`[${ENVIRONMENT}] Ignoring different repository`);
      return { statusCode: 200, body: 'Repository ignored' };
    }

    const commits = payload.commits || [];
    if (commits.length === 0) {
      console.log(`[${ENVIRONMENT}] No commits found`);
      return { statusCode: 200, body: 'No commits' };
    }

    console.log(`[${ENVIRONMENT}] Processing ${commits.length} commits`);

    // Fetch git diffs for commits
    const commitDetails = await Promise.all(
      commits.slice(0, 3).map(async commit => {
        try {
          const diffData = await fetchCommitDiff(commit.id);
          return {
            ...commit,
            diff: formatDiff(diffData),
          };
        } catch (error) {
          console.error(`[${ENVIRONMENT}] Error fetching diff for ${commit.id}:`, error);
          return {
            ...commit,
            diff: 'Error fetching diff',
          };
        }
      })
    );

    // Send email notification
    const emailSubject = `GitHub Push: ${commits.length} commit(s) to ${GITHUB_REPOSITORY}`;
    const emailBody = formatEmail(commitDetails);

    await sns.send(
      new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: emailSubject,
        Message: emailBody,
      })
    );

    console.log(`[${ENVIRONMENT}] Email sent successfully`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Webhook processed successfully',
        commits: commits.length,
        repository: GITHUB_REPOSITORY,
      }),
    };
  } catch (error) {
    console.error(`[${ENVIRONMENT}] Error:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Processing failed' }),
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

function formatEmail(commits: any[]): string {
  let message = `New commits pushed to ${GITHUB_REPOSITORY}\n`;
  message += `Environment: ${ENVIRONMENT}\n`;
  message += '='.repeat(50) + '\n\n';

  commits.forEach((commit, i) => {
    message += `Commit ${i + 1}:\n`;
    message += `SHA: ${commit.id}\n`;
    message += `Author: ${commit.author?.name || 'Unknown'}\n`;
    message += `Message: ${commit.message}\n`;
    message += `URL: ${commit.url}\n\n`;
    message += `Changes:\n${commit.diff}\n\n`;
    message += '*'.repeat(50) + '\n\n';
  });

  message += `Repository: https://github.com/${GITHUB_REPOSITORY}\n`;
  return message;
}
