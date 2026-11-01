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

async function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = url;
    });
}

/** High-detail photorealistic lid texture for the 3D hero chip. */
export async function lidTexture(chip) {
    const S = 1024;
    const [c, g] = square(S);

    let img = null;
    try {
        img = await loadImage(`/assets/chips/chip-${chip.year}.jpg`);
    } catch {
        try {
            img = await loadImage(`/assets/pucks/puck-${chip.year}.svg`);
        } catch (e) {
            console.error('Failed to load chip image', e);
        }
    }

    if (img) {
        // Draw the authentic chip photograph filling the lid face
        g.drawImage(img, 0, 0, S, S);

        // Subtle specular highlight across the metal surface
        g.save();
        const spec = g.createLinearGradient(0, 0, S, S);
        spec.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
        spec.addColorStop(0.35, 'rgba(255, 255, 255, 0.02)');
        spec.addColorStop(0.65, 'rgba(0, 0, 0, 0.08)');
        spec.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
        g.fillStyle = spec;
        g.fillRect(0, 0, S, S);
        g.restore();

        // Precision chamfered border and gold alignment index
        g.strokeStyle = 'rgba(217, 197, 143, 0.45)';
        g.lineWidth = 5;
        g.strokeRect(16, 16, S - 32, S - 32);

        g.fillStyle = 'rgba(217, 197, 143, 0.65)';
        g.beginPath();
        g.arc(44, 44, 10, 0, Math.PI * 2);
        g.fill();
    } else {
        const grad = g.createLinearGradient(0, 0, S, S);
        grad.addColorStop(0, '#2a2c33');
        grad.addColorStop(0.55, '#17181d');
        grad.addColorStop(1, '#0d0e12');
        g.fillStyle = grad;
        g.fillRect(0, 0, S, S);
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
    }
    return canvasTexture(c);
}

/** The die: nanoscale silicon wafer architecture with glowing execution cores tailored to each era. */
export async function dieTexture(chip, accent) {
    const S = 512;
    const [c, g] = square(S);

    let dieImg = null;
    try {
        dieImg = await loadImage('/assets/chips/chip-die.jpg');
    } catch (e) {
        console.error('Failed to load die image', e);
    }

    if (dieImg) {
        g.drawImage(dieImg, 0, 0, S, S);

        // Overlay glowing processing core zones in accent color
        const cols = Math.ceil(Math.sqrt(chip.cores));
        const rows = Math.ceil(chip.cores / cols);
        const m = 54;
        const gap = 16;
        const bw = (S - 2 * m - gap * (cols - 1)) / cols;
        const bh = (S - 2 * m - gap * (rows - 1)) / rows;

        g.save();
        for (let i = 0; i < chip.cores; i++) {
            const bx = m + (i % cols) * (bw + gap);
            const by = m + Math.floor(i / cols) * (bh + gap);

            g.strokeStyle = accent;
            g.lineWidth = 3;
            g.shadowColor = accent;
            g.shadowBlur = 12;
            g.strokeRect(bx + 2, by + 2, bw - 4, bh - 4);

            g.fillStyle = `${accent}2a`;
            g.fillRect(bx + 2, by + 2, bw - 4, bh - 4);

            if (chip.cores <= 4) {
                g.font = `600 15px ${brandFont()}`;
                g.fillStyle = '#ffffff';
                g.textAlign = 'center';
                g.fillText(`CORE ${i + 1}`, bx + bw / 2, by + bh / 2 + 5);
            }
        }
        g.restore();

        // Nanoscale interconnect grid scaled by process node
        const cells = Math.round(8 + 36 * (1 - Math.log10(chip.nodeNm) / Math.log10(4000)));
        const step = S / cells;
        g.strokeStyle = accent;
        g.globalAlpha = 0.24;
        g.lineWidth = 1;
        for (let i = 0; i <= cells; i++) {
            g.beginPath();
            g.moveTo(i * step, 0);
            g.lineTo(i * step, S);
            g.moveTo(0, i * step);
            g.lineTo(S, i * step);
            g.stroke();
        }
        g.globalAlpha = 1;
    } else {
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
        g.globalAlpha = 1;
    }

    return canvasTexture(c, 4);
}

/** A chip's textures. Loaded once and cached on exhibit initialization. */
export const chipTextures = async (chip, accent) => ({
    lid: await lidTexture(chip),
    die: await dieTexture(chip, accent),
});

/** A puck's top face: luxury museum token with authentic historical microchip, milled finish, and glowing era typography. */
export async function puckTexture(chip, accent) {
    const S = 512;
    const [c, g] = square(S);
    const R = S / 2 - 4;
    const cx = S / 2;
    const cy = S / 2;

    // Dark brushed background with radial depth
    const bg = g.createRadialGradient(cx, cy, 20, cx, cy, R);
    bg.addColorStop(0, '#1a1d27');
    bg.addColorStop(0.68, '#0e0f14');
    bg.addColorStop(1, '#050608');
    g.fillStyle = bg;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();

    // Milled precision concentric grooves
    g.save();
    g.strokeStyle = 'rgba(255, 255, 255, 0.032)';
    g.lineWidth = 1;
    for (let r = 44; r < R - 12; r += 14) {
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.stroke();
    }
    g.restore();

    // Load authentic chip photograph
    let img = null;
    try {
        img = await loadImage(`/assets/chips/chip-${chip.year}.jpg`);
    } catch {
        try {
            img = await loadImage(`/assets/pucks/puck-${chip.year}.svg`);
        } catch (e) {
            console.error('Failed to load chip image for puck', e);
        }
    }

    if (img) {
        // Size chip appropriately
        const cs = 330;
        const [chipCanvas, cg] = square(cs);
        cg.drawImage(img, 0, 0, cs, cs);

        // Soft radial feathering to blend photograph seamlessly into dark puck face
        cg.globalCompositeOperation = 'destination-in';
        const radMask = cg.createRadialGradient(cs / 2, cs / 2, cs * 0.36, cs / 2, cs / 2, cs * 0.49);
        radMask.addColorStop(0, 'rgba(0,0,0,1)');
        radMask.addColorStop(0.85, 'rgba(0,0,0,0.92)');
        radMask.addColorStop(1, 'rgba(0,0,0,0)');
        cg.fillStyle = radMask;
        cg.beginPath();
        cg.arc(cs / 2, cs / 2, cs / 2, 0, Math.PI * 2);
        cg.fill();

        // Drop shadow behind chip
        g.save();
        g.shadowColor = 'rgba(0, 0, 0, 0.85)';
        g.shadowBlur = 24;
        g.shadowOffsetY = 10;
        g.drawImage(chipCanvas, cx - cs / 2, cy - cs / 2 - 14);
        g.restore();

        // Subtle era-colored ambient illumination
        g.save();
        const glow = g.createRadialGradient(cx, cy - 14, 15, cx, cy - 14, cs * 0.52);
        glow.addColorStop(0, `${accent}1f`);
        glow.addColorStop(0.65, `${accent}0a`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = glow;
        g.beginPath();
        g.arc(cx, cy - 14, cs * 0.52, 0, Math.PI * 2);
        g.fill();
        g.restore();

        // Draw feathered chip
        g.drawImage(chipCanvas, cx - cs / 2, cy - cs / 2 - 14);
    }

    // Outer machined metallic bezel & accent ring
    g.save();
    g.beginPath();
    g.arc(cx, cy, R - 1, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    g.lineWidth = 2.5;
    g.stroke();

    g.beginPath();
    g.arc(cx, cy, R - 6, 0, Math.PI * 2);
    g.strokeStyle = `${accent}55`;
    g.lineWidth = 1.5;
    g.stroke();

    g.beginPath();
    g.arc(cx, cy, R - 12, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    g.lineWidth = 2;
    g.stroke();
    g.restore();

    // Top subtle label: e.g. "8-BIT MICROPROCESSOR", "32-BIT PROCESSOR"
    g.save();
    g.textAlign = 'center';
    g.font = `600 20px ${brandFont()}`;
    g.fillStyle = 'rgba(217, 197, 143, 0.75)';
    g.fillText(chip.name.toUpperCase(), cx, 50);
    g.restore();

    // Bottom Year label with vibrant neon glow
    g.save();
    g.textAlign = 'center';
    g.font = `700 62px ${brandFont()}`;
    g.shadowColor = accent;
    g.shadowBlur = 18;
    g.fillStyle = accent;
    g.fillText(String(chip.year), cx, S * 0.88);

    // Inner bright core for legibility at distance
    g.shadowBlur = 0;
    g.fillStyle = '#ffffff';
    g.globalAlpha = 0.9;
    g.fillText(String(chip.year), cx, S * 0.88);
    g.restore();

    return canvasTexture(c);
}

