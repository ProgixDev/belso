/**
 * Logger with automatic secret/PII redaction. AI-written code (and humans)
 * routinely log whole objects — including sessions, tokens, and headers — which
 * then leak into server logs and error trackers. This redacts sensitive keys and
 * token-shaped values before anything is emitted. Use it instead of `console.*`
 * for anything that might touch user/auth/network data. See docs/security/checklist.md (SEC-LOG-001).
 */

const SENSITIVE_KEY =
  /(token|secret|password|passwd|authorization|auth|api[-_]?key|refresh|session|cookie|credential|ssn|email|phone)/i;

const SENSITIVE_VALUE = [
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, // JWT
  /\bsk_(live|test)_[A-Za-z0-9]{8,}\b/g, // Stripe secret
  /\bsb_secret_[A-Za-z0-9_-]{8,}\b/g, // Supabase secret key
];

const REDACTED = "[redacted]";

function redactString(value: string): string {
  return SENSITIVE_VALUE.reduce((acc, re) => acc.replace(re, REDACTED), value);
}

export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((v) => redact(v, seen));

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(v, seen);
  }
  return out;
}

function emit(level: "log" | "warn" | "error", args: unknown[]): void {
  // eslint-disable-next-line no-console -- the logger is the sanctioned console wrapper
  console[level](...args.map((a) => redact(a)));
}

export const logger = {
  debug: (...args: unknown[]) => emit("log", args),
  info: (...args: unknown[]) => emit("log", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
} as const;
