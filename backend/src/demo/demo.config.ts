// Compte démo partagé (recruteurs, visiteurs du portfolio).
// Activé uniquement si DEMO_ACCOUNT_ENABLED=true : identifiants publics par nature,
// donc jamais actif par défaut.

export interface DemoConfig {
  enabled: boolean;
  email: string;
  password: string;
}

export function getDemoConfig(
  env: NodeJS.ProcessEnv = process.env,
): DemoConfig {
  return {
    enabled: env.DEMO_ACCOUNT_ENABLED === 'true',
    // example.com est réservé (RFC 2606) : aucun e-mail ne peut y être livré
    email: (env.DEMO_ACCOUNT_EMAIL || 'demo@example.com').trim().toLowerCase(),
    password: env.DEMO_ACCOUNT_PASSWORD || 'saturn-demo',
  };
}

export function isDemoEmail(email: unknown, env?: NodeJS.ProcessEnv): boolean {
  const demo = getDemoConfig(env);
  return (
    demo.enabled &&
    typeof email === 'string' &&
    email.trim().toLowerCase() === demo.email
  );
}

// Routes better-auth qui permettraient de « voler » le compte partagé
// (mot de passe, e-mail, suppression) : refusées pour l'utilisateur démo.
export const DEMO_LOCKED_AUTH_PATHS = [
  '/change-password',
  '/change-email',
  '/delete-user',
  '/set-password',
  '/revoke-sessions',
  '/revoke-other-sessions',
];
