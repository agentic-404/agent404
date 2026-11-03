// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./AgentFunDeployers.sol";

/// @notice Minimal ERC20 surface of the A404 fee token.
interface IAgentFunV2FeeToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Minimal surface of a launched child token (moving its supply).
interface IAgentFunV2ChildToken {
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title AgentFunFactoryV2 — bonding-curve launches for the Agent ID ecosystem.
/// @notice Anyone can launch a DN-404 token on a pump.fun-style bonding
///         curve (quoted in native BNB) by paying the flat A404 launch
///         fee: half of the fee is burned, half is routed out immediately
///         to the reserve wallet (the token side of the End Game LP
///         reserve) — exactly as v1. This contract never holds a reserve
///         balance. The child's supply is FIXED at 10,000, minted in full
///         to its freshly deployed AgentFunCurve; the creator starts with
///         0 tokens and buys on the curve like everyone else. Each curve
///         likewise sweeps its accrued 0.3%-of-trades End Game fees
///         directly to the reserve wallet at graduation (the BNB side of
///         the End Game LP) — no value ever accumulates inside this
///         factory or a curve beyond the creator's claimable fee share.
/// @dev    No owner, no admin, no withdraw, no pause, no upgrade, and no
///         BNB sink: value flows through, never pools here. Child and
///         curve creation live in AgentFunChildDeployer /
///         AgentFunCurveDeployer (deployed once, in this constructor) so
///         this contract's deployed runtime stays under the 24,576-byte
///         BSC code-size limit — the creation code is not embedded here.
contract AgentFunFactoryV2 {
    /// @notice The A404 token the launch fee is paid in.
    IAgentFunV2FeeToken public immutable a404;

    /// @notice The Agent ID registry every launched child gates badges on.
    address public immutable agentRegistry;

    /// @notice Where the reserve half of every launch fee is routed the
    ///         moment a launch settles, and where every curve sweeps its
    ///         End Game BNB at graduation (the project wallet that will
    ///         seed the End Game LP). Immutable; set once at construction.
    address public immutable reserveWallet;

    /// @notice Flat launch fee in A404 (101 A404 in the mainnet deployment).
    uint256 public immutable FEE;

    /// @notice PancakeSwap V2 wiring handed to every deployed curve.
    address public immutable pancakeFactory;
    address public immutable pancakeRouter;
    address public immutable wbnb;

    /// @notice Creation-code hosts (deployed in the constructor below).
    AgentFunChildDeployer public immutable childDeployer;
    AgentFunCurveDeployer public immutable curveDeployer;

    /// @notice Burn destination for half of every launch fee.
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    /// @notice Fixed child supply for every curve launch (10,000).
    uint256 public constant CHILD_SUPPLY = 10_000 ether;

    struct CurveLaunch {
        address creator;
        address token;
        address mirror;
        address curve;
        uint256 timestamp;
    }

    CurveLaunch[] private _launches;
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
        address indexed creator,
        address indexed token,
        address mirror,
        address curve,
        uint256 index
    );

    error ZeroAddress();
    error ZeroFee();
    error FeeTransferFailed();
    error FeeNotFullyReceived();
    error BurnTransferFailed();
    error ReserveTransferFailed();
    error SupplyTransferFailed();
    error Reentrant();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrant();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(
        address a404Token,
        address agentRegistry_,
        uint256 feeWei,
        address pancakeFactory_,
        address pancakeRouter_,
        address wbnb_,
        address reserveWallet_
    ) {
        if (
            a404Token == address(0) || agentRegistry_ == address(0) || pancakeFactory_ == address(0)
                || pancakeRouter_ == address(0) || wbnb_ == address(0) || reserveWallet_ == address(0)
        ) revert ZeroAddress();
        if (feeWei == 0) revert ZeroFee();
        a404 = IAgentFunV2FeeToken(a404Token);
        agentRegistry = agentRegistry_;
        FEE = feeWei;
        pancakeFactory = pancakeFactory_;
        pancakeRouter = pancakeRouter_;
        wbnb = wbnb_;
        reserveWallet = reserveWallet_;
        // One-time creation-code hosts. Their init code lives in this
        // constructor (init code), never in the deployed runtime below.
        childDeployer = new AgentFunChildDeployer();
        curveDeployer = new AgentFunCurveDeployer();
    }

    /// @notice Half of the fee, burned on every launch (50.5 A404 at the
    ///         mainnet fee of 101).
    function BURN_HALF() public view returns (uint256) {
        return FEE / 2;
    }

    function launchesCount() public view returns (uint256) {
        return _launches.length;
    }

    function launchAt(uint256 index) public view returns (CurveLaunch memory) {
        return _launches[index];
    }

    /// @notice Registry indices of every curve launch by `creator`.
    function launchesOf(address creator) public view returns (uint256[] memory) {
        return _launchIndicesOf[creator];
    }

    /// @notice Launch a new DN-404 token on a bonding curve. Pulls the A404
    ///         fee from the caller (approve first), burns half, routes the
    ///         reserve half to the reserve wallet, deploys the child with
    ///         its full fixed 10,000 supply, deploys its curve, moves the
    ///         whole supply into the curve, and records the launch — all
    ///         in one atomic transaction.
    /// @return token The launched DN-404 token contract.
    /// @return mirror The launched token's DN404 mirror (badge collection).
    /// @return curve The launched token's AgentFunCurve.
    function launchCurve(string memory name, string memory symbol)
        external
        nonReentrant
        returns (address token, address mirror, address curve)
    {
        uint256 fee = FEE;
        uint256 burnHalf = fee / 2;

        // 1. Pull the fee, and verify it actually arrived in full (same
        //    discipline as v1: a token that under-delivers buys nothing).
        uint256 balanceBefore = a404.balanceOf(address(this));
        if (!a404.transferFrom(msg.sender, address(this), fee)) revert FeeTransferFailed();
        if (a404.balanceOf(address(this)) != balanceBefore + fee) revert FeeNotFullyReceived();

        // 2. Burn half of the fee to the dead address (A404 has no ledger
        //    burn; the dead address is the project's burn destination).
        if (!a404.transfer(DEAD, burnHalf)) revert BurnTransferFailed();

        // 3. Route the reserve half OUT to the reserve wallet in the same
        //    transaction — after this, the factory's own A404 balance is
        //    back to what it was before the launch (zero in practice).
        uint256 reserveHalf = fee - burnHalf;
        if (!a404.transfer(reserveWallet, reserveHalf)) revert ReserveTransferFailed();
        totalBurned += burnHalf;
        totalReserved += reserveHalf;
        totalFeesCollected += fee;
        totalLaunches += 1;

        // 4. Deploy the child, unmodified Agent404, fixed 10,000 supply,
        //    initially held by this factory (via the creation-code host)...
        (token, mirror) = childDeployer.deployChild(
            name, symbol, CHILD_SUPPLY, address(this), agentRegistry
        );

        // 5. ...deploy its bonding curve, wired to the caller as creator
        //    and to the reserve wallet for its End Game sweep...
        curve = curveDeployer.deployCurve(
            token, msg.sender, reserveWallet, pancakeFactory, pancakeRouter, wbnb
        );

        // 6. ...and move the whole supply into the curve. Both sides are
        //    contracts (badge-skipped), so no badges move in this transfer.
        if (!IAgentFunV2ChildToken(token).transfer(curve, CHILD_SUPPLY)) {
            revert SupplyTransferFailed();
        }

        // 7. Record the launch in the public registry.
        uint256 index = _launches.length;
        _launches.push(
            CurveLaunch({
                creator: msg.sender,
                token: token,
                mirror: mirror,
                curve: curve,
                timestamp: block.timestamp
            })
        );
        _launchIndicesOf[msg.sender].push(index);

        emit Launched(msg.sender, token, mirror, curve, index);
    }
}
