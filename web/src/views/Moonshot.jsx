import React, { useEffect, useRef, useState } from 'react';
import { moonshotStore } from '../data.js';
import { useStore } from '../store.js';
import { fmtInt, fmtToken, fmtWeiExact, padArg, toBig } from '../format.js';
import { A, SEL, BADGE_GW } from '../config.js';
import { rpcBatch, callReq } from '../rpc.js';
import { CopyBlock, Addr } from '../components.jsx';

// AGENT MOONSHOT — the bonding-curve board.
// The board lists ONLY tokens launched through the Moonshot factory,
// newest first, in the approved v1 cards layout (mock-moonshot-board.html):
// logo, name + ticker, PRICE, MCAP, amber progress bar to graduation,
// BUY / SELL. Graduated curves show the pool instead of trades. Every
// figure is a live chain read or "—" while reading — never a literal.
// The site signs nothing in-browser: BUY / SELL / LAUNCH write the exact
// call the operator's agent runs, copy-order style (same as the Swap desk).

// ---------- BNB/USD (live) ----------
// Same GeckoTerminal pool endpoint the site's PriceStrip already fetches
// (App.jsx): quote_token_price_usd is WBNB in USD. If the fetch fails,
// the USD figures are omitted — never a stale price.

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
        /* omit the USD figures */
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

/** USD price with magnitude-appropriate decimals ($0.00000012, $3,720). */
function fmtUsd(p) {
  if (p === null || p === undefined || !Number.isFinite(p) || p <= 0) return '—';
  if (p >= 1000) return `$${Math.round(p).toLocaleString('en-US')}`;
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.0001) return `$${p.toFixed(6)}`;
  if (p >= 1e-8) return `$${p.toFixed(10).replace(/0+$/, '').replace(/\.$/, '')}`;
  return `$${p.toExponential(2)}`;
}

/** Market cap in USD: whole dollars once it reaches $1. */
function fmtMcap(m) {
  if (m === null || m === undefined || !Number.isFinite(m) || m <= 0) return '—';
  if (m >= 1) return `$${Math.round(m).toLocaleString('en-US')}`;
  return fmtUsd(m);
}

const PALETTE = ['#f5b301', '#5aa2e8', '#3fb96f', '#e86a5a', '#b48ce8', '#5ae8c9', '#e8c95a', '#e85a9e'];
function tileColor(seed) {
  let h = 0;
  const s = seed || '';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function initialsOf(c) {
  const sym = (c.symbol || '').replace(/[^A-Za-z0-9]/g, '');
  if (sym) return sym.slice(0, 2).toUpperCase();
  const words = (c.name || '').split(/\s+/).filter(Boolean);
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

/** The card icon IS the logo planted in the token contract at birth;
 *  an unreadable image falls back to the monogram tile. */
function MoonshotIcon({ c }) {
  const [err, setErr] = useState(false);
  const url = iconUrl(c.logoURI);
  if (url && !err)
    return <img className="moonshot-logo" src={url} alt="" onError={() => setErr(true)} />;
  return (
    <div className="moonshot-logo" style={{ background: tileColor(c.symbol || c.name || c.token) }} aria-hidden="true">
      {initialsOf(c)}
    </div>
  );
}

function wordAt(hexStr, i) {
  return hexStr.slice(2 + i * 64, 2 + (i + 1) * 64);
}

/** Decimal string -> wei BigInt, or null. Up to 18 decimals. */
function parseUnitsToWei(s) {
  const t = String(s || '').trim();
  if (!/^\d+(\.\d{1,18})?$/.test(t)) return null;
  const [w, f = ''] = t.split('.');
  return BigInt(w || '0') * 10n ** 18n + BigInt((f + '0'.repeat(18)).slice(0, 18) || '0');
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const GRADUATION_BNB_WEI = 10n ** 18n; // 1 BNB net raised

function curveProgress(c) {
  if (c.realBnb === null || c.realBnb === undefined || c.tokensSold === null || c.tokensSold === undefined
    || c.curveAllocation === null || c.curveAllocation === undefined || c.curveAllocation === 0n) return null;
  const bnbProg = Number(c.realBnb) / Number(GRADUATION_BNB_WEI);
  const soldFrac = Number(c.tokensSold) / Number(c.curveAllocation);
  const soldProg = soldFrac / 0.8;
  return {
    pct: Math.min(100, Math.round(Math.max(bnbProg, soldProg) * 100)),
    soldPct: Math.round(soldFrac * 100),
  };
}

function priceUsd(c, bnbUsd) {
  if (c.spotPrice === null || c.spotPrice === undefined || !bnbUsd) return null;
  return (Number(c.spotPrice) / 1e18) * bnbUsd;
}

function mcapUsd(c, bnbUsd) {
  const p = priceUsd(c, bnbUsd);
  if (p === null || c.supply === null || c.supply === undefined) return null;
  return p * (Number(c.supply) / 1e18);
}

/* ================= the order texts (copy-order pattern) ================= */

function buyOrder(c, amountStr, amountWei, quote) {
  const sym = c.symbol || '—';
  const out = quote && quote.out !== null ? fmtToken(quote.out) : '<TOKENS FROM A FRESH QUOTE>';
  const fee = quote && quote.fee !== null ? fmtToken(quote.fee) : '<FEE FROM A FRESH QUOTE>';
  const minOut = quote && quote.out !== null ? fmtWeiExact((quote.out * 99n) / 100n) : '<MINIMUM FROM A FRESH QUOTE>';
  return `MOONSHOT BUY ORDER — AGENT MOONSHOT BOARD
Buy $${sym} on the bonding curve on BNB Chain (BSC, chain id 56).
Curve: ${c.curve}
Token: ${c.name || '—'} ($${sym}) — ${c.token}
Amount in: ${amountStr} BNB (payable with the buy call)
Live quote at copy time: ≈ ${out} $${sym} for ${amountStr} BNB (fee ${fee} BNB, 1%). INDICATIVE ONLY — the live quote governs.

Rules:
1. Quote first: call quoteBuy(${amountWei !== null ? amountWei.toString() : '<AMOUNT IN WEI>'}) on the curve and show me the preview: tokens out, fee, minimum received (= 99% of the fresh quote — my max slippage is 1%), and the 5% per-wallet net-position cap check.
2. Execute only after I approve the preview: call buy(${minOut}) on the curve with ${amountStr} BNB value. Buy is Agent ID gated — the wallet must hold a Binance Agent ID.
3. If the curve is graduated, STOP and report — buys are closed; trade the pool instead.
4. After execution, verify on-chain and report: transaction hash, BNB in, tokens actually received, and the effective price.
Never trade more than the amount in this order. If any step fails or the quote moves below the minimum, stop and report the exact error.`;
}

function sellOrder(c, amountStr, amountWei, quote) {
  const sym = c.symbol || '—';
  const out = quote && quote.out !== null ? fmtToken(quote.out) : '<BNB FROM A FRESH QUOTE>';
  const fee = quote && quote.fee !== null ? fmtToken(quote.fee) : '<FEE FROM A FRESH QUOTE>';
  const minOut = quote && quote.out !== null ? fmtWeiExact((quote.out * 99n) / 100n) : '<MINIMUM FROM A FRESH QUOTE>';
  return `MOONSHOT SELL ORDER — AGENT MOONSHOT BOARD
Sell $${sym} back to the bonding curve on BNB Chain (BSC, chain id 56).
Curve: ${c.curve}
Token: ${c.name || '—'} ($${sym}) — ${c.token}
Amount in: ${amountStr} $${sym}
Live quote at copy time: ≈ ${out} BNB for ${amountStr} $${sym} (fee ${fee} BNB, 1%). INDICATIVE ONLY — the live quote governs.

Rules:
1. Quote first: call quoteSell(${amountWei !== null ? amountWei.toString() : '<AMOUNT IN WEI>'}) on the curve and show me the preview: BNB out, fee, minimum received (= 99% of the fresh quote — my max slippage is 1%).
2. Approve the curve for exactly ${amountStr} $${sym} on the token contract first, only if the allowance is short — never an unlimited approval.
3. Execute only after I approve the preview: call sell(${amountWei !== null ? amountWei.toString() : '<AMOUNT IN WEI>'}, ${minOut}) on the curve.
4. If the curve is graduated, STOP and report — sells are closed; trade the pool instead.
5. After execution, verify on-chain and report: transaction hash, tokens in, BNB actually received, and the effective price.
Never trade more than the amount in this order. If any step fails or the quote moves below the minimum, stop and report the exact error.`;
}

function graduateOrder(c) {
  const sym = c.symbol || '—';
  return `MOONSHOT GRADUATE ORDER — AGENT MOONSHOT BOARD
Graduate $${sym}: the curve is ready (80% sold or 1 BNB raised).
Curve: ${c.curve}
Token: ${c.name || '—'} ($${sym}) — ${c.token}
Call graduate() on the curve. Graduation is permissionless — the caller pays gas (about 3,555,111 gas; use a gas limit of at least 4,000,000).
After execution, verify on-chain and report: transaction hash and the pair address. The LP mints directly to the dead address.`;
}

function launchOrder(f) {
  const name = f.name.trim() || '<NAME>';
  const sym = f.symbol.trim() || '<SYMBOL>';
  const n = /^\d+$/.test(f.supply.trim()) ? BigInt(f.supply.trim()) : null;
  const supplyWei = n !== null ? (n * 10n ** 18n).toString() : '<SUPPLY IN WEI>';
  const supplyLine = n !== null ? `${fmtInt(Number(n))} whole tokens (${supplyWei} wei, 18 decimals)` : '<SUPPLY>';
  const logo = f.logoURI.trim();
  return `MOONSHOT LAUNCH ORDER — AGENT MOONSHOT BOARD
Launch a token on the Moonshot bonding curve on BNB Chain (BSC, chain id 56).
Factory: ${A.moonshot}
Name: ${name}
Symbol: ${sym}
Supply: ${supplyLine}
Logo URI: ${logo || '(none)'}
Call launch("${name}", "${sym}", ${supplyWei}, "${logo}") on the factory. Launch is Agent ID gated — the wallet must hold a Binance Agent ID. The launcher pays gas (about 617,352).
Validate first: supply 1,000,000,000–100,000,000,000 whole tokens; logo URI empty or ipfs:// (max 256 bytes).
After execution, verify on-chain and report: transaction hash, the token address, and the curve address.`;
}

/* ================= the trade panel ================= */

function TradePanel({ c, side, setSide, onClose }) {
  const [amount, setAmount] = useState(side === 'buy' ? '0.01' : '');
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const amountWei = parseUnitsToWei(amount);
  const isBuy = side === 'buy';

  useEffect(() => {
    setAmount(isBuy ? '0.01' : '');
    setQuote(null);
  }, [c.curve, isBuy]);

  useEffect(() => {
    if (!amountWei || amountWei === 0n) {
      setQuote(null);
      return undefined;
    }
    let dead = false;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const data = isBuy
          ? SEL.msQuoteBuy + padArg(amountWei)
          : SEL.msQuoteSell + padArg(amountWei);
        const r = await rpcBatch([callReq(c.curve, data)]);
        if (dead) return;
        const hx = r[0];
        if (typeof hx !== 'string' || hx.length < 2 + 64) {
          setQuote(null);
          return;
        }
        if (isBuy) {
          setQuote({
            out: toBig(`0x${wordAt(hx, 0)}`),
            grossUsed: toBig(`0x${wordAt(hx, 1)}`),
            netUsed: toBig(`0x${wordAt(hx, 2)}`),
            fee: toBig(`0x${wordAt(hx, 3)}`),
          });
        } else {
          setQuote({ out: toBig(`0x${wordAt(hx, 0)}`), fee: toBig(`0x${wordAt(hx, 1)}`) });
        }
      } catch {
        if (!dead) setQuote(null);
      } finally {
        if (!dead) setQuoting(false);
      }
    }, 400);
    return () => {
      dead = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.curve, isBuy, amount]);

  const sym = c.symbol || '—';
  const quoteLine = !amountWei
    ? 'ENTER AN AMOUNT — THE LIVE QUOTE APPEARS HERE.'
    : quoting
      ? 'READING THE CURVE…'
      : quote === null
        ? 'QUOTE UNAVAILABLE — THE ORDER BELOW STILL CARRIES THE CALL; YOUR AGENT QUOTES FIRST.'
        : isBuy
          ? `QUOTE — ≈ ${fmtToken(quote.out)} $${sym} FOR ${amount} BNB · FEE ${fmtToken(quote.fee)} BNB`
          : `QUOTE — ≈ ${fmtToken(quote.out)} BNB FOR ${amount} $${sym} · FEE ${fmtToken(quote.fee)} BNB`;
  const order = isBuy ? buyOrder(c, amount || '<AMOUNT>', amountWei, quote) : sellOrder(c, amount || '<AMOUNT>', amountWei, quote);

  return (
    <div className="panel moonshot-panel" id="moonshot-trade">
      <div className="moonshot-panelhead">
        <span className="moonshot-paneltitle">
          TRADE — {c.name || '—'} <span className="amber">${sym}</span>
        </span>
        <button type="button" className="moonshot-x" aria-label="Close trade panel" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="moonshot-toggle" role="group" aria-label="Trade side">
        <button type="button" className={isBuy ? 'on' : ''} onClick={() => setSide('buy')}>
          BUY
        </button>
        <button type="button" className={!isBuy ? 'on' : ''} onClick={() => setSide('sell')}>
          SELL
        </button>
      </div>
      <div className="moonshot-field">
        <label htmlFor="ms-amount">{isBuy ? 'AMOUNT IN BNB' : `AMOUNT IN $${sym}`}</label>
        <input
          id="ms-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={isBuy ? '0.01' : '1000000'}
        />
      </div>
      <div className="moonshot-quote">{quoteLine}</div>
      <CopyBlock
        title={`GIVE THIS TO YOUR AGENT — ${isBuy ? 'BUY' : 'SELL'} $${sym} ON THE CURVE`}
        text={order}
      />
      {c.canGraduate && !c.graduated ? (
        <CopyBlock title={`GIVE THIS TO YOUR AGENT — GRADUATE $${sym}`} text={graduateOrder(c)} />
      ) : null}
    </div>
  );
}

/* ================= the launch panel ================= */

function LaunchPanel({ onClose }) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [supply, setSupply] = useState('1000000000');
  const [logoURI, setLogoURI] = useState('');
  const n = /^\d+$/.test(supply.trim()) ? BigInt(supply.trim()) : null;
  const supplyOk = n !== null && n >= 1000000000n && n <= 100000000000n;
  const logo = logoURI.trim();
  const logoOk = logo === '' || (logo.startsWith('ipfs://') && logo.length <= 256);
  const errs = [];
  if (!name.trim()) errs.push('NAME REQUIRED');
  if (!symbol.trim()) errs.push('SYMBOL REQUIRED');
  if (!supplyOk) errs.push('SUPPLY MUST BE 1,000,000,000–100,000,000,000 WHOLE TOKENS');
  if (!logoOk) errs.push('LOGO URI MUST BE EMPTY OR ipfs:// (MAX 256 BYTES)');

  return (
    <div className="panel moonshot-panel" id="moonshot-launch">
      <div className="moonshot-panelhead">
        <span className="moonshot-paneltitle">LAUNCH A TOKEN</span>
        <button type="button" className="moonshot-x" aria-label="Close launch panel" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="moonshot-field">
        <label htmlFor="ms-name">NAME</label>
        <input id="ms-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Token" />
      </div>
      <div className="moonshot-field">
        <label htmlFor="ms-symbol">SYMBOL</label>
        <input id="ms-symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="MTK" />
      </div>
      <div className="moonshot-field">
        <label htmlFor="ms-supply">SUPPLY — WHOLE TOKENS (1B–100B)</label>
        <input id="ms-supply" inputMode="numeric" value={supply} onChange={(e) => setSupply(e.target.value)} placeholder="1000000000" />
      </div>
      <div className="moonshot-field">
        <label htmlFor="ms-logo">LOGO URI — OPTIONAL, ipfs://</label>
        <input id="ms-logo" value={logoURI} onChange={(e) => setLogoURI(e.target.value)} placeholder="ipfs://..." />
      </div>
      {errs.length ? <p className="moonshot-err">{errs.join(' · ')}</p> : null}
      <div style={{ marginTop: 12 }}>
        <CopyBlock
          title="GIVE THIS TO YOUR AGENT — LAUNCH ON MOONSHOT"
          text={launchOrder({ name, symbol, supply, logoURI })}
        />
      </div>
    </div>
  );
}

/* ================= the card (approved v1 layout) ================= */

function MoonshotCard({ c, bnbUsd, onTrade }) {
  const grad = c.graduated === true;
  const prog = grad ? { pct: 100, soldPct: null } : curveProgress(c);
  const soldPct = grad
    ? (c.tokensSold !== null && c.tokensSold !== undefined && c.curveAllocation ? Math.round((Number(c.tokensSold) / Number(c.curveAllocation)) * 100) : null)
    : (prog ? prog.soldPct : null);
  const price = priceUsd(c, bnbUsd);
  const mcap = grad ? null : mcapUsd(c, bnbUsd);
  const pair = c.pair && c.pair !== ZERO_ADDR ? c.pair : null;
  const poolHref = pair ? `https://bscscan.com/address/${pair}` : `https://bscscan.com/address/${c.curve}`;
  return (
    <div className={`moonshot-card${grad ? ' grad' : ''}`}>
      <div className="moonshot-head">
        <MoonshotIcon c={c} />
        <div>
          <div className="moonshot-nm">{c.name || '—'}</div>
          <div className="moonshot-tk">${c.symbol || '—'}</div>
        </div>
        {grad ? (
          <span className="moonshot-chip grad">GRADUATED ✓</span>
        ) : (
          <span className="moonshot-chip live">● LIVE</span>
        )}
      </div>
      <div className="moonshot-stats">
        <span>
          <span className="k">PRICE</span>
          <span className="v">{fmtUsd(price)}</span>
        </span>
        {grad ? (
          <span>
            <span className="k">POOL</span>
            <span className="v">LIVE · LP BURNED</span>
          </span>
        ) : (
          <span>
            <span className="k">MCAP</span>
            <span className="v">{fmtMcap(mcap)}</span>
          </span>
        )}
      </div>
      <div className="moonshot-bar">
        <i style={{ width: `${prog ? prog.pct : 0}%` }} />
      </div>
      <div className="moonshot-prog">
        {grad ? (
          <span>
            <b>100%</b> GRADUATED
          </span>
        ) : (
          <span>
            <b>{prog ? `${prog.pct}%` : '—'}</b> TO GRADUATION
          </span>
        )}
        {grad ? (
          <span>{soldPct !== null ? `${soldPct}% SOLD` : '—'} · LP BURNED</span>
        ) : (
          <span>
            {c.realBnb !== null && c.realBnb !== undefined ? `${fmtToken(c.realBnb)} BNB RAISED` : '—'} ·{' '}
            {soldPct !== null ? `${soldPct}% SOLD` : '—'}
          </span>
        )}
      </div>
      <div className="moonshot-acts">
        {grad ? (
          <a className="moonshot-pool" href={poolHref} target="_blank" rel="noopener noreferrer">
            VIEW POOL →
          </a>
        ) : (
          <>
            <button type="button" className="moonshot-buy" onClick={() => onTrade(c, 'buy')}>
              BUY
            </button>
            <button type="button" className="moonshot-sell" onClick={() => onTrade(c, 'sell')}>
              SELL
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ================= the page ================= */

export default function Moonshot() {
  const ms = useStore(moonshotStore);
  const bnbUsd = useBnbUsd();
  const [launchOpen, setLaunchOpen] = useState(false);
  const [trade, setTrade] = useState(null); // { curve, side }
  const tradeRef = useRef(null);
  const launchRef = useRef(null);
  const data = ms.data;
  const curves = data ? data.curves : null;
  const total = data ? data.total : null;
  const liveCount = curves ? curves.filter((c) => !c.graduated).length : null;
  const gradCount = curves ? curves.filter((c) => c.graduated).length : null;
  const tradeCurve = trade ? (curves || []).find((c) => c.curve === trade.curve) || null : null;

  const onTrade = (c, side) => {
    setTrade({ curve: c.curve, side });
    setLaunchOpen(false);
  };
  useEffect(() => {
    if (trade && tradeRef.current) tradeRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [trade]);
  useEffect(() => {
    if (launchOpen && launchRef.current) launchRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [launchOpen]);

  return (
    <section className="sec first moonshot-sec">
      <div className="kicker amber">MOONSHOT · BONDING CURVE LANE</div>
      <h1 className="moonshot-h1">
        MOONSHOT <span className="amber">BOARD</span>
      </h1>
      <p className="moonshot-lede">Launch on a curve. Graduate to a burned pool.</p>
      <div className="moonshot-topbar">
        <span className="moonshot-count">
          {liveCount === null || gradCount === null
            ? '—'
            : `${liveCount} LIVE CURVES · ${gradCount} GRADUATED`}
        </span>
        <button
          type="button"
          className="moonshot-launch"
          onClick={() => {
            setLaunchOpen((o) => !o);
            setTrade(null);
          }}
        >
          LAUNCH A TOKEN →
        </button>
      </div>

      {launchOpen ? (
        <div ref={launchRef}>
          <LaunchPanel onClose={() => setLaunchOpen(false)} />
        </div>
      ) : null}

      {trade && tradeCurve ? (
        <div ref={tradeRef}>
          <TradePanel
            c={tradeCurve}
            side={trade.side}
            setSide={(side) => setTrade({ curve: trade.curve, side })}
            onClose={() => setTrade(null)}
          />
        </div>
      ) : null}

      <div className="moonshot-grid">
        {!curves ? (
          <div className="moonshot-openline">READING THE FACTORY…</div>
        ) : curves.length === 0 ? (
          <div className="moonshot-openline">THE FIRST LAUNCH OPENS THE BOARD.</div>
        ) : (
          curves.map((c) => <MoonshotCard key={c.curve} c={c} bnbUsd={bnbUsd} onTrade={onTrade} />)
        )}
      </div>

      <h3 className="panelh">CONTRACTS</h3>
      <div className="panel">
        <div className="statusrows">
          <div className="buyline">
            <span>MOONSHOT FACTORY</span>
            <Addr address={A.moonshot} />
          </div>
          <div className="buyline">
            <span>TOKEN IMPLEMENTATION</span>
            <Addr address={A.moonshotTokenImpl} />
          </div>
          <div className="buyline">
            <span>CURVE IMPLEMENTATION</span>
            <Addr address={A.moonshotCurveImpl} />
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
