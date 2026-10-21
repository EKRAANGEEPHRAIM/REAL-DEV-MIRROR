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

export type Project = Schemas['ProjectResponseDto'];
export type ProjectStatus = Schemas['ProjectResponseDto']['status'];
export type ProjectTag = Schemas['ProjectTagDto'];
export type ProjectProgress = Schemas['ProjectProgressDto'];
export type CreateProjectRequest = Schemas['CreateProjectDto'];
export type UpdateProjectRequest = Schemas['UpdateProjectDto'];
export type ProjectListQuery = NonNullable<
  operations['ProjectsController_findAll']['parameters']['query']
>;

export type Tag = Schemas['TagResponseDto'];
export type TagUsage = Schemas['TagUsageDto'];
export type CreateTagRequest = Schemas['CreateTagDto'];
export type UpdateTagRequest = Schemas['UpdateTagDto'];

/** Format commun des erreurs de l'API. */
export type ApiErrorBody = Schemas['ErrorResponseDto'];
export type PaginationMeta = Schemas['PaginationMetaDto'];
/** Réponse des listes paginées : `{ data, meta }`. */
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}
