import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
/**
 * The display itself, in stage percent: x = sx - 50, y = 50 - sy; the camera sees the 100 x 100 plane at z = 0.
 * The canvas never takes input, so the DOM above it handles every touch.
 */
export class StageRenderer {
    scene = new THREE.Scene();
    renderer;
    camera;
    composer;
    observer;
    /** Two fixed lights tinted by the chips on show. Adding and removing lights would recompile every material mid-animation. */
    accents = [new THREE.PointLight('#ffffff', 0, 90), new THREE.PointLight('#ffffff', 0, 90)];
    camZ;
    px = 0.12;
    constructor(stage, { fov, near, far }, bloom) {
        const r = (this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }));
        r.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 1), 2));
        // Neutral keeps the era colours true where filmic curves would wash them out.
        r.toneMapping = THREE.NeutralToneMapping;
        r.setClearColor('#000000', 1);
        this.canvas.className = 'chips';
        this.camZ = 50 / Math.tan((fov / 2) * (Math.PI / 180));
        this.camera = new THREE.PerspectiveCamera(fov, 1, near, far);
        this.camera.position.z = this.camZ;

        const pmrem = new THREE.PMREMGenerator(r);
        const room = new RoomEnvironment();
        this.scene.environment = pmrem.fromScene(room, 0.04).texture;
        this.scene.environmentIntensity = 0.55;
        room.dispose?.();
        pmrem.dispose();

        const key = new THREE.DirectionalLight('#fff4e6', 1.9);
        key.position.set(-24, 44, 70);
        const fill = new THREE.DirectionalLight('#8fa6ff', 0.55);
        fill.position.set(40, -20, 30);
        this.scene.add(key, fill, ...this.accents);

        const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
        this.composer = new EffectComposer(r, target);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), bloom.strength, bloom.radius, bloom.threshold));
        this.composer.addPass(new OutputPass());

        const fit = () => {
            const { clientWidth: w, clientHeight: h } = stage;
            if (!w || !h)
                return;
            r.setSize(w, h, false);
            this.composer.setPixelRatio(r.getPixelRatio());
            this.composer.setSize(w, h);
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.px = 100 / (h * r.getPixelRatio());
        };
        this.observer = new ResizeObserver(fit);
        this.observer.observe(stage);
        fit();
    }
    get canvas() { return this.renderer.domElement; }
    /** World x, y for a stage position at height z, so that perspective keeps it exactly under the finger. */
    place(x, y, z = 0) {
        const k = (this.camZ - z) / this.camZ;
        return [(x - 50) * k, (50 - y) * k];
    }
    render(dt) { this.composer.render(dt); }
    dispose() {
        this.renderer.setAnimationLoop(null);
        this.observer.disconnect();
        this.scene.environment?.dispose();
        this.composer.dispose();
        this.renderer.dispose();
        this.canvas.remove();
    }
}
