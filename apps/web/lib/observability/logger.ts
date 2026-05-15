type LogContext = Record<string, string | number | boolean | null | undefined>;

function write(level: "debug" | "info" | "warn" | "error", message: string, context?: LogContext) {
  const payload = {
    level,
    message,
    ...context,
    timestamp: new Date().toISOString()
  };

  // `console.debug` exists in Node 18+. In dev it's visible alongside other
  // logs; in production set LOG_LEVEL filtering at the platform layer if
  // these get noisy (Round 6 feature-gate checks are the first significant
  // emitter at this level).
  if (level === "debug") {
    console.debug(JSON.stringify(payload));
  } else {
    console[level](JSON.stringify(payload));
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context)
};
