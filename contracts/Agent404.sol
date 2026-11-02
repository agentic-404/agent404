// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./DN404.sol";
import "./DN404Mirror.sol";

interface IAgentIDRegistry {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title Agent404 (A404)
/// @notice Token DN-404 anonim untuk ekosistem Binance Agent ID.
///         Sisi token bebas diperdagangkan; sisi NFT (lencana) hanya mewujud
///         untuk pemegang Agent ID — diatur lewat `_skipNFTDefault`.
contract Agent404 is DN404 {
    string private _name;
    string private _symbol;

    /// @notice Registry Agent ID yang menjadi gerbang lencana.
    IAgentIDRegistry public immutable agentRegistry;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialTokenSupply,
        address initialSupplyOwner,
        address agentRegistry_
    ) {
        _name = name_;
        _symbol = symbol_;
        agentRegistry = IAgentIDRegistry(agentRegistry_);

        address mirror = address(new DN404Mirror(msg.sender));
        _initializeDN404(initialTokenSupply, initialSupplyOwner, mirror);
    }

    /// @dev Gerbang lencana AGENT404:
    ///      - alamat kontrak selalu skip (pool DEX tidak boleh ke-mint NFT);
    ///      - EOA pemegang Agent ID tidak skip (lencana aktif);
    ///      - EOA tanpa Agent ID skip (token saja, tanpa lencana).
    function _skipNFTDefault(address account) internal view override returns (bool) {
        if (account.code.length > 0) return true;
        return agentRegistry.balanceOf(account) == 0;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    /// @dev Metadata lencana sepenuhnya on-chain: JSON data-URI per token.
    ///      Nama membawa nomor seri; gambar = kartu ID korup resmi di IPFS.
    ///      Tidak ada server, tidak ada baseURI, tidak ada admin.
    function _tokenURI(uint256 tokenId) internal pure override returns (string memory) {
        string memory json = string(
            abi.encodePacked(
                '{"name":"AGENT404 Badge #',
                _toString(tokenId),
                '","description":"Verified agent. Identity not found.",'
                '"image":"ipfs://QmV8o6eVLyMo2Kd5Mg7BaRdKqu4jYdSdiAHh1EwJNhYTuk"}'
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", _b64encode(bytes(json))));
    }

    function _b64encode(bytes memory data) internal pure returns (string memory) {
        bytes memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        uint256 len = data.length;
        if (len == 0) return "";
        bytes memory result = new bytes(4 * ((len + 2) / 3));
        uint256 i;
        uint256 j;
        for (; i + 3 <= len; i += 3) {
            uint256 v = (uint256(uint8(data[i])) << 16) | (uint256(uint8(data[i + 1])) << 8)
                | uint256(uint8(data[i + 2]));
            result[j++] = table[v >> 18];
            result[j++] = table[(v >> 12) & 63];
            result[j++] = table[(v >> 6) & 63];
            result[j++] = table[v & 63];
        }
        uint256 rem = len - i;
        if (rem == 1) {
            uint256 v = uint256(uint8(data[i])) << 16;
            result[j++] = table[v >> 18];
            result[j++] = table[(v >> 12) & 63];
            result[j++] = bytes1("=");
            result[j++] = bytes1("=");
        } else if (rem == 2) {
            uint256 v = (uint256(uint8(data[i])) << 16) | (uint256(uint8(data[i + 1])) << 8);
            result[j++] = table[v >> 18];
            result[j++] = table[(v >> 12) & 63];
            result[j++] = table[(v >> 6) & 63];
            result[j++] = bytes1("=");
        }
        return string(result);
    }

    /// @notice URI metadata koleksi (ERC-7572) — ikon resmi AGENT404 di IPFS.
    ///         Supply bersifat tetap sejak deploy: tidak ada fungsi mint.
    function contractURI() external pure returns (string memory) {
        return "ipfs://QmfRA6go3AAP69EDu5iavH8t2gA1gfkT2yS4eqKwWNfW6k";
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
