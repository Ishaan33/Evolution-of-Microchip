import * as THREE from 'three';
import { COLORS } from '@/ui/tokens';
import { brandFont } from '@/utils/dom';
const canvasTexture = (c, anisotropy = 8) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    return t;
};
function square(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return [c, c.getContext('2d')];
}
export function lidTexture(chip) {
    const S = 1024;
    const [c, g] = square(S);
    const grad = g.createLinearGradient(0, 0, S, S);
    grad.addColorStop(0, '#2a2c33');
    grad.addColorStop(0.55, '#17181d');
    grad.addColorStop(1, '#0d0e12');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    // Fine machining marks catch the light as the chip turns.
    g.globalAlpha = 0.05;
    g.fillStyle = '#ffffff';
    for (let y = 0; y < S; y += 4)
        g.fillRect(0, y, S, 1 + ((y * 7) % 3 === 0 ? 1 : 0));
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(217,197,143,.3)';
    g.lineWidth = 5;
    g.strokeRect(34, 34, S - 68, S - 68);
    g.beginPath();
    g.arc(112, 112, 24, 0, 7);
    g.fillStyle = 'rgba(217,197,143,.32)';
    g.fill();
    g.fillStyle = COLORS.gold;
    g.font = `600 118px ${brandFont()}`;
    g.fillText('Microchip', 92, S - 120);
    g.font = `500 74px ${brandFont()}`;
    g.fillStyle = 'rgba(217,197,143,.7)';
    g.fillText(String(chip.year), 92, S - 232);
    return canvasTexture(c);
}
/** The die: one lit block per core over wiring whose grid gets finer as the process node shrinks. */
export function dieTexture(chip, accent) {
    const S = 512;
    const [c, g] = square(S);
    g.fillStyle = '#080a12';
    g.fillRect(0, 0, S, S);
    const cells = Math.round(5 + 44 * (1 - Math.log10(chip.nodeNm) / Math.log10(4000)));
    const step = S / cells;
    g.strokeStyle = accent;
    g.globalAlpha = 0.38;
    g.lineWidth = 1.5;
    for (let i = 0; i <= cells; i++) {
        g.beginPath();
        g.moveTo(i * step, 0);
        g.lineTo(i * step, S);
        g.moveTo(0, i * step);
        g.lineTo(S, i * step);
        g.stroke();
    }
    const cols = Math.ceil(Math.sqrt(chip.cores));
    const rows = Math.ceil(chip.cores / cols);
    const m = 44;
    const gap = 16;
    const bw = (S - 2 * m - gap * (cols - 1)) / cols;
    const bh = (S - 2 * m - gap * (rows - 1)) / rows;
    g.fillStyle = accent;
    for (let i = 0; i < chip.cores; i++) {
        g.globalAlpha = 0.88;
        g.fillRect(m + (i % cols) * (bw + gap), m + Math.floor(i / cols) * (bh + gap), bw, bh);
    }
    g.globalAlpha = 1;
    return canvasTexture(c, 4);
}
/** A chip's textures. They live as long as the exhibit: re-uploading them on every swap would drop frames. */
export const chipTextures = (chip, accent) => ({ lid: lidTexture(chip), die: dieTexture(chip, accent) });
/** A puck's top face, from its artwork: the chip inside shrinks from puck to puck, which is the point of the set. */
export async function puckTexture(chip, accent) {
    const img = new Image();
    img.src = `/assets/pucks/puck-${chip.year}.svg`;
    await img.decode();
    const S = 512;
    const [c, g] = square(S);
    const base = g.createRadialGradient(S * 0.42, S * 0.3, 10, S * 0.5, S * 0.5, S * 0.56);
    base.addColorStop(0, '#24262f');
    base.addColorStop(1, '#08090c');
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    g.save();
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2, 0, 7);
    g.clip();
    // The art is a disc in a larger box (the 2026 file has no margin). Zoomed so the chip reads at table distance.
    const size = (S / (chip.year === 2026 ? 1 : 200 / 248)) * 1.32;
    g.drawImage(img, (S - size) / 2, (S - size) / 2 - S * 0.045, size, size);
    g.restore();
    g.font = `600 78px ${brandFont()}`;
    g.textAlign = 'center';
    g.fillStyle = accent;
    g.fillText(String(chip.year), S / 2, S * 0.905);
    return canvasTexture(c);
}
