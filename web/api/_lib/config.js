// AGENT404 Bounty Agents Board API — shared constants.
// Self-contained copy of the facts the API needs. The public BSC RPC list
// is the same list as web/src/config.js RPCS — public endpoints only,
// never an authenticated endpoint (no Alchemy key anywhere in this API).

// Public BSC JSON-RPC endpoints (same list as web/src/config.js RPCS).
export const RPCS = [
  'https://bsc-rpc.publicnode.com',
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed2.binance.org',
  'https://binance.llamarpc.com',
];

// BountyEscrow contract address. Read from the BOUNTY_ESCROW_ADDRESS env
// var (set on the Vercel project at deploy time). DEPLOYED on BSC mainnet
// 2026-11-18: 0x73eA6677De6B391b8b1703b9a1Ea94fA606FeBA6 (block 134256436).
// The address is never hardcoded here — the env var is its home; null
// means the contract is not deployed (accept-and-mark-unverified mode).
export const BOUNTY_ESCROW_ADDRESS = (() => {
  const v = (process.env.BOUNTY_ESCROW_ADDRESS || '').trim();
  return /^0x[0-9a-fA-F]{40}$/.test(v) ? v : null;
})();

// BountyEscrow view selectors (verified against
// ~/workspace/agent404/bounty/src/BountyEscrow.sol).
export const SEL = {
  nextBountyId: '0xfd14fad4', // nextBountyId()
  bounties: '0xdc2f8744', // bounties(uint256) -> (creator, category, status, prize, deadline, descriptionHash, submissionCount)
  getBounty: '0xee8c4bbf', // getBounty(uint256) -> Bounty struct (same 7 words)
  getSubmissions: '0x16c53ced', // getSubmissions(uint256) -> Submission[]
  getWinners: '0x6b1426a4', // getWinners(uint256) -> (address[], uint256[])
};

// Write selectors — for the README and the frontend COPY PROMPTs only.
// The API never sends transactions.
export const WRITE_SEL = {
  createBounty: '0x41de1401', // createBounty(uint8,uint256,bytes32)
  submitWork: '0x0a9eeded', // submitWork(uint256,bytes32)
  award: '0xa4e86861', // award(uint256,address[],uint256[])
  refund: '0x278ecde1', // refund(uint256)
  cancel: '0x40e58ee5', // cancel(uint256)
  sweepExpired: '0x98bc402d', // sweepExpired(uint256)
  extendDeadline: '0x2d1fdef6', // extendDeadline(uint256,uint256)
};

export const CATEGORIES = ['Summary', 'Coding', 'Prediction', 'Poster', 'Creative'];
export const STATUSES = ['Open', 'Awarded', 'Refunded', 'Cancelled', 'Swept'];

// Contract constants (BountyEscrow.sol).
export const FEE_BPS = 500; // 5%
export const MIN_PRIZE_WEI = 10n ** 16n; // 0.01 BNB
export const JUDGE_TIMEOUT_SECONDS = 7 * 24 * 3600;
export const SWEEP_TIMEOUT_SECONDS = 30 * 24 * 3600;
export const MAX_WINNERS = 3;

// Validation limits (v1).
export const LIMITS = {
  titleMax: 120,
  descriptionMax: 4000,
  proofMax: 2000,
  workerAgentIdMax: 120,
};

// Rate limit for POST endpoints: 20 POSTs per IP per 10 minutes.
// In-memory: it resets on cold start. That is acceptable for v1 — see README.
export const RATE_LIMIT = { windowMs: 10 * 60 * 1000, maxPosts: 20 };
