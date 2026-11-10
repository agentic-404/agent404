import React, { useEffect, useRef, useState } from 'react';
import { SectionHead, CopyBlock } from '../components.jsx';
import { swapPrompt, swapSellPrompt, swapGenericPrompt } from '../prompts.js';
import { rpcBatch, callReq } from '../rpc.js';
import { A, SEL } from '../config.js';
import { decodeStr } from '../data.js';
import logoUrl from '../assets/a404-glitch-404.png';
import bnbUrl from '../assets/bnb-logo.png';
import usdtUrl from '../assets/usdt-logo.png';
import cakeUrl from '../assets/cake-logo.png';
import btcbUrl from '../assets/btcb-logo.png';
import ethUrl from '../assets/eth-logo.png';
import shibUrl from '../assets/shib-logo.png';
import pepeUrl from '../assets/pepe-logo.png';
import solUrl from '../assets/sol-logo.png';
import xrpUrl from '../assets/xrp-logo.png';

const TOKENS = {
  A404: { addr: '0xB7E2f2D6ED4928F6fA774Ff9295D01f25aA17725', logo: logoUrl, name: 'AGENT404', dec: 18 },
  WBNB: { addr: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', logo: bnbUrl, name: 'BNB', sub: 'WBNB', dec: 18 },
  USDT: { addr: '0x55d398326f99059fF775485246999027B3197955', logo: usdtUrl, name: 'Tether USD', dec: 18 },
  CAKE: { addr: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', logo: cakeUrl, name: 'PancakeSwap Token', dec: 18 },
  ETH: { addr: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', logo: ethUrl, name: 'Ethereum Token', dec: 18 },
  BTCB: { addr: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', logo: btcbUrl, name: 'Binance Bitcoin', dec: 18 },
  SHIB: { addr: '0x2859e4544C4bB03966803b044A93563Bd2D0DD4D', logo: shibUrl, name: 'Shiba Inu', dec: 18 },
  PEPE: { addr: '0x25d887Ce7a35172C62FeBFD67a1856F20FaEbB00', logo: pepeUrl, name: 'Pepe', dec: 18 },
  SOL: { addr: '0x570A5D26f7765Ecb712C0924E4De545B89fD43dF', logo: solUrl, name: 'Solana', dec: 18 },
  XRP: { addr: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', logo: xrpUrl, name: 'XRP Token', dec: 18 },
};
const VERIFIED_KEYS = Object.keys(TOKENS);
const WBNB_ADDR = TOKENS.WBNB.addr;
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const IMPORT_KEY = 'a404swap:imported:v1';

// Verified PancakeSwap markets. base/quote name the GeckoTerminal pool orientation
// (which token's USD price sits in base_token_price_usd / quote_token_price_usd).
// tokens = display order; path = the PancakeSwap V2 execution route.
const MARKETS = [
  { label: 'A404 / WBNB', venue: 'PANCAKESWAP V2', addr: '0x6116d6B62b35aAa9aCbC118eD7c51861c085de09', base: 'A404', quote: 'WBNB', side: 'base', tokens: ['A404', 'WBNB'], path: ['A404', 'WBNB'], home: true, def: '0.0045' },
  { label: 'WBNB / USDT', venue: 'PANCAKESWAP V2', addr: '0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE', base: 'USDT', quote: 'WBNB', side: 'quote', tokens: ['WBNB', 'USDT'], path: ['WBNB', 'USDT'], def: '0.1' },
  { label: 'CAKE / WBNB', venue: 'PANCAKESWAP V2', addr: '0x0eD7e52944161450477ee417DE9Cd3a859b14fD0', base: 'CAKE', quote: 'WBNB', side: 'base', tokens: ['CAKE', 'WBNB'], path: ['CAKE', 'WBNB'], def: '10' },
  { label: 'CAKE / USDT', venue: 'PANCAKESWAP V3', addr: '0x7f51c8aaa6b0599abd16674e2b17fec7a9f674a1', base: 'CAKE', quote: 'USDT', side: 'base', tokens: ['CAKE', 'USDT'], path: ['CAKE', 'WBNB', 'USDT'], def: '10' },
  { label: 'ETH / WBNB', venue: 'PANCAKESWAP V2', addr: '0x74e4716e431f45807dcf19f284c7aa99f18a4fbc', base: 'ETH', quote: 'WBNB', side: 'base', tokens: ['ETH', 'WBNB'], path: ['ETH', 'WBNB'], def: '0.05' },
  { label: 'BTCB / WBNB', venue: 'PANCAKESWAP V2', addr: '0x61eb789d75a95caa3ff50ed7e47b96c132fec082', base: 'BTCB', quote: 'WBNB', side: 'base', tokens: ['BTCB', 'WBNB'], path: ['BTCB', 'WBNB'], def: '0.001' },
];

const GT = (addr) => `https://api.geckoterminal.com/api/v2/networks/bsc/pools/${addr}`;

function fmtPx(x) {
  if (!x || !Number.isFinite(x)) return '—';
  if (x >= 100) return '$' + x.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return '$' + String(Number(x.toPrecision(3)));
}

function fmtVol(x) {
  if (!x || !Number.isFinite(x)) return '—';
  if (x >= 1e6) return '$' + (x / 1e6).toFixed(2) + 'M';
  if (x >= 1e3) return '$' + (x / 1e3).toFixed(1) + 'K';
  return '$' + x.toFixed(2);
}

function fmtAmt(x) {
  if (!x || !Number.isFinite(x) || x <= 0) return '0';
  if (x >= 1000) return x.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (x >= 1) return String(Number(x.toPrecision(5)));
  return String(Number(x.toPrecision(4)));
}

function fmtBnb(x) {
  if (!x) return '0';
  return String(Number(x.toPrecision(6)));
}

function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
}

function padAddr(a) {
  return a.toLowerCase().replace('0x', '').padStart(64, '0');
}

// Decimal string amount -> base units (BigInt), exact string math.
function toUnits(amountStr, dec) {
  const s = String(amountStr || '').trim();
  if (!/^\d*(\.\d*)?$/.test(s) || s === '' || s === '.') return null;
  const [ip, fp = ''] = s.split('.');
  if (fp.length > dec) return null;
  const digits = (ip || '0') + fp.padEnd(dec, '0');
  try {
    return BigInt(digits);
  } catch {
    return null;
  }
}

function fromUnits(units, dec) {
  const neg = units < 0n;
  const s = (neg ? -units : units).toString().padStart(dec + 1, '0');
  const ip = s.slice(0, s.length - dec) || '0';
  const fp = dec > 0 ? s.slice(s.length - dec).replace(/0+$/, '') : '';
  return Number((neg ? '-' : '') + ip + (fp ? '.' + fp : ''));
}

function readImported() {
  try {
    const raw = localStorage.getItem(IMPORT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (t) => t && typeof t.addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(t.addr) && typeof t.symbol === 'string' && Number.isFinite(t.decimals)
    );
  } catch {
    return [];
  }
}

const SETTINGS_KEY = 'a404swap:settings:v1';
const SLIP_PRESETS = ['0.1', '0.5', '1.0'];
const DEADLINE_PRESETS = [10, 20, 30];
function readSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (s && Number.isFinite(parseFloat(s.slip)) && parseFloat(s.slip) > 0 && parseFloat(s.slip) <= 50 && DEADLINE_PRESETS.includes(s.deadline)) {
      return { slip: String(s.slip), deadline: s.deadline };
    }
  } catch {
    /* fall through to defaults */
  }
  return { slip: '0.5', deadline: 20 };
}

function MarketsPanel({ rows, sel, onSelect }) {
  const live = Object.keys(rows).length > 0;
  return (
    <div className="panel mktpanel">
      <div className="mkthead">
        <span>
          <span className={`psdot ${live ? 'on' : ''}`} aria-hidden="true" /> MARKETS — VERIFIED PAIRS
        </span>
        <span className="mktvia">TAP A PAIR TO LOAD IT INTO THE DESK</span>
      </div>
      <div className="mktrow mktcols">
        <span>PAIR</span>
        <span className="r">PRICE</span>
        <span className="r">24H</span>
        <span className="r">VOLUME 24H</span>
      </div>
      {MARKETS.map((m) => {
        const d = rows[m.addr];
        const headline = d ? (m.side === 'quote' ? d.quotePx : d.basePx) : null;
        return (
          <button
            type="button"
            className={`mktrow ${m.home ? 'home' : ''} ${sel && sel.addr === m.addr ? 'sel' : ''}`}
            key={m.addr}
            onClick={() => onSelect(m)}
          >
            <span className="mktpair">
              <span className="mktlogos">
                <img src={TOKENS[m.tokens[0]].logo} alt="" />
                <img src={TOKENS[m.tokens[1]].logo} alt="" />
              </span>
              <span className="mktnames">
                <b>{m.label}</b>
                <i>{m.venue}</i>
              </span>
            </span>
            <span className="r mktpx">{d ? fmtPx(headline) : '—'}</span>
            <span className={`r ${d && d.chg !== null ? (d.chg >= 0 ? 'mup' : 'mdn') : ''}`}>
              {d && d.chg !== null ? `${d.chg >= 0 ? '+' : ''}${d.chg.toFixed(2)}%` : '—'}
            </span>
            <span className="r">{d ? fmtVol(d.vol) : '—'}</span>
          </button>
        );
      })}
      <p className="mktnote">
        Pick a pair to load it into the desk. The home market trades at its reference anchor; the verified majors
        trade at the live pool rate — quote-first, every time.
      </p>
    </div>
  );
}

function TokenCoin({ tok, cls = '' }) {
  if (tok.logo) return <img className={`coinimg ${cls}`} src={tok.logo} alt="" />;
  return <span className={`coinletters ${cls}`} aria-hidden="true">{(tok.sym || '?').slice(0, 4)}</span>;
}

function TokenPicker({ side, imported, onPick, onClose, tokenOf }) {
  const [q, setQ] = useState('');
  const [resolved, setResolved] = useState(null); // {addr,name,symbol,decimals} | 'loading' | 'bad' | null
  const qTrim = q.trim();
  const isAddr = /^0x[0-9a-fA-F]{40}$/.test(qTrim);
  const knownAddr = isAddr
    ? VERIFIED_KEYS.some((k) => TOKENS[k].addr.toLowerCase() === qTrim.toLowerCase()) ||
      imported.some((t) => t.addr.toLowerCase() === qTrim.toLowerCase())
    : false;

  useEffect(() => {
    if (!isAddr || knownAddr) {
      setResolved(null);
      return undefined;
    }
    let dead = false;
    setResolved('loading');
    const t = setTimeout(async () => {
      try {
        const [n, s, d] = await rpcBatch([
          callReq(qTrim, SEL.name),
          callReq(qTrim, SEL.symbol),
          callReq(qTrim, SEL.decimals),
        ]);
        if (dead) return;
        const name = n ? decodeStr(n) : '';
        const symbol = s ? decodeStr(s) : '';
        const decimals = d ? Number(BigInt(d)) : NaN;
        if (symbol && Number.isFinite(decimals) && decimals >= 0 && decimals <= 36) {
          setResolved({ addr: qTrim, name: name || symbol, symbol, decimals });
        } else {
          setResolved('bad');
        }
      } catch {
        if (!dead) setResolved('bad');
      }
    }, 450);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [qTrim, isAddr, knownAddr]);

  const match = (name, sym) =>
    !qTrim || isAddr || name.toLowerCase().includes(qTrim.toLowerCase()) || sym.toLowerCase().includes(qTrim.toLowerCase());
  const vRows = VERIFIED_KEYS.map((k) => ({ key: k, ...tokenOf(k) })).filter((t) => match(t.name, t.sym));
  const iRows = imported
    .map((t) => ({ key: 'imp:' + t.addr.toLowerCase(), ...tokenOf('imp:' + t.addr.toLowerCase()) }))
    .filter((t) => match(t.name, t.sym));

  return (
    <div className="swpveil" role="dialog" aria-label="Select a token">
      <div className="swppicker">
        <div className="swptitle">
          <span>SELECT A TOKEN — {side === 'from' ? 'FROM' : 'TO'}</span>
          <button type="button" className="swpx" onClick={onClose} aria-label="Close token picker">
            ✕
          </button>
        </div>
        <input
          className="swpsearch"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, or paste a contract address…"
          aria-label="Search token or paste contract address"
        />
        <div className="swpsec">VERIFIED</div>
        {vRows.length === 0 ? <p className="swpempty">No verified token matches.</p> : null}
        {vRows.map((t) => (
          <button type="button" className="swprow" key={t.key} onClick={() => onPick(t.key)}>
            <TokenCoin tok={t} />
            <span className="swpmeta">
              <b>{t.name}</b>
              <i>
                {t.sym} · {shortAddr(t.addr)}
              </i>
            </span>
            <span className="swpvchip ok">✓ VERIFIED</span>
          </button>
        ))}
        <div className="swpsec">IMPORTED</div>
        {iRows.map((t) => (
          <button type="button" className="swprow" key={t.key} onClick={() => onPick(t.key)}>
            <TokenCoin tok={t} />
            <span className="swpmeta">
              <b>{t.name}</b>
              <i>
                {t.sym} · {shortAddr(t.addr)} · read live from its contract
              </i>
            </span>
            <span className="swpvchip imp">IMPORTED</span>
          </button>
        ))}
        {isAddr && !knownAddr && resolved === 'loading' ? <p className="swpempty">Reading that contract from the chain…</p> : null}
        {isAddr && !knownAddr && resolved === 'bad' ? (
          <p className="swpempty">That address did not answer as a BEP-20 token (no name / symbol / decimals).</p>
        ) : null}
        {isAddr && !knownAddr && resolved && resolved !== 'loading' && resolved !== 'bad' ? (
          <button
            type="button"
            className="swprow"
            onClick={() => onPick('imp:' + resolved.addr.toLowerCase(), resolved)}
          >
            <TokenCoin tok={{ sym: resolved.symbol, logo: null }} />
            <span className="swpmeta">
              <b>{resolved.name}</b>
              <i>
                {resolved.symbol} · {shortAddr(resolved.addr)} · read live from its contract
              </i>
            </span>
            <span className="swpvchip imp">IMPORT +</span>
          </button>
        ) : null}
        <p className="swpnote">
          Verified tokens are the project's own list. Any other BEP-20 contract can be imported by address — its
          name, symbol and decimals are read from the chain, and it is labelled IMPORTED, never verified.
        </p>
      </div>
    </div>
  );
}

const CACHE_KEY = 'a404markets:v1';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(rows) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch {
    /* storage unavailable — the in-memory rows still serve the page */
  }
}

export default function Swap() {
  const [sel, setSel] = useState(MARKETS[0]);
  const [dir, setDir] = useState('buy'); // home-market direction
  const [gflip, setGflip] = useState(false); // generic-market direction
  const [amount, setAmount] = useState('0.0045');
  const [copied, setCopied] = useState(false);
  const [imported, setImported] = useState(readImported);
  const [picker, setPicker] = useState(null); // null | 'from' | 'to'
  const [settings, setSettings] = useState(readSettings); // { slip: string %, deadline: minutes }
  const [showSettings, setShowSettings] = useState(false);
  const [slipCustom, setSlipCustom] = useState('');
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable — settings still apply for this visit */
    }
  }, [settings]);
  const [custom, setCustom] = useState(null); // null | { fromKey, toKey }
  const [cust, setCust] = useState({ state: 'idle', out: null, rate: null, pairAddr: null, viaWbnb: false, pathAddrs: null });
  const custSeq = useRef(0);
  // Smart cache: last-good pool data hydrates instantly from localStorage,
  // then a staggered, backoff-aware refresher keeps it warm. A failed or
  // rate-limited fetch never erases a known value.
  const [rows, setRows] = useState(readCache);
  useEffect(() => {
    let dead = false;
    let timer = null;
    let running = false;
    let delay = 60000;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const fetchPool = async (m, isRetry) => {
      try {
        const r = await fetch(GT(m.addr));
        if (r.status === 429) return 'limited';
        if (!r.ok) throw new Error('bad status');
        const j = await r.json();
        const a = j?.data?.attributes;
        if (!a) throw new Error('no data');
        const basePx = Number(a.base_token_price_usd);
        const quotePx = Number(a.quote_token_price_usd);
        const chg = Number(a.price_change_percentage?.h24);
        const vol = Number(a.volume_usd?.h24);
        return {
          basePx: Number.isFinite(basePx) && basePx > 0 ? basePx : null,
          quotePx: Number.isFinite(quotePx) && quotePx > 0 ? quotePx : null,
          chg: Number.isFinite(chg) ? chg : null,
          vol: Number.isFinite(vol) ? vol : null,
        };
      } catch {
        return null;
      }
    };
    const cycle = async () => {
      if (dead || running) return;
      running = true;
      let limited = false;
      // Staggered: one pool at a time with a small gap, never a 6-wide burst.
      for (const m of MARKETS) {
        if (dead) return;
        let res = await fetchPool(m);
        if (res === 'limited') {
          limited = true;
        } else if (res) {
          setRows((prev) => {
            const next = { ...prev, [m.addr]: res };
            writeCache(next);
            return next;
          });
        } else {
          // One gentle retry for a pool we know nothing about yet.
          const known = readCache()[m.addr];
          if (!known) {
            await sleep(4000);
            if (dead) return;
            res = await fetchPool(m, true);
            if (res && res !== 'limited') {
              setRows((prev) => {
                const next = { ...prev, [m.addr]: res };
                writeCache(next);
                return next;
              });
            } else if (res === 'limited') limited = true;
          }
        }
        await sleep(350);
      }
      // Rate-limit backoff: double the wait (cap 5 min), reset on a clean cycle.
      delay = limited ? Math.min(delay * 2, 300000) : 60000;
      running = false;
      if (!dead) timer = setTimeout(cycle, delay);
    };
    cycle();
    const onVis = () => {
      if (document.visibilityState === 'visible' && !dead) {
        if (timer) clearTimeout(timer);
        cycle();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      dead = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const tokenOf = (key) => {
    if (!key) return null;
    if (key.startsWith('imp:')) {
      const addr = key.slice(4);
      const t = imported.find((x) => x.addr.toLowerCase() === addr);
      if (!t) return null;
      return { sym: t.symbol, name: t.name || t.symbol, addr: t.addr, dec: t.decimals, logo: null, verified: false };
    }
    const b = TOKENS[key];
    return b ? { sym: key === 'WBNB' ? 'WBNB' : key, dispSym: key === 'WBNB' ? 'BNB' : key, name: b.name, sub: b.sub || null, addr: b.addr, dec: b.dec, logo: b.logo, verified: true } : null;
  };

  const home = !custom && !!sel.home;
  const isCustom = !!custom;
  const d = !isCustom ? rows[sel.addr] : null;
  const pxOf = (sym) => (d ? (sel.base === sym ? d.basePx : sel.quote === sym ? d.quotePx : null) : null);
  const gt = rows[MARKETS[0].addr]
    ? { a404: rows[MARKETS[0].addr].basePx ? String(Number(rows[MARKETS[0].addr].basePx.toPrecision(3))) : null, bnb: rows[MARKETS[0].addr].quotePx }
    : null;

  const select = (m) => {
    setSel(m);
    setCustom(null);
    setGflip(false);
    setDir('buy');
    setAmount(m.def);
    setPicker(null);
  };

  const amt = parseFloat(amount);
  const valid = Number.isFinite(amt) && amt > 0;

  // ---- current desk token keys (for picker + custom flows) ----
  const curFromKey = isCustom ? custom.fromKey : home ? (dir === 'buy' ? 'WBNB' : 'A404') : gflip ? sel.tokens[1] : sel.tokens[0];
  const curToKey = isCustom ? custom.toKey : home ? (dir === 'buy' ? 'A404' : 'WBNB') : gflip ? sel.tokens[0] : sel.tokens[1];

  const applyPair = (fromKey, toKey) => {
    if (fromKey === toKey) return;
    // Exact built-in market? Load it, oriented to the picked direction.
    for (const m of MARKETS) {
      const [t0, t1] = m.tokens;
      if ((t0 === fromKey && t1 === toKey) || (t1 === fromKey && t0 === toKey)) {
        setSel(m);
        setCustom(null);
        if (m.home) {
          setDir(fromKey === 'WBNB' ? 'buy' : 'sell');
        } else {
          setGflip(t0 !== fromKey);
        }
        return;
      }
    }
    setCustom({ fromKey, toKey });
  };

  const pickToken = (key, resolvedMeta) => {
    if (resolvedMeta) {
      setImported((prev) => {
        const next = prev.some((t) => t.addr.toLowerCase() === resolvedMeta.addr.toLowerCase())
          ? prev
          : [...prev, { addr: resolvedMeta.addr, name: resolvedMeta.name, symbol: resolvedMeta.symbol, decimals: resolvedMeta.decimals }];
        try {
          localStorage.setItem(IMPORT_KEY, JSON.stringify(next));
        } catch {
          /* storage unavailable */
        }
        return next;
      });
    }
    const side = picker;
    setPicker(null);
    if (!side) return;
    if (side === 'from') {
      if (key === curToKey) applyPair(curToKey, curFromKey); // picked the other side's token -> flip
      else applyPair(key, curToKey);
    } else {
      if (key === curFromKey) applyPair(curToKey, curFromKey);
      else applyPair(curFromKey, key);
    }
  };

  // ---- custom pair resolution + live quote (router getAmountsOut) ----
  useEffect(() => {
    if (!isCustom) return undefined;
    const from = tokenOf(custom.fromKey);
    const to = tokenOf(custom.toKey);
    if (!from || !to) return undefined;
    let dead = false;
    const seq = ++custSeq.current;
    setCust((c) => ({ ...c, state: 'loading' }));
    const t = setTimeout(async () => {
      const alive = () => !dead && custSeq.current === seq;
      try {
        const [direct, legIn, legOut] = await rpcBatch([
          callReq(A.factory, SEL.getPair + padAddr(from.addr) + padAddr(to.addr)),
          callReq(A.factory, SEL.getPair + padAddr(from.addr) + padAddr(WBNB_ADDR)),
          callReq(A.factory, SEL.getPair + padAddr(WBNB_ADDR) + padAddr(to.addr)),
        ]);
        if (!alive()) return;
        const addrOf = (hex) => (hex && hex.length >= 42 ? '0x' + hex.slice(-40) : null);
        const directPair = addrOf(direct);
        let path = null;
        let pairAddr = null;
        let viaWbnb = false;
        if (directPair && directPair.toLowerCase() !== ZERO_ADDR) {
          path = [from.addr, to.addr];
          pairAddr = directPair;
        } else {
          const pIn = addrOf(legIn);
          const pOut = addrOf(legOut);
          if (
            from.addr.toLowerCase() !== WBNB_ADDR.toLowerCase() &&
            to.addr.toLowerCase() !== WBNB_ADDR.toLowerCase() &&
            pIn && pIn.toLowerCase() !== ZERO_ADDR && pOut && pOut.toLowerCase() !== ZERO_ADDR
          ) {
            path = [from.addr, WBNB_ADDR, to.addr];
            pairAddr = pIn;
            viaWbnb = true;
          }
        }
        if (!path) {
          setCust({ state: 'nopool', out: null, rate: null, pairAddr: null, viaWbnb: false, pathAddrs: null });
          return;
        }
        const units = valid ? toUnits(amount, from.dec) : null;
        let out = null;
        if (units && units > 0n) {
          const data =
            SEL.getAmountsOut +
            units.toString(16).padStart(64, '0') +
            (64).toString(16).padStart(64, '0') +
            path.length.toString(16).padStart(64, '0') +
            path.map(padAddr).join('');
          const res = await rpcBatch([callReq(A.router, data)]);
          if (!alive()) return;
          const hex = res && res[0];
          if (hex && hex.length >= 2 + 64 * (2 + path.length)) {
            // Result encoding: offset word, length word, then one word per path hop.
            const words = hex.slice(2);
            const elem = words.slice(64 * (2 + path.length - 1), 64 * (2 + path.length));
            out = fromUnits(BigInt('0x' + elem), to.dec);
          }
        }
        setCust({
          state: 'ok',
          out,
          rate: out !== null && valid && amt > 0 ? out / amt : null,
          pairAddr,
          viaWbnb,
          pathAddrs: path,
        });
      } catch {
        if (alive()) setCust({ state: 'nopool', out: null, rate: null, pairAddr: null, viaWbnb: false, pathAddrs: null });
      }
    }, 500);
    return () => {
      dead = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustom, custom, amount, imported]);

  // ---- home market (A404/WBNB, anchor math — unchanged) ----
  const buy = dir === 'buy';
  const hEst = valid ? (buy ? (amt / 0.0045) * 909 : (amt * 0.0045) / 909) : 0;
  const hEstStr = hEst ? (buy ? hEst.toLocaleString('en-US', { maximumFractionDigits: 2 }) : fmtBnb(hEst)) : '0';
  const slipFactor = 1 - parseFloat(settings.slip) / 100;
  const hMinOut = hEst
    ? buy
      ? Math.floor(hEst * slipFactor).toLocaleString('en-US')
      : fmtBnb(hEst * slipFactor)
    : '<MINIMUM FROM A FRESH QUOTE>';
  const hPrompt = buy
    ? swapPrompt(valid ? amount : '<AMOUNT>', hMinOut, settings.slip, settings.deadline)
    : swapSellPrompt(valid ? amount : '<AMOUNT>', hMinOut, settings.slip, settings.deadline);
  const hUsd = valid
    ? buy
      ? gt?.bnb
        ? `≈ $${(amt * gt.bnb).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
        : ' '
      : gt?.a404
        ? `≈ $${(amt * Number(gt.a404)).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
        : ' '
    : ' ';
  const hFlip = () => {
    if (valid && hEst) setAmount(buy ? String(Math.floor(hEst)) : fmtBnb(hEst));
    setDir(buy ? 'sell' : 'buy');
  };

  // ---- generic verified majors (live USD-ratio estimate, quote-first order) ----
  const gFrom = !isCustom && !home ? (gflip ? sel.tokens[1] : sel.tokens[0]) : null;
  const gTo = !isCustom && !home ? (gflip ? sel.tokens[0] : sel.tokens[1]) : null;
  const pxFrom = gFrom ? pxOf(gFrom) : null;
  const pxTo = gTo ? pxOf(gTo) : null;
  const gEst = valid && pxFrom && pxTo ? amt * (pxFrom / pxTo) : 0;
  const gEstStr = fmtAmt(gEst);
  const gRatio = pxFrom && pxTo ? pxFrom / pxTo : null;
  const gUsd = valid && pxFrom ? `≈ $${(amt * pxFrom).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : ' ';
  const gPrompt =
    gFrom && gTo
      ? swapGenericPrompt({
          amount: valid ? amount : '<AMOUNT>',
          fromSym: gFrom,
          toSym: gTo,
          fromAddr: TOKENS[gFrom].addr,
          toAddr: TOKENS[gTo].addr,
          pairAddr: sel.addr,
          label: sel.label,
          pathLine: sel.path.map((s) => `${s} ${TOKENS[s].addr}`).join(' → '),
          est: gEstStr,
          slip: settings.slip,
          deadline: settings.deadline,
        })
      : '';
  const gFlip = () => {
    if (valid && gEst) setAmount(fmtAmt(gEst));
    setGflip(!gflip);
  };

  // ---- custom pair (picker-built; router-quoted) ----
  const cFrom = isCustom ? tokenOf(custom.fromKey) : null;
  const cTo = isCustom ? tokenOf(custom.toKey) : null;
  const cLabel = cFrom && cTo ? `${cFrom.sym} / ${cTo.sym}` : '';
  const cEstStr = cust.state === 'ok' && cust.out !== null ? fmtAmt(cust.out) : '—';
  const cUsd =
    valid && cFrom
      ? cFrom.sym === 'WBNB' && gt?.bnb
        ? `≈ $${(amt * gt.bnb).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
        : cFrom.sym === 'USDT'
          ? `≈ $${amt.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
          : ' '
      : ' ';
  const cPrompt =
    cFrom && cTo && cust.state === 'ok'
      ? swapGenericPrompt({
          amount: valid ? amount : '<AMOUNT>',
          fromSym: cFrom.sym,
          toSym: cTo.sym,
          fromAddr: cFrom.addr,
          toAddr: cTo.addr,
          pairAddr: cust.pairAddr || '—',
          label: cLabel,
          pathLine: (cust.pathAddrs || [cFrom.addr, cTo.addr])
            .map((a) => {
              const hit = VERIFIED_KEYS.find((k) => TOKENS[k].addr.toLowerCase() === a.toLowerCase());
              const nm = hit || (imported.find((t) => t.addr.toLowerCase() === a.toLowerCase()) || {}).symbol || shortAddr(a);
              return `${nm} ${a}`;
            })
            .join(' → '),
          est: cEstStr,
          custom: true,
          slip: settings.slip,
          deadline: settings.deadline,
        })
      : '';
  const cFlip = () => {
    if (!isCustom) return;
    if (valid && cust.out) setAmount(fmtAmt(cust.out));
    setCustom({ fromKey: custom.toKey, toKey: custom.fromKey });
  };

  const promptText = isCustom ? cPrompt : home ? hPrompt : gPrompt;
  const noPool = isCustom && cust.state === 'nopool';
  const copyOrder = async () => {
    if (noPool || (isCustom && cust.state !== 'ok')) return;
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2600);
    } catch {
      /* clipboard unavailable — the full order block below carries the same text */
    }
  };

  const chipTok = (t, label) =>
    t
      ? { img: t.logo, sym: t.dispSym || t.sym, label, letters: t.logo ? null : (t.sym || '?').slice(0, 4) }
      : { img: null, sym: '—', label, letters: '?' };
  const fromTok = isCustom
    ? chipTok(cFrom, `Amount in ${cFrom ? cFrom.sym : ''}`)
    : home
      ? buy
        ? { img: bnbUrl, sym: 'BNB', label: 'Amount in BNB' }
        : { img: logoUrl, sym: 'A404', label: 'Amount in A404' }
      : { img: TOKENS[gFrom].logo, sym: gFrom, label: `Amount in ${gFrom}` };
  const toTok = isCustom
    ? chipTok(cTo, `Estimated ${cTo ? cTo.sym : ''} at the live pool rate`)
    : home
      ? buy
        ? { img: logoUrl, sym: 'A404', label: 'Estimated A404 at the anchor' }
        : { img: bnbUrl, sym: 'BNB', label: 'Estimated BNB at the anchor' }
      : { img: TOKENS[gTo].logo, sym: gTo, label: `Estimated ${gTo} at the live pool rate` };

  const deskLabel = isCustom ? cLabel : sel.label;
  const venue = isCustom ? 'PANCAKESWAP V2' : sel.venue;

  return (
    <section className="sec first">
      <SectionHead
        title={
          <>
            AUTONOMOUS <span className="amber">AGENT SWAP</span>
          </>
        }
      />
      <div className="swapchips">
        <span className="swapchip">
          <span className={`psdot ${isCustom ? (cust.state === 'ok' ? 'on' : '') : d ? 'on' : ''}`} aria-hidden="true" /> POOL LIVE
        </span>
        <span className="swapchip price">
          {isCustom ? (
            <>1 {cFrom ? cFrom.sym : '—'} = {cust.rate ? `${fmtAmt(cust.rate)} ${cTo ? cTo.sym : ''}` : '—'}</>
          ) : home ? (
            <>1 A404 = {gt ? `$${gt.a404}` : '—'}</>
          ) : (
            <>1 {gFrom} = {pxFrom ? fmtPx(pxFrom) : '—'}</>
          )}
        </span>
        <span className="swapchip">{venue}</span>
      </div>
      <p className="lede">
        Market #3: swaps executed by your agent, not by your clicks. Set the amount, copy the order — your agent
        trades on the pool. No wallet connection, ever.
      </p>

      <div className="dexwrap">
        <div className="dexcard">
          <div className="dexhead">
            <span>SWAP — {deskLabel}</span>
            <button
              type="button"
              className={'dexgear' + (showSettings ? ' on' : '')}
              aria-label="Swap settings"
              aria-expanded={showSettings}
              onClick={() => setShowSettings(!showSettings)}
            >
              ⚙
            </button>
          </div>
          {showSettings && (
            <div className="dexpop">
              <div className="dexpophead">
                <span>SETTINGS</span>
                <button type="button" className="dexpopx" aria-label="Close settings" onClick={() => setShowSettings(false)}>
                  ✕
                </button>
              </div>
              <div className="setlbl">MAX SLIPPAGE</div>
              <div className="setrow">
                {SLIP_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={'setchip' + (settings.slip === p && !slipCustom ? ' on' : '')}
                    onClick={() => {
                      setSlipCustom('');
                      setSettings((s) => ({ ...s, slip: p }));
                    }}
                  >
                    {p}%
                  </button>
                ))}
                <input
                  className={'setin' + (slipCustom ? ' on' : '')}
                  placeholder="Custom %"
                  inputMode="decimal"
                  value={slipCustom}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    setSlipCustom(v);
                    const n = parseFloat(v);
                    if (Number.isFinite(n) && n > 0 && n <= 50) setSettings((s) => ({ ...s, slip: String(n) }));
                  }}
                />
              </div>
              <div className="setlbl">ORDER DEADLINE</div>
              <div className="setrow">
                {DEADLINE_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={'setchip' + (settings.deadline === d ? ' on' : '')}
                    onClick={() => setSettings((s) => ({ ...s, deadline: d }))}
                  >
                    {d} min
                  </button>
                ))}
              </div>
              <p className="setnote">
                Your slippage is <b>written into the order you copy</b> — your agent trades inside that limit, or not at
                all.
              </p>
            </div>
          )}
          <div className="dexfield">
            <div className="dexlbl">FROM</div>
            <div className="dexrow">
              <input
                className="dexin"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                inputMode="decimal"
                aria-label={fromTok.label}
              />
              <button type="button" className="tokchip tokbtn" onClick={() => setPicker('from')} aria-label="Choose the token you pay">
                {fromTok.img ? <img className="coinimg" src={fromTok.img} alt="" /> : <span className="coinletters sm">{fromTok.letters}</span>}
                {fromTok.sym} <span className="tokcaret">▾</span>
              </button>
            </div>
            <div className="dexusd">{isCustom ? cUsd : home ? hUsd : gUsd}</div>
          </div>
          <button type="button" className="dexflip" onClick={isCustom ? cFlip : home ? hFlip : gFlip} aria-label="Flip swap direction">
            <span>⇅</span>
          </button>
          <div className="dexfield">
            <div className="dexlbl">
              {isCustom ? 'TO — ESTIMATE AT THE LIVE POOL RATE' : home ? 'TO — ESTIMATE AT THE ANCHOR' : 'TO — ESTIMATE AT THE LIVE POOL RATE'}
            </div>
            <div className="dexrow">
              <input className="dexin" value={isCustom ? cEstStr : home ? hEstStr : gEstStr} readOnly aria-label={toTok.label} />
              <button type="button" className="tokchip tokbtn" onClick={() => setPicker('to')} aria-label="Choose the token you receive">
                {toTok.img ? <img className="coinimg" src={toTok.img} alt="" /> : <span className="coinletters sm">{toTok.letters}</span>}
                {toTok.sym} <span className="tokcaret">▾</span>
              </button>
            </div>
            <div className="dexusd">Your agent quotes the live pool rate before it trades</div>
          </div>
          <div className="dexrate">
            <span>
              {isCustom ? (
                noPool ? (
                  <>No PancakeSwap V2 pool for this pair</>
                ) : (
                  <>
                    1 {cFrom ? cFrom.sym : '—'} ≈ <b>{cust.rate ? `${fmtAmt(cust.rate)} ${cTo ? cTo.sym : ''}` : '—'}</b>
                  </>
                )
              ) : home ? (
                buy ? (
                  <>
                    1 BNB = <b>202,000 A404</b>
                  </>
                ) : (
                  <>
                    1 A404 = <b>0.00000495 BNB</b>
                  </>
                )
              ) : (
                <>
                  1 {gFrom} ≈ <b>{gRatio ? fmtAmt(gRatio) : '—'} {gTo}</b>
                </>
              )}
            </span>
            <span>{home ? 'reference anchor' : 'live pool rate'}</span>
          </div>
          <button type="button" className="dexcta" onClick={copyOrder} disabled={noPool || (isCustom && cust.state !== 'ok')}>
            {noPool
              ? 'NO POOL FOR THIS PAIR — CANNOT QUOTE'
              : isCustom && cust.state === 'loading'
                ? 'READING THE POOL…'
                : copied
                  ? 'ORDER COPIED — PASTE IT TO YOUR AGENT'
                  : 'COPY THE ORDER — MY AGENT SWAPS'}
          </button>
          <p className="dexsub">
            {noPool
              ? 'This pair has no PancakeSwap V2 pool yet, so the desk cannot quote or order it. The token stays imported for when a pool exists.'
              : 'One paste into your agent: it previews the trade, you approve, it executes and verifies on-chain.'}
          </p>
          {picker ? (
            <TokenPicker side={picker} imported={imported} tokenOf={tokenOf} onPick={pickToken} onClose={() => setPicker(null)} />
          ) : null}
        </div>

        <div className="panel dexdetails">
          <div className="statusrows">
            <div className="buyline">
              <span>POOL</span>
              <b>{deskLabel}</b>
            </div>
            {home ? (
              <div className="buyline">
                <span>LP</span>
                <b>Burned · 100%</b>
              </div>
            ) : (
              <div className="buyline">
                <span>VENUE</span>
                <b>{venue}</b>
              </div>
            )}
            <div className="buyline">
              <span>EXECUTION</span>
              <b>Your agent — no wallet connect</b>
            </div>
            {home ? (
              <div className="buyline">
                <span>DEPTH</span>
                <b>Grows with every PASSDROP ignition</b>
              </div>
            ) : isCustom ? (
              <div className="buyline">
                <span>ROUTE</span>
                <b>{noPool ? 'No pool found' : cust.viaWbnb ? 'Via WBNB' : 'Direct pair'}</b>
              </div>
            ) : (
              <div className="buyline">
                <span>VOLUME 24H</span>
                <b>{d ? fmtVol(d.vol) : '—'}</b>
              </div>
            )}
          </div>
        </div>

        <MarketsPanel rows={rows} sel={isCustom ? null : sel} onSelect={select} />

        {noPool ? (
          <div className="panel">
            <div className="panelh">NO POOL — NO ORDER</div>
            <p className="dim">
              The desk only writes orders for pairs with a live PancakeSwap V2 pool. {cFrom ? cFrom.sym : ''} /{' '}
              {cTo ? cTo.sym : ''} has none yet — nothing to quote, nothing to sign. Import stays saved on this
              device for the day a pool exists.
            </p>
          </div>
        ) : (
          <CopyBlock
            title="GIVE THIS TO YOUR AGENT — THE SWAP ORDER"
            text={promptText}
            note={
              home
                ? 'The minimum-received guard is the point: your agent quotes first, and refuses to execute below the floor you set.'
                : 'Quote-first is the point: your agent reads the live pool, sets the minimum at 99% of the fresh quote, and stops instead of trading through a bad price.'
            }
          />
        )}
      </div>
    </section>
  );
}
