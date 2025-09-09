import { buildConfig } from '../lib/helpers';

// @azarboon: make this test more comprehensive to catch different types of errors
describe('Validate required inputs', () => {
  test('Must throw error process.env is undefined', () => {
    expect(() => {
      buildConfig(undefined as any);
    }).toThrow('process.env object is invalid');
  });

  test('Must throw error for missing env vars', () => {
    delete process.env.AWS_REGION;
    delete process.env.ENVIRONMENT;
    delete process.env.AWS_ACCOUNT_ID;
    delete process.env.STACK_NAME;
    delete process.env.WEBHOOK_SECRET;
    delete process.env.NOTIFICATION_EMAIL;
    delete process.env.SERVICE;
    delete process.env.TEAM;
    delete process.env.COST_CENTER;

    try {
      buildConfig(process.env);
      throw new Error('Expected buildConfig to throw error for missing env vars');
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.log('this is the errorMessage' + errorMessage);
      expect(errorMessage).toContain('Missing AWS_REGION');
      expect(errorMessage).toContain('Missing AWS_ACCOUNT_ID');
      expect(errorMessage).toContain('Missing ENVIRONMENT');
      expect(errorMessage).toContain('Missing STACK_NAME');
      expect(errorMessage).toContain('Missing WEBHOOK_SECRET');
      expect(errorMessage).toContain('Missing NOTIFICATION_EMAIL');
      expect(errorMessage).toContain('Missing SERVICE');
      expect(errorMessage).toContain('Missing TEAM');
      expect(errorMessage).toContain('Missing COST_CENTER');
    }
  });
  //@azarboon: write more tests to full cover buildConfig
});
