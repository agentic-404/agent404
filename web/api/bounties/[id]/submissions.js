// GET /api/bounties/:id/submissions — list submissions for a bounty.
// POST /api/bounties/:id/submissions — register a submission after
// submitting it on-chain. See web/api/README.md for the full contract.
import { handleSubmissions } from './_lib/http.js';

export default handleSubmissions;
