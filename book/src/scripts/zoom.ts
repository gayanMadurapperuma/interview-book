/**
 * Zoom, pan and full-screen for a rendered <Diagram>.
 *
 *  - toolbar: − / + / percentage (click = reset) / full screen
 *  - Ctrl/⌘ + wheel or trackpad pinch zooms toward the cursor
 *    (in full screen, a plain wheel zooms too)
 *  - drag to pan once zoomed in (or any time in full screen)
 *  - two-finger pinch on touch screens, double-click toggles 1× ↔ 2.5×
 *  - keys while the figure has focus: + − 0, arrows pan, Esc leaves full screen
 *
 * Full screen is a fixed-position overlay on the figure itself, so the step /
 * sequence player keeps working inside it and works on iOS Safari too.
 */
export interface ZoomState { s: number; x: number; y: number }
export interface ZoomController {
  destroy(): void;
  state(): ZoomState;
  setState(z: ZoomState): void;
}

const MIN = 0.5;
const MAX = 8;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function attachZoom(fig: HTMLElement): ZoomController | null {
  const stage = fig.querySelector<HTMLElement>('.mmd-stage');
  const svg = stage?.querySelector<SVGSVGElement>(':scope > svg');
  const tools = fig.querySelector<HTMLElement>('.mmd-tools');
  if (!stage || !svg || !tools) return null;

  const pan = document.createElement('div');
  pan.className = 'mmd-pan';
  stage.insertBefore(pan, svg);
  pan.appendChild(svg);
  fig.classList.add('zoomable');

  const outBtn = tools.querySelector<HTMLButtonElement>('.mz-out')!;
  const inBtn = tools.querySelector<HTMLButtonElement>('.mz-in')!;
  const resetBtn = tools.querySelector<HTMLButtonElement>('.mz-reset')!;
  const maxBtn = tools.querySelector<HTMLButtonElement>('.mz-max')!;

  let s = 1, x = 0, y = 0;
  const isMax = () => fig.classList.contains('is-max');

  const apply = (animate = false) => {
    pan.classList.toggle('animate', animate && !reduced());
    pan.style.transform = s === 1 && x === 0 && y === 0 ? '' : `translate(${x}px, ${y}px) scale(${s})`;
    const zoomed = s !== 1 || x !== 0 || y !== 0;
    fig.classList.toggle('zoomed', zoomed);
    resetBtn.textContent = `${Math.round(s * 100)}%`;
    outBtn.disabled = s <= MIN;
    inBtn.disabled = s >= MAX;
  };

  /** Point (client coords) → coords relative to the pan box's untransformed origin. */
  const local = (cx: number, cy: number) => {
    const r = stage.getBoundingClientRect();
    return { px: cx - r.left - pan.offsetLeft, py: cy - r.top - pan.offsetTop };
  };
  const center = () => {
    const r = stage.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };

  const zoomAt = (next: number, cx: number, cy: number, animate = false) => {
    next = clamp(next, MIN, MAX);
    const { px, py } = local(cx, cy);
    x = px - ((px - x) * next) / s;
    y = py - ((py - y) * next) / s;
    s = next;
    apply(animate);
  };
  const zoomBy = (f: number) => { const { cx, cy } = center(); zoomAt(s * f, cx, cy, true); };
  const reset = (animate = true) => { s = 1; x = 0; y = 0; apply(animate); };

  // ---- full screen -------------------------------------------------------
  const setMax = (on: boolean) => {
    if (on === isMax()) return;
    fig.classList.toggle('is-max', on);
    document.documentElement.classList.toggle('diagram-max', on);
    maxBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    maxBtn.setAttribute('aria-pressed', String(on));
    reset(false);
    if (on) fig.focus({ preventScroll: true });
    else { maxBtn.focus({ preventScroll: true }); fig.scrollIntoView({ block: 'nearest' }); }
  };

  // ---- buttons -----------------------------------------------------------
  const onIn = () => zoomBy(1.4);
  const onOut = () => zoomBy(1 / 1.4);
  const onReset = () => reset();
  const onMax = () => setMax(!isMax());
  inBtn.addEventListener('click', onIn);
  outBtn.addEventListener('click', onOut);
  resetBtn.addEventListener('click', onReset);
  maxBtn.addEventListener('click', onMax);

  // ---- wheel / trackpad pinch -------------------------------------------
  const onWheel = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey || isMax())) return;
    e.preventDefault();
    const dy = clamp(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, -120, 120);
    zoomAt(s * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0025)), e.clientX, e.clientY);
  };
  stage.addEventListener('wheel', onWheel, { passive: false });

  // ---- drag + pinch ------------------------------------------------------
  const pointers = new Map<number, { x: number; y: number }>();
  let last: { x: number; y: number; d: number } | null = null;
  const snapshot = () => {
    const p = [...pointers.values()];
    if (p.length === 1) return { x: p[0].x, y: p[0].y, d: 0 };
    const [a, b] = p;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
  };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // one finger/mouse only grabs once zoomed (so the page still scrolls); two fingers always pinch
    if (pointers.size === 1 && !(fig.classList.contains('zoomed') || isMax())) { last = null; return; }
    if (pointers.size > 2) return;
    stage.setPointerCapture(e.pointerId);
    last = snapshot();
    fig.classList.add('grabbing');
    pan.classList.remove('animate');
  };
  const onMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!last || pointers.size > 2) return;
    const now = snapshot();
    if (now.d && last.d) zoomAt(s * (now.d / last.d), now.x, now.y);
    x += now.x - last.x;
    y += now.y - last.y;
    apply();
    last = now;
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    last = pointers.size && (fig.classList.contains('zoomed') || isMax()) ? snapshot() : null;
    if (!pointers.size) fig.classList.remove('grabbing');
  };
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);

  const onDbl = (e: MouseEvent) => {
    if (s > 1.05) reset();
    else zoomAt(2.5, e.clientX, e.clientY, true);
  };
  stage.addEventListener('dblclick', onDbl);

  // ---- keyboard ----------------------------------------------------------
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const step = 60;
    switch (e.key) {
      case '+': case '=': zoomBy(1.4); break;
      case '-': case '_': zoomBy(1 / 1.4); break;
      case '0': reset(); break;
      case 'f': case 'F': setMax(!isMax()); break;
      case 'Escape': if (!isMax()) return; setMax(false); break;
      case 'ArrowLeft': if (!fig.classList.contains('zoomed')) return; x += step; apply(true); break;
      case 'ArrowRight': if (!fig.classList.contains('zoomed')) return; x -= step; apply(true); break;
      case 'ArrowUp': if (!fig.classList.contains('zoomed')) return; y += step; apply(true); break;
      case 'ArrowDown': if (!fig.classList.contains('zoomed')) return; y -= step; apply(true); break;
      default: return;
    }
    e.preventDefault();
  };
  fig.addEventListener('keydown', onKey);
  // Esc should close full screen even if focus wandered outside the figure
  const onDocKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isMax() && !fig.contains(e.target as Node)) setMax(false);
  };
  document.addEventListener('keydown', onDocKey);

  apply();

  return {
    destroy() {
      inBtn.removeEventListener('click', onIn);
      outBtn.removeEventListener('click', onOut);
      resetBtn.removeEventListener('click', onReset);
      maxBtn.removeEventListener('click', onMax);
      fig.removeEventListener('keydown', onKey);
      document.removeEventListener('keydown', onDocKey);
      // the stage element survives re-renders, so its listeners must go too
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
      stage.removeEventListener('dblclick', onDbl);
      fig.classList.remove('zoomable', 'zoomed', 'grabbing');
      // is-max is deliberately kept: a theme re-render should not kick the reader out
    },
    state: () => ({ s, x, y }),
    setState(z) { s = clamp(z.s, MIN, MAX); x = z.x; y = z.y; apply(); },
  };
}
