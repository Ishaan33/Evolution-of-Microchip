import { prefersReduced } from '@/utils/dom';
const STEP = 1 / 240; // s; fixed spring step, so the feel does not change with the frame rate
const LIFT = 12; // world units a carried puck rises off the film
/**
 * A stand-in puck for the simulator, in stage percent. The DOM element is only the pointer target and the keyboard stop;
 * what you see is its 3D mesh. Follows the pointer exactly while lifted and springs to its place otherwise.
 */
export class Puck {
    el = document.createElement('div');
    chip;
    mesh;
    spring;
    /** left %, top %, width %, scale, lift (0 to 1): current value, velocity and target. */
    vals;
    vels = [0, 0, 0, 0, 0];
    tgts;
    prev;
    dragging = false;
    constructor(chip, mesh, pos, size, spring) {
        this.chip = chip;
        this.mesh = mesh;
        this.spring = spring;
        this.vals = [pos[0], pos[1], size, 1, 0];
        this.tgts = [...this.vals];
        this.prev = [pos[0], pos[1]];
        this.el.role = 'button';
        this.el.tabIndex = 0;
        this.setTarget(pos, size, false, false, false);
        this.draw();
    }
    setTarget(pos, size, dragging, seated, spotlit) {
        this.dragging = dragging;
        this.tgts = [pos[0], pos[1], size, 1, dragging ? 1 : spotlit ? 0.22 : 0];
        this.el.className = `puck ${dragging ? 'lifted' : ''} ${seated ? 'seated' : ''}`;
        // Above the HUD: a stand-in left on top of the chip must still be picked up, as a real one could be.
        this.el.style.zIndex = dragging ? 30 : 6;
        this.el.ariaLabel = `${this.chip.year} microchip puck. Press Enter to ${seated ? 'remove it from' : 'place it on'} a dock`;
        this.mesh.setGlow(dragging || seated ? 1 : spotlit ? 0.75 : 0);
        if (dragging) {
            // Only the position snaps: the rise and the growth still spring, so the lift can be felt.
            [this.vals[0], this.vals[1]] = pos;
            this.vels[0] = this.vels[1] = 0;
        }
        if (prefersReduced()) {
            this.vals[3] = this.tgts[3];
            this.vals[4] = this.tgts[4];
            this.vels[3] = this.vels[4] = 0;
        }
    }
    /** `place` converts a stage position at a height to world coordinates. */
    update(dt, place) {
        const { vals, vels, tgts } = this;
        if (!vals.every((v, i) => v === tgts[i])) {
            const { stiffness, damping } = this.spring;
            for (let left = dt; left > 0; left -= STEP) {
                const h = Math.min(left, STEP);
                for (let i = 0; i < 5; i++) {
                    vels[i] += (stiffness * (tgts[i] - vals[i]) - damping * vels[i]) * h;
                    vals[i] += vels[i] * h;
                }
            }
            vals.forEach((v, i) => {
                if (Math.abs(v - tgts[i]) < 0.001 && Math.abs(vels[i]) < 0.01) {
                    vals[i] = tgts[i];
                    vels[i] = 0;
                }
            });
            this.draw();
        }
        const safeDt = Math.max(dt, 1 / 240);
        const vx = (vals[0] - this.prev[0]) / safeDt;
        const vy = (vals[1] - this.prev[1]) / safeDt;
        this.prev = [vals[0], vals[1]];
        const z = 0.6 + vals[4] * LIFT;
        this.mesh.place(place(vals[0], vals[1], z), z, (vals[2] / 2) * vals[3], vx, vy, dt);
    }
    draw() {
        const [left, top, width] = this.vals;
        const s = this.el.style;
        s.left = `${left}%`;
        s.top = `${top}%`;
        s.width = `${width}%`;
    }
    destroy() {
        this.mesh.destroy();
        this.el.remove();
    }
}
