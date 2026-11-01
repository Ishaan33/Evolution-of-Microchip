import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS } from '@/ui/tokens';
const GOLD = COLORS.gold;
const { damp } = THREE.MathUtils;
const HOVER = 8; // world units above the film
/** One hero chip. It starts as a loose stack of layers and settles together, so a new chip assembles itself. */
export class Chip {
    view = new THREE.Group();
    root = new THREE.Group();
    frame;
    die;
    lid;
    dieMat;
    w;
    t;
    ci;
    appear = 0;
    explode = 1;
    spin = 1.1;
    pose = [0, 0];
    leaving = false;
    constructor(hero, textures, place) {
        const { index, w, accent } = hero;
        this.place = place;
        this.accent = accent;
        const t = w * 0.1;
        const perSide = Math.round(18 - 9 * (index / 6));
        const { lid: lidTex, die: dieTex } = textures;
        this.w = w;
        this.t = t;
        const rounded = (size, material, r = 0.012) => {
            const m = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 3, Math.min(w * r, size[2] * 0.48)), material);
            this.root.add(m);
            return m;
        };
        rounded([w, w, t * 0.3], new THREE.MeshStandardMaterial({ color: '#191c22', metalness: 0.45, roughness: 0.55 }), 0.03);
        this.frame = rounded([w * 0.9, w * 0.9, t * 0.22], new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.3 }));
        this.dieMat = new THREE.MeshStandardMaterial({ map: dieTex, emissiveMap: dieTex, emissive: '#ffffff', emissiveIntensity: 0.5, metalness: 0.55, roughness: 0.32 });
        this.die = rounded([w * 0.52, w * 0.52, t * 0.3], this.dieMat, 0.004);
        // The lid is a metal cap with its printed face set just above: rounded boxes do not map one texture per side.
        this.lid = rounded([w * 0.84, w * 0.84, t * 0.62], new THREE.MeshStandardMaterial({ color: '#1b1d23', metalness: 0.82, roughness: 0.38 }), 0.03);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.79, w * 0.79), new THREE.MeshStandardMaterial({ map: lidTex, metalness: 0.55, roughness: 0.42 }));
        face.position.z = t * 0.31 + 0.002 * w;
        this.lid.add(face);
        const span = w * 0.8;
        const e = w * 0.5 + w * 0.04;
        const places = [];
        for (let i = 0; i < perSide; i++) {
            const p = -span / 2 + (span * i) / (perSide - 1);
            places.push([p, e, Math.PI / 2], [p, -e, Math.PI / 2], [e, p, 0], [-e, p, 0]);
        }
        const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(w * 0.095, w * 0.018, t * 0.14), new THREE.MeshStandardMaterial({ color: '#e4d6ac', metalness: 1, roughness: 0.24 }), places.length);
        const dummy = new THREE.Object3D();
        places.forEach((p, i) => {
            dummy.position.set(p[0], p[1], 0);
            dummy.rotation.z = p[2];
            dummy.updateMatrix();
            pins.setMatrixAt(i, dummy.matrix);
        });
        pins.instanceMatrix.needsUpdate = true;
        this.root.add(pins);
        this.view.add(this.root);
        this.setHero(hero);
        this.view.position.set(...this.place(this.pose[0], this.pose[1], HOVER), 0);
    }
    setHero(hero) {
        this.ci = hero.ctl;
        this.pose = hero.pos;
    }
    update(dt, ctl) {
        const { w, t, root } = this;
        const c = ctl[this.ci];
        this.appear = damp(this.appear, this.leaving ? 0 : 1, this.leaving ? 11 : 5.5, dt);
        this.explode = damp(this.explode, c.explode ? 1 : 0, 3.6, dt);
        this.spin = damp(this.spin, 0, 2.6, dt);
        if (!c.dragging)
            c.ry += dt * 0.42;
        const [x, y] = this.place(this.pose[0], this.pose[1], HOVER);
        this.view.position.x = damp(this.view.position.x, x, 5, dt);
        this.view.position.y = damp(this.view.position.y, y, 5, dt);
        // Scale, not fade: toggling material.transparent selects another shader program, and compiling it drops frames.
        root.scale.setScalar(Math.max(0.001, this.appear));
        root.position.z = HOVER + Math.sin(c.ry * 1.3) * 0.5;
        root.rotation.x = c.rx + Math.sin(c.ry * 0.71) * 0.05;
        root.rotation.y = Math.sin(c.ry) * 0.3 + c.dy + this.spin;
        this.frame.position.z = t * 0.26 + this.explode * w * 0.1;
        this.die.position.z = t * 0.34 + this.explode * w * 0.26;
        this.lid.position.z = t * 0.56 + this.explode * w * 0.58;
        this.dieMat.emissiveIntensity = 0.5 + this.explode * 1.9;
    }
    /** Shrinks away before removal; App destroys it once `gone`. */
    leave() { this.leaving = true; }
    get gone() { return this.leaving && this.appear < 0.02; }
    destroy() {
        this.view.removeFromParent();
        this.root.traverse((o) => {
            o.geometry?.dispose();
            for (const m of [o.material].flat())
                m?.dispose();
            if (o.isInstancedMesh)
                o.dispose();
        });
    }
}
