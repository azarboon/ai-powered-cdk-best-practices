import { Tags } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib';
import { GitHubMonitor } from '../lib/github-monitor-stack';
import { AppConfig } from '../lib/config';
import { applyTags } from '../lib/helpers';

describe('Testing stack level configurations', () => {
  let app: App;
  let stack: GitHubMonitor;
  let mockConfig: AppConfig;

  beforeAll(() => {
    app = new App();

    mockConfig = {
      AWS_ACCOUNT_ID: '123456789012',
      AWS_REGION: 'us-east-1',
      ENVIRONMENT: 'TEST',
      STACK_NAME: 'TestStack',
      REPOSITORY: 'owner/repo',
      WEBHOOK_SECRET: 'test-secret',
      NOTIFICATION_EMAIL: 'test@example.com',
      TAGS: {
        ENVIRONMENT: 'TEST',
        SERVICE: 'test-service',
        TEAM: 'test-team',
        COST_CENTER: 'test-cost-center',
      },
    };

    applyTags(app, mockConfig.TAGS);
    stack = new GitHubMonitor(app, mockConfig.STACK_NAME, { appConfig: mockConfig });
  });

  //@azarboon: create a test that ensures stateful resources logical id hasnt changed

  test('Stack-level tags match required tags', () => {
    const stackTags = Tags.fromStack(stack);
    console.log('stackTags.all():', stackTags.all());
    stackTags.hasValues(mockConfig.TAGS);
  });
});
