// To add a new environment, create a new const then add it to ENVIRONMENTS array
export const DEV = 'DEV';
export const TEST = 'TEST';
export const PROD = 'PROD';

export const ENVIRONMENTS = [DEV, TEST, PROD] as const;

export function getEnvironment() {
  return process.env.ENVIRONMENT;
}

export function isEnvironment(env: string) {
  return getEnvironment() === env;
}

export function validateENVIRONMENT() {
  const env = getEnvironment();
  if (!env || !ENVIRONMENTS.includes(env as any)) {
    throw new Error(`Invalid ENVIRONMENT: ${env}. Must be one of: ${ENVIRONMENTS.join(', ')}`);
  }
}
