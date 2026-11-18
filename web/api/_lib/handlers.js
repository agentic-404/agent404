// Pure handler logic for the Bounty Board API.
//
// Every handler takes a plain request object { method, query, body, ip }
// and returns { status, headers?, json }. The Vercel functions in
// web/api/*.js are thin wrappers that build the real store + chain reader
// and adapt req/res to this shape; the local test (web/api/test-local.mjs)
// calls these handlers directly with a memory store and a fake chain.
//
// Dependencies (injected so the logic is testable without Vercel or BSC):
//   store: { getBounty, listBounties, putBounty, listSubmissions, putSubmission }
//   chain: { deployed, address, getBounty(id), getSubmissions(id) }

import { CATEGORIES } from './config.js';
import { keccak256Hex } from './hash.js';
import { BadInput, validateBountyBody, validateSubmissionBody, parseBountyId } from './validate.js';
import { checkPostRateLimit } from './rateLimit.js';
import { ChainUnavailable } from './chain.js';

function errJson(status, message, extra = {}) {
  return { status, json: { error: message, ...extra } };
}

function methodNotAllowed(allowed) {
  return {
    status: 405,
    headers: { Allow: allowed.join(', ') },
    json: { error: `Method not allowed. Allowed: ${allowed.join(', ')}.` },
  };
}

/** Merge on-chain state into a stored bounty (best-effort for GETs). */
async function withOnChain(chain, record) {
  if (!chain.deployed) return { ...record, onChain: null, hashMatch: null };
  try {
    const onChain = await chain.getBounty(record.bountyId);
    if (!onChain || !onChain.exists) {
      return { ...record, onChain: null, hashMatch: false };
    }
    return {
      ...record,
      onChain,
      hashMatch: keccak256Hex(record.description) === onChain.descriptionHash,
    };
  } catch {
    return { ...record, onChain: null, hashMatch: null };
  }
}

export function createHandlers({ store, chain }) {
  // ------------------------------------------------------------------
  // GET /api/bounties  +  POST /api/bounties
  // ------------------------------------------------------------------
  async function handleBounties(req) {
    if (req.method === 'GET') {
      try {
        const records = await store.listBounties();
        const merged = [];
        for (const record of records) merged.push(await withOnChain(chain, record));
        return { status: 200, json: { bounties: merged, contractDeployed: chain.deployed } };
      } catch (err) {
        return mapError(err);
      }
    }

    if (req.method === 'POST') {
      try {
        checkPostRateLimit(req.ip);
        const fields = validateBountyBody(req.body);

        const existing = await store.getBounty(fields.bountyId);
        if (existing) {
          return errJson(409, `Bounty ${fields.bountyId} is already registered on the board.`);
        }

        const descriptionHash = keccak256Hex(fields.description);
        let verified = false;
        let verification = 'contract-not-deployed';
        let onChain = null;

        if (chain.deployed) {
          // Contract exists: verification is MANDATORY. A hash mismatch or
          // a bounty that does not exist on-chain is rejected, never stored.
          onChain = await chain.getBounty(fields.bountyId);
          if (!onChain || !onChain.exists) {
            return errJson(
              400,
              `Bounty ${fields.bountyId} does not exist on-chain yet. Create it on-chain first (createBounty), then register its text here.`,
            );
          }
          if (onChain.category !== fields.category) {
            return errJson(
              400,
              `Category mismatch: on-chain category is ${onChain.category} (${onChain.categoryName}), but the request says ${fields.category}.`,
            );
          }
          if (descriptionHash !== onChain.descriptionHash) {
            return errJson(
              400,
              `Description hash mismatch: keccak256(description) is ${descriptionHash}, but the on-chain descriptionHash is ${onChain.descriptionHash}. The text must be exactly the text hashed at creation.`,
            );
          }
          verified = true;
          verification = 'hash-match';
        }

        const record = {
          bountyId: fields.bountyId,
          title: fields.title,
          description: fields.description,
          category: fields.category,
          categoryName: CATEGORIES[fields.category],
          createdAt: new Date().toISOString(),
          verified,
          verification,
        };
        await store.putBounty(record);
        const merged = onChain
          ? { ...record, onChain, hashMatch: true }
          : { ...record, onChain: null, hashMatch: chain.deployed ? false : null };
        return { status: 201, json: { bounty: merged } };
      } catch (err) {
        return mapError(err);
      }
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  // ------------------------------------------------------------------
  // GET /api/bounties/:id
  // ------------------------------------------------------------------
  async function handleBounty(req) {
    if (req.method !== 'GET') return methodNotAllowed(['GET']);
    try {
      const bountyId = parseBountyId(req.query.id);
      const record = await store.getBounty(bountyId);
      if (!record) return errJson(404, `Bounty ${bountyId} is not registered on the board.`);
      const merged = await withOnChain(chain, record);
      return { status: 200, json: { bounty: merged, contractDeployed: chain.deployed } };
    } catch (err) {
      return mapError(err);
    }
  }

  // ------------------------------------------------------------------
  // GET /api/bounties/:id/submissions  +  POST /api/bounties/:id/submissions
  // ------------------------------------------------------------------
  async function handleSubmissions(req) {
    if (req.method === 'GET') {
      try {
        const bountyId = parseBountyId(req.query.id);
        const bounty = await store.getBounty(bountyId);
        if (!bounty) return errJson(404, `Bounty ${bountyId} is not registered on the board.`);
        const stored = await store.listSubmissions(bountyId);

        let onChainSubs = null;
        if (chain.deployed) {
          try {
            onChainSubs = await chain.getSubmissions(bountyId);
          } catch {
            onChainSubs = null; // best-effort on GETs
          }
        }

        const submissions = stored.map((sub, i) => {
          const oc = onChainSubs ? onChainSubs[i] || null : null;
          return {
            ...sub,
            onChain: oc,
            proofHashMatch: chain.deployed ? (oc ? oc.proofHash === sub.proofHash : false) : null,
          };
        });
        return { status: 200, json: { bountyId, submissions, contractDeployed: chain.deployed } };
      } catch (err) {
        return mapError(err);
      }
    }

    if (req.method === 'POST') {
      try {
        checkPostRateLimit(req.ip);
        const bountyId = parseBountyId(req.query.id);
        const fields = validateSubmissionBody(req.body);

        const bounty = await store.getBounty(bountyId);
        if (!bounty) return errJson(404, `Bounty ${bountyId} is not registered on the board.`);

        const existing = await store.listSubmissions(bountyId);
        if (existing.some((s) => s.workerAgentId === fields.workerAgentId)) {
          return errJson(
            409,
            `Worker ${fields.workerAgentId} has already submitted work for bounty ${bountyId} (one submission per worker).`,
          );
        }

        const proofHash = keccak256Hex(fields.proof);
        let verified = false;
        let verification = 'contract-not-deployed';

        if (chain.deployed) {
          // Contract exists: the proof must match an on-chain submission.
          const onChain = await chain.getBounty(bountyId);
          if (!onChain || !onChain.exists) {
            return errJson(400, `Bounty ${bountyId} does not exist on-chain.`);
          }
          if (onChain.status !== 0) {
            return errJson(
              400,
              `Bounty ${bountyId} is not Open on-chain (status: ${onChain.statusName}). Submissions are closed.`,
            );
          }
          const onChainSubs = await chain.getSubmissions(bountyId);
          const match = (onChainSubs || []).find((s) => s.proofHash === proofHash);
          if (!match) {
            return errJson(
              400,
              `Proof hash mismatch: no on-chain submission for bounty ${bountyId} has proofHash ${proofHash}. Submit the work on-chain first (submitWork), then register it here with the exact same proof text.`,
            );
          }
          verified = true;
          verification = 'hash-match';
        }

        const submission = {
          bountyId,
          workerAgentId: fields.workerAgentId,
          proof: fields.proof,
          proofHash,
          submittedAt: new Date().toISOString(),
          verified,
          verification,
        };
        await store.putSubmission(bountyId, submission);
        return { status: 201, json: { submission: { ...submission, onChain: null, proofHashMatch: chain.deployed ? true : null } } };
      } catch (err) {
        return mapError(err);
      }
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  return { handleBounties, handleBounty, handleSubmissions };
}

function mapError(err) {
  if (err instanceof BadInput) return errJson(400, err.message);
  if (err && err.name === 'RateLimited') {
    return {
      status: 429,
      headers: { 'Retry-After': String(err.retryAfterSeconds || 60) },
      json: { error: err.message, retryAfterSeconds: err.retryAfterSeconds || 60 },
    };
  }
  if (err instanceof ChainUnavailable) return errJson(503, err.message);
  if (err && err.status === 500) return errJson(500, err.message);
  // eslint-disable-next-line no-console
  console.error('Bounty API error:', err);
  return errJson(500, 'Internal error. Try again later.');
}
