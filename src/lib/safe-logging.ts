/** Provider/Prisma messages may include URLs, submitted fields and credentials. Do not log them. */
export function safeErrorDetails(error: unknown): { category: string; code?: string } {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return { category: error instanceof Error ? "Error" : "Unknown", ...(typeof code === "string" && /^P\d{4}$/u.test(code) ? { code } : {}) };
}

export function logServerError(context: string, error: unknown): void {
  console.error(context, safeErrorDetails(error));
}
