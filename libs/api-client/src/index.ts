// Types de l'API DevMirror. schema.d.ts est généré : ne pas le modifier à la main,
// lancer `pnpm api-client:generate` à la racine après un changement de l'API.
import type { components, operations, paths } from './schema';

export type { components, operations, paths };

type Schemas = components['schemas'];

export type User = Schemas['UserResponseDto'];
export type AuthResponse = Schemas['AuthResponseDto'];
export type LoginRequest = Schemas['LoginDto'];
export type RegisterRequest = Schemas['RegisterDto'];
export type VerifyEmailRequest = Schemas['VerifyEmailDto'];
export type ForgotPasswordRequest = Schemas['ForgotPasswordDto'];
export type ResetPasswordRequest = Schemas['ResetPasswordDto'];
export type HealthResponse = Schemas['HealthResponseDto'];
