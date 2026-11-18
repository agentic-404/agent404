// Vercel serverless adapter for the Bounty Agents Board API.
// Builds the real Blob store + BSC chain reader once per cold start and
// adapts Vercel's req/res to the plain { method, query, body, ip } shape
// the handlers in _lib/handlers.js work with.

import { createBlobStore } from './blobStore.js';
import { createChainReader, createNullChain } from './chain.js';
import { BOUNTY_ESCROW_ADDRESS } from './config.js';
import { createHandlers } from './handlers.js';

const store = createBlobStore();
const chain = BOUNTY_ESCROW_ADDRESS ? createChainReader() : createNullChain();
const handlers = createHandlers({ store, chain });

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function readBody(req) {
  if (req.body === undefined || req.body === null) return {};
  if (typeof req.body === 'string') {
    if (req.body.trim() === '') return {};
    try {
      return JSON.parse(req.body);
    } catch {
      return { __unparsable: true };
    }
  }
  return req.body;
}

export function adapt(handler) {
  return async (req, res) => {
    const body = readBody(req);
    if (body && body.__unparsable) {
      res.status(400).json({ error: 'Request body must be valid JSON.' });
      return;
    }
    const out = await handler({
      method: req.method,
      query: req.query || {},
      body,
      ip: clientIp(req),
    });
    if (out.headers) {
      for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
    }
    res.status(out.status).json(out.json);
  };
}

export const handleBounties = adapt(handlers.handleBounties);
export const handleBounty = adapt(handlers.handleBounty);
export const handleSubmissions = adapt(handlers.handleSubmissions);
