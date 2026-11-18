import React from 'react';
import { countersStore, burnStore } from '../data.js';
import { useStore } from '../store.js';
import { fmtInt, fmtToken } from '../format.js';
import { A, FREE_PER_CLAIM, PAID_PER_CLAIM, scanAddr } from '../config.js';
import { StatCard, CopyBtn, StaleTag } from '../components.jsx';
import logoUrl from '../assets/a404-glitch-404.png';
import badgeUrl from '../assets/pass-badge-256.png';

const CONTRACTS = [
  ['$A404 token (DN-404)', A.token],
  ['Badge mirror (DN-404)', A.mirror],
  ['Free claim lane', A.claim],
  ['Paid claim lane', A.sale],
  ['Badge market', A.market],
  ['AgentFun factory — curve (V2)', A.funV2],
  ['AgentFun factory — direct (v1)', A.funV1],
  ['Binance Agent ID registry', A.registry],
];

const RULES = [
  [
    'No Agent ID, no badges.',
    'A wallet without an Agent ID receives and holds tokens — and no badges are minted for it.',
  ],
  [
    'Badges materialize on their own.',
    'If that wallet later obtains an Agent ID, its badges appear automatically to match its whole-token balance.',
  ],
  [
    'Badges mirror the balance down.',
    'If a wallet\u2019s whole-token balance falls, badges retire accordingly — always mirroring the balance.',
  ],
  [
    'Market plumbing stays clean.',
    'Exchanges, pools, and ordinary contracts never receive badges — swaps move tokens only.',
  ],
];

function BurnPanel({ burnedWhole, badgesBurned }) {
  return (
    <div className="burnpanel">
      <h3 className="panelh"><span className="fireicon">🔥</span> BURNED FOREVER</h3>
      <div className="burngrid">
        <div>
          <div className="burnbig">{burnedWhole === null ? '—' : `${fmtInt(burnedWhole)} $A404`}</div>
          <div className="burnlbl">BURNED — PERMANENTLY OUT OF CIRCULATION</div>
        </div>
        <div>
          <div className="burnbadges">{badgesBurned === null ? '—' : fmtInt(badgesBurned)}</div>
          <div className="burnlbl">PASS BADGES BURNED</div>
        </div>
      </div>
      <p className="burnsrc">
        AgentFun launch fees burn · Phase 2 liquidity burns — this
        pile only grows.
      </p>
      <div className="burnaddr">
        Dead address: {A.dead}{' '}
        <a className="burnproof" href={scanAddr(A.dead)} target="_blank" rel="noopener noreferrer" title="Burn proof — the dead address on BscScan">
          ↗
        </a>
      </div>
    </div>
  );
}

export default function Token() {
  const counters = useStore(countersStore);
  const burn = useStore(burnStore);
  const c = counters.data;
  const circulating =
    c && c.free !== null && c.paid !== null
      ? Number(c.free) * FREE_PER_CLAIM + Number(c.paid) * PAID_PER_CLAIM
      : null;
  const dead = burn.data?.deadBalance ?? c?.deadBalance ?? null;
  const burnedWhole = dead !== null ? Number(dead / 1000000000000000000n) : null;
  const mintedBadges =
    c && c.free !== null && c.paid !== null
      ? Number(c.free) * FREE_PER_CLAIM + Number(c.paid) * PAID_PER_CLAIM
      : null;
  const badgesBurned =
    mintedBadges !== null && c?.badges !== null && c?.badges !== undefined
      ? mintedBadges - Number(c.badges)
      : null;
  const funBurned = burn.data?.funBurned ?? null;

  return (
    <section className="sec first">
      <div className="tokread">
        READ LIVE FROM BNB CHAIN <StaleTag stale={counters.stale} />
      </div>
      <div className="tokpie">
        <div className="tokpie-head">
          <h2 className="tokpie-title">
            <span>TOKEN</span> <span className="amber">SUPPLY</span>
          </h2>
          <span className="tokpie-right">404,404 $A404 · FIXED</span>
        </div>
        <div className="tokpie-donut">
          <svg
            viewBox="0 0 220 220"
            role="img"
            aria-label="A404 supply: 75% community claim, 8.9% liquidity pool, 12.24% listing rewards, 3.86% project reserve"
          >
            <circle cx="110" cy="110" r="88" fill="none" stroke="#1c1c1c" strokeWidth="28" />
            <circle
              cx="110"
              cy="110"
              r="88"
              fill="none"
              stroke="#f5b041"
              strokeWidth="28"
              strokeDasharray="414.69 552.92"
              strokeDashoffset="0"
              transform="rotate(-90 110 110)"
            />
            <circle
              cx="110"
              cy="110"
              r="88"
              fill="none"
              stroke="#ffd34d"
              strokeWidth="28"
              strokeDasharray="49.22 552.92"
              strokeDashoffset="-414.69"
              transform="rotate(-90 110 110)"
            />
            <circle
              cx="110"
              cy="110"
              r="88"
              fill="none"
              stroke="#9a9a9a"
              strokeWidth="28"
              strokeDasharray="67.68 552.92"
              strokeDashoffset="-463.91"
              transform="rotate(-90 110 110)"
            />
            <circle
              cx="110"
              cy="110"
              r="88"
              fill="none"
              stroke="#3a3a3a"
              strokeWidth="28"
              strokeDasharray="21.33 552.92"
              strokeDashoffset="-531.59"
              transform="rotate(-90 110 110)"
            />
          </svg>
          <div className="tokpie-center">
            <div className="tokpie-total">404,404</div>
            <div className="tokpie-total-sub">$A404 · FIXED SUPPLY, NO MINT</div>
          </div>
        </div>
        <div className="grid grid4">
          <div className="tokpie-card">
            <div className="tokpie-k">
              <i className="tokpie-dot" style={{ background: '#f5b041' }} />
              75% — COMMUNITY CLAIM
            </div>
            <div className="tokpie-big">303,303 A404</div>
            <div className="tokpie-d">1,001 shares × 303 A404 · free · Agent ID only · SOLD OUT</div>
          </div>
          <div className="tokpie-card">
            <div className="tokpie-k">
              <i className="tokpie-dot" style={{ background: '#ffd34d' }} />
              8.9% — LIQUIDITY POOL
            </div>
            <div className="tokpie-big">36,000 A404</div>
            <div className="tokpie-d">The future A404/WBNB pool · pairs with POL bucket BNB at ignition · LP burned</div>
          </div>
          <div className="tokpie-card">
            <div className="tokpie-k">
              <i className="tokpie-dot" style={{ background: '#9a9a9a' }} />
              12.24% — LISTING REWARDS
            </div>
            <div className="tokpie-big">49,500 A404</div>
            <div className="tokpie-d">20 A404 per share · halving every 1,000 shares</div>
          </div>
          <div className="tokpie-card">
            <div className="tokpie-k">
              <i className="tokpie-dot" style={{ background: '#3a3a3a' }} />
              3.86% — PROJECT RESERVE
            </div>
            <div className="tokpie-big">15,601 A404</div>
            <div className="tokpie-d">Tail 4,500 · mining 7,000 · project 3,000 · rest 1,101</div>
          </div>
        </div>
        <p className="dim small">
          Allocation at birth — every A404 of the 404,404 supply is in one of these four slices.
        </p>
      </div>
      <div className="tokpitch">
        <h2>
          The first DN-404 asset on BNB Chain — <span className="thin">the token whose badge answers to identity.</span>
        </h2>
        <p>
          AGENT404 is one asset with two natures: a token that trades freely for anyone, and an NFT badge that only
          materializes inside a wallet holding a Binance Agent ID. It is the first DN-404 asset on BNB Chain — a fair
          launch with no creator allocation, where the market forms in the open and deepens at the anchor with every
          ignition.
        </p>
        <p>
          Through AgentFun, any Agent ID holder can launch a token for a flat 101 $A404, and half of every launch fee
          is burned forever. All of it serves one mission: autonomous agentic commerce for the decentralized Agentic
          Web3 era.
        </p>
      </div>
      <div className="tokencard">
        <div className="tokhead">
          <img className="toklogo" src={logoUrl} alt="AGENT404 404 mark" />
          <span className="toktitle">
            THE TOKEN — <span className="amber">$A404</span> SNAPSHOT
          </span>
        </div>
      <div className="grid grid4">
        <StatCard
          glyph="⬢"
          accent="amber"
          label="FIXED SUPPLY"
          big={c?.supply ? fmtToken(c.supply) : '404,404'}
          sub="minted once · no mint function"
        />
        <StatCard
          glyph="✋"
          accent="amber"
          label="IN COMMUNITY HANDS"
          big={circulating === null ? '—' : fmtInt(circulating)}
          sub="$A404 distributed by the claim lanes"
        />
        <StatCard
          glyph="❖"
          accent="amber"
          label="BADGES IN CIRCULATION"
          big={c?.badges !== null && c?.badges !== undefined ? fmtInt(Number(c.badges)) : '—'}
          sub="one per whole $A404 in Agent ID wallets"
        />
        <StatCard
          glyph="🔥"
          accent="burn"
          label="BURNED — AT THE DEAD ADDRESS"
          big={dead !== null ? fmtToken(dead) : '—'}
          sub="$A404 held by 0x…dEaD, gone forever"
        />
      </div>
      <p className="dim small">
        Of the dead-address balance, {funBurned !== null ? fmtToken(funBurned) : '—'} $A404 arrived there as the burned
        half of AgentFun launch fees.
      </p>

        <div className="toksec">
          <BurnPanel burnedWhole={burnedWhole} badgesBurned={badgesBurned} />
        </div>

        <div className="toksec">
          <h3 className="panelh">ONE SUPPLY, TWO NATURES — HOW DN-404 WORKS HERE</h3>
        <div className="natures">
          <div className="nature">
            <img className="natureimg" src={logoUrl} alt="$A404 token" />
            <div className="natureh">THE TOKEN — TRADES FREELY</div>
            <p>
              The fungible form: 18 decimals, transferable by anyone — a person, an agent, a contract, a pool. Nothing
              about the token restricts who may hold it.
            </p>
          </div>
          <div className="mirror" aria-hidden="true">
            ⇄
          </div>
          <div className="nature">
            <img className="natureimg" src={badgeUrl} alt="AGENT404 PASS badge" />
            <div className="natureh">THE BADGE — ANSWERS TO IDENTITY</div>
            <p>
              One badge — an NFT on the mirror contract — for each whole $A404 held, but only if the holding wallet
              holds a Binance Agent ID. The contract enforces the rule continuously, not once at distribution.
            </p>
          </div>
        </div>
        <ol className="rulesnum">
          {RULES.map(([lead, rest]) => (
            <li key={lead}>
              <b>{lead}</b> {rest}
            </li>
          ))}
        </ol>
        <p className="naturefoot">
          The badge is not a separate drop or a second sale. It is the same asset, seen from the identity layer — an
          agent never applies for membership; its balance and its credential simply make the badge true.
        </p>
      </div>

        <div className="toksec">
          <h3 className="panelh">CONTRACTS — VERIFY EVERYTHING</h3>
        <table className="facttable">
          <tbody>
            {CONTRACTS.map(([label, addr]) => (
              <tr key={addr}>
                <td className="fk">{label}</td>
                <td>
                  <a href={scanAddr(addr)} target="_blank" rel="noopener noreferrer">
                    <code className="addr">{addr}</code>
                  </a>{' '}
                  <CopyBtn text={addr} label="COPY" className="mini" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="dim small">
          All sources are public and verified on BscScan and Sourcify (exact matches). No owner, no admin, no upgrade
          path. No professional third-party audit has been commissioned — the code is short, public, and readable;
            verify it yourself.
          </p>
        </div>
      </div>
    </section>
  );
}
