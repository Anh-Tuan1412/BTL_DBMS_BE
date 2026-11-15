import { createHmac } from 'node:crypto';

// A password change invalidates previously issued JWTs without exposing a
// password hash or requiring a new database column/cache-based session state.
export function sessionCredential(passwordHash: string, secret: string) {
  return createHmac('sha256', secret).update(passwordHash).digest('hex');
}
