import React, { useEffect, useState } from 'react';
import {
  startCounters,
  startListings,
  startFeed,
  startMarket,
  startBadges,
  startBurn,
  startAgentLP,
  startMuseAd,
  startPairAd,
  startPassDrop,
  startPassDropFeed,
  startMine,
  startMineFeed,
  startLaunchpad,
  startLaunchpadFeed,
  startDailyPool,
  startDailyPoolFeed,
  startPredict,
  startPredictFeed,
  startMoonshot,
  refreshLaunches,
  countersStore,
} from './data.js';
import { useStore } from './store.js';
import { fmtInt, fmtWeiExact } from './format.js';
import { A, scanAddr } from './config.js';
import { useCopy } from './components.jsx';
import Home from './views/Home.jsx';
import Launchpad, { LaunchpadToken } from './views/Launchpad.jsx';
import Moonshot from './views/Moonshot.jsx';
import BadgeMarket from './views/BadgeMarket.jsx';
import MyPass from './views/MyPass.jsx';
import Swap from './views/Swap.jsx';
import Liquidity from './views/Liquidity.jsx';
import StakeLP from './views/StakeLP.jsx';
import Engine from './views/Engine.jsx';
import DailyPool from './views/DailyPool.jsx';
import Predict from './views/Predict.jsx';
import Token from './views/Token.jsx';
import PassDrop from './views/PassDrop.jsx';
import Docs, { topicExists } from './views/Docs.jsx';

const VIEWS = [
  { key: 'home', label: 'Home', path: '#/' },
  { key: 'launchpad', label: 'Launchpad', path: '#/launchpad' },
  { key: 'moonshot', label: 'Moonshot', path: '#/moonshot' },
  { key: 'market', label: 'Badge Market', path: '#/market' },
  { key: 'mypass', label: 'My Pass', path: '#/mypass' },
  { key: 'swap', label: 'Autonomous Swap', path: '#/swap' },
  { key: 'liquidity', label: 'Liquidity Provider 💧', path: '#/liquidity' },
  { key: 'stakelp', label: 'Stake Liquidity 🔥', path: '#/stakelp' },
  { key: 'mine', label: 'Agents Mine ⛏️', path: '#/mine' },
  { key: 'daily-pool', label: 'Daily Pool', path: '#/daily-pool' },
  { key: 'predict', label: 'Predict', path: '#/predict' },
  { key: 'token', label: 'Token', path: '#/token' },
  { key: 'passdrop', label: 'Passdrop 🎉', path: '#/passdrop' },
  { key: 'docs', label: 'Docs', path: '#/docs' },
];

function parseHash() {
  const h = window.location.hash || '#/';
  const clean = h.split('?')[0];
  const parts = clean.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!parts.length) return { view: 'home' };
  const [head, sub] = parts;
  if (head === 'docs') return { view: 'docs', topic: topicExists(sub) ? sub : 'overview' };
  if (head === 'engine') return { view: 'mine' }; // alias — the machine's public name is AGENTS MINE
  if (head === 'wall') return { view: 'market' }; // retired route — the Wall merged into the Badge Market gallery
  if (head === 'launches' || head === 'create') return { view: 'launchpad' }; // merged — the Launch board and the Create page became the Launchpad
  if (head === 'launchpad')
    return { view: 'launchpad', token: sub && /^0x[0-9a-fA-F]{40}$/.test(sub) ? sub.toLowerCase() : null };
  if (VIEWS.some((v) => v.key === head)) return { view: head };
  return { view: 'home' };
}

function Footer() {
  const counters = useStore(countersStore);
  const block = counters.data?.block;
  const { copy, done } = useCopy();
  const donateShort = `${A.donate.slice(0, 6)}…${A.donate.slice(-4)}`;
  return (
    <footer className="footer">
      <div className="footblock">
        <span className="footdot" />
        {block ? `LIVE FROM BNB CHAIN · BLOCK ${fmtInt(Number(block))}` : 'READING BNB CHAIN…'}
      </div>
      <div className="footbrand">
        AGENT404
        <span className="brandcaret" />
      </div>
      <div className="foottag">AN ANONYMOUS PROJECT · ITS OFFICIAL HOME IS ITS REPOSITORY</div>
      <div className="footsocial">
        <a
          className="socbtn"
          href="https://github.com/agentic-404/agent404"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          GITHUB <span className="arr">↗</span>
        </a>
        <a className="socbtn" href="https://x.com/A404Coin" target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          @A404Coin <span className="arr">↗</span>
        </a>
      </div>
      <div className="footnote">Verify everything on-chain. Nothing here is a promise of returns.</div>
      <div className="footrights">AGENT404 © 2026</div>
      <div className="footdonate">
        Donations:{' '}
        <a className="addr" href={scanAddr(A.donate)} target="_blank" rel="noopener noreferrer">
          {donateShort}
        </a>{' '}
        <span className="footheart">♥</span>
        <button type="button" className="footchip" onClick={() => copy(A.donate)}>
          {done ? 'COPIED' : 'COPY'}
        </button>
      </div>
    </footer>
  );
}

const GT_POOL_URL =
  'https://api.geckoterminal.com/api/v2/networks/bsc/pools/0x6116d6B62b35aAa9aCbC118eD7c51861c085de09';

function fmtBnbPrice(s) {
  const p = Number(s);
  if (!p || !Number.isFinite(p)) return null;
  return String(Number(p.toPrecision(3)));
}

function PriceStrip() {
  const counters = useStore(countersStore);
  const [bnb, setBnb] = useState(null);
  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const r = await fetch(GT_POOL_URL);
        const j = await r.json();
        const v = fmtBnbPrice(j?.data?.attributes?.base_token_price_quote_token);
        if (!dead && v) setBnb(v);
      } catch {
        /* keep the last value, or the em dash */
      }
    };
    load();
    const t = setInterval(load, 60000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, []);
  const floor = counters.data?.mktFloor;
  return (
    <div className="pricestrip" role="note">
      <span className={`psdot ${bnb ? 'on' : ''}`} aria-hidden="true" />
      <span className="pslive">LIVE</span>
      <span className="psprice">
        1 $A404 = <b>{bnb ? `${bnb} BNB` : '—'}</b>
      </span>
      <span className="pssep hidesm">·</span>
      <span className="psdim hidesm">POOL — PANCAKESWAP V2</span>
      <span className="pssep">·</span>
      <span className="psdim">
        BADGE FLOOR <b className="psfloor">{floor ? `${fmtWeiExact(floor)} BNB` : '—'}</b>
      </span>
      <span className="pssrc hidesm">VIA GECKOTERMINAL</span>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(parseHash);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    startCounters();
    startListings();
    startFeed();
    startMarket();
    startBadges();
    startBurn();
    startAgentLP();
    startMuseAd();
    startPairAd();
    startPassDrop();
    startPassDropFeed();
    startMine();
    startMineFeed();
    startLaunchpad();
    startLaunchpadFeed();
    startDailyPool();
    startDailyPoolFeed();
    startPredict();
    startPredictFeed();
    startMoonshot();
    refreshLaunches();
  }, []);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      setMenuOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const view = route.view;
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="brandname">AGENT404</span>
          <span className="brandcaret" aria-hidden="true" />
          <span className="brandchip">BNB CHAIN · DN-404</span>
        </a>
        <div className="topright">
          <a
            className="llmslink"
            href="https://agentic-404.github.io/agent404/llms.txt"
            target="_blank"
            rel="noopener noreferrer"
          >
            LLMS.TXT ↗
          </a>
          <button
            type="button"
            className={`menubtn ${menuOpen ? 'open' : ''}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="burger" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {menuOpen ? 'CLOSE' : 'MENU'}
          </button>
        </div>
      </header>

      <PriceStrip />

      {menuOpen ? (
        <div className="menuscrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      ) : null}

      {menuOpen ? (
        <nav className="drawer">
          {VIEWS.map((v, i) => (
            <a
              key={v.key}
              href={v.path}
              className={view === v.key ? 'on' : ''}
              onClick={() => setMenuOpen(false)}
            >
              <span className="dnum">{String(i + 1).padStart(2, '0')}</span>
              <span className="dlabel">
                {v.label.replace(/[\uFE0E\uFE0F\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim()}
              </span>
              {view === v.key ? <span className="dhere">●</span> : null}
            </a>
          ))}
          <div className="drawernote">
            No wallet connects to this site. Every action runs through your own agent.
          </div>
        </nav>
      ) : null}

      <main className="main">
        {view === 'home' && <Home />}
        {view === 'launchpad' &&
          (route.token ? <LaunchpadToken token={route.token} /> : <Launchpad />)}
        {view === 'moonshot' && <Moonshot />}
        {view === 'market' && <BadgeMarket />}
        {view === 'mypass' && <MyPass />}
        {view === 'swap' && <Swap />}
        {view === 'liquidity' && <Liquidity />}
        {view === 'stakelp' && <StakeLP />}
        {view === 'mine' && <Engine />}
        {view === 'daily-pool' && <DailyPool />}
        {view === 'predict' && <Predict />}
        {view === 'token' && <Token />}
        {view === 'passdrop' && <PassDrop />}
        {view === 'docs' && <Docs topic={route.topic || 'overview'} />}
      </main>

      <Footer />
    </div>
  );
}
