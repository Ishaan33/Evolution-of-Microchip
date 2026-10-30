const clamp = (v) => Math.min(1, Math.max(0.05, v));

export const fmtSpeed = (g) => (g < 1 ? `${+(g * 1000).toFixed(g < 0.01 ? 1 : 0)} MHz` : `${g} GHz`);
export const fmtNode = (nm) => (nm >= 1000 ? `${nm / 1000} µm` : `${nm} nm`);

export const fmtTransistors = (n) =>
  n >= 1e9 ? `${+(n / 1e9).toFixed(1)} billion` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)} million` : Math.round(n).toLocaleString('en-US');

export const fmtTransistorsShort = (n) =>
  n >= 1e9 ? `${+(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : String(Math.round(n));

// One warm-to-cool colour per era, oldest to newest.
export const ERA = ['#f0a44b', '#f28b5c', '#ec6f86', '#c870d8', '#8f80f2', '#5fa8f5', '#5eead4'];

// The four rows shown for every chip.
export const ROWS = [
  {
    key: 'cores', label: 'Processors', get: (c) => c.cores, fmt: (v) => String(Math.round(v)), short: (v) => String(v),
    norm: (c) => clamp(Math.log(c.cores) / Math.log(12)),
    why: 'Each core can run its own task. More cores means more work done at the same moment.',
  },
  {
    key: 'speedGHz', label: 'Speed', get: (c) => c.speedGHz, fmt: fmtSpeed, short: fmtSpeed,
    norm: (c) => clamp(Math.log(c.speedGHz / 0.001) / Math.log(4.5 / 0.001)),
    why: 'How many ticks the chip clock makes each second. Every tick lets the chip take one tiny step.',
  },
  {
    key: 'powerW', label: 'Power', get: (c) => c.powerW, fmt: (v) => `${+v.toFixed(v < 10 ? 1 : 0)} W`, short: (v) => `${v} W`,
    norm: (c) => clamp(Math.log(c.powerW) / Math.log(65)),
    why: 'Electricity needed to run the chip. Doing more work for less power is the real sign of progress.',
  },
  {
    key: 'transistors', label: 'Transistors', get: (c) => c.transistors, fmt: fmtTransistors, short: fmtTransistorsShort,
    norm: (c) => clamp(Math.log10(c.transistors) / 10.4),
    why: 'Tiny electronic switches. Each one is a yes or no, and billions together can think.',
  },
];

// How many times bigger b is than a for one row: "x12", "÷4.5" or "same".
export function ratio(b, a, key) {
  const r = b[key] / a[key];
  if (!isFinite(r)) return '';
  if (Math.abs(r - 1) < 0.05) return 'same';
  if (r < 1) return `÷${+(1 / r).toFixed(1)}`;
  if (r >= 1e6) return `×${+(r / 1e6).toFixed(1)}M`;
  if (r >= 1e3) return `×${+(r / 1e3).toFixed(1)}k`;
  return `×${r >= 10 ? Math.round(r) : +r.toFixed(1)}`;
}
