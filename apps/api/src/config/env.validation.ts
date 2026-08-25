import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MinLength,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export enum LogLevel {
  Fatal = 'fatal',
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Trace = 'trace',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  /** Comma-separated browser origins allowed by CORS. */
  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  @IsEnum(LogLevel)
  LOG_LEVEL: LogLevel = LogLevel.Info;

  @IsString()
  @IsNotEmpty()
  @Matches(/^postgres(ql)?:\/\/.+/, {
    message: 'DATABASE_URL must be a postgresql:// connection string',
  })
  DATABASE_URL!: string;

  /** HS256 signing key for access tokens. Must be at least 32 characters. */
  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters' })
  JWT_ACCESS_SECRET!: string;

  /** Access token lifetime, as a jsonwebtoken duration string. */
  @IsString()
  @Matches(/^\d+[smhd]$/, {
    message: 'JWT_ACCESS_TTL must look like 15m, 900s, 1h or 1d',
  })
  JWT_ACCESS_TTL: string = '15m';

  /** Refresh token lifetime in whole days. */
  @IsInt()
  @Min(1)
  @Max(90)
  JWT_REFRESH_TTL_DAYS: number = 7;

  /** Directory attachment bytes are written to. Relative paths resolve from the
   *  API's working directory (apps/api). Must be writable by the process. */
  @IsString()
  @IsNotEmpty()
  UPLOAD_DIR: string = './var/uploads';

  /** Hard ceiling on a single upload, in bytes. Default 10 MiB. */
  @IsInt()
  @Min(1024)
  @Max(52_428_800)
  MAX_UPLOAD_BYTES: number = 10_485_760;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return validated;
}
