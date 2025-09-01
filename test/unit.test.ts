import { Template, Tags } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib';
import { GitHubMonitorStack } from '../lib/github-monitor-stack';
import { applyTags } from '../lib/helpers';

describe('Testing stack level configurations', () => {
  let app: App;
  let stack: GitHubMonitorStack;
  let template: Template;

  beforeAll(() => {
    process.env.GITHUB_REPOSITORY = 'test-owner/test-repo';
    process.env.NOTIFICATION_EMAIL = 'test@example.com';
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    process.env.ENVIRONMENT = 'test';
    process.env.SERVICE = 'test-service';
    process.env.TEAM = 'test-team';
    process.env.COST_CENTER = 'test-cost-center';
    process.env.STACK_NAME = 'TestStack';

    app = new App();
    // Tags have to be applied after app instantiation and before creating the stacks
    applyTags(app, {
      ENVIRONMENT: process.env.ENVIRONMENT!,
      SERVICE: process.env.SERVICE!,
      TEAM: process.env.TEAM!,
      COST_CENTER: process.env.COST_CENTER!,
    });
    stack = new GitHubMonitorStack(app, 'TestStack');
    template = Template.fromStack(stack);
  });

  test('All resource names are dynamic and include stack-name', () => {
    /*
  There is no universal "Name" property across AWS resources. This test iterates over all
  synthesized resources and checks properties named "Name" or ending with "Name" (e.g., TableName,
  BucketName, QueueName) to verify they are dynamic and include the stack name.
*/

    const stackName = process.env.STACK_NAME!;

    const resources = template.toJSON().Resources;
    // Loops through each resource in the synthesized CloudFormation template
    for (const [logicalId, resource] of Object.entries<any>(resources)) {
      // Gets the Properties section of each resource, defaulting to empty object if none
      const properties = resource.Properties ?? {};
      for (const [key, val] of Object.entries(properties)) {
        // Looks for properties that are exactly "Name" or end with "Name" (like QueueName, BucketName, TableName)
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
    const requiredTags = {
      ENVIRONMENT: process.env.ENVIRONMENT!,
      SERVICE: process.env.SERVICE!,
      TEAM: process.env.TEAM!,
      COST_CENTER: process.env.COST_CENTER!,
    };

    const stackTags = Tags.fromStack(stack);
    console.log('stackTags.all():', stackTags.all());
    stackTags.hasValues(requiredTags);
  });

  afterAll(() => {
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.NOTIFICATION_EMAIL;
    delete process.env.GITHUB_WEBHOOK_SECRET;
    delete process.env.ENVIRONMENT;
    delete process.env.SERVICE;
    delete process.env.TEAM;
    delete process.env.COST_CENTER;
    delete process.env.STACK_NAME;
  });
});
