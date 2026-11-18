// GET /api/bounties/:id — one bounty (store text + on-chain state merged
// where available; onChain: null while the contract is not deployed).
// See web/api/README.md for the full contract.
import { handleBounty } from '../_lib/http.js';

export default handleBounty;
