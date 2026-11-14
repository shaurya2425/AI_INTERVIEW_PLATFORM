const localIpNotice =
  "Arcjet will use 127.0.0.1 when missing public IP address in development mode";

// Keep protection enabled locally; omit only the expected development IP notice.
// Production uses Arcjet's default logger.
export const arcjetDevelopmentLogger = process.env.NODE_ENV === "development"
  ? {
      debug: (...args) => {
        if (process.env.ARCJET_LOG_LEVEL === "debug") console.debug(...args);
      },
      info: (...args) => console.info(...args),
      warn: (...args) => {
        if (args.length === 1 && args[0] === localIpNotice) return;
        console.warn(...args);
      },
      error: (...args) => console.error(...args),
    }
  : undefined;
