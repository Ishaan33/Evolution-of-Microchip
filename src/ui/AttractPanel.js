import { gsap } from 'gsap';
import { Swap } from '@/ui/Swap';
import { ERA } from '@/ui/tokens';
import { make, prefersReduced } from '@/utils/dom';
import { fmtSpeed, fmtTransistors } from '@/utils/metrics';
const LINE_EVERY = 3; // years shown per line
/** The journey in a sentence or two, worked out from the first and last chips so the words cannot disagree with the data. */
function journey(chips) {
    const a = chips[0];
    const z = chips[chips.length - 1];
    return [
        `${z.year - a.year} years, from ${fmtTransistors(a.transistors)} switches to ${fmtTransistors(z.transistors)}.`,
        `A clock that went from ${fmtSpeed(a.speedGHz)} to ${fmtSpeed(z.speedGHz)}.`,
        `From ${a.cores === 1 ? 'one processor' : `${a.cores} processors`} to ${z.cores}, working side by side.`,
    ];
}
/** The empty table, with no chip on show: the years turning over the wafer, the title and the invitation to lift a puck. */
export class AttractPanel {
    el = make('div', 'attract');
    chips;
    lines;
    year = make('div', 'big-year');
    swap;
    shown = null;
    tween = null;
    constructor(chips) {
        this.chips = chips;
        this.lines = journey(chips);
        const slot = make('div', 'attract-slot');
        const hint = make('p', 'hint', 'Lift a puck ');
        hint.append(make('b', '', 'and place it on a ring'));
        this.year.ariaHidden = 'true';
        this.el.append(this.year, make('h1', 'title', 'Evolution of the Microchip'), slot, hint);
        this.swap = new Swap(slot, { duration: 0.6, enterY: 6, exitY: -4 });
    }
    show(cycle) {
        if (cycle === this.shown)
            return;
        const from = this.shown === null ? this.chips[cycle].year : this.chips[this.shown].year;
        const to = this.chips[cycle].year;
        this.shown = cycle;
        this.year.style.color = ERA[cycle];
        this.tween?.kill();
        const state = { v: from };
        const draw = () => { this.year.textContent = String(Math.round(state.v)); };
        draw();
        // Back to the start of the loop it simply turns over; counting fifty years backwards would read as going back in time.
        this.tween = prefersReduced() || to < from
            ? gsap.set(state, { v: to, onComplete: draw })
            : gsap.to(state, { v: to, duration: 2.4, ease: 'power2.inOut', onUpdate: draw });
        const line = Math.floor(cycle / LINE_EVERY) % this.lines.length;
        this.swap.show(line, () => make('span', 'line', this.lines[line]));
    }
    destroy() {
        this.tween?.kill();
        this.swap.destroy();
        this.el.remove();
    }
}
