import React, { useEffect, useRef, useState } from 'react';
import { countersStore, passdropStore, mineStore, dailyPoolStore, museAdStore, pairAdStore } from '../data.js';
import { useStore } from '../store.js';
import { fmtInt, fmtToken, fmtCountdown, truncAddr } from '../format.js';
import { FREE_DEADLINE, PAID_DEADLINE, FREE_CAP, PAID_CAP, FREE_PER_CLAIM, PAID_PER_CLAIM, A, scanAddr } from '../config.js';
import { CopyBlock, SectionHead, StatCard, LiveBadge, StaleTag } from '../components.jsx';
import { CLAIM_PROMPT } from '../prompts.js';
import g404Url from '../assets/g404-logo-256.png';
import a404Url from '../assets/a404-glitch-404.png';
import cakeUrl from '../assets/cake-logo.png';
import museUrl from '../assets/muse-logo.png';
import rocketUrl from '../assets/rocket.png';

const MONTHS_S = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS_S = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
function fmtUtc(ts) {
  const dt = new Date(ts * 1000);
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mm = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${DAYS_S[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS_S[dt.getUTCMonth()]} ${dt.getUTCFullYear()} · ${hh}:${mm} UTC`;
}

// ---------- BNB/USD (live) ----------
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

function LaunchpoolCard({ d, state }) {
  const sold = d?.totalShares ?? null;
  const target = d?.targetShares ?? null;
  const pct = sold !== null && target ? Math.min(100, (Number(sold) / Number(target)) * 100) : 0;
  const listed = state === 'IGNITED';
  const failed = state === 'ABORTED';
  const closed = state === 'CLOSED';
  const pair = d?.pair && d.pair !== '0x0000000000000000000000000000000000000000' ? d.pair : null;
  const desc = listed
    ? 'Target reached. The pool ignited on close and the LP was burned — the token trades on its own pool.'
    : failed
      ? 'Closed below target. Deposits refunded, ticket vaults returned pro-rata — the record stays, dimmed, exactly as it ended.'
      : closed
        ? 'The window closed below target. The abort path governs — deposits and vault claims run exactly as published.'
        : 'The first agentic launchpool. Pass holders only — 550,000 $G404 per share through an $A404 ticket or a refundable BNB deposit. At 1,000 shares the pool ignites and the LP is burned.';
  return (
    <div className={`sev${listed || failed || closed ? ' past' : ' live'}${failed ? ' dim' : ''}`}>
      {listed ? <span className="sev-stamp listed">LISTED ✓</span> : null}
      {failed ? <span className="sev-stamp fail">FAIL ✕</span> : null}
      {state === 'CHARGING' ? (
        <div className="refundribbon" aria-hidden="true">
          BNB REFUND<small>BACK IN 24H</small>
        </div>
      ) : null}
      <div className="sev-head">
        <img className="sev-logo" src={g404Url} alt="GENESIS404 logo" />
        <div>
          <div className="sev-num">EVENT #1</div>
          <div className="sev-title">
            GENESIS404 <span>$G404</span>
          </div>
        </div>
        {state === 'COMPLETED' ? <span className="sev-chip ghost">TARGET REACHED</span> : null}
        {closed ? <span className="sev-chip ghost">WINDOW CLOSED</span> : null}
      </div>
      <div className="sev-tick">
        GENESIS404 <b className="pair">$G404/BNB</b>
        {listed ? <img className="sev-venue" src={cakeUrl} alt="PancakeSwap" /> : null}
        {!listed && !failed ? <span className="st">· PAIR FORMS AT IGNITION</span> : null}
        {failed ? <span className="st">· NO PAIR FORMED</span> : null}
      </div>
      <div className="sev-spec">
        <span>
          <span className="k">NAME</span>
          <span className="v">GENESIS404</span>
        </span>
        <span>
          <span className="k">TICKER</span>
          <span className="v amber">$G404</span>
        </span>
        <span>
          <span className="k">MAX SUPPLY</span>
          <span className="v">1,000,000,000 — FIXED, NO MINT</span>
        </span>
        <span>
          <span className="k">STANDARD</span>
          <span className="v">ERC-20</span>
        </span>
      </div>
      <p className="sev-desc">{desc}</p>
      {sold !== null && target ? (
        <div className="sev-bar">
          <i style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <div className="sev-meta">
        <span>
          {listed || failed || closed ? 'FINAL ' : ''}SHARES{' '}
          <b>
            {sold !== null ? fmtInt(Number(sold)) : '—'} / {target ? fmtInt(Number(target)) : '—'}
          </b>
        </span>
        {!listed && !failed ? (
          <span>
            REWARD <b>{d?.rewardPerShare ? `${fmtToken(BigInt(d.rewardPerShare))} / SHARE` : '—'}</b>
          </span>
        ) : null}
        {listed ? (
          <span>
            POOL <b>LIVE · LP BURNED</b>
          </span>
        ) : failed ? (
          <span>
            OUTCOME <b>REFUNDED</b>
          </span>
        ) : (
          <span>
            CLOSES <b>{d?.chargeEnd ? fmtUtc(Number(d.chargeEnd)) : '—'}</b>
          </span>
        )}
      </div>
      {!listed && !failed ? (
        <a className="sev-open" href="#/passdrop">
          OPEN EVENT →
        </a>
      ) : (
        <span className="sev-actions">
          {listed && pair ? (
            <a
              className="sev-ghost"
              href={`https://www.geckoterminal.com/bsc/pools/${pair}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              VIEW THE POOL →
            </a>
          ) : null}
          <a className="sev-ghost" href="#/passdrop">
            OPEN EVENT →
          </a>
        </span>
      )}
    </div>
  );
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
  return `${ratio.toExponential(2)} A404`;
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

function MuseAdCarousel() {
  const ad = useStore(museAdStore);
  const pair = useStore(pairAdStore);
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
  ];
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
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
          {slides.map((s) => (
            <div className="muse-ad-slide" key={s.key}>
              <a className="muse-ad-card" href={s.href}>
                <div className="muse-ad-top">
                  {s.logos ? (
                    <div className="muse-ad-logos">
                      {s.logos.map((u, li) => (
                        <img key={li} className="muse-ad-logo" src={u} alt={s.logoAlt || 'logo'} />
                      ))}
                    </div>
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
                <span className="btn solid block">{s.cta}</span>
              </a>
            </div>
          ))}
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

export default function Home() {
  const counters = useStore(countersStore);
  const pdStore = useStore(passdropStore);
  const mineState = useStore(mineStore);
  const dpState = useStore(dailyPoolStore);
  const now = useNow();
  const c = counters.data;
  const free = c?.free ?? null;
  const paid = c?.paid ?? null;
  const paidSoldOut = paid !== null && paid >= BigInt(PAID_CAP);
  const mintClosed = paidSoldOut || now > PAID_DEADLINE;
  const pdD = pdStore.data;
  const pdState =
    !pdD || pdD.activated === null || pdD.activated === undefined
      ? 'READING'
      : pdD.aborted
        ? 'ABORTED'
        : pdD.ignited
          ? 'IGNITED'
          : pdD.completed
            ? 'COMPLETED'
            : pdD.chargeEnd !== null && pdD.chargeEnd !== undefined && now > Number(pdD.chargeEnd)
              ? 'CLOSED'
              : pdD.activated
                ? 'CHARGING'
                : 'PRE';
  return (
    <>
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

      <section className="sec">
        <SectionHead
          title={
            <>
              AGENTS <span className="amber">LAUNCHPOOL</span>
            </>
          }
          right="HISTORY · NEW LISTING"
        />
        <LaunchpoolCard d={pdD} state={pdState} />
        <a className="sevmore" href="#/passdrop">
          FULL HISTORY ON THE PASSDROP PAGE →
        </a>
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

    </>
  );
}
