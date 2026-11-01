/** Where a puck set down at x, y has ended up: on a free dock, in a free socket, or somewhere else on the film. */
export function classify(app, home, where, id, x, y) {
    const held = (test) => Object.entries(where).some(([other, w]) => other !== id && test(w));
    let slot = null;
    let best = app.dock.snap;
    app.dock.positions.forEach((p, i) => {
        const d = Math.hypot(p[0] - x, p[1] - y);
        if (d < best && !held((w) => w.kind === 'dock' && w.slot === i)) {
            best = d;
            slot = i;
        }
    });
    if (slot !== null)
        return { kind: 'dock', slot };
    const socket = home.findIndex((h, i) => Math.hypot(h.x - x, h.y - y) < app.pucks.socketTolerance
        && !held((w) => w.kind === 'home' && w.socket === i));
    return socket >= 0 ? { kind: 'home', socket } : { kind: 'stray' };
}
