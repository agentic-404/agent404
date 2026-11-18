import React, { useEffect, useRef, useState } from 'react';
import { countersStore, mineStore, dailyPoolStore, museAdStore, pairAdStore, bountyStore } from '../data.js';
import { useStore } from '../store.js';
import { fmtInt, fmtToken, fmtCountdown, truncAddr, fmtWeiExact } from '../format.js';
import { FREE_DEADLINE, PAID_DEADLINE, FREE_CAP, PAID_CAP, FREE_PER_CLAIM, PAID_PER_CLAIM, A, scanAddr } from '../config.js';
import { CopyBlock, SectionHead, StatCard, LiveBadge, StaleTag } from '../components.jsx';
import { CLAIM_PROMPT } from '../prompts.js';
import a404Url from '../assets/a404-glitch-404.png';
import cakeUrl from '../assets/cake-logo.png';
import museUrl from '../assets/muse-logo.png';
import rocketUrl from '../assets/rocket.png';
import lockUrl from '../assets/lock.png';

// Same GeckoTerminal pool endpoint the site's PriceStrip already
// fetches (App.jsx): quote_token_price_usd is WBNB in USD. If the
// fetch fails, the USD clause is omitted — never a stale price.

const GT_POOL_URL =
  'https://api.geckoterminal.com/api/v2/networks/bsc/pools/0x6116d6B62b35aAa9aCbC118eD7c51861c085de09';

function useBnbUsd() {
  const [usd, setUsd] = useState(null);
  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const r = await fetch(GT_POOL_URL);
        const j = await r.json();
        const v = Number(j?.data?.attributes?.quote_token_price_usd);
        if (!dead && Number.isFinite(v) && v > 100 && v < 10000) setUsd(v);
      } catch {
        /* omit the USD line */
      }
    };
    load();
    const t = setInterval(load, 60000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, []);
  return usd;
}

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function MineCard({ paid, mine }) {
  const live = !!(mine && mine.activated);
  const pot = paid !== null && paid !== undefined ? (BigInt(PAID_CAP) - paid) * BigInt(PAID_PER_CLAIM) : null;
  const mined = live && mine.totalShares !== null && mine.totalShares !== undefined ? Number(mine.totalShares) : 0;
  const tranchePct = live ? (mined % 1000) / 10 : 0;
  return (
    <div className="sev live">
      {live ? (
        <div className="refundribbon" aria-hidden="true">
          BNB REFUND<small>BACK IN 24H</small>
        </div>
      ) : null}
      <div className="sev-head">
        <img className="sev-logo" src={a404Url} alt="$A404 logo" />
        <div>
          <div className="sev-num">NATIVE TOKEN</div>
          <div className="sev-title">
            AGENT404 <span>$A404</span>
          </div>
        </div>
        {live ? null : <span className="sev-chip ghost">SOON</span>}
      </div>
      <div className="sev-tick">
        AGENT404 <b className="pair">$A404/BNB</b>
        <img className="sev-venue" src={cakeUrl} alt="PancakeSwap" />
      </div>
      <div className="sev-spec">
        <span>
          <span className="k">NAME</span>
          <span className="v">AGENT404</span>
        </span>
        <span>
          <span className="k">TICKER</span>
          <span className="v amber">$A404</span>
        </span>
        <span>
          <span className="k">MAX SUPPLY</span>
          <span className="v">404,404 — FIXED, NO MINT</span>
        </span>
        <span>
          <span className="k">STANDARD</span>
          <span className="v">DN-404</span>
        </span>
      </div>
      <p className="sev-desc">
        {live
          ? 'The standing mine for the native token — the same machine as the launchpool, pointed at $A404 itself. Whole shares at the anchor: Mode A returns 97% in 24 hours plus the reward, Mode B builds the pool, and the reward halves every 1,000 shares. Agent ID holders only — no badge needed.'
          : 'The native token lists here: a fourteen-day launchpool event on the mine. Agent ID holders deposit BNB in whole shares — 97% REFUND in 24 hours, plus the reward — and the retained fraction builds the official A404/BNB pool, born at the anchor with its LP burned. This listing cannot fail; the crowd decides how deep. No badge needed.'}
      </p>
      <div className="sev-bar">
        <i style={{ width: `${tranchePct}%` }} />
      </div>
      <div className="sev-meta">
        <span>
          SHARES MINED <b>{live ? fmtInt(mined) : '0'}</b>
        </span>
        {live ? (
          <>
            <span>
              REWARD NOW <b>{mine.rewardPerShare ? `${fmtToken(BigInt(mine.rewardPerShare))} / SHARE` : '—'}</b>
            </span>
            <span>
              POL BUCKET <b>{mine.polBNB ? `${fmtToken(BigInt(mine.polBNB))} BNB` : '—'}</b>
            </span>
          </>
        ) : (
          <>
            <span>
              REWARD <b>20 / SHARE</b>
            </span>
            <span>
              FUEL <b>90,000 $A404 — THE LISTING EVENT ENVELOPE</b>
            </span>
          </>
        )}
      </div>
      {live ? (
        <a className="sev-open" href="#/mine">
          OPEN EVENT →
        </a>
      ) : (
        <span className="sev-actions">
          <a className="sev-ghost" href="#/mine">
            OPEN EVENT →
          </a>
        </span>
      )}
    </div>
  );
}

/**
 * Daily Pool — the daily BNB prize pot, as a Home card. Every number
 * reads live from the DailyPoolEngineV2 via dailyPoolStore (pot, counts,
 * slots, splits, ticket price, max winners) or is derived from those
 * live reads. The "1 BNB pot" line is a scenario input only — its
 * winners and prize are computed from the contract's own _drawOne
 * rule (winners = min(maxPaidWinners, paidShare / ticketPrice)).
 * The engine address appears only in the Daily Pool page's CONTRACTS
 * block, never here.
 */
function DailyPoolCard({ dp }) {
  const bnbUsd = useBnbUsd();
  const d = dp || null;
  const c = d?.consts || null;
  const pot = d?.pot ?? null;
  const paidTickets = d?.paidTickets ?? null;
  const freeUsed = d?.freeUsed ?? null;
  const freeSlots = c?.freeSlots ?? null;
  const freeLeft = freeUsed !== null && freeSlots !== null ? freeSlots - freeUsed : null;
  const potUsd = pot !== null && bnbUsd !== null ? (Number(pot) / 1e18) * bnbUsd : null;
  const roundNum = d?.round !== null && d?.round !== undefined ? Number(d.round) : null;
  // Split percentages, live from the contract constants (same rule as the Daily Pool page).
  const pct = (v) =>
    c && c.bps && c[v] !== null && c[v] !== undefined ? Number((c[v] * 100n) / c.bps) : null;
  const paidPct = pct('paidBps');
  const freePct = pct('freeBps');
  const rolloverPct = pct('rolloverBps');
  const platformPct = pct('platformBps');
  // Scenario prizes at a 1 BNB pot, from the live constants (_drawOne rule).
  const scenarioAt = (shareBps, maxWinners) => {
    if (!c || shareBps === null || shareBps === undefined || c.bps === null || c.bps === 0n || c.ticketPrice === null || c.ticketPrice === 0n || maxWinners === null || maxWinners === undefined) return null;
    const oneBnb = 10n ** 18n;
    const share = (oneBnb * shareBps) / c.bps;
    const winners = share / c.ticketPrice;
    const w = winners > maxWinners ? maxWinners : winners;
    if (w <= 0n) return null;
    return { winners: w, prize: share / w };
  };
  const scenarioPaid = scenarioAt(c?.paidBps ?? null, c?.maxPaidWinners ?? null);
  const scenarioFree = scenarioAt(c?.freeBps ?? null, c?.maxFreeWinners ?? null);
  // Free-slots segments: filled = left (same as the Daily Pool page — full gold at 20/20, never an empty bar).
  const slotCount = freeSlots !== null ? Number(freeSlots) : null;
  return (
    <div className="sev live home-dp">
      <div className="refundribbon" aria-hidden="true">
        BNB REFUND<small>CLAIM IN 7 DAYS</small>
      </div>
      <div className="sev-head">
        <div className="sev-num">
          ROUND #{roundNum !== null ? fmtInt(roundNum) : '—'} · ONE DRAW EVERY DAY · DRAWS 00:00 UTC
        </div>
      </div>
      <div className="dp-pot">
        <div className="dp-pot-lbl">TODAY'S POT</div>
        <div className="dp-pot-val">
          {pot !== null ? `${fmtToken(pot)} BNB` : '—'}
          {potUsd !== null ? <span>≈ ${potUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> : null}
        </div>
      </div>
      <div className="dp-line">
        {paidTickets !== null ? fmtInt(Number(paidTickets)) : '—'} paid tickets in ·{' '}
        {freeLeft !== null && freeSlots !== null
          ? `${fmtInt(Number(freeLeft))}/${fmtInt(Number(freeSlots))}`
          : '—'}{' '}
        free slots left today
      </div>
      <div className="dp-slots-lbl">
        <span>FREE SLOTS TODAY</span>
        <b>
          {freeLeft !== null && freeSlots !== null
            ? `${fmtInt(Number(freeLeft))} OF ${fmtInt(Number(freeSlots))} LEFT`
            : '—'}
        </b>
      </div>
      <div className="dp-slotbar" aria-hidden="true">
        {Array.from({ length: slotCount ?? 20 }, (_, i) => (
          <i key={i} className={i < (freeLeft !== null ? Number(freeLeft) : 0) ? 'on' : ''} />
        ))}
      </div>
      <div className="distbar">
        <i className="segA" style={{ width: `${paidPct !== null ? paidPct : 0}%` }}>
          {paidPct !== null ? `${paidPct}%` : ''}
        </i>
        <i className="segB" style={{ width: `${freePct !== null ? freePct : 0}%` }}>
          {freePct !== null ? `${freePct}%` : ''}
        </i>
        <i className="segC" style={{ width: `${rolloverPct !== null ? rolloverPct : 0}%` }}>
          {rolloverPct !== null ? `${rolloverPct}%` : ''}
        </i>
        <i className="segD" style={{ width: `${platformPct !== null ? platformPct : 0}%` }}>
          {platformPct !== null ? `${platformPct}%` : ''}
        </i>
      </div>
      <div className="distlegend">
        <span>
          <i className="sw" style={{ background: 'var(--amber)' }} /> <b>{paidPct !== null ? `${paidPct}%` : '—'}</b> paid draw
        </span>
        <span>
          <i className="sw" style={{ background: '#9ad1a3' }} /> <b>{freePct !== null ? `${freePct}%` : '—'}</b> free draw
        </span>
        <span>
          <i className="sw" style={{ background: '#3a3a3a' }} /> <b>{rolloverPct !== null ? `${rolloverPct}%` : '—'}</b> rolls to tomorrow
        </span>
        <span>
          <i className="sw" style={{ background: '#e8e6df' }} /> <b>{platformPct !== null ? `${platformPct}%` : '—'}</b> platform
        </span>
      </div>
      <div className="dp-prize">
        <b>
          {scenarioPaid
            ? `Pot 1 BNB → ${fmtInt(Number(scenarioPaid.winners))} winners × ${fmtToken(scenarioPaid.prize)} BNB`
            : 'Pot 1 BNB → —'}
        </b>
        <span>
          {scenarioFree
            ? `Plus ${fmtInt(Number(scenarioFree.winners))} free-slot winners × ${fmtToken(scenarioFree.prize)} BNB. `
            : ''}
          Winners never lose money — every prize pays back at least the entry.
        </span>
      </div>
      <div className="dp-doors">
        <div className="dp-door dp-door-paid">
          <div className="dp-door-lbl">PAID TICKET</div>
          <div className="dp-door-price">
            {c?.ticketPrice !== null && c?.ticketPrice !== undefined ? `${fmtToken(c.ticketPrice)} BNB` : '—'}
          </div>
          <div className="dp-door-det">
            per ticket · max {c?.maxPaid !== null && c?.maxPaid !== undefined ? fmtInt(Number(c.maxPaid)) : '—'} per wallet
          </div>
        </div>
        <div className="dp-door dp-door-free">
          <div className="dp-door-lbl">FREE SLOT</div>
          <div className="dp-door-price">0 BNB</div>
          <div className="dp-door-det">{freeSlots !== null ? fmtInt(Number(freeSlots)) : '—'}/day · Agent ID only</div>
        </div>
      </div>
      <a className="sev-open" href="#/daily-pool">
        ENTER TODAY'S POOL →
      </a>
    </div>
  );
}

function LaunchpadCard({ lp }) {
  const live = !!A.launchpad;
  const launches = lp && lp.launches ? lp.launches : null;
  const byAgents = (x, y) => (y.agents24h ?? -1) - (x.agents24h ?? -1) || y.id - x.id;
  const top5 = launches ? launches.filter((l) => l.active !== false).sort(byAgents).slice(0, 5) : [];
  return (
    <div className={`sev${live ? ' live' : ''}`}>
      <div className="sev-head">
        <div>
          <div className="sev-num">AGENTS LAUNCHPAD</div>
          <div className="sev-title">
            TOP 5 <span>— THE LAUNCH BOARD</span>
          </div>
        </div>
        {live ? <span className="sev-chip">● LIVE</span> : <span className="sev-chip ghost">IN PREPARATION</span>}
      </div>
      {top5.length ? (
        <div className="lptop">
          {top5.map((l, i) => (
            <a className="lptoprow" key={l.id} href={`#/launchpad/${l.token}`}>
              <span className="lptoprank">{i + 1}</span>
              <span className="lptopname">{l.name || truncAddr(l.token)}</span>
              <span className="lptopagents">
                {l.agents24h === null || l.agents24h === undefined ? '—' : fmtInt(l.agents24h)} AGENTS · 24H
              </span>
            </a>
          ))}
        </div>
      ) : (
        <p className="sev-desc">
          {live
            ? 'The factory is live and the board is open — no launches yet. The first launch takes position 1.'
            : 'The board where Agent ID holders launch DN-404 tokens on one fair-mint machine — a free door or the VIP door, ranked by real agent wallets. The factory contract is in preparation; the board is wired and opens the moment it deploys.'}
        </p>
      )}
      {live ? (
        <a className="sev-open" href="#/launchpad">
          OPEN THE LAUNCHPAD →
        </a>
      ) : (
        <span className="sev-actions">
          <a className="sev-ghost" href="#/launchpad">
            OPEN THE LAUNCHPAD →
          </a>
        </span>
      )}
    </div>
  );
}

function Lane({ kind, count, cap, deadline, now, perClaim, blurb }) {
  const exhausted = count !== null && count >= cap;
  const closed = !exhausted && now > deadline;
  const live = !exhausted && !closed && count !== null;
  const cd = !exhausted && !closed ? fmtCountdown(deadline, now) : null;
  const closeLabel =
    kind === 'free' ? 'MON 16 NOV 2026 · 07:39 UTC' : 'MON 9 NOV 2026 · 13:42 UTC';
  return (
    <div className={`lane${exhausted ? ' exhausted' : live ? ' live' : ''}`}>
      {exhausted ? <div className="lanestamp">SOLD OUT</div> : null}
      <h3>
        {live ? <span className="livedot" /> : null}
        {kind === 'free' ? 'FREE LANE' : 'PAID LANE — THE LAST DOOR'}
        {live ? ' — LIVE' : ''}
      </h3>
      {live ? (
        <>
          <div className="big">
            <b>{fmtInt(cap - Number(count))}</b> <span className="dimmed">seats left</span>
          </div>
          <div className="lanesub">
            of {fmtInt(cap)} · {fmtInt(count)} claimed so far
          </div>
        </>
      ) : (
        <div className="big">
          {count === null ? '—' : fmtInt(count)} <span className="dimmed">claimed</span>
        </div>
      )}
      <p>{blurb}</p>
      <div className="bar">
        <i style={{ width: `${count === null ? 0 : Math.min(100, (Number(count) / cap) * 100)}%` }} />
      </div>
      <div className="closebox">
        {exhausted ? (
          <>EXHAUSTED — all {fmtInt(cap)} shares claimed · this lane never reopens</>
        ) : closed ? (
          <>CLOSED — this lane has ended and never reopens</>
        ) : (
          <>
            CLOSES · {closeLabel} — then never reopens
            {cd ? <span className="cd">{cd}</span> : null}
          </>
        )}
      </div>
      <div className="lanemeta">{perClaim}</div>
    </div>
  );
}

function LiveClaim() {
  const counters = useStore(countersStore);
  const c = counters.data;
  const now = useNow();
  const free = c?.free ?? null;
  const paid = c?.paid ?? null;
  const freeExhausted = free !== null && free >= BigInt(FREE_CAP);
  return (
    <section className="sec" id="claim">
      <SectionHead
        title={
          <>
            LIVE CLAIM — <span className="amber">PHASE 1 DISTRIBUTION</span>
          </>
        }
        right={
          <>
            <LiveBadge /> <StaleTag stale={counters.stale} />
          </>
        }
      />
      <p className="modulenote">
        TEMPORARY MODULE — this panel lives only while the Phase 1 claim runs, and retires when the lanes close.
      </p>
      <div className="claimcard">
      <div className="grid grid4">
        <StatCard
          label="FREE CLAIMS"
          big={
            <>
              {free === null ? '—' : fmtInt(Number(free))}
              <span className="bigsub"> / 1,001</span>
            </>
          }
          sub="303 $A404 per Agent ID · FCFS"
          bar={free === null ? 0 : (Number(free) / FREE_CAP) * 100}
        />
        <StatCard
          label="PAID CLAIMS"
          big={
            <>
              {paid === null ? '—' : fmtInt(Number(paid))}
              <span className="bigsub"> / 111</span>
            </>
          }
          sub="909 $A404 @ 0.0045 BNB"
          bar={paid === null ? 0 : (Number(paid) / PAID_CAP) * 100}
        />
        <StatCard
          label="BADGES IN CIRCULATION"
          big={c?.badges === null || c?.badges === undefined ? '—' : fmtInt(Number(c.badges))}
          sub="DN-404 badges live on the mirror"
          bar={c?.badges ? (Number(c.badges) / 404404) * 100 : 0}
        />
        <StatCard
          label="SUPPLY"
          big={c?.supply ? fmtToken(c.supply) : '404,404'}
          sub="fixed forever · no mint function"
          bar={100}
        />
      </div>

      {freeExhausted ? (
        <div className="freeline">
          <span className="freestamp">SOLD OUT</span>
          <span>
            FREE LANE — all 1,001 claimed · one free share of 303 $A404 per Agent ID · this lane never reopens
          </span>
        </div>
      ) : null}

      {freeExhausted ? (
        <Lane
          kind="paid"
          count={paid}
          cap={PAID_CAP}
          deadline={PAID_DEADLINE}
          now={now}
          perClaim="909 $A404 per claim · one per Agent ID"
          blurb="909 $A404 for 0.0045 BNB — exactly nine AgentFun launches. One per Agent ID. Proceeds forward to the community reserve."
        />
      ) : (
        <div className="lanes">
          <Lane
            kind="free"
            count={free}
            cap={FREE_CAP}
            deadline={FREE_DEADLINE}
            now={now}
            perClaim="303 $A404 per claim · one per Agent ID"
            blurb="One free share of 303 $A404 per Binance Agent ID. Claiming also issues your Phase 2 pass."
          />
          <Lane
            kind="paid"
            count={paid}
            cap={PAID_CAP}
            deadline={PAID_DEADLINE}
            now={now}
            perClaim="909 $A404 per claim · one per Agent ID"
            blurb="909 $A404 for 0.0045 BNB — exactly nine AgentFun launches. One per Agent ID. Proceeds forward to the community reserve."
          />
        </div>
      )}

      <CopyBlock
        title="GIVE THIS TO YOUR AGENT — THE FULL CLAIM PROMPT"
        text={CLAIM_PROMPT}
        note="One paste, and your agent runs the whole claim: eligibility check, safety preview, execution, on-chain verification. The claim is free — your agent pays only BSC gas, and stops dead if anything asks for money or an approval."
      />
      </div>
    </section>
  );
}

function ClosedStrip({ free, paid }) {
  const passes = free !== null && paid !== null ? fmtInt(Number(free) + Number(paid)) : '—';
  return (
    <section className="sec">
      <a className="closeline" href="#/market">
        <b>PHASE 1 COMPLETE — THE MINT IS CLOSED</b> · {passes} passes exist, fixed forever ·{' '}
        <span className="go">GET YOURS ON THE BADGE MARKET →</span>
      </a>
    </section>
  );
}

const BAND_CARDS = [
  {
    name: 'AgentFun',
    tag: 'LIVE',
    desc: 'Token launches and bonding-curve trading. Any Agent ID holder launches a DN-404 for a flat 101 $A404 — half the fee burned, forever.',
    view: '#/create',
    cta: 'Open the launchpad',
  },
  {
    name: 'Badge Market',
    tag: 'LIVE',
    desc: 'The non-custodial market where badges trade only between Agent ID wallets. A listed badge never leaves its seller until the moment it sells.',
    view: '#/market',
    cta: 'Open the market',
  },
  {
    name: 'Autonomous Agent Swap',
    tag: 'LIVE',
    desc: 'Agent-executed swaps on the official $A404 pool — formed in Phase 2 from the community distribution, its LP burned, its price set by the market alone.',
    view: '#/swap',
    cta: 'Open the swap desk',
  },
  {
    name: 'Agents Predict',
    tag: 'LIVE',
    desc: 'The prediction market for autonomous agents — one pair, one round every 10 minutes. Bet BNB on whether BTC closes above or below the reference.',
    view: '#/predict',
    cta: 'Open Agents Predict',
  },
];

// ---------- Featured ad carousel (MUSE) ----------
// One auto-sliding slot above Daily Pool. Slides are data: future ads append
// to SLIDES and the dots + auto-advance appear once there are 2+. The MUSE
// slide reads live from the MUSE/WBNB pair (reserves + burned LP share);
// USD comes from the same GeckoTerminal BNB price the PriceStrip uses.
// While a value is still reading it shows "—", never a stale number.

const MUSE_SUPPLY = 21000000000;

function fmtMusePrice(usd) {
  if (usd === null || usd === undefined || !Number.isFinite(usd)) return '—';
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1e-15) return `$${usd.toExponential(2)}`;
  // Full decimal expansion ($0.0000000000873) — the wall of zeros, never
  // scientific notation, never a rounded-to-zero figure.
  return `$${usd.toFixed(15).replace(/0+$/, '').replace(/\.$/, '')}`;
}

// Pair slide: 1 MUSE priced in A404, from the MUSE/A404 pair reserves.
function fmtPairPrice(ratio) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  if (ratio >= 0.01) return `${ratio.toFixed(4)} A404`;
  if (ratio < 1e-15) return `${ratio.toFixed(18).replace(/0+$/, '').replace(/\.$/, '')} A404`;
  // Full decimal expansion (0.0000000523), never scientific notation.
  return `${ratio.toFixed(15).replace(/0+$/, '').replace(/\.$/, '')} A404`;
}

// Pair slide: MUSE depth of the pool, compact.
function fmtPoolMuse(wei) {
  if (wei === null || wei === undefined) return '—';
  const v = Number(wei) / 1e18;
  if (!Number.isFinite(v)) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B MUSE`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M MUSE`;
  return `${Math.round(v).toLocaleString('en-US')} MUSE`;
}

// Airdrop slide prompt — copied VERBATIM from the guide
// (web/src/docs/MUSE-AIRDROP.md, "How to claim" block). The slide's COPY
// PROMPT button copies this text; the slide itself is not a link.
const AIRDROP_PROMPT = `Contract: 0x58Db870b3d1cC04aEABE14376825E156c640A193 (BSC, chainId 56)
Call:     claim(uint256 amount, bytes32[] proof)  — selector 0x2f52ebb7
Amount:   10000000000000000000000  (10,000 MUSE = 10,000 ether)
Proof:    <the proof array from /airdrop-proofs.json for the holder's address>
From:     the same wallet that claimed the A404`;

function MuseAdCarousel() {
  const ad = useStore(museAdStore);
  const pair = useStore(pairAdStore);
  const bounty = useStore(bountyStore);
  const bnbUsd = useBnbUsd();
  const d = ad.data;
  const priceUsd =
    d?.reserveMuse && d?.reserveWBNB && bnbUsd
      ? (Number(d.reserveWBNB) / Number(d.reserveMuse)) * bnbUsd
      : null;
  const mcap = priceUsd !== null ? priceUsd * MUSE_SUPPLY : null;
  const burned =
    d?.deadLp !== null && d?.deadLp !== undefined && d?.totalLp
      ? (Number(d.deadLp) / Number(d.totalLp)) * 100
      : null;
  const pd = pair.data;
  const pairRatio =
    pd?.reserveMuse && pd?.reserveA404
      ? Number(pd.reserveA404) / Number(pd.reserveMuse)
      : null;
  const pairBurned =
    pd?.deadLp !== null && pd?.deadLp !== undefined && pd?.totalLp
      ? (Number(pd.deadLp) / Number(pd.totalLp)) * 100
      : null;
  // Bounty slide stats — same live reads as the Bounty Agents Board page
  // (bountyStore.stats: prizesOpen / bountiesOpen / totalPaid, from the
  // escrow contract). Null while still reading → the slide shows "—".
  const bs = bounty.data?.stats || null;
  const slides = [
    {
      key: 'muse',
      eyebrow: 'FEATURED · FIRST MEME ON AGENT404',
      title: (
        <>
          MUSE <span className="amber">AGENTS</span>
        </>
      ),
      pitch:
        'The meme token of the agent economy. Launched with 100% of supply in the pool and the LP burned — no one can pull it.',
      logo: museUrl,
      logoAlt: 'MUSE logo',
      stats: [
        { lbl: 'PRICE', val: fmtMusePrice(priceUsd), amber: false },
        { lbl: 'MCAP', val: mcap !== null ? `$${mcap.toFixed(2)}` : '—', amber: false },
        {
          lbl: 'LP',
          val: burned !== null ? `BURNED ${burned >= 99.95 ? '100' : burned.toFixed(1)}%` : '—',
          amber: true,
        },
      ],
      cta: 'SWAP MUSE ON THE DESK →',
      href: '#/swap',
    },
    {
      key: 'moonshot',
      eyebrow: 'FEATURED · MOONSHOT IS LIVE',
      title: (
        <>
          MOONSHOT <span className="amber">IS LIVE</span>
        </>
      ),
      pitch:
        'Launch your own token on the bonding curve — graduate at 1 BNB raised, LP burned to dead.',
      logo: rocketUrl,
      logoAlt: 'Rocket',
      stats: [
        { lbl: 'GRADUATE', val: '1 BNB', amber: false },
        { lbl: 'SPLIT', val: '75 / 25', amber: false },
        { lbl: 'LP', val: 'BURNED', amber: true },
      ],
      cta: 'LAUNCH ON MOONSHOT →',
      href: '#/moonshot',
    },
    {
      key: 'muse-a404',
      eyebrow: 'FEATURED · NEW PAIR ON THE DESK',
      title: (
        <>
          MUSE <span className="amber">A404</span>
        </>
      ),
      pitch:
        'Swap MUSE for A404 and back — no BNB in between. The gateway between the meme and the native asset.',
      logos: [museUrl, a404Url],
      logoAlt: 'MUSE and A404 logos',
      stats: [
        { lbl: 'PRICE', val: fmtPairPrice(pairRatio), amber: false },
        { lbl: 'POOL', val: fmtPoolMuse(pd?.reserveMuse), amber: false },
        {
          lbl: 'LP',
          val: pairBurned !== null ? `BURNED ${pairBurned >= 99.95 ? '100' : pairBurned.toFixed(1)}%` : '—',
          amber: true,
        },
      ],
      cta: 'VIEW THE PAIR →',
      href: scanAddr(A.museA404Pair),
    },
    {
      key: 'lp-event',
      eyebrow: 'FEATURED · LP STAKE EVENT · 10 DAYS',
      title: (
        <>
          LP STAKE <span className="amber">EVENT</span>
        </>
      ),
      pitch:
        'Stake LP worth 100 A404 for 30 days and earn 20 A404. 10 stakers a day FCFS, 10 days, Agent ID only.',
      logo: lockUrl,
      logoAlt: 'Locked LP',
      stats: [
        { lbl: 'REWARD', val: '20 A404', amber: true },
        { lbl: 'LOCK', val: '30 DAYS', amber: false },
        { lbl: 'DAILY', val: '10 STAKERS', amber: false },
      ],
      cta: 'STAKE YOUR LP →',
      href: '#/stakelp',
    },
    {
      key: 'muse-airdrop',
      eyebrow: 'MUSE AIRDROP — LIVE',
      title: (
        <>
          10,000 MUSE <span className="amber">FREE</span>
        </>
      ),
      pitch:
        'Every A404 claimer gets 10,000 MUSE. Claim yours before 17 Dec 2026.',
      logo: museUrl,
      logoAlt: 'MUSE logo',
      stats: [
        { lbl: 'ELIGIBLE', val: '1,001 WALLETS', amber: false },
        { lbl: 'POOL', val: '10,010,000 MUSE', amber: false },
        { lbl: 'ENDS', val: '17 DEC 2026', amber: true },
      ],
      cta: 'COPY PROMPT',
      copyPrompt: true,
    },
    {
      key: 'bounty',
      eyebrow: 'BOUNTY AGENTS BOARD',
      title: (
        <>
          EARN <span className="amber">BNB</span> FOR REAL WORK
        </>
      ),
      pitch: 'Real tasks. Real BNB. Paid from escrow.',
      logoMark: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" aria-hidden="true">
          <g stroke="#f5b301" strokeWidth="5" strokeLinecap="round">
            <path d="M64 2 V9" />
            <path d="M64 119 V126" />
            <path d="M2 64 H9" />
            <path d="M119 64 H126" />
          </g>
          <circle cx="64" cy="64" r="54" fill="none" stroke="#f5b301" strokeWidth="6" />
          <circle cx="64" cy="64" r="38" fill="none" stroke="#f2f2f2" strokeWidth="4" />
          <circle cx="64" cy="64" r="20" fill="#f5b301" />
          <path
            d="M64 51 L67.23 59.55 L76.36 59.98 L69.23 65.70 L71.64 74.52 L64 69.5 L56.36 74.52 L58.77 65.70 L51.64 59.98 L60.77 59.55 Z"
            fill="#0b0b0b"
          />
        </svg>
      ),
      stats: [
        { lbl: 'PRIZES OPEN', val: bs ? `${fmtWeiExact(bs.prizesOpen)} BNB` : '—', amber: false },
        { lbl: 'BOUNTIES OPEN', val: bs ? fmtInt(bs.bountiesOpen) : '—', amber: false },
        { lbl: 'TOTAL PAID', val: bs ? `${fmtWeiExact(bs.totalPaid)} BNB` : '—', amber: true },
      ],
      cta: 'See open bounties',
      href: '#/bounty',
    },
  ];
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyAirdropPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AIRDROP_PROMPT);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = AIRDROP_PROMPT;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const touchX = useRef(null);
  useEffect(() => {
    if (slides.length < 2 || paused) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [paused, slides.length]);
  const onTouchStart = (e) => {
    touchX.current = e.touches[0].clientX;
    setPaused(true);
  };
  const onTouchEnd = (e) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) setIdx((i) => (i + (dx < 0 ? 1 : slides.length - 1)) % slides.length);
    touchX.current = null;
    setPaused(false);
  };
  return (
    <section className="muse-ad-sec" aria-label="Featured">
      <div
        className="muse-ad-view"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="muse-ad-track" style={{ transform: `translateX(-${idx * 100}%)` }}>
          {slides.map((s) => {
            const inner = (
              <>
                <div className="muse-ad-top">
                  {s.logos ? (
                    <div className="muse-ad-logos">
                      {s.logos.map((u, li) => (
                        <img key={li} className="muse-ad-logo" src={u} alt={s.logoAlt || 'logo'} />
                      ))}
                    </div>
                  ) : s.logoMark ? (
                    <span className="muse-ad-logo bounty-mark" aria-hidden="true">
                      {s.logoMark}
                    </span>
                  ) : (
                    <img className="muse-ad-logo" src={s.logo} alt={s.logoAlt || 'MUSE logo'} />
                  )}
                  <div>
                    <div className="muse-ad-eyebrow">{s.eyebrow}</div>
                    <h3 className="muse-ad-title">{s.title}</h3>
                  </div>
                </div>
                <p className="muse-ad-pitch">{s.pitch}</p>
                <div className="muse-ad-stats">
                  {s.stats.map((st) => (
                    <div className="muse-ad-stat" key={st.lbl}>
                      <div className="lbl">{st.lbl}</div>
                      <div className={`val${st.amber ? ' amber' : ''}`}>{st.val}</div>
                    </div>
                  ))}
                </div>
                {s.copyPrompt ? (
                  <button type="button" className="btn solid block" onClick={copyAirdropPrompt}>
                    {copied ? 'COPIED' : s.cta}
                  </button>
                ) : (
                  <span className="btn solid block">{s.cta}</span>
                )}
              </>
            );
            return (
              <div className="muse-ad-slide" key={s.key}>
                {s.copyPrompt ? (
                  <div className="muse-ad-card">{inner}</div>
                ) : (
                  <a className="muse-ad-card" href={s.href}>{inner}</a>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="muse-ad-dots">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              className={`muse-ad-dot${i === idx ? ' on' : ''}`}
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// Home-only styles for the .sev card family (MineCard, DailyPoolCard,
// LaunchpadCard). These classes have NO rules in the shared stylesheet,
// so without this block the cards render unstyled: the refund ribbons
// escape to the top of the page, the logo/venue images show at their
// natural 256px, the spec and meta rows jam together with no gaps, and
// the tranche bar is invisible. Scoped under .home-root, so no other
// page is affected. Rendered only when Home mounts.
const HOME_CSS = `
.home-root .sev { position: relative; overflow: hidden; background: var(--panel); border: 1px solid rgba(245, 179, 1, 0.45); border-radius: 12px; padding: 18px; margin-bottom: 14px; }
.home-root .sev-head { display: flex; align-items: center; gap: 14px; }
.home-root .sev-logo { width: 56px; height: 56px; flex: none; border-radius: 10px; }
.home-root .sev-num { font-family: var(--mono); font-size: 11px; letter-spacing: .18em; color: var(--dim); }
.home-root .sev-title { font-size: 24px; font-weight: 800; line-height: 1.15; margin-top: 2px; }
.home-root .sev-title span { color: var(--amber); }
.home-root .sev-chip { margin-left: auto; flex: none; display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 11px; font-weight: 800; letter-spacing: .14em; color: #050505; background: var(--amber); border-radius: 999px; padding: 5px 12px; }
.home-root .sev-chip.ghost { background: transparent; color: var(--dim); border: 1px solid var(--line); }
.home-root .sev-tick { display: flex; align-items: center; justify-content: flex-start; gap: 12px; margin-top: 14px; font-family: var(--mono); font-size: 13px; letter-spacing: .06em; }
.home-root .sev-tick b.pair { color: var(--amber); font-weight: 700; }
.home-root .sev-venue { height: 28px; width: auto; flex: none; border-radius: 6px; }
.home-root .sev-spec { display: flex; flex-wrap: wrap; gap: 14px 24px; margin-top: 16px; }
.home-root .sev-spec > span { display: flex; flex-direction: column; gap: 3px; flex: 1 1 40%; min-width: 130px; }
.home-root .sev-spec .k { font-family: var(--mono); font-size: 10px; letter-spacing: .12em; color: var(--dim); display: block; }
.home-root .sev-spec .v { font-family: var(--mono); font-size: 14px; font-weight: 700; line-height: 1.4; }
.home-root .sev-desc { color: var(--sub); font-size: 14px; line-height: 1.6; margin: 14px 0 0; }
.home-root .sev-bar { height: 6px; background: #1c1c1c; border-radius: 999px; overflow: hidden; margin-top: 14px; }
.home-root .sev-bar i { display: block; height: 100%; background: var(--amber); border-radius: 999px; }
.home-root .sev-meta { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-top: 14px; font-family: var(--mono); font-size: 12px; letter-spacing: .08em; color: var(--dim); }
.home-root .sev-meta b { color: var(--text); }
.home-root .sev-open { display: block; text-align: center; margin-top: 16px; font-family: var(--mono); font-size: 12.5px; font-weight: 700; letter-spacing: .14em; color: var(--amber); }
.home-root .sev-actions { display: block; text-align: center; margin-top: 16px; }
.home-root .sev-ghost { display: inline-block; background: transparent; color: var(--text); border: 1px solid var(--line); border-radius: 8px; padding: 11px 18px; font-family: var(--mono); font-size: 12.5px; letter-spacing: .1em; text-align: center; }
@media (max-width: 640px) {
  .home-root .sev { padding: 14px; }
  .home-root .sev-num { font-size: 10px; letter-spacing: .14em; }
  .home-root .sev-title { font-size: 20px; }
  .home-root .sev-logo { width: 48px; height: 48px; }
  .home-root .refundribbon { top: 22px; right: -38px; transform: rotate(38deg); padding: 6px 46px; font-size: 11px; letter-spacing: .14em; }
  .home-root .refundribbon small { display: block; margin: 2px 0 0; font-size: 8px; letter-spacing: .18em; }
  .home-root .home-dp .sev-head { padding-right: 70px; }
}
`;

export default function Home() {
  const counters = useStore(countersStore);
  const mineState = useStore(mineStore);
  const dpState = useStore(dailyPoolStore);
  const now = useNow();
  const c = counters.data;
  const free = c?.free ?? null;
  const paid = c?.paid ?? null;
  const paidSoldOut = paid !== null && paid >= BigInt(PAID_CAP);
  const mintClosed = paidSoldOut || now > PAID_DEADLINE;
  return (
    <div className="home-root">
      <style>{HOME_CSS}</style>
      <section className="hero">
        <div className="kicker amber herocenter">DN-404 · BNB CHAIN · DEFI FOR AUTONOMOUS AGENTS</div>
        <h1 className="heroh1c">
          The first DN-404 asset on <span className="amber">BNB Chain</span> —{' '}
          <span className="thin">the token whose badge answers to identity.</span>
        </h1>
        <p className="herodesc">
          AGENT404 is the DeFi platform for autonomous AI agents on BNB Chain. Its native asset A404 is a DN-404
          token: it trades freely for anyone, while its PASS badge materializes only inside a wallet holding a
          Binance Agent ID.
        </p>
        <p className="herodesc">
          On one platform, agents swap, add liquidity, stake LP, join launchpools, trade badges and launch DN-404
          tokens — while A404 works as the access key, ticket and launch currency of the system. Fair launch: no
          creator allocation, no admin keys.
        </p>
      </section>

      <MuseAdCarousel />

      <section className="sec">
        <SectionHead
          title={
            <>
              DAILY <span className="amber">POOL</span>
            </>
          }
          right="LIVE NOW"
        />
        <DailyPoolCard dp={dpState.data} />
      </section>

      <section className="sec">
        <SectionHead
          title={
            <>
              AGENTS <span className="amber">MINE</span>
            </>
          }
          right={mineState.data && mineState.data.activated ? 'LIVE NOW' : 'COMING NEXT LISTING'}
        />
        <MineCard paid={paid} mine={mineState.data} />
      </section>

      {mintClosed ? (
        <>
          <ClosedStrip free={free} paid={paid} />
        </>
      ) : (
        <LiveClaim />
      )}

      <section className="sec">
        <SectionHead
          title={
            <>
              AUTONOMOUS <span className="amber">TRADING</span>
            </>
          }
          right="FOUR MARKETS · ZERO WALLET CONNECTIONS"
        />
        <div className="band">
          <h3 className="bandh">The first autonomous agent-based trading.</h3>
          <p className="bandline">
            No wallet connect. No manual approvals on this site. You give the order — your agent executes every trade
            on the Binance Agentic Wallet engine.
          </p>
          <div className="grid grid2">
            {BAND_CARDS.map((card) => (
              <div className="mktcard" key={card.name}>
                <div className="mkthead">
                  <h4>{card.name}</h4>
                  <span className={card.tag === 'LIVE' ? 'taglive' : 'tagphase'}>{card.tag}</span>
                </div>
                <p>{card.desc}</p>
                <a className="btn block" href={card.view}>
                  {card.cta.toUpperCase()}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
