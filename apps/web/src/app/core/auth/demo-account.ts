/**
 * Compte de démo du portfolio : identifiants publics, données recréées par le seed de l'API
 * (`pnpm --filter @devmirror/api seed:demo`). L'API y interdit les actions sur le compte
 * lui-même (mot de passe, suppression, profil, avatar).
 */
export const DEMO_CREDENTIALS = {
  email: 'demo@devmirror.dev',
  password: 'DemoDevMirror2026',
} as const;
