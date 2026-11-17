// Motion for the panel. GSAP (vendor/gsap.min.js, a classic script that loads before the modules) runs page entrances,
// overlays, the music widget and the rolling numbers. Without it, with reduced motion, at night or in the burn-in
// friendly states, every helper here falls back to setting the end state at once: nothing depends on an animation.
const G = typeof window !== 'undefined' && window.gsap ? window.gsap : null;
const RM = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

if (G) {
  G.defaults({ ease: 'expo.out', duration: 0.6 });
  // no lag smoothing: after a stall (the screen was off, a slow page build) a tween jumps to where it should be by
  // now instead of resuming, so a widget can never be left half faded in
  G.ticker.lagSmoothing(0);
}

/** True while animating is worth it: GSAP loaded, motion allowed (system and Customize) and the panel awake. */
export const live = () => !!G && !RM?.matches && document.documentElement.dataset.motion !== 'off'
  && !document.body.classList.contains('night') && !document.hidden;

// Pages move as one piece: one element per page is cheap on any phone, and nothing on it ever waits to appear.
const gridOf = (section) => section?.querySelector(':scope > .grid') || null;

/**
 * A page arriving after a jump (keys, overview, a rule). It slides the last few pixels in from the side it came
 * from, fast: dir 1 = from the right, -1 = from the left, 0 = in place.
 */
export function enterPage(section, dir = 0) {
  const g = gridOf(section);
  if (!g || !live()) return;
  G.fromTo(g, { x: dir * 42, opacity: 0, scale: dir ? 1 : 0.985 }, {
    x: 0, opacity: 1, scale: 1, duration: 0.34, ease: 'power3.out', clearProps: 'transform,opacity', overwrite: true,
  });
}

/** The page going away before a jump. Resolves when it is out of sight (at once without motion). */
export function leavePage(section) {
  const g = gridOf(section);
  if (!g || !live()) return Promise.resolve();
  return new Promise((done) => {
    G.to(g, { opacity: 0, scale: 0.975, duration: 0.16, ease: 'power2.in', overwrite: true, onComplete: done });
  });
}

/** Clears what leavePage left on a page that is no longer in view. */
export function resetPage(section) {
  const g = gridOf(section);
  if (G && g) { G.killTweensOf(g); G.set(g, { clearProps: 'transform,opacity' }); }
}

/** Elements rising into view: overlays, sheets, overview tiles. */
export function rise(targets, { y = 16, scale = 1, stagger = 0, delay = 0, duration = 0.7 } = {}) {
  if (!live() || !targets || (targets.length === 0)) return;
  G.fromTo(targets, { opacity: 0, y, scale }, { opacity: 1, y: 0, scale: 1, duration, delay, stagger, clearProps: 'opacity,transform', overwrite: true });
}

/** A short, firm press response for buttons that do something on the computer. */
export function press(el) {
  if (!live() || !el) return;
  G.fromTo(el, { scale: 0.9 }, { scale: 1, duration: 0.55, ease: 'expo.out', clearProps: 'transform', overwrite: true });
}

const NUM = /^-?\d+(\.\d+)?$/;
/**
 * Sets a number's text, rolling from the old value to the new one when both are plain numbers with the same
 * precision ("42" -> "57", "22.7" -> "23.1"). Anything else ("—", "1.2k", a unit change) is set at once.
 */
export function roll(el, text) {
  if (!el) return;
  text = String(text);
  if (el._pbRoll ? el._pbTo === text : el.textContent === text) return;
  el._pbRoll?.kill();
  el._pbRoll = null;
  el._pbTo = text;
  const from = el.textContent; // mid-roll this is the value on screen, so a new target continues from there
  const dec = (text.split('.')[1] || '').length;
  if (!live() || !NUM.test(from) || !NUM.test(text) || (from.split('.')[1] || '').length !== dec || !el.offsetParent) {
    el.textContent = text;
    return;
  }
  const o = { v: parseFloat(from) };
  el._pbRoll = G.to(o, {
    v: parseFloat(text), duration: 0.7, ease: 'power3.out',
    onUpdate: () => { el.textContent = o.v.toFixed(dec); },
    onComplete: () => { el.textContent = text; el._pbRoll = null; },
  });
}

/** Replaces the text of a few lines with a short vertical wipe (a new track, a new headline). */
export function swap(els, texts) {
  const lead = els[0], key = texts.join('\u0000');
  if (lead._pbSwap === key) return; // already shown, or on its way in
  lead._pbSwap = key;
  if (G) G.killTweensOf(els); // a newer text replaces one still animating, so the older one can never land last
  const apply = () => els.forEach((e, i) => { e.textContent = texts[i]; });
  const changed = els.filter((e, i) => e.textContent !== texts[i]);
  if (!changed.length || !live() || !lead.offsetParent) {
    apply();
    if (G) G.set(els, { clearProps: 'opacity,transform' });
    return;
  }
  G.to(changed, {
    opacity: 0, y: -10, duration: 0.22, ease: 'power2.in', stagger: 0.03,
    onComplete: () => {
      apply();
      G.fromTo(changed, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.06, clearProps: 'opacity,transform' });
    },
  });
}

/** A new album cover: it comes in slightly large and settles, the backdrop fades under it. */
export function reveal(img, backdrop) {
  if (!live() || !img.offsetParent) return;
  G.fromTo(img, { scale: 1.12, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.1, ease: 'expo.out', clearProps: 'transform,opacity' });
  if (backdrop) G.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power2.out', clearProps: 'opacity' });
}

/** The record slides out of its sleeve while music plays, and back in when it stops. */
export function sleeve(disc, out) {
  if (!disc) return;
  const x = out ? '42%' : '0%';
  if (!live() || !disc.offsetParent) { if (G) G.set(disc, { x }); else disc.style.transform = `translateX(${x})`; return; }
  G.to(disc, { x, duration: out ? 1.1 : 0.7, ease: out ? 'expo.out' : 'power3.inOut', overwrite: true });
}
