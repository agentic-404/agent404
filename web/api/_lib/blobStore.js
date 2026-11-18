// Vercel Blob store for the Bounty Agents Board API.
//
// Durable free-tier storage: one JSON blob per bounty
// (`bounties/<id>.json`) and one JSON blob per bounty submission list
// (`bounties/<id>/submissions.json`), in the private Blob store
// `agent404-bounty-board` (store id store_poKApQxY3bnN1ilp, region iad1).
//
// The store token comes ONLY from the BLOB_READ_WRITE_TOKEN env var (set
// automatically when the store is connected to the Vercel project). It is
// NEVER hardcoded. If the env var is missing, every store call fails with
// a clear 500 — the API refuses to silently fall back to memory or disk.
//
// Store interface (also implemented by the in-memory shim in
// web/api/test-local.mjs, so handlers are testable without Vercel):
//   getBounty(id) -> record | null
//   listBounties() -> record[]            (sorted by bountyId ascending)
//   putBounty(record) -> void
//   listSubmissions(bountyId) -> submission[]
//   putSubmission(bountyId, submission) -> void   (appends)

import { put, get, list, head } from '@vercel/blob';

export class StoreUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'StoreUnavailable';
    this.status = 500;
  }
}

const BOUNTY_PREFIX = 'bounties/';

function bountyPath(bountyId) {
  return `${BOUNTY_PREFIX}${bountyId}.json`;
}

function submissionsPath(bountyId) {
  return `${BOUNTY_PREFIX}${bountyId}/submissions.json`;
}

function isNotFound(err) {
  // @vercel/blob throws BlobNotFoundError (name) / 404-ish errors.
  return (
    err &&
    (err.name === 'BlobNotFoundError' ||
      err.status === 404 ||
      /not found/i.test(err.message || ''))
  );
}

async function readJson(pathname, token) {
  try {
    const res = await get(pathname, { access: 'private', useCache: false, token });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const text = await new Response(res.stream).text();
    return JSON.parse(text);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw new StoreUnavailable(`Blob store read failed for ${pathname}: ${err.message}`);
  }
}

async function writeJson(pathname, value, token) {
  try {
    await put(pathname, JSON.stringify(value), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      token,
    });
  } catch (err) {
    throw new StoreUnavailable(`Blob store write failed for ${pathname}: ${err.message}`);
  }
}

export function createBlobStore(token = process.env.BLOB_READ_WRITE_TOKEN) {
  if (!token) {
    // Fail loudly at first use: without the token there is no durable
    // store, and silently using memory would lose bounties on restart.
    const fail = () => {
      throw new StoreUnavailable(
        'Bounty board storage is not configured: BLOB_READ_WRITE_TOKEN is missing. ' +
          'Connect the agent404-bounty-board Blob store to the Vercel project so the token is set.',
      );
    };
    return {
      getBounty: fail,
      listBounties: fail,
      putBounty: fail,
      listSubmissions: fail,
      putSubmission: fail,
    };
  }

  return {
    async getBounty(bountyId) {
      return readJson(bountyPath(bountyId), token);
    },

    async listBounties() {
      try {
        const found = [];
        let cursor;
        do {
          const page = await list({ prefix: BOUNTY_PREFIX, cursor, token });
          for (const blob of page.blobs || []) {
            // Only top-level bounties/<id>.json — skip submissions.json files.
            if (/^bounties\/\d+\.json$/.test(blob.pathname)) found.push(blob.pathname);
          }
          cursor = page.cursor;
        } while (cursor);
        const records = [];
        for (const pathname of found) {
          const record = await readJson(pathname, token);
          if (record) records.push(record);
        }
        records.sort((a, b) => a.bountyId - b.bountyId);
        return records;
      } catch (err) {
        if (err instanceof StoreUnavailable) throw err;
        throw new StoreUnavailable(`Blob store list failed: ${err.message}`);
      }
    },

    async putBounty(record) {
      await writeJson(bountyPath(record.bountyId), record, token);
    },

    async listSubmissions(bountyId) {
      const data = await readJson(submissionsPath(bountyId), token);
      return Array.isArray(data) ? data : [];
    },

    async putSubmission(bountyId, submission) {
      const existing = await readJson(submissionsPath(bountyId), token);
      const all = Array.isArray(existing) ? existing : [];
      all.push(submission);
      await writeJson(submissionsPath(bountyId), all, token);
    },

    // Used by the deploy checklist, not by any endpoint.
    async ping() {
      await head('bounties/.keep', { token }).catch((err) => {
        if (!isNotFound(err)) throw new StoreUnavailable(`Blob store unreachable: ${err.message}`);
      });
      return true;
    },
  };
}
