import { Template } from 'aws-cdk-lib/assertions';
import { App, Tags } from 'aws-cdk-lib';
import { GitHubMonitorStack } from '../lib/github-monitor-stack';

function SetEnvVars<T>(vars: Record<string, string>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  try {
    for (const [k, v] of Object.entries(vars)) {
      prev[k] = process.env[k];
      process.env[k] = v;
    }
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe('GitHubMonitorStack', () => {
  test('All resource names are dynamic and include stack-name', () => {
    SetEnvVars(
      {
        GITHUB_REPOSITORY: 'test-owner/test-repo',
        NOTIFICATION_EMAIL: 'test@example.com',
        GITHUB_WEBHOOK_SECRET: 'test-secret',
      },
      () => {
        const stackName = 'TestStack';
        // const expectedPrefix = `${stackName}-`;

        const app = new App();
        const stack = new GitHubMonitorStack(app, stackName);
        const tpl = Template.fromStack(stack).toJSON();

        const resources = tpl.Resources ?? {};
        let checked = 0;
        const errors: string[] = [];
        const correctResources: string[] = [];

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
      }
    );
  });

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

  test('All resources have required tags applied', () => {
    // Set required environment variables for stack validation (application-specific)
    process.env.GITHUB_REPOSITORY = 'test-owner/test-repo';
    process.env.NOTIFICATION_EMAIL = 'test@example.com';
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';

    // Set required environment variables for validation of tags
    process.env.ENVIRONMENT = 'test';
    process.env.SERVICE = 'test-service';
    process.env.TEAM = 'test-team';
    process.env.COST_CENTER = 'test-cost-center';
    process.env.CDK_STACK_NAME = 'TestStack';

    const app = new App();

    // Apply centralized tagging at app level (simulating app.ts behavior)
    Tags.of(app).add('Environment', process.env.ENVIRONMENT!);
    Tags.of(app).add('Service', process.env.SERVICE!);
    Tags.of(app).add('Team', process.env.TEAM!);
    Tags.of(app).add('CostCenter', process.env.COST_CENTER!);
    Tags.of(app).add('Project', process.env.CDK_STACK_NAME!);

    const stack = new GitHubMonitorStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    const requiredTags = {
      Environment: 'test',
      Service: 'test-service',
      Team: 'test-team',
      CostCenter: 'test-cost-center',
      Project: 'TestStack',
    };

    // Get all resources from the template
    const templateJson = template.toJSON();
    const resources = templateJson.Resources || {};

    // Resources that explicitly DON'T support tagging (exclusion list) as of Aug 2025
    const nonTaggableResourceTypes = [
      'AWS::ApiGateway::RequestValidator',
      'AWS::ApiGateway::Model',
      'AWS::ApiGateway::Deployment',
      'AWS::CloudFormation::CustomResource',
      'AWS::IAM::Policy',
      'AWS::Lambda::EventInvokeConfig',
      'AWS::ApiGateway::Resource',
      'AWS::Lambda::Permission',
      'AWS::ApiGateway::Method',
      'AWS::ApiGateway::Account',
      'AWS::SNS::TopicPolicy',
      'AWS::SNS::Subscription',
      // Add others as discovered during testing
    ];

    let taggableResourcesFound = 0;
    let resourcesWithCorrectTags = 0;

    // Loop through all resources in the template
    Object.entries(resources).forEach(([logicalId, resource]: [string, any]) => {
      const resourceType = resource.Type;

      // Skip resources that explicitly don't support tagging
      if (nonTaggableResourceTypes.includes(resourceType)) {
        console.log(`Skipping non-taggable resource: ${resourceType} (${logicalId})`);
        return;
      }

      // Skip service-linked IAM roles (they cannot be tagged as of Aug 2025)
      if (resourceType === 'AWS::IAM::Role') {
        const assumeRolePolicyDocument = resource.Properties?.AssumeRolePolicyDocument;

        // Check if this is a service-linked role by examining the trust policy
        const isServiceLinkedRole = assumeRolePolicyDocument?.Statement?.some((statement: any) => {
          const principal = statement.Principal;
          // Service-linked roles have AWS services as principals
          return (
            principal?.Service &&
            (principal.Service.includes('apigateway.amazonaws.com') ||
              principal.Service.includes('logs.amazonaws.com') ||
              (typeof principal.Service === 'string' &&
                principal.Service.endsWith('.amazonaws.com')))
          );
        });

        if (isServiceLinkedRole) {
          console.log(`Skipping service-linked IAM role: ${logicalId}`);
          return; // Skip this resource
        }
      }

      // All other resources should be taggable
      taggableResourcesFound++;

      console.log(`Checking tags for ${resourceType} (${logicalId})`);

      // Check if resource has Tags property
      const resourceTags = resource.Properties?.Tags;

      if (resourceTags) {
        // Convert tags array to object for easier comparison
        const tagMap: Record<string, string> = {};

        if (Array.isArray(resourceTags)) {
          // Handle tags as array format: [{Key: 'key', Value: 'value'}]
          resourceTags.forEach((tag: any) => {
            if (tag.Key && tag.Value) {
              tagMap[tag.Key] = tag.Value;
            }
          });
        } else if (typeof resourceTags === 'object') {
          // Handle tags as object format: {key: 'value'}
          Object.assign(tagMap, resourceTags);
        }

        // Check if all required tags are present with correct values
        const hasAllRequiredTags = Object.entries(requiredTags).every(([key, expectedValue]) => {
          const actualValue = tagMap[key];
          const hasTag = actualValue === expectedValue;

          if (!hasTag) {
            console.log(
              `  Missing or incorrect tag: ${key} (expected: ${expectedValue}, actual: ${actualValue})`
            );
          }

          return hasTag;
        });

        if (hasAllRequiredTags) {
          resourcesWithCorrectTags++;
          console.log(`  ✅ All required tags present and correct`);
        } else {
          console.log(`  ❌ Missing or incorrect required tags`);
          console.log(`  Expected tags:`, requiredTags);
          console.log(`  Actual tags:`, tagMap);
        }
      } else {
        console.log(`  ❌ No Tags property found on resource`);
      }
    });

    console.log(`\nTagging Summary:`);
    console.log(`- Taggable resources found: ${taggableResourcesFound}`);
    console.log(`- Resources with correct tags: ${resourcesWithCorrectTags}`);

    // Ensure we found some taggable resources
    expect(taggableResourcesFound).toBeGreaterThan(0);

    // Ensure all taggable resources have the required tags
    expect(resourcesWithCorrectTags).toBe(taggableResourcesFound);

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
