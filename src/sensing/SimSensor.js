import { puckTexture } from '@/gl/textures';
import { bindPuck } from '@/interaction/input';
import { puckSize } from '@/layout/table';
import { PuckMesh } from '@/scene/PuckMesh';
import { ERA } from '@/ui/tokens';
import { Puck } from '@/ui/Puck';
/**
 * Stand-in pucks for working without the table: drawn in 3D and moved with a mouse. It tells the exhibit only what the real
 * table could: up when picked up, down when set down, and nothing in between.
 */
export class SimSensor {
    pucks = [];
    carry = null; // {id, x, y}
    constructor(app, chips, home, stage, scene, faces, { down, up, snap, toggle, toStage }) {
        this.size = puckSize(app);
        this.home = home;
        this.chips = chips;
        this.pucks = chips.map((chip, i) => {
            const mesh = new PuckMesh(faces[i], ERA[i]);
            scene.add(mesh.view);
            const puck = new Puck(chip, mesh, [home[i].x, home[i].y], this.size, app.pucks.spring);
            bindPuck(puck.el, chip, {
                toStage,
                lift: (x, y) => {
                    this.carry = { id: chip.id, x, y };
                    up(chip.id);
                },
                move: (x, y) => {
                    if (this.carry?.id !== chip.id)
                        return;
                    this.carry = { id: chip.id, x, y };
                    this.place(chip.id);
                },
                drop: (x, y) => {
                    if (this.carry?.id !== chip.id)
                        return;
                    this.carry = null;
                    down(chip.id, ...snap(x, y, chip.id));
                },
                cancel: () => {
                    this.carry = null;
                    down(chip.id, home[i].x, home[i].y);
                },
                key: () => toggle(chip.id),
            });
            stage.append(puck.el);
            return puck;
        });
    }
    static faces(chips) { return Promise.all(chips.map((c, i) => puckTexture(c, ERA[i]))); }
    place(id) {
        const i = this.chips.findIndex((c) => c.id === id);
        const w = this.state?.where[id];
        const carried = this.carry?.id === id;
        const pos = carried ? [this.carry.x, this.carry.y] : w && w.kind !== 'air' ? [w.x, w.y] : [this.home[i].x, this.home[i].y];
        this.pucks[i].setTarget(pos, carried ? this.size * 1.08 : this.size, carried, w?.kind === 'dock', this.state?.spotlit === i);
    }
    sync(state) {
        this.state = state;
        for (const c of this.chips)
            this.place(c.id);
    }
    update(dt, place) {
        for (const p of this.pucks)
            p.update(dt, place);
    }
    destroy() { this.pucks.forEach((p) => p.destroy()); }
}
