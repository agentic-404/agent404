import React from 'react';
import { agentlpStore } from '../data.js';
import { useStore } from '../store.js';
import { fmtToken, fmtWeiExact } from '../format.js';
import { A } from '../config.js';
import { SectionHead, StatCard, CopyBlock, CopyBtn, StaleTag, Addr } from '../components.jsx';
import { stakeLpMasterPrompt } from '../prompts.js';
import logoUrl from '../assets/a404-glitch-404.png';

const TIERS = [
  ['Flexible', 'none — unstake at any time', '1×'],
  ['Committed', '30 days', '1.5×'],
  ['Deep', '90 days', '2×'],
];

const FAIRNESS = [
  'Streaming — bonus funds are never paid as a lump sum. Each funding streams linearly over 7 days, so rewards accrue only to those actually staked while the stream runs.',
  'Parking — the stream advances only while stake exists. Funds that arrive to an empty machine wait, untouched, and stream when staking resumes. Nothing is lost; nothing can be captured retroactively.',
  'The 25% cap — no single wallet\u2019s bonus weight may exceed 25% of the total. Capital above the cap still earns the full base layer; only its bonus weight is limited.',
  'The unstake guarantee — a bonus layer may starve; it may never trap. Staked LP is always withdrawable once a position is unlocked, and unstaking settles any pending bonus in the same transaction.',
];

// The machine is LIVE and staking is open at any pool depth. The pair's
// WBNB reserve only drives the depth note under the status: below 0.05 BNB
// the pool is described as being in its earliest formation stage.
const FORMED_MIN_WBNB = 50000000000000000n; // 0.05 BNB

export default function StakeLP() {
  const lp = useStore(agentlpStore);
  const d = lp.data;
  const formed = d?.reserveWBNB !== null && d?.reserveWBNB !== undefined && d.reserveWBNB >= FORMED_MIN_WBNB;
  const ratePerDay = d?.streamRate !== null && d?.streamRate !== undefined ? d.streamRate * 86400n : null;

  return (
    <section className="sec first">
      <SectionHead
        title={
          <span className="tokhead">
            <img className="toklogo" src={logoUrl} alt="$A404 logo" />
            <span className="lp-title">DECENTRALIZED AGENTLP</span>
          </span>
        }
        right={
          <>
            READ LIVE FROM BNB CHAIN <StaleTag stale={lp.stale} />
          </>
        }
      />
      <span className="earnchip">EARN REWARDS</span>
      <p className="lede">
        Liquidity that stays earns the market&rsquo;s flow. AGENTLP is the ownerless staking machine for the canonical
        $A404/WBNB pool: provide liquidity, stake the LP tokens, and the market&rsquo;s own flows pay you for keeping
        the depth in place. There is no wallet connection here — every action runs through your own agent.
      </p>

      <div className="panel lp-event">
        <h3 className="panelh">
          <span>
            STAKE <em>EVENT</em> · 10 DAYS
          </span>
        </h3>
        <p className="lp-event-lede">
          Earn <b>20 A404</b> for staking LP worth <b>100 A404</b>.
        </p>
        <ul className="rules">
          <li>
            Add A404 + BNB liquidity to the canonical A404/WBNB pool, then stake the LP in AGENTLP at
            tier Committed — 30-day lock, 1.5× weight.
          </li>
          <li>10 stakers a day, first come first served, Agent ID only. Runs 18–28 Nov 2026 (UTC).</li>
          <li>
            The reward is paid by the project after the stake is verified on-chain — it is not
            a contract call, and it is not the BNB bonus stream.
          </li>
          <li>Reward pool: 2,000 A404 total. Staked LP stays locked 30 days and returns only to its staker.</li>
        </ul>
      </div>

      <div className="grid grid4">
        <StatCard
          glyph="⬢"
          accent="amber"
          label="TOTAL COUNTED WEIGHT"
          big={d?.totalWeight !== null && d?.totalWeight !== undefined ? fmtToken(d.totalWeight) : '—'}
          sub="tier-weighted stake across all stakers"
        />
        <StatCard
          glyph="◈"
          accent="amber"
          label="PARKED BONUS"
          big={d?.parked !== null && d?.parked !== undefined ? `${fmtToken(d.parked)} BNB` : '—'}
          sub="funded, waiting for stake to stream against"
        />
        <StatCard
          glyph="≈"
          accent="amber"
          label="STREAM RATE"
          big={ratePerDay !== null ? `${fmtToken(ratePerDay)} BNB` : '—'}
          sub="per day while a stream runs — 0 while parked"
        />
        <StatCard
          glyph="⇄"
          accent="amber"
          label="CANONICAL PAIR — $A404 SIDE"
          big={d?.reserveA404 !== null && d?.reserveA404 !== undefined ? fmtToken(d.reserveA404) : '—'}
          sub={
            d?.reserveWBNB !== null && d?.reserveWBNB !== undefined
              ? `${fmtWeiExact(d.reserveWBNB)} WBNB on the other side`
              : 'reserves read from the pair contract'
          }
        />
      </div>

      <div className="panel statuspanel status-live">
        <h3 className="panelh">STATUS — LIVE AND COUNTING</h3>
        <div className="statusrows">
          <div className="buyline">
            <span>CONTRACT</span>
            <b>
              <Addr address={A.agentlp} /> <CopyBtn text={A.agentlp} label="COPY" className="mini" />
            </b>
          </div>
          <div className="buyline">
            <span>LP TOKEN / PAIR</span>
            <b>
              $A404 / WBNB — PancakeSwap V2 · <Addr address={A.pair} />
            </b>
          </div>
          <div className="buyline">
            <span>GATE</span>
            <b>Binance Agent ID — staking and the bonus answer to identity</b>
          </div>
          <div className="buyline">
            <span>STATUS</span>
            <b>LIVE — STAKING IS OPEN</b>
          </div>
        </div>
        <p>
          {formed
            ? 'The canonical pool is formed and staking is open against it. The numbers above are the machine\u2019s live state, read from the contract.'
            : 'The contract is deployed, verified, and counting — and staking is open today. The canonical pair is in its earliest formation stage, so the LP staked now is its pioneer depth, opened at the reference ratio (1 BNB = 202,000 A404).'}
        </p>
      </div>

      <div className="panel">
        <h3 className="panelh">TAKE A SEAT — FROM LP TO STAKING</h3>
        <ol className="rulesnum stairs">
          <li>
            <b>Open the pioneer depth.</b> Add liquidity to the canonical $A404/WBNB pool at the reference ratio — today's positions are the pool's first real depth.
          </li>
          <li>
            <b>Add LP via the official guide.</b> Provide liquidity on PancakeSwap V2 and receive the pool&rsquo;s LP
            tokens.
          </li>
          <li>
            <b>Stake the LP tokens here.</b> Lock them into AGENTLP under your Agent ID and pick a tier.
          </li>
          <li>
            <b>Bonus streams to stakers.</b> The Badge Market royalty share streams in BNB, weighted by tier, on top
            of the base layer.
          </li>
        </ol>
      </div>

      <div className="panel">
        <h3 className="panelh">TWO REWARD LAYERS</h3>
        <p>
          <b>The base layer — given by the protocol, no staking required.</b> Every swap on PancakeSwap V2 carries a
          0.25% fee, and <b>0.17% of every trade accrues to liquidity providers</b> in exact proportion to their share
          of the pool. It compounds into the pool&rsquo;s reserves and is realized when liquidity is removed. This
          layer belongs to every LP holder, staked or not — perpetual, funded by traders, and impossible for anyone
          to switch off.
        </p>
        <p>
          <b>The bonus layer — AGENTLP&rsquo;s own distribution.</b> The Badge Market&rsquo;s 1% royalty is divided in
          two: half remains in the project reserve, and <b>half is forwarded to AGENTLP</b>, where it streams to
          stakers in BNB over 7 days per funding, weighted by tier. Its size floats with real market volume — in a
          quiet market it may pay nothing at all, and the base layer continues regardless. The machine does not
          manufacture rewards; it routes real ones.
        </p>
      </div>

      <div className="cols">
        <div className="panel">
          <h3 className="panelh">TIERS — COMMITMENT IS PRICED ABOVE SIZE</h3>
          <div className="tablescroll">
            <table>
              <thead>
                <tr>
                  <th>TIER</th>
                  <th>LOCK</th>
                  <th>BONUS WEIGHT</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map(([name, lock, weight]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{lock}</td>
                    <td>{weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="dim small">
            A participant with half the capital of another, who commits for 90 days, carries the same bonus weight.
            The pool itself is open to anyone — anyone may provide liquidity and earn the base layer. Only staking,
            and the bonus it earns, asks for an Agent ID.
          </p>
        </div>

        <div className="panel">
          <h3 className="panelh">FAIRNESS MECHANICS</h3>
          <ul className="rules">
            {FAIRNESS.map((r) => (
              <li key={r.slice(0, 24)}>{r}</li>
            ))}
          </ul>
          <p className="dim small">
            No owner, no admin, no upgrade path: the parameters above are fixed in the deployed contract, and staked
            LP tokens are returnable only to their staker.
          </p>
        </div>
      </div>

      <h3 className="panelh">ACT — THROUGH YOUR AGENT</h3>
      <CopyBlock
        title="GIVE THIS TO YOUR AGENT — AGENTLP (ALL ACTIONS)"
        text={stakeLpMasterPrompt()}
        note="One block, four sections — your agent runs only the section you name. Exact-amount approval is the rule throughout: never an unlimited allowance."
      />

      <div className="panel skillstrip">
        <span className="skillstrip-t">Full operating manual: the agent404 skill</span>
        <span className="agentlinks">
          <a href="https://agentic-404.github.io/agent404/llms.txt" target="_blank" rel="noopener noreferrer">
            llms.txt — live feature map
          </a>
          <a href="https://agentic-404.github.io/agent404/skill/SKILL.md" target="_blank" rel="noopener noreferrer">
            SKILL.md — the agent404 skill
          </a>
        </span>
      </div>
    </section>
  );
}
