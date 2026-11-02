# AGENT404

![AGENT404 icon](assets/agent404-icon.png)

**The agent is not found.**

AGENT404 (A404) is an anonymous DN-404 token on BNB Smart Chain, built for the
Binance Agentic Wallet / Agent ID ecosystem. To our knowledge it is the first
DN-404 native to that ecosystem: nobody else gives the badge side of a hybrid
token exclusively to verified agents.

There is no team. There is no admin. The creator deployed, opened the claim,
and vanished — like the name says: **404**.

## How it works

DN-404 fuses an ERC-20 token and an ERC-721 collection into one asset:

- **Token side** — A404 trades and transfers freely, for anyone.
- **Badge side** — every whole 1 A404 corresponds to 1 badge NFT. But a badge
  only *materializes* inside a wallet that holds a **Binance Agent ID**.

Hold A404 without an Agent ID and you hold tokens only. The moment an
Agent ID holder receives whole tokens, badges appear. Send the tokens away,
the badges burn. Agent ID status is read live from the official registry
(`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`), so getting an Agent ID later
activates your badges on your next transfer — no registration, no switch.

![The badge: an ID card for an agent that does not exist](assets/badge-idcard-512.png)

Badge metadata is served fully on-chain as a data URI: one corrupted ID card
for every badge, serial number in the name.

## Supply & distribution

Total supply **404,404 A404**, minted once at deployment. There is **no mint
function, no owner, no admin keys** — nothing in the token contract can ever
be changed by anyone.

| Bucket | Amount | Mechanics |
|---|---|---|
| Community claim | 303,303 A404 (75%) | 1,001 shares × 303 A404, Agent ID holders only, free, first come first served, 14-day window |
| Project reserve | 101,101 A404 (25%) | Ecosystem + operations, held by the project wallet |

There is deliberately **no liquidity pool at launch**. The creator seeds no
market and sets no price — a found price would be a price someone chose for
you. If AGENT404 is to have a market, the community of holders builds it,
permissionlessly, like everything else here.

## Contracts (BNB Smart Chain)

| Contract | Address |
|---|---|
| Token (A404) | `<TOKEN>` |
| Mirror (badges) | `<MIRROR>` |
| Community claim | `<CLAIM>` |
| Agent ID registry | `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` |

Full source is in [`contracts/`](contracts/). The DN-404 core
(`DN404.sol`, `DN404Mirror.sol`) is Vectorized's reference implementation,
used byte-for-byte unmodified. The system was rehearsed end-to-end on
testnet and against a fork of live BSC state (real registry, real Agent ID
holder claiming) before this deployment.

## For agents

This project is agent-native. Humans do not need to click anything:

- **[Agent guide](agent-guide.md)** — everything an agent needs to know,
  including exact claim steps and verification.
- **[Claim prompt](claim-prompt.md)** — a copy-paste instruction block a
  human can hand to their agent.
- **[Claim script](claim.sh)** — a ready bash flow (Binance Agentic Wallet
  CLI + cast) with safety gates: it stops after the preview unless
  explicitly confirmed.

The claim is **free**. The only cost is BSC gas, paid by the claimer.
Anyone asking for payment to "claim AGENT404" is running a scam.

## The rules of this world

- The creator's role ended at deployment. One announcement, then silence.
- Unclaimed shares are swept to the project wallet after the deadline;
  anyone may trigger `sweepExpired()`.
- Trust only the addresses published by the project account. There are no
  other official contracts, sales, or "team members" to DM you.

*An experiment in anonymous, agent-driven distribution. Nothing here is a
promise of value. Verify everything — that is rather the point.*
