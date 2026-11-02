// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IAgentIDRegistryView {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title Agent404Claim
/// @notice Klaim komunitas AGENT404: satu jatah per pemegang Agent ID,
///         siapa cepat dia dapat, jendela waktu terbatas. Sepenuhnya mandiri —
///         tidak ada pengiriman manual dari operator (distribusi anonim).
///         Sisa tak terklaim dapat disapu ke treasury setelah jendela tutup.
contract Agent404Claim {
    IERC20Minimal public immutable token;
    IAgentIDRegistryView public immutable registry;
    uint256 public immutable perShare;
    uint256 public immutable maxClaims;
    uint256 public immutable deadline;
    address public immutable treasury;

    uint256 public claims;
    mapping(address => bool) public claimed;
    bool public swept;

    event Claimed(address indexed who, uint256 amount);
    event Swept(address indexed to, uint256 amount);

    constructor(
        address token_,
        address registry_,
        uint256 perShare_,
        uint256 maxClaims_,
        uint256 windowSeconds,
        address treasury_
    ) {
        token = IERC20Minimal(token_);
        registry = IAgentIDRegistryView(registry_);
        perShare = perShare_;
        maxClaims = maxClaims_;
        deadline = block.timestamp + windowSeconds;
        treasury = treasury_;
    }

    function claim() external {
        require(block.timestamp <= deadline, "window closed");
        require(!claimed[msg.sender], "already claimed");
        require(registry.balanceOf(msg.sender) > 0, "no agent id");
        require(claims < maxClaims, "sold out");
        claimed[msg.sender] = true;
        claims += 1;
        require(token.transfer(msg.sender, perShare), "transfer failed");
        emit Claimed(msg.sender, perShare);
    }

    function sweepExpired() external {
        require(block.timestamp > deadline, "window open");
        require(!swept, "swept");
        swept = true;
        uint256 bal = token.balanceOf(address(this));
        if (bal > 0) {
            require(token.transfer(treasury, bal), "transfer failed");
        }
        emit Swept(treasury, bal);
    }
}
