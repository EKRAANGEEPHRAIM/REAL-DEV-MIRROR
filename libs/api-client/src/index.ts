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

export type Task = Schemas['TaskResponseDto'];
export type TaskStatus = Schemas['TaskResponseDto']['status'];
export type TaskPriority = Schemas['TaskResponseDto']['priority'];
export type TaskProject = Schemas['TaskProjectDto'];
export type Subtask = Schemas['SubtaskDto'];
export type CreateTaskRequest = Schemas['CreateTaskDto'];
export type UpdateTaskRequest = Schemas['UpdateTaskDto'];
export type ReorderTasksRequest = Schemas['ReorderTasksDto'];
export type CreateSubtaskRequest = Schemas['CreateSubtaskDto'];
export type UpdateSubtaskRequest = Schemas['UpdateSubtaskDto'];
export type TaskListQuery = NonNullable<
  operations['TasksController_findAll']['parameters']['query']
>;

export type Goal = Schemas['GoalResponseDto'];
export type GoalProject = Schemas['GoalProjectDto'];
export type GoalProgress = Schemas['GoalProgressDto'];
export type Milestone = Schemas['MilestoneDto'];
export type CreateGoalRequest = Schemas['CreateGoalDto'];
export type UpdateGoalRequest = Schemas['UpdateGoalDto'];
export type CreateMilestoneRequest = Schemas['CreateMilestoneDto'];
export type UpdateMilestoneRequest = Schemas['UpdateMilestoneDto'];
export type GoalListQuery = NonNullable<
  operations['GoalsController_findAll']['parameters']['query']
>;

export type Note = Schemas['NoteResponseDto'];
export type NoteSummary = Schemas['NoteSummaryDto'];
export type NoteProject = Schemas['NoteProjectDto'];
export type NoteTag = Schemas['NoteTagDto'];
export type CreateNoteRequest = Schemas['CreateNoteDto'];
export type UpdateNoteRequest = Schemas['UpdateNoteDto'];
export type NoteListQuery = NonNullable<
  operations['NotesController_findAll']['parameters']['query']
>;

export type SearchResults = Schemas['SearchResultsDto'];
export type ProjectHit = Schemas['ProjectHitDto'];
export type TaskHit = Schemas['TaskHitDto'];
export type NoteHit = Schemas['NoteHitDto'];

export type StatsOverview = Schemas['StatsOverviewDto'];
export type StatsIndicators = Schemas['StatsIndicatorsDto'];
export type WeekCount = Schemas['WeekCountDto'];
export type StatusCount = Schemas['StatusCountDto'];
export type DueTask = Schemas['DueTaskDto'];
export type RecentNote = Schemas['RecentNoteDto'];
export type ActivityCalendar = Schemas['ActivityCalendarDto'];
export type DayCount = Schemas['DayCountDto'];

/** Format commun des erreurs de l'API. */
export type ApiErrorBody = Schemas['ErrorResponseDto'];
export type PaginationMeta = Schemas['PaginationMetaDto'];
/** Réponse des listes paginées : `{ data, meta }`. */
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}
