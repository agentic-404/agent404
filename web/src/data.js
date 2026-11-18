// Data orchestration — every read is ported from the live site
// (site/index.html): same selectors, same event topics, same chunked log
// scans, same decoders, same graceful fallbacks. Datasets are stores with
// stale-while-revalidate polling; immutable event history is persisted in
// IndexedDB and synced incrementally from the last stored block.

import { A, SEL, TOPIC, MKT_TOPICS, PD_TOPIC, MINE_DEPLOY_BLOCK, FUN_GRADUATION_WEI, LP_TOPIC, LP_TOPICS, LP_ACTOR_TOPICS, LAUNCHPAD_DEPLOY_BLOCK, DP_TOPIC, DAILYPOOL_DEPLOY_BLOCK, PR_TOPIC, PREDICT_DEPLOY_BLOCK, BT_TOPIC, BOUNTY_DEPLOY_BLOCK, BOUNTY_API } from './config.js';
import { rpcBatch, rpcTryAll, callReq, ethBlockNumber } from './rpc.js';
import { toBig, padArg, hex } from './format.js';
import { createStore, ensurePoller } from './store.js';
import { idbGetEvents, idbPutEvents, idbGetMeta, idbPutMeta } from './idb.js';

/* ================= shared log fetching (ported) ================= */

export function waitMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function logsOnce(addr, topic, from, to) {
  return rpcTryAll('eth_getLogs', [{ address: addr, fromBlock: hex(from), toBlock: hex(to), topics: [topic] }]);
}

export function fetchLogsChunked(addr, topic, from, to) {
  return logsOnce(addr, topic, from, to).then((res) => {
    if (Array.isArray(res)) return res;
    if (to - from > 1000) {
      const mid = from + Math.floor((to - from) / 2);
      return fetchLogsChunked(addr, topic, from, mid).then((left) =>
        fetchLogsChunked(addr, topic, mid + 1, to).then((right) => {
          if (left === null || right === null) return null;
          return left.concat(right);
        }),
      );
    }
    return null;
  });
}

function logsMultiOnce(from, to) {
  return rpcTryAll('eth_getLogs', [{ address: A.market, fromBlock: hex(from), toBlock: hex(to), topics: [MKT_TOPICS] }]);
}

export function fetchMktChunked(from, to) {
  return logsMultiOnce(from, to).then((res) => {
    if (Array.isArray(res)) return res;
    if (to - from > 1000) {
      const mid = from + Math.floor((to - from) / 2);
      return fetchMktChunked(from, mid).then((left) =>
        fetchMktChunked(mid + 1, to).then((right) => {
          if (left === null || right === null) return null;
          return left.concat(right);
        }),
      );
    }
    return waitMs(1500)
      .then(() => logsMultiOnce(from, to))
      .then((res2) => (Array.isArray(res2) ? res2 : null));
  });
}

/* ================= decoders (ported) ================= */

export function decodeListings(hexStr) {
  if (typeof hexStr !== 'string' || hexStr.length < 2 + 128) return null;
  try {
    const clean = hexStr.slice(2);
    const offIds = Number(BigInt(`0x${clean.slice(0, 64)}`)) * 2;
    const offPr = Number(BigInt(`0x${clean.slice(64, 128)}`)) * 2;
    const n = Number(BigInt(`0x${clean.slice(offIds, offIds + 64)}`));
    if (n < 0 || n > 1000) return null;
    const out = [];
    for (let i = 0; i < n; i++) {
      const id = BigInt(`0x${clean.slice(offIds + 64 + i * 64, offIds + 128 + i * 64)}`);
      const pr = BigInt(`0x${clean.slice(offPr + 64 + i * 64, offPr + 128 + i * 64)}`);
      out.push({ id, price: pr });
    }
    return out;
  } catch {
    return null;
  }
}

function wordAt(hexStr, i) {
  return hexStr.slice(2 + i * 64, 2 + (i + 1) * 64);
}
function addrWord(w) {
  return `0x${w.slice(24)}`;
}
export function decodeStr(hexStr) {
  try {
    const clean = hexStr.slice(2);
    if (clean.length < 128) return '';
    const off = Number(BigInt(`0x${clean.slice(0, 64)}`)) * 2;
    const len = Number(BigInt(`0x${clean.slice(off, off + 64)}`));
    if (len < 0 || len > 200) return '';
    const bytesHex = clean.slice(off + 64, off + 64 + len * 2);
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = parseInt(bytesHex.slice(i * 2, i * 2 + 2), 16);
    return new TextDecoder().decode(bytes).replace(/[^ -~]/g, '').trim();
  } catch {
    return '';
  }
}

/* ================= counters ================= */

export const countersStore = createStore(null);

async function fetchCounters() {
  const reqs = [
    callReq(A.claim, SEL.claims), // 0 free claims
    callReq(A.sale, SEL.sales), // 1 paid sales
    callReq(A.mirror, SEL.totalSupply), // 2 badges in circulation
    callReq(A.token, SEL.totalSupply), // 3 token supply
    callReq(A.market, SEL.activeCount), // 4 listings
    callReq(A.market, SEL.floorPrice), // 5 floor
    callReq(A.market, SEL.totalSales), // 6 market sales
    callReq(A.funV1, SEL.totalLaunches), // 7
    callReq(A.funV1, SEL.totalFees), // 8
    callReq(A.funV1, SEL.totalBurned), // 9
    callReq(A.funV2, SEL.totalLaunches), // 10
    callReq(A.funV2, SEL.totalFees), // 11
    callReq(A.funV2, SEL.totalBurned), // 12
    callReq(A.token, SEL.balanceOf + padArg(BigInt(A.dead))), // 13 DEAD balance (burned tally)
    { method: 'eth_blockNumber', params: [] }, // 14
    callReq(A.market, SEL.totalVolume), // 15 market volume
  ];
  const r = await rpcBatch(reqs);
  const prev = countersStore.get().data || {};
  const pick = (i, key) => {
    const v = toBig(r[i]);
    return v !== null ? v : prev[key] ?? null;
  };
  const data = {
    free: pick(0, 'free'),
    paid: pick(1, 'paid'),
    badges: pick(2, 'badges'),
    supply: pick(3, 'supply'),
    mktListings: pick(4, 'mktListings'),
    mktFloor: pick(5, 'mktFloor'),
    mktSales: pick(6, 'mktSales'),
    funL1: pick(7, 'funL1'),
    funF1: pick(8, 'funF1'),
    funB1: pick(9, 'funB1'),
    funL2: pick(10, 'funL2'),
    funF2: pick(11, 'funF2'),
    funB2: pick(12, 'funB2'),
    deadBalance: pick(13, 'deadBalance'),
    block: pick(14, 'block'),
    mktVolume: pick(15, 'mktVolume'),
  };
  if (Object.values(data).every((v) => v === null)) return null;
  // Side-effect: launch list refresh when the total changes.
  const total = data.funL1 !== null && data.funL2 !== null ? Number(data.funL1) + Number(data.funL2) : null;
  if (total !== null && total > 0 && total !== lastLaunchTotal) {
    lastLaunchTotal = total;
    refreshLaunches(total);
  }
  return { data };
}

export function startCounters() {
  ensurePoller('counters', countersStore, fetchCounters, 15000);
}

/* ================= market listings (activeListings) ================= */

export const listingsStore = createStore(null);

async function fetchListings() {
  // Paginate the full active set (200 per call): the market can hold far
  // more listings than one page, and the floor lives wherever it lives.
  const PAGE = 200;
  const byId = new Map();
  for (let off = 0; off < 2000; off += PAGE) {
    const r = await rpcBatch([callReq(A.market, SEL.activeListings + padArg(off) + padArg(PAGE))]);
    const page = decodeListings(r[0]);
    if (!page) {
      if (off === 0) return null;
      break;
    }
    for (const rw of page) byId.set(rw.id.toString(), rw);
    if (page.length < PAGE) break;
  }
  const rows = [...byId.values()];
  rows.sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0));
  return { data: rows };
}

export function startListings() {
  ensurePoller('listings', listingsStore, fetchListings, 45000);
}

/* ================= AgentFun launches ================= */

export const launchesStore = createStore(null);
let lastLaunchTotal = null;
let launchesLoadedFor = -1;

export async function refreshLaunches(total) {
  if (total === launchesLoadedFor) return;
  launchesLoadedFor = total;
  try {
    const cnt = await rpcBatch([callReq(A.funV2, SEL.launchesCount), callReq(A.funV1, SEL.launchesCount)]);
    const jobs = [];
    const addJobs = (factory, addr, count) => {
      if (count === null) return;
      const n = Number(count);
      for (let i = n - 1; i >= 0 && jobs.length < 8; i--) jobs.push({ factory, addr, idx: i });
    };
    addJobs('V2', A.funV2, toBig(cnt[0]));
    addJobs('V1', A.funV1, toBig(cnt[1]));
    if (!jobs.length) return;
    const rows = await rpcBatch(jobs.map((j) => callReq(j.addr, SEL.launchAt + padArg(j.idx))));
    const entries = [];
    rows.forEach((hx, k) => {
      if (typeof hx !== 'string' || hx.length < 2 + 5 * 64) return;
      entries.push({
        factory: jobs[k].factory,
        creator: addrWord(wordAt(hx, 0)),
        token: addrWord(wordAt(hx, 1)),
        mirror: addrWord(wordAt(hx, 2)),
        curve: addrWord(wordAt(hx, 3)),
        ts: Number(BigInt(`0x${wordAt(hx, 4)}`)),
      });
    });
    if (!entries.length) return;
    entries.sort((x, y) => y.ts - x.ts);
    const top = entries.slice(0, 6);
    const metaReqs = [];
    top.forEach((e) => {
      metaReqs.push(callReq(e.token, SEL.name));
      metaReqs.push(callReq(e.token, SEL.symbol));
    });
    const meta = await rpcBatch(metaReqs);
    top.forEach((e, k) => {
      e.name = meta[k * 2] ? decodeStr(meta[k * 2]) : '';
      e.symbol = meta[k * 2 + 1] ? decodeStr(meta[k * 2 + 1]) : '';
    });
    // Curve state — V2 launches only. V1 launches have no curve contract
    // (word 3 of a V1 launchAt row is the launch supply, not an address),
    // so their curve fields stay null and their cards render no bar/chip.
    // Every field is independently null-safe: a failed read leaves that
    // field null, never a fabricated number.
    const curveIdx = [];
    top.forEach((e, k) => {
      e.netIntake = null;
      e.progress = null;
      e.graduated = null;
      e.price = null;
      if (e.factory === 'V2' && e.curve && !/^0x0{40}$/.test(e.curve)) curveIdx.push(k);
    });
    if (curveIdx.length) {
      const curveReqs = [];
      curveIdx.forEach((k) => {
        curveReqs.push(callReq(top[k].curve, SEL.curveRealBnb));
        curveReqs.push(callReq(top[k].curve, SEL.curveGraduated));
        curveReqs.push(callReq(top[k].curve, SEL.curveSpotPrice));
      });
      const cres = await rpcBatch(curveReqs);
      curveIdx.forEach((k, j) => {
        const e = top[k];
        const real = toBig(cres[j * 3]);
        const grad = toBig(cres[j * 3 + 1]);
        const spot = toBig(cres[j * 3 + 2]);
        if (grad !== null) e.graduated = grad === 1n;
        if (spot !== null) e.price = spot;
        if (e.graduated) {
          // realBnbCollected is swept into the pair at graduation and
          // reads 0 afterwards; a graduated curve has by construction
          // taken in the full graduation threshold.
          e.netIntake = FUN_GRADUATION_WEI;
          e.progress = 1;
        } else if (real !== null) {
          e.netIntake = real;
          e.progress = Math.min(1, Number(real) / Number(FUN_GRADUATION_WEI));
        }
      });
    }
    launchesStore.set({ data: top, updatedAt: Date.now(), stale: false, loaded: true });
  } catch {
    /* keep last good list */
  }
}

/* ================= block timestamps (shared) ================= */

const blockTs = new Map();

export async function fillBlockTs(blocks) {
  const need = [...new Set(blocks)].filter((b) => !blockTs.has(b)).slice(0, 60);
  if (!need.length) return blockTs;
  const res = await rpcBatch(need.map((b) => ({ method: 'eth_getBlockByNumber', params: [hex(b), false] })));
  need.forEach((b, i) => {
    if (res[i] && res[i].timestamp) blockTs.set(b, parseInt(res[i].timestamp, 16));
  });
  return blockTs;
}

export function tsOfBlock(block, latestBlock, latestTs) {
  if (blockTs.has(block)) return blockTs.get(block);
  return latestTs - Math.round((latestBlock - block) * 0.45);
}

/* ================= newest pass holders (claims feed, IDB-backed) ================= */

export const feedStore = createStore(null);
let feedTop = null;
let feedHydrated = false;

function parseClaimLog(l, lane) {
  try {
    return {
      key: `${l.transactionHash}:${l.logIndex}`,
      stream: 'claims',
      lane,
      who: `0x${l.topics[1].slice(26)}`,
      amount: BigInt(`0x${l.data.slice(2, 66)}`).toString(),
      block: parseInt(l.blockNumber, 16),
      idx: parseInt(l.logIndex, 16),
      tx: l.transactionHash,
    };
  } catch {
    return null;
  }
}

function sortFeed(events) {
  return [...events]
    .sort((x, y) => y.block - x.block || y.idx - x.idx)
    .slice(0, 12);
}

async function hydrateFeed() {
  if (feedHydrated) return;
  feedHydrated = true;
  const [stored, meta] = await Promise.all([idbGetEvents('claims'), idbGetMeta('claimsTop')]);
  if (stored && stored.length) {
    feedStore.set({ data: sortFeed(stored), loaded: true, updatedAt: Date.now(), stale: true });
  }
  if (meta && typeof meta.block === 'number') feedTop = meta.block;
}

async function feedScanInitial(latest) {
  let to = latest;
  let found = [];
  let rounds = 0;
  while (to > 0 && found.length < 6 && rounds < 10) {
    const from = Math.max(0, to - 49999);
    rounds++;
    const [a, b] = await Promise.all([
      fetchLogsChunked(A.claim, TOPIC.claimed, from, to),
      fetchLogsChunked(A.sale, TOPIC.bought, from, to),
    ]);
    if (a === null && b === null) {
      if (rounds === 1) return false;
      break;
    }
    if (a) found = found.concat(a.map((l) => parseClaimLog(l, 'FREE')).filter(Boolean));
    if (b) found = found.concat(b.map((l) => parseClaimLog(l, 'PAID')).filter(Boolean));
    to = from - 1;
  }
  if (found.length) await idbPutEvents(found);
  feedTop = latest;
  await idbPutMeta('claimsTop', { block: latest });
  const cur = feedStore.get().data || [];
  feedStore.set({ data: sortFeed([...cur, ...found]), loaded: true, updatedAt: Date.now(), stale: false });
  return true;
}

async function fetchFeed() {
  await hydrateFeed();
  const latestHex = await rpcTryAll('eth_blockNumber', []);
  if (!latestHex) return feedStore.get().loaded ? { data: feedStore.get().data } : null;
  const latest = parseInt(latestHex, 16);
  if (feedTop === null) {
    const ok = await feedScanInitial(latest);
    if (!ok && !feedStore.get().loaded) {
      feedStore.set({ data: [], loaded: true, updatedAt: Date.now(), stale: true });
      return { data: [] };
    }
    return { data: feedStore.get().data };
  }
  if (latest > feedTop) {
    const from = feedTop + 1;
    const [a, b] = await Promise.all([
      fetchLogsChunked(A.claim, TOPIC.claimed, from, latest),
      fetchLogsChunked(A.sale, TOPIC.bought, from, latest),
    ]);
    const fresh = [];
    if (a) fresh.push(...a.map((l) => parseClaimLog(l, 'FREE')).filter(Boolean));
    if (b) fresh.push(...b.map((l) => parseClaimLog(l, 'PAID')).filter(Boolean));
    if (a !== null || b !== null) {
      if (fresh.length) await idbPutEvents(fresh);
      feedTop = latest;
      await idbPutMeta('claimsTop', { block: latest });
    }
    if (fresh.length) {
      const cur = feedStore.get().data || [];
      return { data: sortFeed([...cur, ...fresh]) };
    }
  }
  return { data: feedStore.get().data };
}

export function startFeed() {
  ensurePoller('feed', feedStore, fetchFeed, 60000);
}

/* ================= market events (floor history, IDB-backed) ================= */

export const marketStore = createStore(null);
let mktTop = null;
let mktHydrated = false;
let mktHistoryComplete = false;

function parseMktLog(l) {
  const t0 = (l.topics[0] || '').toLowerCase();
  let kind = null;
  if (t0 === TOPIC.listed) kind = 'list';
  else if (t0 === TOPIC.price) kind = 'price';
  else if (t0 === TOPIC.cancel || t0 === TOPIC.cleaned) kind = 'gone';
  else if (t0 === TOPIC.sold) kind = 'sold';
  if (!kind || !l.topics[1]) return null;
  let id;
  let price = null;
  try {
    id = BigInt(`0x${l.topics[1].slice(2)}`).toString();
  } catch {
    return null;
  }
  if (kind !== 'gone') {
    try {
      price = BigInt(`0x${l.data.slice(2, 66)}`).toString();
    } catch {
      return null;
    }
  }
  const ev = {
    key: `${l.transactionHash}:${l.logIndex}`,
    stream: 'market',
    kind,
    id,
    price,
    block: parseInt(l.blockNumber, 16),
    idx: parseInt(l.logIndex, 16),
  };
  if (kind === 'sold' && l.topics[2] && l.topics[3]) {
    ev.seller = `0x${l.topics[2].slice(-40)}`;
    ev.buyer = `0x${l.topics[3].slice(-40)}`;
  }
  return ev;
}

function sortMkt(events) {
  return [...events].sort((x, y) => x.block - y.block || x.idx - y.idx);
}

async function hydrateMarket() {
  if (mktHydrated) return;
  mktHydrated = true;
  const [stored, meta] = await Promise.all([idbGetEvents('market'), idbGetMeta('marketTop')]);
  if (stored && stored.length) {
    // Sold events stored before seller/buyer capture lack the flow fields;
    // drop them and let the initial scan re-fetch them healed.
    const usable = stored.filter((e) => e.kind !== 'sold' || e.buyer);
    marketStore.set({ data: sortMkt(usable), loaded: true, updatedAt: Date.now(), stale: true });
    if (usable.length === stored.length) mktHistoryComplete = true;
  }
  if (meta && typeof meta.block === 'number') mktTop = meta.block;
}

async function mktScanInitial(latest) {
  let to = latest;
  let rounds = 0;
  let foundAny = false;
  let emptyAfterFound = 0;
  let clean = true;
  const collected = [];
  while (to > 0 && rounds < 20 && emptyAfterFound < 1) {
    const from = Math.max(0, to - 49999);
    rounds++;
    const res = await fetchMktChunked(from, to);
    if (res === null) clean = false;
    else if (res.length) {
      foundAny = true;
      collected.push(...res.map(parseMktLog).filter(Boolean));
    } else if (foundAny) emptyAfterFound++;
    to = from - 1;
    if (to > 0 && rounds < 20 && emptyAfterFound < 1) await waitMs(700);
  }
  if (collected.length) await idbPutEvents(collected);
  mktTop = latest;
  await idbPutMeta('marketTop', { block: latest });
  if (clean) mktHistoryComplete = true;
  const cur = marketStore.get().data || [];
  const merged = sortMkt([...cur, ...collected].filter((e, i, arr) => arr.findIndex((x) => x.key === e.key) === i));
  marketStore.set({ data: merged, loaded: true, updatedAt: Date.now(), stale: false });
  return clean;
}

async function fetchMarket() {
  await hydrateMarket();
  const latestHex = await rpcTryAll('eth_blockNumber', []);
  if (!latestHex) return marketStore.get().loaded ? { data: marketStore.get().data } : null;
  const latest = parseInt(latestHex, 16);
  if (mktTop === null || !mktHistoryComplete) {
    await mktScanInitial(latest);
    return { data: marketStore.get().data };
  }
  if (latest > mktTop) {
    const res = await fetchMktChunked(mktTop + 1, latest);
    if (res !== null) {
      const fresh = res.map(parseMktLog).filter(Boolean);
      if (fresh.length) await idbPutEvents(fresh);
      mktTop = latest;
      await idbPutMeta('marketTop', { block: latest });
      if (fresh.length) {
        const cur = marketStore.get().data || [];
        return { data: sortMkt([...cur, ...fresh]) };
      }
    }
  }
  return { data: marketStore.get().data };
}

export function startMarket() {
  // Delay the heavy history scan slightly, like the live site does.
  setTimeout(() => ensurePoller('market', marketStore, fetchMarket, 60000), 4000);
}

/** Replay market events into the floor time series + sales marks (ported). */
export function marketSeries(events) {
  const active = {};
  const pts = [];
  const sales = [];
  for (const e of events || []) {
    if (e.kind === 'list' || e.kind === 'price') active[e.id] = BigInt(e.price);
    else if (e.kind === 'gone') delete active[e.id];
    else if (e.kind === 'sold') {
      sales.push({ block: e.block, price: BigInt(e.price) });
      delete active[e.id];
    }
    let floor = null;
    for (const k in active) if (floor === null || active[k] < floor) floor = active[k];
    pts.push({ block: e.block, floor });
  }
  return { pts, sales };
}

/* ================= badge owners (Badge Wall) ================= */

export const badgesStore = createStore({ owners: {}, windowSize: 40 });
let badgeBusy = false;

export async function refreshBadges() {
  if (badgeBusy) return;
  badgeBusy = true;
  try {
    const total = countersStore.get().data?.badges;
    const listings = listingsStore.get().data || [];
    if (total === null || total === undefined || total <= 0n) return;
    const hi = Number(total);
    const cur = badgesStore.get().data;
    const need = new Set();
    for (const rw of listings) {
      const id = Number(rw.id);
      if (!(id in cur.owners)) need.add(id);
    }
    const size = cur.windowSize;
    for (let id = hi; id >= Math.max(1, hi - size + 1); id--) {
      if (!(id in cur.owners)) need.add(id);
    }
    if (!need.size) return;
    const ids = [...need].slice(0, 160);
    const res = await rpcBatch(ids.map((id) => callReq(A.mirror, SEL.ownerOf + padArg(id))));
    const owners = { ...cur.owners };
    ids.forEach((id, i) => {
      const hx = res[i];
      if (typeof hx === 'string' && hx.length >= 42) {
        const owner = `0x${hx.slice(-40)}`;
        if (!/^0x0{40}$/.test(owner)) owners[id] = owner;
      }
    });
    badgesStore.set({ data: { ...badgesStore.get().data, owners }, updatedAt: Date.now(), stale: false, loaded: true });
  } catch {
    /* keep last good owners */
  } finally {
    badgeBusy = false;
  }
}

export function startBadges() {
  ensurePoller('badges', badgesStore, refreshBadges, 60000);
}

export function extendBadgeWindow() {
  const cur = badgesStore.get().data;
  badgesStore.set({ data: { ...cur, windowSize: cur.windowSize + 40 } });
  refreshBadges();
}

/* ================= token burn accounting ================= */

export const burnStore = createStore(null);

async function fetchBurn() {
  const c = countersStore.get().data;
  if (!c) return null;
  const funBurned = c.funB1 !== null && c.funB2 !== null ? c.funB1 + c.funB2 : null;
  return { data: { deadBalance: c.deadBalance, funBurned } };
}

export function startBurn() {
  ensurePoller('burn', burnStore, fetchBurn, 30000);
}

/* ================= AgentLP machine state ================= */

export const agentlpStore = createStore(null);

function decodeReserves(hexStr) {
  if (typeof hexStr !== 'string' || hexStr.length < 2 + 128) return null;
  try {
    // Pair token0 is A404 (0xB7E2… sorts below WBNB 0xbb4C…): reserve0 = A404 side.
    return {
      reserveA404: BigInt(`0x${hexStr.slice(2, 66)}`),
      reserveWBNB: BigInt(`0x${hexStr.slice(66, 130)}`),
    };
  } catch {
    return null;
  }
}

async function fetchAgentLP() {
  const r = await rpcBatch([
    callReq(A.agentlp, SEL.totalCountedWeight), // 0
    callReq(A.agentlp, SEL.parkedBonus), // 1
    callReq(A.agentlp, SEL.currentStreamRate), // 2
    callReq(A.pair, SEL.getReserves), // 3
  ]);
  const prev = agentlpStore.get().data || {};
  const pick = (i, key) => {
    const v = toBig(r[i]);
    return v !== null ? v : prev[key] ?? null;
  };
  const reserves = decodeReserves(r[3]);
  const data = {
    totalWeight: pick(0, 'totalWeight'),
    parked: pick(1, 'parked'),
    streamRate: pick(2, 'streamRate'),
    reserveA404: reserves ? reserves.reserveA404 : prev.reserveA404 ?? null,
    reserveWBNB: reserves ? reserves.reserveWBNB : prev.reserveWBNB ?? null,
  };
  if (Object.values(data).every((v) => v === null)) return null;
  return { data };
}

export function startAgentLP() {
  ensurePoller('agentlp', agentlpStore, fetchAgentLP, 30000);
}

/* ================= MUSE featured ad (Home carousel) ================= */
// Live reads for the MUSE slide on Home: MUSE/WBNB pair reserves (price)
// plus the dead-address LP share (burned %), same batched reads as AgentLP.

export const museAdStore = createStore(null);

function decodeMuseReserves(hexStr) {
  if (typeof hexStr !== 'string' || hexStr.length < 2 + 128) return null;
  try {
    // Pair token0 is MUSE (0x95BB… sorts below WBNB 0xbb4C…): reserve0 = MUSE side.
    return {
      reserveMuse: BigInt(`0x${hexStr.slice(2, 66)}`),
      reserveWBNB: BigInt(`0x${hexStr.slice(66, 130)}`),
    };
  } catch {
    return null;
  }
}

async function fetchMuseAd() {
  const r = await rpcBatch([
    callReq(A.musePair, SEL.getReserves), // 0
    callReq(A.musePair, SEL.balanceOf + padArg(A.dead)), // 1 — LP at dead
    callReq(A.musePair, SEL.totalSupply), // 2
  ]);
  const prev = museAdStore.get().data || {};
  const reserves = decodeMuseReserves(r[0]);
  const deadLp = toBig(r[1]);
  const totalLp = toBig(r[2]);
  const data = {
    reserveMuse: reserves ? reserves.reserveMuse : prev.reserveMuse ?? null,
    reserveWBNB: reserves ? reserves.reserveWBNB : prev.reserveWBNB ?? null,
    deadLp: deadLp !== null ? deadLp : prev.deadLp ?? null,
    totalLp: totalLp !== null ? totalLp : prev.totalLp ?? null,
  };
  if (Object.values(data).every((v) => v === null)) return null;
  return { data };
}

export function startMuseAd() {
  ensurePoller('musead', museAdStore, fetchMuseAd, 30000);
}

/* ================= MUSE/A404 pair ad (Home carousel slide 2) ================= */
// Live reads for the pair slide: MUSE/A404 pair reserves (price in A404)
// plus the dead-address LP share (burned %), same batched reads as the MUSE slide.

export const pairAdStore = createStore(null);

function decodePairReserves(hexStr) {
  if (typeof hexStr !== 'string' || hexStr.length < 2 + 128) return null;
  try {
    // Pair token0 is MUSE (0x95BB… sorts below A404 0xB7E2…): reserve0 = MUSE side.
    return {
      reserveMuse: BigInt(`0x${hexStr.slice(2, 66)}`),
      reserveA404: BigInt(`0x${hexStr.slice(66, 130)}`),
    };
  } catch {
    return null;
  }
}

async function fetchPairAd() {
  const r = await rpcBatch([
    callReq(A.museA404Pair, SEL.getReserves), // 0
    callReq(A.museA404Pair, SEL.balanceOf + padArg(A.dead)), // 1 — LP at dead
    callReq(A.museA404Pair, SEL.totalSupply), // 2
  ]);
  const prev = pairAdStore.get().data || {};
  const reserves = decodePairReserves(r[0]);
  const deadLp = toBig(r[1]);
  const totalLp = toBig(r[2]);
  const data = {
    reserveMuse: reserves ? reserves.reserveMuse : prev.reserveMuse ?? null,
    reserveA404: reserves ? reserves.reserveA404 : prev.reserveA404 ?? null,
    deadLp: deadLp !== null ? deadLp : prev.deadLp ?? null,
    totalLp: totalLp !== null ? totalLp : prev.totalLp ?? null,
  };
  if (Object.values(data).every((v) => v === null)) return null;
  return { data };
}

export function startPairAd() {
  ensurePoller('pairad', pairAdStore, fetchPairAd, 30000);
}

function decodeAddrWord(hexStr) {
  if (typeof hexStr !== 'string' || hexStr.length < 42) return null;
  const a = `0x${hexStr.slice(-40)}`;
  return /^0x0{40}$/i.test(a) ? null : a; // the zero address reads as "not set"
}

function pdWord(l, i) {
  try {
    return BigInt(`0x${l.data.slice(2 + i * 64, 2 + (i + 1) * 64)}`).toString();
  } catch {
    return null;
  }
}

/* ================= AGENTS MINE engine state (Agent404Engine) ================= */

export const mineStore = createStore(null);

async function fetchMine() {
  // No engine address configured yet: make no reads at all — the store
  // never loads and the Mine page renders its preparation board.
  if (!A.mine) return null;
  const E = A.mine;
  const r = await rpcBatch([
    callReq(E, SEL.mineActivated), // 0
    callReq(E, SEL.mineIgnited), // 1
    callReq(E, SEL.mineChargeEnd), // 2
    callReq(E, SEL.mineCurrentRate), // 3
    callReq(E, SEL.mineLpReserve), // 4
    callReq(E, SEL.mineRewardReserve), // 5
    callReq(E, SEL.mineTailReserve), // 6
    callReq(E, SEL.mineRewardsOutstanding), // 7
    callReq(E, SEL.mineTotalShares), // 8
    callReq(E, SEL.mineTotalAShares), // 9
    callReq(E, SEL.mineTotalBShares), // 10
    callReq(E, SEL.minePolBNB), // 11
    callReq(E, SEL.mineCoverageBps), // 12
    callReq(E, SEL.mineLiquidFracBps), // 13
    { method: 'eth_getBalance', params: [E, 'latest'] }, // 14 — engine BNB balance
    callReq(E, SEL.mineTargetShares), // 15 — listing event target
    callReq(E, SEL.mineCompleted), // 16 — listing event completed flag
    callReq(A.token, SEL.balanceOf + padArg(BigInt(E))), // 17 — engine A404 balance (claims drain it)
  ]);
  const prev = mineStore.get().data || {};
  const pick = (i, key) => {
    const v = toBig(r[i]);
    return v !== null ? v : prev[key] ?? null;
  };
  const flag = (i, key) => {
    const v = pick(i, key);
    return v === null ? null : v !== 0n;
  };
  const data = {
    activated: flag(0, 'activated'),
    ignited: flag(1, 'ignited'),
    chargeEnd: pick(2, 'chargeEnd'),
    rewardPerShare: pick(3, 'rewardPerShare'),
    lpReserve: pick(4, 'lpReserve'),
    rewardReserve: pick(5, 'rewardReserve'),
    tailReserve: pick(6, 'tailReserve'),
    rewardsOutstanding: pick(7, 'rewardsOutstanding'),
    totalShares: pick(8, 'totalShares'),
    totalAShares: pick(9, 'totalAShares'),
    totalBShares: pick(10, 'totalBShares'),
    polBNB: pick(11, 'polBNB'),
    coverageBps: pick(12, 'coverageBps'),
    liquidFracBps: pick(13, 'liquidFracBps'),
    bnbBalance: pick(14, 'bnbBalance'),
    targetShares: pick(15, 'targetShares'),
    completed: flag(16, 'completed'),
    engineA404: pick(17, 'engineA404'),
  };
  if (Object.values(data).every((v) => v === null)) return null;
  return { data };
}

export function startMine() {
  ensurePoller('mine', mineStore, fetchMine, 30000);
}

/* ================= AGENTS MINE latest shares (deposit events) ================= */

export const mineFeedStore = createStore(null);
const mineBlockTs = new Map();

async function mineTs(block) {
  if (mineBlockTs.has(block)) return mineBlockTs.get(block);
  const b = await rpcTryAll('eth_getBlockByNumber', [`0x${block.toString(16)}`, false]);
  const ts = b && b.timestamp ? parseInt(b.timestamp, 16) : null;
  if (ts) mineBlockTs.set(block, ts);
  return ts;
}

async function fetchMineFeed() {
  if (!A.mine || !MINE_DEPLOY_BLOCK) return null;
  const latestHex = await rpcTryAll('eth_blockNumber', []);
  if (!latestHex) return null;
  const latest = parseInt(latestHex, 16);
  if (latest < MINE_DEPLOY_BLOCK) return { data: { items: [] } };
  const all = [];
  for (const [mode, topic] of [['A', PD_TOPIC.depositA], ['B', PD_TOPIC.depositB]]) {
    const logs = await fetchLogsChunked(A.mine, topic, MINE_DEPLOY_BLOCK, latest);
    if (logs === null) return null;
    for (const l of logs) {
      const shares = pdWord(l, 0);
      if (shares === null) continue;
      all.push({
        key: `${l.transactionHash}:${l.logIndex}`,
        mode,
        who: l.topics[1] ? `0x${l.topics[1].slice(26)}` : null,
        shares: BigInt(shares),
        block: parseInt(l.blockNumber, 16),
        idx: parseInt(l.logIndex, 16),
        tx: l.transactionHash,
        ts: null,
      });
    }
  }
  // Chronological walk: each deposit's ending cumulative index (its
  // share number on the tiles) and the exact Mode A / Mode B split of
  // the CURRENT tranche — a deposit straddling a halving boundary is
  // split share-by-share across the two tranches.
  all.sort((x, y) => x.block - y.block || x.idx - y.idx);
  let running = 0n;
  for (const it of all) {
    running += it.shares;
    it.endIndex = running;
  }
  const total = running;
  const trancheStart = total >= 6000n ? 6000n : (total / 1000n) * 1000n;
  let trancheA = 0n;
  let trancheB = 0n;
  let cursor = 0n;
  for (const it of all) {
    const start = cursor;
    cursor += it.shares;
    const lo = start > trancheStart ? start : trancheStart;
    const hi = cursor < trancheStart + 1000n ? cursor : trancheStart + 1000n;
    if (hi > lo) {
      if (it.mode === 'A') trancheA += hi - lo;
      else trancheB += hi - lo;
    }
  }
  const items = all.slice(-4).reverse();
  for (const it of items) it.ts = await mineTs(it.block);
  return { data: { items, trancheA, trancheB } };
}

export function startMineFeed() {
  ensurePoller('minefeed', mineFeedStore, fetchMineFeed, 30000);
}

/* ================= AGENT LAUNCHPAD board (factory registry) =================
 *
 * Discovery is the factory's own registry — launchesCount + launchAt —
 * never a log scan, so the board wakes up the moment A.launchpad is set
 * in config, with no dependence on a deploy-block constant (the block
 * still bounds the activity feed below). Token metadata (name, symbol,
 * and the image planted at birth) and per-launch engine state are read
 * in flat batches, in the same shape as the counters and Mine reads.
 */

export const launchpadStore = createStore(null);

const LP_MAX_LAUNCHES = 200;

/** decodeStr with a higher length cap — a planted imageURI can run to
 *  the factory's 256-byte bound, past decodeStr's 200-char guard. */
function decodeStrLong(hexStr) {
  try {
    const clean = hexStr.slice(2);
    if (clean.length < 128) return '';
    const off = Number(BigInt(`0x${clean.slice(0, 64)}`)) * 2;
    const len = Number(BigInt(`0x${clean.slice(off, off + 64)}`));
    if (len < 0 || len > 300) return '';
    const bytesHex = clean.slice(off + 64, off + 64 + len * 2);
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = parseInt(bytesHex.slice(i * 2, i * 2 + 2), 16);
    return new TextDecoder().decode(bytes).replace(/[^ -~]/g, '').trim();
  } catch {
    return '';
  }
}

async function fetchLaunchpad() {
  // No factory address configured yet: make no reads at all — the store
  // never loads and the Launchpad page renders its preparation board.
  if (!A.launchpad) return null;
  const F = A.launchpad;
  const cntRes = await rpcBatch([callReq(F, SEL.lpCount)]);
  const count = toBig(cntRes[0]);
  if (count === null) return null;
  const total = Number(count);
  const ids = [];
  for (let i = total - 1; i >= 0 && ids.length < LP_MAX_LAUNCHES; i--) ids.push(i);
  const prev = launchpadStore.get().data;
  const prevById = new Map(((prev && prev.launches) || []).map((l) => [l.id, l]));
  const launches = [];
  if (ids.length) {
    const recs = await rpcBatch(ids.map((i) => callReq(F, SEL.lpLaunchAt + padArg(i))));
    const base = [];
    recs.forEach((hx, k) => {
      if (typeof hx !== 'string' || hx.length < 2 + 6 * 64) return;
      base.push({
        id: ids[k],
        launcher: addrWord(wordAt(hx, 0)),
        token: addrWord(wordAt(hx, 1)),
        mirror: addrWord(wordAt(hx, 2)),
        engine: addrWord(wordAt(hx, 3)),
        vip: BigInt(`0x${wordAt(hx, 4)}`) !== 0n,
        createdAt: Number(BigInt(`0x${wordAt(hx, 5)}`)),
      });
    });
    const metaReqs = [];
    base.forEach((l) => {
      metaReqs.push(callReq(l.token, SEL.name));
      metaReqs.push(callReq(l.token, SEL.symbol));
      metaReqs.push(callReq(l.token, SEL.lpImageURI));
    });
    const meta = await rpcBatch(metaReqs);
    base.forEach((l, k) => {
      const p = prevById.get(l.id) || {};
      const nm = meta[k * 3] ? decodeStr(meta[k * 3]) : '';
      const sm = meta[k * 3 + 1] ? decodeStr(meta[k * 3 + 1]) : '';
      const im = meta[k * 3 + 2] ? decodeStrLong(meta[k * 3 + 2]) : '';
      l.name = nm || p.name || '';
      l.symbol = sm || p.symbol || '';
      l.imageURI = im || p.imageURI || '';
    });
    const stReqs = [];
    base.forEach((l) => {
      stReqs.push(callReq(l.engine, SEL.lpActivated)); // +0
      stReqs.push(callReq(l.engine, SEL.lpIgnited)); // +1
      stReqs.push(callReq(l.engine, SEL.lpCompleted)); // +2
      stReqs.push(callReq(l.engine, SEL.lpChargeEnd)); // +3
      stReqs.push(callReq(l.engine, SEL.lpTargetShares)); // +4
      stReqs.push(callReq(l.engine, SEL.lpTotalShares)); // +5
      stReqs.push(callReq(l.engine, SEL.lpTotalPaidIn)); // +6
      stReqs.push(callReq(l.engine, SEL.lpSharePrice)); // +7
      stReqs.push(callReq(l.engine, SEL.lpPair)); // +8
      stReqs.push(callReq(F, SEL.lpIsActive + padArg(l.id))); // +9
    });
    const st = await rpcBatch(stReqs);
    base.forEach((l, k) => {
      const p = prevById.get(l.id) || {};
      const pickB = (j, key) => {
        const v = toBig(st[k * 10 + j]);
        return v !== null ? v : p[key] ?? null;
      };
      const flag = (j, key) => {
        const v = pickB(j, key);
        return v === null ? null : v !== 0n;
      };
      l.activated = flag(0, 'activated');
      l.ignited = flag(1, 'ignited');
      l.completed = flag(2, 'completed');
      l.chargeEnd = pickB(3, 'chargeEnd');
      l.targetShares = pickB(4, 'targetShares');
      l.totalShares = pickB(5, 'totalShares');
      l.totalPaidIn = pickB(6, 'totalPaidIn');
      l.sharePrice = pickB(7, 'sharePrice');
      l.pair = typeof st[k * 10 + 8] === 'string' ? decodeAddrWord(st[k * 10 + 8]) : p.pair ?? null;
      l.active = flag(9, 'active');
      l.agents24h = p.agents24h ?? null;
    });
    launches.push(...base);
  }
  // The 24h ranking metric is best-effort: any failure inside it keeps
  // the previous per-launch values already carried onto the rows above.
  try {
    await lpMetric(launches);
  } catch {
    /* keep previous metric */
  }
  return { data: { launches, total } };
}

/* ---------- the 24h ranking metric (distinct Agent ID wallets) ----------
 *
 * One wallet = one vote per token, rolling 24 hours. Actors are the
 * user-indexed engine events of the launch (deposit / free slot /
 * claims) plus both ends of the token's Transfer logs (trades), minus
 * the zero address and the launch's own contracts; each distinct actor
 * is then checked against the Agent ID registry (balanceOf > 0),
 * batched and cached for 10 minutes.
 *
 * Pragmatic approximations, by design:
 * - The window is located by block count at BSC's ~0.45 s block time
 *   (192,000 blocks ≈ 24 h), then corrected once against the start
 *   block's real timestamp — the window edge can be off by minutes.
 * - Only the newest 25 launches are measured per cycle; older launches
 *   keep their last measured value (or render —).
 * - At most 400 distinct actors per launch are registry-checked.
 */
const lpAgentCache = new Map();
const LP_WINDOW_BLOCKS = 192000;
const LP_METRIC_MAX_LAUNCHES = 25;
const LP_METRIC_MAX_ACTORS = 400;

function lpLogsOnce(addresses, topics, from, to) {
  return rpcTryAll('eth_getLogs', [
    { address: addresses, fromBlock: hex(from), toBlock: hex(to), topics: [topics] },
  ]);
}

export function fetchLpLogs(addresses, topics, from, to) {
  return lpLogsOnce(addresses, topics, from, to).then((res) => {
    if (Array.isArray(res)) return res;
    if (to - from > 1000) {
      const mid = from + Math.floor((to - from) / 2);
      return fetchLpLogs(addresses, topics, from, mid).then((left) =>
        fetchLpLogs(addresses, topics, mid + 1, to).then((right) => {
          if (left === null || right === null) return null;
          return left.concat(right);
        }),
      );
    }
    return null;
  });
}

async function lpWindowStart(latest) {
  const cutoff = Math.floor(Date.now() / 1000) - 86400;
  let start = Math.max(0, latest - LP_WINDOW_BLOCKS);
  const b = await rpcTryAll('eth_getBlockByNumber', [hex(start), false]);
  const ts = b && b.timestamp ? parseInt(b.timestamp, 16) : null;
  if (ts !== null) {
    if (ts > cutoff) start = Math.max(0, start - Math.ceil((ts - cutoff) / 0.45) - 200);
    else if (ts < cutoff - 1800) start = Math.min(latest, start + Math.floor((cutoff - ts) / 0.45) - 200);
  }
  return LAUNCHPAD_DEPLOY_BLOCK ? Math.max(LAUNCHPAD_DEPLOY_BLOCK, start) : start;
}

async function lpMetric(launches) {
  const targets = launches.slice(0, LP_METRIC_MAX_LAUNCHES);
  if (!targets.length) return;
  const latestHex = await rpcTryAll('eth_blockNumber', []);
  if (!latestHex) return;
  const latest = parseInt(latestHex, 16);
  const from = await lpWindowStart(latest);
  if (latest < from) return;
  for (const l of targets) {
    const [engLogs, tokLogs] = await Promise.all([
      fetchLpLogs(l.engine, LP_ACTOR_TOPICS, from, latest),
      fetchLpLogs(l.token, [LP_TOPIC.transfer], from, latest),
    ]);
    if (engLogs === null && tokLogs === null) continue; // keep previous value
    const actors = new Set();
    const engLc = l.engine.toLowerCase();
    const tokLc = l.token.toLowerCase();
    for (const lg of engLogs || []) {
      if (lg.topics && lg.topics[1]) actors.add(`0x${lg.topics[1].slice(26)}`.toLowerCase());
    }
    for (const lg of tokLogs || []) {
      if (!lg.topics) continue;
      for (const t of [lg.topics[1], lg.topics[2]]) {
        if (!t) continue;
        const a = `0x${t.slice(26)}`.toLowerCase();
        if (a === '0x0000000000000000000000000000000000000000' || a === engLc || a === tokLc) continue;
        actors.add(a);
      }
    }
    const list = [...actors].slice(0, LP_METRIC_MAX_ACTORS);
    const nowMs = Date.now();
    const need = list.filter((a) => {
      const c = lpAgentCache.get(a);
      return !c || nowMs - c.at > 600000;
    });
    for (let i = 0; i < need.length; i += 100) {
      const chunk = need.slice(i, i + 100);
      const res = await rpcBatch(chunk.map((a) => callReq(A.registry, SEL.balanceOf + padArg(BigInt(a)))));
      chunk.forEach((a, j) => {
        const v = toBig(res[j]);
        if (v !== null) lpAgentCache.set(a, { ok: v > 0n, at: nowMs });
      });
    }
    let n = 0;
    for (const a of list) {
      const c = lpAgentCache.get(a);
      if (c && c.ok) n++;
    }
    l.agents24h = n;
  }
}

export function startLaunchpad() {
  ensurePoller('launchpad', launchpadStore, fetchLaunchpad, 45000);
}

/* ================= AGENT LAUNCHPAD activity feed (engine events) =================
 *
 * One stream across every launch's engine, IDB-backed like the other feeds: rows carry the engine address, and the views resolve
 * the launch (name / symbol) from the board store at render time.
 */

export const launchpadFeedStore = createStore(null);
let lpTop = null;
let lpHydrated = false;

function lpWord(l, i) {
  try {
    return BigInt(`0x${l.data.slice(2 + i * 64, 2 + (i + 1) * 64)}`).toString();
  } catch {
    return null;
  }
}

function parseLpLog(l) {
  const t0 = (l.topics[0] || '').toLowerCase();
  const base = {
    key: `${l.transactionHash}:${l.logIndex}`,
    stream: 'launchpad',
    engine: (l.address || '').toLowerCase(),
    block: parseInt(l.blockNumber, 16),
    idx: parseInt(l.logIndex, 16),
    tx: l.transactionHash,
    who: l.topics[1] ? `0x${l.topics[1].slice(26)}` : null,
    shares: null,
    a: null,
    b: null,
    note: null,
  };
  try {
    // DepositA / DepositB data: shares is the first word.
    if (t0 === LP_TOPIC.depositA) return { ...base, kind: 'paid', shares: lpWord(l, 0) };
    if (t0 === LP_TOPIC.depositB)
      return { ...base, kind: 'paid', shares: lpWord(l, 0), note: lpWord(l, 1) === '1' ? 'PERMANENT LP' : 'FLEXIBLE LP' };
    if (t0 === LP_TOPIC.freeSlot) return { ...base, kind: 'free' };
    if (t0 === LP_TOPIC.claimA) return { ...base, kind: 'claim', a: lpWord(l, 0), b: lpWord(l, 1) };
    if (t0 === LP_TOPIC.claimLP) return { ...base, kind: 'claimLP', a: lpWord(l, 0) };
    if (t0 === LP_TOPIC.vest) return { ...base, kind: 'vest', a: lpWord(l, 0) };
    if (t0 === LP_TOPIC.ignited) return { ...base, kind: 'ignition', who: null, a: lpWord(l, 0), b: lpWord(l, 1) };
    if (t0 === LP_TOPIC.buildPOL) return { ...base, kind: 'pool', who: null, a: lpWord(l, 0), b: lpWord(l, 1) };
    if (t0 === LP_TOPIC.completed) return { ...base, kind: 'completed', who: null, a: lpWord(l, 0) };
  } catch {
    return null;
  }
  return null;
}

function dedupeLp(events) {
  const seen = new Set();
  return events.filter((e) => (seen.has(e.key) ? false : (seen.add(e.key), true)));
}

function sortLpFeed(events) {
  return dedupeLp([...events])
    .sort((x, y) => y.block - x.block || y.idx - x.idx)
    .slice(0, 16);
}

async function hydrateLpFeed() {
  if (lpHydrated) return;
  lpHydrated = true;
  const [stored, meta] = await Promise.all([idbGetEvents('launchpad'), idbGetMeta('launchpadTop')]);
  if (stored && stored.length) {
    launchpadFeedStore.set({ data: sortLpFeed(stored), loaded: true, updatedAt: Date.now(), stale: true });
  }
  if (meta && typeof meta.block === 'number') lpTop = meta.block;
}

async function lpScanInitial(latest, engines) {
  // Walk backwards from the head in 50k chunks until a page of activity
  // is found, the deploy block is reached, or ten rounds pass — the
  // feed never looks below the factory's deployment.
  const floor =
    LAUNCHPAD_DEPLOY_BLOCK !== null && LAUNCHPAD_DEPLOY_BLOCK !== undefined
      ? LAUNCHPAD_DEPLOY_BLOCK
      : Math.max(0, latest - 499999);
  let to = latest;
  let found = [];
  let rounds = 0;
  while (to >= floor && found.length < 10 && rounds < 10) {
    const from = Math.max(floor, to - 49999);
    rounds++;
    const res = await fetchLpLogs(engines, LP_TOPICS, from, to);
    if (res === null) {
      if (to === latest) return false;
      break;
    }
    if (res.length) found = found.concat(res.map(parseLpLog).filter(Boolean));
    to = from - 1;
  }
  if (found.length) await idbPutEvents(found);
  lpTop = latest;
  await idbPutMeta('launchpadTop', { block: latest });
  const cur = launchpadFeedStore.get().data || [];
  launchpadFeedStore.set({ data: sortLpFeed([...cur, ...found]), loaded: true, updatedAt: Date.now(), stale: false });
  return true;
}

async function fetchLpFeed() {
  if (!A.launchpad) return null;
  const board = launchpadStore.get().data;
  const engines = board && board.launches ? [...new Set(board.launches.map((l) => l.engine))] : [];
  if (!engines.length) {
    return launchpadFeedStore.get().loaded ? { data: launchpadFeedStore.get().data } : null;
  }
  await hydrateLpFeed();
  const latestHex = await rpcTryAll('eth_blockNumber', []);
  if (!latestHex) return launchpadFeedStore.get().loaded ? { data: launchpadFeedStore.get().data } : null;
  const latest = parseInt(latestHex, 16);
  if (lpTop === null) {
    const ok = await lpScanInitial(latest, engines);
    if (!ok && !launchpadFeedStore.get().loaded) {
      launchpadFeedStore.set({ data: [], loaded: true, updatedAt: Date.now(), stale: true });
      return { data: [] };
    }
    return { data: launchpadFeedStore.get().data };
  }
  if (latest > lpTop) {
    const res = await fetchLpLogs(engines, LP_TOPICS, lpTop + 1, latest);
    if (res !== null) {
      const fresh = res.map(parseLpLog).filter(Boolean);
      if (fresh.length) await idbPutEvents(fresh);
      lpTop = latest;
      await idbPutMeta('launchpadTop', { block: latest });
      if (fresh.length) {
        const cur = launchpadFeedStore.get().data || [];
        return { data: sortLpFeed([...cur, ...fresh]) };
      }
    }
  }
  return { data: launchpadFeedStore.get().data };
}

export function startLaunchpadFeed() {
  ensurePoller('launchpadFeed', launchpadFeedStore, fetchLpFeed, 45000);
}

/* ================= DAILY POOL (DailyPoolEngineV2) =================
 *
 * One-day rounds: paid tickets (0.001 BNB each, max 5/wallet/day) and
 * 20 free FCFS slots/day feed one pot; at reveal the pot splits 60%
 * paid draw / 10% free draw / 20% rollover / 10% platform. The draw is
 * two-step (commitReveal fixes a future draw block, revealWinners draws
 * on its blockhash), so the reveal transaction's own block never seeds
 * it. roundStats returns 7 words: paidWinners, freeWinners, paidPrize,
 * freePrize, platformPaid, rolloverOut, unclaimed.
 * V2 rule: a round ending with fewer than MIN_PAID_TICKETS (10) paid
 * tickets FAILS — no draw, every paid ticket refunds 90% via
 * claimRefund within 7 days of the round end (see roundStatus).
 * Rounds run on the clock from GENESIS (a UTC midnight): currentRound()
 * is a view computed from block.timestamp, so it reverts before
 * GENESIS — the store falls back to round 0 until the clock opens it.
 */

export const dailyPoolStore = createStore(null);

function dpStats(hx) {
  if (typeof hx !== 'string' || hx.length < 2 + 7 * 64) return null;
  try {
    const w = (i) => BigInt(`0x${wordAt(hx, i)}`);
    return {
      paidWinners: w(0),
      freeWinners: w(1),
      paidPrize: w(2),
      freePrize: w(3),
      devPaid: w(4),
      rolloverOut: w(5),
      unclaimed: w(6),
    };
  } catch {
    return null;
  }
}

async function fetchDailyPoolWinners(roundId, paidCount, freeCount) {
  const out = [];
  const reqs = [];
  const kinds = [];
  for (let i = 0; i < paidCount && i < 10; i++) {
    reqs.push(callReq(A.dailyPool, SEL.dpPaidWinners + padArg(roundId) + padArg(i)));
    kinds.push('paid');
  }
  for (let i = 0; i < freeCount && i < 5; i++) {
    reqs.push(callReq(A.dailyPool, SEL.dpFreeWinners + padArg(roundId) + padArg(i)));
    kinds.push('free');
  }
  if (!reqs.length) return out;
  const addrs = await rpcBatch(reqs);
  const prizeReqs = [];
  addrs.forEach((hx) => {
    const a = typeof hx === 'string' && hx.length >= 66 ? `0x${hx.slice(26)}` : null;
    prizeReqs.push(a ? callReq(A.dailyPool, SEL.dpPrizeOf + padArg(roundId) + padArg(BigInt(a))) : null);
  });
  const prizes = await rpcBatch(prizeReqs.filter(Boolean));
  let pi = 0;
  addrs.forEach((hx, k) => {
    if (typeof hx !== 'string' || hx.length < 66) return;
    const who = `0x${hx.slice(26)}`;
    const pv = toBig(prizes[pi++]);
    out.push({ who, kind: kinds[k], prize: pv, claimed: pv === 0n });
  });
  return out;
}

async function fetchDailyPool() {
  if (!A.dailyPool) return null;
  const E = A.dailyPool;
  const r0 = await rpcBatch([callReq(E, SEL.dpCurrentRound)]);
  let round = toBig(r0[0]);
  if (round === null) {
    // Pre-GENESIS: currentRound() is a clock view — (now - GENESIS)
    // underflows and reverts until the clock opens round 0. Probe
    // roundStartOf(0): if it reads, the chain is alive and round 0 is
    // the live round; if it does not, the RPC is down — bail.
    const probe = await rpcBatch([callReq(E, SEL.dpRoundStartOf + padArg(0n))]);
    if (toBig(probe[0]) === null) return null;
    round = 0n;
  }
  const rn = Number(round);
  const r = await rpcBatch([
    callReq(E, SEL.dpRoundStartOf + padArg(round)), // 0
    callReq(E, SEL.dpRoundEndOf + padArg(round)), // 1
    callReq(E, SEL.dpPotOf + padArg(round)), // 2
    callReq(E, SEL.dpPaidTicketCount + padArg(round)), // 3
    callReq(E, SEL.dpFreeTicketCount + padArg(round)), // 4
    callReq(E, SEL.dpFreeUsed + padArg(round)), // 5
    callReq(E, SEL.dpRoundStats + padArg(round)), // 6
    callReq(E, SEL.dpDrawBlockOf + padArg(round)), // 7
    callReq(E, SEL.dpUnclaimedTotal), // 8
    // 9-24: the engine's public constants — live reads, never literals.
    callReq(E, SEL.dpTicketPrice), // 9
    callReq(E, SEL.dpMaxPaidPerDay), // 10
    callReq(E, SEL.dpFreeSlotsPerDay), // 11
    callReq(E, SEL.dpMaxPaidWinners), // 12
    callReq(E, SEL.dpMaxFreeWinners), // 13
    callReq(E, SEL.dpPaidDrawBps), // 14
    callReq(E, SEL.dpFreeDrawBps), // 15
    callReq(E, SEL.dpRolloverBps), // 16
    callReq(E, SEL.dpPlatformBps), // 17
    callReq(E, SEL.dpBps), // 18
    callReq(E, SEL.dpRoundLength), // 19
    callReq(E, SEL.dpLongstop), // 20
    callReq(E, SEL.dpDrawWindow), // 21
    callReq(E, SEL.dpMinPaidTickets), // 22
    callReq(E, SEL.dpRefundPerTicket), // 23
    callReq(E, SEL.dpRefundWindow), // 24
    ...(rn > 0
      ? [
          callReq(E, SEL.dpRoundStats + padArg(BigInt(rn - 1))), // 25 (prev round)
          callReq(E, SEL.dpRoundStatus + padArg(BigInt(rn - 1))), // 26 (prev round: 0 OPEN / 1 ENDED / 2 DRAWN / 3 FAILED / 4 DEAD / 5 SWEPT)
          callReq(E, SEL.dpPotOf + padArg(BigInt(rn - 1))), // 27 (prev round)
          callReq(E, SEL.dpPaidTicketCount + padArg(BigInt(rn - 1))), // 28 (prev round)
          callReq(E, SEL.dpRefundWindowEndOf + padArg(BigInt(rn - 1))), // 29 (prev round)
        ]
      : []),
  ]);
  const prev = dailyPoolStore.get().data || {};
  const pick = (i, key) => {
    const v = toBig(r[i]);
    return v !== null ? v : prev[key] ?? null;
  };
  const stats = dpStats(r[6]);
  const prevStats = rn > 0 ? dpStats(r[25]) : null;
  // Live constants, with the previous poll's values as fallback.
  const constKeys = ['ticketPrice', 'maxPaid', 'freeSlots', 'maxPaidWinners', 'maxFreeWinners', 'paidBps', 'freeBps', 'rolloverBps', 'platformBps', 'bps', 'roundLength', 'longstop', 'drawWindow', 'minPaidTickets', 'refundPerTicket', 'refundWindow'];
  const consts = {};
  constKeys.forEach((k, j) => {
    const v = toBig(r[9 + j]);
    consts[k] = v !== null ? v : prev.consts?.[k] ?? null;
  });
  const data = {
    round,
    roundStart: pick(0, 'roundStart'),
    roundEnd: pick(1, 'roundEnd'),
    pot: pick(2, 'pot'),
    paidTickets: pick(3, 'paidTickets'),
    freeTickets: pick(4, 'freeTickets'),
    freeUsed: pick(5, 'freeUsed'),
    stats: stats || prev.stats || null,
    prevStats: prevStats || prev.prevStats || null,
    prevStatus: rn > 0 ? pick(26, 'prevStatus') : prev.prevStatus ?? null,
    prevPot: rn > 0 ? pick(27, 'prevPot') : prev.prevPot ?? null,
    prevPaidTickets: rn > 0 ? pick(28, 'prevPaidTickets') : prev.prevPaidTickets ?? null,
    prevRefundWindowEnd: rn > 0 ? pick(29, 'prevRefundWindowEnd') : prev.prevRefundWindowEnd ?? null,
    drawBlock: pick(7, 'drawBlock'),
    unclaimedTotal: pick(8, 'unclaimedTotal'),
    consts: constKeys.some((k) => consts[k] !== null) ? consts : prev.consts || null,
    prevWinners: prev.prevWinners || [],
  };
  if (Object.values(data).every((v) => v === null)) return null;
  // Yesterday's winners (round rn-1): addresses + claimed state, best effort.
  // Only a DRAWN round has winners — a FAILED round has none by design.
  if (rn > 0 && data.prevStats && Number(data.prevStatus) === 2) {
    try {
      const w = await fetchDailyPoolWinners(BigInt(rn - 1), Number(data.prevStats.paidWinners), Number(data.prevStats.freeWinners));
      if (w.length) data.prevWinners = w;
    } catch {
      /* keep previous winners */
    }
  }
  return { data };
}

export function startDailyPool() {
  ensurePoller('dailypool', dailyPoolStore, fetchDailyPool, 30000);
}

/* ================= DAILY POOL entries feed (PaidEntered / FreeSlotTaken) ================= */

export const dailyPoolFeedStore = createStore(null);
const dpBlockTs = new Map();

async function dpTs(block) {
  if (dpBlockTs.has(block)) return dpBlockTs.get(block);
  const b = await rpcTryAll('eth_getBlockByNumber', [`0x${block.toString(16)}`, false]);
  const ts = b && b.timestamp ? parseInt(b.timestamp, 16) : null;
  if (ts) dpBlockTs.set(block, ts);
  return ts;
}

function dpWord(l, i) {
  try {
    return BigInt(`0x${l.data.slice(2 + i * 64, 2 + (i + 1) * 64)}`).toString();
  } catch {
    return null;
  }
}

async function fetchDailyPoolFeed() {
  if (!A.dailyPool || !DAILYPOOL_DEPLOY_BLOCK) return null;
  const pool = dailyPoolStore.get().data;
  const round = pool && pool.round !== null && pool.round !== undefined ? Number(pool.round) : null;
  const latestHex = await rpcTryAll('eth_blockNumber', []);
  if (!latestHex) return null;
  const latest = parseInt(latestHex, 16);
  if (latest < DAILYPOOL_DEPLOY_BLOCK) return { data: { items: [], paidDistinct: 0, freeDistinct: 0 } };
  const all = [];
  for (const [kind, topic] of [
    ['paid', DP_TOPIC.paidEntered],
    ['free', DP_TOPIC.freeSlot],
  ]) {
    const logs = await fetchLogsChunked(A.dailyPool, topic, DAILYPOOL_DEPLOY_BLOCK, latest);
    if (logs === null) return null;
    for (const l of logs) {
      const rId = l.topics[2] ? Number(BigInt(l.topics[2])) : null;
      if (round !== null && rId !== null && rId !== round) continue;
      all.push({
        key: `${l.transactionHash}:${l.logIndex}`,
        kind,
        who: l.topics[1] ? `0x${l.topics[1].slice(26)}` : null,
        tickets: kind === 'paid' ? dpWord(l, 0) : null, // PaidEntered data: tickets is word 0, amount word 1
        round: rId,
        block: parseInt(l.blockNumber, 16),
        idx: parseInt(l.logIndex, 16),
        tx: l.transactionHash,
        ts: null,
      });
    }
  }
  all.sort((x, y) => y.block - x.block || y.idx - x.idx);
  // Distinct wallets this round (counted over ALL current-round logs,
  // before the 8-row display slice) — the prize-if-drawn-now math caps
  // winners by distinct wallets, exactly like the contract's draw.
  const paidDistinct = new Set(all.filter((x) => x.kind === 'paid').map((x) => (x.who || '').toLowerCase())).size;
  const freeDistinct = new Set(all.filter((x) => x.kind === 'free').map((x) => (x.who || '').toLowerCase())).size;
  const items = all.slice(0, 8);
  for (const it of items) it.ts = await dpTs(it.block);
  return { data: { items, paidDistinct, freeDistinct } };
}

export function startDailyPoolFeed() {
  ensurePoller('dailypoolfeed', dailyPoolFeedStore, fetchDailyPoolFeed, 30000);
}

/* ================= Agent ID name + avatar resolution =================
 *
 * A wallet's Agent ID name ("dayuwidayadi") and profile image live in
 * the token's metadata: wallet -> Transfer logs on the registry ->
 * tokenId -> tokenURI(tokenId) -> { name, image }. The registry has no
 * tokenOfOwnerByIndex (it reverts), so the Transfer scan is the route.
 * The contract itself only ever checks balanceOf > 0; names are a
 * display-layer concern. Every step fails soft to null (the caller
 * falls back to the short address); resolved identities are cached
 * forever in-memory (Agent IDs are soulbound — one per wallet).
 */

const agentIdCache = new Map();
const AGENTID_SCAN_START = 100000000; // BSC block — safely before the Agent ID program
const AGENTID_CHUNK = 2000000; // blocks per scan chunk, newest first

function registryLogsOnce(addrTopic, from, to) {
  return rpcTryAll('eth_getLogs', [
    {
      address: A.registry,
      fromBlock: hex(from),
      toBlock: hex(to),
      topics: [LP_TOPIC.transfer, null, addrTopic],
    },
  ]);
}

async function scanRegistryWallet(addrTopic, from, to) {
  const res = await registryLogsOnce(addrTopic, from, to);
  if (Array.isArray(res)) return res;
  if (to - from > 1000) {
    const mid = from + Math.floor((to - from) / 2);
    const left = await scanRegistryWallet(addrTopic, from, mid);
    if (left === null) return null;
    const right = await scanRegistryWallet(addrTopic, mid + 1, to);
    if (right === null) return null;
    return left.concat(right);
  }
  return null;
}

export async function resolveAgentId(address) {
  if (!address) return null;
  const key = address.toLowerCase();
  if (agentIdCache.has(key)) return agentIdCache.get(key);
  let out = null;
  try {
    const latestHex = await rpcTryAll('eth_blockNumber', []);
    if (!latestHex) return null;
    const latest = parseInt(latestHex, 16);
    const addrTopic = `0x${key.slice(2).padStart(64, '0')}`;
    // Newest-first chunks: most IDs were minted recently, so the mint
    // is usually found in the first one or two chunks.
    let tokenId = null;
    for (let to = latest; to >= AGENTID_SCAN_START && tokenId === null; to -= AGENTID_CHUNK) {
      const from = Math.max(AGENTID_SCAN_START, to - AGENTID_CHUNK + 1);
      const logs = await scanRegistryWallet(addrTopic, from, to);
      if (logs === null) break;
      for (const l of logs) {
        if (!l.topics || l.topics.length < 4) continue;
        const fromAddr = `0x${l.topics[1].slice(26)}`.toLowerCase();
        if (fromAddr === '0x0000000000000000000000000000000000000000') {
          tokenId = l.topics[3];
          break;
        }
      }
    }
    if (tokenId) {
      const uriRes = await rpcBatch([callReq(A.registry, SEL.tokenURI + padArg(BigInt(tokenId)))]);
      const uri = uriRes[0] ? decodeStr(uriRes[0]) : '';
      if (uri) {
        const r = await fetch(uri);
        const j = await r.json();
        if (j && j.name) out = { name: `${j.name}.ai`, image: j.image || null };
      }
    }
  } catch {
    out = null;
  }
  agentIdCache.set(key, out);
  return out;
}

/* ================= AGENTS PREDICT (live contract monitor) =================
 *
 * The Predict page reads the AgentsPredict contract live: the current
 * round's struct (ref/settle TWAP, UP/DOWN totals, outcome), the
 * reference + settlement previews, the first bettable round, the V2
 * early-bettor reward (paid count, cap, deadline, per-bet amount), and
 * the locked constants — never a literal in the view. Polls every 15s
 * (rounds turn every 10 minutes, so the read stays fresh).
 */

export const predictStore = createStore(null);

function prRound(hx) {
  if (typeof hx !== 'string' || hx.length < 2 + 10 * 64) return null;
  try {
    const w = (i) => BigInt(`0x${wordAt(hx, i)}`);
    return {
      refPrice: w(0),
      openCum: w(1),
      openTime: w(2),
      settlePrice: w(3),
      upTotal: w(4),
      downTotal: w(5),
      outcome: Number(w(6)),
      resolvedAt: w(7),
      payoutPool: w(8),
      winBase: w(9),
    };
  } catch {
    return null;
  }
}

async function fetchPredict() {
  if (!A.predict) return null;
  const E = A.predict;
  const r0 = await rpcBatch([callReq(E, SEL.prCurrentRound)]);
  const round = toBig(r0[0]);
  if (round === null) return null;
  const rn = Number(round);
  const r = await rpcBatch([
    callReq(E, SEL.prRounds + padArg(round)), // 0 current round struct
    callReq(E, SEL.prPreviewRef), // 1 reference TWAP (Q112 USDT per BTCB)
    callReq(E, SEL.prPreviewSettle + padArg(round)), // 2 settlement preview (Q112, 0 before the 5-min floor)
    callReq(E, SEL.prFirstRound), // 3 first bettable round
    // 4-10: the contract's public constants — live reads, never literals.
    callReq(E, SEL.prRoundLen), // 4
    callReq(E, SEL.prMinBet), // 5
    callReq(E, SEL.prHouseBps), // 6
    callReq(E, SEL.prRefundBps), // 7
    callReq(E, SEL.prTieBandBps), // 8
    callReq(E, SEL.prLongstop), // 9
    callReq(E, SEL.prPair), // 10
    // 11-14: the V2 early-bettor reward — live reads, never literals.
    callReq(E, SEL.prRewardCount), // 11 rewards paid so far
    callReq(E, SEL.prRewardCap), // 12 first-20 cap
    callReq(E, SEL.prRewardDeadline), // 13 deploy + 7 days
    callReq(E, SEL.prRewardPerBet), // 14 A404 per first bet
    ...(rn > 0 ? [callReq(E, SEL.prRounds + padArg(BigInt(rn - 1)))] : []), // 15 prev round struct
  ]);
  const prev = predictStore.get().data || {};
  const pick = (i, key) => {
    const v = toBig(r[i]);
    return v !== null ? v : prev[key] ?? null;
  };
  const constKeys = ['roundLen', 'minBet', 'houseBps', 'refundBps', 'tieBandBps', 'longstop', 'pair'];
  const consts = {};
  constKeys.forEach((k, j) => {
    const v = toBig(r[4 + j]);
    consts[k] = v !== null ? v : prev.consts?.[k] ?? null;
  });
  const rwKeys = ['count', 'cap', 'deadline', 'perBet'];
  const reward = {};
  rwKeys.forEach((k, j) => {
    const v = toBig(r[11 + j]);
    reward[k] = v !== null ? v : prev.reward?.[k] ?? null;
  });
  const data = {
    round,
    cur: prRound(r[0]) || prev.cur || null,
    previewRef: pick(1, 'previewRef'),
    previewSettle: pick(2, 'previewSettle'),
    firstRound: pick(3, 'firstRound'),
    consts: constKeys.some((k) => consts[k] !== null) ? consts : prev.consts || null,
    reward: rwKeys.some((k) => reward[k] !== null) ? reward : prev.reward || null,
    prev: rn > 0 ? prRound(r[15]) || prev.prev || null : prev.prev ?? null,
  };
  if (data.round === null && data.cur === null && data.previewRef === null) return null;
  return { data };
}

export function startPredict() {
  ensurePoller('predict', predictStore, fetchPredict, 15000);
}

/* ================= AGENTS PREDICT bets feed (Bet events) ================= */

export const predictFeedStore = createStore(null);

async function fetchPredictFeed() {
  if (!A.predict || !PREDICT_DEPLOY_BLOCK) return null;
  const pred = predictStore.get().data;
  const round = pred && pred.round !== null && pred.round !== undefined ? Number(pred.round) : null;
  const latestHex = await rpcTryAll('eth_blockNumber', []);
  if (!latestHex) return null;
  const latest = parseInt(latestHex, 16);
  if (latest < PREDICT_DEPLOY_BLOCK) return { data: { items: [] } };
  const logs = await fetchLogsChunked(A.predict, PR_TOPIC.bet, PREDICT_DEPLOY_BLOCK, latest);
  if (logs === null) return null;
  const all = [];
  for (const l of logs) {
    const rId = l.topics[1] ? Number(BigInt(l.topics[1])) : null;
    if (round !== null && rId !== null && rId !== round) continue;
    // Bet data: word 0 = up (bool), word 1 = amount.
    let up = null;
    let amount = null;
    try {
      up = BigInt(`0x${l.data.slice(2, 66)}`) !== 0n;
      amount = BigInt(`0x${l.data.slice(66, 130)}`);
    } catch {
      continue;
    }
    all.push({
      key: `${l.transactionHash}:${l.logIndex}`,
      who: l.topics[2] ? `0x${l.topics[2].slice(26)}` : null,
      up,
      amount,
      round: rId,
      block: parseInt(l.blockNumber, 16),
      idx: parseInt(l.logIndex, 16),
      tx: l.transactionHash,
      ts: null,
    });
  }
  all.sort((x, y) => y.block - x.block || y.idx - x.idx);
  const items = all.slice(0, 8);
  for (const it of items) it.ts = await dpTs(it.block);
  return { data: { items } };
}

export function startPredictFeed() {
  ensurePoller('predictfeed', predictFeedStore, fetchPredictFeed, 30000);
}

/* ================= AGENT MOONSHOT board (bonding-curve lane) =================
 *
 * Live reads for the Moonshot board: factory launchCount → curves(i) →
 * tokenOfCurve → per-curve state + per-token metadata. Same batched-read
 * pattern as the Launchpad board; per-item failures keep the last good
 * value (pick-with-prev). With 0 launches the store still loads
 * ({ curves: [], total: 0 }) so the board renders its live empty state
 * instead of reading forever.
 */

export const moonshotStore = createStore(null);

const MS_MAX_CURVES = 50;

async function fetchMoonshot() {
  const F = A.moonshot;
  const cntRes = await rpcBatch([callReq(F, SEL.msLaunchCount)]);
  const count = toBig(cntRes[0]);
  if (count === null) return null;
  const total = Number(count);
  const prev = moonshotStore.get().data;
  const prevByCurve = new Map(((prev && prev.curves) || []).map((c) => [c.curve.toLowerCase(), c]));
  const curves = [];
  if (total > 0) {
    const idx = [];
    for (let i = total - 1; i >= 0 && idx.length < MS_MAX_CURVES; i--) idx.push(i);
    const addrs = await rpcBatch(idx.map((i) => callReq(F, SEL.msCurves + padArg(i))));
    const base = [];
    addrs.forEach((hx, k) => {
      if (typeof hx !== 'string' || hx.length < 2 + 64) return;
      base.push({ id: idx[k], curve: addrWord(wordAt(hx, 0)) });
    });
    const tokReqs = base.map((c) => callReq(F, SEL.msTokenOfCurve + padArg(BigInt(c.curve))));
    const toks = await rpcBatch(tokReqs);
    base.forEach((c, k) => {
      c.token = typeof toks[k] === 'string' && toks[k].length >= 2 + 64 ? addrWord(wordAt(toks[k], 0)) : null;
    });
    const live = base.filter((c) => c.token);
    const metaReqs = [];
    live.forEach((c) => {
      metaReqs.push(callReq(c.token, SEL.name)); // +0
      metaReqs.push(callReq(c.token, SEL.symbol)); // +1
      metaReqs.push(callReq(c.token, SEL.msLogoURI)); // +2
      metaReqs.push(callReq(c.token, SEL.totalSupply)); // +3
    });
    const meta = await rpcBatch(metaReqs);
    live.forEach((c, k) => {
      const p = prevByCurve.get(c.curve.toLowerCase()) || {};
      const nm = meta[k * 4] ? decodeStr(meta[k * 4]) : '';
      const sm = meta[k * 4 + 1] ? decodeStr(meta[k * 4 + 1]) : '';
      const lg = meta[k * 4 + 2] ? decodeStrLong(meta[k * 4 + 2]) : '';
      const ts = toBig(meta[k * 4 + 3]);
      c.name = nm || p.name || '';
      c.symbol = sm || p.symbol || '';
      c.logoURI = lg || p.logoURI || '';
      c.supply = ts !== null ? ts : p.supply ?? null;
    });
    const stReqs = [];
    live.forEach((c) => {
      stReqs.push(callReq(c.curve, SEL.msSpotPrice)); // +0
      stReqs.push(callReq(c.curve, SEL.msTokensRemaining)); // +1
      stReqs.push(callReq(c.curve, SEL.msTokensSold)); // +2
      stReqs.push(callReq(c.curve, SEL.msCurveAllocation)); // +3
      stReqs.push(callReq(c.curve, SEL.msRealBnb)); // +4
      stReqs.push(callReq(c.curve, SEL.msGraduated)); // +5
      stReqs.push(callReq(c.curve, SEL.msCanGraduate)); // +6
      stReqs.push(callReq(c.curve, SEL.msPair)); // +7
    });
    const st = await rpcBatch(stReqs);
    live.forEach((c, k) => {
      const p = prevByCurve.get(c.curve.toLowerCase()) || {};
      const pickB = (j, key) => {
        const v = toBig(st[k * 8 + j]);
        return v !== null ? v : p[key] ?? null;
      };
      const flag = (j, key) => {
        const v = pickB(j, key);
        return v === null ? null : v !== 0n;
      };
      c.spotPrice = pickB(0, 'spotPrice');
      c.tokensRemaining = pickB(1, 'tokensRemaining');
      c.tokensSold = pickB(2, 'tokensSold');
      c.curveAllocation = pickB(3, 'curveAllocation');
      c.realBnb = pickB(4, 'realBnb');
      c.graduated = flag(5, 'graduated');
      c.canGraduate = flag(6, 'canGraduate');
      c.pair = typeof st[k * 8 + 7] === 'string' ? decodeAddrWord(st[k * 8 + 7]) : p.pair ?? null;
    });
    curves.push(...live);
  }
  return { data: { curves, total } };
}

export function startMoonshot() {
  ensurePoller('moonshot', moonshotStore, fetchMoonshot, 30000);
}

/* ================= BOUNTY AGENTS BOARD ========== */
// Live reads for #/bounty. The escrow is NOT deployed yet (A.bounty is
// null): the store then carries API text only (unverified records) and
// no chain state, and the page shows its empty state. Once deployed,
// on-chain reads are the source of truth for status / prize / deadline
// and the API supplies only the human-readable text.

export const bountyStore = createStore(null);

export const BT_CATEGORIES = ['Summary', 'Coding', 'Prediction', 'Poster', 'Creative'];

function decodeBounty(hexStr) {
  // bounties(uint256): (address creator, uint8 category, uint8 status,
  // uint256 prize, uint256 deadline, bytes32 descriptionHash,
  // uint256 submissionCount) — 7 words, fixed layout.
  if (typeof hexStr !== 'string' || hexStr.length < 2 + 7 * 64) return null;
  try {
    const w = (i) => hexStr.slice(2 + i * 64, 2 + (i + 1) * 64);
    return {
      creator: `0x${w(0).slice(24)}`,
      category: Number(BigInt(`0x${w(1)}`)),
      status: Number(BigInt(`0x${w(2)}`)),
      prize: BigInt(`0x${w(3)}`),
      deadline: Number(BigInt(`0x${w(4)}`)),
      descriptionHash: `0x${w(5)}`,
      submissionCount: Number(BigInt(`0x${w(6)}`)),
    };
  } catch {
    return null;
  }
}

function decodeWinners(hexStr) {
  // getWinners(uint256): (address[] winners, uint256[] sharesBps).
  if (typeof hexStr !== 'string' || hexStr.length < 2 + 128) return null;
  try {
    const clean = hexStr.slice(2);
    const offW = Number(BigInt(`0x${clean.slice(0, 64)}`)) * 2;
    const offS = Number(BigInt(`0x${clean.slice(64, 128)}`)) * 2;
    const n = Number(BigInt(`0x${clean.slice(offW, offW + 64)}`));
    if (n < 0 || n > 3) return null;
    const winners = [];
    const shares = [];
    for (let i = 0; i < n; i++) {
      winners.push(`0x${clean.slice(offW + 64 + i * 64 + 24, offW + 128 + i * 64)}`);
      shares.push(Number(BigInt(`0x${clean.slice(offS + 64 + i * 64, offS + 128 + i * 64)}`)));
    }
    return { winners, shares };
  } catch {
    return null;
  }
}

async function fetchBountyApi(path) {
  if (!BOUNTY_API) return null;
  try {
    const r = await fetch(`${BOUNTY_API}${path}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchBlockTimestamps(blocks) {
  // block number -> unix timestamp, via eth_getBlockByNumber (batched).
  const out = new Map();
  const uniq = [...new Set(blocks)].filter((b) => Number.isFinite(b) && b > 0);
  if (!uniq.length) return out;
  const res = await rpcBatch(uniq.map((b) => ({ method: 'eth_getBlockByNumber', params: [hex(b), false] })));
  uniq.forEach((b, i) => {
    const ts = res[i] && res[i].timestamp ? parseInt(res[i].timestamp, 16) : null;
    if (ts) out.set(b, ts);
  });
  return out;
}

async function fetchBountyLogs() {
  // Awarded + WorkSubmitted + BountyCreated logs from the deploy block.
  // Skipped entirely while the escrow is undeployed (block 0).
  const empty = { awarded: [], submitted: [], created: [] };
  if (!A.bounty || !BOUNTY_DEPLOY_BLOCK) return empty;
  const latest = await ethBlockNumber();
  if (!latest || latest < BOUNTY_DEPLOY_BLOCK) return empty;
  const [awarded, submitted, created] = await Promise.all([
    fetchLogsChunked(A.bounty, BT_TOPIC.awarded, BOUNTY_DEPLOY_BLOCK, latest),
    fetchLogsChunked(A.bounty, BT_TOPIC.submitted, BOUNTY_DEPLOY_BLOCK, latest),
    fetchLogsChunked(A.bounty, BT_TOPIC.created, BOUNTY_DEPLOY_BLOCK, latest),
  ]);
  return {
    awarded: Array.isArray(awarded) ? awarded : [],
    submitted: Array.isArray(submitted) ? submitted : [],
    created: Array.isArray(created) ? created : [],
  };
}

function buildActiveAgents(logs, paid) {
  // Aggregate on-chain activity per wallet: last action + counts. Wins
  // come from the paid rows (every winner submitted, so they are already
  // in the map). Returns the 4 most recently active agents.
  const byAddr = new Map();
  const touch = (addr, kind, block) => {
    const a = addr.toLowerCase();
    const cur = byAddr.get(a) || { address: a, lastKind: kind, lastBlock: block, submitted: 0, created: 0, wins: 0 };
    if (block >= cur.lastBlock) {
      cur.lastKind = kind;
      cur.lastBlock = block;
    }
    if (kind === 'submitted') cur.submitted += 1;
    if (kind === 'created') cur.created += 1;
    byAddr.set(a, cur);
  };
  for (const l of logs.created) touch(`0x${l.topics[2].slice(26)}`, 'created', parseInt(l.blockNumber, 16));
  for (const l of logs.submitted) touch(`0x${l.topics[2].slice(26)}`, 'submitted', parseInt(l.blockNumber, 16));
  for (const p of paid) {
    for (const w of p.winners || []) {
      const cur = byAddr.get(w.toLowerCase());
      if (cur) cur.wins += 1;
    }
  }
  return [...byAddr.values()].sort((a, b) => b.lastBlock - a.lastBlock).slice(0, 4);
}

async function fetchBounty() {
  // No escrow yet: API text only, no chain state. The page renders its
  // empty state; nothing here is a number from the chain.
  if (!A.bounty) {
    const list = await fetchBountyApi('/api/bounties');
    if (!list) return null;
    const items = Array.isArray(list.bounties) ? list.bounties : Array.isArray(list) ? list : [];
    return { data: { deployed: false, bounties: items, stats: null, paid: [], active: [], params: null } };
  }
  const r0 = await rpcBatch([callReq(A.bounty, SEL.btNextId)]);
  const next = toBig(r0[0]);
  if (next === null) return null;
  const n = Number(next);
  const bounties = [];
  if (n > 0) {
    const reqs = [];
    for (let i = 0; i < n; i++) reqs.push(callReq(A.bounty, SEL.btBounty + padArg(BigInt(i))));
    const res = await rpcBatch(reqs);
    for (let i = 0; i < n; i++) {
      const b = decodeBounty(res[i]);
      if (b) bounties.push({ id: i, ...b });
    }
  }
  // Live contract parameters (read, never literals).
  const pr = await rpcBatch([
    callReq(A.bounty, SEL.btFeeBps),
    callReq(A.bounty, SEL.btMinPrize),
    callReq(A.bounty, SEL.btJudgeTimeout),
    callReq(A.bounty, SEL.btSweepTimeout),
    callReq(A.bounty, SEL.btJudge),
  ]);
  const judgeTimeout = toBig(pr[2]);
  const sweepTimeout = toBig(pr[3]);
  const params = {
    feeBps: toBig(pr[0]),
    minPrize: toBig(pr[1]),
    judgeTimeout: judgeTimeout !== null ? Number(judgeTimeout) : null,
    sweepTimeout: sweepTimeout !== null ? Number(sweepTimeout) : null,
    judge: typeof pr[4] === 'string' && pr[4].length >= 66 ? `0x${pr[4].slice(-40)}` : null,
  };
  // Merge API text (title / description / agent id) by bounty id.
  const list = await fetchBountyApi('/api/bounties');
  const textById = new Map();
  if (list) {
    const items = Array.isArray(list.bounties) ? list.bounties : Array.isArray(list) ? list : [];
    for (const it of items) {
      if (it && typeof it.bountyId === 'number') textById.set(it.bountyId, it);
    }
  }
  for (const b of bounties) {
    const t = textById.get(b.id);
    b.title = t?.title || null;
    b.description = t?.description || null;
    b.verified = t?.verified === true;
    b.creatorAgentId = t?.creatorAgentId || null;
  }
  // Stats — computed from the live bounties, each shown exactly once.
  let prizesOpen = 0n;
  let bountiesOpen = 0;
  let completed = 0;
  let totalPaid = 0n;
  for (const b of bounties) {
    if (b.status === 0) {
      prizesOpen += b.prize;
      bountiesOpen += 1;
    }
    if (b.status === 1) {
      completed += 1;
      totalPaid += b.prize;
    }
  }
  const stats = { prizesOpen, bountiesOpen, completed, totalPaid };
  // Winners for every awarded bounty (attached to the bounty, so the
  // card's "View winners" and the Recently Paid rows share one read).
  const awarded = bounties.filter((b) => b.status === 1).sort((a, b) => b.id - a.id);
  if (awarded.length) {
    const wres = await rpcBatch(awarded.map((b) => callReq(A.bounty, SEL.btGetWinners + padArg(BigInt(b.id)))));
    awarded.forEach((b, k) => {
      const w = decodeWinners(wres[k]);
      b.winners = w ? w.winners : [];
      b.shares = w ? w.shares : [];
    });
  }
  // Recently Paid: Awarded bounties, newest first, top 3.
  const paid = awarded
    .slice(-3)
    .reverse()
    .map((b) => ({ id: b.id, title: b.title, prize: b.prize, winners: b.winners || [], shares: b.shares || [] }));
  // Recently Active: from the event logs, top 4 agents by last activity.
  const logs = await fetchBountyLogs();
  const active = buildActiveAgents(logs, paid);
  // Paid dates come from the Awarded log of each bounty (latest award).
  const awardBlockById = new Map();
  for (const l of logs.awarded) {
    const id = Number(BigInt(l.topics[1]));
    awardBlockById.set(id, parseInt(l.blockNumber, 16));
  }
  const tsByBlock = await fetchBlockTimestamps([
    ...active.map((a) => a.lastBlock),
    ...[...awardBlockById.values()],
  ]);
  for (const a of active) a.lastAt = tsByBlock.get(a.lastBlock) || null;
  for (const p of paid) p.awardedAt = tsByBlock.get(awardBlockById.get(p.id)) || null;
  return { data: { deployed: true, bounties, stats, paid, active, params } };
}

export function startBounty() {
  ensurePoller('bounty', bountyStore, fetchBounty, 30000);
}
