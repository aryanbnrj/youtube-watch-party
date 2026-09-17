/**
 * Extracts a YouTube video ID from a variety of URL formats or a raw ID.
 *
 * Handles:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://www.youtube.com/embed/VIDEO_ID
 *   https://youtube.com/shorts/VIDEO_ID
 *   Raw 11-character video ID
 *
 * Returns null if no valid ID is found.
 */
export function extractVideoId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();

  // Raw video ID — 11 chars, alphanumeric + dash + underscore
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);

    // youtu.be/VIDEO_ID
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      return isValidVideoId(id) ? id : null;
    }

    // youtube.com/watch?v=VIDEO_ID
    if (url.hostname.includes('youtube.com')) {
      // Standard watch URL
      const v = url.searchParams.get('v');
      if (v && isValidVideoId(v)) return v;

      // Embed or Shorts: /embed/VIDEO_ID or /shorts/VIDEO_ID
      const pathParts = url.pathname.split('/').filter(Boolean);
      const idIndex = pathParts.findIndex((p) => p === 'embed' || p === 'shorts' || p === 'v');
      if (idIndex !== -1 && pathParts[idIndex + 1]) {
        const id = pathParts[idIndex + 1];
        if (isValidVideoId(id)) return id;
      }
    }
  } catch {
    // Not a valid URL — already handled raw ID case above
  }

  return null;
}

/** Checks if a string is a valid 11-character YouTube video ID */
export function isValidVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}
