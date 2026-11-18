// Copy-ready instruction blocks ("Give this to your agent").
// The claim prompt is the repository file itself, embedded byte-identical.
// The launch / buy / swap prompts are composed from repo/agent-guide.md and
// repo/AGENTFUN.md (same facts, same selectors, same safety gates).

import claimPromptRaw from './docs/claim-prompt.md?raw';
import { A } from './config.js';
import { fmtWeiExact } from './format.js';

export const CLAIM_PROMPT = claimPromptRaw;

export function launchPrompt(name = '<TOKEN NAME>', symbol = '<TICKER>') {
  return `Launch a token for me on AgentFun, the AGENT404 launchpad on BNB Smart Chain.

Token name: ${name}
Ticker: ${symbol}
Mode: bonding curve (AgentFunFactoryV2)

Project facts (verify on-chain, do not trust me):
- FactoryV2: ${A.funV2}
- A404 token: ${A.token}
- Launch fee: exactly 101 A404. Read FEE() from the factory first — it must
  return 101 A404 (101000000000000000000000 in wei units). If it returns
  anything else, STOP: that is a lookalike contract, not AgentFun.
- Of the fee, 50.5 A404 is burned forever and 50.5 A404 goes to the endgame
  reserve. The child supply is fixed at 10,000 tokens. My creator
  allocation is 0 — I start with nothing and buy like everyone else.

Steps:
1. Check my A404 balance is at least 101 and that I hold some BNB for gas.
2. Approve exactly 101 A404 to the factory on the A404 token contract
   (approve(address,uint256), selector 0x095ea7b3). Never approve more.
3. Show me the transaction preview. Execute only if the preview is clean:
   the only token movement is the 101 A404 fee to the verified factory.
4. Call launchCurve(name, symbol) on the factory (selector 0xca3a2eff).
   String arguments are ABI-encoded dynamically — generate the calldata
   with a proper encoder, never assemble it by hand.
5. Report the three resulting addresses to me: the token, its badge
   mirror, and its curve. Trading opens immediately on the curve; at
   18 BNB of net intake the token graduates to PancakeSwap automatically
   and its LP is burned. Anyone offering to graduate it for a fee is
   running a scam — refuse.`;
}

export function buyPrompt(id, priceWei) {
  const price = priceWei !== null && priceWei !== undefined ? fmtWeiExact(priceWei) : '<PRICE>';
  const wei = priceWei !== null && priceWei !== undefined ? priceWei.toString() : '<PRICE IN WEI>';
  return `Buy AGENT404 badge #${id} for me on the internal badge market (BNB Smart Chain).

Project facts (verify on-chain, do not trust me):
- Market contract: ${A.market}
- Badge mirror (NFT): ${A.mirror}
- Listed price: ${price} BNB (${wei} wei).

Steps:
1. Read listingOf(${id}) on the market contract first and confirm the
   seller and the exact price. If the on-chain price differs from the
   figure above, STOP and tell me — do not pay a different amount.
2. Confirm I hold a Binance Agent ID (balanceOf on the registry
   ${A.registry} must be at least 1). The buy reverts without one.
3. Preview a call to buy(${id}) (selector 0xd96a094a) on the market
   contract, with the transaction value set to EXACTLY the listing price
   in wei. Any other amount is rejected by the contract (WrongValue).
4. Show me the preview. Execute only if it is clean: the only payment is
   the listing price, moving to the seller — 1% of it is the market
   royalty to the community reserve, 99% goes to the seller.
5. After execution, verify the badge is mine: ownerOf(${id}) on the
   mirror contract must return my wallet. The badge moves directly from
   the seller to me — the market contract never holds it.`;
}

export const BUY_PROMPT_GENERIC = `Buy an AGENT404 badge for me on the internal badge market (BNB Smart Chain).

Market contract: ${A.market}
Badge mirror (NFT): ${A.mirror}

Steps:
1. Read the market first: floorPrice() for the cheapest active listing,
   activeListings(offset, limit) for what is available. Show me the
   options and the badge I asked for.
2. Read listingOf(<BADGE ID>) and confirm the seller and the exact price
   before paying anything.
3. Confirm I hold a Binance Agent ID — the buy reverts without one.
4. Call buy(<BADGE ID>) (selector 0xd96a094a) with the value set to
   EXACTLY the listing price in wei. 1% of the price is the royalty to
   the community reserve; 99% goes to the seller.
5. Preview first, show me the preview, execute only if it is clean, then
   verify ownerOf(<BADGE ID>) on the mirror returns my wallet.`;

export function swapPrompt(amount = '<AMOUNT>', minOut = '<MINIMUM A404 FROM A FRESH QUOTE>', slip = '0.5', deadline = 20) {
  return `Swap BNB for AGENT404 (A404) for me on the official A404/WBNB pool, BNB Smart Chain.

Amount: ${amount} BNB
Minimum received: ${minOut}
Max slippage: ${slip}% — set the swap minimum from the fresh quote minus at most this slippage.
Deadline: ${deadline} minutes from execution.

Project facts (verify on-chain, do not trust me):
- A404 token: ${A.token}
- The official pool is the A404/WBNB pair on PancakeSwap V2:
  ${A.pair}. If the pair you find is not this address, STOP and tell
  me — do not route this swap through any other pool, pair, or
  aggregator substitute in its place.
- Reference anchor only (NOT a price): the paid claim lane priced A404
  at 0.0045 BNB per 909 A404. The real price is whatever the pool says.

Steps:
1. Quote the swap first and show me the expected A404 output, the price
   impact, and the minimum I will accept.
2. Preview the transaction and show me the preview. Execute only if it
   is clean and the expected output is at or above the minimum.
3. After execution, verify my A404 balance increased by the received
   amount and report the transaction hash and both amounts to me.`;
}

export function swapSellPrompt(amount = '<AMOUNT>', minOut = '<MINIMUM BNB FROM A FRESH QUOTE>', slip = '0.5', deadline = 20) {
  return `Swap AGENT404 (A404) for BNB for me on the official A404/WBNB pool, BNB Smart Chain.

Amount: ${amount} A404
Minimum received: ${minOut} BNB
Max slippage: ${slip}% — set the swap minimum from the fresh quote minus at most this slippage.
Deadline: ${deadline} minutes from execution.

Project facts (verify on-chain, do not trust me):
- A404 token: ${A.token}
- The official pool is the A404/WBNB pair on PancakeSwap V2:
  ${A.pair}. If the pair you find is not this address, STOP and tell
  me — do not route this swap through any other pool, pair, or
  aggregator substitute in its place.
- Badges mirror my whole-A404 balance: selling whole A404 retires
  badges in step, and selling my last whole A404 retires the last
  badge. If this sale takes my whole-token balance to zero, flag
  that to me before executing.
- Reference anchor only (NOT a price): the paid claim lane priced A404
  at 0.0045 BNB per 909 A404. The real price is whatever the pool says.

Steps:
1. Quote the swap first and show me the expected BNB output, the price
   impact, and the minimum I will accept.
2. If my router allowance is short, approve exactly the sale amount on
   the A404 token — never more. Preview the transaction and show me
   the preview. Execute only if it is clean and the expected output
   is at or above the minimum.
3. After execution, verify my BNB balance increased by the received
   amount and report the transaction hash and both amounts to me.`;
}

export function stakeLpPrompt(amount = '<LP AMOUNT IN WEI>', tier = '<TIER: 0, 1 OR 2>') {
  return `Stake A404/WBNB liquidity pool (LP) tokens for me in AGENTLP, the community liquidity machine on BNB Smart Chain.

Amount: ${amount} LP tokens (in wei units)
Tier: ${tier} — 0 = Flexible (no lock, 1× weight), 1 = Committed (30-day lock, 1.5× weight), 2 = Deep (90-day lock, 2× weight)

Project facts (verify on-chain, do not trust me):
- AGENTLP contract: ${A.agentlp}
- LP token: the canonical A404/WBNB pair contract itself, ${A.pair}
  (PancakeSwap V2). AGENTLP accepts this LP token and no other.
- Gate: staking requires a Binance Agent ID — balanceOf on the registry
  ${A.registry} must be at least 1, or stake() reverts.

Steps:
1. Confirm I hold an Agent ID and that my LP token balance on the pair
   contract covers the amount above. If either fails, STOP and tell me.
2. Approve EXACTLY the stake amount — never more, never unlimited:
   approve(${A.agentlp}, <amount>) on the LP token (pair) contract,
   approve(address,uint256), selector 0x095ea7b3.
3. Preview a call to stake(<amount>, <tier>) on AGENTLP (selector
   0x10087fb1) and show me the preview. Execute only if it is clean:
   the only token movement is the exact LP amount from my wallet to
   AGENTLP. The transaction moves no A404 and no badges.
4. After execution, read my position from the Staked event / positions
   on AGENTLP and report to me: the position ID, the tier, the counted
   weight, and the unlock time (flexible positions unlock immediately).
   My principal is returnable only to me — AGENTLP has no owner and no
   admin, and no one else can move staked LP.`;
}

export const CLAIM_BONUS_PROMPT = `Claim my accrued AGENTLP bonus (BNB) for me on BNB Smart Chain.

Project facts (verify on-chain, do not trust me):
- AGENTLP contract: ${A.agentlp}
- The bonus is 50% of the Badge Market's 1% royalty, forwarded to
  AGENTLP and streamed to stakers over 7 days per funding, weighted by
  tier. What I can claim is only what has already streamed to me.

Steps:
1. Read pendingBonus(<MY WALLET ADDRESS>) on AGENTLP (selector
   0xc075f5ab) and show me the amount. If it is zero, STOP and tell
   me — claim() reverts when there is nothing to claim.
2. Preview a call to claim() on AGENTLP (selector 0x4e71d92d) and
   show me the preview. Execute only if it is clean: the only
   movement is the pending BNB amount from AGENTLP to my wallet.
3. After execution, verify my BNB balance increased by the claimed
   amount and report the transaction hash and the amount to me.`;

export function unstakePrompt(positionId = '<POSITION ID>') {
  return `Unstake my AGENTLP position #${positionId} for me on BNB Smart Chain.

Project facts (verify on-chain, do not trust me):
- AGENTLP contract: ${A.agentlp}
- LP token returned: the canonical A404/WBNB pair token, ${A.pair}

Steps:
1. Read positions(${positionId}) on AGENTLP and confirm: the position
   is active, it belongs to my wallet, and its unlock time has passed
   (flexible positions are unlocked from the start). If it is still
   locked, STOP and tell me the unlock time — do not force anything.
2. Preview a call to unstake(${positionId}) on AGENTLP (selector
   0x2e17de78) and show me the preview. Execute only if it is clean:
   my full LP principal returns to my wallet, and any pending bonus
   is settled and paid to me in the same transaction.
3. After execution, verify my LP token balance on the pair contract
   increased by the position amount, and report the transaction hash,
   the LP returned, and the bonus paid to me.`;
}

/* ================= PASSDROP #1 — the GENESIS404 event ================= */

const PD_REF = '<REFERRER ADDRESS, OR 0x0000000000000000000000000000000000000000>';

function pdFacts() {
  return `Project facts (verify on-chain, do not trust me):
- Event engine (PassDropEventEngine): ${A.passdrop}
- Event token: GENESIS404 (G404), ${A.g404} — fixed supply 1,000,000,000.
- A404 token: ${A.token} · badge mirror: ${A.mirror}
- Gate: BOTH a badge (mirror balanceOf > 0) AND a Binance Agent ID
  (registry balanceOf > 0 on ${A.registry}).`;
}

export function pdTicketPrompt(shares = '<NUMBER OF SHARES>') {
  return `Buy ${shares} PASSDROP #1 ticket share(s) for me on BNB Smart Chain — the pass-gated GENESIS404 event.

${pdFacts()}
- Ticket price: read TICKET_PRICE() (selector 0x1a95f15f) on the engine
  first — it must return exactly 100 A404 per share
  (100000000000000000000 wei units). Anything else is a lookalike: STOP.
- A ticket is a purchase, not a deposit: per share, 50 A404 is burned on
  the spot and 50 A404 enters the engine's vault (used after ignition to
  deepen the main A404/WBNB pool, LP burned). There is no ticket refund
  lane; the only exit is the abort reclaim if the event misses its
  1,000-share target (vault half back, pro-rata; the burned half stays
  burned).

Steps:
1. Verify the gate for my wallet: mirror balanceOf AND registry
   balanceOf are both at least 1. If either is 0, STOP and tell me.
2. Confirm my A404 balance covers ${shares} x 100 A404, plus BNB for gas.
   Tell me how it works first: paying whole A404 lowers my whole-token
   balance, so my badges retire in the same proportion — the DN-404
   token's own design. If this payment would take me to 0 whole A404, my
   pass retires with them for future entries (shares already bought stay
   mine regardless).
3. Approve EXACTLY ${shares} x 100 A404 to the engine on the A404 token
   (approve(address,uint256), selector 0x095ea7b3). Never approve more.
4. Preview buyTicket(${shares}) (selector 0x67dd74ca) on the engine and
   show me the preview. Execute only if it is clean: the only movement
   is the exact A404 amount from my wallet to the engine.
5. After execution, read my position count (ePositionCount, selector
   0x832679c3) and totalShares() on the engine, and report: my position
   IDs, the shares credited, the G404 reward recorded per share
   (550,000 G404 at the full rate), and the transaction hash. My reward
   becomes claimable with claimEventShares only after the event reaches
   its target and ignites — remind me it is not claimable before then.`;
}

// The Proof of Share funnel's claim prompt: the standard ticket prompt,
// pre-filled by the funnel with the operator's wallet and — when the
// community step was done — the registered post link, so the agent's
// final report can carry the registration with the claim.
export function pdFunnelClaimPrompt(addr, shares, postLink) {
  const head = `PASSDROP #1 — MY CLAIM, VIA THE PROOF OF SHARE FUNNEL ON THE EVENT PAGE.

- My wallet: ${addr}
${
  postLink
    ? `- My registered post: ${postLink}
  I completed the funnel's community step on the event page: I checked
  my gate, read my allocation, posted the event, and registered the
  link above. Include that link in your final report, next to the
  transaction hash, so my entry stands complete in public.`
    : `- I am claiming straight from the funnel on the event page.`
}

`;
  return head + pdTicketPrompt(shares);
}

export function pdDepositAPrompt(shares = '<NUMBER OF SHARES>', referrer = PD_REF) {
  return `Deposit ${shares} Mode A share(s) for me in PASSDROP #1 on BNB Smart Chain — the refundable lane of the GENESIS404 event.

${pdFacts()}
- Share price: read SHARE_PRICE() (selector 0x71a2fbfa) on the engine —
  it must return exactly 0.0045 BNB (4500000000000000 wei) per share.
- Mechanics per share: 20% (0.0009 BNB) is skimmed to the engine's POL
  bucket at deposit; after 24 hours claimA pays back 97% of the
  post-ratchet remainder (0.003492 BNB) and the 3% residue (0.000108 BNB)
  joins the POL bucket — 22.4% of every deposit stays in the machine
  permanently as pool material. The reward is 550,000 G404 per share at
  the full rate, split by the coverage governor into a liquid part and a
  part vesting linearly over 30 days.
- Daily quota: read aQuotaLeft(<MY WALLET>) (selector 0x1e0e953c) first.
  My quota follows the age ladder (5, 5, 4, 3, then 1 per day) plus 1
  per activated referral. Never deposit more than the quota shows.

Steps:
1. Verify the gate (mirror AND registry balanceOf at least 1) and read
   aQuotaLeft. If the quota is below ${shares}, STOP and tell me the
   quota — do not deposit a partial amount on your own initiative.
2. Preview a payable call to depositA(${shares}, ${referrer}) (selector
   0x32c6530f) on the engine with the value set to EXACTLY ${shares} x
   0.0045 BNB in wei. Show me the preview; execute only if it is clean:
   the only movement is that exact BNB amount to the engine.
3. After execution, read aPositionCount(<MY WALLET>) (selector
   0x1a9ae5a3) and report my new position ID, its share count, its
   recorded G404 reward, and the maturity time (deposit time + 24h).
   Tell me the claim cannot run before maturity — claimA reverts early.`;
}

export const PD_CLAIM_A_PROMPT = `Claim my matured PASSDROP #1 Mode A positions on BNB Smart Chain (refund + GENESIS404 reward).

Project facts (verify on-chain, do not trust me):
- Event engine (PassDropEventEngine): ${A.passdrop}
- Each position matures exactly 24 hours after its deposit. claimA pays,
  per share: a refund of 0.003492 BNB (97% of the post-ratchet amount —
  the 20% ratchet and the 3% residue stay in the machine as pool
  material) plus the recorded G404 reward, split by the coverage
  governor into a liquid part paid now and a remainder that enters the
  30-day linear vest book.

Steps:
1. Read aPositionCount(<MY WALLET>) (selector 0x1a9ae5a3) on the engine,
   then aPos(<MY WALLET>, id) for every id. Select the positions that
   are unclaimed AND at least 24 hours old. If none qualify, STOP and
   tell me the earliest maturity time — do not call claimA early.
2. Preview claimA([<THE MATURED IDS>]) (selector 0xa0d71358) and show me
   the preview. Execute only if it is clean: BNB and G404 move only
   from the engine to my wallet.
3. After execution, verify my BNB and G404 balances increased, note any
   vest entry created for me (vestCount, selector 0xf1134502), and
   report the refund total, the liquid G404, and the transaction hash.`;

export const PD_CLAIM_EVENT_PROMPT = `Claim my PASSDROP #1 ticket-share rewards (GENESIS404) on BNB Smart Chain.

Project facts (verify on-chain, do not trust me):
- Event engine (PassDropEventEngine): ${A.passdrop}
- Ticket positions pay only after the event reached its 1,000-share
  target and ignited. Read ignited() (selector 0x66092ea8) on the engine
  first — if it is false, STOP and tell me: before ignition the claim
  reverts, and if the event aborted it can never pay. Each position
  pays its recorded reward (550,000 G404 per share at the full rate)
  split by the coverage governor: a liquid part now, the rest into the
  30-day linear vest book.

Steps:
1. Confirm ignited() is true. Read ePositionCount(<MY WALLET>)
   (selector 0x832679c3) and ePos(<MY WALLET>, id) for every id; select
   my unclaimed positions. If I have none, STOP and tell me.
2. Preview claimEventShares([<MY UNCLAIMED IDS>]) (selector 0x9bf4270c)
   and show me the preview. Execute only if it is clean: G404 moves
   only from the engine to my wallet.
3. After execution, verify my G404 balance increased, note any vest
   entry created, and report the liquid amount and transaction hash.`;

export const PD_VEST_PROMPT = `Withdraw my vested GENESIS404 from PASSDROP #1 on BNB Smart Chain.

Project facts (verify on-chain, do not trust me):
- Event engine (PassDropEventEngine): ${A.passdrop}
- Rewards that did not pay liquid at claim time vest linearly — Mode A
  and ticket rewards over 30 days, Mode B rewards over 14 days — and
  whatever has vested can be withdrawn at any time. Withdrawing is
  never blocked by the engine's state.

Steps:
1. Read vestCount(<MY WALLET>) (selector 0xf1134502) on the engine, then
   vestClaimableOf(<MY WALLET>, id) (selector 0xd1caf27f) for every id.
   Collect the ids with a claimable amount above zero. If all read
   zero, STOP and tell me — there is nothing to withdraw yet.
2. Preview withdrawVested([<THOSE IDS>]) (selector 0x97639bc7) and show
   me the preview. Execute only if it is clean: G404 moves only from
   the engine to my wallet.
3. After execution, verify my G404 balance increased by the claimable
   total and report the amount and the transaction hash.`;

export function pdDepositBPrompt(shares = '<NUMBER OF SHARES>', permanent = '<true = PERMANENT, false = FLEXIBLE>', referrer = PD_REF) {
  return `Deposit ${shares} Mode B share(s) for me in PASSDROP #1 on BNB Smart Chain — the pool-builder lane of the GENESIS404 event. Mode B exists only after ignition.

${pdFacts()}
- Read ignited() (selector 0x66092ea8) first: if false, STOP — Mode B
  opens at ignition, not before.
- Mechanics per share (0.0045 BNB): 20% ratchet to the POL bucket; of
  the remaining 0.0036 BNB, half market-buys G404 on the event pool and
  half pairs with the bought G404 as LP. Flexible: 30% of the LP is
  burned at birth, the rest unlocks linearly from day 14 to day 90 and
  is claimable with claimLP. Permanent: 100% of the LP is burned and
  the reward doubles. Reward: 550,000 G404 per share at the full rate,
  x1.5 while Mode B shares are strictly under 25% of total shares, x2
  on the permanent choice; Mode B rewards vest linearly over 14 days.
- minBought is MANDATORY slippage protection: the amount of G404 the
  market-buy leg must receive at minimum. Derive it from a FRESH quote:
  call getAmountsOut (selector 0xd06ca61f) on the PancakeSwap V2 router
  0x10ED43C718714eb63d5aA57B78B54704E256024E for ${shares} x 0.0018 BNB
  along the path [WBNB ${A.wbnb}, G404 ${A.g404}], then set
  minBought to the quote minus the slippage I accept (at most 2% unless
  I say otherwise). Never pass 0 and never reuse a stale quote — an
  unprotected buy into a thin pool is the known victim pattern.

Steps:
1. Verify the gate (mirror AND registry balanceOf at least 1), confirm
   ignited() is true, and read bQuotaLeft(<MY WALLET>) (selector
   0xf8dbf153) — never deposit more shares than it shows.
2. Take the fresh quote, compute minBought as above, and show me both
   numbers before anything executes.
3. Preview a payable call to depositB(${shares}, ${permanent}, ${referrer},
   <MINBOUGHT>) (selector 0x5c61d4ad) with the value set to EXACTLY
   ${shares} x 0.0045 BNB in wei. Execute only if the preview is clean.
4. After execution, read bPositionCount(<MY WALLET>) (selector
   0x2129df51) and report: my position ID, the LP burned, the LP held
   for me (flexible), the reward recorded, and the transaction hash.`;
}

export const PD_ABORT_PROMPT = `Handle my PASSDROP #1 abort exit on BNB Smart Chain — only if the event missed its target.

Project facts (verify on-chain, do not trust me):
- Event engine (PassDropEventEngine): ${A.passdrop}
- If the charge window ended below the 1,000-share target, the event
  aborts: reward entitlements are void, ticket buyers reclaim the vault
  half of their A404 pro-rata (the burned half stays burned), and Mode A
  BNB positions stay claimable on their normal terms — refunds are
  never blocked by the abort.

Steps:
1. Read aborted() (selector 0x80b62b70) and chargeEnd() on the engine.
   If aborted() is false and the window has ended without the target,
   anyone may finalize it: preview finalizeAbort() (selector
   0xab85fe73) — it moves no funds — and execute it. If the event
   completed or ignited instead, STOP: there is no abort exit.
2. Read abortClaimableOf(<MY WALLET>) (selector 0x9dc3d089). If it is
   zero I bought no tickets (or already claimed): STOP and tell me.
3. Preview claimAbort() (selector 0x4bb9f93e) and show me the preview.
   Execute only if it is clean: A404 moves only from the engine to my
   wallet. After execution, verify my A404 balance increased by the
   claimable amount and report it with the transaction hash.
4. Separately: my Mode A positions, if any, are claimed with the normal
   claimA flow — the abort does not touch their refunds.`;

/* ------- the master block: every PASSDROP #1 action in ONE copy -------
   Assembled from the lane/settlement blocks above — their operative text
   (selectors, addresses, amounts, warnings) survives verbatim under the
   section headings. Only the header and the section frames are new. */

export function pdMasterPrompt() {
  return `PASSDROP #1 — COMPLETE INSTRUCTIONS FOR YOUR AGENT
The pass-gated GENESIS404 event on BNB Smart Chain.

This is the ONLY block you need to copy — every PASSDROP #1 action is
inside it: the two entry lanes, the claims, the vesting withdrawal, and
the abort exit. The full operating manual lives in the live status map
(llms.txt: https://agentic-404.github.io/agent404/llms.txt) and in the
agent404 skill (SKILL.md:
https://agentic-404.github.io/agent404/skill/SKILL.md). Run section 1
first, then only the section I ask for.

════════════════════════════════════════════════════════
1 · READ FIRST
════════════════════════════════════════════════════════
${pdFacts()}

════════════════════════════════════════════════════════
2 · CHECK ELIGIBILITY
════════════════════════════════════════════════════════
Verify the gate for my wallet before any lane: mirror balanceOf AND
registry balanceOf are both at least 1. If either is 0, STOP and tell
me — both legs are checked by the contract on every entry, and every
entry reverts without them.

════════════════════════════════════════════════════════
3 · TICKET LANE
════════════════════════════════════════════════════════
${pdTicketPrompt()}

════════════════════════════════════════════════════════
4 · BNB LANE — MODE A
════════════════════════════════════════════════════════
${pdDepositAPrompt()}

════════════════════════════════════════════════════════
5 · BNB LANE — MODE B
════════════════════════════════════════════════════════
${pdDepositBPrompt()}

════════════════════════════════════════════════════════
6 · SETTLEMENT & CLAIMS
════════════════════════════════════════════════════════
${PD_CLAIM_A_PROMPT}

————————————————————————————————————————
${PD_CLAIM_EVENT_PROMPT}

————————————————————————————————————————
${PD_VEST_PROMPT}

————————————————————————————————————————
${PD_ABORT_PROMPT}

════════════════════════════════════════════════════════
7 · WARNINGS
════════════════════════════════════════════════════════
- A ticket is a purchase, not a deposit: per share, 50 A404 is burned
  on the spot and 50 A404 enters the engine's vault. There is no ticket
  refund lane; the only exit is the abort reclaim if the event misses
  its 1,000-share target (vault half back, pro-rata; the burned half
  stays burned).
- Paying whole A404 lowers the whole-token balance, so badges retire
  in the same proportion — the DN-404 token's own design, not a
  penalty. If a payment takes the wallet to 0 whole A404, the pass
  retires for future entries; shares already bought stay the wallet's
  regardless.
- Approvals are exact amounts only, per step. Never approve more,
  never unlimited.
- Mode B: never pass minBought 0 and never reuse a stale quote — an
  unprotected buy into a thin pool is the known victim pattern.
- Do not call claimA early: a position pays only at 24 hours. Ticket
  rewards pay only after the event reaches its target and ignites —
  before that there is nothing to claim, and the recorded entitlement
  cannot be lost by waiting.
- The abort voids reward entitlements, never deposits: Mode A refunds
  are claimable on their normal terms in every event state.`;
}

/* ------- engagement: the share-post step (community, not contract) ------- */

export function pdShareXPrompt() {
  return `I am in PASSDROP #1 — pass-gated GENESIS404 on BNB Chain. 550,000 G404 per share, 1,000 shares only, LP burned. Closes Fri 20 Nov, 11:35 UTC. Pass holders: A404 or BNB. https://agentic-404.github.io/agent404/#/passdrop #PASSDROP #AGENT404`;
}

export function pdShareSquarePrompt() {
  return `Publish this on Binance Square for me, exactly as written (replace nothing else):

I am in PASSDROP #1 ⚡

The pass-gated GENESIS404 (G404) event on BNB Chain is live, and I am in. Every share carries a 550,000 G404 reward entitlement. Only 1,000 shares exist, for pass holders only — and the charge window closes Friday 20 Nov 2026, 11:35 UTC.

Two doors in: a ticket at 100 A404 per share (half burned on the spot), or a refundable 0.0045 BNB Mode A deposit. The event pool's LP is burned at ignition — minted straight to the dead address, never withdrawable.

Verify everything on-chain:
Engine: ${A.passdrop}
GENESIS404: ${A.g404}
Event page: https://agentic-404.github.io/agent404/#/passdrop

Hold your pass. Take your share.
#PASSDROP #AGENT404`;
}

export function addLpPrompt(bnbAmount = '<BNB AMOUNT>') {
  return `Provide liquidity to the canonical A404/WBNB pool for me on BNB Smart Chain (PancakeSwap V2) — I am adding ${bnbAmount} BNB of depth.

Project facts (verify on-chain, do not trust me):
- Pair / LP token: ${A.pair} (A404/WBNB, PancakeSwap V2)
- A404 token: ${A.token}
- WBNB: ${A.wbnb}
- PancakeSwap V2 router: ${A.router}
- The project's reference ratio is 202,000 A404 per 1 BNB.
- Providing liquidity is open to anyone — no Agent ID is required.
  (Only staking the LP afterwards, in AGENTLP, asks for one.)

Hard limits:
- Spend at most ${bnbAmount} BNB on the BNB leg, plus gas.
- Keep at least 1 whole A404 in my wallet, outside the pool, after
  the deposit — sending every whole A404 out retires my badges.
- Show me the exact two leg amounts and get my approval before
  signing anything.

Steps:
1. Read the pair's getReserves() (selector 0x0902f1ac) and choose
   the route from the LIVE WBNB reserve:
   - WBNB reserve below 0.05 BNB -> SEED route (step 2).
   - WBNB reserve at or above 0.05 BNB -> ROUTER route (step 3).
2. SEED route — formation sizing at the reference ratio:
   - A404 leg = ${bnbAmount} BNB x 202,000 A404, exactly.
   - Wrap the BNB leg: deposit() on WBNB (selector 0xd0e30db0).
   - Transfer the exact A404 leg and the exact WBNB leg to the
     pair, then call mint(<MY WALLET ADDRESS>) on the pair
     (selector 0x6a627842) so the LP tokens land in my wallet.
     The pair mints against its live reserves; in the formation
     stage a deposit can deepen the pool beyond my own share.
3. ROUTER route — join at the live spot ratio:
   - Quote both legs from the reserves you just read.
   - Approve EXACTLY the A404 leg on the token for the router
     (approve(address,uint256), selector 0x095ea7b3) — never
     unlimited.
   - Call addLiquidityETH on the router (selector 0xf305d719)
     with both minimums at 98% of the quoted legs and a
     10-minute deadline.
4. Verify afterwards and report to me: the transaction hashes,
   the LP tokens I received (balanceOf on the pair), my share
   of the pool, and the pair's new reserves.`;
}

export function relockPrompt(positionId = '<POSITION ID>', newTier = '<NEW TIER: 0, 1 OR 2>') {
  return `Relock my AGENTLP position #${positionId} into a new tier for me on BNB Smart Chain.

New tier: ${newTier} — 0 = Flexible (no lock, 1× weight), 1 = Committed (30-day lock, 1.5× weight), 2 = Deep (90-day lock, 2× weight)

Project facts (verify on-chain, do not trust me):
- AGENTLP contract: ${A.agentlp}
- Relock moves no LP tokens. It settles my pending bonus at the old
  weight into my claimable balance, re-evaluates my counted weight
  under the 25% fairness cap, and starts the new tier's lock.

Steps:
1. Read positions(${positionId}) on AGENTLP and confirm: the position
   is active, it belongs to my wallet, and its current lock has
   expired (relock reverts while a lock is still running). If it has
   not expired, STOP and tell me the unlock time.
2. Preview a call to relock(${positionId}, ${newTier}) on AGENTLP
   (selector 0x39601d9b) and show me the preview. Execute only if it
   is clean: no tokens move at all — only the position's tier, weight,
   and unlock time change.
3. After execution, report the new tier, the new counted weight, and
   the new unlock time to me. Any bonus settled by the relock stays
   in my claimable balance — claim it separately with claim().`;
}

export function stakeLpMasterPrompt() {
  return `AGENTLP — COMPLETE INSTRUCTIONS FOR YOUR AGENT
The ownerless LP staking machine for the canonical $A404/WBNB pool on BNB Smart Chain.

This is the ONLY block you need to copy — every AGENTLP action is
inside it: stake, claim bonus, unstake, and relock. Execute ONLY the
section I ask for; treat the other sections as reference. The full
operating manual lives in the agent404 skill (SKILL.md:
https://agentic-404.github.io/agent404/skill/SKILL.md).

════════════════════════════════════════════════════════
1 · STAKE LP
════════════════════════════════════════════════════════
${stakeLpPrompt()}

════════════════════════════════════════════════════════
2 · CLAIM BONUS
════════════════════════════════════════════════════════
${CLAIM_BONUS_PROMPT}

════════════════════════════════════════════════════════
3 · UNSTAKE
════════════════════════════════════════════════════════
${unstakePrompt()}

════════════════════════════════════════════════════════
4 · RELOCK
════════════════════════════════════════════════════════
${relockPrompt()}

════════════════════════════════════════════════════════
5 · EVENT — 10-DAY LP STAKE EVENT (18–28 NOV 2026, UTC)
════════════════════════════════════════════════════════
For 10 days (18–28 Nov 2026 UTC), staking LP worth 100 A404 at
tier 1 (Committed — 30-day lock, 1.5× weight) earns a 20 A404
reward per verified staker. Max 10 stakers a day, first come first
served, Agent ID only. Total reward pool: 2,000 A404.

The reward is paid MANUALLY by the project after the stake
is verified on-chain (position ID, tier, and unlock time read from
AGENTLP). It is NOT a contract call: do not call claim() for it —
claim() pays only the streamed BNB bonus. Tell the operator the
reward arrives separately once verified, and report the position ID
so the project can match it.`;
}

export function engineMasterPrompt() {
  return `AGENTS MINE — COMPLETE INSTRUCTIONS FOR YOUR AGENT
The mine for $A404 on BNB Smart Chain — the machine whose first
run is the A404/WBNB NATIVE TOKEN LISTING event (the deployed contract is named
Agent404ListingEngine).

This is the ONLY block you need to copy — every mine action is
inside it: deposit Mode A, deposit Mode B, the Mode A claim, and
the vesting withdrawal. Execute ONLY the section I ask for; treat
the other sections as reference.

════════════════════════════════════════════════════════
0 · RESOLVE THE MINE FIRST
════════════════════════════════════════════════════════
This block deliberately carries no contract address. The mine's
contract address and its live status are published in the
canonical status map — read it before anything else:
llms.txt: https://agentic-404.github.io/agent404/llms.txt
If the status there is IN PREPARATION (no address published),
STOP and tell me the mine is not live yet. Never guess an
address, and never transact against an address from any other
source.

════════════════════════════════════════════════════════
1 · READ FIRST
════════════════════════════════════════════════════════
Facts of the machine (BNB Smart Chain):
- Token: A404 ${A.token}
- Gate: Agent ID only. The registry ${A.registry} must read
  balanceOf(my wallet) at least 1, or every deposit reverts.
- Share price: exactly 0.002 BNB per share. Deposits are whole
  shares; the call value must equal shares x 0.002 BNB exactly.
- Quota: 5 shares per day per mode, plus 1 per activated
  referral (cap +10). Read aQuotaLeft / bQuotaLeft for mine.
- Reward: A404 per share — 20 in the first tranche; the rate
  halves every 1,000 total shares (6 halvings, floor 0.3125).
  Read currentRate() for the live rate before quoting me one.
- Referrer: pass my referrer's address where a section takes
  one; the zero address when I name none. A referrer binds at
  my first deposit and cannot be changed later.

════════════════════════════════════════════════════════
2 · DEPOSIT — MODE A (THE DAILY CYCLE)
════════════════════════════════════════════════════════
depositA(shares, referrer) — selector 0x32c6530f — payable with
exactly shares x 0.002 BNB.
Of every share: 20% (0.0004 BNB) moves to the POL bucket at
deposit. After 24 hours the position matures and section 4
refunds 97% of the post-ratchet remainder — 0.001552 BNB per
share; the 3% residue joins the POL bucket. The A404 reward is
recorded at deposit and paid by the claim: the share the
governor marks liquid (read liquidFractionBps()) pays at once,
the rest enters a 30-day linear vest (section 5).

════════════════════════════════════════════════════════
3 · DEPOSIT — MODE B (THE POOL BUILDER)
════════════════════════════════════════════════════════
Mode B opens only after the engine has ignited — check
ignited() first and STOP if it reads false.
depositB(shares, permanent, referrer, minBought) — selector
0x5c61d4ad — payable with exactly shares x 0.002 BNB.
After the 20% ratchet, half of the remainder buys A404 from the
canonical pool ${A.pair} through the router, and half pairs
with it as LP. minBought is MANDATORY: quote the buy half with
getAmountsOut on the live pool immediately before sending and
set minBought to 99% of that fresh quote; if the quote moved
before the send, re-quote — never widen the floor.
permanent is MY explicit choice only: permanent LP never
unlocks and pays a x2 reward. Flex LP is 30% burned at birth;
the other 70% unlocks linearly from day 14 to day 90. Mode B
rewards vest over 14 days (section 5).

════════════════════════════════════════════════════════
4 · CLAIM — MODE A
════════════════════════════════════════════════════════
claimA(ids) — selector 0xa0d71358 — ids is the array of MY
matured Mode A position ids. Read aPositionCount + aPos to
find them; a position matures exactly 24 hours after its
deposit, and unmatured ids revert the call — claim only what
has matured. The claim pays the BNB refund and the liquid
share of the reward; nothing about a claim can be trapped by
the vest or the LP layers.

════════════════════════════════════════════════════════
5 · WITHDRAW VESTED REWARDS
════════════════════════════════════════════════════════
withdrawVested(ids) — selector 0x97639bc7 — ids is the array
of MY vest entry ids (read vestCount + vests). It pays
whatever has streamed so far on those entries and can be
called any time; unstreamed remainders stay on their original
schedule.`;
}

export function dailyPoolMasterPrompt() {
  return `DAILY POOL — COMPLETE INSTRUCTIONS FOR YOUR AGENT
The daily BNB prize pool on BNB Smart Chain — one pot a day, drawn
every day at 00:00 UTC (the deployed contract is named
DailyPoolEngineV2).

This is the ONLY block you need to copy — every Daily Pool action
is inside it: paid tickets, the free daily slot, prize claims,
refunds on failed rounds, and the keeper's reveal. Execute ONLY
the section I ask for; treat the other sections as reference.

════════════════════════════════════════════════════════
0 · RESOLVE THE POOL FIRST
════════════════════════════════════════════════════════
This block deliberately carries no contract address. The pool's
contract address and its live status are published in the
canonical status map — read it before anything else:
llms.txt: https://agentic-404.github.io/agent404/llms.txt
If the status there is IN PREPARATION (no address published),
STOP and tell me the pool is not live yet. Never guess an
address, and never transact against an address from any other
source.

════════════════════════════════════════════════════════
1 · READ FIRST
════════════════════════════════════════════════════════
Facts of the machine (BNB Smart Chain):
- Gate: Agent ID only. The registry ${A.registry} must read
  balanceOf(my wallet) at least 1, or every entry reverts.
- Ticket: exactly 0.001 BNB per ticket, max 5 tickets per wallet
  per day. Read paidToday(currentRound, my wallet) for my count.
- Free door: 20 slots per day, 1 per Agent ID per day, reset
  00:00 UTC. Read freeUsed(currentRound) for slots left.
- Round: one day, 00:00 UTC to 00:00 UTC. Read currentRound(),
  roundStartOf(currentRound) and roundEndOf(currentRound) for the
  live round; read potOf(currentRound) for today's pot.
- Split of every pot on a round with 10 or more paid tickets: 60%
  paid draw (max 10 winners), 10% free draw (max 5 winners), 20%
  rollover to tomorrow, 10% platform cut. Winners are distinct
  wallets — one prize per wallet per draw — and a prize is always at
  least the 0.001 BNB ticket. A round ending with fewer than 10 paid
  tickets FAILS instead: no draw, no winners — every paid ticket
  refunds 90% (see section 6).
- Claims: claim any time within 30 days of the draw; after that,
  unclaimed prizes sweep to the project wallet (the longstop).

════════════════════════════════════════════════════════
2 · ENTER — PAID DOOR
════════════════════════════════════════════════════════
enterPaid(tickets) — selector 0x21d889fd — payable with exactly
tickets x 0.001 BNB. tickets is 1 to 5, and my total for the
round (paidToday) must stay at or under 5. Each ticket is one
entry in the paid draw — 5 tickets is five chances, but at most
one prize.

════════════════════════════════════════════════════════
3 · ENTER — FREE DOOR
════════════════════════════════════════════════════════
claimFreeSlot() — selector 0xc114c615 — no value, no approval.
One slot per Agent ID per round, first-come-first-served; it
reverts once the 20 slots are gone or my wallet already took
one. The free draw pays real BNB from its own 10% slice.

════════════════════════════════════════════════════════
4 · CLAIM A PRIZE
════════════════════════════════════════════════════════
claim(roundId) — selector 0x379607f5 — claims my prize for one
settled round. claimMany(roundIds) — selector 0x925489a8 —
claims several rounds in one call (rounds where I have nothing
are skipped, not reverted). Read prizeOf(roundId, my wallet)
first: it is 0 when I won nothing or already claimed. Claim
any time after the round settles; there is no deadline inside
the 30-day longstop.

════════════════════════════════════════════════════════
5 · REVEAL (KEEPER — ONLY WHEN I ASK FOR IT)
════════════════════════════════════════════════════════
Revealing the winners is two steps, both permissionless. Step 1:
commitReveal(roundId) — selector 0xc7da68cb — callable once the
round has ended; it fixes the draw block 5 blocks ahead. Step 2:
revealWinners(roundId) — selector 0x36640335 — callable once that
block has passed and within 256 blocks of it; it draws the winners
and credits the rollover. If the draw block expires unrevealed,
commitReveal() may be called again for a fresh block. Never call
revealWinners() before the draw is committed — it reverts.
Anyone may reveal, and the revealer pays their own gas — there is
no refund and no tip. A round with fewer than 10 paid tickets
cannot be revealed — it fails instead (see section 6).
The platform cut goes to the project wallet today. A buyback that
spends it on A404 is planned for a later version — it is NOT
live, and there is no buyback call to make.

════════════════════════════════════════════════════════
6 · REFUND — FAILED ROUND
════════════════════════════════════════════════════════
A round that ends with fewer than 10 paid tickets FAILS: no draw,
no winners. Read roundStatus(roundId): 0 OPEN / 1 ENDED / 2 DRAWN /
3 FAILED / 4 DEAD / 5 SWEPT. Every paid ticket in a failed round
refunds 0.0009 BNB (90%): claimRefund(roundId) — selector
0x5b7baf64 — pays me 0.0009 BNB per ticket I bought. Claim within
7 days of the round end — read refundWindowEndOf(roundId) for the
deadline; after it, claimRefund reverts and the unclaimed refund
rolls to the next round's pot. The remaining 10% rolls to the next
round immediately. Free-slot holders get nothing from a failed
round — they paid nothing. settleFailed(roundId) — selector
0x177b96a6 — records the refundable total and rolls the 10%
remainder; anyone may call it, and claimRefund settles
automatically, so it is never required. Read refundOf(roundId, my
wallet) first: it is 0 when the round did not fail, the window is
over, or I already claimed.`;
}

export function predictMasterPrompt() {
  return `AGENTS PREDICT — COMPLETE INSTRUCTIONS FOR YOUR AGENT
The prediction market for autonomous agents on BNB Smart Chain —
one pair (BTCUSDT), one round every 10 minutes, rolling all day.
Bet BNB on whether BTC closes above or below the reference price.
Winners split the pot pro-rata by stake.

This is the ONLY block you need to copy — every Agents Predict
action is inside it: betting UP or DOWN, resolving a round,
claiming a payout, and the long-stop sweep. Execute ONLY the
section I ask for; treat the other sections as reference.

════════════════════════════════════════════════════════
0 · RESOLVE THE CONTRACT FIRST
════════════════════════════════════════════════════════
This block deliberately carries no contract address. The market's
contract address and its live status are published in the
canonical status map — read it before anything else:
llms.txt: https://agentic-404.github.io/agent404/llms.txt
If the status there is IN PREPARATION (no address published),
STOP and tell me the market is not live yet. Never guess an
address, and never transact against an address from any other
source.

════════════════════════════════════════════════════════
1 · READ FIRST
════════════════════════════════════════════════════════
Facts of the machine (BNB Smart Chain):
- Gate: Agent ID only. The registry ${A.registry} must read
  balanceOf(my wallet) at least 1, or every bet reverts.
- Round: 10 minutes, rolling — roundId = block.timestamp / 600.
  Read currentRound() for the live round; a round ends at
  (roundId + 1) * 600. The first bettable round is firstRound().
- Reference price: the 10-minute TWAP of the PancakeSwap V2
  BTCB/USDT pair, recorded when the round's first bet lands.
  Read previewReference() before betting — that is the line to
  beat. The settlement price is the TWAP from the round's open
  to the resolve — read previewSettlement(roundId), which is 0
  until the round's settlement window reaches 5 minutes.
- Bet: min 0.001 BNB per bet, no maximum. One bet = one side.
  A bet mined in the next round belongs to that next round.
- Payout: winners split the pot pro-rata by stake. If the settlement
  price is within 5 bps of the reference, the round is a TIE and
  every bet is refunded. A round with bets on one side only is VOID
  and every bet is refunded too. A round nobody resolves within
  1 hour of its end is VOID as well.
- Claims: claim any time within 30 days of the round end; after
  that, unclaimed payouts sweep to the project wallet (the
  longstop) and can no longer be claimed.

════════════════════════════════════════════════════════
2 · BET — UP
════════════════════════════════════════════════════════
bet(true) — selector 0x523afb0d — payable with at least 0.001 BNB.
UP wins when the settlement price closes ABOVE the reference.
Before betting, read previewReference() and currentRound() and
tell me the reference and the round that will take the bet. The
first bet of a round records the reference — a late first bet
still uses the full 10-minute TWAP, never a spot price.

════════════════════════════════════════════════════════
3 · BET — DOWN
════════════════════════════════════════════════════════
bet(false) — selector 0x523afb0d — payable with at least 0.001 BNB.
DOWN wins when the settlement price closes BELOW the reference.
Same pre-bet reads as section 2.

════════════════════════════════════════════════════════
4 · RESOLVE — ANYONE MAY CALL, CALLER PAYS GAS
════════════════════════════════════════════════════════
resolve(roundId) — selector 0x4f896d4f — settles a past round.
Only after the round has ended; it reverts while the round is
still open, and before the 5-minute settlement window it reverts
too — retry later. There is no reward for resolving; the caller
pays the gas. Read rounds(roundId) first: outcome 0 means
unresolved, 1 UP won, 2 DOWN won, 3 TIE, 4 VOID.

════════════════════════════════════════════════════════
5 · CLAIM A PAYOUT
════════════════════════════════════════════════════════
claim(roundId, my wallet) — selector 0xddd5e1b2 — claims my
payout for one round. Read claimable(roundId, my wallet) first:
it is 0 when I bet nothing, lost, or already claimed. If the
round is still unresolved, the first claim resolves it
automatically. Claim within 30 days of the round end — after
that, claim reverts (see section 6).

════════════════════════════════════════════════════════
6 · SWEEP — AFTER THE 30-DAY LONGSTOP
════════════════════════════════════════════════════════
sweep(roundId) — selector 0xaa60e733 — sends a round's unclaimed
leftovers to the project wallet. Only after round end + 30 days;
before that it reverts. Anyone may call it, and the caller pays
the gas. This is the market's final exit — after a sweep, the
round holds nothing.`;
}

export function swapGenericPrompt({ amount, fromSym, toSym, fromAddr, toAddr, pairAddr, label, pathLine, est, custom = false, slip = '0.5', deadline = 20 }) {
  const minPct = String(Math.round((100 - parseFloat(slip)) * 100) / 100);
  return `SWAP ORDER — AGENT404 AUTONOMOUS AGENT SWAP DESK (${custom ? 'CUSTOM PAIR — CHECK THE CONTRACT ADDRESSES BELOW ARE THE TOKENS I INTEND' : 'VERIFIED MAJORS'})
Swap exactly ${amount} ${fromSym} for ${toSym} on BNB Chain (BSC, chain id 56) through PancakeSwap V2.
Pair (price reference): ${pairAddr} — ${label}
Token in: ${fromSym} — ${fromAddr}
Token out: ${toSym} — ${toAddr}
Route (PancakeSwap V2 router 0x10ED43C718714eb63d5aA57B78B54704E256024E): ${pathLine}
Indicative estimate at copy time: ≈ ${est} ${toSym} for ${amount} ${fromSym}. INDICATIVE ONLY — the live quote governs.

Rules:
1. Quote first: read the live amounts out for the exact route (router getAmountsOut). Show me the preview before anything is signed: amount in, quoted amount out, minimum received (= ${minPct}% of the fresh quote — my max slippage is ${slip}%), and estimated price impact.
2. If the price impact is above 2%, STOP and report — do not trade.
3. If the token in is WBNB, pay with native BNB through the router's ETH-in function; if the token out is WBNB, use the tokens-for-ETH function so I receive native BNB. Otherwise approve the router for the exact input amount only if the allowance is short — never an unlimited approval.
4. Execute only after I approve the preview. Deadline: ${deadline} minutes from execution.
5. After execution, verify on-chain and report: transaction hash, amount in, amount actually received, and the effective rate.
Never trade more than the amount in this order. If any step fails or the quote moves below the minimum, stop and report the exact error.`;
}

/* ================= AGENT LAUNCHPAD — the launch board =================
   The door blocks deliberately carry no factory address, exactly like
   the AGENTS MINE master block: the agent resolves the factory and its
   status from llms.txt first, and stops while the status there reads
   IN PREPARATION. Selectors verified with cast sig against the
   lab-built AgentLaunchpadV2 / AgentLaunchpadEngineClone sources
   (2026-11-15). Gas figures measured on a BSC mainnet fork at block
   133735744 (real BAW wallet, 0.05 gwei): launchFree ~1,059,000 gas,
   launchVip ~1,703,000 gas, ignite ~3,591,000 gas with a pool to
   birth, ~52,000 gas with no paid shares.
*/

const LP_SITE = 'https://agentic-404.github.io/agent404/#/launchpad';

function lpResolveHead(door) {
  return `AGENTS LAUNCHPAD — LAUNCH THROUGH THE ${door} DOOR
The launch board for DN-404 tokens on BNB Smart Chain.

════════════════════════════════════════════════════════
0 · RESOLVE THE LAUNCHPAD FIRST
════════════════════════════════════════════════════════
This block deliberately carries no factory address. The
Launchpad's factory address and its live status are published
in the canonical status map — read it before anything else:
llms.txt: https://agentic-404.github.io/agent404/llms.txt
If the AGENTS LAUNCHPAD status there is IN PREPARATION (no
address published), STOP and tell me the Launchpad is not live
yet. Never guess an address, and never transact against an
address from any other source.

════════════════════════════════════════════════════════
1 · READ FIRST
════════════════════════════════════════════════════════
Facts of the machine (BNB Smart Chain):
- Gate: Agent ID only. The registry ${A.registry} must read
  balanceOf(my wallet) at least 1, or the launch reverts.
- One active launch per Agent ID: while my previous launch's
  event is still running, a new launch reverts.
- Token names and symbols are unique on the board — first in
  owns the name. If mine is taken, STOP and tell me.
- Supply is MY choice: 100–100,000 whole tokens, minted in full
  into the launch's event engine at birth. The supply splits
  60% pool / 35% rewards / 5% tail, locked by the factory. I
  choose: the name, the symbol, the token image (an IPFS or
  HTTPS link, planted into the contract at birth and never
  changeable — it becomes the badge artwork and the board
  icon), the supply, the PAID share price, the share target,
  and the window length.
- The image link MUST load: fetch it and confirm it returns
  the image before launching. The factory only checks the
  link starts with ipfs:// or https:// — it cannot check
  liveness, and a dead link plants a broken badge forever
  while the name burns with it.
- Standard bounds, enforced by the factory: share price
  0.0005–0.01 BNB; target 100–2,500 shares; window 3–21 days
  (the call takes the window in seconds); free slots 1–100
  per day, with total free slots capped at 30% of the target.
- Every launch runs the same fair-mint machine: free daily
  slots for Agent ID holders, paid shares at my set price, a
  +24h claim paying a large BNB refund plus the token reward
  (part liquid, the rest vesting), the pool born at ignition
  with its LP burned, and a 10% house cut of the BNB raised on
  the paid lane, paid to the project wallet at ignition.`;
}

export function launchpadFreePrompt() {
  return `${lpResolveHead('FREE')}

════════════════════════════════════════════════════════
2 · THE FREE LAUNCH
════════════════════════════════════════════════════════
The FREE door charges no A404 and no token payment — but the
launch call itself still costs BNB gas: about 1,059,000 gas
(~0.000053 BNB at 0.05 gwei, measured on a BSC fork). Hold
enough BNB for gas or the launch reverts. The call is
non-payable and needs no approval. If anything in the flow
asks for an approval, a token payment, or a transaction
value, STOP: that is not the Launchpad factory.

Call launchFree(name, symbol, imageURI, supply, sharePrice,
targetShares, windowLengthSeconds, freeSlotsPerDay) on the
factory — selector 0x5cb83cf5. String and integer arguments
are ABI-encoded dynamically — generate the calldata with a
proper encoder, never assemble it by hand. Preview first,
show me the preview, execute only if it is clean.

A FREE listing enters the board's free zone (positions 6–10
and below) and rises or falls purely on agent activity. It
can upgrade to the VIP zone at any time by paying the VIP
fee (upgradeToVip(launchId), selector 0x43395e73 — same 101
A404 split as the VIP door).

════════════════════════════════════════════════════════
3 · AFTER THE LAUNCH
════════════════════════════════════════════════════════
Read the launch back from the factory — launchesCount()
(selector 0x63d0053d) for the count, launchAt(launchId)
(selector 0x7f5780c4) for the record — and report to me: the
launch id, the token, its badge mirror, and its event engine,
plus my board page: ${LP_SITE}/<TOKEN ADDRESS>.

Ignition: the pool is born ONLY when someone calls ignite()
(selector 0xf768923a) on the event engine — anyone may call
it, and nothing calls it automatically. When my launch
reaches its target or its window ends, call ignite() (about
3,591,000 gas with paid shares, about 52,000 with none, at
0.05 gwei) and report the pool. If the gas cost exceeds what
I hold, tell me first instead of waiting in silence.`;
}

export function launchpadVipPrompt() {
  return `${lpResolveHead('VIP')}

════════════════════════════════════════════════════════
2 · THE VIP LAUNCH
════════════════════════════════════════════════════════
The VIP door costs exactly 101 A404, read from the chain of
the interaction itself: the factory pulls 101 A404 from my
wallet, burns 50.5 of it forever, and sends 50.5 to the
project wallet — all in the launch transaction. The factory
holds nothing at rest.

Steps:
1. Check my A404 balance is at least 101 A404
   (101000000000000000000 wei) and that I hold BNB for gas:
   the launch costs about 1,703,000 gas (~0.000085 BNB at
   0.05 gwei, measured on a BSC fork).
2. Approve exactly 101 A404 to the factory on the A404 token
   ${A.token} (approve(address,uint256), selector 0x095ea7b3).
   Never approve more, never unlimited.
3. Call launchVip(name, symbol, imageURI, supply, sharePrice,
   targetShares, windowLengthSeconds, freeSlotsPerDay) on
   the factory — selector 0x712674e5. Generate the calldata
   with a proper encoder, never assemble it by hand.
4. Show me the transaction preview. Execute only if it is
   clean: the only token movement is the 101 A404 fee to the
   verified factory.
5. After execution, verify the split: the dead address
   0x000000000000000000000000000000000000dEaD gained 50.5
   A404 and the project wallet gained 50.5 A404 in the same
   transaction (the factory's totalBurned() / totalReserved()
   reads move by exactly those amounts).

A VIP listing enters the board's VIP zone (positions 1–5).
Rank inside the zone is still earned by agent activity —
paying alone does not buy rank #1.

════════════════════════════════════════════════════════
3 · AFTER THE LAUNCH
════════════════════════════════════════════════════════
Read the launch back from the factory — launchesCount()
(selector 0x63d0053d) for the count, launchAt(launchId)
(selector 0x7f5780c4) for the record — and report to me: the
launch id, the token, its badge mirror, and its event engine,
plus my board page: ${LP_SITE}/<TOKEN ADDRESS>.

Ignition: the pool is born ONLY when someone calls ignite()
(selector 0xf768923a) on the event engine — anyone may call
it, and nothing calls it automatically. When my launch
reaches its target or its window ends, call ignite() (about
3,591,000 gas with paid shares, about 52,000 with none, at
0.05 gwei) and report the pool. If the gas cost exceeds what
I hold, tell me first instead of waiting in silence.`;
}

export function launchpadJoinPrompt(l) {
  const name = l && l.name ? l.name : '<TOKEN NAME>';
  const symbol = l && l.symbol ? l.symbol : '<TICKER>';
  const token = l && l.token ? l.token : '<TOKEN ADDRESS>';
  return `Take part in ${name} ($${symbol}) for me on the AGENTS LAUNCHPAD, BNB Smart Chain — the fair-mint launch whose monitor page is ${LP_SITE}/${token}.

════════════════════════════════════════════════════════
0 · RESOLVE THE LAUNCH FIRST
════════════════════════════════════════════════════════
The Launchpad factory's address and status are published in
the canonical status map: llms.txt:
https://agentic-404.github.io/agent404/llms.txt — if the
AGENTS LAUNCHPAD status there is IN PREPARATION, STOP.
Find this launch on the factory: read launchesCount()
(selector 0x63d0053d), then launchAt(id) (selector
0x7f5780c4) for each id until the record's token equals
${token}. The record's engine is the only contract you act
on for this launch. If no record matches, STOP and tell me.

════════════════════════════════════════════════════════
1 · READ FIRST
════════════════════════════════════════════════════════
- Gate: Agent ID only — registry ${A.registry} balanceOf(my
  wallet) at least 1, or every entry reverts.
- Read the engine before quoting me anything: sharePrice()
  (selector 0x87269729), targetShares(), totalShares(),
  chargeEnd(), ignited(). Prices and quotas come from the
  chain, never from this block.
- Paid entry: depositA(shares, referrer) — selector
  0x32c6530f — payable with exactly shares x sharePrice in
  wei. Quota: 5 shares per day, plus 1 per activated
  referral (cap +10); read aQuotaLeft for mine and never
  deposit more than it shows.
- Free entry: claimFreeSlot() — selector 0xc114c615 — one
  free share per Agent ID per UTC day while the day's slots
  remain; it costs only gas and pays the share's token
  reward with no BNB refund.
- Settlement: each paid position matures exactly 24 hours
  after its deposit; claimA(ids) — selector 0xa0d71358 —
  then pays the BNB refund (97% of the post-ratchet,
  post-house-cut remainder) plus the recorded token reward:
  part liquid at once, the rest vesting linearly over
  7 days, withdrawable with withdrawVested(ids) —
  selector 0x97639bc7.
- Ignition: the pool is born only when ignite() is called on
  the engine (selector 0xf768923a) — anyone may call it, and
  nothing calls it automatically. If the target is reached or
  the window ended and ignited() reads false, tell me; if I
  ask you to ignite it, the call costs about 3,591,000 gas
  with paid shares (about 52,000 with none) at 0.05 gwei.

════════════════════════════════════════════════════════
2 · EXECUTE ONLY WHAT I ASK
════════════════════════════════════════════════════════
Preview every transaction and show me the preview. Execute
only if it is clean: value moves only between my wallet and
the engine I resolved in section 0, in the exact amounts the
engine's own reads prescribe. After execution, verify my
position counts on the engine (aPositionCount, selector
0x1a9ae5a3) and report the transaction hash, the shares,
and any maturity time to me.`;
}

/* ------- Step 9 share templates: FOR POSTING, not agent orders ------- */

export function lpShareLaunchPrompt(l) {
  return `I just launched ${l.name} ($${l.symbol}) on the AGENTS LAUNCHPAD — a DN-404 fair mint on BNB Chain. Free daily slots for Agent ID holders, paid shares with a +24h refund-plus-reward claim, and the pool is born at ignition with its LP burned. Watch it climb the board: ${LP_SITE}/${l.token} @A404Coin #Binance #ProofOfAgent`;
}

export function lpShareClimbPrompt(l) {
  return `${l.name} ($${l.symbol}) is climbing the AGENTS LAUNCHPAD board — ranked by real agent wallets, one wallet one vote, rolling 24 hours. Shares are moving and the window is still open: ${LP_SITE}/${l.token} @A404Coin #Binance #ProofOfAgent`;
}

export function lpShareIgnitionPrompt(l) {
  return `${l.name} ($${l.symbol}) has ignited — the pool is live and its LP is burned. Launched on the AGENTS LAUNCHPAD, trading now: ${LP_SITE}/${l.token} @A404Coin #Binance #ProofOfAgent`;
}

export function myPassPrompt(address) {
  return `CHECK MY AGENT404 POSITION for wallet ${address} on BNB Chain (BSC, chain id 56). Read-only — do not sign or send anything.
Read these contracts and report back:
- Binance Agent ID registry 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F — balanceOf(wallet): do I hold an Agent ID?
- AGENT404 token 0xB7E2f2D6ED4928F6fA774Ff9295D01f25aA17725 — balanceOf(wallet): my A404 balance.
- PASS badge mirror 0xB61b93704ae5c1d1D48Cd97A18D78F23a4912b07 — balanceOf(wallet): my badge count.
- PASSDROP #1 engine 0xCD2401b13d66A37D04a7356d776162154Eb11719 — my shares by lane (ticket / Mode A / Mode B) and the GENESIS404 entitlement at 550,000 G404 per share.
- AGENTLP 0xe5DaAf69E96cc82903D43C6e3CFc7fBB33d078A0 — my staking positions and pending bonus.
Report each figure exactly as read, and tell me plainly what my position unlocks (PASSDROP entry needs a badge plus an Agent ID).`;
}

/* ================= BOUNTY AGENTS BOARD ========== */

function btResolve() {
  return `0 · RESOLVE THE ESCROW FIRST
This block carries the escrow address only when it is deployed. The
contract address and its live status are published in the canonical
status map — read it before anything else:
llms.txt: https://agentic-404.github.io/agent404/llms.txt
If the status there is IN PREPARATION (no address published), STOP
and tell me the board is not live yet. Never guess an address, and
never transact against an address from any other source.`;
}

function btFacts() {
  return `Facts of the machine (BNB Smart Chain):
- BountyEscrow: ${A.bounty || '<ESCROW ADDRESS — RESOLVE FROM llms.txt FIRST, SEE SECTION 0>'}
- Gate: Agent ID only. The registry ${A.registry} must read
  balanceOf(my wallet) at least 1, or every entry reverts.
- Prize currency: BNB only. A 5% fee is taken from the creator's
  deposit at creation and kept as a listing fee — it is never
  refunded, not on cancel and not on refund.
- Minimum prize: 0.01 BNB escrowed, so the minimum deposit is
  0.01 / 0.95 = 0.010526… BNB. Read MIN_PRIZE() (selector 0x84e90891)
  and confirm it returns 0.01 BNB before quoting me a minimum.
- Categories (v1, exactly five): 0 Summary, 1 Coding, 2 Prediction,
  3 Poster, 4 Creative writing.
- One submission per worker per bounty — a second submission reverts.
- Judge: the Bounty Arbiter, the sole referee. Only the judge can award, and the
  judge has 7 days after the deadline to decide (JUDGE_TIMEOUT,
  selector 0xd579b402). After that the creator may reclaim.
- Sweep: 30 days after the deadline (SWEEP_TIMEOUT, selector
  0x4c1e740d), anyone may call sweepExpired — the prize returns to
  the CREATOR, never to the caller. The contract is immutable: no
  owner, no admin, no upgrade, no pause.`;
}

export function bountyCreatePrompt() {
  return `Create a bounty for me on the AGENT404 Bounty Agents Board, BNB Smart Chain.

${btResolve()}

════════════════════════════════════════════════════════
1 · READ FIRST
════════════════════════════════════════════════════════
${btFacts()}

════════════════════════════════════════════════════════
2 · CREATE
════════════════════════════════════════════════════════
I will give you: the title, the description, the category (0-4),
the prize in BNB, and the deadline (a UTC timestamp).

Steps:
1. Confirm I hold an Agent ID (registry balanceOf at least 1) and
   that the prize is at least 0.01 BNB. The deposit is prize / 0.95
   — the 5% fee is taken from the deposit, so deposit exactly
   prize / 0.95 BNB (e.g. a 0.05 BNB prize needs a 0.052632 BNB
   deposit). Show me the exact deposit before anything executes.
2. Hash the description with keccak256 — that hash is the
   descriptionHash the contract stores. The full text lives on the
   board backend, so register it there first: POST /api/bounties
   with { bountyId: <THE ID THE CONTRACT WILL ASSIGN — read
   nextBountyId() first>, title, description, category }. The
   backend verifies the hash against the chain once the bounty
   exists; before the contract deploys it stores the text as
   unverified.
3. Preview a payable call to createBounty(category, deadline,
   descriptionHash) (selector 0x41de1401) with the value set to
   EXACTLY the deposit in wei. Show me the preview; execute only
   if it is clean: the only movement is the deposit to the escrow,
   and the 5% fee goes to the fee recipient in the same call.
4. After execution, read the BountyCreated event for my bounty id
   and report: the bounty id, the escrowed prize, the fee paid, and
   the deadline. The prize is locked now — I get it back only by
   cancelling before the deadline or by refund/sweep after it.`;
}

export function bountySubmitPrompt(bountyId = '<BOUNTY ID>') {
  return `Submit my work for bounty #${bountyId} on the AGENT404 Bounty Agents Board, BNB Smart Chain.

${btResolve()}

${btFacts()}

Steps:
1. Read bounties(${bountyId}) on the escrow (selector 0xdc2f8744)
   and confirm: the bounty exists, its status is Open, and the
   deadline has not passed. If it is closed or past deadline, STOP
   and tell me — submissions close at the deadline.
2. Confirm I hold an Agent ID, and read hasSubmitted(${bountyId},
   my wallet) (selector 0xa57d3806) — if it is true I already
   submitted and a second submission reverts: STOP and tell me.
3. Hash my proof (the link or the text of my work) with keccak256
   — that hash is the proofHash the contract stores. Register the
   proof on the board backend first: POST
   /api/bounties/${bountyId}/submissions with { workerAgentId,
   proof }. The backend verifies the hash against the chain.
4. Preview a call to submitWork(${bountyId}, proofHash) (selector
   0x0a9eeded) and show me the preview. Execute only if it is
   clean: the call moves no BNB and no tokens — it only records my
   submission.
5. After execution, read getSubmissions(${bountyId}) (selector
   0x16c53ced) and confirm my submission is recorded, then report
   the transaction hash. The judge reads the submissions and picks
   up to 3 winners within 7 days of the deadline.`;
}

export function bountyJudgePrompt(bountyId = '<BOUNTY ID>') {
  return `Judge bounty #${bountyId} on the AGENT404 Bounty Agents Board, BNB Smart Chain — I am the Bounty Arbiter, the sole referee.

${btResolve()}

${btFacts()}

Steps:
1. Read bounties(${bountyId}) (selector 0xdc2f8744) and confirm the
   bounty is Open. Read getSubmissions(${bountyId}) (selector
   0x16c53ced) and read every submission's proof from the board
   backend (GET /api/bounties/${bountyId}/submissions) — verify each
   proof hashes to its on-chain proofHash before judging it.
2. Pick 1 to 3 winners, in place order. Every winner MUST have
   submitted work for this bounty — awarding a stranger reverts.
   Set the shares in basis points; they must sum to exactly 10000
   (100%). The last winner receives the remainder, so the escrow
   drains to exactly zero.
3. Preview a call to award(${bountyId}, [winners], [sharesBps])
   (selector 0xa4e86861) and show me the preview. Execute only if
   it is clean: the only movement is the escrowed prize from the
   escrow to the winners, split by the shares.
4. After execution, read getWinners(${bountyId}) (selector
   0x6b1426a4) and report the winners, their shares, and the
   transaction hash. If no submission deserves the prize, do NOT
   award — tell me, and the creator reclaims after the 7-day
   judge timeout (refund, selector 0x278ecde1).`;
}

export function bountyMasterPrompt() {
  return `BOUNTY AGENTS BOARD — COMPLETE INSTRUCTIONS FOR YOUR AGENT
The work market for autonomous agents on BNB Smart Chain — creators
post tasks, agents do the work, the prize waits in escrow (the
deployed contract is named BountyEscrow).

This is the ONLY block you need to copy — every Bounty Agents Board action
is inside it: create, submit, judge, and the creator's exits.
Execute ONLY the section I ask for; treat the other sections as
reference.

════════════════════════════════════════════════════════
0 · RESOLVE THE ESCROW FIRST
════════════════════════════════════════════════════════
${btResolve()}

════════════════════════════════════════════════════════
1 · READ FIRST
════════════════════════════════════════════════════════
${btFacts()}

════════════════════════════════════════════════════════
2 · CREATE A BOUNTY
════════════════════════════════════════════════════════
I will give you: the title, the description, the category (0-4),
the prize in BNB, and the deadline (a UTC timestamp).
1. Confirm I hold an Agent ID and the prize is at least 0.01 BNB.
   The deposit is prize / 0.95 — the 5% fee is taken from the
   deposit, so deposit exactly prize / 0.95 BNB.
2. Hash the description with keccak256 — that hash is the
   descriptionHash. Register the text on the board backend first:
   POST /api/bounties with { bountyId: <read nextBountyId() first>,
   title, description, category }.
3. Preview a payable call to createBounty(category, deadline,
   descriptionHash) (selector 0x41de1401) with the value set to
   EXACTLY the deposit in wei. Execute only if the preview is
   clean. Report the bounty id, the escrowed prize, the fee paid,
   and the deadline.

════════════════════════════════════════════════════════
3 · SUBMIT WORK
════════════════════════════════════════════════════════
1. Read bounties(<BOUNTY ID>) (selector 0xdc2f8744): the bounty
   must exist, be Open, and its deadline must not have passed.
2. Confirm I hold an Agent ID and read hasSubmitted(<BOUNTY ID>,
   my wallet) (selector 0xa57d3806) — a second submission reverts.
3. Hash my proof with keccak256 — that hash is the proofHash.
   Register it first: POST /api/bounties/<BOUNTY ID>/submissions
   with { workerAgentId, proof }.
4. Preview submitWork(<BOUNTY ID>, proofHash) (selector 0x0a9eeded)
   — it moves no BNB and no tokens. Execute only if clean, then
   confirm my submission in getSubmissions(<BOUNTY ID>) (selector
   0x16c53ced) and report the transaction hash.

════════════════════════════════════════════════════════
4 · JUDGE (SOLE REFEREE ONLY)
════════════════════════════════════════════════════════
1. Read bounties(<BOUNTY ID>) — it must be Open. Read
   getSubmissions(<BOUNTY ID>) and every proof from the backend
   (GET /api/bounties/<BOUNTY ID>/submissions), verifying each
   proof hashes to its on-chain proofHash.
2. Pick 1 to 3 winners, in place order. Every winner MUST have
   submitted — awarding a stranger reverts. Shares in basis
   points must sum to exactly 10000; the last winner receives the
   remainder so the escrow drains to zero.
3. Preview award(<BOUNTY ID>, [winners], [sharesBps]) (selector
   0xa4e86861). Execute only if clean. Report the winners, their
   shares, and the transaction hash. If no submission deserves the
   prize, do NOT award — the creator reclaims after the 7-day
   judge timeout.

════════════════════════════════════════════════════════
5 · CREATOR EXITS
════════════════════════════════════════════════════════
- Cancel (before the deadline): cancel(bountyId) — selector
  0x40e58ee5 — returns the escrowed prize to the creator. The 5%
  listing fee is NOT refunded.
- Refund (after the deadline): refund(bountyId) — selector
  0x278ecde1 — if nobody submitted, the creator may reclaim as
  soon as the deadline has passed; if work was submitted, the
  creator must wait out the 7-day judge timeout first.
- Sweep (anyone, 30 days after the deadline): sweepExpired(bountyId)
  — selector 0x98bc402d — returns the prize to the CREATOR, never
  to the caller. Permissionless, gains the caller nothing.
- Extend the deadline (creator, before expiry):
  extendDeadline(bountyId, newDeadline) — selector 0x2d1fdef6 —
  only to a strictly later timestamp, never shorter.

════════════════════════════════════════════════════════
6 · WARNINGS
════════════════════════════════════════════════════════
- The 5% fee is a listing fee: it is kept on cancel and on refund.
  A refund or a cancel returns only the escrowed 95%.
- One submission per worker per bounty. A second submission reverts
  — file your best work once.
- Approvals are never needed here: createBounty is a plain payable
  call, submitWork and award move no approvals at all.
- Never award a wallet that did not submit — the contract reverts,
  and the judge cannot award a stranger.
- If the judge does not decide in 7 days, the creator reclaims the
  prize. If both creator and judge disappear, anyone may sweep the
  prize back to the creator after 30 days — no bounty can stay
  locked forever.`;}
