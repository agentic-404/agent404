// Input validation for the Bounty Agents Board API.
// Every rejection is a 400 with a clear, single-sentence error message.

import { CATEGORIES, LIMITS } from './config.js';

export class BadInput extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadInput';
    this.status = 400;
  }
}

/** bountyId: an integer >= 0, accepted as a JSON number or a digit string. */
export function parseBountyId(value) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0 || !Number.isSafeInteger(value)) {
      throw new BadInput('bountyId must be a non-negative integer.');
    }
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    if (!Number.isSafeInteger(n)) {
      throw new BadInput('bountyId is too large.');
    }
    return n;
  }
  throw new BadInput('bountyId must be a non-negative integer.');
}

/** category: an integer 0-4, accepted as a JSON number or a digit string. */
export function parseCategory(value) {
  let n = value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) n = Number(value.trim());
  if (!Number.isInteger(n) || n < 0 || n >= CATEGORIES.length) {
    throw new BadInput(
      `category must be an integer 0-${CATEGORIES.length - 1} (0 Summary, 1 Coding, 2 Prediction, 3 Poster, 4 Creative).`,
    );
  }
  return n;
}

function requireString(value, field, max) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new BadInput(`${field} must be a non-empty string.`);
  }
  if (value.length > max) {
    throw new BadInput(`${field} must be at most ${max} characters (got ${value.length}).`);
  }
  return value;
}

/** title: non-empty string, at most 120 chars. Trimmed (title is not hashed). */
export function parseTitle(value) {
  const t = requireString(value, 'title', LIMITS.titleMax).trim();
  if (t.length === 0) throw new BadInput('title must be a non-empty string.');
  return t;
}

/**
 * description: non-empty string, at most 4000 chars.
 * Stored and hashed VERBATIM (no trimming) — the on-chain hash must match
 * the exact string the creator sent.
 */
export function parseDescription(value) {
  return requireString(value, 'description', LIMITS.descriptionMax);
}

/**
 * proof: non-empty string, at most 2000 chars — a URL or plain text.
 * Stored and hashed VERBATIM (no trimming), same rule as description.
 */
export function parseProof(value) {
  return requireString(value, 'proof', LIMITS.proofMax);
}

/** workerAgentId: non-empty string, at most 120 chars. Trimmed (not hashed). */
export function parseWorkerAgentId(value) {
  const w = requireString(value, 'workerAgentId', LIMITS.workerAgentIdMax).trim();
  if (w.length === 0) throw new BadInput('workerAgentId must be a non-empty string.');
  return w;
}

/** Validate a POST /api/bounties body. Returns the cleaned fields. */
export function validateBountyBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadInput('Request body must be a JSON object with bountyId, title, description and category.');
  }
  return {
    bountyId: parseBountyId(body.bountyId),
    title: parseTitle(body.title),
    description: parseDescription(body.description),
    category: parseCategory(body.category),
  };
}

/** Validate a POST /api/bounties/:id/submissions body. Returns the cleaned fields. */
export function validateSubmissionBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadInput('Request body must be a JSON object with workerAgentId and proof.');
  }
  return {
    workerAgentId: parseWorkerAgentId(body.workerAgentId),
    proof: parseProof(body.proof),
  };
}
