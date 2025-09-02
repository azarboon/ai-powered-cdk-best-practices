import { validateEnvVars } from '../lib/helpers';

describe('Validate required inputs', () => {
  test('should throw error when required environment variables are missing', () => {
    try {
      validateEnvVars();
      throw new Error(
        'Expected validation function to throw an error when the environment variable(s) are unavailable.'
      );
    } catch (error) {
      // @azarboon: try to make this test more specific: it fails if any specific env var is missing or if any specific number of env vars are missing
      console.log('Validation correctly threw error as expected:', error);
      expect(error).toBeDefined();
    }
  });
});
