import { randomBytes } from 'crypto';

/**
 * Generates a random 6-character alphanumeric room ID (uppercase).
 * Example: "AB12CD"
 */
export function generateRoomId(): string {
  // Use random bytes, convert to base36, take first 6 chars, uppercase
  const raw = randomBytes(4).readUInt32BE(0).toString(36).toUpperCase();
  // Pad with zeros if shorter than 6, slice to exactly 6
  return raw.padStart(6, '0').slice(0, 6);
}
