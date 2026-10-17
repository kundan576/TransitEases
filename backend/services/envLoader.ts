import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

let isInitialized = false;

export interface EnvDiagnostics {
  envFileExists: boolean;
  hasMongoUri: boolean;
  hasJwtSecret: boolean;
  activeSource: string;
}

export function loadEnvironment(): EnvDiagnostics {
  const rootEnvPath = path.resolve(process.cwd(), '.env');
  const parentDevEnvPath = path.resolve(process.cwd(), '../.dev.env.json');
  const localDevEnvPath = path.resolve(process.cwd(), '.dev.env.json');
  const rootAppDevEnvPath = '/app/.dev.env.json';

  let activeSource = 'process.env';
  let envFileExists = false;

  // 1. Read .env if present
  if (fs.existsSync(rootEnvPath)) {
    envFileExists = true;
    try {
      const content = fs.readFileSync(rootEnvPath, 'utf8');
      const parsed = dotenv.parse(content);
      for (const [key, value] of Object.entries(parsed)) {
        const trimmed = value.trim();
        // Only set if non-empty to avoid overriding valid process.env with empty placeholders
        if (trimmed.length > 0) {
          process.env[key] = trimmed;
          activeSource = '.env';
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // 2. Read deployment environment JSON if present as secondary source
  const candidateDevEnvPaths = [parentDevEnvPath, localDevEnvPath, rootAppDevEnvPath];
  for (const devPath of candidateDevEnvPaths) {
    if (fs.existsSync(devPath)) {
      try {
        const raw = fs.readFileSync(devPath, 'utf8');
        const data = JSON.parse(raw);
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'string' && value.trim().length > 0) {
            // Only populate if not already set by .env or process.env
            if (!process.env[key] || process.env[key]?.trim() === '') {
              process.env[key] = value.trim();
              if (activeSource === 'process.env') {
                activeSource = '.dev.env.json';
              }
            }
          }
        }
        break;
      } catch {
        // Ignore JSON read errors
      }
    }
  }

  isInitialized = true;

  const mongoUri = process.env.MONGODB_URI?.trim();
  const jwtSecret = process.env.JWT_SECRET?.trim();

  return {
    envFileExists,
    hasMongoUri: Boolean(mongoUri && (mongoUri.startsWith('mongodb://') || mongoUri.startsWith('mongodb+srv://'))),
    hasJwtSecret: Boolean(jwtSecret && jwtSecret.length > 0),
    activeSource
  };
}

export function getJwtSecret(): string {
  if (!isInitialized) {
    loadEnvironment();
  }
  return process.env.JWT_SECRET?.trim() || 'transitease_secure_jwt_secret_token_2026';
}
