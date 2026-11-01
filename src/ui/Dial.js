import { gsap } from 'gsap';
import { trackRadius } from '@/layout/table';
import { prefersReduced } from '@/utils/dom';
import { ROWS } from '@/utils/metrics';
const SVG = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
    const el = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs))
        el.setAttribute(k, v);
    return el;
};
/** Counts along the row's own scale: multiplicatively for measurements, so the early digits do not fly past. */
const between = (row, from, to, t) => (row.key === 'year' ? from + (to - from) * t : from * Math.pow(to / from, t));
/** One run of curved text in a track: optional small label, then a value that counts when it changes. */
class Readout {
    el;
    lbl;
    val;
    row;
    shown = 0;
    value = null;
    tween = null;
    labelKey = null;
    constructor(row, pathId, anchor, offset) {
        this.row = row;
        this.el = svg('text', { class: 'dial-text', 'text-anchor': anchor, opacity: 0 });
        const path = svg('textPath', { href: `#${pathId}`, startOffset: offset });
        this.lbl = svg('tspan', { class: 'dial-lbl' });
        this.val = svg('tspan', { class: 'dial-val' });
        path.append(this.lbl, this.val);
        this.el.append(path);
    }
    /** `label` may be empty; `text` shows a fixed string, otherwise `target` is counted up to with the row's format. */
    show({ label = '', text, target, delay = 0 }) {
        const relabel = label !== this.labelKey;
        this.labelKey = label;
        const write = () => {
            this.lbl.textContent = label;
            this.val.setAttribute('dx', label ? '0.9' : '0');
        };
        if (!this.shown)
            write();
        else if (relabel)
            write();
        if (text !== undefined) {
            this.tween?.kill();
            this.val.textContent = text;
        }
        else
            this.count(target, delay);
        if (!this.shown) {
            this.shown = 1;
            gsap.to(this.el, { opacity: 1, duration: 0.5, delay, ease: 'power2.out', overwrite: 'auto' });
        }
    }
    count(target, delay) {
        if (this.value === target)
            return;
        const from = this.value ?? this.row.floor;
        this.value = target;
        this.tween?.kill();
        const { row } = this;
        const state = { t: 0 };
        const draw = () => { this.val.textContent = row.fmt(state.t >= 1 ? target : between(row, from, target, state.t)); };
        draw();
        this.tween = prefersReduced()
            ? gsap.set(state, { t: 1, onComplete: draw })
            : gsap.to(state, { t: 1, duration: 1.15, delay, ease: 'expo.out', onUpdate: draw });
    }
    hide() {
        if (!this.shown)
            return;
        this.shown = 0;
        this.value = null;
        this.tween?.kill();
        gsap.to(this.el, { opacity: 0, duration: 0.25, ease: 'power2.in', overwrite: 'auto' });
    }
    destroy() {
        this.tween?.kill();
        gsap.killTweensOf(this.el);
    }
}
/**
 * The words on the concentric bands: a reading at each foot, and when two chips are docked, the row and how far apart they
 * are at the crown. The bands themselves are drawn by the film shader; this layer sits on top and takes the taps.
 */
export class Dial {
    el = svg('svg', { class: 'layer dial', viewBox: '0 0 100 100', role: 'group', 'aria-label': 'Chip readings' });
    rows;
    constructor(app, { onRow }) {
        this.el.style.zIndex = 1;
        const defs = svg('defs');
        this.el.append(defs);
        this.rows = ROWS.map((row, i) => {
            const track = ROWS.length - 1 - i;
            const r = trackRadius(app, track);
            const id = `dial-${row.key}`;
            // The baseline sits below the track's centre line so the type looks centred inside the band.
            const b = r - 0.88;
            defs.append(svg('path', { id, d: `M ${50 - b} 50 A ${b} ${b} 0 0 1 ${50 + b} 50` }));
            const hit = svg('path', {
                class: 'dial-hit', d: `M ${50 - r} 50 A ${r} ${r} 0 0 1 ${50 + r} 50`, 'stroke-width': app.dial.width,
                role: 'button', tabindex: 0, 'aria-label': `${row.label}: what does this measure?`,
            });
            const press = () => onRow(row.key);
            hit.addEventListener('click', press);
            hit.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ')
                    return;
                e.preventDefault();
                press();
            });
            const left = new Readout(row, id, 'start', '3.5%');
            const right = new Readout(row, id, 'end', '96.5%');
            const crown = new Readout(row, id, 'middle', '50%');
            this.el.append(hit, left.el, right.el, crown.el);
            return { row, left, right, crown, hit };
        });
    }
    /** `sides`: the chip on each side, or null. `preview`: attract mode, with no taps. */
    update({ sides, preview, dim }) {
        const paired = !!(sides[0] && sides[1]);
        this.el.classList.toggle('preview', preview);
        this.el.classList.toggle('dim', dim);
        this.rows.forEach(({ row, left, right, crown, hit }, i) => {
            const delay = preview ? i * 0.06 : 0.3 + i * 0.09;
            [[left, sides[0]], [right, sides[1]]].forEach(([out, s]) => {
                if (s)
                    out.show({ label: paired ? '' : row.label, target: row.get(s.chip), delay });
                else
                    out.hide();
            });
            if (paired)
                crown.show({ label: row.label, text: row.compare(sides[1].chip, sides[0].chip), delay });
            else
                crown.hide();
            hit.style.pointerEvents = preview ? 'none' : '';
            hit.setAttribute('tabindex', preview ? -1 : 0);
        });
    }
    setFocus(key) {
        for (const { row, hit } of this.rows) {
            hit.classList.toggle('on', row.key === key);
            hit.setAttribute('aria-pressed', String(row.key === key));
        }
    }
    destroy() {
        for (const { left, right, crown } of this.rows)
            [left, right, crown].forEach((r) => r.destroy());
        this.el.remove();
    }
}
