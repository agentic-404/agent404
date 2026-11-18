// GET /api/bounties — list all bounties (store text + on-chain state merged
// where available; onChain: null while the contract is not deployed).
// POST /api/bounties — register a bounty's text after creating it on-chain.
// See web/api/README.md for the full contract.
import { handleBounties } from './_lib/http.js';

export default handleBounties;
