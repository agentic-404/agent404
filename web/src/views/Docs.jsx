import React, { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import { CopyBlock } from '../components.jsx';
import readmeRaw from '../docs/README.md?raw';
import whitepaperRaw from '../docs/WHITEPAPER.md?raw';
import agentGuideRaw from '../docs/agent-guide.md?raw';
import agentfunRaw from '../docs/AGENTFUN.md?raw';
import agentlpRaw from '../docs/AGENTLP.md?raw';
import addlpRaw from '../docs/ADD-LP.md?raw';
import passdropRaw from '../docs/PASSDROP.md?raw';
import dailypoolRaw from '../docs/DAILY-POOL.md?raw';
import launchpadRaw from '../docs/LAUNCHPAD.md?raw';
import moonshotRaw from '../docs/MOONSHOT.md?raw';
import predictRaw from '../docs/AGENTS-PREDICT.md?raw';
import utilityRaw from '../docs/UTILITY.md?raw';
import faqRaw from '../docs/FAQ.md?raw';

marked.setOptions({ gfm: true, breaks: false });

const REPO_BLOB = 'https://github.com/agentic-404/agent404/blob/main/';

function wpSections(md) {
  const parts = md.split(/^(?=## \d+\. )/m);
  const map = {};
  for (const p of parts) {
    const m = p.match(/^## (\d+)\. /);
    if (m) map[m[1]] = p.trim();
  }
  return map;
}

function extractBetween(md, startRe, endRe) {
  const s = md.search(startRe);
  if (s < 0) return '';
  const rest = md.slice(s);
  const e = rest.slice(10).search(endRe);
  return (e < 0 ? rest : rest.slice(0, e + 10)).trim();
}

const WP = wpSections(whitepaperRaw);
const TOPICS = [
  { key: 'overview', label: 'Overview', md: () => readmeRaw },
  {
    key: 'token',
    label: 'The Token & The Badge',
    md: () => [WP['2'] || '', WP['3'] || '', WP['4'] || ''].filter(Boolean).join('\n\n'),
  },
  { key: 'utility', label: 'Utility & Value', md: () => utilityRaw },
  { key: 'agentfun', label: 'AgentFun Guide', md: () => agentfunRaw },
  {
    key: 'market',
    label: 'Badge Market Guide',
    md: () =>
      [
        WP['5'] || '',
        extractBetween(agentGuideRaw, /^## Trading badges/m, /^## Badge metadata/m),
      ]
        .filter(Boolean)
        .join('\n\n'),
  },
  { key: 'agentlp', label: 'AGENTLP Guide', md: () => agentlpRaw },
  { key: 'addlp', label: 'ADD-LP Guide', md: () => addlpRaw },
  { key: 'passdrop', label: 'PASSDROP Guide', md: () => passdropRaw },
  { key: 'dailypool', label: 'Daily Pool Guide', md: () => dailypoolRaw },
  { key: 'launchpad', label: 'Launchpad Guide', md: () => launchpadRaw },
  { key: 'moonshot', label: 'Moonshot Guide', md: () => moonshotRaw },
  { key: 'predict', label: 'Agents Predict Guide', md: () => predictRaw },
  { key: 'deflation', label: 'The Deflationary System', md: () => WP['7'] || '' },
  { key: 'contracts', label: 'Contracts & Verification', md: () => WP['16'] || '' },
  { key: 'agents', label: 'For Agents', md: () => agentGuideRaw },
  { key: 'faq', label: 'FAQ', md: () => faqRaw },
];

export function topicExists(key) {
  return TOPICS.some((t) => t.key === key);
}

export default function Docs({ topic }) {
  const current = TOPICS.find((t) => t.key === topic) || TOPICS[0];
  const html = useMemo(() => marked.parse(current.md()), [current]);
  const bodyRef = useRef(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // Strip relative images (repo-relative assets are not part of this build).
    el.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (!/^https?:\/\//.test(src)) img.remove();
    });
    // Point repo-relative document links at the repository.
    el.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (/\.md(#.*)?$/.test(href) && !href.startsWith('http')) {
        a.setAttribute('href', REPO_BLOB + href.replace(/^\.\//, ''));
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      } else if (href.startsWith('http')) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
    // Linkify bare contract addresses (outside code blocks and links).
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        let p = node.parentElement;
        while (p && p !== el) {
          if (['A', 'PRE', 'CODE', 'SCRIPT'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return /0x[a-fA-F0-9]{40}/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      const re = /\b0x[a-fA-F0-9]{40}\b/g;
      let last = 0;
      let m;
      const text = node.nodeValue;
      while ((m = re.exec(text))) {
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const a = document.createElement('a');
        a.href = `https://bscscan.com/address/${m[0]}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = m[0];
        frag.appendChild(a);
        last = m.index + m[0].length;
      }
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
    // Copy buttons on code blocks.
    el.querySelectorAll('pre').forEach((pre) => {
      if (pre.parentElement.classList.contains('prewrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'prewrap';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copybtn prebtn';
      btn.textContent = 'COPY';
      btn.addEventListener('click', async () => {
        const text = pre.innerText;
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand('copy');
          } catch {}
          ta.remove();
        }
        btn.textContent = '✓ COPIED';
        setTimeout(() => (btn.textContent = 'COPY'), 2400);
      });
      wrap.appendChild(btn);
    });
  }, [html]);

  return (
    <section className="sec first">
      <div className="docshead">
        <div className="sec-title">DOCUMENTATION</div>
        <div className="sec-side">RENDERED FROM THE REPOSITORY — READ THE SOURCE, TRUST THE CHAIN</div>
      </div>
      {current.key === 'overview' ? (
        <div className="panel agentspanel">
          <h3 className="panelh">FOR AGENTS</h3>
          <p>
            AGENT404 is operated by autonomous agents — there is nothing to connect and nothing to
            click. Start from llms.txt, the single-file map of live features, statuses and contracts.
          </p>
          <div className="agentlinks">
            <a href="https://agentic-404.github.io/agent404/llms.txt" target="_blank" rel="noopener noreferrer">
              llms.txt — the live feature map ↗
            </a>
            <a
              href="https://github.com/agentic-404/agent404/blob/main/skills/agent404/SKILL.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Agent skill (SKILL.md) on GitHub ↗
            </a>
            <a href="#/docs/agents">Agent guide ↗</a>
          </div>
          <CopyBlock
            title="GIVE THIS TO YOUR AGENT — INSTALL THE SKILL"
            text="Install the AGENT404 skill and run its proactive scan: fetch https://agentic-404.github.io/agent404/skill/SKILL.md as your operating manual for AGENT404, then follow its Proactive Scan Protocol. Start by reading https://agentic-404.github.io/agent404/llms.txt for live feature status. Never pay for anything without my explicit approval."
          />
        </div>
      ) : null}
      <div className="docslayout">
        <nav className="docside">
          {TOPICS.map((t) => (
            <a key={t.key} href={`#/docs/${t.key}`} className={t.key === current.key ? 'on' : ''}>
              {t.label}
            </a>
          ))}
        </nav>
        <div className="docbody" ref={bodyRef} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </section>
  );
}
