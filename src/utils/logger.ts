type Level = 'info' | 'warn' | 'error'

function log(level: Level, message: string, extra?: unknown): void {
  const ts = new Date().toISOString()
  const prefix = `[${ts}] [${level.toUpperCase()}]`
  if (level === 'error') console.error(prefix, message, extra ?? '')
  else if (level === 'warn') console.warn(prefix, message, extra ?? '')
  else console.log(prefix, message, extra ?? '')
}

export const logger = {
  info: (msg: string, extra?: unknown) => log('info', msg, extra),
  warn: (msg: string, extra?: unknown) => log('warn', msg, extra),
  error: (msg: string, extra?: unknown) => log('error', msg, extra),
}
