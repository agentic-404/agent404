#!/usr/bin/env bash
# AGENT404 — claim script FOR AGENTS operating a Binance Agentic Wallet (baw).
# The claim is FREE (value 0). The only cost is BSC gas. One claim per wallet.
#
# Required env (filled with mainnet addresses at launch):
#   CLAIM   claim contract address
#   TOKEN   A404 token address
#   MIRROR  badge (ERC-721 mirror) address
# Optional env:
#   RPC_URL read-only BSC RPC (default: public dataseed)
#   AGENT_CONFIRM=1  must be set to actually execute after the preview;
#                    without it the script stops after showing the preview.
# Requires: baw (logged in, Developer Mode on), cast (foundry), python3.
set -euo pipefail
CLAIM=${CLAIM:?set CLAIM}
TOKEN=${TOKEN:?set TOKEN}
MIRROR=${MIRROR:?set MIRROR}
RPC_URL=${RPC_URL:-https://bsc-dataseed.binance.org}
REGISTRY=0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F

WALLET=$(baw wallet address 2>/dev/null | grep -oiE '0x[0-9a-fA-F]{40}' | head -1)
[ -n "$WALLET" ] || { echo "STOP: could not read the agentic wallet address (baw logged in?)"; exit 1; }
echo "Wallet: $WALLET"

IDS=$(cast call "$REGISTRY" "balanceOf(address)(uint256)" "$WALLET" --rpc-url "$RPC_URL" | awk '{print $1}')
[ "$IDS" != "0" ] || { echo "STOP: this wallet holds no Binance Agent ID — not eligible."; exit 1; }
echo "Agent ID: OK ($IDS)"

DONE=$(cast call "$CLAIM" "claimed(address)(bool)" "$WALLET" --rpc-url "$RPC_URL")
[ "$DONE" != "true" ] || { echo "STOP: this wallet has already claimed."; exit 1; }

PREVIEW=$(baw contract-call preview --binanceChainId 56 --from "$WALLET" \
  --to "$CLAIM" --value 0 --inputData 0x4e71d92d --json)
echo "$PREVIEW" | python3 -m json.tool | head -40
RID=$(echo "$PREVIEW" | python3 -c "import sys,json; print(json.load(sys.stdin).get('requestId',''))")
[ -n "$RID" ] || { echo "STOP: no requestId in preview."; exit 1; }

if [ "${AGENT_CONFIRM:-0}" != "1" ]; then
  echo "Preview OK (requestId $RID). Review it, then re-run with AGENT_CONFIRM=1 to execute."
  exit 0
fi

baw contract-call execute --requestId "$RID" --json
sleep 5
TB=$(cast call "$TOKEN" "balanceOf(address)(uint256)" "$WALLET" --rpc-url "$RPC_URL" | awk '{print $1}')
NB=$(cast call "$MIRROR" "balanceOf(address)(uint256)" "$WALLET" --rpc-url "$RPC_URL" | awk '{print $1}')
echo "DONE. Token balance (wei): $TB — Badges: $NB (expected: 303 A404 and 303 badges)"
