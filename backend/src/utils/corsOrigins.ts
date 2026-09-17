/**
 * Returns origins explicitly allowed via FRONTEND_URL (comma-separated).
 */
export function getAllowedOrigins(): string[] {
  return (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * In production, also allow Vercel preview/production URLs so deploys work
 * even if FRONTEND_URL was not updated in the Railway dashboard yet.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  if (getAllowedOrigins().includes(origin)) return true;

  if (
    process.env.NODE_ENV === 'production' &&
    /^https:\/\/[\w-]+\.vercel\.app$/.test(origin)
  ) {
    return true;
  }

  return false;
}
