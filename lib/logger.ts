import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'info' : 'warn'),
  // Never emit request identity or payment/customer payloads to application logs.
  redact: {
    paths: [
      'req', 'request', 'headers', 'data', 'callbackData',
      'email', 'password', 'token', 'authorization', 'cookie',
      'apiKey', 'key', 'privateKey', 'publicKey', 'sign'
    ],
    censor: '[REDACTED]'
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
