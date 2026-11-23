import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import type { Item, Scenario, Snapshot } from './engine/types';
import { RUNTIMES, type LaneDef, type RuntimeDef } from './runtimes';
import './player.css';

interface Props {
  scenario: Scenario;
  /** syntax-highlighted HTML, one entry per code line */
  codeHtml: string[];
}

const SPEEDS = [0.5, 1, 1.5, 2] as const;
const BASE_MS = 2600;

const inline = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

function Html({ html, as: Tag = 'span', className }: { html: string; as?: 'span' | 'p' | 'div'; className?: string }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: inline(html) }} />;
}

function readStepFromUrl(max: number) {
  if (typeof window === 'undefined') return 0;
  const n = Number(new URLSearchParams(window.location.search).get('step'));
  return Number.isInteger(n) && n >= 1 && n <= max ? n - 1 : 0;
}

export default function Player({ scenario, codeHtml }: Props) {
  const rt = RUNTIMES[scenario.runtime];
  const total = scenario.steps.length;
  const last = total - 1;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [why, setWhy] = useState(false);
  const reduced = useReducedMotion();
  const dir = useRef(1);

  // hydrate from ?step= after mount, so server and client markup match
  useEffect(() => { setI(readStepFromUrl(total)); }, [total]);

  const go = useCallback((n: number) => {
    setI((cur) => {
      const next = Math.max(0, Math.min(last, n));
      dir.current = next >= cur ? 1 : -1;
      return next;
    });
  }, [last]);

  // keep the URL shareable without adding history entries
  useEffect(() => {
    const url = new URL(window.location.href);
    if (i === 0) url.searchParams.delete('step'); else url.searchParams.set('step', String(i + 1));
    window.history.replaceState(null, '', url);
  }, [i]);

  // autoplay
  useEffect(() => {
    if (!playing) return;
    if (i >= last) { setPlaying(false); return; }
    const t = window.setTimeout(() => go(i + 1), BASE_MS / speed);
    return () => window.clearTimeout(t);
  }, [playing, i, last, speed, go]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, select, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); setPlaying(false); go(i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setPlaying(false); go(i - 1); }
      else if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'r' || e.key === 'R') { setPlaying(false); go(0); }
      else if (e.key === 'Home') { setPlaying(false); go(0); }
      else if (e.key === 'End') { setPlaying(false); go(last); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (i >= last) go(0);
    setPlaying(true);
  };

  const usedLanes = useMemo(
    () => new Set(scenario.steps.flatMap((st) => Object.entries(st.lanes).filter(([, v]) => v.length > 0).map(([k]) => k))),
    [scenario],
  );
  const snap = scenario.steps[i];
  const prevSnap = scenario.steps[Math.max(0, i - 1)];
  const newConsoleFrom = i === 0 ? 0 : prevSnap.console.length;

  return (
    <div className="player" data-runtime={scenario.runtime}>
      <div className="pl-grid">
        <div className="pl-left">
          <CodePane lines={codeHtml} active={snap.line} />
          <section className="pl-narration" aria-live="polite">
            <div className="pl-step-head">
              <span className="caps">Step {i + 1} of {total}</span>
              {snap.mark && <span className="pl-mark">{snap.mark}</span>}
            </div>
            <Html as="p" className="pl-note" html={snap.note} />
            {snap.detail && (
              <div className="pl-why">
                <button type="button" onClick={() => setWhy((w) => !w)} aria-expanded={why}>
                  {why ? 'Hide the detail' : 'Why does this happen?'}
                </button>
                {why && <Html as="p" html={snap.detail} />}
              </div>
            )}
            {i === last && (
              <div className="pl-takeaway">
                <span className="caps">Takeaway</span>
                <Html as="p" html={scenario.takeaway} />
              </div>
            )}
          </section>
          <Console lines={snap.console} newFrom={newConsoleFrom} />
        </div>
        <Visual rt={rt} snap={snap} reduced={!!reduced} dir={dir.current} used={usedLanes} />
      </div>

      <Controls
        i={i} total={total} steps={scenario.steps} playing={playing} speed={speed}
        onPlay={togglePlay}
        onPrev={() => { setPlaying(false); go(i - 1); }}
        onNext={() => { setPlaying(false); go(i + 1); }}
        onRestart={() => { setPlaying(false); go(0); }}
        onSeek={(n) => { setPlaying(false); go(n); }}
        onSpeed={setSpeed}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CodePane({ lines, active }: { lines: string[]; active: number }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>('.is-active');
    if (!box || !el) return;
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop + 24 || top > box.scrollTop + box.clientHeight - 48) {
      box.scrollTo({ top: Math.max(0, top - box.clientHeight / 3), behavior: 'smooth' });
    }
  }, [active]);
  return (
    <section className="pl-code" aria-label="Source code">
      <div className="pl-pane-head"><span className="caps">Code</span>{active > 0 ? <span className="pl-line-no">line {active}</span> : <span className="pl-line-no">no line running</span>}</div>
      <ol ref={ref}>
        {lines.map((html, k) => {
          const on = k + 1 === active;
          return (
            <li key={k} className={on ? 'is-active' : undefined}>
              {on && <motion.span layoutId="code-cursor" className="pl-cursor" transition={{ type: 'spring', stiffness: 520, damping: 42 }} />}
              <span className="ln">{k + 1}</span>
              <code dangerouslySetInnerHTML={{ __html: html || ' ' }} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Visual({ rt, snap, reduced, dir, used }: { rt: RuntimeDef; snap: Snapshot; reduced: boolean; dir: number; used: Set<string> }) {
  const extras = rt.lanes.filter((l) => l.optional && used.has(l.k)).map((l) => l.k);
  const cols = rt.columns.split(') ').length;
  let areas = rt.areas;
  if (extras.length === 1) areas += ` "${Array(cols).fill(extras[0]).join(' ')}"`;
  if (extras.length >= 2) areas += ` "${Array(cols - 1).fill(extras[0]).join(' ')} ${extras[1]}"`;
  const lanes = rt.lanes.filter((l) => !l.optional || used.has(l.k));
  return (
    <section className="pl-visual" aria-label="Runtime state" style={{ gridTemplateAreas: areas, gridTemplateColumns: rt.columns }}>
      <LayoutGroup>
        <Ring rt={rt} phase={snap.phase} dir={dir} reduced={reduced} />
        {lanes.map((lane) => (
          <Lane key={lane.k} def={lane} items={snap.lanes[lane.k] ?? []} reduced={reduced} />
        ))}
      </LayoutGroup>
      {snap.meters && (
        <div className="pl-meters" style={{ gridColumn: '1 / -1' }}>
          {Object.entries(snap.meters).map(([k, m]) => (
            <div key={k} className="pl-meter">
              <span className="pl-meter-label">{m.label}</span>
              <div className="pl-meter-track"><motion.span className="pl-meter-fill" animate={{ width: `${Math.min(100, (m.value / m.max) * 100)}%` }} data-hot={m.value / m.max > 0.7} /></div>
              <span className="pl-meter-value">{m.value}{m.unit ?? ''}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Lane({ def, items, reduced }: { def: LaneDef; items: Item[]; reduced: boolean }) {
  const spring = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 36, mass: 0.8 };
  const ordered = def.kind === 'stack' ? [...items].reverse() : items;
  let body: ReactNode;

  if (def.kind === 'pool') {
    const slots = def.slots ?? 4;
    const running = items.slice(0, slots);
    const waiting = items.slice(slots);
    body = (
      <>
        <div className="pool-slots">
          {Array.from({ length: slots }, (_, s) => {
            const it = running[s];
            return (
              <div key={s} className={`pool-slot${it ? ' busy' : ''}`}>
                <span className="pool-n">T{s + 1}</span>
                <AnimatePresence mode="popLayout" initial={false}>
                  {it ? <Chip key={it.id} item={it} spring={spring} /> : <span key="idle" className="pool-idle">idle</span>}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        {waiting.length > 0 && (
          <div className="pool-wait">
            <span className="pool-wait-label">waiting for a thread</span>
            <div className="lane-row">
              <AnimatePresence mode="popLayout" initial={false}>
                {waiting.map((it) => <Chip key={it.id} item={it} spring={spring} />)}
              </AnimatePresence>
            </div>
          </div>
        )}
      </>
    );
  } else {
    body = (
      <div className={`lane-body kind-${def.kind}`}>
        <AnimatePresence mode="popLayout" initial={false}>
          {ordered.map((it, k) => (
            <Chip key={it.id} item={it} spring={spring} top={def.kind === 'stack' && k === 0} front={def.kind === 'queue' && k === 0} />
          ))}
        </AnimatePresence>
        {items.length === 0 && <span className="lane-empty">{def.empty}</span>}
      </div>
    );
  }

  return (
    <div className={`lane lane-${def.k}`} style={{ gridArea: def.k }} data-tone={def.tone} data-count={items.length}>
      <div className="lane-head">
        <span className="lane-label">{def.label}</span>
        {items.length > 0 && <span className="lane-count">{items.length}</span>}
      </div>
      <p className="lane-hint">{def.hint}</p>
      {body}
    </div>
  );
}

function Chip({ item, spring, top, front }: { item: Item; spring: object; top?: boolean; front?: boolean }) {
  return (
    <motion.div
      layout
      layoutId={item.id}
      className={`chip tone-${item.tone ?? 'default'}${top ? ' is-top' : ''}${front ? ' is-front' : ''}`}
      initial={{ opacity: 0, scale: 0.85, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.18 } }}
      transition={spring}
    >
      <Html className="chip-label" html={item.label} />
      {item.sub && <Html className="chip-sub" html={item.sub} />}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

function Ring({ rt, phase, dir, reduced }: { rt: RuntimeDef; phase: string; dir: number; reduced: boolean }) {
  const n = rt.ring.length;
  const idx = rt.ring.findIndex((p) => p.k === phase);
  const angleFor = (k: number) => (360 / n) * k;
  const cumulative = useRef(idx >= 0 ? angleFor(idx) : 0);
  const lastIdx = useRef(idx);

  const target = useMemo(() => {
    if (idx < 0) return cumulative.current;
    const cur = cumulative.current;
    const want = angleFor(idx);
    const curMod = ((cur % 360) + 360) % 360;
    let delta = ((want - curMod) % 360 + 360) % 360;
    if (dir < 0 && delta !== 0) delta -= 360;
    return cur + delta;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, dir]);

  useEffect(() => { cumulative.current = target; lastIdx.current = idx; }, [target, idx]);

  const R = 62, C = 90;
  const centre = idx >= 0 ? rt.ring[idx].label : rt.centre[phase] ?? phase;
  const offRing = idx < 0;

  return (
    <div className="lane lane-ring" style={{ gridArea: 'ring' }}>
      <div className="lane-head"><span className="lane-label">Event loop</span></div>
      <svg viewBox="0 0 180 180" className="ring" role="img" aria-label={`Event loop phase: ${centre}`}>
        <circle cx={C} cy={C} r={R} className="ring-track" />
        {rt.ring.map((p, k) => {
          const a = ((angleFor(k) - 90) * Math.PI) / 180;
          const x = C + R * Math.cos(a), y = C + R * Math.sin(a);
          const on = k === idx;
          const lx = C + (R + 0) * Math.cos(a), ly = C + (R + 0) * Math.sin(a);
          return (
            <g key={p.k} className={`ring-station${on ? ' on' : ''}`}>
              <circle cx={x} cy={y} r={on ? 7 : 5} />
              <text x={lx} y={ly} dy={ly < C - 10 ? -12 : ly > C + 10 ? 20 : 4} dx={lx > C + 10 ? 12 : lx < C - 10 ? -12 : 0}
                textAnchor={lx > C + 10 ? 'start' : lx < C - 10 ? 'end' : 'middle'}>{p.short ?? p.label}</text>
            </g>
          );
        })}
        <motion.g
          style={{ originX: `${C}px`, originY: `${C}px` }}
          animate={{ rotate: target, opacity: offRing ? 0.25 : 1 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 16 }}
        >
          <circle cx={C} cy={C - R} r={3.5} className="ring-cursor" />
        </motion.g>
        <foreignObject x={C - 44} y={C - 26} width={88} height={52}>
          <div className={`ring-centre${offRing ? ' off' : ''}`}>{centre}</div>
        </foreignObject>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Console({ lines, newFrom }: { lines: Snapshot['console']; newFrom: number }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }); }, [lines.length]);
  return (
    <section className="pl-console" aria-label="Console output">
      <div className="pl-pane-head"><span className="caps">Console</span><span className="pl-line-no">{lines.length} {lines.length === 1 ? 'line' : 'lines'}</span></div>
      <ol ref={ref}>
        {lines.length === 0 && <li className="con-empty">nothing printed yet</li>}
        {lines.map((l, k) => (
          <li key={k} className={`con-${l.kind ?? 'log'}${k >= newFrom ? ' is-new' : ''}`}>
            <span className="con-caret" aria-hidden="true">›</span>{l.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Controls(p: {
  i: number; total: number; steps: Snapshot[]; playing: boolean; speed: number;
  onPlay(): void; onPrev(): void; onNext(): void; onRestart(): void; onSeek(n: number): void; onSpeed(s: (typeof SPEEDS)[number]): void;
}) {
  const pct = p.total > 1 ? (p.i / (p.total - 1)) * 100 : 0;
  return (
    <div className="pl-controls">
      <div className="pl-buttons">
        <button type="button" className="pc-btn" onClick={p.onRestart} aria-label="Restart (R)" title="Restart (R)">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2.5 7a4.5 4.5 0 1 0 1.4-3.3M2.5 1.8v2.4h2.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" className="pc-btn" onClick={p.onPrev} disabled={p.i === 0} aria-label="Previous step (←)" title="Previous step (←)">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M8.8 3 4.8 7l4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" className="pc-btn pc-play" onClick={p.onPlay} aria-label={p.playing ? 'Pause (space)' : 'Play (space)'} title={p.playing ? 'Pause (space)' : 'Play (space)'}>
          {p.playing
            ? <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3.5 2.5h2.3v9H3.5zM8.2 2.5h2.3v9H8.2z" fill="currentColor" /></svg>
            : <svg width="14" height="14" viewBox="0 0 14 14"><path d="M4 2.2v9.6L11.5 7z" fill="currentColor" /></svg>}
        </button>
        <button type="button" className="pc-btn" onClick={p.onNext} disabled={p.i === p.total - 1} aria-label="Next step (→)" title="Next step (→)">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M5.2 3 9.2 7l-4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      <div className="pl-timeline">
        <div className="tl-track" aria-hidden="true">
          <span className="tl-fill" style={{ width: `${pct}%` }} />
          {p.steps.map((s, k) => (
            <button
              key={k} type="button" tabIndex={-1}
              className={`tl-dot${k <= p.i ? ' done' : ''}${k === p.i ? ' current' : ''}${s.mark ? ' milestone' : ''}`}
              style={{ left: `${p.total > 1 ? (k / (p.total - 1)) * 100 : 0}%` }}
              onClick={() => p.onSeek(k)}
            >
              {s.mark && <span className="tl-tip">{s.mark}</span>}
            </button>
          ))}
        </div>
        <input
          type="range" min={1} max={p.total} value={p.i + 1}
          onChange={(e) => p.onSeek(Number(e.target.value) - 1)}
          aria-label="Step" aria-valuetext={`Step ${p.i + 1} of ${p.total}`}
          className="tl-range"
        />
      </div>

      <span className="pl-counter">{p.i + 1}<span>/{p.total}</span></span>

      <label className="pl-speed">
        <span className="visually-hidden">Playback speed</span>
        <select value={p.speed} onChange={(e) => p.onSpeed(Number(e.target.value) as (typeof SPEEDS)[number])}>
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </label>
    </div>
  );
}
