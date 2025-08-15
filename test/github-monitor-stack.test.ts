import { Template } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib';
import { GitHubMonitorStack } from '../lib/github-monitor-stack';

describe('GitHubMonitorStack', () => {
  test('Lambda function uses Node.js 22 runtime', () => {
    // Set required environment variables for stack validation
    process.env.GITHUB_REPOSITORY = 'test-owner/test-repo';
    process.env.NOTIFICATION_EMAIL = 'test@example.com';
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';

    const app = new App();
    const stack = new GitHubMonitorStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
    });
  });
});
