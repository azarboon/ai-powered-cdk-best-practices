import { Template, Tags } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib';
import { GitHubMonitorStack } from '../lib/github-monitor-stack';
import { AppConfig } from '../lib/config';
import { applyTags } from '../lib/helpers';

describe('Testing stack level configurations', () => {
  let app: App;
  let stack: GitHubMonitorStack;
  let mockConfig: AppConfig;
  let template: Template;

  beforeAll(() => {
    app = new App();

    mockConfig = {
      AWS_ACCOUNT_ID: '123456789012',
      AWS_REGION: 'us-east-1',
      ENVIRONMENT: 'TEST',
      STACK_NAME: 'TestStack',
      GITHUB_REPOSITORY: 'owner/repo',
      GITHUB_WEBHOOK_SECRET: 'test-secret',
      NOTIFICATION_EMAIL: 'test@example.com',
      TAGS: {
        ENVIRONMENT: 'TEST',
        SERVICE: 'test-service',
        TEAM: 'test-team',
        COST_CENTER: 'test-cost-center',
      },
    };

    applyTags(app, mockConfig.TAGS);
    stack = new GitHubMonitorStack(app, mockConfig.STACK_NAME, { appConfig: mockConfig });
    template = Template.fromStack(stack);
  });

  test('All resource names are dynamic and include stack-name', () => {
    const stackName = mockConfig.STACK_NAME;
    const resources = template.toJSON().Resources;

    for (const [logicalId, resource] of Object.entries<any>(resources)) {
      const properties = resource.Properties ?? {};
      for (const [key, val] of Object.entries(properties)) {
        if ((key === 'Name' || key.endsWith('Name')) && typeof val === 'string') {
          const resourceInfo = `${resource.Type} ${logicalId}: ${key}="${val}"`;
          try {
            expect(val).toContain(stackName);
            console.log(`${resourceInfo} is dynamic and has "${stackName}")`);
          } catch (error) {
            throw new Error(`${resourceInfo} (expected to contain "${stackName}")` + error);
          }
        }
      }
    }
  });

  test('Stack-level tags match required tags', () => {
    const stackTags = Tags.fromStack(stack);
    console.log('stackTags.all():', stackTags.all());
    stackTags.hasValues(mockConfig.TAGS);
  });
});
