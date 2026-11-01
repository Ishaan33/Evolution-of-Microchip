import * as THREE from 'three';
import { filmFragment, filmVertex } from '@/gl/shaders/film';
import { puckSize } from '@/layout/table';
import { COLORS, ERA } from '@/ui/tokens';
import { rowMarks, ROWS } from '@/utils/metrics';
const { damp } = THREE.MathUtils;
const SPRING = { k: 62, c: 11.5 }; // a touch under critical, so a band overshoots slightly and settles
const trackOf = (rowIndex) => ROWS.length - 1 - rowIndex;
/**
 * The film and the dial on it. App says what should be true (setDrag, setLanes...); update() eases the uniforms there.
 * Lane 0 grows from the left foot of the dial, lane 1 from the right, each from the side of its dock.
 */
export class Film {
    mesh;
    u;
    reduced;
    time = 0;
    wakeTarget = 0;
    wakeOn = false;
    glowTarget = [0, 0];
    nearTarget = [0, 0];
    takenTarget = [0, 0];
    gainTarget = [0, 0];
    spanTarget = [Math.PI, Math.PI];
    hiTarget = [0, 0, 0, 0];
    accentTarget = new THREE.Color(COLORS.gold);
    lanes = [0, 1].map(() => ({
        chip: null,
        color: new THREE.Color('#ffffff'),
        tracks: [0, 1, 2, 3].map(() => ({ v: 0, vel: 0, to: 0, at: 0 })),
    }));
    shockAge = [-1, -1];
    seatTarget = [null, null];
    socketTarget = [];
    constructor(app, chips, home, reduced) {
        this.app = app;
        this.reduced = reduced;
        const { dial, dock } = app;
        const world = dock.positions.map(([x, y]) => new THREE.Vector2(x - 50, 50 - y));
        this.u = {
            uTime: { value: 0 }, uPx: { value: 0.12 },
            uWake: { value: 0 }, uWakeR: { value: 0 }, uWakeO: { value: new THREE.Vector2() },
            uAccent: { value: new THREE.Color(COLORS.gold) }, uGold: { value: new THREE.Color(COLORS.gold) },
            uDock: { value: world }, uDockR: { value: dock.radius },
            uDockGlow: { value: new THREE.Vector2() }, uDockNear: { value: new THREE.Vector2() }, uDockTaken: { value: new THREE.Vector2() },
            uDockCol: { value: [new THREE.Color(COLORS.gold), new THREE.Color(COLORS.gold)] },
            uShock: { value: [new THREE.Vector4(-1, 0, 0, 0), new THREE.Vector4(-1, 0, 0, 0)] },
            uPucks: { value: Array.from({ length: 7 }, () => new THREE.Vector4(0, -500, 0, 0)) },
            uSeat: { value: world.map((v) => v.clone()) },
            uSockets: { value: home.map((h) => new THREE.Vector4(h.x - 50, 50 - h.y, 0, 0)) },
            uSocketCol: { value: ERA.map((c) => new THREE.Color(c)) },
            uPuckR: { value: puckSize(app) / 2 },
            uR0: { value: dial.inner }, uW: { value: dial.width }, uG: { value: dial.gap },
            uFrac: { value: new Float32Array(8) },
            uMarks: { value: new Float32Array(rowMarks(chips)) },
            uSpan: { value: new THREE.Vector2(Math.PI, Math.PI) }, uGain: { value: new THREE.Vector2() }, uStreams: { value: new THREE.Vector2(1, 1) },
            uCol: { value: [new THREE.Color('#ffffff'), new THREE.Color('#ffffff')] },
            uTrackHi: { value: new THREE.Vector4() },
        };
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShaderMaterial({ vertexShader: filmVertex, fragmentShader: filmFragment, uniforms: this.u }));
        this.mesh.renderOrder = -1;
    }
    /** A puck has come off the table (or gone back): the ripple starts under the puck. */
    setDrag(drag, color) {
        const on = !!drag;
        if (on && !this.wakeOn) {
            this.u.uWakeO.value.set(drag.x - 50, 50 - drag.y);
            this.u.uWakeR.value = this.reduced ? 200 : 0;
            this.u.uAccent.value.set(color);
        }
        this.wakeOn = on;
        this.wakeTarget = on ? 1 : 0;
        if (color)
            this.accentTarget.set(color);
    }
    setDocks(slots, drag, near, color) {
        [0, 1].forEach((i) => {
            const taken = !!slots[i] && slots[i].chip.id !== drag?.id;
            this.takenTarget[i] = taken ? 1 : 0;
            this.glowTarget[i] = drag && !taken ? 1 : 0;
            this.nearTarget[i] = near === i ? 1 : 0;
            // An empty dock keeps its last colour while its glow fades out.
            if (taken)
                this.u.uDockCol.value[i].set(ERA[slots[i].index]);
            else if (drag)
                this.u.uDockCol.value[i].set(color);
        });
    }
    /** Follows a puck to where it was really put down: nobody places one dead centre. */
    setSeats(seats) { this.seatTarget = seats; }
    /** `[{light, pulse}]` per socket. */
    setSockets(levels) { this.socketTarget = levels; }
    /** What each lane shows: `{chip, color}` or null. `preview` is the quieter attract-mode run; `paired` halves the reach. */
    setLanes(lanes, { preview, paired, norms }) {
        const now = this.time;
        const { stagger, conduitDelay, pairSpanDeg } = this.app.dial;
        lanes.forEach((next, i) => {
            const lane = this.lanes[i];
            const arriving = next && !lane.chip;
            const changed = next?.chip.id !== lane.chip?.id;
            this.gainTarget[i] = next ? (preview ? 0.62 : 1) : 0;
            this.spanTarget[i] = paired ? (pairSpanDeg * Math.PI) / 180 : Math.PI;
            if (next)
                lane.color.set(next.color);
            if (changed) {
                ROWS.forEach((_, r) => {
                    const t = lane.tracks[trackOf(r)];
                    t.to = next ? norms(r, next.chip) : 0;
                    t.at = now + (arriving && !preview ? conduitDelay : 0) + r * stagger;
                });
                if (next)
                    this.u.uStreams.value.setComponent(i, Math.max(1, next.chip.cores));
            }
            lane.chip = next?.chip ?? null;
        });
    }
    setFocus(rowIndex) {
        this.hiTarget = [0, 1, 2, 3].map((t) => (rowIndex !== null && t === trackOf(rowIndex) ? 1 : 0));
    }
    shock(slot, color) {
        this.shockAge[slot] = 0;
        const s = this.u.uShock.value[slot];
        const c = new THREE.Color(color);
        s.set(0, c.r, c.g, c.b);
    }
    update(dt, pucks, px) {
        const { u } = this;
        this.time += dt;
        u.uTime.value = this.reduced ? 0 : this.time;
        u.uPx.value = px;

        u.uWake.value = damp(u.uWake.value, this.wakeTarget, this.wakeOn ? 7 : 3.2, dt);
        if (this.wakeOn)
            u.uWakeR.value = Math.min(190, u.uWakeR.value + dt * (58 + u.uWakeR.value * 0.9));
        u.uAccent.value.lerp(this.accentTarget, 1 - Math.exp(-6 * dt));
        for (const [uni, target, rate] of [[u.uDockGlow, this.glowTarget, 6], [u.uDockNear, this.nearTarget, 11], [u.uDockTaken, this.takenTarget, 4]]) {
            uni.value.x = damp(uni.value.x, target[0], rate, dt);
            uni.value.y = damp(uni.value.y, target[1], rate, dt);
        }
        this.shockAge.forEach((age, i) => {
            if (age < 0)
                return;
            const next = age + dt;
            this.shockAge[i] = next > 3 ? -1 : next;
            u.uShock.value[i].x = this.shockAge[i];
        });

        u.uSeat.value.forEach((seat, i) => {
            const [x, y] = this.seatTarget[i] ?? this.app.dock.positions[i];
            seat.x = damp(seat.x, x - 50, 14, dt);
            seat.y = damp(seat.y, 50 - y, 14, dt);
        });
        this.socketTarget.forEach(({ light, pulse }, i) => {
            const k = u.uSockets.value[i];
            k.z = damp(k.z, light, 5, dt);
            k.w = damp(k.w, pulse, 5, dt);
        });

        const hi = u.uTrackHi.value;
        hi.set(damp(hi.x, this.hiTarget[0], 8, dt), damp(hi.y, this.hiTarget[1], 8, dt), damp(hi.z, this.hiTarget[2], 8, dt), damp(hi.w, this.hiTarget[3], 8, dt));

        this.lanes.forEach((lane, i) => {
            u.uGain.value.setComponent(i, damp(u.uGain.value.getComponent(i), this.gainTarget[i], 4.5, dt));
            u.uSpan.value.setComponent(i, damp(u.uSpan.value.getComponent(i), this.spanTarget[i], 4.2, dt));
            u.uCol.value[i].lerp(lane.color, 1 - Math.exp(-5 * dt));
            lane.tracks.forEach((t, k) => {
                if (this.reduced)
                    t.v = t.to;
                else if (this.time >= t.at) {
                    for (let left = dt; left > 0; left -= 1 / 240) {
                        const h = Math.min(left, 1 / 240);
                        t.vel += (SPRING.k * (t.to - t.v) - SPRING.c * t.vel) * h;
                        t.v += t.vel * h;
                    }
                }
                u.uFrac.value[i * 4 + k] = Math.max(0, t.v);
            });
        });

        pucks.forEach((p, i) => {
            const [x, y, width, scale, lift] = p.vals;
            u.uPucks.value[i].set(x - 50, 50 - y, (width / 2) * scale, lift);
        });
    }
    dispose() {
        this.mesh.removeFromParent();
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}
