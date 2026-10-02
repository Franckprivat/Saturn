import { getDemoConfig, isDemoEmail } from './demo.config';

describe('demo config', () => {
  it('is disabled unless DEMO_ACCOUNT_ENABLED=true', () => {
    expect(getDemoConfig({}).enabled).toBe(false);
    expect(getDemoConfig({ DEMO_ACCOUNT_ENABLED: '1' }).enabled).toBe(false);
    expect(getDemoConfig({ DEMO_ACCOUNT_ENABLED: 'true' }).enabled).toBe(true);
  });

  it('normalises the configured email', () => {
    const env = {
      DEMO_ACCOUNT_ENABLED: 'true',
      DEMO_ACCOUNT_EMAIL: ' Demo@Example.com ',
    };
    expect(getDemoConfig(env).email).toBe('demo@example.com');
    expect(isDemoEmail('DEMO@example.com', env)).toBe(true);
    expect(isDemoEmail('someone@example.com', env)).toBe(false);
  });

  it('never matches when the demo is disabled', () => {
    expect(isDemoEmail('demo@example.com', {})).toBe(false);
  });
});
