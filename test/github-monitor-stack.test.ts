import { Template, Tags } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib';
import { GitHubMonitorStack } from '../lib/github-monitor-stack';
import { applyTags } from '../lib/helpers';

describe('GitHubMonitorStack', () => {
  let app: App;
  let stack: GitHubMonitorStack;
  let template: Template;

  beforeAll(() => {
    // Set required environment variables for stack validation
    process.env.GITHUB_REPOSITORY = 'test-owner/test-repo';
    process.env.NOTIFICATION_EMAIL = 'test@example.com';
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    process.env.ENVIRONMENT = 'test';
    process.env.SERVICE = 'test-service';
    process.env.TEAM = 'test-team';
    process.env.COST_CENTER = 'test-cost-center';
    process.env.CDK_STACK_NAME = 'TestStack';

    app = new App();
    // Tags have to be applied after app instantiation and before creating the stacks
    applyTags(app, {
      Environment: process.env.ENVIRONMENT!,
      Service: process.env.SERVICE!,
      Team: process.env.TEAM!,
      CostCenter: process.env.COST_CENTER!,
      Project: process.env.CDK_STACK_NAME!,
    });
    stack = new GitHubMonitorStack(app, 'TestStack');
    template = Template.fromStack(stack);
  });

  test('Stack-level tags match required tags', () => {
    const requiredTags = {
      Environment: process.env.ENVIRONMENT!,
      Service: process.env.SERVICE!,
      Team: process.env.TEAM!,
      CostCenter: process.env.COST_CENTER!,
      Project: process.env.CDK_STACK_NAME!,
    };

    const stackTags = Tags.fromStack(stack);
    console.log('stackTags.all():', stackTags.all());

    // This will fail the test if tags don't match
    stackTags.hasValues(requiredTags);
  });
  /*
@azarboon: use the loop from this test to optimize the next test
  test('All resources that support tagging have the required tags applied', () => {
    const requiredTags = [
      { Key: 'Environment', Value: process.env.ENVIRONMENT! },
      { Key: 'Service', Value: process.env.SERVICE! },
      { Key: 'Team', Value: process.env.TEAM! },
      { Key: 'CostCenter', Value: process.env.COST_CENTER! },
      { Key: 'Project', Value: process.env.CDK_STACK_NAME! },
    ];

    // Add Tags.fromStack to see what it shows
    const stackTags = Tags.fromStack(stack);
    console.log('stackTags object:', stackTags);
    console.log('stackTags.all():', stackTags.all());

    // @azarboon: use Tag class in cdk assertion library
    const allResources = template.toJSON().Resources || {};
    Object.entries(allResources).forEach(([logicalId, resource]: [string, any]) => {
      if (resource.Properties?.Tags) {
        let hasAllTags = true;
        requiredTags.forEach(requiredTag => {
          try {
            template.hasResourceProperties(resource.Type, {
              Tags: Match.arrayWith([requiredTag]),
            });
          } catch (error) {
            console.log(`  ❌ Missing tag: ${requiredTag.Key}=${requiredTag.Value}`);
            hasAllTags = false;
            throw error; // Throw to fail the test
          }
        });

        if (hasAllTags) {
          console.log(`✅ ${resource.Type} (${logicalId}) - has all required tags`);
        }
      } else {
        console.log(
          `⏭️  ${resource.Type} (${logicalId}) - Doesn't support Tags property, skipping`
        );
      }
    });
  });
*/

  test('All resource names are dynamic and include stack-name', () => {
    const stackName = process.env.CDK_STACK_NAME!;
    const tpl = template.toJSON();

    const resources = tpl.Resources ?? {};
    let checked = 0;
    const errors: string[] = [];
    const correctResources: string[] = [];
    //@azarboon: use assertion library to get and loop through resources, similar to above
    for (const [logicalId, res] of Object.entries<any>(resources)) {
      const props = res.Properties ?? {};
      for (const [key, val] of Object.entries(props)) {
        // Heuristic: keys that are exactly "Name" or end with "Name" (BucketName, TableName, etc.)
        if (key === 'Name' || key.endsWith('Name')) {
          if (typeof val === 'string') {
            checked++;
            const resourceInfo = `${res.Type} ${logicalId}: ${key}="${val}"`;

            if (!val.includes(stackName)) {
              errors.push(`${resourceInfo} (expected to contain "${stackName}")`);
            } else {
              correctResources.push(resourceInfo);
            }
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(0);
    expect(errors).toEqual([]);

    console.log(`\nDynamic Naming Summary:`);
    console.log(`- Resources checked: ${checked}`);
    console.log(`- Resources with correct naming: ${checked - errors.length}`);
    console.log(`- Resources with incorrect naming: ${errors.length}`);

    if (correctResources.length > 0) {
      console.log(`\n✅ Resources with correct naming:`);
      correctResources.forEach(resource => console.log(`  ${resource}`));
    }

    if (errors.length > 0) {
      console.log(`\n❌ Resources with incorrect naming:`);
      errors.forEach(error => console.log(`  ${error}`));
    }
  });

  afterAll(() => {
    // Clean up environment variables
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.NOTIFICATION_EMAIL;
    delete process.env.GITHUB_WEBHOOK_SECRET;
    delete process.env.ENVIRONMENT;
    delete process.env.SERVICE;
    delete process.env.TEAM;
    delete process.env.COST_CENTER;
    delete process.env.CDK_STACK_NAME;
  });
});
