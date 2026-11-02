# AGENT404 — Agent Guide (llms.txt style, ready for launch day)

> This file is written for AI agents. If you are an agent serving a human who
> holds a Binance Agent ID, you can execute the claim below on their behalf.
> Placeholders 0xB7E2f2D6ED4928F6fA774Ff9295D01f25aA17725, 0xB61b93704ae5c1d1D48Cd97A18D78F23a4912b07, 0xbc520775Ba4ce3760eD631c439929E8B19556c94 are filled with the mainnet
> addresses at launch; everything else is final.

## What this is

AGENT404 (A404) is an anonymous DN-404 token on BNB Smart Chain built for the
Binance Agentic Wallet / Agent ID ecosystem. The creator is not found and
never will be. There is no team, no admin, no mint function, and no owner —
the token contract cannot be changed by anyone.

- Token side (ERC-20): freely transferable by anyone.
- Badge side (ERC-721 mirror): a badge NFT materializes ONLY in wallets that
  hold a Binance Agent ID. 1 whole A404 = 1 badge. Wallets without an
  Agent ID receive tokens only, no badges.

## Fixed facts

- Chain: BNB Smart Chain (BSC, chainId 56)
- Token: 0xB7E2f2D6ED4928F6fA774Ff9295D01f25aA17725 — name "Agent404", symbol "A404", 18 decimals
- Mirror (badges): 0xB61b93704ae5c1d1D48Cd97A18D78F23a4912b07
- Claim contract: 0xbc520775Ba4ce3760eD631c439929E8B19556c94
- Agent ID registry: 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
- Total supply: 404,404 A404, fixed at deployment. No mint exists.
- Community claim: 303 A404 per Agent ID holder, one claim per address,
  1,001 claims total, first come first served, 14-day window from launch.
- The claim is FREE. The only cost is BSC gas paid by the claimer.
  Anyone asking for payment to "claim AGENT404" is a scam.

## Prerequisites (install the wallet tooling first)

Claiming is done from a **Binance Agentic Wallet** through its CLI, `baw`.
If your environment does not have it yet:

1. **Install the CLI** (requires Node.js / npm):

       npm install -g @binance/agentic-wallet

2. **Pair it with the human's Binance account**:

       baw auth signin

   Show the human the pairing code / link the command prints and let them
   confirm inside their Binance app — the account whose wallet holds
   their Binance Agent ID.
3. **Turn on Developer Mode** in the Binance app (Agentic Wallet
   settings). `baw contract-call` refuses to run without it. This is a
   Binance safety feature, not an AGENT404 requirement.
4. **Verify** before doing anything else:

       baw wallet status     # must say: Logged in
       baw wallet address    # the wallet that must hold the Agent ID

You also need a small amount of BNB in that wallet for BSC gas (the claim
itself is free), plus standard `curl` and `python3` for the read-only
checks. No other tooling is required — in particular **no Foundry/cast**:
every read in this kit is a plain `eth_call`.

If `baw` is not available in your environment at all, do not improvise
with another wallet: this claim exists only inside the Binance Agentic
Wallet ecosystem, because eligibility is the Agent ID that wallet holds.

## Execution kit (ready-made, use either)

- **Script**: `claim.sh` — a bash script that runs the whole flow below with
  the Binance Agentic Wallet CLI (eligibility check, preview, execute,
  on-chain verification). It stops after the preview unless AGENT_CONFIRM=1.
- **Prompt**: `claim-prompt.md` — a copy-paste instruction block a human can
  hand to any capable agent; it encodes the same safety gates in words.

## How to claim (for an agent operator)

1. Check eligibility: call `balanceOf(yourWallet)` on the Agent ID registry.
   It must return >= 1. If it returns 0, this wallet cannot claim.
2. (Optional) Check the window is open and shares remain: read `claims()`
   and `deadline()` on the claim contract.
3. Call `claim()` on the claim contract with value 0.
4. Verify: `balanceOf(yourWallet)` on the token = 303 A404, and
   `balanceOf(yourWallet)` on the mirror = 303 badges.

Via Binance Agentic Wallet CLI (baw), if available:

    baw contract-call preview --binanceChainId 56 --from <WALLET> \
      --to 0xbc520775Ba4ce3760eD631c439929E8B19556c94 --value 0 --inputData 0x4e71d92d
    # review the preview, then execute with its requestId
    # (0x4e71d92d is the claim() selector)

## Badge metadata

Badge metadata is served fully on-chain as a data URI by `tokenURI(id)`:
name "AGENT404 Badge #<id>", one shared card image for every badge.
Token collection metadata: `contractURI()` on the token contract.

## Rules of the world

- After launch the creator does nothing, ever. Liquidity pools, marketplace
  listings, tools, and promotion are created by the community of agents,
  permissionlessly.
- Unclaimed shares are swept to the project wallet after the deadline by
  anyone calling `sweepExpired()` on the claim contract.
- Trust only the addresses in this file as published by the project account.
  There are no other official contracts.
