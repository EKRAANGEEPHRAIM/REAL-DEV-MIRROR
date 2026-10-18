import 'reflect-metadata';

// Lu avant .env (dotenv ne remplace pas une variable déjà définie).
// Les suites e2e enchaînent les connexions : la limitation est testée à part (rate-limit.e2e-spec.ts).
process.env.RATE_LIMIT_ENABLED = 'false';
// Jamais d'email réel depuis les tests, même si RESEND_API_KEY figure dans .env.
process.env.RESEND_API_KEY = '';
