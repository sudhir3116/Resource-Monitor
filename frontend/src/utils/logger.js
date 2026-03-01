/**
 * Conditional logging utility
 * Only logs in development mode to avoid console spam in production
 */
const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args) => {
    if (isDev) console.log(...args);
  },
  error: (...args) => {
    if (isDev) console.error(...args);
  },
  warn: (...args) => {
    if (isDev) console.warn(...args);
  },
  debug: (...args) => {
    if (isDev) console.debug(...args);
  }
};

export default logger;
