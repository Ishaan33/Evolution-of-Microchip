import * as THREE from 'three';
import { conduitFragment, conduitVertex } from '@/gl/shaders/film';
import { conduitPath } from '@/layout/table';
const WIDTH = 0.34;
/** A flat strip along a polyline, with its running length in `along`. */
function strip(points) {
    const pos = [];
    const along = [];
    const index = [];
    const lengths = [0];
    for (let i = 1; i < points.length; i++)
        lengths[i] = lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    const total = lengths[lengths.length - 1];
    points.forEach((pt, i) => {
        const a = points[Math.max(i - 1, 0)];
        const b = points[Math.min(i + 1, points.length - 1)];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l;
        const ny = dx / l;
        for (const side of [-1, 1]) {
            pos.push(pt[0] + (nx * side * WIDTH) / 2, pt[1] + (ny * side * WIDTH) / 2, 0.03);
            along.push(lengths[i] / total);
        }
        if (i) {
            const v = i * 2;
            index.push(v - 2, v - 1, v, v, v - 1, v + 1);
        }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
    g.setIndex(index);
    return { geometry: g, total };
}
/** Softens a corner: replaces each inner point with a short run of a quadratic curve. */
function rounded(points, r = 1.2, steps = 6) {
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
        const [p, q, n] = [points[i - 1], points[i], points[i + 1]];
        const lp = Math.hypot(p[0] - q[0], p[1] - q[1]);
        const ln = Math.hypot(n[0] - q[0], n[1] - q[1]);
        const cut = Math.min(r, lp / 2, ln / 2);
        if (cut < 0.01)
            continue;
        const a = [q[0] + ((p[0] - q[0]) * cut) / lp, q[1] + ((p[1] - q[1]) * cut) / lp];
        const b = [q[0] + ((n[0] - q[0]) * cut) / ln, q[1] + ((n[1] - q[1]) * cut) / ln];
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const m = 1 - t;
            out.push([m * m * a[0] + 2 * m * t * q[0] + t * t * b[0], m * m * a[1] + 2 * m * t * q[1] + t * t * b[1]]);
        }
    }
    out.push(points[points.length - 1]);
    return out;
}
/** The traces that carry a docked chip's readings from its dock up to the feet of the four bands. */
export class Conduits {
    group = new THREE.Group();
    sides;
    constructor(app, film, reduced) {
        this.film = film;
        this.reduced = reduced;
        this.sides = [0, 1].map((side) => {
            const color = new THREE.Color('#ffffff');
            const items = [0, 1, 2, 3].map((track) => {
                // Stage y runs down and world y up; the path is reversed so that "along" starts at the dock.
                const world = rounded(conduitPath(app, side, track)).reverse().map(([x, y]) => [x - 50, 50 - y]);
                const { geometry, total } = strip(world);
                const u = {
                    uTime: { value: 0 }, uReach: { value: 0 }, uLen: { value: total }, uGain: { value: 0 }, uColor: { value: color },
                };
                const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
                    vertexShader: conduitVertex, fragmentShader: conduitFragment, uniforms: u,
                    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
                }));
                this.group.add(mesh);
                return { u, mesh };
            });
            return { reach: 0, gain: 0, color, items };
        });
    }
    /** Conduits only run for a seated puck, never for the attract-mode preview. */
    setActive(slots) {
        this.active = slots.map(Boolean);
    }
    active = [false, false];
    update(dt) {
        const { film } = this;
        this.sides.forEach((s, i) => {
            const on = this.active[i];
            s.reach = this.reduced ? (on ? 1 : 0) : THREE.MathUtils.damp(s.reach, on ? 1 : 0, on ? 3.4 : 5, dt);
            s.gain = THREE.MathUtils.damp(s.gain, on ? 1 : 0, 5, dt);
            s.color.copy(film.u.uCol.value[i]);
            for (const { u, mesh } of s.items) {
                u.uTime.value = film.u.uTime.value;
                u.uReach.value = s.reach;
                u.uGain.value = s.gain;
                mesh.visible = s.gain > 0.004;
            }
        });
    }
    dispose() {
        this.group.removeFromParent();
        this.group.traverse((o) => {
            o.geometry?.dispose();
            o.material?.dispose();
        });
    }
}
