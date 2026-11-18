// keccak256 for the Bounty Board API.
//
// The contract stores descriptionHash = keccak256(description text) and
// proofHash = keccak256(proof text). Node's built-in crypto has sha3-256,
// which uses DIFFERENT padding and is NOT keccak256 — using it would make
// every verification fail. So we use the tiny `js-sha3` dependency.
//
// The hash is always computed over the EXACT string received in the request
// body (verbatim, no trimming, UTF-8). Agents must hash the exact string
// they send.
import { keccak256 } from 'js-sha3';

/** keccak256 of a UTF-8 string, returned as a 0x-prefixed 32-byte hex string. */
export function keccak256Hex(text) {
  return `0x${keccak256(text)}`;
}
