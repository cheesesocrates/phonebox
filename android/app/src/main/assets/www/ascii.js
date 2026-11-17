// Live ASCII backgrounds. Some widgets get a faint field of characters behind their content that moves with what
// they show: rain or snow behind the weather, a waveform while music plays, a terminal-style history behind a metric,
// slow plasma behind a quote, stars at night. One shared timer draws only the fields on the page in view, about ten
// times a second, as plain text in a <pre>. Customize sets the level: off, subtle or bold (data-ascii on <html>).
const fields = new Set();
let level = 'subtle';
let timer = 0;
let cw = 0;
const LINE = 10; // px per row, the line-height in style.css (.ascii)
const STEP = 90; // ms per frame

export function setAsciiLevel(l) {
  level = ['off', 'subtle', 'bold'].includes(l) ? l : 'subtle';
  document.documentElement.dataset.ascii = level;
  for (const f of fields) f.dirty = true;
  if (level === 'off') for (const f of fields) { f.pre.textContent = ''; f.last = ''; }
  loop();
}

function charWidth() {
  if (cw) return cw;
  try {
    const g = document.createElement('canvas').getContext('2d');
    g.font = '9px "PB Mono", "Roboto Mono", monospace';
    cw = g.measureText('MMMMMMMMMM').width / 10;
  } catch (_) {}
  return (cw = cw || 5.4);
}
if (document.fonts?.ready) document.fonts.ready.then(() => { cw = 0; for (const f of fields) size(f); });

const ro = typeof ResizeObserver === 'function' ? new ResizeObserver((entries) => {
  for (const e of entries) for (const f of fields) if (f.box === e.target) size(f);
}) : null;
function size(f) {
  const cols = Math.max(0, Math.floor(f.box.clientWidth / charWidth()));
  const rows = Math.max(0, Math.floor(f.box.clientHeight / LINE));
  if (cols !== f.cols || rows !== f.rows) { f.cols = cols; f.rows = rows; f.state = null; f.dirty = true; }
}

/**
 * Adds a field behind a widget's content. draw(f, t, dt) returns the text: f.cols x f.rows characters, rows joined by
 * newlines. Set animated to false for fields that only change with their data (they redraw after set()).
 */
export function asciiField(box, draw, { animated = true, cls = '' } = {}) {
  const pre = document.createElement('pre');
  pre.className = 'ascii' + (cls ? ' ' + cls : '');
  pre.setAttribute('aria-hidden', 'true');
  // inline, so the widget font size (appearance.js scales style.css) never changes the character grid
  pre.style.fontSize = '9px';
  pre.style.lineHeight = LINE + 'px';
  box.classList.add('has-ascii');
  box.prepend(pre);
  const f = { box, pre, draw, animated, cols: 0, rows: 0, data: {}, state: null, page: null, last: '', dirty: true, at: 0 };
  fields.add(f);
  ro?.observe(box);
  size(f);
  loop();
  return {
    set(data) { Object.assign(f.data, data); f.dirty = true; },
    destroy() { fields.delete(f); ro?.unobserve(box); pre.remove(); loop(); },
  };
}

function loop() {
  const want = level !== 'off' && fields.size > 0;
  if (want && !timer) timer = setInterval(frame, STEP);
  else if (!want && timer) { clearInterval(timer); timer = 0; }
}

function frame() {
  if (document.hidden || document.body.classList.contains('night')) return;
  const still = document.documentElement.dataset.motion === 'off';
  const now = performance.now();
  for (const f of fields) {
    if (!f.box.isConnected) { fields.delete(f); ro?.unobserve(f.box); continue; } // the layout was rebuilt
    if (!f.page) f.page = f.box.closest('.page');
    // only the page in view, and only the card a Smart Stack shows
    if (f.page && !f.page.classList.contains('cur')) continue;
    if (f.box.closest('.stack-item:not(.active)')) continue;
    if (!f.cols && !f.rows) size(f);
    if (!f.cols || !f.rows) continue;
    if ((!f.animated || still) && !f.dirty) continue;
    const dt = f.at ? Math.min(0.25, (now - f.at) / 1000) : STEP / 1000;
    f.at = now;
    f.dirty = false;
    let s = '';
    try { s = f.draw(f, still ? 0 : now / 1000, still ? 0 : dt); } catch (_) {}
    if (s !== f.last) { f.pre.textContent = s; f.last = s; }
  }
}

// ---------------------------------------------------------------- patterns
const blank = (f) => Array.from({ length: f.rows }, () => Array(f.cols).fill(' '));
const join = (g) => g.map((r) => r.join('')).join('\n');
const put = (g, x, y, c) => { x |= 0; y |= 0; if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; };
const R = Math.random;

/** Slow interference plasma: a quiet texture for text widgets. */
export function plasma(f, t) {
  const ramp = '   ..:';
  let out = '';
  const cx = f.cols / 2, cy = f.rows / 2;
  for (let y = 0; y < f.rows; y++) {
    for (let x = 0; x < f.cols; x++) {
      const v = Math.sin(x * 0.13 + t * 0.7) + Math.sin(y * 0.31 - t * 0.9) + Math.sin((x + y * 2) * 0.07 + t * 0.4)
        + Math.sin(Math.hypot(x - cx, (y - cy) * 2.2) * 0.2 - t * 1.1);
      out += ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(((v + 4) / 8) * ramp.length)))];
    }
    if (y < f.rows - 1) out += '\n';
  }
  return out;
}

/** Twinkling stars, fixed in place. */
export function stars(f, t) {
  if (!f.state) f.state = Array.from({ length: Math.max(4, (f.cols * f.rows / 26) | 0) }, () => ({ x: R() * f.cols, y: R() * f.rows, p: R() * 6.3, s: 0.6 + R() * 1.8 }));
  const g = blank(f);
  for (const s of f.state) {
    const v = Math.sin(t * s.s + s.p);
    put(g, s.x, s.y, v > 0.85 ? '*' : v > 0.3 ? '+' : v > -0.4 ? '.' : ' ');
  }
  return join(g);
}

/**
 * Weather: f.data.kind is rain, drizzle, storm, snow, fog, cloud, clear or night. Falling things keep their place
 * between frames (f.state), so the field moves instead of flickering.
 */
export function weather(f, t, dt) {
  const kind = f.data.kind || 'cloud';
  if (kind === 'night') return stars(f, t);
  if (kind === 'clear') return sun(f, t);
  if (kind === 'cloud' || kind === 'fog') return drift(f, t, kind === 'fog' ? '~-' : ' .:');
  const snow = kind === 'snow';
  const dense = kind === 'storm' ? 6 : kind === 'drizzle' ? 22 : 12;
  if (!f.state || f.state.kind !== kind) {
    f.state = { kind, p: Array.from({ length: Math.max(3, (f.cols * f.rows / dense) | 0) }, () => ({ x: R() * f.cols, y: R() * f.rows, v: snow ? 1.2 + R() * 1.6 : 9 + R() * 8, w: R() * 6.3 })) };
  }
  const g = blank(f);
  for (const p of f.state.p) {
    p.y += p.v * dt;
    if (snow) p.x += Math.sin(t * 0.8 + p.w) * dt * 1.2;
    else p.x += dt * 2.2; // a little wind
    if (p.y >= f.rows) { p.y -= f.rows + R() * 2; p.x = R() * f.cols; }
    if (p.x >= f.cols) p.x -= f.cols;
    if (snow) put(g, p.x, p.y, p.v > 2.2 ? '*' : '.');
    else { put(g, p.x, p.y, '/'); if (kind !== 'drizzle') put(g, p.x - 0.5, p.y - 1, '.'); }
  }
  if (kind === 'storm' && Math.sin(t * 0.7) > 0.985) for (let y = 0; y < f.rows; y++) for (let x = 0; x < f.cols; x += 2) if (g[y][x] === ' ') g[y][x] = '.';
  return join(g);
}

function sun(f, t) {
  const cx = f.cols - Math.min(9, f.cols / 4), cy = Math.min(3, f.rows / 3);
  let out = '';
  for (let y = 0; y < f.rows; y++) {
    for (let x = 0; x < f.cols; x++) {
      const dx = (x - cx) * 0.5, dy = y - cy, d = Math.hypot(dx, dy);
      let c = ' ';
      if (d < 1.3) c = '@';
      else if (d < 2.1) c = 'o';
      else {
        const a = Math.atan2(dy, dx) * 6 / Math.PI + t * 0.4; // 12 rays, turning slowly
        const ray = Math.abs(a - Math.round(a)) < 0.12;
        if (ray && d < 9) c = d < 4.5 ? '-' : '.';
      }
      out += c;
    }
    if (y < f.rows - 1) out += '\n';
  }
  return out;
}

function drift(f, t, ramp) {
  let out = '';
  for (let y = 0; y < f.rows; y++) {
    for (let x = 0; x < f.cols; x++) {
      const v = Math.sin(x * 0.11 - t * 0.5 + Math.sin(y * 0.4)) + Math.sin(y * 0.6 + x * 0.03 + t * 0.2);
      out += v > 1.15 ? ramp[ramp.length - 1] : v > 0.7 ? ramp[Math.max(0, ramp.length - 2)] : ' ';
    }
    if (y < f.rows - 1) out += '\n';
  }
  return out;
}

/** Music: two waves while something plays, a flat line when it is paused. */
export function wave(f, t) {
  const g = blank(f);
  const on = !!f.data.playing;
  const amp = on ? 1 : 0.06;
  const mid = (f.rows - 1) / 2;
  for (let x = 0; x < f.cols; x++) {
    const env = 0.55 + 0.45 * Math.sin(x * 0.045 + t * 0.6);
    const a = mid + Math.sin(x * 0.22 + t * 3.1) * mid * 0.8 * amp * env;
    const b = mid + Math.sin(x * 0.13 - t * 2.3 + 1.7) * mid * 0.55 * amp;
    put(g, x, b, '.');
    put(g, x, a, on ? '~' : '-');
  }
  return join(g);
}

/** A metric's history as terminal-style columns, newest on the right. f.data.series: values from 0 to 1. */
export function history(f) {
  const s = f.data.series || [];
  const g = blank(f);
  const n = Math.min(f.cols, s.length);
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(1, s[s.length - n + i] || 0));
    const x = f.cols - n + i;
    const top = f.rows - v * f.rows;
    for (let y = f.rows - 1; y >= 0; y--) {
      if (y + 1 <= top) break;
      put(g, x, y, y < top ? '.' : y < top + 1 ? ':' : '|');
    }
  }
  return join(g);
}

/** Air quality: dust that drifts; more of it the worse the air (f.data.amount 0…1). */
export function dust(f, t, dt) {
  const want = Math.max(2, Math.round(f.cols * f.rows * (0.01 + (f.data.amount || 0) * 0.08)));
  if (!f.state) f.state = [];
  while (f.state.length < want) f.state.push({ x: R() * f.cols, y: R() * f.rows, vx: (R() - 0.5) * 1.5, vy: (R() - 0.5) * 0.8, c: R() < 0.3 ? '*' : R() < 0.5 ? 'o' : '.' });
  f.state.length = want;
  const g = blank(f);
  for (const p of f.state) {
    p.x = (p.x + p.vx * dt + f.cols) % f.cols;
    p.y = (p.y + p.vy * dt + Math.sin(t + p.x) * 0.2 * dt + f.rows) % f.rows;
    put(g, p.x, p.y, p.c);
  }
  return join(g);
}

/** Rings that open out from the middle, slowly: behind the breathing exercise. */
export function ripple(f, t) {
  const cx = (f.cols - 1) / 2, cy = (f.rows - 1) / 2;
  let out = '';
  for (let y = 0; y < f.rows; y++) {
    for (let x = 0; x < f.cols; x++) {
      const d = Math.hypot((x - cx) * 0.5, y - cy);
      const v = Math.sin(d * 0.9 - t * 1.2);
      out += v > 0.94 ? '.' : v > 0.8 ? '·' : ' ';
    }
    if (y < f.rows - 1) out += '\n';
  }
  return out;
}
