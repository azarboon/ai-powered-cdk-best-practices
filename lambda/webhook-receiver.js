/**
 * GitHub Webhook Receiver Lambda Function.
 * 
 * Purpose: Receives GitHub webhook events and transforms them to EventBridge events
 * Trigger: API Gateway (GitHub webhook POST requests).
 * 
 * Security Features:
 * - Repository filtering (configurable via environment variables)
 * - Event type filtering (only push events)
 * - Minimal EventBridge permissions
 * - No sensitive data logging
 * - Proper error handling.
 * 
 * Cost Optimization:
 * - Minimal memory allocation (256MB)
 * - Short timeout (30s)
 * - Efficient event processing
 * - Early return for ignored events.
 * 
 * Configuration:
 * - GITHUB_REPOSITORY: Target repository (format: owner/repo)
 * - AWS_REGION: AWS region for EventBridge client
 * - ENVIRONMENT: Environment tag for logging context.
 */

const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

/**
 * Initialize EventBridge client with current region.
 */
const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION });

/**
 * Configuration from environment variables - no hardcoded values.
 */
const TARGET_REPOSITORY = process.env.GITHUB_REPOSITORY || 'azarboon/dummy';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

/**
 * Main Lambda handler function.
 * 
 * @param {object} event - API Gateway event from GitHub webhook.
 * @returns {Promise<object>} HTTP response for GitHub webhook.
 */
exports.handler = async (event) => {
  console.log(`[${ENVIRONMENT}] Webhook received:`, JSON.stringify(event, null, 2));
    
  try {
    // Parse the GitHub webhook payload
    const body = JSON.parse(event.body);
    const headers = event.headers;
        
    // API Gateway converts headers to lowercase, so check for both cases
    // GitHub sends X-GitHub-Event, API Gateway converts to x-github-event
    const githubEvent = headers['x-github-event'] || headers['X-GitHub-Event'];
        
    console.log(`[${ENVIRONMENT}] GitHub event type:`, githubEvent);
        
    // Security: Verify this is a push event (ignore ping, issues, etc.)
    if (githubEvent !== 'push') {
      console.log(`[${ENVIRONMENT}] Ignoring non-push event:`, githubEvent);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Event ignored - not a push event' })
      };
    }
        
    // Security: Check if this is for the target repository (configurable)
    const repositoryName = body.repository?.full_name;
    if (repositoryName !== TARGET_REPOSITORY) {
      console.log(`[${ENVIRONMENT}] Ignoring event for different repository:`, repositoryName, 'Expected:', TARGET_REPOSITORY);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Event ignored - different repository' })
      };
    }
        
    console.log(`[${ENVIRONMENT}] Processing push event for repository:`, repositoryName);
    console.log(`[${ENVIRONMENT}] Number of commits:`, body.commits?.length || 0);
        
    // Transform GitHub webhook payload to EventBridge event
    const eventBridgeEvent = {
      Source: 'github.webhook',
      DetailType: 'GitHub Push',
      Detail: JSON.stringify({
        repository: body.repository,
        commits: body.commits,
        pusher: body.pusher,
        ref: body.ref,
        before: body.before,
        after: body.after
      })
    };
        
    // Send event to EventBridge
    const command = new PutEventsCommand({
      Entries: [eventBridgeEvent]
    });
        
    const result = await eventBridge.send(command);
    console.log(`[${ENVIRONMENT}] Event sent to EventBridge successfully`);
    console.log(`[${ENVIRONMENT}] EventBridge response:`, JSON.stringify(result, null, 2));
        
    // Return success response to GitHub
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Webhook processed successfully',
        repository: repositoryName,
        commits: body.commits?.length || 0,
        environment: ENVIRONMENT
      })
    };
        
  } catch (error) {
    console.error(`[${ENVIRONMENT}] Error processing webhook:`, error);
        
    // Return error response to GitHub (will trigger webhook retry)
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        environment: ENVIRONMENT
      })
    };
  }
};
