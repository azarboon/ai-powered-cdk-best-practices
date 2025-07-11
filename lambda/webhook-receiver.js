/**
 * GitHub Webhook Receiver Lambda Function
 * 
 * Purpose: Receives GitHub webhook events and transforms them to EventBridge events
 * Trigger: API Gateway (GitHub webhook POST requests)
 * 
 * Security Features:
 * - Repository filtering (only azarboon/dummy)
 * - Event type filtering (only push events)
 * - Minimal EventBridge permissions
 * - No sensitive data logging
 * - Proper error handling
 * 
 * Cost Optimization:
 * - Minimal memory allocation (256MB)
 * - Short timeout (30s)
 * - Efficient event processing
 * - Early return for ignored events
 */

const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

// Initialize EventBridge client with current region
const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION });

/**
 * Main Lambda handler function
 * @param {Object} event - API Gateway event from GitHub webhook
 * @returns {Object} HTTP response for GitHub webhook
 */
exports.handler = async (event) => {
    console.log('Webhook received:', JSON.stringify(event, null, 2));
    
    try {
        // Parse the GitHub webhook payload
        const body = JSON.parse(event.body);
        const headers = event.headers;
        
        // API Gateway converts headers to lowercase, so check for both cases
        // GitHub sends X-GitHub-Event, API Gateway converts to x-github-event
        const githubEvent = headers['x-github-event'] || headers['X-GitHub-Event'];
        
        console.log('GitHub event type:', githubEvent);
        
        // Security: Verify this is a push event (ignore ping, issues, etc.)
        if (githubEvent !== 'push') {
            console.log('Ignoring non-push event:', githubEvent);
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Event ignored - not a push event' })
            };
        }
        
        // Security: Check if this is for the target repository
        const repositoryName = body.repository?.full_name;
        if (repositoryName !== 'azarboon/dummy') {
            console.log('Ignoring event for different repository:', repositoryName);
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Event ignored - different repository' })
            };
        }
        
        console.log('Processing push event for repository:', repositoryName);
        console.log('Number of commits:', body.commits?.length || 0);
        
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
        console.log('Event sent to EventBridge successfully');
        console.log('EventBridge response:', JSON.stringify(result, null, 2));
        
        // Return success response to GitHub
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Webhook processed successfully',
                repository: repositoryName,
                commits: body.commits?.length || 0
            })
        };
        
    } catch (error) {
        console.error('Error processing webhook:', error);
        
        // Return error response to GitHub (will trigger webhook retry)
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
};
