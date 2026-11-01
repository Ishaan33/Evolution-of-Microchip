import * as THREE from 'three';
import { StageRenderer } from '@/gl/StageRenderer';
import { Attract } from '@/interaction/attract';
import { classify } from '@/interaction/docking';
import { homePositions, layoutHeroes } from '@/layout/table';
import { chipTextures } from '@/gl/textures';
import { SimSensor } from '@/sensing/SimSensor';
import { TouchSensor } from '@/sensing/TouchSensor';
import { Chip } from '@/scene/Chip';
import { Conduits } from '@/scene/Conduits';
import { Film } from '@/scene/Film';
import { Dial } from '@/ui/Dial';
import { Hud } from '@/ui/Hud';
import { TableFace } from '@/ui/TableFace';
import { ERA } from '@/ui/tokens';
import { brandFont, prefersReduced } from '@/utils/dom';
import { ROWS } from '@/utils/metrics';
/** Which sensor to use: the query string wins (`?sensor=touch` or `?sensor=sim`), then config; "auto" looks for a multi-touch surface. */
function sensorMode(app) {
    const asked = new URLSearchParams(window.location.search).get('sensor');
    const mode = asked === 'touch' || asked === 'sim' ? asked : app.pucks.sensor;
    if (mode !== 'auto')
        return mode;
    return navigator.maxTouchPoints >= 5 ? 'touch' : 'sim';
}
/** An empty dock close to a position, for a puck being slid toward it. */
function nearDock(app, slots, x, y) {
    let found = null;
    app.dock.positions.forEach((p, i) => {
        if (!slots[i] && Math.hypot(p[0] - x, p[1] - y) < app.dock.snap * 1.7)
            found = i;
    });
    return found;
}
const newCtl = () => ({ rx: -0.62, ry: 0, dy: 0, explode: false, dragging: false });
/**
 * The whole exhibit: owns the state (where each puck is, the note on show), builds the table inside `.stage` and runs the
 * frame loop. Every state change ends in sync(), which brings the DOM and the 3D scene up to date.
 *
 * The pucks are real objects, so the sensor reports and the exhibit follows: it can never move a puck or take one off a
 * dock, and it knows nothing about a puck between the moment it leaves the surface and the moment it comes back.
 */
export class App {
    cfg;
    stage;
    gl = null;
    timer = new THREE.Timer();
    attract;
    face;
    film;
    conduits;
    dial;
    hud;
    home;
    sensor;
    /** Hero chips on show, by hero key. */
    heroes = new Map();
    /** Chips shrinking away after their key went. */
    leaving = new Set();
    chipTex = [];
    /** Turn and explode state of each hero slot, one per dock. */
    ctl = [newCtl(), newCtl()];
    /** Chip id -> {kind: home | dock | stray | air, x, y, slot, socket, since}. */
    where = {};
    idle = false;
    focus = null; // focused row key
    noteIdx = 0;
    cycle = 0;
    count = 0;
    noteCount = 0;
    destroyed = false;
    constructor(cfg, stage) {
        this.cfg = cfg;
        this.stage = stage;
    }
    async start() {
        const { app, chips } = this.cfg;
        // The chip lids are drawn with the brand font, so it has to be ready first.
        await Promise.all(['500', '600'].map((w) => document.fonts.load(`${w} 34px ${brandFont()}`)));
        const mode = sensorMode(app);
        const isKiosk = mode === 'touch' || new URLSearchParams(window.location.search).has('kiosk');
        if (isKiosk) this.stage.classList.add('kiosk');
        const faces = mode === 'sim' ? await SimSensor.faces(chips) : [];
        if (this.destroyed) {
            faces.forEach((t) => t.dispose());
            return;
        }
        this.home = homePositions(app, chips.length);
        const reduced = prefersReduced();
        const gl = (this.gl = new StageRenderer(this.stage, app.camera, app.bloom, isKiosk));
        this.chipTex = await Promise.all(chips.map((c, i) => chipTextures(c, ERA[i])));
        // Uploaded now, while nothing is moving, rather than in the middle of an animation.
        for (const { lid, die } of this.chipTex) {
            gl.renderer.initTexture(lid);
            gl.renderer.initTexture(die);
        }
        faces.forEach((t) => gl.renderer.initTexture(t));
        this.film = new Film(app, chips, this.home, reduced);
        this.conduits = new Conduits(app, this.film, reduced);
        gl.scene.add(this.film.mesh, this.conduits.group);
        this.face = new TableFace(app, chips, this.home);
        this.dial = new Dial(app, { onRow: (key) => this.toggleFocus(key) });
        this.stage.append(gl.canvas, this.face.el, this.dial.el);
        chips.forEach((c, i) => {
            this.where[c.id] = { kind: 'home', socket: i, x: this.home[i].x, y: this.home[i].y, since: 0 };
        });
        const sense = {
            down: (id, x, y) => this.puckDown(id, x, y),
            move: (id, x, y) => this.puckDown(id, x, y),
            up: (id) => this.puckUp(id),
        };
        if (mode === 'sim') {
            this.sensor = new SimSensor(app, chips, this.home, this.stage, gl.scene, faces, {
                ...sense, toStage: (e) => this.toStage(e),
                snap: (x, y, id) => this.snapped(x, y, id), toggle: (id) => this.simToggle(id),
            });
        }
        else {
            this.sensor = new TouchSensor(app, this.stage, sense);
            this.stage.classList.add('kiosk');
        }
        // A long press would otherwise raise the context menu, and a puck is one very long press.
        this.noMenu = (e) => e.preventDefault();
        window.addEventListener('contextmenu', this.noMenu);
        this.hud = new Hud(this.cfg, {
            ctl: this.ctl,
            poke: () => this.poke(),
            advanceNote: () => this.advanceNote(),
            clearFocus: () => this.clearFocus(),
            toggleFocus: (key) => this.toggleFocus(key),
        });
        this.stage.append(this.hud.el);
        this.attract = new Attract(app.timing, () => this.goIdle(), () => this.nextAttract());
        this.sync();
        const initDock = new URLSearchParams(window.location.search).get('dock');
        if (initDock) {
            initDock.split(',').forEach((cid) => {
                const c = chips.find((ch) => ch.id === cid || String(ch.year) === cid);
                if (c) this.simToggle(c.id);
            });
        }
        if (new URLSearchParams(window.location.search).has('explode')) {
            this.ctl.forEach((c) => { c.explode = true; });
        }
        this.timer.connect(document);
        gl.renderer.setAnimationLoop((t) => {
            this.timer.update(t);
            const dt = Math.min(this.timer.getDelta(), 0.25);
            this.tick(dt);
            gl.render(dt);
        });
    }
    destroy() {
        this.destroyed = true;
        this.timer.dispose();
        for (const chip of this.heroes.values())
            chip.destroy();
        this.heroes.clear();
        for (const chip of this.leaving)
            chip.destroy();
        for (const { lid, die } of this.chipTex) {
            lid.dispose();
            die.dispose();
        }
        this.sensor?.destroy();
        if (this.noMenu)
            window.removeEventListener('contextmenu', this.noMenu);
        this.hud?.destroy();
        this.dial?.destroy();
        this.conduits?.dispose();
        this.film?.dispose();
        this.gl?.dispose();
        this.stage.replaceChildren();
    }
    toStage(e) {
        const r = this.stage.getBoundingClientRect();
        return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100];
    }
    /** Any touch restarts the idle countdown. */
    poke() {
        this.attract.touch();
        if (this.idle) {
            this.idle = false;
            this.sync();
        }
    }
    /** Nobody at the table. The pucks stay where they were left, since only a person can move them. */
    goIdle() {
        this.attract.touch();
        this.idle = true;
        this.focus = null;
        this.noteIdx = 0;
        this.ctl.forEach((c) => { c.explode = false; });
        this.sync();
    }
    /** A puck touched down, or slid along the surface. */
    puckDown(id, x, y) {
        const was = this.where[id];
        const to = classify(this.cfg.app, this.home, this.where, id, x, y);
        const unsettled = to.kind === 'stray';
        this.where[id] = { ...to, x, y, since: unsettled ? (was.kind === 'stray' ? was.since : performance.now()) : 0 };
        if (to.kind === 'dock' && (was.kind !== 'dock' || was.slot !== to.slot)) {
            this.focus = null;
            this.noteIdx = 0;
            this.ctl[to.slot] = newCtl();
            this.film.shock(to.slot, ERA[this.cfg.chips.findIndex((c) => c.id === id)]);
        }
        this.poke();
        this.sync();
    }
    /** A puck left the surface. From here until it lands, it could be anywhere. */
    puckUp(id) {
        const was = this.where[id];
        this.where[id] = { kind: 'air', x: was.x, y: was.y, since: performance.now() };
        this.poke();
        this.sync();
    }
    /** The simulator settles a puck neatly; a person will not. */
    snapped(x, y, id) {
        // Let go outside the screen, a puck goes back to its own socket.
        if (Math.hypot(x - 50, y - 50) > 50) {
            const own = this.home[this.cfg.chips.findIndex((c) => c.id === id)];
            return [own.x, own.y];
        }
        const to = classify(this.cfg.app, this.home, this.where, id, x, y);
        if (to.kind === 'dock')
            return this.cfg.app.dock.positions[to.slot];
        return to.kind === 'home' ? [this.home[to.socket].x, this.home[to.socket].y] : [x, y];
    }
    /** Keyboard in the simulator: Enter puts a puck on the first free dock, or takes it back to its socket. */
    simToggle(id) {
        const { app, chips } = this.cfg;
        const i = chips.findIndex((c) => c.id === id);
        const docked = this.where[id].kind === 'dock';
        const taken = Object.values(this.where).filter((w) => w.kind === 'dock').map((w) => w.slot);
        const free = [0, 1].find((n) => !taken.includes(n));
        const [x, y] = docked || free === undefined ? [this.home[i].x, this.home[i].y] : app.dock.positions[free];
        this.puckUp(id);
        this.puckDown(id, x, y);
    }
    nextAttract() {
        if (this.held)
            return;
        this.cycle = (this.cycle + 1) % this.cfg.chips.length;
        this.sync();
    }
    advanceNote() {
        if (this.focus)
            this.focus = null;
        else
            this.noteIdx = (this.noteIdx + 1) % this.noteCount;
        this.poke();
        this.sync();
    }
    clearFocus() {
        this.focus = null;
        this.poke();
        this.sync();
    }
    toggleFocus(key) {
        this.focus = this.focus === key ? null : key;
        this.poke();
        this.sync();
    }
    /** The puck someone seems to have in hand: the latest one off its place, unless it has been gone too long. */
    findHeld(now) {
        const { airTimeout } = this.cfg.app.timing;
        let best = null;
        for (const [id, w] of Object.entries(this.where)) {
            if ((w.kind === 'air' || w.kind === 'stray') && now - w.since < airTimeout && (!best || w.since > best.since))
                best = { id, x: w.x, y: w.y, since: w.since };
        }
        return best;
    }
    /** Brings the DOM and the 3D scene in line with the current state. */
    sync() {
        const { app, chips } = this.cfg;
        const { where, focus, noteIdx, cycle } = this;
        const slots = [0, 1].map((i) => {
            const index = chips.findIndex((c) => where[c.id].kind === 'dock' && where[c.id].slot === i);
            return index < 0 ? null : { chip: chips[index], index };
        });
        const placed = slots.filter(Boolean);
        const count = placed.length;
        if (count !== this.count) {
            this.count = count;
            this.attract.touch();
            this.attract.restartCycle();
        }
        const single = count === 1 ? placed[0] : null;
        const pair = count === 2 ? placed : null;
        this.noteCount = single ? 2 + single.chip.facts.length : 0;
        const held = (this.held = this.findHeld(performance.now()));
        const heldIndex = held ? chips.findIndex((c) => c.id === held.id) : -1;
        const heldColor = held ? ERA[heldIndex] : null;
        // A puck sliding along the film can be seen coming, so its target dock can brighten. One in the air cannot.
        const stray = held && where[held.id].kind === 'stray';
        const near = stray ? nearDock(app, slots, held.x, held.y) : null;
        const heroes = layoutHeroes(app, chips, slots, count, ERA);
        const spotlit = count === 0 && !held ? cycle : -1;

        const socketTaken = chips.map((_, i) => chips.some((c) => where[c.id].kind === 'home' && where[c.id].socket === i));
        this.film.setSockets(chips.map((c, i) => ({
            light: socketTaken[i] ? (spotlit === i ? 1.5 : 0.42) : 0,
            // An empty socket calls its puck back once nobody seems to have it, or nobody is at the table.
            pulse: !socketTaken[i] && !held && (where[c.id].kind !== 'dock' || this.idle) ? 1 : 0,
        })));
        this.face.update({ empty: socketTaken.map((t) => !t) });
        this.sensor.sync({ where, spotlit });

        // Chip readings belong to a seated puck. Until then the table shows its own thing: the wafer.
        const toLane = (s) => s && { chip: s.chip, color: ERA[s.index] };
        this.film.setWafer(count > 0 ? 0 : held ? 0.3 : 1, cycle);
        this.film.setDrag(held, heldColor);
        this.film.setDocks(slots, held, near, heldColor);
        this.film.setSeats(slots.map((s) => (s ? [where[s.chip.id].x, where[s.chip.id].y] : null)));
        this.film.setLanes(slots.map(toLane), { paired: count === 2, norms: (r, c) => ROWS[r].norm(c) });
        this.film.setFocus(focus ? ROWS.findIndex((r) => r.key === focus) : null);
        this.conduits.setActive(slots);
        this.dial.update({ sides: slots });
        this.dial.setFocus(focus);

        this.syncHeroes(heroes);
        this.hud.update({
            slots, count, heroes, single, pair, drag: held, focus, noteIdx, cycle, noteCount: this.noteCount,
            focusRow: ROWS.find((r) => r.key === focus),
            dragChip: held ? { chip: chips[heldIndex], color: heldColor } : null,
        });
    }
    /** A hero stays while its key does; a new key builds a new chip, which assembles itself. */
    syncHeroes(heroes) {
        const keys = new Set(heroes.map((h) => h.key));
        for (const [key, chip] of this.heroes) {
            if (!keys.has(key)) {
                chip.leave();
                this.leaving.add(chip);
                this.heroes.delete(key);
            }
        }
        for (const h of heroes) {
            if (!this.heroes.has(h.key)) {
                const chip = new Chip(h, this.chipTex[h.index], (x, y, z) => this.gl.place(x, y, z));
                this.heroes.set(h.key, chip);
                this.gl.scene.add(chip.view);
            }
            else
                this.heroes.get(h.key).setHero(h);
        }
    }
    tick(dt) {
        const { gl } = this;
        this.attract.update(performance.now(), this.count);
        const place = (x, y, z) => gl.place(x, y, z);
        this.sensor.update(dt, place);
        // A lifted puck that never comes back stops holding the docks open.
        if (this.held && !this.findHeld(performance.now()))
            this.sync();
        this.film.update(dt, this.sensor.pucks, gl.px);
        this.conduits.update(dt);
        for (const chip of this.heroes.values())
            chip.update(dt, this.ctl);
        for (const chip of this.leaving) {
            chip.update(dt, this.ctl);
            if (chip.gone) {
                chip.destroy();
                this.leaving.delete(chip);
            }
        }
        this.lightHeroes(dt);
    }
    /** Tints the two fixed accent lights to whichever chips are on show. */
    lightHeroes(dt) {
        const on = [...this.heroes.values()];
        for (let i = 0; i < 2; i++) {
            const light = this.gl.accents[i];
            const chip = on[i];
            const target = chip ? chip.w * 16 : 0;
            light.intensity = THREE.MathUtils.damp(light.intensity, target, 4, dt);
            if (!chip)
                continue;
            light.color.set(chip.accent);
            light.position.set(chip.view.position.x, chip.view.position.y - chip.w * 0.45, 30);
        }
    }
}
