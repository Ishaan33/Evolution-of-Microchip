const clamp = (v) => Math.min(1, Math.max(0.05, v));
export const fmtSpeed = (g) => (g < 1 ? `${+(g * 1000).toFixed(g < 0.01 ? 1 : 0)} MHz` : `${+g.toFixed(2)} GHz`);
export const fmtNode = (nm) => (nm >= 1000 ? `${nm / 1000} µm` : `${nm} nm`);
export const fmtTransistors = (n) => n >= 1e9 ? `${+(n / 1e9).toFixed(1)} billion` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)} million` : Math.round(n).toLocaleString('en-US');
const fmtPower = (v) => `${+v.toFixed(v < 10 ? 1 : 0)} W`;
/** How many times bigger b is than a for one row: "×12", "÷4.5" or "same". */
export function ratio(b, a, key) {
    const r = b[key] / a[key];
    if (!isFinite(r))
        return '';
    if (Math.abs(r - 1) < 0.05)
        return 'same';
    if (r < 1)
        return `÷${+(1 / r).toFixed(1)}`;
    if (r >= 1e6)
        return `×${+(r / 1e6).toFixed(1)}M`;
    if (r >= 1e3)
        return `×${+(r / 1e3).toFixed(1)}k`;
    return `×${r >= 10 ? Math.round(r) : +r.toFixed(1)}`;
}
/**
 * The four bands of the dial, outermost first, as the brief lists them. `norm` is the band's reach from 0 to 1 and `floor` the value a count starts from;
 * everything but the year is on a log scale, or the early chips would not show at all.
 */
export const ROWS = [
    {
        key: 'year', label: 'Year', floor: 1976, get: (c) => c.year, fmt: (v) => String(Math.round(v)),
        norm: (c) => clamp((c.year - 1976) / 50),
        compare: (b, a) => `${Math.abs(b.year - a.year)} yrs`,
        why: 'The year this kind of chip first came into use. The whole journey fits inside one working life.',
    },
    {
        key: 'cores', label: 'Processors', floor: 1, get: (c) => c.cores, fmt: (v) => String(Math.round(v)),
        norm: (c) => clamp(Math.log(c.cores) / Math.log(12)),
        compare: (b, a) => ratio(b, a, 'cores'),
        why: 'Each processor can run its own task. Count the streams in the band: more of them means more work done at the same moment.',
    },
    {
        key: 'speedGHz', label: 'Speed', floor: 0.001, get: (c) => c.speedGHz, fmt: fmtSpeed,
        norm: (c) => clamp(Math.log(c.speedGHz / 0.001) / Math.log(4.5 / 0.001)),
        compare: (b, a) => ratio(b, a, 'speedGHz'),
        why: 'How many ticks the chip clock makes each second. The band flows faster on a faster chip.',
    },
    {
        key: 'powerW', label: 'Power', floor: 1, get: (c) => c.powerW, fmt: fmtPower,
        norm: (c) => clamp(Math.log(c.powerW) / Math.log(65)),
        compare: (b, a) => ratio(b, a, 'powerW'),
        why: 'Electricity needed to run the chip. Doing more work for less power is the real sign of progress.',
    },
];
/** Band reach for every chip on every row, in track order (innermost first), for the shader's marks. */
export const rowMarks = (chips) => [...ROWS].reverse().flatMap((row) => chips.map((c) => row.norm(c)));
