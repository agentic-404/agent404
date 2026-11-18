// Read-only BSC chain reader for the Bounty Agents Board API.
//
// Reads the BountyEscrow contract with plain eth_call over the PUBLIC BSC
// JSON-RPC endpoints (same list as web/src/config.js RPCS). No API key,
// no Alchemy, no ethers dependency — the two views we need are decoded by
// hand from their 32-byte ABI words.
//
// - bounties(uint256) / getBounty(uint256): 7 words
//   (creator, category, status, prize, deadline, descriptionHash, submissionCount)
// - getSubmissions(uint256): offset word, length word, then N x 3 words
//   (worker, proofHash, submittedAt)
//
// Any RPC failure on every endpoint throws ChainUnavailable. GET endpoints
// degrade to onChain: null on that error; POST verification treats it as a
// hard failure (503) when the contract is deployed, because storing an
// unverified record while the contract exists would break the integrity rule.

import { BOUNTY_ESCROW_ADDRESS, RPCS, SEL, STATUSES, CATEGORIES } from './config.js';

export class ChainUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'ChainUnavailable';
    this.status = 503;
  }
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function encodeUint256(n) {
  return BigInt(n).toString(16).padStart(64, '0');
}

function wordAt(hex, i) {
  return hex.slice(2 + i * 64, 2 + (i + 1) * 64);
}

function wordToBigInt(hex, i) {
  return BigInt(`0x${wordAt(hex, i)}`);
}

/** Exact wei -> BNB decimal string (no floating point). */
function weiToBnb(wei) {
  const s = wei.toString().padStart(19, '0');
  const whole = s.slice(0, -18) || '0';
  const frac = s.slice(-18).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

async function ethCall(to, data) {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_call',
    params: [{ to, data }, 'latest'],
  });
  let lastError = null;
  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || 'RPC error');
      if (typeof json.result !== 'string') throw new Error('RPC returned no result');
      return json.result;
    } catch (err) {
      lastError = err;
    }
  }
  throw new ChainUnavailable(
    `All ${RPCS.length} public BSC RPC endpoints failed to answer an eth_call (${lastError ? lastError.message : 'unknown error'}).`,
  );
}

function decodeBountyWords(result) {
  // Expect 7 x 32-byte words = 448 hex chars after 0x.
  if (!result || result.length < 2 + 7 * 64) {
    throw new ChainUnavailable('Contract returned a short/malformed bounties() response.');
  }
  const creator = `0x${wordAt(result, 0).slice(-40)}`.toLowerCase();
  return {
    creator,
    exists: creator !== ZERO_ADDRESS,
    category: Number(wordToBigInt(result, 1)),
    categoryName: CATEGORIES[Number(wordToBigInt(result, 1))] ?? 'Unknown',
    status: Number(wordToBigInt(result, 2)),
    statusName: STATUSES[Number(wordToBigInt(result, 2))] ?? 'Unknown',
    prizeWei: wordToBigInt(result, 3).toString(),
    prizeBnb: weiToBnb(wordToBigInt(result, 3)),
    deadline: Number(wordToBigInt(result, 4)),
    deadlineISO: new Date(Number(wordToBigInt(result, 4)) * 1000).toISOString(),
    descriptionHash: `0x${wordAt(result, 5)}`.toLowerCase(),
    submissionCount: Number(wordToBigInt(result, 6)),
  };
}

function decodeSubmissions(result) {
  if (!result || result.length < 2 + 2 * 64) return [];
  const count = Number(wordToBigInt(result, 1));
  const subs = [];
  for (let i = 0; i < count; i += 1) {
    const base = 2 + i * 3; // words after offset+length
    if (result.length < 2 + (base + 3) * 64) break;
    subs.push({
      worker: `0x${wordAt(result, base).slice(-40)}`.toLowerCase(),
      proofHash: `0x${wordAt(result, base + 1)}`.toLowerCase(),
      submittedAt: Number(wordToBigInt(result, base + 2)),
      submittedAtISO: new Date(Number(wordToBigInt(result, base + 2)) * 1000).toISOString(),
    });
  }
  return subs;
}

/**
 * Live chain reader. `deployed` is false while BOUNTY_ESCROW_ADDRESS is
 * unset — every method then returns null and no RPC call is made.
 */
export function createChainReader(address = BOUNTY_ESCROW_ADDRESS) {
  const deployed = address !== null;
  return {
    deployed,
    address,

    /** On-chain bounty state, or null when the contract is not deployed. */
    async getBounty(bountyId) {
      if (!deployed) return null;
      const result = await ethCall(address, SEL.bounties + encodeUint256(bountyId));
      return decodeBountyWords(result);
    },

    /** On-chain submissions (in submission order), or null when not deployed. */
    async getSubmissions(bountyId) {
      if (!deployed) return null;
      const result = await ethCall(address, SEL.getSubmissions + encodeUint256(bountyId));
      return decodeSubmissions(result);
    },
  };
}

/** Chain reader that always reports "contract not deployed". Used by the
 *  local test and by any environment without BOUNTY_ESCROW_ADDRESS. */
export function createNullChain() {
  return {
    deployed: false,
    address: null,
    async getBounty() {
      return null;
    },
    async getSubmissions() {
      return null;
    },
  };
}
