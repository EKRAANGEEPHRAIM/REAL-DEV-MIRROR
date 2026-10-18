import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/** Variables d'environnement de l'API ; les valeurs par défaut servent au développement local. */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  // Conversion explicite : la conversion implicite dépend des métadonnées de type,
  // absentes quand le champ n'a pas d'annotation ou sous Vitest.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  /** Origines autorisées par CORS, séparées par des virgules. */
  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN = 'http://localhost:4200';

  /** URL poolée de Neon ; obligatoire, sans valeur par défaut. Guillemets éventuels retirés. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/^(['"])(.*)\1$/, '$2') : value,
  )
  @Matches(/^postgres(ql)?:\/\//, { message: 'DATABASE_URL doit être une URL postgresql://' })
  DATABASE_URL: string;

  /** Secret de signature des jetons d'accès (HS256) ; obligatoire, 32 caractères minimum. */
  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET doit contenir au moins 32 caractères' })
  JWT_ACCESS_SECRET: string;

  /** Durée de vie du jeton d'accès, en secondes (15 minutes). */
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  ACCESS_TOKEN_TTL_SECONDS: number = 900;

  /** Durée de vie du refresh token, en jours. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  REFRESH_TOKEN_TTL_DAYS: number = 7;
}

/** Valide `process.env` au démarrage : l'API refuse de démarrer avec une configuration invalide. */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(env);

  if (errors.length > 0) {
    const details = errors
      .map((error) => `- ${error.property} : ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Variables d'environnement invalides :\n${details}`);
  }

  return env;
}
