// AGENT404 — chain configuration (BSC mainnet).
// All addresses, selectors, event topics and deadlines are ported from the
// live site (site/index.html) and the project repository — verified facts.

export const RPCS = [
  'https://bsc-rpc.publicnode.com',
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed2.binance.org',
  'https://binance.llamarpc.com',
];

export const A = {
  token: '0xB7E2f2D6ED4928F6fA774Ff9295D01f25aA17725',
  mirror: '0xB61b93704ae5c1d1D48Cd97A18D78F23a4912b07',
  claim: '0xbc520775Ba4ce3760eD631c439929E8B19556c94',
  sale: '0xDb8452C9c8d3d6b9680Ce7414a4610DBCF9445F9',
  market: '0x076Ea27B59aC73738b8c970d727aCCb4f77685A7',
  funV1: '0x4F8c54645bbCDcfCEC3f100CB2438DAeDD83cf00',
  funV2: '0x320eaE47B443Bcf15eAf73B75B5e11656CB12315',
  agentlp: '0xe5DaAf69E96cc82903D43C6e3CFc7fBB33d078A0',
  // PASSDROP #1 — live on BSC mainnet since 2026-11-06 (deploy record:
  // PASSDROP1-MAINNET-DEPLOY.md). The PassDrop page's monitor reads this
  // engine; the event token is GENESIS404 (G404).
  passdrop: '0xCD2401b13d66A37D04a7356d776162154Eb11719',
  g404: '0xb6Ad15244d9c4b259D5080BE4900fba07fe5D8e8',
  // AGENTS MINE (Agent404ListingEngine) — LIVE on BSC mainnet since
  // 2026-11-12 (deploy tx 0xe2cb12406fbde7685e010445f6ecdfdd6cadc37655df2c1d295d16a64247476e,
  // block 133130463; activated the same day, chargeEnd 2026-11-26 08:48 UTC).
  // The Mine page reads this engine live.
  mine: '0x7d8e34cBbf5d171391f43154cc5B5334f40667c1',
  // AGENT LAUNCHPAD factory (AgentLaunchpad) — deployed 2026-11-12
  // (deploy tx 0xb0fa3eb02a7ed39fb33d7dda530037dfd32ee8f4bfb8483d6f53e34742221872,
  // block 133150003). The Launchpad page reads this factory live.
  launchpad: '0x85B758B716C2077fdda25248F8a663eCe29776eF',
  // DAILY POOL (DailyPoolEngineV2) — LIVE on BSC mainnet since 2026-11-15
  // (deploy tx 0xfa419abe090ebe5a16de29f1959c3b94d786516b13dfbd44d576a21d7350d07c,
  // block 133679743; round 0 opens 2026-11-16 00:00 UTC). One-day rounds:
  // paid tickets 0.001 BNB + 20 free FCFS slots/day, two-step reveal
  // (60% paid / 10% free), 20% rollover, 10% platform. A round ending
  // with fewer than 10 paid tickets FAILS — no draw, each paid ticket
  // refunds 90% within 7 days. The Daily Pool page reads this engine
  // live. V1 (0xf4DD6bEf5Eb16D9d3047772951A4530C59fFf64a) was STOPPED by
  // the operator on 2026-11-13 and is never written to again.
  dailyPool: '0xb0755Cb1512aDF14E47bF4D206657BFa7b74beA1',
  // AGENTS PREDICT (AgentsPredictV2) — LIVE on BSC mainnet since 2026-11-16
  // (deploy tx 0x0221c687cf8c985ffad8626e2a08c28eb92da2f94c1b6d3879456d289e9d9503,
  // block 133868850; first bettable round 2991344 opens 2026-11-16 05:20 UTC).
  // Prediction market for agents: BTCUSDT (PancakeSwap V2 BTCB/USDT TWAP),
  // 10-minute rounds, Agent ID only, min bet 0.001 BNB, winners split 95%
  // of the total pot pro-rata, 5% house cut, tie (|settle-ref| <= 5 bps)
  // and void rounds refund 99%, claims expire after 30 days. V2 adds an
  // early-bettor reward: the first 20 Agent-ID wallets to bet each receive
  // 10 A404 in the bet transaction, inside a 7-day window from deploy.
  // The Predict page reads this contract live. V1
  // (0xd5911C07f71D67F87FB469122Ff300E9c6584FFd) is superseded and never
  // written to again.
  predict: '0x5f72949671011F0Af2FA05f040a49A04187b890f',
  // AGENT MOONSHOT (MoonshotFactory) — LIVE on BSC mainnet since 2026-11-16.
  // Bonding-curve lane on the Launchpad: launch → instantly tradable on
  // the curve → graduate to a PCS V2 pool with LP burned. The Moonshot
  // board reads this factory live. Token/curve implementations deployed
  // once; every launch clones them (EIP-1167).
  moonshot: '0x92F59b31F03477C0d74C16f0901c0DDA0ebAd1F0',
  moonshotTokenImpl: '0xF3b8A5a97b398750756ab516b04ddAF5a6b84fFD',
  moonshotCurveImpl: '0x7d55806939c78CCC84F67bAE3fd4F0119f829b5F',
  pair: '0x6116d6B62b35aAa9aCbC118eD7c51861c085de09', // canonical A404/WBNB pair — also the LP token
  muse: '0x95BB680BF7cC507B5E061ad04aBf09Cd44355Bb8', // Muse Agents (MUSE) — separate meme-token project by the same operator; listed on the Swap desk
  musePair: '0x96fc43614c6a212acad804d8d2c8c15ed1fd3fd2', // MUSE/WBNB pair — 100% of supply + $1 BNB, LP burned to DEAD (2026-11-16)
  museA404Pair: '0x7027D351bC3c7A2F64941D13898b34dFf01BA4b3', // MUSE/A404 pair — 1B MUSE + 71.26 A404 seeded by sterile, LP burned to DEAD (2026-11-16)
  router: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap V2 router
  factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', // PancakeSwap V2 factory
  wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  registry: '0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F',
  sterile: '0x6E97fDE1f313B967FCFBDB0b65d030C4D7674070', // community reserve / project wallet
  donate: '0x8007360De02a5c7Be316bf73761AC583D2aab4c9', // donation wallet — voluntary community support; rendered only in the site footer (truncated) and in llms.txt
  dead: '0x000000000000000000000000000000000000dEaD',
};

export const SEL = {
  totalSupply: '0x18160ddd',
  balanceOf: '0x70a08231',
  claims: '0xdcc59b6f',
  claimedBy: '0xc884ef83',
  sales: '0xaace52fe',
  activeCount: '0x4331ed1f',
  floorPrice: '0x9363c812',
  totalSales: '0x6605ff66',
  totalVolume: '0x5f81a57c',
  activeListings: '0xaa4df6f0',
  totalLaunches: '0x0e883f8b',
  totalFees: '0x60c6d8ae',
  totalBurned: '0xd89135cd',
  launchesCount: '0x63d0053d',
  launchAt: '0x7f5780c4',
  // AgentFunCurve views (V2 launches only — V1 launches have no curve).
  // Signatures from project/src/AgentFunCurve.sol; selectors via cast sig.
  curveRealBnb: '0xb8221fee', // realBnbCollected() — net BNB taken in
  curveGraduated: '0xe7c2b772', // graduated()
  curveSpotPrice: '0x398482d8', // spotPrice() — BNB per whole token, 1e18-scaled
  name: '0x06fdde03',
  symbol: '0x95d89b41',
  decimals: '0x313ce567',
  getPair: '0xe6a43905', // factory getPair(address,address)
  getAmountsOut: '0xd06ca61f', // router getAmountsOut(uint256,address[])
  ownerOf: '0x6352211e',
  tokenURI: '0xc87b56dd',
  totalCountedWeight: '0xf1e57e28',
  parkedBonus: '0x554f011e',
  currentStreamRate: '0x5753bba0',
  getReserves: '0x0902f1ac',
  // PassDropEventEngine views (PASSDROP #1 live monitor) — every selector
  // verified against the deployed contract's ABI and live-read on
  // 2026-11-06 (see PASSDROP1-MAINNET-DEPLOY.md).
  pdActivated: '0x186601ca', // activated()
  pdIgnited: '0x66092ea8', // ignited()
  pdAborted: '0x80b62b70', // aborted()
  pdCompleted: '0x9d9a7fe9', // completed()
  pdChargeEnd: '0x33b28750', // chargeEnd()
  pdCurrentRate: '0xf9f8bdb7', // currentRate() — live G404 reward per share
  pdPair: '0xa8aa1b31', // pair() — zero address until ignition
  pdTicketPrice: '0x1a95f15f', // TICKET_PRICE() — A404 per ticket share
  pdSharePrice: '0x71a2fbfa', // SHARE_PRICE() — BNB per Mode A/B share
  pdTargetShares: '0xe5864e8f', // targetShares()
  pdLpReserve: '0xada29fa9', // lpReserve()
  pdRewardReserve: '0xcab64bcd', // rewardReserve()
  pdTailReserve: '0x0ea6bc47', // tailReserve()
  pdRewardsOutstanding: '0xc5b5b2da', // rewardsOutstanding()
  pdVaultA404: '0xaec62df2', // vaultA404()
  pdTotalShares: '0x3a98ef39', // totalShares()
  pdTotalAShares: '0x94f6a62e', // totalAShares()
  pdTotalBShares: '0x54de3cce', // totalBShares()
  pdTotalTicketPaid: '0x3c304496', // totalTicketPaid()
  pdPolBNB: '0x6e60e760', // polBNB()
  pdAbortVault: '0xc9dc31e6', // abortVault()
  pdCoverageBps: '0x48ebfe9c', // coverageBps()
  pdLiquidFracBps: '0xc65f0350', // liquidFractionBps()
  // Agent404Engine views (AGENTS MINE) — same view signatures as the
  // event engine family; selectors verified via cast sig 2026-11-09.
  mineActivated: '0x186601ca', // activated()
  mineIgnited: '0x66092ea8', // ignited()
  mineChargeEnd: '0x33b28750', // chargeEnd()
  mineCurrentRate: '0xf9f8bdb7', // currentRate() — live A404 reward per share
  mineLpReserve: '0xada29fa9', // lpReserve()
  mineRewardReserve: '0xcab64bcd', // rewardReserve()
  mineTailReserve: '0x0ea6bc47', // tailReserve()
  mineRewardsOutstanding: '0xc5b5b2da', // rewardsOutstanding()
  mineTotalShares: '0x3a98ef39', // totalShares()
  mineTotalAShares: '0x94f6a62e', // totalAShares()
  mineTotalBShares: '0x54de3cce', // totalBShares()
  minePolBNB: '0x6e60e760', // polBNB()
  mineCoverageBps: '0x48ebfe9c', // coverageBps()
  mineLiquidFracBps: '0xc65f0350', // liquidFractionBps()
  mineTargetShares: '0xe5864e8f', // targetShares() — listing event layer
  mineCompleted: '0x9d9a7fe9', // completed() — listing event layer
  // AgentLaunchpad factory + AgentLaunchpadEngine views — every selector
  // computed with `cast sig` from the lab-built contract sources and
  // cross-checked against the compiled ABIs (2026-11-10). NOTE:
  // lpSharePrice is sharePrice() (a state-variable getter on the
  // launchpad engine), NOT the PassDrop engine's SHARE_PRICE()
  // constant — different selector.
  lpCount: '0x63d0053d', // factory launchesCount()
  lpLaunchAt: '0x7f5780c4', // factory launchAt(uint256) -> (launcher, token, mirror, engine, vip, createdAt)
  lpIsActive: '0x4f681451', // factory isLaunchActive(uint256)
  lpImageURI: '0x135d088d', // token imageURI()
  lpActivated: '0x186601ca', // engine activated()
  lpIgnited: '0x66092ea8', // engine ignited()
  lpCompleted: '0x9d9a7fe9', // engine completed()
  lpChargeEnd: '0x33b28750', // engine chargeEnd()
  lpTargetShares: '0xe5864e8f', // engine targetShares()
  lpTotalShares: '0x3a98ef39', // engine totalShares()
  lpTotalPaidIn: '0x2a3868c4', // engine totalPaidIn()
  lpSharePrice: '0x87269729', // engine sharePrice()
  lpPair: '0xa8aa1b31', // engine pair()
  // DailyPoolEngineV2 views — selectors computed with `cast sig` from
  // the lab-built contract source and verified against the compiled ABI
  // and live reads on the deployed contract (2026-11-15, deploy block
  // 133679743). roundStats returns 7 uint256s: paidWinners,
  // freeWinners, paidPrize, freePrize, platformPaid, rolloverOut,
  // unclaimed. V2 differences from V1: no no-arg roundStart()/roundEnd()
  // (use roundStartOf/roundEndOf with the round id); DEV_BPS renamed
  // PLATFORM_BPS; new roundStatus() view (0 OPEN / 1 ENDED / 2 DRAWN /
  // 3 FAILED / 4 DEAD / 5 SWEPT) and the refund views (refundOf,
  // refundWindowEndOf, refundableOf, refundClaimedOf).
  dpCurrentRound: '0x8a19c8bc', // currentRound()
  dpRoundStartOf: '0x2bd83e79', // roundStartOf(uint256)
  dpRoundEndOf: '0xc9f69b52', // roundEndOf(uint256)
  dpPotOf: '0xfa79e017', // potOf(uint256)
  dpPaidTicketCount: '0xa2f60cc2', // paidTicketCount(uint256)
  dpFreeTicketCount: '0x986911fd', // freeTicketCount(uint256)
  dpFreeUsed: '0xc8391f2f', // freeUsed(uint256) — free slots taken this round
  dpRoundStats: '0x259d33c1', // roundStats(uint256)
  dpDrawBlockOf: '0xe458bfeb', // drawBlockOf(uint256) — 0 = draw not committed
  dpPaidWinners: '0xa9d80b3f', // paidWinners(uint256,uint256) -> address
  dpFreeWinners: '0xb6d5198e', // freeWinners(uint256,uint256) -> address
  dpPrizeOf: '0x5acf2135', // prizeOf(uint256,address) — 0 after claiming
  dpUnclaimedTotal: '0xd98c1e64', // unclaimedTotal()
  dpPaidToday: '0x282a1c5a', // paidToday(uint256,address)
  dpFreeTaken: '0x8af74271', // freeTaken(uint256,address)
  dpRoundStatus: '0xe35154a5', // roundStatus(uint256) -> RoundStatus (0-5)
  dpRefundOf: '0x96028d3c', // refundOf(uint256,address) — 0 unless failed + in window + unclaimed
  dpRefundWindowEndOf: '0x848dc2a1', // refundWindowEndOf(uint256) — round end + 7 days
  dpRefundableOf: '0x88af155a', // refundableOf(uint256) — recorded refundable total (0 until settled)
  dpRefundClaimedOf: '0xd2f8486c', // refundClaimedOf(uint256) — wei already claimed as refunds
  // DailyPoolEngineV2 public constants — selectors computed with `cast
  // sig` from the lab-built contract source (2026-11-15). Every
  // number the Daily Pool page shows comes from these live reads,
  // never from a literal in the view.
  dpTicketPrice: '0x1a95f15f', // TICKET_PRICE()
  dpMaxPaidPerDay: '0xf0aa9eb2', // MAX_PAID_PER_DAY()
  dpFreeSlotsPerDay: '0xc43752b6', // FREE_SLOTS_PER_DAY()
  dpMaxPaidWinners: '0x828e4362', // MAX_PAID_WINNERS()
  dpMaxFreeWinners: '0xbe119747', // MAX_FREE_WINNERS()
  dpPaidDrawBps: '0x8fc9e3d8', // PAID_DRAW_BPS()
  dpFreeDrawBps: '0xae85a6c2', // FREE_DRAW_BPS()
  dpRolloverBps: '0xa430ce87', // ROLLOVER_BPS()
  dpPlatformBps: '0xce91e164', // PLATFORM_BPS() — V1 called it DEV_BPS
  dpBps: '0x249d39e9', // BPS()
  dpRoundLength: '0x9e817c03', // ROUND_LENGTH()
  dpLongstop: '0x08587e22', // LONGSTOP()
  dpDrawWindow: '0xd9b7e66c', // DRAW_WINDOW()
  dpMinPaidTickets: '0xdee882fb', // MIN_PAID_TICKETS() — a round needs this many paid tickets to draw
  dpRefundPerTicket: '0x92942a55', // REFUND_PER_TICKET() — 0.0009 BNB, 90% of a ticket
  dpRefundWindow: '0x1153b5f3', // REFUND_WINDOW() — 7 days from the round end
  // AgentsPredict views — selectors computed with `cast sig` from the
  // lab-built contract source and verified against live reads on the
  // deployed contract (2026-11-16, V2 deploy block 133868850). rounds()
  // returns the 10-word Round struct: refPrice, openCum, openTime,
  // settlePrice, upTotal, downTotal, outcome (0 open / 1 UP / 2 DOWN /
  // 3 TIE / 4 VOID), resolvedAt, payoutPool, winBase. TWAP prices are
  // Q112 (USDT per BTCB × 2^112) — divide by 2^112 to display.
  prCurrentRound: '0x8a19c8bc', // currentRound() — block.timestamp / 600
  prFirstRound: '0x333e530e', // firstRound() — first bettable round
  prRounds: '0x8c65c81f', // rounds(uint256) — the Round struct
  prPreviewRef: '0x17ecd21c', // previewReference() — Q112 TWAP reference
  prPreviewSettle: '0xc85d590c', // previewSettlement(uint256) — Q112, 0 before the 5-min floor
  prClaimable: '0xa0c7f71c', // claimable(uint256,address)
  prRoundLen: '0xb24ae1f8', // ROUND() — 600 seconds
  prMinBet: '0x6540742f', // MIN_BET() — 0.001 BNB
  prHouseBps: '0xd5e213d5', // HOUSE_BPS() — 500 (5% of the total pot)
  prRefundBps: '0x37db35b3', // REFUND_BPS() — 9900 (99% back on tie/void)
  prTieBandBps: '0xfdd50438', // TIE_BAND_BPS() — 5
  prLongstop: '0x08587e22', // LONGSTOP() — 30 days
  prUpBets: '0xcbe91b80', // upBets(uint256,address)
  prDownBets: '0xb7bb7c90', // downBets(uint256,address)
  prRemaining: '0x0361bf14', // remaining(uint256)
  prPair: '0xa8aa1b31', // pair() — the BTCB/USDT pair
  prRegistry: '0x7b103999', // registry() — the Agent ID registry
  prProjectWallet: '0xbeb08ab9', // projectWallet()
  // AgentsPredictV2 early-bettor reward — selectors computed with `cast
  // sig` from the V2 source and verified against live reads on the
  // deployed V2 contract (2026-11-16, block 133868850).
  prRewardCount: '0x79085425', // rewardCount() — rewards paid so far
  prRewardCap: '0x206ade24', // REWARD_CAP() — 20 wallets
  prRewardDeadline: '0x4baf252b', // rewardDeadline() — deploy + 7 days
  prRewardPerBet: '0x7b059c8e', // REWARD_PER_BET() — 10 A404
  prRewardToken: '0xf7c618c1', // rewardToken() — A404
  // AGENT MOONSHOT (MoonshotFactory + MoonshotCurve + MoonshotToken) —
  // selectors computed with `cast sig` from the lab-built contract
  // sources and verified against live reads on the deployed factory
  // (2026-11-16, launchCount 0, both implementations match the deploy
  // record). Several signatures collide with the AgentFunCurve family
  // (same view names), so the selectors match SEL.curve* by
  // construction — the ms* names keep the board's reads explicit.
  msLaunchCount: '0x27cca59f', // factory launchCount()
  msCurves: '0x1bf7d749', // factory curves(uint256)
  msTokenOfCurve: '0x799075d7', // factory tokenOfCurve(address)
  msSpotPrice: '0x398482d8', // curve spotPrice() — BNB per whole token, 1e18-scaled
  msTokensRemaining: '0xc8b08125', // curve tokensRemaining()
  msTokensSold: '0x518ab2a8', // curve tokensSold()
  msCurveAllocation: '0xca912759', // curve curveAllocation() — 75% of supply
  msRealBnb: '0xb8221fee', // curve realBnbCollected() — net BNB taken in
  msGraduated: '0xe7c2b772', // curve graduated()
  msCanGraduate: '0x83c46137', // curve canGraduate()
  msPair: '0xa8aa1b31', // curve pair() — zero until graduation
  msQuoteBuy: '0x4beb394c', // curve quoteBuy(uint256) — (tokensOut, grossUsed, netUsed, fee)
  msQuoteSell: '0xa64190c4', // curve quoteSell(uint256) — (bnbOut, fee)
  msCap: '0x355274ea', // curve cap() — 5% per-wallet net-position cap
  msLogoURI: '0x6bb38b28', // token logoURI()
};

export const TOPIC = {
  claimed: '0xd8138f8a3f377c5259ca548e70e4c2de94f129f5a11036a15b69513cba2b426a',
  bought: '0xa9a40dec7a304e5915d11358b968c1e8d365992abf20f82285d1df1b30c8e24c',
  listed: '0x50955776c5778c3b7d968d86d8c51fb6b29a7a74c20866b533268e209fc08343',
  price: '0x945c1c4e99aa89f648fbfe3df471b916f719e16d960fcec0737d4d56bd696838',
  cancel: '0xc41d93b8bfbf9fd7cf5bfe271fd649ab6a6fec0ea101c23b82a2a28eca2533a9',
  sold: '0xa70b1a854695e7921b122988e216d3a6cd10ed799017c67b1ff231967e6bf56d',
  cleaned: '0x3db45b70b11615844509a38cfa92c8b3b1f3bd4866cc62af09c8ab1b60994723',
};
export const MKT_TOPICS = [TOPIC.listed, TOPIC.price, TOPIC.cancel, TOPIC.sold, TOPIC.cleaned];

// PassDropEventEngine event topics (PASSDROP #1 activity feed) — computed
// from the deployed contract's event signatures and verified 2026-11-06.
export const PD_TOPIC = {
  ticket: '0x3258c82e4d9b6128d8ec7da95e838a742b003d05eb7d48dc95cb9e5bd64b1773', // TicketBought(address,uint256,uint256,uint256,uint256)
  depositA: '0x22eeb018473edd6828f05c498f9af5a0ece5b7e72dc3ebcbc0fb16e6afc6f081', // DepositA(address,uint256,uint256,uint256)
  depositB: '0xa2b72f4cb735c5cc5b2830265a3732369944a8a8e214f9bf0e1ebb2560373a5d', // DepositB(address,uint256,uint256,bool,uint256,uint256,uint256)
  claimA: '0x0c6e9bcda5515c2e78e029dbb3c9e185ba129bcd9e9e2ee62dcf1d87d0e0f631', // ClaimA(address,uint256,uint256)
  claimEvent: '0x22fd7d54eeed7b89d8512a86b71ebc8abe0ff9fd611101f1c95650903bd148c1', // ClaimEventShares(address,uint256)
  vest: '0x69d396132dbb9ec2b3c63bc5b8702c2b026131ccff33bef857f6e4a1fb4f163b', // WithdrawVested(address,uint256)
  claimLP: '0x7436794b6cd88fe788cb3e86147cb3c7fce0762dc1fb3f3fc7129f4e050d8750', // ClaimLP(address,uint256)
  abortClaimed: '0x4cce995a8924ffacdeeb0a176952295ba921e9f23f7b2406396655dba6929eed', // AbortClaimed(address,uint256)
  ignited: '0xc1639a6422a46402a18226b042a344b412be8c571aec86fe18e026ae5ed7a870', // Ignited(uint256,uint256,uint256)
  buildPOL: '0xf3e02a6c4af0e9c1e55fa5b859b3f3f3a87b864726a2ccf46cce8977bd7c99b2', // BuildPOL(uint256,uint256,uint256)
  deepen: '0xe04826debba40c93f52333ae918d9f54a0bf825709d579d20b9dcfaf0e96a905', // DeepenMainPool(uint256,uint256,uint256)
  aborted: '0x72c874aeff0b183a56e2b79c71b46e1aed4dee5e09862134b8821ba2fddbf8bf', // Aborted()
};
export const PD_TOPICS = Object.values(PD_TOPIC);
// The engine was deployed at block 132001545 and activated at 132001644
// (2026-11-06); the activity feed never scans below the deploy block.
export const PD_DEPLOY_BLOCK = 132001545;

// AgentLaunchpad factory + AgentLaunchpadEngine event topics — computed
// with `cast sig-event` from the lab-built contract sources and
// cross-checked against the compiled ABIs (2026-11-10). The engine
// family shares several signatures (and therefore topics) with the
// PASSDROP engine: DepositA / DepositB / ClaimA / WithdrawVested /
// ClaimLP / Ignited / BuildPOL hash identically.
export const LP_TOPIC = {
  created: '0xe0dea9351617a4b5d2570714484f9927223be5fbd34728e472b643aad2aab575', // factory LaunchCreated(uint256,address,address,address,uint8,string,string,string)
  upgraded: '0x7f88be0527e558b2ea110f5573490623ee21c453f10a06e9c0df346d574680de', // factory LaunchUpgradedToVip(uint256)
  depositA: '0x22eeb018473edd6828f05c498f9af5a0ece5b7e72dc3ebcbc0fb16e6afc6f081', // DepositA(address,uint256,uint256,uint256)
  depositB: '0xa2b72f4cb735c5cc5b2830265a3732369944a8a8e214f9bf0e1ebb2560373a5d', // DepositB(address,uint256,uint256,bool,uint256,uint256,uint256)
  freeSlot: '0x419955f3dc7f4e40f9b1836e2d74d96f5101eb54e45c10a9f87714e358a81dad', // FreeSlot(address,uint256,uint256)
  claimA: '0x0c6e9bcda5515c2e78e029dbb3c9e185ba129bcd9e9e2ee62dcf1d87d0e0f631', // ClaimA(address,uint256,uint256)
  claimLP: '0x7436794b6cd88fe788cb3e86147cb3c7fce0762dc1fb3f3fc7129f4e050d8750', // ClaimLP(address,uint256)
  vest: '0x69d396132dbb9ec2b3c63bc5b8702c2b026131ccff33bef857f6e4a1fb4f163b', // WithdrawVested(address,uint256)
  ignited: '0xc1639a6422a46402a18226b042a344b412be8c571aec86fe18e026ae5ed7a870', // Ignited(uint256,uint256,uint256)
  buildPOL: '0xf3e02a6c4af0e9c1e55fa5b859b3f3f3a87b864726a2ccf46cce8977bd7c99b2', // BuildPOL(uint256,uint256,uint256)
  completed: '0xdfd517ed69f8a0a57d49fe494e4864fac3cfe3585c14c0bfddf39f72463ec3fd', // Completed(uint256)
  transfer: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // ERC-20 Transfer(address,address,uint256)
};
// The board feed set (activity rows) and the actor set (the 24h ranking
// metric reads the user-indexed engine events only).
export const LP_TOPICS = [
  LP_TOPIC.depositA,
  LP_TOPIC.depositB,
  LP_TOPIC.freeSlot,
  LP_TOPIC.claimA,
  LP_TOPIC.claimLP,
  LP_TOPIC.vest,
  LP_TOPIC.ignited,
  LP_TOPIC.buildPOL,
  LP_TOPIC.completed,
];
export const LP_ACTOR_TOPICS = [
  LP_TOPIC.depositA,
  LP_TOPIC.depositB,
  LP_TOPIC.freeSlot,
  LP_TOPIC.claimA,
  LP_TOPIC.claimLP,
  LP_TOPIC.vest,
];
// AGENT LAUNCHPAD deploy block — factory deployed 2026-11-12, block 133150003.
// The board feed never scans below it.
export const LAUNCHPAD_DEPLOY_BLOCK = 133150003;

// DailyPoolEngineV2 event topics — computed with `cast sig-event` from
// the lab-built contract source and verified against the compiled ABI
// (2026-11-15). The pool feed reads PaidEntered / FreeSlotTaken from the
// deploy block; the reveal flow reads RevealCommitted / WinnersRevealed.
// PaidEntered, FreeSlotTaken, PrizeClaimed, RoundOpened and LongstopSwept
// hash identically to V1; RevealCommitted and WinnersRevealed replace
// V1's DrawCommitted / Settled, and RoundFailed / RefundClaimed are new.
export const DP_TOPIC = {
  paidEntered: '0xbea9d78dd191f87b6a4f40aef1ae08b15c4526dfda094d6fef5672fc7027c31a', // PaidEntered(address,uint256,uint256,uint256)
  freeSlot: '0x7e4731c1457ad32a6b54684a00997979ceed140498e3aa3b72f71b9a4fcfed3b', // FreeSlotTaken(address,uint256)
  drawCommitted: '0x94ec7521b200b66a149aa6f41ad85149470d369f72a54d086d571f8ac03a68af', // RevealCommitted(uint256,uint256)
  settled: '0x3e22aade55aa754455e654bc0f26122fe858e292059ee8c4f63a826d31e7e661', // WinnersRevealed(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)
  prizeClaimed: '0x256642a903d86ec186d0ad895b74bdbe7f9e5a72db568f4c4d58c2fa38b39e1c', // PrizeClaimed(address,uint256,uint256)
  roundOpened: '0xc8410c58dcf5346660095e2f1d4190cbb555bcbe378514f769f40c2ec3a250eb', // RoundOpened(uint256,uint256,uint256,uint256)
  longstopSwept: '0xa00aad9c8662a413d6bb89abce7edc30e65cc0b57afc5c96d0c006fb4cd18a5f', // LongstopSwept(uint256,address,uint256)
  roundFailed: '0x7080c3c40c31075abcc30f76467171c855d8e70448fd8b1f04c4565c6a749dc0', // RoundFailed(uint256)
  refundClaimed: '0x17c1d890f3ffba4991a771a0b55802a1eff3159d0cce950fb68d1360530393d9', // RefundClaimed(address,uint256,uint256)
};
// DAILY POOL V2 deploy block — engine deployed 2026-11-15, block 133679743.
// The pool feed never scans below it.
export const DAILYPOOL_DEPLOY_BLOCK = 133679743;

// AgentsPredict event topics — computed with `cast sig-event` from the
// lab-built contract source and verified against the compiled ABI
// (2026-11-15). The Predict page's bets feed reads Bet from the deploy
// block; the outcome of a round comes from the rounds() struct, not logs.
export const PR_TOPIC = {
  bet: '0x27566cdd95dbce2805a5e40f467651a701882e8a51eaa28c53331fdc5e24f859', // Bet(uint256,address,bool,uint256)
  resolved: '0x74e4c4d6d22ee76c6fc52b5f729a6869b54a9c487be245a29f107f1e00ae593b', // Resolved(uint256,uint8,uint256,uint256,uint256,uint256)
  claimed: '0x4ec90e965519d92681267467f775ada5bd214aa92c0dc93d90a5e880ce9ed026', // Claimed(uint256,address,uint256)
};
// AGENTS PREDICT V2 deploy block — contract deployed 2026-11-16, block 133868850.
// The bets feed never scans below it.
export const PREDICT_DEPLOY_BLOCK = 133868850;

// AGENTS MINE deploy block — engine deployed 2026-11-12, block 133130463.
// The Mine page's latest-shares scan never looks below it. The Mine's
// DepositA/DepositB events carry the same signatures (and topics) as
// the event engine's, so PD_TOPIC.depositA / PD_TOPIC.depositB apply.
export const MINE_DEPLOY_BLOCK = 133130463;

// AgentFunCurve (V2) graduation threshold: the curve has no threshold
// getter — graduation fires when the 8,000-token sale allocation exhausts,
// which the locked curve constants (5 BNB virtual start, AgentFunCurve.sol
// header) place at exactly ~18 BNB of real net intake. The project's
// canonical figure, already shown on the Create and Launches pages.
export const FUN_GRADUATION_WEI = 18000000000000000000n;

export const FREE_DEADLINE = 1794814797; // Mon 16 Nov 2026 14:39 UTC+7
export const PAID_DEADLINE = 1794231765; // Mon  9 Nov 2026 20:42 UTC+7
export const FREE_CAP = 1001;
export const PAID_CAP = 111;
export const SUPPLY_CAP = 404404;
export const FREE_PER_CLAIM = 303;
export const PAID_PER_CLAIM = 909;

export const BADGE_IMG =
  'https://bronze-mighty-monkey-752.mypinata.cloud/ipfs/bafkreibzpy5bhwvi2cxqf5kyw25gdhxiyrwgeu2h6vf5uwvjabu6rmzifa';
export const BADGE_GW = 'https://bronze-mighty-monkey-752.mypinata.cloud/ipfs/';

export const BSCSCAN = 'https://bscscan.com';
export const scanAddr = (a) => `${BSCSCAN}/address/${a}`;
export const scanTx = (h) => `${BSCSCAN}/tx/${h}`;
