'use strict';

const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path  = require('path');

const { combine, timestamp, printf, colorize, errors } = format;

// ── Custom log format ──────────────────────────────────────────────────────
const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return `${ts} [${level}]: ${stack || message}`;
});

// ── Rotate transport (keeps 14 days of logs) ───────────────────────────────
const fileRotateTransport = new DailyRotateFile({
  filename      : path.join(__dirname, '../logs/happyrent-%DATE%.log'),
  datePattern   : 'YYYY-MM-DD',
  maxFiles      : '14d',
  maxSize       : '20m',
  zippedArchive : true,
});

const logger = createLogger({
  level      : process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format     : combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),   // capture stack traces
    logFormat
  ),
  transports : [
    // Console transport — coloured in dev
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        errors({ stack: true }),
        logFormat
      ),
    }),
    fileRotateTransport,
  ],
  // Do NOT crash on unhandled promise rejections — just log them
  exitOnError: false,
});

module.exports = logger;
