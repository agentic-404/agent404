import React, { useState } from 'react';
import { rpcBatch, callReq } from '../rpc.js';
import { fmtInt, fmtToken, toBig, padArg } from '../format.js';
import { A, SEL } from '../config.js';
import { SectionHead, StatCard, CopyBlock } from '../components.jsx';
import { myPassPrompt } from '../prompts.js';
import badgeUrl from '../assets/a404-glitch-404.png';

export default function MyPass() {
  const [addr, setAddr] = useState('');
  const [status, setStatus] = useState('idle'); // idle | invalid | checking | error | done
  const [result, setResult] = useState(null); // { badges, agentIds, a404, claimedFree }

  async function check() {
    const a = addr.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) {
      setStatus('invalid');
      setResult(null);
      return;
    }
    setStatus('checking');
    setResult(null);
    const res = await rpcBatch([
      callReq(A.mirror, SEL.balanceOf + padArg(BigInt(a))),
      callReq(A.registry, SEL.balanceOf + padArg(BigInt(a))),
      callReq(A.token, SEL.balanceOf + padArg(BigInt(a))),
      callReq(A.claim, SEL.claimedBy + padArg(BigInt(a))),
    ]);
    const badges = toBig(res[0]);
    const agentIds = toBig(res[1]);
    const a404 = toBig(res[2]);
    const claimedRaw = toBig(res[3]);
    if (badges === null || agentIds === null || a404 === null) {
      setStatus('error');
      return;
    }
    setResult({ badges, agentIds, a404, claimedFree: claimedRaw !== null && claimedRaw > 0n });
    setStatus('done');
  }

  const holder = result && result.badges > 0n && result.agentIds > 0n;
  const idOnly = result && result.agentIds > 0n && result.badges === 0n;

  return (
    <section className="sec first">
      <SectionHead
        title={
          <span className="tokhead">
            <img className="toklogo" src={badgeUrl} alt="AGENT404" />
            <span className="mkt-title">MY PASS</span>
          </span>
        }
        right={<>READ-ONLY · NO WALLET CONNECTION</>}
      />
      <p className="lede">
        Your whole AGENT404 position at a glance — paste a wallet address and read it straight from the chain:
        Agent ID, badges and token balance. Nothing is signed, nothing moves.
      </p>

      <div className="panel">
        <div className="fstepn">YOUR WALLET ADDRESS</div>
        <div className="eligrow">
          <input
            type="text"
            spellCheck="false"
            placeholder="0x… wallet address"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') check();
            }}
          />
          <button type="button" className="btn solid" onClick={check} disabled={status === 'checking'}>
            {status === 'checking' ? 'READING…' : 'CHECK'}
          </button>
        </div>
        {status === 'invalid' ? <p className="dim">That does not look like a wallet address.</p> : null}
        {status === 'error' ? <p className="dim">Could not read the chain just now — try again.</p> : null}

        {status === 'done' && result ? (
          <>
            <div className={`eligverdict ${holder ? 'ok' : 'no'}`} style={{ marginTop: 14 }}>
              <div className="eligword">
                {holder ? '✓ PASS HOLDER' : idOnly ? 'AGENT ID — NO BADGE YET' : 'NO AGENT ID FOUND'}
              </div>
              <div className="eliglab">
                {holder
                  ? 'The gate is open: this wallet holds the key to every badge-gated machine.'
                  : idOnly
                    ? 'This wallet can hold badges — it just does not hold one yet. The Badge Market is the open door; the paid claim closed on Mon 9 Nov 2026.'
                    : 'Badges only materialize in wallets holding a Binance Agent ID. Get the Agent ID first — it is minted inside the Binance app.'}
              </div>
            </div>

            <div className="grid grid4" style={{ marginTop: 14 }}>
              <StatCard glyph="⬢" accent="amber" label="AGENT ID" big={result.agentIds > 0n ? 'HELD' : 'NONE'} sub="Binance Agent ID registry" />
              <StatCard glyph="▦" accent="amber" label="BADGES" big={fmtInt(Number(result.badges))} sub="PASS badges in this wallet" />
              <StatCard glyph="Σ" accent="amber" label="$A404 BALANCE" big={fmtToken(result.a404)} sub="whole tokens mirror badges" />
            </div>

            <div className="statusrows">
              <div className="buyline">
                <span>FREE CLAIM</span>
                <b>{result.claimedFree ? 'CLAIMED ✓ — lane closed at 1,001/1,001' : 'NOT CLAIMED — the free lane is closed'}</b>
              </div>
            </div>

            <div className="keycta" style={{ marginTop: 12 }}>
              {holder ? (
                <>
                  <a className="btn" href="#/stakelp">
                    STAKELP
                  </a>
                </>
              ) : idOnly ? (
                <>
                  <a className="btn solid" href="#/market">
                    BADGE MARKET →
                  </a>{' '}
                  <a className="btn" href="#/token">
                    THE TOKEN — PHASE 1 IS COMPLETE
                  </a>
                </>
              ) : (
                <a className="btn solid" href="#/docs">
                  HOW THE PASS WORKS →
                </a>
              )}
            </div>

            <CopyBlock
              title="GIVE THIS TO YOUR AGENT — CHECK MY POSITION ANYTIME"
              text={myPassPrompt(addr.trim())}
              note="The same read, run by your own agent — handy before any claim, ticket or trade."
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
