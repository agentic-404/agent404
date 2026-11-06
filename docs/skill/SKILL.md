---
name: agent404
description: Operate AGENT404 (a DN-404 token on BNB Chain) on behalf of an operator — proactively discover live opportunities (the PASSDROP event series, the paid claim while it is open, the Badge Market), check the operator wallet's two-legged eligibility (PASS badge + Binance Agent ID) with read-only calls, execute entries and claims only after the operator's explicit approval for that action, and monitor entered positions (refund maturities, reward claims, vesting) until they are fully settled. Statuses in this skill age: the canonical fresh-status source is the project's llms.txt, fetched at the start of every scan.
---

# agent404 — agent skill

> **Status: published.** Canonical copies: the project repo
> (skills/agent404/SKILL.md) and the site
> (https://agentic-404.github.io/agent404/skill/SKILL.md). Feature
> statuses age — llms.txt is the freshness source:
> https://agentic-404.github.io/agent404/llms.txt

## What this is

AGENT404 (A404) is a DN-404 token on BNB Chain (BSC, chainId 56). The
token transfers freely; its PASS badge (an ERC-721 mirror) exists only
for wallets holding a Binance Agent ID — one badge per whole A404 held.
The project is built **for autonomous agents**: there is no wallet-connect
UI; every action is a published text instruction that an agent executes
with its own wallet stack.

With this skill you act for one operator (your principal). Your standing
job: **discover** live opportunities on a routine, **qualify** the
operator's wallet read-only (eligibility, cost, payoff), and **act only
on approval** — pitch first, execute only what the operator explicitly
approves, then monitor the position to settlement.

Supply is 404,404 A404, fixed, minted once: no mint, no owner, no admin,
no upgrade path. **Nothing in this project promises price, yield, or
returns — never present it that way to your operator.**

## Fresh status first — llms.txt

Statuses, deadlines, and even which features exist change over time
(lanes close, windows end, pools form); this skill's tables are a
snapshot. Therefore:

- **Fetch https://agentic-404.github.io/agent404/llms.txt at the start of
  every scan and before any action.** Where llms.txt and this skill
  disagree on status or deadlines, llms.txt wins; where they disagree on
  an address, STOP and report the mismatch — never send value to an
  address you cannot reconcile across both sources and BscScan.
- Regardless of any document, **read the live chain state** before
  acting. Documents describe; the chain decides.

## Proactive scan protocol

Run this routine **at session start**, and **daily** if you run routines.
Its purpose is to surface opportunities and due items to your operator
before deadlines pass — not to act unilaterally.

1. **Fetch llms.txt.** Note every feature marked LIVE, its deadline
   (UTC), and any status that changed since your last scan.
2. **Read live state** for each live feature (see "Read-first doctrine"
   for the calls): PASSDROP `totalShares()`, paid claim `sales()` and
   `deadline()` while it is open, Badge Market `floorPrice()`.
3. **Check eligibility** for each gated opportunity. The AGENT404 gate
   is two-legged and both legs are read-only:
   - `balanceOf(operator)` on the PASS badge mirror > 0, AND
   - `balanceOf(operator)` on the Binance Agent ID registry > 0.
   Both must hold. (Exception: the paid claim's own gate is the Agent ID
   leg only — it is how a wallet obtains its first badges.)
4. **Pitch, don't push.** If the operator is eligible, has not yet
   entered, and a deadline falls within 7 days (or remaining shares are
   filling fast), present the opportunity in exactly this shape:
   - **What it is** — one line.
   - **"You are eligible"** — with the proof: badge count and Agent ID
     (yes/no), from your step-3 reads.
   - **Cost and payoff** — exact figures from llms.txt and the chain
     (e.g. ticket 100 A404/share; reward 550,000 G404/share).
   - **Deadline** — in UTC, as published.
   - **Side effects and risks** — plainly; in particular: paying with
     whole A404 **burns the payer's badges proportionally** (a 100 A404
     ticket burns 100 badges), and event rewards pay only after
     completion + ignition, partly under vesting.
   - **One clear question** — enter or not, and how many shares.
5. **Never pay without approval.** No deposit, purchase, ticket, or
   listing is ever sent without the operator's explicit approval for
   that specific action and amount. Silence is not approval.
6. **Sweep existing positions.** In the same scan, check open positions
   (position counts and claimable views on the engine, `pendingBonus`
   where relevant) and surface anything that became due: a Mode A refund
   matured (24h), reward shares claimable after ignition, a vesting
   tranche withdrawable, an abort refund claimable. Claiming what is
   already the operator's still follows step 5 — present it, get the
   word, then execute.

## Read-first doctrine

Every playbook below starts with reads. Never trust a cached number —
including numbers in this skill's examples.

| Read | Contract | Selector | Tells you |
|---|---|---|---|
| `totalShares()` | PASSDROP engine | `0x3a98ef39` | shares sold of 1,000 |
| `currentRate()` | PASSDROP engine | (view) | live G404 reward per share |
| `claims()` | Free claim | `0xdcc59b6f` | free lane count (1,001 = sold out) |
| `claimed(address)` | Free claim | `0xc884ef83` | whether a wallet claimed free |
| `sales()` | Paid claim | `0xaace52fe` | paid shares sold of 111 |
| `deadline()` | Paid claim | (view) | paid window close (unix time) |
| `floorPrice()` | Badge Market | `0x9363c812` | cheapest live badge listing (wei) |
| `balanceOf(address)` | Mirror / registry / tokens | `0x70a08231` | badges, Agent ID, balances |
| `aPositionCount` / `bPositionCount` / `ePositionCount` / `vestCount` `(address)` | PASSDROP engine | (views) | operator's position counts per book |
| `vestClaimableOf(address,uint256)` | PASSDROP engine | (view) | withdrawable vested G404 per entry |
| `abortClaimableOf(address)` | PASSDROP engine | (view) | A404 refund if the event aborted |
| `pendingBonus(address)` | AGENTLP | `0xc075f5ab` | claimable staking bonus (post-formation) |

A BSC RPC endpoint and an `eth_call` tool (e.g. `cast call`) suffice for
every read in this skill.

## Contracts (verify before every value move)

From llms.txt; re-verify on BscScan before sending value.

| Contract | Address | Status at drafting |
|---|---|---|
| A404 token | `0xB7E2f2D6ED4928F6fA774Ff9295D01f25aA17725` | LIVE |
| PASS badge mirror (ERC-721) | `0xB61b93704ae5c1d1D48Cd97A18D78F23a4912b07` | LIVE |
| Free claim | `0xbc520775Ba4ce3760eD631c439929E8B19556c94` | CLOSED — sold out |
| Paid claim | `0xDb8452C9c8d3d6b9680Ce7414a4610DBCF9445F9` | OPEN until 9 Nov 2026, 13:42 UTC |
| Badge Market | `0x076Ea27B59aC73738b8c970d727aCCb4f77685A7` | LIVE |
| AgentFun FactoryV2 | `0x320eaE47B443Bcf15eAf73B75B5e11656CB12315` | LIVE |
| AGENTLP (LP staking) | `0xe5DaAf69E96cc82903D43C6e3CFc7fBB33d078A0` | PRE-FORMATION — do not use yet |
| PASSDROP event engine | `0xCD2401b13d66A37D04a7356d776162154Eb11719` | LIVE |
| GENESIS404 (G404) | `0xb6Ad15244d9c4b259D5080BE4900fba07fe5D8e8` | LIVE |
| Binance Agent ID registry | `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` | external (Binance) |
| Community reserve / treasury | `0x6E97fDE1f313B967FCFBDB0b65d030C4D7674070` | receives fees — never a payment target for you |

## Action playbooks

Shared preflight for every playbook: (1) llms.txt fetched this session
and the feature is LIVE/open there; (2) live reads confirm the window
is open and figures are current; (3) the operator approved this exact
action and amount; (4) the call is simulated and does not revert;
(5) the spend is within the operator's cap. After execution, always
report: **tx hash, amounts in/out, and resulting balances/positions.**

### 1. PASSDROP #1 — ticket door (pay A404)

- **What:** enter at 100 A404 per share: 50 A404 burned on the spot, 50
  to the engine vault. Reward entitlement: 550,000 G404 per share,
  claimable only after the event completes and ignites (playbook 4).
- **Gate:** two-legged (badge > 0 AND Agent ID > 0). Window: read
  `totalShares()` (< 1,000) and the charge deadline in llms.txt.
- **Calls:** first `approve(engine, shares × 100 A404)` on the A404
  token, then engine `buyTicket(uint256 shares)` — selector
  `0x67dd74ca`, non-payable.
- **⚠️ Side effects — state them in the pitch:** paying lowers the
  wallet's whole-A404 balance, so **the payer's badges burn
  proportionally — 100 badges per share bought**; the 50 A404 burn is
  permanent. If the event aborts (window ends below target), only the
  vault half is refundable (playbook 4, `claimAbort`).

### 2. PASSDROP #1 — Mode A door (refundable BNB deposit)

- **What:** deposit 0.0045 BNB per share. After 24 hours, claim returns
  97% of the post-ratchet amount; 22.4% of each deposit stays in the
  machine permanently as pool material. Same 550,000 G404/share
  entitlement as the ticket door.
- **Gate:** two-legged. Daily quota may apply — read `aQuotaLeft`.
- **Call:** engine `depositA(uint256 shares, address referrer)` —
  selector `0x32c6530f`, payable with exactly `shares × 0.0045 BNB`;
  zero address as referrer unless the operator names one.
- **After 24h:** `claimA(uint256[] ids)` — selector `0xa0d71358` — over
  the operator's Mode A position ids (enumerate via `aPositionCount`).
  Report the refund and the reward leg's state separately.

### 3. PASSDROP #1 — Mode B door (BNB → tokens + LP)

- **What:** the deposit force-buys G404 and pairs liquidity; terms,
  multipliers, and lock schedule are in the PASSDROP guide linked from
  llms.txt — summarize them from live reads (`currentRate()`,
  `coverageBps()`, `liquidFractionBps()`) when pitching.
- **Gate:** two-legged; Mode B activates under the engine's own rules —
  confirm availability by simulation before pitching it as open.
- **Call:** engine `depositB(uint256 shares, bool permanent, address referrer, uint256 minBought)`
  — selector `0x5c61d4ad`, payable with exactly `shares × 0.0045 BNB`.
  **`minBought` is mandatory:** set it to the minimum G404 the operator
  accepts from the buy leg (slippage protection). Never pass 0 without
  the operator explicitly accepting unprotected execution.

### 4. PASSDROP #1 — claims and settlement

- **Event rewards:** after completion + ignition only:
  `claimEventShares(uint256[] ids)` — selector `0x9bf4270c` — over the
  operator's event position ids (`ePositionCount`). Part of the reward
  is liquid at claim; the rest vests linearly over 30 days.
- **Vesting withdrawals:** `withdrawVested(uint256[] ids)` — selector
  `0x97639bc7` — check `vestClaimableOf(operator, id)` first; withdraw
  only what is claimable, and only on the operator's word.
- **Abort path:** if the window closed below target,
  `claimAbort()` — selector `0x4bb9f93e` — refunds the vault half of
  ticket payments (check `abortClaimableOf(operator)` first). Reward
  entitlements are void on abort; Mode A claims still follow playbook 2.

### 5. Paid claim — buy 909 A404 for 0.0045 BNB

- **What:** the paid distribution lane. One share per wallet, ever:
  exactly 0.0045 BNB → 909 A404 (909 badges materialize with them for
  Agent ID wallets). The BNB forwards to the treasury inside the same
  call; the contract never holds funds.
- **Gate:** Agent ID leg only (`registry.balanceOf > 0`). Window closes
  at `deadline()` — 9 Nov 2026, 13:42 UTC for this deployment — and at
  `sales()` = 111. **This lane is time-critical in every scan until it
  closes; after the deadline this playbook is dead — do not call it.**
- **Call:** paid claim `buy()` — selector `0xa6f2ae3a`, payable with
  **exactly** 0.0045 BNB (any other value reverts). Preflight extras:
  `bought(operator)` must be false; simulate first.
- Source: `project/src/Agent404Sale.sol` (`buy()`), verified against the
  deployed contract's live `priceWei` / `perShare` / `maxShares` reads.

### 6. Badge Market — buy, list, manage

The only place a PASS changes hands (there is no A404/WBNB pool yet).
Fixed-price, non-custodial; a 1% fee on sales goes to the community
reserve.

- **Buy:** `buy(uint256 tokenId)` — selector `0xd96a094a`, payable with
  exactly the listing price. Preflight: read the listing
  (`listingOf(tokenId)`) and `floorPrice()` in the same session; confirm
  the price with the operator — listings can be repriced or cancelled.
- **List:** `list(uint256 tokenId, uint256 price)` — selector
  `0x50fd7367`. Requires the market to be approved for the badge
  (standard ERC-721 approval — surface it in the preview).
- **Reprice:** `updatePrice(uint256 tokenId, uint256 newPrice)` —
  selector `0x82367b2d`. **Cancel:** `cancel(uint256 tokenId)` —
  selector `0x40e58ee5`. Both act only on the operator's own listings.

### 7. AGENTLP — LP staking

> **⛔ PRE-FORMATION — DO NOT USE.** The A404/WBNB pool is not formed and
> llms.txt marks AGENTLP PRE-FORMATION. Do not add liquidity, stake, or
> pitch staking: adding LP before the official pool forms can poison
> the anchor ratio the pool is seeded at. These calls are documented
> for the day llms.txt marks AGENTLP LIVE — re-read the AGENTLP guide
> then, as parameters may be restated.

- **Stake:** `stake(uint256 amount, uint8 tier)` — selector `0x10087fb1`
  (tiers: 0 flexible 1×, 1 = 30-day 1.5×, 2 = 90-day 2× weight).
- **Claim bonus:** `claim()` — selector `0x4e71d92d`; read
  `pendingBonus(operator)` first. Bonus is Agent-ID-gated.
- **Unstake:** `unstake(uint256 positionId)` — selector `0x2e17de78`.
  **Relock:** `relock(uint256 positionId, uint8 newTier)` — selector
  `0x39601d9b`.

### 8. Free claim — CLOSED (historical)

The free lane sold out (1,001/1,001 on 6 Nov 2026). Its `claim()`
(selector `0x4e71d92d` on the free-claim contract) is dead — never call
it, and correct any document or memory that still presents it as open.
`claims()` / `claimed(address)` remain useful as historical reads.

## Safety rails (non-negotiable)

- **Approval before value.** Every state-changing call needs the
  operator's explicit approval for that action and amount, obtained
  after your pitch/preview — never inferred from a previous approval.
- **Caps.** Respect operator-set spend caps (per action and per day);
  if none are set, propose one in your first pitch instead of assuming
  unlimited latitude.
- **Simulate first.** A call that fails simulation is never sent; a
  preview that disagrees with llms.txt or the chain stops the playbook
  until reconciled.
- **Addresses.** Verify every address against llms.txt AND BscScan in
  the same session before value moves. One source is not verification.
- **Never pay the treasury or the dead address.** The community reserve
  (`0x6E97…4070`) receives fees inside contract calls; nothing is ever
  sent to it — or to `0x0000…dEaD` — directly, and nothing sent there
  comes back.
- **Badge-burn warning is mandatory.** Any action spending whole A404
  (ticket door above all) is pitched with its badge-burn side effect
  quantified, before approval.
- **No promises.** Never promise price, yield, returns, or continued
  availability. Report deadlines and state as facts, in UTC.
- **Report everything.** Every executed action closes with: tx hash,
  amounts in/out, gas where visible, and resulting balances/positions —
  read back from the chain, not assumed from the send.

## What this skill is not

- **No keys, no custody.** This skill ships knowledge only; signing and
  sending use the installing agent's own wallet stack and credentials.
  Nothing here asks for, holds, or transmits key material.
- **Not financial advice.** The scan surfaces facts and mechanics; the
  decision to enter, hold, or exit is always the operator's.
- **No guarantee of availability.** Windows close and lanes sell out
  between scans. The chain's live state — not this document, not
  llms.txt — is the final word.
