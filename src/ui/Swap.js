import { gsap } from 'gsap';
import { prefersReduced } from '@/utils/dom';
/** One slot of content that changes by key: the old content leaves first, then the newest content arrives. */
export class Swap {
    parent;
    opts;
    key = undefined;
    current = null;
    pending = null;
    leaving = false;
    /** opts: `duration` (s), `enterY` and `exitY` (px). */
    constructor(parent, opts) {
        this.parent = parent;
        this.opts = opts;
    }
    show(key, build) {
        if (key === this.key)
            return;
        this.key = key;
        this.pending = build;
        if (!this.current) {
            this.enter();
            return;
        }
        if (this.leaving)
            return;
        this.leaving = true;
        const { duration, exitY } = this.opts;
        gsap.killTweensOf(this.current);
        const to = { opacity: 0, duration, ease: 'power1.inOut', onComplete: () => this.enter() };
        if (exitY && !prefersReduced())
            to.y = exitY;
        gsap.to(this.current, to);
    }
    enter() {
        const old = this.current;
        old?.remove();
        this.leaving = false;
        this.current = this.pending();
        this.pending = null;
        this.parent.prepend(this.current);
        const { duration, enterY } = this.opts;
        if (!old) {
            this.current.style.opacity = '1';
            return;
        }
        gsap.fromTo(this.current, { opacity: 0, y: prefersReduced() ? 0 : enterY }, { opacity: 1, y: 0, duration, ease: 'power2.out' });
    }
    destroy() {
        if (this.current)
            gsap.killTweensOf(this.current);
    }
}
