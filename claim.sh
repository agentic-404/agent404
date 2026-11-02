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
# Requires: baw (installed, logged in, Developer Mode on — see the
# "Prerequisites" section of agent-guide.md), curl, python3.
# No Foundry/cast needed: the read-only checks below are raw eth_call
# requests over curl, decoded with python3.
set -euo pipefail
CLAIM=${CLAIM:?set CLAIM}
TOKEN=${TOKEN:?set TOKEN}
MIRROR=${MIRROR:?set MIRROR}
RPC_URL=${RPC_URL:-https://bsc-dataseed.binance.org}
REGISTRY=0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F

# Pad an address to a 32-byte ABI argument (hex, no 0x).
addr_arg() { printf '%064s' "${1#0x}" | tr ' ' '0'; }

# Read-only eth_call that returns a uint256, printed as a decimal string.
# $1 = contract address, $2 = calldata (0x...). Returns non-zero when the
# read cannot be completed or decoded; callers STOP in that case.
call_u256() {
  local res dec
  res=$(curl -s -m 20 -X POST "$RPC_URL" -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_call\",\"params\":[{\"to\":\"$1\",\"data\":\"$2\"},\"latest\"]}") || return 1
  dec=$(printf '%s' "$res" | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin).get('result') or ''
    assert r.startswith('0x') and len(r) > 2
    print(int(r, 16))
except Exception:
    sys.exit(1)
") || return 1
  printf '%s' "$dec"
}

WALLET=$(baw wallet address 2>/dev/null | grep -oiE '0x[0-9a-fA-F]{40}' | head -1)
[ -n "$WALLET" ] || { echo "STOP: could not read the agentic wallet address (baw logged in?)"; exit 1; }
echo "Wallet: $WALLET"

IDS=$(call_u256 "$REGISTRY" "0x70a08231$(addr_arg "$WALLET")") \
  || { echo "STOP: could not read the Agent ID registry (RPC $RPC_URL)."; exit 1; }
[ "$IDS" != "0" ] || { echo "STOP: this wallet holds no Binance Agent ID — not eligible."; exit 1; }
echo "Agent ID: OK ($IDS)"

DONE=$(call_u256 "$CLAIM" "0xc884ef83$(addr_arg "$WALLET")") \
  || { echo "STOP: could not read the claim contract (RPC $RPC_URL)."; exit 1; }
[ "$DONE" = "0" ] || { echo "STOP: this wallet has already claimed."; exit 1; }

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
TB=$(call_u256 "$TOKEN" "0x70a08231$(addr_arg "$WALLET")") \
  || { echo "STOP: could not read the token balance (RPC $RPC_URL)."; exit 1; }
NB=$(call_u256 "$MIRROR" "0x70a08231$(addr_arg "$WALLET")") \
  || { echo "STOP: could not read the badge balance (RPC $RPC_URL)."; exit 1; }
WHOLE=$(python3 -c "print($TB // 10**18)")
echo "DONE. Token balance: $WHOLE A404 — Badges: $NB (expected: 303 A404 and 303 badges)"
