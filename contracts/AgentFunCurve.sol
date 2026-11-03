// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/// @notice Minimal ERC20 surface of the launched DN-404 child token.
interface IAgentFunCurveToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @notice The slice of the PancakeSwap V2 factory the curve uses.
interface IPancakeFactory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

/// @notice The slice of the PancakeSwap V2 router the curve uses.
interface IPancakeRouter {
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
}



/// @title AgentFunCurve — one bonding curve per AgentFun v2 launch.
/// @notice Holds the launched token's full 10,000 supply. 8,000 is sold
///         against a constant-product curve on VIRTUAL reserves, quoted in
///         native BNB (pump.fun / four.meme shape); 2,000 is reserved,
///         untouchable by trades, for the graduation liquidity. When the
///         sale allocation exhausts — by construction at ~18 BNB of real
///         net intake — the completing buy atomically graduates the token:
///         the collected BNB and the 2,000 are deposited into a fresh
///         PancakeSwap V2 pair and the LP tokens are minted directly to
///         the dead address.
/// @dev    No owner, no admin, no pause, no upgrade. All accounting is
///         state-based (never balance-based), so BNB force-sent to this
///         contract is inert. Trade fee: 1% of trade value — 0.7% accrues
///         to the token's creator (claimable any time, also after
///         graduation), 0.3% accrues as End Game fees and is swept
///         directly to the reserve wallet at graduation (the curve never
///         routes value through the factory, so no reserve can ever be
///         trapped in either contract).
///
///         Curve parameters (locked): virtual BNB reserve 5 BNB; virtual
///         token reserve 10,222,222,222,222,222,222,222 wei-tokens.
///         NOTE on the token reserve: the design doc's original 1.08x
///         figure is inconsistent with the locked 18 BNB graduation under
///         x*y=k (it would exhaust the 8,000 allocation at only ~14.29 BNB
///         of net intake). The virtual token reserve is therefore set to
///         8,000 + (5 BNB * 8,000 / 18 BNB) = 10,222.22 tokens, the unique
///         value at which the allocation exhausts at 18 BNB of net intake
///         (within 1 wei of rounding; the reserve is the 1.0222...x-supply
///         rescale of the 1B draft, floored in wei). Resulting shape:
///         starting market cap ~4.89 BNB, graduation market cap
///         ~103.5 BNB — unchanged, because the shape is supply-relative.
contract AgentFunCurve {
    // ----- locked constants -----

    uint256 public constant TOTAL_SUPPLY = 10_000 ether;
    uint256 public constant SALE_ALLOCATION = 8_000 ether;
    uint256 public constant LP_ALLOCATION = 2_000 ether;

    uint256 public constant VIRTUAL_BNB_START = 5 ether;
    uint256 public constant VIRTUAL_TOKEN_START = 10_222_222_222_222_222_222_222;

    /// @notice Trade fee: 1% of trade value (100 / 10000).
    uint256 public constant TRADE_FEE_BPS = 100;
    /// @notice Creator share of trade value: 0.7% (70 / 10000); the rest of
    ///         the 1% fee (0.3%) is the End Game share.
    uint256 public constant CREATOR_FEE_BPS = 70;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // ----- wiring (immutable) -----

    /// @notice The launched DN-404 child token.
    IAgentFunCurveToken public immutable token;
    /// @notice The launch's creator; receives the 0.7% trade-fee share.
    address public immutable creator;
    /// @notice Where the 0.3% End Game fee share is swept at graduation —
    ///         handed down by the factory at deployment (the project wallet
    ///         that will seed the End Game LP). Immutable.
    address public immutable reserveWallet;
    address public immutable pancakeFactory;
    address public immutable pancakeRouter;
    address public immutable wbnb;

    // ----- curve state -----

    uint256 public virtualBnb;
    uint256 public virtualToken;
    /// @notice Tokens sold out of the sale allocation, net of buy-backs.
    uint256 public tokensSold;
    /// @notice Real (net) BNB taken in by trades and not yet paid out —
    ///         exactly the BNB deposited into the pair at graduation.
    uint256 public realBnbCollected;
    uint256 public creatorFeesAccrued;
    uint256 public endgameFeesAccrued;
    /// @notice Cumulative End Game BNB already swept to the reserve wallet
    ///         (the running audit total; zero until graduation).
    uint256 public totalEndgameSwept;
    bool public graduated;
    /// @notice The PancakeSwap V2 pair created at graduation (zero before).
    address public pair;

    uint256 private _lock = 1;

    // ----- events -----

    event Buy(address indexed buyer, uint256 bnbIn, uint256 tokensOut, uint256 fee);
    event Sell(address indexed seller, uint256 tokensIn, uint256 bnbOut, uint256 fee);
    event Graduate(address indexed pair, uint256 tokenAmount, uint256 bnbAmount, uint256 liquidity);
    event CreatorFeesClaimed(address indexed creator, uint256 amount);
    event EndgameSwept(address indexed reserveWallet, uint256 amount);

    // ----- errors -----

    error ZeroAddress();
    error ZeroValue();
    error AlreadyGraduated();
    error InsufficientOutput();
    error Slippage(uint256 got, uint256 minWanted);
    error TokenTransferFailed();
    error TokensNotFullyReceived();
    error BnbTransferFailed();
    error NotCreator();
    error NothingToClaim();
    error ApproveFailed();
    error Reentrant();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrant();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(
        address token_,
        address creator_,
        address reserveWallet_,
        address pancakeFactory_,
        address pancakeRouter_,
        address wbnb_
    ) {
        if (
            token_ == address(0) || creator_ == address(0) || reserveWallet_ == address(0)
                || pancakeFactory_ == address(0) || pancakeRouter_ == address(0) || wbnb_ == address(0)
        ) revert ZeroAddress();
        token = IAgentFunCurveToken(token_);
        creator = creator_;
        reserveWallet = reserveWallet_;
        pancakeFactory = pancakeFactory_;
        pancakeRouter = pancakeRouter_;
        wbnb = wbnb_;
        virtualBnb = VIRTUAL_BNB_START;
        virtualToken = VIRTUAL_TOKEN_START;
    }

    // ----- public reads -----

    /// @notice Spot price in BNB per whole token, scaled by 1e18.
    function spotPrice() public view returns (uint256) {
        return virtualBnb * 1e18 / virtualToken;
    }

    /// @notice Tokens left in the sale allocation.
    function tokensRemaining() public view returns (uint256) {
        return SALE_ALLOCATION - tokensSold;
    }

    // ----- quotes (the trade functions use the exact same math) -----

    /// @notice Full quote for a buy of `gross` BNB (before the 1% fee).
    /// @return tokensOut Tokens the buyer receives (capped at the remaining
    ///         sale allocation).
    /// @return grossUsed BNB actually consumed (less than `gross` only on
    ///         the capped, graduation-crossing buy; the rest is refunded).
    /// @return fee Total 1% fee charged, on `grossUsed`.
    /// @return creatorFee The 0.7% creator share of the fee basis.
    /// @return endgameFee The remainder of the fee (the 0.3% End Game share).
    function quoteBuy(uint256 gross)
        public
        view
        returns (uint256 tokensOut, uint256 grossUsed, uint256 fee, uint256 creatorFee, uint256 endgameFee)
    {
        uint256 netUsed;
        (tokensOut, grossUsed, netUsed, fee, creatorFee, endgameFee) = _buyMath(gross);
    }

    /// @notice Full quote for selling `tokensIn` tokens back to the curve.
    function quoteSell(uint256 tokensIn)
        public
        view
        returns (uint256 bnbOut, uint256 fee, uint256 creatorFee, uint256 endgameFee)
    {
        (uint256 dx, uint256 f, uint256 cf, uint256 ef) = _sellMath(tokensIn);
        return (dx - f, f, cf, ef);
    }

    // ----- trades -----

    /// @notice Buy tokens with BNB. If this buy exhausts the sale
    ///         allocation it is capped at the remainder, the excess BNB is
    ///         refunded in the same transaction, and graduation executes
    ///         atomically inside this call.
    function buy(uint256 minTokensOut) external payable nonReentrant returns (uint256 tokensOut) {
        if (graduated) revert AlreadyGraduated();
        uint256 gross = msg.value;
        if (gross == 0) revert ZeroValue();

        (uint256 dy, uint256 grossUsed, uint256 netUsed, uint256 fee, uint256 creatorFee, uint256 endgameFee) =
            _buyMath(gross);
        if (dy == 0) revert InsufficientOutput();
        if (dy < minTokensOut) revert Slippage(dy, minTokensOut);

        virtualBnb += netUsed;
        virtualToken -= dy;
        tokensSold += dy;
        realBnbCollected += netUsed;
        creatorFeesAccrued += creatorFee;
        endgameFeesAccrued += endgameFee;
        tokensOut = dy;

        if (!token.transfer(msg.sender, dy)) revert TokenTransferFailed();
        uint256 refund = gross - grossUsed;
        if (refund > 0) _sendBnb(msg.sender, refund);

        emit Buy(msg.sender, grossUsed, dy, fee);

        if (tokensSold == SALE_ALLOCATION) _graduate();
    }

    /// @notice Sell tokens back to the curve for BNB (approve first).
    function sell(uint256 tokensIn, uint256 minBnbOut) external nonReentrant returns (uint256 bnbOut) {
        if (graduated) revert AlreadyGraduated();
        if (tokensIn == 0) revert ZeroValue();

        (uint256 dx, uint256 fee, uint256 creatorFee, uint256 endgameFee) = _sellMath(tokensIn);
        if (dx == 0) revert InsufficientOutput();
        bnbOut = dx - fee;
        if (bnbOut < minBnbOut) revert Slippage(bnbOut, minBnbOut);

        // Pull the tokens, verifying full receipt (the accounting below
        // assumes exactly `tokensIn` arrived).
        uint256 balanceBefore = token.balanceOf(address(this));
        if (!token.transferFrom(msg.sender, address(this), tokensIn)) revert TokenTransferFailed();
        if (token.balanceOf(address(this)) != balanceBefore + tokensIn) {
            revert TokensNotFullyReceived();
        }

        virtualToken += tokensIn;
        virtualBnb -= dx;
        tokensSold -= tokensIn;
        realBnbCollected -= dx;
        creatorFeesAccrued += creatorFee;
        endgameFeesAccrued += endgameFee;

        _sendBnb(msg.sender, bnbOut);

        emit Sell(msg.sender, tokensIn, bnbOut, fee);
    }

    /// @notice Claim the creator's accrued 0.7% trade fees. Callable at any
    ///         time, including after graduation.
    function claimCreatorFees() external nonReentrant returns (uint256 amount) {
        if (msg.sender != creator) revert NotCreator();
        amount = creatorFeesAccrued;
        if (amount == 0) revert NothingToClaim();
        creatorFeesAccrued = 0;
        _sendBnb(creator, amount);
        emit CreatorFeesClaimed(creator, amount);
    }

    // ----- internals -----

    /// @dev Constant-product buy math on the virtual reserves. The fee is
    ///      charged on the BNB actually consumed: on a normal buy that is
    ///      the full `gross`; on the capped (graduation-crossing) buy the
    ///      consumed gross is re-derived from the net the remaining
    ///      allocation costs, so the refunded excess is never fee'd.
    function _buyMath(uint256 gross)
        internal
        view
        returns (
            uint256 dy,
            uint256 grossUsed,
            uint256 netUsed,
            uint256 fee,
            uint256 creatorFee,
            uint256 endgameFee
        )
    {
        uint256 vB = virtualBnb;
        uint256 vT = virtualToken;
        uint256 net = gross - gross * TRADE_FEE_BPS / BPS_DENOMINATOR;
        dy = vT * net / (vB + net);
        uint256 remaining = SALE_ALLOCATION - tokensSold;
        if (dy <= remaining) {
            grossUsed = gross;
            netUsed = net;
        } else {
            // Capped at the remaining allocation: charge only for the net
            // BNB that actually buys it (rounded up in the curve's favor).
            dy = remaining;
            netUsed = _ceilDiv(vB * dy, vT - dy);
            if (netUsed > net) netUsed = net;
            grossUsed = _ceilDiv(netUsed * BPS_DENOMINATOR, BPS_DENOMINATOR - TRADE_FEE_BPS);
            if (grossUsed > gross) grossUsed = gross;
        }
        fee = grossUsed - netUsed;
        creatorFee = grossUsed * CREATOR_FEE_BPS / BPS_DENOMINATOR;
        if (creatorFee > fee) creatorFee = fee;
        endgameFee = fee - creatorFee;
    }

    /// @dev Constant-product sell math: `dx` is the gross BNB the curve pays
    ///      for `tokensIn`; the 1% fee is deducted from it.
    function _sellMath(uint256 tokensIn)
        internal
        view
        returns (uint256 dx, uint256 fee, uint256 creatorFee, uint256 endgameFee)
    {
        dx = virtualBnb * tokensIn / (virtualToken + tokensIn);
        fee = dx * TRADE_FEE_BPS / BPS_DENOMINATOR;
        creatorFee = dx * CREATOR_FEE_BPS / BPS_DENOMINATOR;
        if (creatorFee > fee) creatorFee = fee;
        endgameFee = fee - creatorFee;
    }

    /// @dev Graduation: freeze the curve, sweep the End Game accrual
    ///      directly to the reserve wallet, and seed the PancakeSwap V2
    ///      pair with the 2,000 LP allocation + all collected real BNB.
    ///      LP tokens are minted directly to the dead address by the
    ///      router. After this settles, the only BNB left in the curve is
    ///      the creator's unclaimed fee share — nothing is trapped.
    function _graduate() internal {
        graduated = true;
        uint256 bnbForLp = realBnbCollected;
        realBnbCollected = 0;

        uint256 endgame = endgameFeesAccrued;
        endgameFeesAccrued = 0;
        if (endgame > 0) {
            totalEndgameSwept += endgame;
            _sendBnb(reserveWallet, endgame);
            emit EndgameSwept(reserveWallet, endgame);
        }

        address pairAddr = IPancakeFactory(pancakeFactory).getPair(address(token), wbnb);
        if (pairAddr == address(0)) {
            pairAddr = IPancakeFactory(pancakeFactory).createPair(address(token), wbnb);
        }
        pair = pairAddr;

        if (!token.approve(pancakeRouter, LP_ALLOCATION)) revert ApproveFailed();
        (uint256 amountToken, uint256 amountBnb, uint256 liquidity) = IPancakeRouter(pancakeRouter)
            .addLiquidityETH{value: bnbForLp}(
            address(token), LP_ALLOCATION, 0, 0, DEAD, block.timestamp
        );

        emit Graduate(pairAddr, amountToken, amountBnb, liquidity);
    }

    function _sendBnb(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert BnbTransferFailed();
    }

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }
}
