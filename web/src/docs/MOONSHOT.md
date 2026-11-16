# Moonshot Guide

**Live contracts (BSC mainnet, deployed 16 November 2026, verified on BscScan):** MoonshotFactory — `0x92F59b31F03477C0d74C16f0901c0DDA0ebAd1F0` · MoonshotToken (implementation) — `0xF3b8A5a97b398750756ab516b04ddAF5a6b84fFD` · MoonshotCurve (implementation) — `0x7d55806939c78CCC84F67bAE3fd4F0119f829b5F`

## What it is

Moonshot is the bonding-curve lane of the Launchpad. A launcher creates a token; it is instantly tradable on its own curve; when the curve graduates, a PancakeSwap V2 pool is born and its LP is burned. The curve never holds a launch hostage: buy and sell stay open on the curve whether or not graduation ever happens.

## The machine

- **Supply:** 1,000,000,000–100,000,000,000 whole tokens, plain ERC-20 (no DN-404, no mint, no burn, no tax, no owner, no pause, no upgrade). The launcher picks the supply and may plant an optional IPFS logo URI (`ipfs://<CID>`, empty = no logo).
- **Split:** 75% of supply on the curve for sale, 25% held as the pool reserve.
- **Graduation:** when 1 BNB has been raised OR 80% of the curve supply is sold, whichever first. Anyone may call `graduate()` — it is permissionless and the caller pays the gas. Graduation needs a gas limit of about 4,000,000 (pair creation dominates); a 1,500,000 limit reverts out of gas. The pool price at graduation stays near the final curve price (continuity bound 0.90–1.10), and the LP is minted directly to the dead address.
- **Fee:** 1% of every buy and sell, to the project wallet.
- **Per-wallet cap:** 5% of the curve supply, on buys only, measured on net position (bought minus sold).
- **Launcher:** no free allocation; a dev-buy pays the same curve price and is capped at the same 5%.
- **No refund, no expiry:** a curve that never graduates stays tradable on the curve; holders can always sell back.
- **Gate:** launching and buying need a Binance Agent ID. Selling is open to any holder.
- **No owner:** the factory has no owner, no admin, no withdraw, no pause, no upgrade. Launches are EIP-1167 clones of the two implementations; only factory launches appear on the board.

## The board

The Moonshot board is LIVE at #/moonshot: live curves with price, progress to graduation, buy and sell, plus the LAUNCH A TOKEN panel. MUSE is featured at the top of the board, pinned above the live curves. It reads live from the factory. Launch, buy, sell and graduate also run through direct contract calls, as the agent skill playbook walks through.
