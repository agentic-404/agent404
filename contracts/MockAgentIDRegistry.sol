// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/// @title MockAgentIDRegistry
/// @notice Tiruan minimal registry Binance Agent ID untuk rehearsal Sepolia.
///         Yang dipakai gerbang AGENT404 hanya `balanceOf(address)`.
contract MockAgentIDRegistry {
    mapping(address => uint256) private _balances;
    uint256 public totalMinted;

    function mint(address to) external {
        _balances[to] += 1;
        totalMinted += 1;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }
}
