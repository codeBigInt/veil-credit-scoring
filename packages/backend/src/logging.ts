import pino, { type Logger } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const secretPatterns = [
  /mongodb(?:\+srv)?:\/\/([^:\s/@]+):([^@\s]+)@/gi,
  /(VEIL_BACKEND_WALLET_SEED=)[^\s]+/gi,
  /(CKB_PRIVATE_KEY=)[^\s]+/gi,
  /(password=)[^&\s]+/gi,
];

export const sanitizeText = (value: string): string =>
  secretPatterns.reduce(
    (text, pattern) =>
      text.replace(pattern, (match, prefix: string) => {
        if (match.toLowerCase().startsWith('mongodb')) {
          return match.replace(/:([^@\s]+)@/, ':<redacted>@');
        }
        return `${prefix}<redacted>`;
      }),
    value,
  );

export const safeMongoTarget = (uri: string): string => {
  try {
    const parsed = new URL(uri);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname || ''}`;
  } catch {
    return '<invalid-mongodb-uri>';
  }
};

export type LoggableError = {
  readonly name: string;
  readonly message: string;
  readonly code?: unknown;
  readonly stack?: string;
  readonly cause?: LoggableError;
};

export const toLoggableError = (error: unknown, depth = 0): LoggableError => {
  if (depth > 2) {
    return { name: 'Error', message: '[nested error omitted]' };
  }

  if (error instanceof Error) {
    const record = error as unknown as Record<string, unknown>;
    const cause = record.cause == null ? undefined : toLoggableError(record.cause, depth + 1);
    return {
      name: error.name,
      message: sanitizeText(error.message),
      code: record.code,
      stack: isProduction ? undefined : sanitizeText(error.stack ?? ''),
      cause,
    };
  }

  if (typeof error === 'object' && error != null) {
    const record = error as Record<string, unknown>;
    return {
      name: typeof record.name === 'string' ? record.name : 'Error',
      message: sanitizeText(typeof record.message === 'string' ? record.message : 'Unexpected object error'),
      code: record.code,
    };
  }

  return { name: 'Error', message: sanitizeText(String(error ?? 'Unknown error')) };
};

export const publicErrorMessage = (error: unknown): string => {
  if (!isProduction) {
    return toLoggableError(error).message;
  }
  return 'Internal server error';
};

export const createBackendLogger = (): Logger =>
  pino({
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: [
        'mongoUri',
        'walletSeed',
        'seed',
        'privateKey',
        '*.mongoUri',
        '*.walletSeed',
        '*.seed',
        '*.privateKey',
        'config.mongoUri',
        'config.walletSeed',
        'err.stack',
        'err.cause.stack',
      ],
      censor: '<redacted>',
    },
    serializers: {
      err: toLoggableError,
      error: toLoggableError,
    },
    transport: isProduction ? undefined : { target: 'pino-pretty' },
  });
