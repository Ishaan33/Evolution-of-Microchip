import * as THREE from 'three';
const { damp } = THREE.MathUtils;
// One lathe profile for all seven pucks: a machined disc with a soft shoulder, in units of the puck's radius.
const PROFILE = [[1, -0.02], [1, 0.14], [0.985, 0.2], [0.955, 0.235], [0.925, 0.25], [0, 0.25]].map(([x, y]) => new THREE.Vector2(x, y));
const bodyGeometry = () => new THREE.LatheGeometry(PROFILE, 72).rotateX(Math.PI / 2);
/** A puck as a real object: it rises off the film, leans into the drag and catches the light. */
export class PuckMesh {
    view = new THREE.Group();
    ring;
    glow = 0;
    glowTarget = 0;
    tiltX = 0;
    tiltY = 0;
    constructor(map, accent) {
        const body = new THREE.Mesh(bodyGeometry(), new THREE.MeshStandardMaterial({ color: '#2a2c35', metalness: 0.92, roughness: 0.34 }));
        // Unlit: the face is already a photograph, and the chip's accent light would wash it out.
        const face = new THREE.Mesh(new THREE.CircleGeometry(0.925, 72), new THREE.MeshBasicMaterial({ map, color: new THREE.Color(1.4, 1.4, 1.4) }));
        face.position.z = 0.252;
        this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.965, 0.018, 8, 96), new THREE.MeshStandardMaterial({ color: '#000000', emissive: accent, emissiveIntensity: 0.5, roughness: 0.4 }));
        this.ring.position.z = 0.238;
        this.view.add(body, face, this.ring);
        this.map = map;
    }
    setGlow(v) { this.glowTarget = v; }
    /** `vx`, `vy`: how fast the puck is travelling across the stage, in percent per second. */
    place(world, z, radius, vx, vy, dt) {
        this.view.position.set(world[0], world[1], z);
        this.view.scale.setScalar(radius);
        const lean = (v) => Math.max(-0.5, Math.min(0.5, v * 0.0052));
        this.tiltY = damp(this.tiltY, lean(vx), 10, dt);
        this.tiltX = damp(this.tiltX, lean(vy), 10, dt);
        this.view.rotation.set(this.tiltX, this.tiltY, 0);
        this.glow = damp(this.glow, this.glowTarget, 5, dt);
        this.ring.material.emissiveIntensity = 0.45 + this.glow * 2.1;
    }
    destroy() {
        this.view.removeFromParent();
        this.view.traverse((o) => {
            o.geometry?.dispose();
            o.material?.dispose();
        });
        this.map.dispose();
    }
}
