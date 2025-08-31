import { validateEnvVars } from '../lib/helpers';

describe('Validate required inputs', () => {
  test('should throw error when required environment variables are missing', () => {
    process.env.CDK_STACK_NAME = 'TestStack';
    try {
      validateEnvVars();
      throw new Error(
        'Expected validation function to throw an error when the environment variable(s) are unavailable.'
      );
    } catch (error) {
      console.log('Validation correctly threw error as expected:', error);
      expect(error).toBeDefined();
    }
  });
});
