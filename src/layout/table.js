const r3 = (v) => Math.round(v * 1000) / 1000; // trims float noise from SVG attributes
const rad = (deg) => (deg * Math.PI) / 180;
/** Pucks rest along the lower rim in date order, left to right, leaving the upper half to the dial. */
export function homePositions(app, count) {
    const { homeRadius, arc: [from, to] } = app.pucks;
    return Array.from({ length: count }, (_, i) => {
        const deg = from + (i * (to - from)) / (count - 1);
        const a = rad(deg);
        return { x: r3(50 + homeRadius * Math.sin(a)), y: r3(50 - homeRadius * Math.cos(a)) };
    });
}
/** A real puck's width in stage percent: it is the same size wherever it sits, and it hides what is under it. */
export const puckSize = ({ pucks, display }) => (pucks.diameterMm / display.diameterMm) * 100;
/** Centre radius of a dial track; track 0 is the innermost. */
export const trackRadius = ({ dial }, track) => dial.inner + dial.width / 2 + track * (dial.width + dial.gap);
/** The trace from a dock's rim up to the foot of a track, in stage percent. Right-hand docks mirror the left. */
export function conduitPath(app, side, track) {
    const [dx, dy] = app.dock.positions[side];
    const flip = (x) => (side === 0 ? x : 100 - x);
    const r = app.dock.radius;
    const footX = 50 - trackRadius(app, track);
    const runY = 52.7 + track * 1.5;
    const a = rad(115 + track * 21);
    const cx = side === 0 ? dx : 100 - dx;
    const ex = cx + r * Math.cos(a);
    const ey = dy - r * Math.sin(a);
    const bendX = Math.max(footX, ex - (ey - runY));
    return [[footX, 50], [footX, runY], [bendX, runY], [ex, ey]].map(([x, y]) => [flip(x), y]);
}
/** 3D heroes: one big chip, two side by side, or the attract-mode cycling chip. */
export function layoutHeroes(app, chips, slots, count, cycle, accents) {
    const { attract, single, pair, shrink } = app.hero;
    const scale = (i) => 1 - shrink * (i / (chips.length - 1));
    if (count === 0) {
        const i = cycle;
        return [{ key: `a-${chips[i].id}`, chip: chips[i], index: i, pos: [attract.x, attract.y], w: attract.width * scale(i), accent: accents[i], ctl: 2 }];
    }
    return slots.map((s, i) => s && {
        key: `${s.chip.id}-${count}`, chip: s.chip, index: s.index,
        pos: count === 1 ? [single.x, single.y] : [pair.x[i], pair.y],
        w: (count === 1 ? single.width : pair.width) * scale(s.index), accent: accents[s.index], ctl: i,
    }).filter(Boolean);
}
