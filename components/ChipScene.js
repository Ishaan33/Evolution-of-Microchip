'use client';

// useFrame callbacks mutate three.js objects and the shared control refs by design.
/* eslint-disable react-hooks/immutability */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// World units equal stage percent: x = sx - 50, y = 50 - sy; the camera sees the 100 x 100 plane.
const FOV = 30;
const CAM_Z = 50 / Math.tan((FOV / 2) * (Math.PI / 180));
const GOLD = '#d9c58f';

function lidTexture(chip) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#17181d');
  grad.addColorStop(1, '#0a0b0e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(217,197,143,.35)';
  g.lineWidth = 3;
  g.strokeRect(14, 14, 484, 484);
  g.beginPath();
  g.arc(58, 58, 11, 0, 7);
  g.fillStyle = 'rgba(217,197,143,.35)';
  g.fill();
  g.fillStyle = GOLD;
  g.font = '600 54px system-ui, sans-serif';
  g.fillText('Microchip', 44, 440);
  g.font = '500 34px ui-monospace, monospace';
  g.fillStyle = 'rgba(217,197,143,.65)';
  g.fillText(String(chip.year), 44, 390);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// The grid on the die gets finer as the process node shrinks.
function dieTexture(chip, accent) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#10141f';
  g.fillRect(0, 0, 256, 256);
  const cells = Math.round(4 + 36 * (1 - Math.log10(chip.nodeNm) / Math.log10(4000)));
  g.strokeStyle = accent;
  g.globalAlpha = 0.75;
  g.lineWidth = 1;
  const step = 256 / cells;
  for (let i = 0; i <= cells; i++) {
    g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i * step); g.lineTo(256, i * step); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Chip({ hero, ctl }) {
  const { chip, index, w, accent, ctl: ci } = hero;
  const root = useRef();
  const lid = useRef();
  const frame = useRef();
  const die = useRef();
  const pinsRef = useRef();
  // starts exploded and spinning so a new chip assembles itself
  const st = useRef({ appear: 0, explode: 1, spin: 2.6 });
  const t = w * 0.1;
  const perSide = Math.round(18 - 9 * (index / 6));
  const lidTex = useMemo(() => lidTexture(chip), [chip]);
  const dieTex = useMemo(() => dieTexture(chip, accent), [chip, accent]);
  const pins = useMemo(() => {
    const out = [];
    const span = w * 0.8;
    const e = w * 0.5 + w * 0.045;
    for (let i = 0; i < perSide; i++) {
      const p = -span / 2 + (span * i) / (perSide - 1);
      out.push([p, e, 0], [p, -e, 0], [e, p, Math.PI / 2], [-e, p, Math.PI / 2]);
    }
    return out;
  }, [w, perSide]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((s, dt) => {
    const c = ctl.current[ci];
    const k = st.current;
    k.appear = THREE.MathUtils.damp(k.appear, 1, 3.5, dt);
    k.explode = THREE.MathUtils.damp(k.explode, c.explode ? 1 : 0, 3.2, dt);
    k.spin = THREE.MathUtils.damp(k.spin, 0, 2.2, dt);
    if (!c.dragging) c.ry += dt * 0.4;
    root.current.scale.setScalar(Math.max(0.001, k.appear));
    root.current.position.z = 2 + 10 * k.appear;
    root.current.rotation.x = c.rx;
    root.current.rotation.y = Math.sin(c.ry) * 0.45 + c.dy + k.spin;
    frame.current.position.z = t * 0.35 + k.explode * w * 0.12;
    die.current.position.z = t * 0.1 + k.explode * w * 0.3;
    lid.current.position.z = t * 0.55 + k.explode * w * 0.62;
    pins.forEach((p, i) => {
      dummy.position.set(p[0], p[1], 0);
      dummy.rotation.z = p[2];
      dummy.updateMatrix();
      pinsRef.current.setMatrixAt(i, dummy.matrix);
    });
    pinsRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={root}>
      <mesh>
        <boxGeometry args={[w, w, t * 0.3]} />
        <meshStandardMaterial color="#15161b" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh ref={frame}>
        <boxGeometry args={[w * 0.9, w * 0.9, t * 0.25]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.28} />
      </mesh>
      <mesh ref={die}>
        <boxGeometry args={[w * 0.5, w * 0.5, t * 0.45]} />
        <meshStandardMaterial map={dieTex} emissive={accent} emissiveIntensity={0.18} metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh ref={lid}>
        <boxGeometry args={[w * 0.82, w * 0.82, t * 0.7]} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <meshStandardMaterial key={i} attach={`material-${i}`} map={i === 4 ? lidTex : null}
            color={i === 4 ? '#ffffff' : '#0c0d10'} metalness={0.35} roughness={0.4} />
        ))}
      </mesh>
      <instancedMesh ref={pinsRef} args={[null, null, pins.length]}>
        <boxGeometry args={[w * 0.09, w * 0.02, t * 0.2]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.25} />
      </instancedMesh>
      <pointLight position={[0, -w * 0.4, w * 0.9]} intensity={w * 40} color={accent} distance={w * 5} />
    </group>
  );
}

export default function ChipScene({ heroes, ctl }) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 1, far: 600 }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[20, 40, 60]} intensity={2.6} />
      <directionalLight position={[-30, -10, 30]} intensity={0.7} color="#9db4ff" />
      {heroes.map((h) => (
        <group key={h.key} position={[h.pos[0] - 50, 50 - h.pos[1], 0]}>
          <Chip hero={h} ctl={ctl} />
        </group>
      ))}
    </Canvas>
  );
}
