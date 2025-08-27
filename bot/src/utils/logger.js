const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, json } = format;

// Format personnalisé pour la sortie console
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta, null, 2)}` : '';
  return `[${timestamp}] ${level}: ${message}${metaStr}`;
});

// Configuration des transports
const transportsList = [
  new transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      consoleFormat
    )
  }),
  new transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: combine(timestamp(), json())
  }),
  new transports.File({
    filename: 'logs/combined.log',
    format: combine(timestamp(), json())
  })
];

// Création du logger
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp(),
    json()
  ),
  transports: transportsList,
  exceptionHandlers: [
    new transports.File({ filename: 'logs/exceptions.log' })
  ],
  exitOnError: false
});

// Gestion des rejets de promesse non gérés
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = logger;
