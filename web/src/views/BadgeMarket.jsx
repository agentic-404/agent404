import React, { useEffect, useMemo, useRef, useState } from 'react';
import { countersStore, listingsStore, badgesStore, marketStore, marketSeries, fillBlockTs, tsOfBlock } from '../data.js';
import { useStore } from '../store.js';
import { fmtInt, fmtToken, fmtTime, shortAddr } from '../format.js';
import { BADGE_IMG } from '../config.js';
import { SectionHead, StatCard, CopyBlock, StaleTag } from '../components.jsx';
import { buyPrompt } from '../prompts.js';
import badgeUrl from '../assets/a404-glitch-404.png';

const GALLERY_PAGE = 48;

function pageItems(cur, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const keep = [...new Set([1, 2, cur - 1, cur, cur + 1, count - 1, count].filter((n) => n >= 1 && n <= count))].sort(
    (a, b) => a - b
  );
  const out = [];
  let prev = 0;
  for (const n of keep) {
    if (prev && n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}

/* ---- floor-history step chart (ported from the live site) ---- */
function fmtAxis(v) {
  return (Math.round(v * 10000) / 10000).toString();
}

function FloorChart({ events, liveFloorWei, latestBlock, latestTs, tsMap }) {
  const { pts, sales } = useMemo(() => marketSeries(events || []), [events]);
  if (!pts.length && !(liveFloorWei !== null && liveFloorWei > 0n)) {
    return { note: null, minmax: '—', svg: null };
  }
  if (!pts.length && liveFloorWei !== null && liveFloorWei > 0n) {
    const lf = Number(liveFloorWei) / 1e18;
    const llo = lf * 0.9;
    const lhi = lf * 1.1;
    const ly = 12 + ((lhi - lf) / (lhi - llo)) * 58;
    return {
      note: null,
      minmax: 'LIVE FLOOR · HISTORY LOADING',
      svg: (
        <svg viewBox="0 0 640 96">
          <line x1="8" y1={ly} x2="632" y2={ly} stroke="#2b2b2b" strokeDasharray="3 4" />
          <circle cx="632" cy={ly} r="9" fill="rgba(245,179,1,.18)" />
          <circle cx="632" cy={ly} r="3.6" fill="#f5b301" />
          <text x="622" y={Math.max(10, ly - 10)} fill="#f2f2f2" fontSize="11" textAnchor="end">
            {fmtToken(liveFloorWei)}
          </text>
          <text x="8" y="92" fill="#666" fontSize="9">
            full history still loading from chain — showing the live floor
          </text>
          <text x="632" y="92" fill="#666" fontSize="9" textAnchor="end">
            {fmtTime(latestTs)}
          </text>
        </svg>
      ),
    };
  }
  const verts = [];
  let min = null;
  let max = null;
  for (const p of pts) {
    if (p.floor === null) continue;
    if (min === null || p.floor < min) min = p.floor;
    if (max === null || p.floor > max) max = p.floor;
    if (!verts.length || verts[verts.length - 1].floor !== p.floor) verts.push(p);
  }
  for (const x of sales) {
    if (min === null || x.price < min) min = x.price;
    if (max === null || x.price > max) max = x.price;
  }
  if (!verts.length) {
    return { note: null, minmax: '—', svg: null };
  }
  const tsOf = (b) => (tsMap.has(b) ? tsMap.get(b) : tsOfBlock(b, latestBlock, latestTs));
  const t0 = tsOf(verts[0].block);
  let t1 = latestTs;
  if (t1 - t0 < 3600) t1 = t0 + 3600;
  let lo = Number(min) / 1e18;
  let hi = Number(max) / 1e18;
  if (hi - lo < 1e-12) {
    lo *= 0.9;
    hi *= 1.1;
    if (hi - lo < 1e-12) {
      lo = 0;
      hi = 0.001;
    }
  } else {
    const padY = (hi - lo) * 0.12;
    lo -= padY;
    hi += padY;
    if (lo < 0) lo = 0;
  }
  const X = (ts) => 8 + ((ts - t0) / (t1 - t0)) * 624;
  const Y = (v) => 12 + ((hi - v) / (hi - lo)) * 58;
  let d = `M${X(t0).toFixed(1)},${Y(Number(verts[0].floor) / 1e18).toFixed(1)}`;
  for (let i = 1; i < verts.length; i++) {
    d += ` H${X(tsOf(verts[i].block)).toFixed(1)} V${Y(Number(verts[i].floor) / 1e18).toFixed(1)}`;
  }
  d += ` H${X(t1).toFixed(1)}`;
  const curFloor = verts[verts.length - 1].floor;
  const ey = Y(Number(curFloor) / 1e18);
  return {
    note: null,
    minmax: `MIN ${fmtToken(min)} — MAX ${fmtToken(max)} BNB`,
    svg: (
      <svg viewBox="0 0 640 96">
        <line x1="8" y1={Y(hi)} x2="632" y2={Y(hi)} stroke="#232323" strokeDasharray="3 4" />
        <line x1="8" y1={Y((hi + lo) / 2)} x2="632" y2={Y((hi + lo) / 2)} stroke="#232323" strokeDasharray="3 4" />
        <line x1="8" y1={Y(lo)} x2="632" y2={Y(lo)} stroke="#232323" strokeDasharray="3 4" />
        <path d={d} fill="none" stroke="#f5b301" strokeWidth="1.6" />
        {sales.map((x, i) => (
          <circle
            key={i}
            cx={X(tsOf(x.block))}
            cy={Y(Number(x.price) / 1e18)}
            r="3.2"
            fill="#050505"
            stroke="#f2f2f2"
            strokeWidth="1.4"
          />
        ))}
        <circle cx="632" cy={ey} r="9" fill="rgba(245,179,1,.18)" />
        <circle cx="632" cy={ey} r="3.6" fill="#f5b301" />
        <text x="622" y={Math.max(10, ey - 10)} fill="#f2f2f2" fontSize="11" textAnchor="end">
          {fmtToken(curFloor)}
        </text>
        <text x="8" y="92" fill="#666" fontSize="9">
          {fmtTime(t0)}
        </text>
        <text x="632" y="92" fill="#666" fontSize="9" textAnchor="end">
          {fmtTime(t1)}
          {sales.length ? ' · ○ = SALE' : ''}
        </text>
      </svg>
    ),
  };
}

/* ---- price ladder (ported from the live site) ---- */
function PriceLadder({ rows }) {
  if (!rows.length) return null;
  const floor = rows[0].price;
  const maxP = Number(rows[rows.length - 1].price) / 1e18;
  let axisMax = Math.max(maxP * 1.15, (Number(floor) / 1e18) * 2);
  const steps = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
  for (const s of steps) {
    if (s >= axisMax) {
      axisMax = s;
      break;
    }
  }
  const X = (v) => 8 + (v / axisMax) * 624;
  let lastX = -100;
  let alt = false;
  let tagged = false;
  return (
    <svg viewBox="0 0 640 62">
      <line x1="8" y1="34" x2="632" y2="34" stroke="#333" />
      {[0, 1, 2, 3, 4].map((t) => {
        const tv = (axisMax * t) / 4;
        const tx = X(tv);
        return (
          <g key={t}>
            <line x1={tx} y1="30" x2={tx} y2="38" stroke="#444" />
            <text x={tx} y="58" fill="#666" fontSize="9" textAnchor={t === 0 ? 'start' : t === 4 ? 'end' : 'middle'}>
              {fmtAxis(tv)}
              {t === 4 ? ' BNB' : ''}
            </text>
          </g>
        );
      })}
      {rows.map((rw, i) => {
        const pv = Number(rw.price) / 1e18;
        const x = X(pv);
        let y = 34;
        if (Math.abs(x - lastX) < 10) {
          alt = !alt;
          y = alt ? 25 : 43;
        } else alt = false;
        lastX = x;
        if (rw.price === floor && !tagged) {
          tagged = true;
          return (
            <g key={i}>
              <circle cx={x} cy="34" r="8.5" fill="rgba(245,179,1,.18)" />
              <circle cx={x} cy="34" r="3.6" fill="#f5b301" />
              <text x={x} y="12" fill="#f2f2f2" fontSize="10.5" textAnchor="middle">
                #{rw.id.toString()} · {fmtToken(rw.price)} · FLOOR
              </text>
            </g>
          );
        }
        return <circle key={i} cx={x} cy={y} r="3.2" fill="#9a9a9a" />;
      })}
    </svg>
  );
}

function initialSelection(rows) {
  const m = window.location.hash.match(/badge=(\d+)/);
  if (m) {
    const found = rows.find((r) => r.id.toString() === m[1]);
    if (found) return found.id.toString();
  }
  return rows.length ? rows[0].id.toString() : null;
}

export default function BadgeMarket() {
  const counters = useStore(countersStore);
  const listings = useStore(listingsStore);
  const badges = useStore(badgesStore);
  const market = useStore(marketStore);
  const rows = listings.data || [];
  const owners = badges.data.owners || {};
  const c = counters.data;
  const [selected, setSelected] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [gfilter, setGfilter] = useState('all');
  const [page, setPage] = useState(1);
  const buyRef = useRef(null);
  const [tsMap, setTsMap] = useState(new Map());
  const displayRows = sortDir === 'asc' ? rows : [...rows].reverse();
  useEffect(() => {
    setPage(1);
  }, [gfilter, sortDir]);

  useEffect(() => {
    setSelected(initialSelection(rows));
  }, [rows, selected]);

  const events = market.data || [];
  const latestBlock = c?.block ? Number(c.block) : 0;
  useEffect(() => {
    if (!events.length && !latestBlock) return;
    let alive = true;
    const blocks = events.map((e) => e.block);
    if (latestBlock) blocks.push(latestBlock);
    fillBlockTs(blocks).then((m) => {
      if (alive) setTsMap(new Map(m));
    });
    return () => {
      alive = false;
    };
  }, [events, latestBlock]);

  const latestTs = latestBlock && tsMap.has(latestBlock) ? tsMap.get(latestBlock) : Math.floor(Date.now() / 1000);
  const liveFloor = c?.mktFloor && c.mktFloor > 0n ? c.mktFloor : rows.length ? rows[0].price : null;
  const chart = FloorChart({ events, liveFloorWei: liveFloor, latestBlock, latestTs, tsMap });
  const sel = rows.find((r) => r.id.toString() === selected) || null;

  // Last-sale tab: the market's Sold events, newest first.
  const salesRows = useMemo(
    () => events.filter((e) => e.kind === 'sold').sort((a, b) => b.block - a.block || b.idx - a.idx),
    [events],
  );
  const relAgo = (ts) => {
    if (!ts) return '—';
    const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
    if (s < 90) return 'JUST NOW';
    if (s < 3600) return `${Math.floor(s / 60)} MIN AGO`;
    if (s < 86400) return `${Math.floor(s / 3600)} H AGO`;
    return `${Math.floor(s / 86400)} D AGO`;
  };
  const utcClock = (ts) => (ts ? `${new Date(ts * 1000).toISOString().slice(11, 16)} UTC` : '— UTC');

  // Gallery (the retired Badge Wall's card grid, listings only).
  const galleryRows = gfilter === 'floor' && liveFloor !== null ? displayRows.filter((r) => r.price === liveFloor) : displayRows;
  const pageCount = Math.max(1, Math.ceil(galleryRows.length / GALLERY_PAGE));
  const curPage = Math.min(page, pageCount);
  const pagedRows = galleryRows.slice((curPage - 1) * GALLERY_PAGE, curPage * GALLERY_PAGE);
  const multLabel = (p) => {
    if (!liveFloor || p <= liveFloor) return null;
    const t = Number((p * 10n) / liveFloor) / 10;
    return `${t >= 10 ? String(Math.round(t)) : t.toFixed(1)}× FLOOR`;
  };
  const pickBadge = (id) => {
    setSelected(id);
    buyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="sec first">
      <SectionHead
        title={
          <span className="tokhead">
            <img className="toklogo" src={badgeUrl} alt="AGENT404 404 mark" />
            <span className="mkt-title">
              <span className="mkt-white">BADGE</span> MARKET
            </span>
          </span>
        }
        right={
          <>
            NON-CUSTODIAL · AGENT ID BUYERS ONLY <StaleTag stale={listings.stale || counters.stale} />
          </>
        }
      />
      <div className="grid grid6">
        <StatCard
          glyph="⬢"
          accent="amber"
          label="FLOOR"
          big={liveFloor ? fmtToken(liveFloor) : '—'}
          sub="BNB per badge"
        />
        <StatCard
          glyph="▦"
          accent="amber"
          label="LISTINGS"
          big={c?.mktListings !== null && c?.mktListings !== undefined ? fmtInt(Number(c.mktListings)) : listings.loaded ? fmtInt(rows.length) : '—'}
          sub="active right now"
        />
        <StatCard
          glyph="Σ"
          accent="amber"
          label="LISTED VALUE"
          big={listings.loaded ? fmtToken(rows.reduce((a, r) => a + r.price, 0n)) : '—'}
          sub="BNB listed right now"
        />
        <StatCard
          glyph="⇄"
          accent="amber"
          label="SALES"
          big={c?.mktSales !== null && c?.mktSales !== undefined ? fmtInt(Number(c.mktSales)) : '—'}
          sub="badges changed hands here"
        />
        <StatCard
          glyph="≋"
          accent="amber"
          label="TOTAL VOLUME"
          big={c?.mktVolume !== null && c?.mktVolume !== undefined ? fmtToken(c.mktVolume) : '—'}
          sub="BNB traded here, all time"
        />
        <StatCard
          glyph="%"
          accent="amber"
          label="ROYALTY"
          big="1%"
          sub="of every sale, to the community reserve"
        />
      </div>


      <div className="chartbox">
        <div className="chart-h">
          <span>FLOOR · SINCE MARKET LAUNCH</span>
          <span>{chart.minmax}</span>
        </div>
        {chart.svg || (chart.note ? <div className="chart-note">{chart.note}</div> : null)}
        {rows.length ? (
          <>
            <div className="chart-sub">ACTIVE LISTINGS BY PRICE</div>
            <PriceLadder rows={rows} />
          </>
        ) : null}
      </div>

      <div className="panel">
        <div className="listhead">
          <h3 className="panelh">ACTIVE LISTINGS — THE GALLERY</h3>
          {rows.length > 1 && gfilter !== 'sales' && (
            <button type="button" className="sortbtn" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
              PRICE {sortDir === 'asc' ? '↑ LOW → HIGH' : '↓ HIGH → LOW'}
            </button>
          )}
        </div>
        <div className="filterrow">
          {[
            ['all', 'ALL LISTINGS'],
            ['floor', 'AT FLOOR'],
            ['sales', 'LAST SALE'],
          ].map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={`filterbtn ${gfilter === key ? 'on' : ''}`}
              onClick={() => setGfilter(key)}
            >
              {label}
            </button>
          ))}
          <span className="dim small">
            {gfilter === 'sales'
              ? salesRows.length
                ? `${fmtInt(salesRows.length)} sales recorded on this market`
                : 'reading sales from chain…'
              : rows.length
                ? `${fmtInt(galleryRows.length)} listed · tap a badge to open its buy panel`
                : 'reading listings from chain…'}
          </span>
        </div>
        {gfilter === 'sales' ? (
          salesRows.length === 0 ? (
            market.loaded ? <p className="dim">OPEN — THE FIRST SALE LANDS HERE.</p> : null
          ) : (
            <div className="saleslist">
              {salesRows.map((sv) => {
                const ts = tsMap.get(sv.block);
                return (
                  <div className="srow" key={sv.key}>
                    <img className="sthumb" src={badgeUrl} alt="" />
                    <div className="smain">
                      <div className="sid">
                        BADGE <span>#{fmtInt(Number(sv.id))}</span>
                      </div>
                      <div className="sflow">
                        {sv.seller && sv.buyer ? `${shortAddr(sv.seller)} → ${shortAddr(sv.buyer)}` : 'seller → buyer'}
                      </div>
                    </div>
                    <div className="sright">
                      <div className="sprice">{sv.price !== null ? `${fmtToken(BigInt(sv.price))} BNB` : '—'}</div>
                      <div className="swhen">
                        {utcClock(ts)}
                        <br />
                        {relAgo(ts)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : rows.length === 0 ? (
          listings.loaded ? <p className="dim">OPEN — BE THE FIRST LISTING.</p> : null
        ) : (
          <div className="bgrid">
            {pagedRows.map((rw) => {
              const atFloor = liveFloor !== null && rw.price === liveFloor;
              const id = Number(rw.id);
              return (
                <button
                  type="button"
                  className={`bcard bcardbtn ${atFloor ? 'atfloor' : ''} ${sel && sel.id === rw.id ? 'sel' : ''}`}
                  key={rw.id.toString()}
                  onClick={() => pickBadge(rw.id.toString())}
                >
                  <img src={BADGE_IMG} alt={`AGENT404 Badge #${id}`} loading="lazy" />
                  <div className="bname">BADGE #{fmtInt(id)}</div>
                  <div className="bprice listed">{fmtToken(rw.price)} BNB</div>
                  {atFloor ? (
                    <span className="btag">AT FLOOR</span>
                  ) : (
                    <span className="btag mult">{multLabel(rw.price)}</span>
                  )}
                  <div className="bstatus">{owners[id] ? `OWNER ${shortAddr(owners[id])}` : 'OWNER — READING…'}</div>
                  <span className="bbuy">SELECT TO BUY →</span>
                </button>
              );
            })}
          </div>
        )}
        {gfilter !== 'sales' && pageCount > 1 ? (
          <div className="pager">
            <button type="button" className="pagebtn" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>
              ‹ PREV
            </button>
            {pageItems(curPage, pageCount).map((it, i) =>
              it === '…' ? (
                <span className="pagegap" key={`gap-${i}`}>
                  …
                </span>
              ) : (
                <button
                  type="button"
                  key={it}
                  className={`pagebtn ${it === curPage ? 'on' : ''}`}
                  onClick={() => setPage(it)}
                >
                  {it}
                </button>
              )
            )}
            <button type="button" className="pagebtn" disabled={curPage >= pageCount} onClick={() => setPage(curPage + 1)}>
              NEXT ›
            </button>
            <span className="dim small">
              page {curPage} of {pageCount}
            </span>
          </div>
        ) : null}
      </div>

      <div className="panel" ref={buyRef}>
          <h3 className="panelh">BUY A BADGE</h3>
          {sel ? (
            <>
              <div className="buyline">
                <span>BADGE</span>
                <b>#{sel.id.toString()}</b>
              </div>
              <div className="buyline">
                <span>PRICE</span>
                <b>{fmtToken(sel.price)} BNB</b>
              </div>
              <CopyBlock title="GIVE THIS TO YOUR AGENT — THE BUY PROMPT" text={buyPrompt(sel.id.toString(), sel.price)} />
            </>
          ) : (
            <p className="dim">Select a listing to see its buy panel. Prices are read live from the market contract.</p>
          )}
      </div>
    </section>
  );
}
