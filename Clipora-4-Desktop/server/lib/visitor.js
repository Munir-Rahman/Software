import { createHash } from 'node:crypto';
import { verifySession } from './auth.js';

// A signed, short-lived anonymous browser session keeps visitors' downloads separate.
// Never expose session tokens or put them into job URLs.
export function visitorOwner(token, secret, now = Date.now()) {
  if (!secret || !verifySession(token, secret, now)) return null;
  return createHash('sha256').update(token).digest('hex');
}

export function canAccessJob(job, owner, publicDownloads) {
  return !publicDownloads || Boolean(job?.owner && owner && job.owner === owner);
}
