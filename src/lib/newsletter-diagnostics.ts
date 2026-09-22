export type CommentaryDiagnostics = {
  requestId: string;
  week?: number;
};

export class CommentaryDiagnosticError extends Error {
  constructor(public stage: string, public reason: string, cause?: unknown) {
    super(reason, { cause });
    this.name = "CommentaryDiagnosticError";
  }
}

function redactText(value: string) {
  let redacted = value;
  for (const key of ["OPENAI_API_KEY", "ADMIN_PASSWORD", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"]) {
    const secret = process.env[key];
    if (secret) redacted = redacted.split(secret).join("[REDACTED]");
  }
  return redacted
    .replace(/\bsk-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/((?:authorization|cookie|password|api[_-]?key|token|secret)\s*[=:]\s*)[^\r\n,;]+/gi, "$1[REDACTED]");
}

export function safeDiagnosticException(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactText(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => safeDiagnosticException(item, seen));
  const result: Record<string, unknown> = {};
  for (const key of new Set([
    ...Object.getOwnPropertyNames(value),
    ...(value instanceof Error ? ["name", "message", "stack", "cause"] : []),
  ])) {
    if (/key|token|secret|password|cookie|authorization|headers|request|config|body|env/i.test(key)) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = safeDiagnosticException((value as Record<string, unknown>)[key], seen);
    }
  }
  return result;
}

export function logCommentaryDiagnostic(
  diagnostics: CommentaryDiagnostics | undefined,
  stage: string,
  event: string,
  details: Record<string, unknown> = {},
  error?: unknown,
) {
  const entry = {
    scope: "newsletter.commentary",
    ...diagnostics,
    stage,
    event,
    ...details,
    ...(error === undefined ? {} : { exception: safeDiagnosticException(error) }),
  };
  const serialized = JSON.stringify(entry);
  if (error !== undefined || event === "failed" || event === "rejected") console.error(serialized);
  else console.info(serialized);
}

export function commentaryFailure(error: unknown, stage: string, reason: string) {
  return error instanceof CommentaryDiagnosticError ? error : new CommentaryDiagnosticError(stage, reason, error);
}

export async function diagnosticStep<T>(
  diagnostics: CommentaryDiagnostics | undefined,
  stage: string,
  reason: string,
  operation: () => Promise<T>,
  details: Record<string, unknown> = {},
): Promise<T> {
  const started = Date.now();
  logCommentaryDiagnostic(diagnostics, stage, "start", details);
  try {
    const result = await operation();
    logCommentaryDiagnostic(diagnostics, stage, "success", { ...details, durationMs: Date.now() - started });
    return result;
  } catch (error) {
    const failure = commentaryFailure(error, stage, reason);
    const httpStatus = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : undefined;
    logCommentaryDiagnostic(diagnostics, stage, "failed", { ...details, httpStatus, reason: failure.reason, durationMs: Date.now() - started }, error);
    throw failure;
  } finally {
    logCommentaryDiagnostic(diagnostics, stage, "end", { durationMs: Date.now() - started });
  }
}