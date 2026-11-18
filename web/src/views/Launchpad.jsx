import React, { useEffect, useMemo, useState } from 'react';
import { launchpadStore, launchpadFeedStore, fillBlockTs } from '../data.js';
import { useStore } from '../store.js';
import { fmtInt, fmtToken, truncAddr } from '../format.js';
import { A, BADGE_GW, scanTx } from '../config.js';
import { CopyBlock, Addr } from '../components.jsx';
import {
  launchpadFreePrompt,
  launchpadVipPrompt,
  launchpadJoinPrompt,
  lpShareLaunchPrompt,
  lpShareClimbPrompt,
  lpShareIgnitionPrompt,
} from '../prompts.js';

// AGENT LAUNCHPAD — the launch board for third-party DN-404 launches.
// The board lists ONLY tokens launched through the Launchpad factory,
// ranked by distinct Agent ID wallets transacting in a rolling 24-hour
// window (one wallet, one vote): positions 1–5 are the VIP zone (the
// 101 $A404 door), positions 6–10 the best free listings. Every launch
// also gets its own monitor page at #/launchpad/<token> in the
// LIVE MONITOR pattern. Until the factory address lands in
// config (A.launchpad) the page renders the full skeleton in its
// IN PREPARATION state — no invented numbers, no placeholder
// addresses — and every panel switches to live contract reads the
// moment the address is set (launchpadStore / launchpadFeedStore).

function useNowTick() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function relTime(ts, now) {
  if (!ts) return '';
  const s = Math.max(0, now - ts);
  if (s < 60) return 'JUST NOW';
  if (s < 3600) return `${Math.floor(s / 60)}M AGO`;
  if (s < 86400) return `${Math.floor(s / 3600)}H AGO`;
  return `${Math.floor(s / 86400)}D AGO`;
}

const MONTHS_S = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS_S = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
function fmtUtc(ts) {
  const dt = new Date(ts * 1000);
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mm = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${DAYS_S[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS_S[dt.getUTCMonth()]} ${dt.getUTCFullYear()} · ${hh}:${mm} UTC`;
}

/** Short window label for board rows and the monitor's WINDOW tile. */
function endsLabel(l, now) {
  if (l.ignited) return 'POOL LIVE';
  if (l.completed) return 'TARGET REACHED';
  if (!l.chargeEnd) return '—';
  const left = Number(l.chargeEnd) - now;
  if (left <= 0) return 'WINDOW CLOSED';
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  if (d > 0) return `ENDS ${d}D ${h}H`;
  if (h > 0) return `ENDS ${h}H ${m}M`;
  return `ENDS ${m}M`;
}

const PALETTE = ['#f5b301', '#5aa2e8', '#3fb96f', '#e86a5a', '#b48ce8', '#5ae8c9', '#e8c95a', '#e85a9e'];
function tileColor(seed) {
  let h = 0;
  const s = seed || '';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function initialsOf(l) {
  const sym = (l.symbol || '').replace(/[^A-Za-z0-9]/g, '');
  if (sym) return sym.slice(0, 2).toUpperCase();
  const words = (l.name || '').split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return '—';
}
function iconUrl(uri) {
  if (!uri) return null;
  if (uri.startsWith('ipfs://')) return BADGE_GW + uri.slice(7);
  if (/^https?:\/\//.test(uri)) return uri;
  return null;
}

/** The board icon IS the image planted in the token contract at birth;
 *  an unreadable image falls back to the monogram tile. */
function LaunchIcon({ l, big }) {
  const [err, setErr] = useState(false);
  const url = iconUrl(l.imageURI);
  const cls = `lpicon${big ? ' lg' : ''}`;
  if (url && !err) return <img className={cls} src={url} alt="" onError={() => setErr(true)} />;
  return (
    <div className={cls} style={{ background: tileColor(l.symbol || l.name || l.token) }} aria-hidden="true">
      {initialsOf(l)}
    </div>
  );
}

/* ================= the activity feed (board + per-token) ================= */

const LP_FEED_LABEL = {
  paid: { t: 'PAID', cls: 'amber' },
  free: { t: 'FREE', cls: 'blue' },
  claim: { t: 'CLAIM', cls: 'green' },
  claimLP: { t: 'CLAIM LP', cls: 'green' },
  vest: { t: 'VEST OUT', cls: 'grey' },
  ignition: { t: 'IGNITION', cls: 'hot' },
  pool: { t: 'POOL BUILT', cls: 'hot' },
  completed: { t: 'TARGET HIT', cls: 'hot' },
};

function lpFeedDetail(e, launch) {
  const sym = launch && launch.symbol ? launch.symbol : 'TOKENS';
  const parts = [];
  const tok = (v) => (v !== null && v !== undefined ? fmtToken(BigInt(v)) : null);
  try {
    if (e.kind === 'paid') {
      if (e.shares !== null && e.shares !== undefined) parts.push(`${fmtInt(Number(e.shares))} SHARES`);
      if (e.shares !== null && e.shares !== undefined && launch && launch.sharePrice) {
        parts.push(`${fmtToken(BigInt(e.shares) * launch.sharePrice)} BNB`);
      }
      if (e.note) parts.push(e.note);
    } else if (e.kind === 'free') {
      parts.push('DAILY SLOT CLAIMED');
    } else if (e.kind === 'claim') {
      const r = tok(e.a);
      const liq = tok(e.b);
      if (r) parts.push(`${r} BNB REFUNDED`);
      if (liq) parts.push(`${liq} ${sym} LIQUID`);
    } else if (e.kind === 'claimLP') {
      const v = tok(e.a);
      if (v) parts.push(`${v} LP`);
    } else if (e.kind === 'vest') {
      const v = tok(e.a);
      if (v) parts.push(`${v} ${sym}`);
    } else if (e.kind === 'ignition' || e.kind === 'pool') {
      const bnb = tok(e.a);
      const tk = tok(e.b);
      if (bnb) parts.push(`${bnb} BNB PAIRED`);
      if (tk) parts.push(`${tk} ${sym} PAIRED`);
    } else if (e.kind === 'completed') {
      if (e.a !== null && e.a !== undefined) parts.push(`${fmtInt(Number(e.a))} SHARES — TARGET REACHED`);
    }
  } catch {
    /* a malformed row renders its label alone */
  }
  return parts.length ? parts.join(' · ') : '—';
}

function LpFeed({ events, launches, onlyEngine, now, soon }) {
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState(null);
  const [tsMap, setTsMap] = useState(new Map());
  const filtered = useMemo(
    () => (events ? (onlyEngine ? events.filter((e) => e.engine === onlyEngine) : events) : null),
    [events, onlyEngine],
  );
  const shown = paused && frozen ? frozen : filtered;
  useEffect(() => {
    if (!paused) setFrozen(filtered);
  }, [filtered, paused]);
  useEffect(() => {
    if (!shown || !shown.length) return;
    let alive = true;
    fillBlockTs(shown.slice(0, 12).map((e) => e.block)).then((m) => {
      if (alive) setTsMap(new Map(m));
    });
    return () => {
      alive = false;
    };
  }, [shown]);
  const byEngine = useMemo(
    () => new Map((launches || []).map((l) => [l.engine.toLowerCase(), l])),
    [launches],
  );
  return (
    <div className="panel monitorpanel">
      <div className="monhead">
        <h3 className="panelh">LIVE ACTIVITY</h3>
        <span className="lpfeedtools">
          <span className="monlive">
            <i className={paused ? 'dot paused' : 'dot'} />
            {paused ? 'PAUSED' : 'LIVE'} · READ FROM THE CONTRACTS
          </span>
          <button type="button" className="monpause" onClick={() => setPaused((p) => !p)}>
            {paused ? '▶ RESUME' : '⏸ PAUSE'}
          </button>
        </span>
      </div>
      <div className="monfeed">
        {!shown ? (
          <div className="monrow dim">
            {soon ? 'in preparation — the feed opens with the first launch.' : 'reading launch events from chain…'}
          </div>
        ) : shown.length === 0 ? (
          <div className="monrow dim">
            {onlyEngine
              ? 'no activity yet for this launch — the first deposit or free slot opens its feed.'
              : 'no activity yet — the first deposit or free slot opens this feed.'}
          </div>
        ) : (
          shown.slice(0, 12).map((e) => {
            const L = LP_FEED_LABEL[e.kind] || { t: (e.kind || 'EVENT').toUpperCase(), cls: 'grey' };
            const launch = byEngine.get(e.engine);
            return (
              <div className="monrow" key={e.key}>
                <span className={`monact ${L.cls}`}>{L.t}</span>
                <span className="monmain">
                  <span className="mondetail">
                    {onlyEngine ? (
                      lpFeedDetail(e, launch)
                    ) : (
                      <>
                        <b>{launch ? launch.name || truncAddr(launch.token) : 'LAUNCH'}</b> — {lpFeedDetail(e, launch)}
                      </>
                    )}
                  </span>
                  <span className="monwho">{e.who ? truncAddr(e.who) : 'ENGINE'}</span>
                </span>
                <span className="monright">
                  <span className="monwhen">
                    {tsMap.has(e.block) ? relTime(tsMap.get(e.block), now) : `BLOCK ${fmtInt(e.block)}`}
                  </span>
                  <a href={scanTx(e.tx)} target="_blank" rel="noopener noreferrer">
                    ↗
                  </a>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ================= the board ================= */

function BoardRow({ l, rank, now }) {
  const sold = l.totalShares ?? null;
  const target = l.targetShares ?? null;
  const pct = sold !== null && target && target > 0n ? Math.min(100, (Number(sold) / Number(target)) * 100) : 0;
  return (
    <a className={`lprow${l.vip ? ' vip' : ''}`} href={`#/launchpad/${l.token}`}>
      <div className="lprank">{rank}</div>
      <LaunchIcon l={l} />
      <div className="lpwho">
        <div className="lpname">
          {l.name || truncAddr(l.token)}
          {l.vip ? <span className="lpchip">VIP</span> : null}
        </div>
        <div className="lpmeta">
          <span className="lpbar">
            <i style={{ width: `${pct}%` }} />
          </span>
          <span>
            {sold === null ? '—' : fmtInt(Number(sold))} / {target === null ? '—' : fmtInt(Number(target))} shares
          </span>
          <span aria-hidden="true">·</span>
          <span>{l.totalPaidIn !== null && l.totalPaidIn !== undefined ? `${fmtToken(l.totalPaidIn)} BNB raised` : '— BNB raised'}</span>
          <span aria-hidden="true">·</span>
          <span>{endsLabel(l, now).toLowerCase()}</span>
        </div>
      </div>
      <div className="lpagents">
        <div className="n">{l.agents24h === null || l.agents24h === undefined ? '—' : fmtInt(l.agents24h)}</div>
        <div className="l">AGENTS · 24H</div>
      </div>
    </a>
  );
}

function ZoneHead({ title, tag }) {
  return (
    <div className="lpzone">
      <h2>{title}</h2>
      <span className="lpztag">{tag}</span>
      <span className="lpzline" />
    </div>
  );
}

export default function Launchpad() {
  const lp = useStore(launchpadStore);
  const feed = useStore(launchpadFeedStore);
  const now = useNowTick();
  const live = !!A.launchpad;
  const launches = lp.data && lp.data.launches ? lp.data.launches : null;

  const byAgents = (x, y) => (y.agents24h ?? -1) - (x.agents24h ?? -1) || y.id - x.id;
  const active = launches ? launches.filter((l) => l.active !== false) : [];
  const vipTop = active.filter((l) => l.vip).sort(byAgents).slice(0, 5);
  const freeTop = active.filter((l) => !l.vip).sort(byAgents).slice(0, 5);
  const onBoard = new Set([...vipTop, ...freeTop].map((l) => l.id));
  const more = active.filter((l) => !onBoard.has(l.id)).sort(byAgents);
  const archive = launches ? launches.filter((l) => l.active === false).sort((x, y) => y.id - x.id) : [];

  const zoneEmpty = !live
    ? 'IN PREPARATION — the factory contract is not deployed yet. The board is wired: launches appear here the moment it lands.'
    : !launches
      ? 'READING THE FACTORY…'
      : null;

  return (
    <section className="sec first">
      <div className="lpkickrow">
        <div className="kicker amber">AGENTS LAUNCHPAD</div>
        <span className="lpstatus">{live ? 'LIVE · BSC MAINNET' : 'IN PREPARATION · BSC MAINNET'}</span>
      </div>
      <h1 className="lph1">The DN-404 launch board.</h1>
      <p className="lplede">
        Fair-mint launches by Agent ID holders, ranked by <b>real agent wallets</b> — rolling 24 hours, one wallet
        one vote. Watch the board, or launch yours.
      </p>

      <ZoneHead
        title="VIP ZONE"
        tag={
          <>
            <span className="amber">POSITIONS 1–5</span> · THE VIP DOOR
          </>
        }
      />
      <div className="lpboard">
        {zoneEmpty ? (
          <div className="lpempty">{zoneEmpty}</div>
        ) : vipTop.length === 0 ? (
          <div className="lpempty">NO VIP LAUNCHES YET — the first VIP launch takes position 1.</div>
        ) : (
          vipTop.map((l, i) => <BoardRow key={l.id} l={l} rank={i + 1} now={now} />)
        )}
      </div>

      <ZoneHead
        title="FREE ZONE"
        tag={
          <>
            <span className="amber">POSITIONS 6–10</span> · NO $A404 DOOR
          </>
        }
      />
      <div className="lpboard freezone">
        {zoneEmpty ? (
          <div className="lpempty">{zoneEmpty}</div>
        ) : freeTop.length === 0 ? (
          <div className="lpempty">NO FREE LAUNCHES YET — the first free launch takes position 6.</div>
        ) : (
          freeTop.map((l, i) => <BoardRow key={l.id} l={l} rank={i + 6} now={now} />)
        )}
      </div>

      {more.length ? (
        <>
          <ZoneHead title="MORE LAUNCHES" tag="ACTIVE · BELOW THE TOP 10" />
          <div className="panel">
            <div className="statusrows">
              {more.map((l, i) => (
                <div className="buyline" key={l.id}>
                  <span>
                    #{11 + i} · {(l.name || truncAddr(l.token)).toUpperCase()}
                  </span>
                  <b>
                    {l.agents24h === null || l.agents24h === undefined ? '—' : fmtInt(l.agents24h)} AGENTS ·{' '}
                    {l.totalShares === null || l.totalShares === undefined ? '—' : fmtInt(Number(l.totalShares))} SHARES ·{' '}
                    <a href={`#/launchpad/${l.token}`}>MONITOR →</a>
                  </b>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {archive.length ? (
        <>
          <ZoneHead title="THE ARCHIVE" tag="ENDED LAUNCHES · THE RECORD STAYS" />
          <div className="panel">
            <div className="statusrows">
              {archive.map((l) => (
                <div className="buyline" key={l.id}>
                  <span>{(l.name || truncAddr(l.token)).toUpperCase()}</span>
                  <b>
                    {l.ignited ? 'IGNITED — POOL LIVE' : 'WINDOW CLOSED'} ·{' '}
                    {l.totalShares === null || l.totalShares === undefined ? '—' : fmtInt(Number(l.totalShares))} SHARES ·{' '}
                    <a href={`#/launchpad/${l.token}`}>MONITOR →</a>
                  </b>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <LpFeed events={feed.data} launches={launches} now={now} soon={!live} />

      <ZoneHead title="LAUNCH YOURS" tag="ONE MACHINE FOR EVERY LAUNCH" />
      <div className="lpdoors">
        <div className="lpdoor">
          <span className={`doortag${live ? '' : ' dim'}`}>{live ? 'OPEN NOW' : 'IN PREPARATION'}</span>
          <h3>FREE DOOR</h3>
          <div className="lpprice">
            0 $A404 <small>— no launch fee</small>
          </div>
          <ul>
            <li>
              Board zone: <b>positions 6–10</b> and below
            </li>
            <li>
              Supply fixed at <b>10,000</b> · image planted at birth
            </li>
            <li>One active launch per Agent ID</li>
          </ul>
          <CopyBlock title="GIVE THIS TO YOUR AGENT — LAUNCH FREE" text={launchpadFreePrompt()} />
        </div>
        <div className="lpdoor vipd">
          <span className={`doortag${live ? '' : ' dim'}`}>{live ? 'OPEN NOW' : 'IN PREPARATION'}</span>
          <h3>VIP DOOR</h3>
          <div className="lpprice">
            101 $A404 <small>— half of it burned</small>
          </div>
          <ul>
            <li>
              Board zone: <b>positions 1–5</b>
            </li>
            <li>Rank inside the zone still earned by agent activity</li>
            <li>Free listings can upgrade at any time</li>
          </ul>
          <CopyBlock title="GIVE THIS TO YOUR AGENT — LAUNCH VIP" text={launchpadVipPrompt()} />
        </div>
      </div>

      <p className="lpfoot">
        Every launch runs the same fair-mint machine:{' '}
        <b>
          free daily slots for Agent ID holders, a +24h claim (BNB refund + token reward), the pool born at
          ignition, LP burned.
        </b>{' '}
        The house takes 10% of BNB raised on the paid lane — nothing else, from nobody else.
      </p>

      <h3 className="panelh">CONTRACTS</h3>
      <div className="panel">
        <div className="statusrows">
          <div className="buyline">
            <span>LAUNCHPAD FACTORY (CONTRACT: AgentLaunchpad)</span>
            {A.launchpad ? (
              <Addr address={A.launchpad} />
            ) : (
              <b>IN PREPARATION — the address publishes in llms.txt at deployment</b>
            )}
          </div>
          <div className="buyline">
            <span>A404 TOKEN</span>
            <Addr address={A.token} />
          </div>
          <div className="buyline">
            <span>AGENT ID REGISTRY</span>
            <Addr address={A.registry} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================= the per-token monitor ================= */

export function LaunchpadToken({ token }) {
  const lp = useStore(launchpadStore);
  const feed = useStore(launchpadFeedStore);
  const now = useNowTick();
  const live = !!A.launchpad;
  const launches = lp.data && lp.data.launches ? lp.data.launches : null;
  const l = launches ? launches.find((x) => x.token.toLowerCase() === String(token).toLowerCase()) : null;

  if (!live) {
    return (
      <section className="sec first">
        <a className="lpback" href="#/launchpad">
          ← THE BOARD
        </a>
        <div className="panel" style={{ marginTop: 18 }}>
          <h3 className="panelh">IN PREPARATION</h3>
          <p className="dim">
            The Launchpad factory is not deployed yet — no token has launched through it, so there is nothing to
            monitor. The board is wired and wakes up the moment the factory lands.
          </p>
        </div>
      </section>
    );
  }
  if (!launches) {
    return (
      <section className="sec first">
        <a className="lpback" href="#/launchpad">
          ← THE BOARD
        </a>
        <div className="panel" style={{ marginTop: 18 }}>
          <p className="dim">READING THE FACTORY…</p>
        </div>
      </section>
    );
  }
  if (!l) {
    return (
      <section className="sec first">
        <a className="lpback" href="#/launchpad">
          ← THE BOARD
        </a>
        <div className="panel" style={{ marginTop: 18 }}>
          <h3 className="panelh">NOT ON THIS BOARD</h3>
          <p className="dim">
            This token was not launched through the Agents Launchpad. The board lists only its own launches — to be
            on it, launch here.
          </p>
        </div>
      </section>
    );
  }

  const sold = l.totalShares ?? null;
  const target = l.targetShares ?? null;
  const pct = sold !== null && target && target > 0n ? (Number(sold) / Number(target)) * 100 : 0;
  const statusText = l.ignited
    ? 'POOL LIVE · LP BURNED'
    : l.completed
      ? 'TARGET REACHED · IGNITION IS NEXT'
      : l.active
        ? 'WINDOW OPEN'
        : 'WINDOW CLOSED';

  return (
    <section className="sec first">
      <a className="lpback" href="#/launchpad">
        ← THE BOARD
      </a>
      <div className="lpmonhead">
        <LaunchIcon l={l} big />
        <div className="lpmonid">
          <div className="lpmonname">
            {l.name || truncAddr(l.token)}
            {l.vip ? <span className="lpchip">VIP</span> : <span className="lpchip free">FREE</span>}
          </div>
          <div className="lpmonsym">${l.symbol || '—'} · DN-404 · SUPPLY 10,000</div>
        </div>
        <span className="lpmonstatus">{statusText}</span>
      </div>

      <div className="panel monitorpanel">
        <div className="monhead">
          <h3 className="panelh">LIVE MONITOR</h3>
          <span className="monlive">
            <i className="dot" />
            LIVE · READ FROM THE ENGINE
          </span>
        </div>
        <div className="montile big">
          <div className="lk">SHARES SOLD</div>
          <div className="monbig">
            {sold === null ? '—' : fmtInt(Number(sold))}
            <span className="bigsub"> / {target === null ? '—' : fmtInt(Number(target))}</span>
          </div>
          <div className="monbar">
            <i style={{ width: `${Math.max(1, Math.min(100, pct))}%` }} />
          </div>
          <div className="lstatsub">
            {l.ignited
              ? 'THE POOL IS LIVE — LP BURNED'
              : `${pct.toFixed(1)}% OF TARGET${target !== null && sold !== null ? ` · ${fmtInt(Number(target - sold))} SHARES TO IGNITION` : ''}`}
          </div>
        </div>
        <div className="montiles">
          <div className="montile">
            <div className="lk">AGENT WALLETS</div>
            <div className="monnum">
              {l.agents24h === null || l.agents24h === undefined ? '—' : fmtInt(l.agents24h)}
            </div>
            <div className="lstatsub">distinct Agent ID wallets · 24H</div>
          </div>
          <div className="montile">
            <div className="lk">BNB RAISED</div>
            <div className="monnum">
              {l.totalPaidIn === null || l.totalPaidIn === undefined ? '—' : fmtToken(l.totalPaidIn)}
            </div>
            <div className="lstatsub">BNB through the paid lanes</div>
          </div>
          <div className="montile">
            <div className="lk">SHARE PRICE</div>
            <div className="monnum">
              {l.sharePrice === null || l.sharePrice === undefined ? '—' : fmtToken(l.sharePrice)}
            </div>
            <div className="lstatsub">BNB per paid share · fixed at launch</div>
          </div>
          <div className="montile">
            <div className="lk">WINDOW</div>
            <div className="monnum">{endsLabel(l, now)}</div>
            <div className="lstatsub">{l.chargeEnd ? `ENDS ${fmtUtc(Number(l.chargeEnd))}` : '—'}</div>
          </div>
        </div>
      </div>

      <LpFeed
        events={feed.data}
        launches={launches}
        onlyEngine={l.engine.toLowerCase()}
        now={now}
        soon={false}
      />

      <h3 className="panelh">ACT — THROUGH YOUR AGENT</h3>
      <CopyBlock
        title={`GIVE THIS TO YOUR AGENT — JOIN $${l.symbol || 'THIS LAUNCH'}`}
        text={launchpadJoinPrompt(l)}
        note="One block for this launch: it resolves the launch on the factory first, reads the engine's live price and quota, and only then acts."
      />

      <h3 className="panelh">SHARE IT — FOR POSTING, NOT FOR YOUR AGENT</h3>
      <CopyBlock title="FOR POSTING — JUST LAUNCHED" text={lpShareLaunchPrompt(l)} />
      <CopyBlock title="FOR POSTING — CLIMBING" text={lpShareClimbPrompt(l)} />
      <CopyBlock title="FOR POSTING — IGNITION · TRADING OPEN" text={lpShareIgnitionPrompt(l)} />

      <h3 className="panelh">CONTRACTS</h3>
      <div className="panel">
        <div className="statusrows">
          <div className="buyline">
            <span>TOKEN</span>
            <Addr address={l.token} />
          </div>
          <div className="buyline">
            <span>EVENT ENGINE</span>
            <Addr address={l.engine} />
          </div>
          <div className="buyline">
            <span>LAUNCHPAD FACTORY</span>
            <Addr address={A.launchpad} />
          </div>
          {l.pair ? (
            <div className="buyline">
              <span>POOL</span>
              <Addr address={l.pair} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
