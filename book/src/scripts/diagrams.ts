/**
 * Client runtime for <Diagram>. Mermaid is loaded lazily the first time a
 * figure approaches the viewport, themed from the page's CSS tokens, and
 * re-rendered whenever the reader switches theme.
 */
import { attachZoom, type ZoomController } from './zoom';

type MermaidApi = typeof import('mermaid')['default'];

interface Step { nodes?: string[]; text: string }
interface Payload { steps: Step[]; notes: string[] }

let mermaidPromise: Promise<MermaidApi> | null = null;
let seq = 0;
let started = false;
// mermaid.render is not re-entrant, so every render goes through one queue
let queue: Promise<void> = Promise.resolve();
const enqueue = (fig: HTMLElement) => (queue = queue.then(() => renderFigure(fig)));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function css(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function themeVariables() {
  const night = document.documentElement.dataset.theme === 'night';
  return {
    darkMode: night,
    background: css('--bg-raised'),
    fontFamily: 'Inter Variable, -apple-system, Segoe UI, sans-serif',
    fontSize: '14px',
    primaryColor: css('--surface'),
    primaryTextColor: css('--ink'),
    primaryBorderColor: css('--rule-strong'),
    secondaryColor: css('--accent-soft'),
    secondaryTextColor: css('--ink'),
    secondaryBorderColor: css('--accent'),
    tertiaryColor: css('--bg'),
    tertiaryTextColor: css('--ink'),
    tertiaryBorderColor: css('--rule'),
    lineColor: css('--muted'),
    textColor: css('--text'),
    mainBkg: css('--surface'),
    nodeBorder: css('--rule-strong'),
    clusterBkg: css('--bg'),
    clusterBorder: css('--rule-strong'),
    titleColor: css('--ink'),
    edgeLabelBackground: css('--bg-raised'),
    noteBkgColor: css('--tip-bg'),
    noteTextColor: css('--ink'),
    noteBorderColor: css('--tip'),
    actorBkg: css('--surface'),
    actorBorder: css('--rule-strong'),
    actorTextColor: css('--ink'),
    actorLineColor: css('--rule-strong'),
    signalColor: css('--muted'),
    signalTextColor: css('--ink'),
    labelBoxBkgColor: css('--surface'),
    labelBoxBorderColor: css('--rule-strong'),
    labelTextColor: css('--ink'),
    loopTextColor: css('--muted'),
    activationBkgColor: css('--accent-soft'),
    activationBorderColor: css('--accent'),
    sequenceNumberColor: css('--bg'),
    // state / class / er
    labelColor: css('--ink'),
    altBackground: css('--bg'),
    attributeBackgroundColorOdd: css('--bg-raised'),
    attributeBackgroundColorEven: css('--surface'),
    // git/timeline/pie palette
    cScale0: css('--js-bg'), cScale1: css('--node-bg'), cScale2: css('--ts-bg'),
    cScale3: css('--db-bg'), cScale4: css('--sd-bg'), cScale5: css('--accent-soft'),
    xyChart: {
      backgroundColor: css('--bg-raised'),
      titleColor: css('--ink'),
      xAxisLabelColor: css('--muted'), yAxisLabelColor: css('--muted'),
      xAxisTitleColor: css('--text'), yAxisTitleColor: css('--text'),
      xAxisLineColor: css('--rule-strong'), yAxisLineColor: css('--rule-strong'),
      xAxisTickColor: css('--rule-strong'), yAxisTickColor: css('--rule-strong'),
      plotColorPalette: [css('--accent'), css('--js'), css('--pitfall'), css('--node'), css('--sd')].join(', '),
    },
    // architecture-beta (AWS icon diagrams)
    archEdgeColor: css('--muted'),
    archEdgeArrowColor: css('--muted'),
    archEdgeWidth: '2',
    archGroupBorderColor: css('--rule-strong'),
    archGroupBorderWidth: '1.5px',
    pie1: css('--js'), pie2: css('--node'), pie3: css('--ts'), pie4: css('--db'), pie5: css('--sd'),
  };
}

async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      // AWS service icons for architecture diagrams: service fn(aws:lambda)[Fn]
      // fetched only when a diagram actually uses an aws: icon
      m.default.registerIconPacks([
        { name: 'aws', loader: () => import('./aws-icons.json').then((j) => j.default as any) },
      ]);
      return m.default;
    });
  }
  const mermaid = await mermaidPromise;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: themeVariables(),
    securityLevel: 'strict',
    flowchart: { curve: 'basis', padding: 14, nodeSpacing: 40, rankSpacing: 48, htmlLabels: true },
    sequence: { mirrorActors: false, actorMargin: 60, messageMargin: 34, boxMargin: 8, noteMargin: 10, useMaxWidth: true },
    state: { useMaxWidth: true },
    // architecture-beta: smaller icons + more room between them so arrows
    // have space to land on an icon's edge instead of crossing it; a fixed
    // seed keeps the layout identical on every render and theme switch
    architecture: {
      iconSize: 60, padding: 34, fontSize: 12,
      idealEdgeLengthMultiplier: 1.7, nodeSeparation: 90, edgeElasticity: 0.45,
      randomize: false, seed: 7, useMaxWidth: true,
    } as any,
  });
  return mermaid;
}

const inline = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

interface Controller { destroy(): void; state(): number; setState(i: number): void }
const controllers = new WeakMap<HTMLElement, Controller>();
const zooms = new WeakMap<HTMLElement, ZoomController>();

async function renderFigure(fig: HTMLElement) {
  const src = fig.querySelector<HTMLElement>('.mmd-src')?.textContent ?? '';
  const stage = fig.querySelector<HTMLElement>('.mmd-stage')!;
  const prev = controllers.get(fig);
  const keep = prev ? prev.state() : -1;
  prev?.destroy();
  const prevZoom = zooms.get(fig);
  const keepZoom = prevZoom?.state();
  prevZoom?.destroy();
  zooms.delete(fig);
  try {
    const mermaid = await getMermaid();
    const { svg, bindFunctions } = await mermaid.render(`mmd-${++seq}`, src);
    stage.innerHTML = svg;
    stage.classList.add('ready');
    stage.removeAttribute('aria-hidden');
    const el = stage.querySelector('svg');
    if (el) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', fig.querySelector('figcaption')?.textContent ?? 'Diagram'); }
    bindFunctions?.(stage);
    const ctrl = attachPlayer(fig);
    if (ctrl) { controllers.set(fig, ctrl); if (keep >= 0) ctrl.setState(keep); }
    const zoom = attachZoom(fig);
    if (zoom) { zooms.set(fig, zoom); if (keepZoom) zoom.setState(keepZoom); }
  } catch (err) {
    console.warn('[diagram] failed to render', err, src);
    fig.dataset.error = String((err as Error)?.message ?? err).slice(0, 300);
    fig.classList.remove('is-max');
    document.documentElement.classList.remove('diagram-max');
    stage.innerHTML = `<pre class="mmd-error">${inline(src)}</pre>`;
    stage.classList.add('ready');
  }
}

function attachPlayer(fig: HTMLElement): Controller | null {
  const mode = fig.dataset.mode;
  if (mode === 'static') return null;
  const payload: Payload = JSON.parse(fig.dataset.payload || '{"steps":[],"notes":[]}');
  const svg = fig.querySelector<SVGSVGElement>('.mmd-stage svg');
  const player = fig.querySelector<HTMLElement>('.mmd-player');
  if (!svg || !player) return null;

  const playBtn = player.querySelector<HTMLButtonElement>('.mp-play')!;
  const prevBtn = player.querySelector<HTMLButtonElement>('.mp-prev')!;
  const nextBtn = player.querySelector<HTMLButtonElement>('.mp-next')!;
  const count = player.querySelector<HTMLElement>('.mp-count')!;
  const text = player.querySelector<HTMLElement>('.mp-text')!;

  let total = 0;
  let apply: (i: number) => void;

  if (mode === 'steps') {
    const steps = payload.steps;
    total = steps.length;
    const nodeEls = new Map<string, Element[]>();
    const addNode = (id: string, el: Element) => {
      if (!nodeEls.has(id)) nodeEls.set(id, []);
      nodeEls.get(id)!.push(el);
    };
    // flowchart nodes: <g class="node" id="<svgId>-flowchart-<NodeId>-<n>">
    svg.querySelectorAll('g.node').forEach((el) => {
      const m = el.id.match(/-flowchart-(.+)-\d+$/) ?? el.id.match(/-state-(.+)-\d+$/);
      if (m) addNode(m[1], el);
      const did = el.getAttribute('data-id');
      if (did) addNode(did, el);
    });
    // clusters (subgraphs) can be highlighted by their id too
    svg.querySelectorAll('g.cluster').forEach((el) => {
      const did = el.getAttribute('data-id') ?? el.id.replace(/^.*?-?(?=[^-]+$)/, '');
      if (did) addNode(did, el);
    });
    const edges = [...svg.querySelectorAll<SVGPathElement>('path.flowchart-link, path[data-id^="L_"]')];
    // every node id that has a rendered element, longest first so that
    // edge ids like L_api-gw_db_0 resolve to the most specific node name
    const ids = [...nodeEls.keys()].sort((a, b) => b.length - a.length);
    const edgeEnds = edges.map((p) => {
      const id = p.getAttribute('data-id') || p.id || '';
      for (const a of ids) for (const b of ids) {
        if (new RegExp(`^L[_-]${escapeRe(a)}[_-]${escapeRe(b)}[_-]\\d+$`).test(id)) return [a, b] as const;
      }
      return null;
    });
    const STATES = ['is-on', 'is-current', 'is-done', 'is-next'];
    const mark = (id: string, ...cls: string[]) => nodeEls.get(id)?.forEach((el) => {
      (el.closest('.node, .cluster') ?? el).classList.add(...cls);
    });
    apply = (i) => {
      svg.querySelectorAll(STATES.map((c) => '.' + c).join(',')).forEach((el) => el.classList.remove(...STATES));
      if (i < 0) { fig.classList.remove('stepping'); return; }
      fig.classList.add('stepping');
      const on = new Set(steps[i].nodes ?? []);
      const before = new Set(i > 0 ? steps[i - 1].nodes ?? [] : []);
      const done = new Set<string>();
      for (let k = 0; k < i; k++) (steps[k].nodes ?? []).forEach((id) => { if (!on.has(id)) done.add(id); });
      const next = new Set((steps[i + 1]?.nodes ?? []).filter((id) => !on.has(id)));
      done.forEach((id) => mark(id, 'is-done'));
      next.forEach((id) => mark(id, 'is-next'));
      on.forEach((id) => mark(id, 'is-on', ...(before.has(id) ? [] : ['is-current'])));
      const seen = (id: string) => on.has(id) || done.has(id);
      edges.forEach((p, k) => {
        const ends = edgeEnds[k];
        if (!ends) return;
        const [a, b] = ends;
        if (on.has(a) && on.has(b)) p.classList.add('is-on');
        else if (before.has(a) && on.has(b) && !before.has(b)) p.classList.add('is-on');
        else if (seen(a) && seen(b)) p.classList.add('is-done');
        else if (seen(a) && next.has(b)) p.classList.add('is-next');
      });
    };
  } else {
    // sequence: reveal messages one by one
    const lines = [...svg.querySelectorAll('.messageLine0, .messageLine1')];
    const labels = [...svg.querySelectorAll('.messageText')];
    total = lines.length;
    apply = (i) => {
      lines.forEach((l, k) => {
        l.classList.toggle('seq-hidden', i >= 0 && k > i);
        l.classList.toggle('seq-shown', i < 0 || k <= i);
        l.classList.toggle('seq-current', k === i);
      });
      labels.forEach((l, k) => {
        l.classList.toggle('seq-hidden', i >= 0 && k > i);
        l.classList.toggle('seq-shown', i < 0 || k <= i);
        l.classList.toggle('seq-current-label', k === i);
      });
    };
  }

  let i = -1;
  let timer: number | undefined;
  const intro = mode === 'steps' ? 'Press play, or step through it one stage at a time.' : 'Press play to watch the messages happen in order.';
  const describe = () => {
    if (i < 0) return intro;
    if (mode === 'steps') return payload.steps[i]?.text ?? '';
    return payload.notes[i] ?? '';
  };
  const render = () => {
    apply(i);
    count.textContent = i < 0 ? `${total} steps` : `${i + 1} / ${total}`;
    text.innerHTML = inline(describe());
    prevBtn.disabled = i < 0;
    nextBtn.disabled = i >= total - 1;
  };
  const stop = () => { window.clearInterval(timer); timer = undefined; player.classList.remove('playing'); playBtn.setAttribute('aria-label', 'Play'); };
  const play = () => {
    if (i >= total - 1) i = -1;
    player.classList.add('playing');
    playBtn.setAttribute('aria-label', 'Pause');
    const tick = () => {
      if (i >= total - 1) { stop(); return; }
      i += 1; render();
    };
    tick();
    timer = window.setInterval(tick, mode === 'steps' ? 2800 : 2000);
  };
  const onPlay = () => (timer ? stop() : play());
  const onPrev = () => { stop(); i = Math.max(-1, i - 1); render(); };
  const onNext = () => { stop(); i = Math.min(total - 1, i + 1); render(); };
  playBtn.addEventListener('click', onPlay);
  prevBtn.addEventListener('click', onPrev);
  nextBtn.addEventListener('click', onNext);
  render();

  // play once automatically the first time the reader scrolls to it
  let io: IntersectionObserver | null = null;
  if (!reduced() && !fig.dataset.autoplayed) {
    io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.intersectionRatio > 0.65) && !fig.dataset.autoplayed) {
        fig.dataset.autoplayed = '1';
        io?.disconnect();
        if (i < 0) play();
      }
    }, { threshold: [0.65] });
    io.observe(fig);
  }

  return {
    destroy() {
      stop(); io?.disconnect();
      playBtn.removeEventListener('click', onPlay);
      prevBtn.removeEventListener('click', onPrev);
      nextBtn.removeEventListener('click', onNext);
    },
    state: () => i,
    setState(n) { i = Math.min(total - 1, n); render(); },
  };
}

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function numberFigures() {
  const chapter = document.querySelector('.chapter-head .num')?.textContent?.match(/\d+/)?.[0];
  let n = 0;
  document.querySelectorAll<HTMLElement>('figure.diagram').forEach((fig) => {
    const label = fig.querySelector('.fig-n');
    if (!label) return;
    n += 1;
    label.textContent = chapter ? `Figure ${chapter}.${n}` : `Figure ${n}`;
  });
}

export function initDiagrams() {
  if (started) return;
  started = true;
  numberFigures();
  const figs = [...document.querySelectorAll<HTMLElement>('figure.diagram')];
  const rendered = new Set<HTMLElement>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const fig = e.target as HTMLElement;
      io.unobserve(fig);
      rendered.add(fig);
      enqueue(fig);
    }
  }, { rootMargin: '400px 0px' });
  figs.forEach((f) => io.observe(f));
  // ?diagrams=all renders everything up front (used by the content checker)
  if (new URLSearchParams(location.search).get('diagrams') === 'all') {
    figs.forEach((f) => { io.unobserve(f); rendered.add(f); enqueue(f); });
    queue.then(() => { (window as any).__diagramsDone = true; });
  }

  window.addEventListener('book:theme', () => {
    for (const fig of rendered) enqueue(fig);
  });
}
