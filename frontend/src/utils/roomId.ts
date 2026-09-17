/**
 * Generates a random 6-character alphanumeric room ID on the client side.
 * This is used when the user picks "Create Room" — the ID is generated here
 * and the server creates the room when the socket sends join_room with this ID.
 */
export function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  for (const byte of array) {
    id += chars[byte % chars.length];
  }
  return id;
}
