/** Lift a puck with a pointer and seat it on release; Enter or Space does the same from the keyboard. */
export function bindPuck(el, chip, { toStage, lift, move, drop, cancel, key }) {
    el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        lift(...toStage(e));
    });
    el.addEventListener('pointermove', (e) => move(...toStage(e)));
    el.addEventListener('pointerup', (e) => drop(...toStage(e)));
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ')
            return;
        e.preventDefault();
        key();
    });
}
/** Drag a hero chip to turn it; a tap opens it up into layers. `getCtl` returns the hero's current control state. */
export function bindGrab(el, getCtl, poke) {
    let start = null;
    let moved = 0;
    const release = (toggle) => {
        const c = getCtl();
        c.dragging = false;
        if (toggle && moved < 6)
            c.explode = !c.explode;
        start = null;
    };
    el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        start = [e.clientX, e.clientY];
        moved = 0;
        getCtl().dragging = true;
        poke();
    });
    el.addEventListener('pointermove', (e) => {
        if (!start)
            return;
        const dx = e.clientX - start[0];
        const dy = e.clientY - start[1];
        start = [e.clientX, e.clientY];
        moved += Math.abs(dx) + Math.abs(dy);
        const c = getCtl();
        c.dy += dx * 0.012;
        c.rx = Math.max(-1.4, Math.min(0.4, c.rx + dy * 0.01));
    });
    el.addEventListener('pointerup', () => release(true));
    el.addEventListener('pointercancel', () => release(false));
}
