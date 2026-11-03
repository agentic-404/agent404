// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./Agent404.sol";

/// @notice Minimal ERC20 surface of the A404 fee token.
interface IAgentFunFeeToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title AgentFunFactory — DN-404 launchpad for the Agent ID ecosystem.
/// @notice Anyone can launch their own DN-404 token (Agent ID-gated badges,
///         freely traded token side) by paying a flat fee in A404:
///         half of the fee is burned, half is routed out immediately to
///         the reserve wallet, where it forms the token side of the End
///         Game LP reserve. This contract never holds a reserve balance:
///         its own A404 balance returns to zero after every launch. The
///         child's supply goes straight to the launcher's wallet (v1).
/// @dev    No owner, no admin, no withdraw, no pause, no upgrade. The fee
///         and the reserve wallet are locked in the constructor forever; a
///         change to either means a new factory.
contract AgentFunFactory {
    /// @notice The A404 token the launch fee is paid in.
    IAgentFunFeeToken public immutable a404;

    /// @notice The Agent ID registry every launched child gates badges on.
    address public immutable agentRegistry;

    /// @notice Where the reserve half of every fee is routed the moment a
    ///         launch settles (the project wallet that will seed the End
    ///         Game LP). Immutable; this contract holds no reserve itself.
    address public immutable reserveWallet;

    /// @notice Flat launch fee in A404 (404 A404 in the v1 deployment).
    uint256 public immutable FEE;

    /// @notice Burn destination for half of every fee.
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    struct Launch {
        address creator;
        address token;
        address mirror;
        uint256 supply;
        uint256 timestamp;
    }

    Launch[] private _launches;
    mapping(address => uint256[]) private _launchIndicesOf;

    uint256 public totalLaunches;
    uint256 public totalFeesCollected;
    uint256 public totalBurned;
    /// @notice Cumulative A404 reserve halves routed to the reserve wallet
    ///         (the running audit total; the funds themselves sit in the
    ///         reserve wallet, never in this contract).
    uint256 public totalReserved;

    uint256 private _lock = 1;

    event Launched(
        address indexed creator, address indexed token, address mirror, uint256 supply, uint256 index
    );

    error ZeroAddress();
    error ZeroFee();
    error FeeTransferFailed();
    error FeeNotFullyReceived();
    error BurnTransferFailed();
    error ReserveTransferFailed();
    error Reentrant();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrant();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(address a404Token, address agentRegistry_, uint256 feeWei, address reserveWallet_) {
        if (a404Token == address(0) || agentRegistry_ == address(0) || reserveWallet_ == address(0)) {
            revert ZeroAddress();
        }
        if (feeWei == 0) revert ZeroFee();
        a404 = IAgentFunFeeToken(a404Token);
        agentRegistry = agentRegistry_;
        FEE = feeWei;
        reserveWallet = reserveWallet_;
    }

    /// @notice Half of the fee, burned on every launch (202 A404 at the v1 fee).
    function BURN_HALF() public view returns (uint256) {
        return FEE / 2;
    }

    function launchesCount() public view returns (uint256) {
        return _launches.length;
    }

    function launchAt(uint256 index) public view returns (Launch memory) {
        return _launches[index];
    }

    /// @notice Registry indices of every launch by `creator` (see launchAt).
    function launchesOf(address creator) public view returns (uint256[] memory) {
        return _launchIndicesOf[creator];
    }

    /// @notice Launch a new DN-404 token. Pulls the A404 fee from the caller
    ///         (approve first), burns half, routes the reserve half to the
    ///         reserve wallet, deploys the child with the caller as initial
    ///         supply owner, and records the launch — all in one atomic
    ///         transaction: if any step fails, nothing happened.
    /// @return token The launched DN-404 token contract.
    /// @return mirror The launched token's DN404 mirror (badge collection).
    function launch(string memory name, string memory symbol, uint256 supply)
        external
        nonReentrant
        returns (address token, address mirror)
    {
        uint256 fee = FEE;
        uint256 burnHalf = fee / 2;

        // 1. Pull the fee, and verify it actually arrived in full — a token
        //    that under-delivers (fee-on-transfer illusions, lying
        //    transferFrom) must not buy a launch.
        uint256 balanceBefore = a404.balanceOf(address(this));
        if (!a404.transferFrom(msg.sender, address(this), fee)) revert FeeTransferFailed();
        if (a404.balanceOf(address(this)) != balanceBefore + fee) revert FeeNotFullyReceived();

        // 2. Burn half of the fee. A404 has no ledger-level burn function;
        //    the dead address is the project's burn destination (its A404
        //    can never move again).
        if (!a404.transfer(DEAD, burnHalf)) revert BurnTransferFailed();

        // 3. Route the reserve half OUT to the reserve wallet in the same
        //    transaction — it is the token side of the End Game LP reserve
        //    and must never sit trapped in this contract. After this, the
        //    factory's own A404 balance is back to what it was before the
        //    launch (zero in practice); only the counters remember it.
        uint256 reserveHalf = fee - burnHalf;
        if (!a404.transfer(reserveWallet, reserveHalf)) revert ReserveTransferFailed();
        totalBurned += burnHalf;
        totalReserved += reserveHalf;
        totalFeesCollected += fee;
        totalLaunches += 1;

        // 4. Deploy the child, unmodified Agent404, supply to the launcher.
        Agent404 child = new Agent404(name, symbol, supply, msg.sender, agentRegistry);
        token = address(child);
        mirror = child.mirrorERC721();

        // 5. Record the launch in the public registry.
        uint256 index = _launches.length;
        _launches.push(
            Launch({
                creator: msg.sender,
                token: token,
                mirror: mirror,
                supply: supply,
                timestamp: block.timestamp
            })
        );
        _launchIndicesOf[msg.sender].push(index);

        emit Launched(msg.sender, token, mirror, supply, index);
    }
}
