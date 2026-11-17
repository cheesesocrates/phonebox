// Customize: the look of this panel, chosen on the phone itself (overview › Customize). The choices are stored on the
// phone (localStorage, PHONE_KEY) and laid over the computer's display settings (main.js withPhone), so nothing here
// changes the computer's settings or what another phone shows. Reset gives the computer's look back.
import { $, PHONE_KEY, applyPhone, cfg, h, haptic, openOverview, store, t } from './main.js';
import { rise } from './motion.js';

const THEMES = [['default', '#000', '#0a0a0a'], ['amoled', '#000', '#050505'], ['graphite', '#141414', '#1c1c1c'], ['midnight', '#04060d', '#0a0e19'], ['warm', '#0b0806', '#130e0b']];
const ACCENTS = ['#ffffff', '#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#2dd4bf', '#0a84ff', '#bf5af2', '#ff375f'];
const FONTS = [['default', 'var(--sans)'], ['mono', 'var(--mono)'], ['serif', 'Georgia, serif'], ['condensed', '"Roboto Condensed", "Arial Narrow", sans-serif'], ['rounded', 'Nunito, "Trebuchet MS", sans-serif']];
const SIZES = [85, 100, 115, 130];
const CARDS = ['default', 'flat', 'line', 'none'];
const RADII = [0, 3, 8, 14];
const GAPS = [4, 8, 14];
const ASCII = [['off', ' '], ['subtle', '.:'], ['bold', '#%']];

const mine = () => store.get(PHONE_KEY, {}) || {};
function save(fn) {
  const m = mine();
  fn(m);
  store.set(PHONE_KEY, m);
  haptic();
  applyPhone();
  render();
}
const setDisplay = (k, v) => save((m) => { m.display = { ...(m.display || {}), [k]: v }; });
const setLook = (k, v) => save((m) => { m.appearance = { ...(m.appearance || {}), [k]: v }; });
const setOwn = (k, v) => save((m) => { m[k] = v; });

/** One row: a label and its choices. Each choice is a button whose face shows the result, not a word for it. */
function group(label, choices, current, pick) {
  return h('div', 'cz-group', h('div', 'cz-label', label),
    h('div', 'cz-opts', choices.map(([value, face, title]) => {
      const b = h('button', 'cz-opt' + (String(value) === String(current) ? ' on' : ''), face);
      b.type = 'button';
      if (title) b.setAttribute('aria-label', title);
      b.addEventListener('click', (e) => { e.stopPropagation(); pick(value); });
      return b;
    })));
}

function render() {
  const d = cfg.display || {}, a = d.appearance || {}, m = mine();
  const sw = (bg, card) => { const e = h('i', 'cz-theme'); e.style.background = `linear-gradient(135deg, ${bg} 50%, ${card} 50%)`; return e; };
  const dot = (c) => { const e = h('i', 'cz-swatch'); e.style.background = c; return e; };
  const aa = (font) => { const e = h('span', 'cz-aa', 'Aa'); e.style.fontFamily = font; return e; };
  const corner = (r) => { const e = h('i', 'cz-corner'); e.style.borderRadius = r + 'px'; return e; };
  const gap = (g) => { const e = h('i', 'cz-gap', h('i'), h('i')); e.style.gap = Math.round(g / 2) + 'px'; return e; };
  const surface = (s) => h('i', 'cz-surface s-' + s);
  $('czBody').replaceChildren(
    group(t('cz.theme'), THEMES.map(([id, bg, card]) => [id, sw(bg, card), id]), d.theme || 'default', (v) => setDisplay('theme', v)),
    group(t('cz.accent'), ACCENTS.map((c) => [c, dot(c), c]), (d.accent || '#ffffff').toLowerCase(), (v) => setDisplay('accent', v)),
    group(t('cz.font'), FONTS.map(([id, fam]) => [id, aa(fam), id]), a.font || 'default', (v) => setLook('font', v)),
    group(t('cz.size'), SIZES.map((s) => [s, h('span', 'cz-size', h('b', null, 'A'), h('small', null, s + '%')), s + '%']), a.fontScale || 100, (v) => setLook('fontScale', v)),
    group(t('cz.cards'), CARDS.map((s) => [s, surface(s), s]), m.cards || 'default', (v) => setOwn('cards', v)),
    group(t('cz.corners'), RADII.map((r) => [r, corner(r), r + ' px']), m.radius ?? 3, (v) => setOwn('radius', v)),
    group(t('cz.spacing'), GAPS.map((g) => [g, gap(g), g + ' px']), a.gap ?? 8, (v) => setLook('gap', v)),
    group('ASCII', ASCII.map(([id, face]) => [id, h('span', 'cz-ascii', face === ' ' ? '—' : face), id]), m.ascii || 'subtle', (v) => setOwn('ascii', v)),
    group(t('cz.motion'), [['on', h('span', 'cz-word', t('cz.on'))], ['off', h('span', 'cz-word', t('cz.off'))]], m.motion === 'off' ? 'off' : 'on', (v) => setOwn('motion', v)),
    group(t('cz.seconds'), [[true, h('span', 'cz-word', ':37')], [false, h('span', 'cz-word', t('cz.off'))]], d.showSeconds !== false, (v) => setDisplay('showSeconds', v)),
  );
  $('czReset').disabled = !Object.keys(m).length;
}

export function openCustomize() {
  render();
  const sheet = $('custom');
  sheet.hidden = false;
  rise(sheet, { y: 10, scale: 0.99, duration: 0.3 });
}
export function closeCustomize(back = true) {
  $('custom').hidden = true;
  if (back) openOverview();
}

let wired = false;
/** Called once from main.js after every module has loaded (this module must not touch the DOM while it loads). */
export function initCustomize() {
  if (wired) return;
  wired = true;
  $('czDone').addEventListener('click', (e) => { e.stopPropagation(); haptic(); closeCustomize(); });
  $('czReset').addEventListener('click', (e) => { e.stopPropagation(); store.set(PHONE_KEY, {}); haptic(); applyPhone(); render(); });
  $('custom').addEventListener('click', (e) => e.stopPropagation());
}
