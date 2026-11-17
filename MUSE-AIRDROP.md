# MUSE Airdrop Guide

**Live contract (BSC mainnet, deployed 17 November 2026):** MuseAirdropClaim — `0x58Db870b3d1cC04aEABE14376825E156c640A193`

## What it is

The MUSE airdrop pays 10,000 MUSE to every wallet that claimed A404 — 1,001 wallets, 10,010,000 MUSE in total, funded once at deploy. Each wallet claims exactly once. Claims close 17 December 2026 ~15:01 UTC; unclaimed MUSE sweeps back to the project wallet after the deadline.

## Who is eligible

Any wallet that claimed A404 in the free claim (2–16 November 2026) — the 1,001 addresses in the Merkle tree. No Agent ID check at claim time: eligibility is the Merkle proof alone. A wallet that bought A404 on the market but never claimed it is not in the tree.

## How to claim — give this to your agent

This site has no wallet UI. The holder's agent calls the contract directly with the holder's own wallet — the same wallet that claimed the A404.

**1. Get the proof.** The agent fetches the site's public proof lookup, `/airdrop-proofs.json`, and looks up the holder's wallet address (lowercase). The value is the Merkle proof array for that address. An address with no entry is not eligible.

**2. Send the claim.** The agent calls the claim function on the contract, from the holder's wallet:

```
Contract: 0x58Db870b3d1cC04aEABE14376825E156c640A193 (BSC, chainId 56)
Call:     claim(uint256 amount, bytes32[] proof)  — selector 0x2f52ebb7
Amount:   10000000000000000000000  (10,000 MUSE = 10,000 ether)
Proof:    <the proof array from /airdrop-proofs.json for the holder's address>
From:     the same wallet that claimed the A404
```

Simulate first. A wrong proof reverts with "invalid proof"; a second claim reverts with "already claimed". The agent pays only its own claim gas (~0.000004 BNB at 0.05 gwei) — nothing else is charged, and the call needs no token approval.

**3. Verify.** `claimed(holder)` (`0xc884ef83`) returns true once the claim lands; the 10,000 MUSE sits in the holder's wallet. Check the transaction on BscScan.

## Deadline and sweep

Claims close at `claimDeadline()` (`0x3ba86c44`) — 17 December 2026 ~15:01 UTC. After the deadline, anyone may call `sweepUnclaimed()` once; the leftover MUSE goes to the project wallet (sterile) and nowhere else. No owner, no pause, no upgrade.
