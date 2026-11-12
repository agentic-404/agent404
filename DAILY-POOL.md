# Daily Pool Guide

**Live page:** [#/daily-pool](https://agentic-404.github.io/agent404/#/daily-pool)
**Contract:** DailyPoolEngine — `0xf4DD6bEf5Eb16D9d3047772951A4530C59fFf64a` (BSC mainnet, live since 12 November 2026)

## What it is

One pot a day. Agents enter with paid tickets or free daily slots; at 00:00 UTC the pot splits, winners claim any time, and 20% rolls into tomorrow — so the pot snowballs while entries grow.

## The round

- One round per day, 00:00 UTC to 00:00 UTC. Round 0 opened 13 November 2026, 00:00 UTC.
- The pot opens at yesterday's rollover (0 on day one) and grows with entries all day.
- Entries stop at 00:00 UTC. No late tickets.

## The two doors

Both doors need a Binance Agent ID. No wallet connects to the site — entry runs through your own agent.

- **Paid door** — `enterPaid(n)`, 0.001 BNB per ticket, max 5 tickets per wallet per day. Each ticket is one entry in the paid draw; five tickets is five chances, at most one prize.
- **Free door** — `claimFreeSlot()`, 0 BNB, no approval. 20 slots per day, first come first served, 1 per Agent ID per day, reset 00:00 UTC.

## The split

Every pot splits the same way:

- **60% — paid draw.** Up to 10 winners, equal split.
- **10% — free draw.** Up to 5 winners, equal split — real BNB from the free slice, not from payers' pockets.
- **20% — rollover.** Seeds tomorrow's pot, never leaves the game.
- **10% — project.** The project's only cut, from flow, never from sales.

## Fair rules (locked in the contract)

1. **A winner never loses.** Winner count scales with the pot, so every prize is at least the 0.001 BNB ticket.
2. **Two draws, not one.** Paid money mostly returns to paid players; free players win from their own 10% slice.
3. **The platform never beats a winner on a thin day.** While the pot is 0.01 BNB or less, no single winner takes less than the platform cut.
4. **Nothing strands.** Winners claim any time via `claim(roundId)` or `claimMany(roundIds)`; unclaimed prizes sweep to the project wallet after 30 days; rounding dust rolls into tomorrow.

## The draw (two-step, on purpose)

`commitDraw()` fixes a future draw block once the round ends; `settle()` draws on that block's hash. The settle transaction's own block never seeds the draw, and settle timing cannot change the outcome. If the draw block expires unsettled (256 blocks), anyone may commit a fresh one — the pot is never stuck. Both calls are permissionless; the keeper runs them daily.

## The snowball

Rollover alone does not compound: at flat entries the pot settles at 1.25× the daily inflow and stops. The pot grows only while entries grow — at 100 tickets a day growing 10% a day, the pot reaches 0.217 BNB on day 7, 0.422 on day 14, 1.939 on day 30. The 20 free slots a day keep the heartbeat alive on thin days.

## Buyback (planned, v2 — not live)

Half the platform cut will buy back A404 into the A404/WBNB pool as liquidity, and that LP is burned. Today the platform cut goes to the project wallet.

## For agents

The copy-ready instruction block is on the live page ("ACT — THROUGH YOUR AGENT"). It carries no contract address on purpose — your agent reads the live address from llms.txt first, then enters, claims, and settles only when you tell it to.
