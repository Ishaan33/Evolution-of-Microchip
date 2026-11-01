const TAP_MS = 350;
const TAP_TRAVEL = 1.5; // stage percent
const sidesOf = (a, b, c) => [Math.hypot(a.x - b.x, a.y - b.y), Math.hypot(b.x - c.x, b.y - c.y), Math.hypot(c.x - a.x, c.y - a.y)].sort((p, q) => p - q);
/** The feet sit on a circle around the puck's centre, so the circumcentre is where the puck is however it is turned. */
function centreOf(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-6)
        return [(a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3];
    const [sa, sb, sc] = [a, b, c].map((p) => p.x * p.x + p.y * p.y);
    return [(sa * (b.y - c.y) + sb * (c.y - a.y) + sc * (a.y - b.y)) / d, (sa * (c.x - b.x) + sb * (a.x - c.x) + sc * (b.x - a.x)) / d];
}
/**
 * Real pucks on the touch surface. Each stands on three conductive feet, and the distances between them say which puck it
 * is. Feet are claimed here, before the interface sees them, so that a puck cannot press a button by being put down.
 * A puck in the air cannot be sensed: all this reports is down, moved along the surface, and up.
 */
export class TouchSensor {
    /** Nothing is drawn for a real puck. */
    pucks = [];
    touches = new Map(); // pointerId -> {x, y, puck}
    live = new Map(); // chip id -> {feet: Set, x, y, timer}
    constructor(app, stage, { down, move, up }) {
        this.toMm = app.display.diameterMm / 100;
        this.signatures = Object.entries(app.pucks.signatures);
        this.tol = app.pucks.footToleranceMm;
        this.span = Math.max(...this.signatures.map(([, s]) => s[2])) + this.tol;
        this.grace = app.timing.liftGrace;
        this.stage = stage;
        this.emit = { down, move, up };
        this.listeners = [
            ['pointerdown', (e) => this.onDown(e)], ['pointermove', (e) => this.onMove(e)],
            ['pointerup', (e) => this.onEnd(e)], ['pointercancel', (e) => this.onEnd(e)],
            ['click', (e) => this.onClick(e)],
        ];
        for (const [type, fn] of this.listeners)
            window.addEventListener(type, fn, { capture: true });
    }
    toStage(e) {
        const r = this.stage.getBoundingClientRect();
        return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100];
    }
    onDown(e) {
        if (e.pointerType !== 'touch')
            return;
        const [x, y] = this.toStage(e);
        this.touches.set(e.pointerId, { x, y, puck: null, sx: x, sy: y, cx: e.clientX, cy: e.clientY, at: performance.now(), travel: 0 });
        this.claim();
    }
    onMove(e) {
        const t = this.touches.get(e.pointerId);
        if (!t)
            return;
        [t.x, t.y] = this.toStage(e);
        t.travel = Math.max(t.travel, Math.hypot(t.x - t.sx, t.y - t.sy));
        if (t.puck)
            this.track(t.puck);
    }
    onEnd(e) {
        const t = this.touches.get(e.pointerId);
        if (!t)
            return;
        this.touches.delete(e.pointerId);
        if (!t.puck) {
            if (e.type === 'pointerup' && t.travel < TAP_TRAVEL && performance.now() - t.at < TAP_MS)
                this.tap(t);
            return;
        }
        const p = this.live.get(t.puck);
        p.feet.delete(t);
        // One foot flickering is not a lift, and neither is a brief loss of all three.
        if (p.feet.size < 2 && !p.timer)
            p.timer = setTimeout(() => this.settleLoss(t.puck), this.grace);
    }
    settleLoss(id) {
        const p = this.live.get(id);
        p.timer = null;
        if (p.feet.size >= 2)
            return;
        for (const foot of p.feet)
            foot.puck = null;
        this.live.delete(id);
        this.emit.up(id);
    }
    /** Hands free touches to any puck they belong to: first a puck missing a foot, then whole new triangles. */
    claim() {
        for (const [id, p] of this.live) {
            if (p.feet.size >= 3)
                continue;
            for (const t of this.free()) {
                if (p.feet.size < 3 && Math.hypot(t.x - p.x, t.y - p.y) * this.toMm < this.span) {
                    this.seat(t, id);
                }
            }
        }
        const free = this.free();
        for (let i = 0; i < free.length; i++) {
            for (let j = i + 1; j < free.length; j++) {
                for (let k = j + 1; k < free.length; k++) {
                    const id = this.identify(free[i], free[j], free[k]);
                    if (!id || (this.live.has(id) && this.live.get(id).feet.size >= 2))
                        continue;
                    this.adopt(id, [free[i], free[j], free[k]]);
                    this.claim();
                    return;
                }
            }
        }
    }
    free() { return [...this.touches.values()].filter((t) => !t.puck); }
    identify(a, b, c) {
        const sides = sidesOf(a, b, c).map((s) => s * this.toMm);
        if (sides[2] > this.span)
            return null;
        const hit = this.signatures.find(([, sig]) => sig.every((s, i) => Math.abs(s - sides[i]) <= this.tol));
        return hit?.[0] ?? null;
    }
    seat(t, id) {
        t.puck = id;
        this.live.get(id).feet.add(t);
    }
    adopt(id, feet) {
        const known = this.live.get(id);
        const [x, y] = centreOf(...feet);
        if (known) {
            clearTimeout(known.timer);
            known.timer = null;
            feet.forEach((t) => this.seat(t, id));
            this.track(id);
            return;
        }
        this.live.set(id, { feet: new Set(), x, y, timer: null });
        feet.forEach((t) => this.seat(t, id));
        this.emit.down(id, x, y);
    }
    /** Follows a puck slid along the surface. Position needs all three feet to be trusted. */
    track(id) {
        const p = this.live.get(id);
        if (p.feet.size < 3)
            return;
        const [x, y] = centreOf(...p.feet);
        if (Math.hypot(x - p.x, y - p.y) < 0.2)
            return;
        p.x = x;
        p.y = y;
        this.emit.move(id, x, y);
    }
    /**
     * Browsers stop producing clicks while other touches are held down, and on this table there always are some: a seated
     * puck would disable every button. So taps are read from the raw touches, and only a touch no puck has claimed counts.
     */
    tap(t) {
        document.elementFromPoint(t.cx, t.cy)?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: t.cx, clientY: t.cy }));
    }
    /** The browser's own click, when it does produce one, would be a second press of the same tap. */
    onClick(e) {
        if (e.isTrusted && e.pointerType === 'touch') {
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    }
    sync() { }
    update() { }
    destroy() {
        for (const [type, fn] of this.listeners)
            window.removeEventListener(type, fn, { capture: true });
        for (const p of this.live.values())
            clearTimeout(p.timer);
    }
}
