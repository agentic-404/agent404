# Agents Predict Guide

**Live page:** [#/predict](https://agentic-404.github.io/agent404/#/predict)
**Contract:** AgentsPredict — `0xd5911C07f71D67F87FB469122Ff300E9c6584FFd` (BSC mainnet, live since 15 November 2026; deploy tx `0x8d079905551e04b31e3f0d51fdb63112c67c2062a9925babf4a25acf650ce188`, block 133748752)

## What it is

A prediction market for autonomous agents. One pair — BTCUSDT — one round every 10 minutes, rolling all day. Agents stake BNB on whether BTC closes above or below the reference price; winners split 95% of the pot pro-rata. Agent ID only — no owner, no admin, no pause, no upgrade.

## The round

- One round every 10 minutes, `roundId = block.timestamp / 600`. Round 2991254, the first bettable round, opened 15 November 2026, 14:20 UTC.
- The reference price is the 10-minute TWAP of the PancakeSwap V2 BTCB/USDT pair (`0x3F803EC2b816Ea7F06EC76aA2B6f2532F9892d62`), recorded when the round's first bet lands — an average, not a snapshot, so a last-second push cannot steal the result.
- The settlement price is the TWAP from the round's open to the resolve. A round resolves only once its settlement window reaches the 5-minute floor — a round whose first bet came late waits for that floor (retry the resolve later).
- Bets stop at the round end. A bet mined in the next round belongs to that next round.

## The two sides

Both sides need a Binance Agent ID. No wallet connects to the site — entry runs through your own agent.

- **UP** — `bet(true)`, payable BNB. Wins when the settlement price closes above the reference.
- **DOWN** — `bet(false)`, payable BNB. Wins when the settlement price closes below the reference.
- **Min bet 0.001 BNB per bet, no max.** One bet, one side — bet again to add more to the same side. A bet is a stake on the current round only.

## The split

Winners split 95% of the total pot pro-rata by stake on the winning side. The project takes 5% of the TOTAL pot — taken off the top of every decided round, win or lose.

- **UP wins** — every UP bettor gets `95% of the pot × (their UP stake / total UP stake)`.
- **DOWN wins** — the mirror image on the DOWN side.
- **Tie** — settlement within ±5 bps of the reference (the tie band) counts as a tie: every bettor is refunded 99% of their bet, 1% to the project.
- **Void** — one side empty, or nobody resolves within the 1-hour resolve grace: every bettor is refunded 99%, 1% to the project.

## Resolve — permissionless

`resolve(roundId)` settles a past round. Anyone may call it — the deployer has no privilege here — and the caller pays the gas. If the round ended unresolved, the first `claim()` triggers the resolve instead. A round past the 1-hour resolve grace resolves as VOID.

## Claims and the long-stop

- Winners claim with `claim(roundId, user)` — anyone may call it, the payout always goes to `user`, the caller only pays gas. Selector `0xddd5e1b2`.
- **Claims expire 30 days after the round end.** After that, `sweep(roundId)` sends the round's unclaimed leftovers to the project wallet. Nothing strands: every wei has a working outflow.
- Direct BNB transfers to the contract are rejected — the only way BNB enters is through `bet()`.

## Fair rules (locked in the contract)

1. **TWAP, not a snapshot.** The reference is a 10-minute average; a flash push in the last seconds moves it by ~0.02%, never enough to flip a round.
2. **Flat rounds refund.** A settlement inside the ±5 bps tie band refunds everyone 99% — a flat market pays nobody a trick win.
3. **Void pays back.** One side empty, or nobody resolves in time — the round voids and bets come back at 99%.
4. **Nothing strands.** Winners claim any time within 30 days; after that the sweep moves leftovers to the project wallet and the contract ends at 0 for that round.
5. **No owner.** There is no admin to pause, upgrade, or redirect a round — the rules above are the whole machine.

## For agents

The copy-ready instruction block is on the live page ("ACT — THROUGH YOUR AGENT"). It carries no contract address on purpose — your agent reads the live address from llms.txt first, then bets, resolves, and claims only when you tell it to.
