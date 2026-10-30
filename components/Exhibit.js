'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig, motion, AnimatePresence } from 'motion/react';
import { CHIPS } from '@/data/chips';
import { ERA, ROWS, fmtNode, ratio } from '@/lib/metrics';
import Num from './Num';

const ChipScene = dynamic(() => import('./ChipScene'), { ssr: false });

const DOCKS = [[33, 74.2], [67, 74.2]];
const SNAP = 11;
const IDLE_MS = 60000;
const ROW_TOP = 46.6;
const ROW_H = 5.2;
const r3 = (v) => Math.round(v * 1000) / 1000; // keep server and client markup identical

// Pucks sit evenly around the chassis, leaving a gap at the top for the engraved title.
const HOME = CHIPS.map((_, i) => {
  const deg = 25.714 + (i * 360) / 7;
  const a = (deg * Math.PI) / 180;
  const flip = deg > 90 && deg < 270 ? 180 : 0;
  return {
    x: r3(50 + 43.5 * Math.sin(a)), y: r3(50 - 43.5 * Math.cos(a)),
    lx: r3(50 + 35.4 * Math.sin(a)), ly: r3(50 - 35.4 * Math.cos(a)), rot: r3(deg + flip),
  };
});
const TICKS = Array.from({ length: 90 }, (_, i) => {
  const a = (i * 4 * Math.PI) / 180;
  const len = i % 5 === 0 ? 1.1 : 0.6;
  return { x1: r3(50 + 49.6 * Math.sin(a)), y1: r3(50 - 49.6 * Math.cos(a)), x2: r3(50 + (49.6 - len) * Math.sin(a)), y2: r3(50 - (49.6 - len) * Math.cos(a)) };
});

const discFrac = (year) => (year === 2026 ? 1 : 200 / 248); // the puck art is a disc inside a larger box
const heroScale = (i) => 1 - 0.45 * (i / 6);
const newCtl = () => ({ rx: -0.5, ry: 0, dy: 0, explode: false, dragging: false });

function Puck({ chip, pos, size, dragging, seated, onKey, handlers }) {
  const frac = discFrac(chip.year);
  return (
    <motion.div
      className={`puck ${dragging ? 'lifted' : ''} ${seated ? 'seated' : ''}`}
      role="button" tabIndex={0}
      aria-label={`${chip.year} microchip puck. Press Enter to ${seated ? 'remove it from' : 'place it on'} a dock`}
      onKeyDown={onKey}
      {...handlers}
      initial={false}
      animate={{ left: `${pos[0]}%`, top: `${pos[1]}%`, width: `${size}%`, scale: dragging ? 1.12 : 1 }}
      transition={dragging ? { duration: 0 } : { type: 'spring', stiffness: 230, damping: 24 }}
      style={{ x: '-50%', y: '-50%', zIndex: dragging ? 30 : 2 }}
    >
      {/* plain img: next/image would rasterise away the SVG filters */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/pucks/puck-${chip.year}.svg`} alt="" draggable={false} style={{ width: `${100 / frac}%` }} />
    </motion.div>
  );
}

function Scale({ row, chip }) {
  return (
    <span className="scale" aria-hidden="true">
      {CHIPS.map((c) => (
        <i key={c.id} className={c.id === chip.id ? 'me' : ''} style={{ left: `${row.norm(c) * 100}%` }} />
      ))}
    </span>
  );
}

export default function Exhibit() {
  const stageRef = useRef(null);
  const ctl = useRef([newCtl(), newCtl(), newCtl()]);
  const burstK = useRef(0);
  const [placement, setPlacement] = useState({}); // chip id -> dock index
  const [drag, setDrag] = useState(null); // {id, x, y}
  const [burst, setBurst] = useState(null); // {slot, k}
  const [focus, setFocus] = useState(null); // focused row key
  const [noteIdx, setNoteIdx] = useState(0);
  const [cycle, setCycle] = useState(0);

  const slots = useMemo(
    () => [0, 1].map((i) => {
      const index = CHIPS.findIndex((c) => placement[c.id] === i);
      return index < 0 ? null : { chip: CHIPS[index], index };
    }),
    [placement],
  );
  const placed = slots.filter(Boolean);
  const count = placed.length;

  // Any touch bumps `activity`; a minute without one clears the table.
  const [activity, setActivity] = useState(0);
  const poke = useCallback(() => setActivity((a) => a + 1), []);
  useEffect(() => {
    if (count === 0) return;
    const t = setTimeout(() => setPlacement({}), IDLE_MS);
    return () => clearTimeout(t);
  }, [activity, count]);
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 1400);
    return () => clearTimeout(t);
  }, [burst]);
  useEffect(() => {
    if (count > 0) return;
    const t = setInterval(() => setCycle((c) => (c + 1) % CHIPS.length), 3800);
    return () => clearInterval(t);
  }, [count]);

  const toStage = (e) => {
    const r = stageRef.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100];
  };

  const nearest = (x, y, id) => {
    let best = null;
    let bd = SNAP;
    DOCKS.forEach((p, i) => {
      const occupant = CHIPS.find((c) => placement[c.id] === i);
      if (occupant && occupant.id !== id) return;
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };
  const near = drag ? nearest(drag.x, drag.y, drag.id) : null;

  const seat = (chip, slot) => {
    setPlacement((pl) => {
      const next = { ...pl };
      if (slot === null) delete next[chip.id];
      else next[chip.id] = slot;
      return next;
    });
    setFocus(null);
    setNoteIdx(0);
    if (slot !== null) {
      ctl.current[slot] = newCtl();
      burstK.current += 1;
      setBurst({ slot, k: burstK.current });
    }
  };

  const puckHandlers = (chip) => ({
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const [x, y] = toStage(e);
      setDrag({ id: chip.id, x, y });
      poke();
    },
    onPointerMove: (e) => {
      const [x, y] = toStage(e);
      setDrag((d) => (d && d.id === chip.id ? { id: chip.id, x, y } : d));
    },
    onPointerUp: (e) => {
      if (!drag || drag.id !== chip.id) return;
      const [x, y] = toStage(e);
      seat(chip, nearest(x, y, chip.id));
      setDrag(null);
      poke();
    },
    onPointerCancel: () => setDrag(null),
  });

  const keyFor = (chip) => (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (placement[chip.id] !== undefined) return seat(chip, null);
    const free = [0, 1].find((i) => !CHIPS.some((c) => placement[c.id] === i));
    if (free !== undefined) seat(chip, free);
    poke();
  };

  // Drag a hero chip to turn it; a tap opens it up into layers.
  const grab = (ci) => {
    let start = null;
    let moved = 0;
    return {
      onPointerDown: (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start = [e.clientX, e.clientY];
        moved = 0;
        ctl.current[ci].dragging = true;
        poke();
      },
      onPointerMove: (e) => {
        if (!start) return;
        const dx = e.clientX - start[0];
        const dy = e.clientY - start[1];
        start = [e.clientX, e.clientY];
        moved += Math.abs(dx) + Math.abs(dy);
        const c = ctl.current[ci];
        c.dy += dx * 0.012;
        c.rx = Math.max(-1.4, Math.min(0.4, c.rx + dy * 0.01));
      },
      onPointerUp: () => {
        const c = ctl.current[ci];
        c.dragging = false;
        if (moved < 6) c.explode = !c.explode;
        start = null;
      },
    };
  };

  // 3D heroes: one big chip, two side by side, or the attract-mode cycling chip.
  const heroes = useMemo(() => {
    if (count === 0) {
      const i = cycle;
      return [{ key: `a-${CHIPS[i].id}`, chip: CHIPS[i], index: i, pos: [50, 26.5], w: 17 * heroScale(i), accent: ERA[i], ctl: 2 }];
    }
    return slots.map((s, i) => s && {
      key: `${s.chip.id}-${count}`, chip: s.chip, index: s.index,
      pos: count === 1 ? [50, 27] : [i === 0 ? 32 : 68, 28],
      w: (count === 1 ? 17 : 12.5) * heroScale(s.index), accent: ERA[s.index], ctl: i,
    }).filter(Boolean);
  }, [slots, count, cycle]);

  const focusRow = ROWS.find((r) => r.key === focus);
  const toggleFocus = useCallback((key) => { setFocus((f) => (f === key ? null : key)); poke(); }, [poke]);

  const single = count === 1 ? placed[0] : null;
  const pair = count === 2 ? placed : null;
  const noteCount = single ? 2 + single.chip.facts.length : 0;
  const rowTop = (i) => `${ROW_TOP + i * ROW_H}%`;
  const L = pair?.[0];
  const R = pair?.[1];

  return (
    <MotionConfig reducedMotion="user">
      <main className="stage" ref={stageRef}>
        <div className="chassis" />
        <div className="display" />

        <svg className="layer" style={{ zIndex: 1 }} viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <path id="title-arc" d="M 31.1 7.6 A 46.4 46.4 0 0 1 68.9 7.6" />
          </defs>
          {TICKS.map((t, i) => <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} className="tick" />)}
          <circle cx="50" cy="50" r="38" className="hair" />
          <circle cx="50" cy="50" r="37.2" className="hair soft" />
          <text className="engrave"><textPath href="#title-arc" startOffset="50%" textAnchor="middle">EVOLUTION OF THE MICROCHIP</textPath></text>
          {CHIPS.map((c, i) => (
            <text key={c.id} x={HOME[i].lx} y={HOME[i].ly + 0.5} className={`year ${count ? 'dim' : ''}`}
              transform={`rotate(${HOME[i].rot} ${HOME[i].lx} ${HOME[i].ly})`}>{c.year}</text>
          ))}
          {DOCKS.map((p, i) => {
            const taken = !!slots[i];
            const cls = `dock ${drag ? 'hot' : ''} ${near === i ? 'near' : ''} ${taken ? 'taken' : ''}`;
            return (
              <g key={i} className={cls}>
                <circle cx={p[0]} cy={p[1]} r="6.9" className="dock-glow" />
                <circle cx={p[0]} cy={p[1]} r="6.3" className="dock-ring" />
                <circle cx={p[0]} cy={p[1]} r="5.6" className="dock-dash" />
                {[0, 90, 180, 270].map((a) => (
                  <line key={a} x1={p[0]} y1={p[1] - 7.9} x2={p[0]} y2={p[1] - 6.8} className="dock-mark" transform={`rotate(${a} ${p[0]} ${p[1]})`} />
                ))}
                <text x={p[0]} y={p[1] + 10.6} className="dock-label">DOCK {i ? 'B' : 'A'}</text>
              </g>
            );
          })}
        </svg>

        {CHIPS.map((c, i) => {
          const slot = placement[c.id];
          const dragging = drag?.id === c.id;
          const pos = dragging ? [drag.x, drag.y] : slot !== undefined ? DOCKS[slot] : [HOME[i].x, HOME[i].y];
          const size = dragging ? 12.5 : slot !== undefined ? 12 : 9;
          return (
            <Puck key={c.id} chip={c} pos={pos} size={size} dragging={dragging} seated={slot !== undefined}
              onKey={keyFor(c)} handlers={puckHandlers(c)} />
          );
        })}

        <ChipScene heroes={heroes} ctl={ctl} />

        <svg className="layer" style={{ zIndex: 4 }} viewBox="0 0 100 100" aria-hidden="true">
          {burst && [0, 1, 2].map((n) => (
            <circle key={`${burst.k}-${n}`} cx={DOCKS[burst.slot][0]} cy={DOCKS[burst.slot][1]} r="6.4" className="burst"
              style={{ animationDelay: `${n * 0.2}s`, stroke: ERA[slots[burst.slot]?.index ?? 0] }} />
          ))}
        </svg>

        <div className="hud">
          {heroes.map((h) => (
            <div key={`g-${h.key}`} className="grab" role="img" aria-label={`${h.chip.name}. Drag to turn it, tap to open it up.`}
              style={{ left: `${h.pos[0]}%`, top: `${h.pos[1]}%`, width: `${count === 2 ? 17 : 22}%`, height: `${count === 2 ? 17 : 22}%` }}
              {...grab(h.ctl)} />
          ))}

          {slots.map((s, i) => s && (
            <button key={s.chip.id} className="release" style={{ left: `${DOCKS[i][0] + 5.8}%`, top: `${DOCKS[i][1] - 5.8}%` }}
              onClick={() => seat(s.chip, null)} aria-label={`Remove the ${s.chip.year} puck`}>×</button>
          ))}

          {count === 0 && !drag && (
            <div className="attract">
              <AnimatePresence mode="wait">
                <motion.div key={cycle} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.5 }}>
                  <h2>{CHIPS[cycle].name}</h2>
                  <span className="sub" style={{ color: ERA[cycle] }}>{CHIPS[cycle].year} · {fmtNode(CHIPS[cycle].nodeNm)} process</span>
                </motion.div>
              </AnimatePresence>
              <div className="eras">
                {CHIPS.map((c, i) => (
                  <i key={c.id} className={i === cycle ? 'on' : ''} style={{ '--a': ERA[i] }} />
                ))}
              </div>
              <p className="hint">Lift a puck <b>and place it on a dock</b></p>
            </div>
          )}

          {single && (() => {
            const { chip, index } = single;
            const a = ERA[index];
            const facts = chip.facts;
            return (
              <div style={{ '--a': a }}>
                <button className="note" onClick={() => { if (focus) setFocus(null); else setNoteIdx((n) => (n + 1) % noteCount); poke(); }}>
                  <AnimatePresence mode="wait">
                    <motion.span key={`${focus}-${noteIdx}-${chip.id}`} className="note-in"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                      {focusRow ? (
                        <><em className="eyebrow">{focusRow.label}</em><span className="body">{focusRow.why}</span></>
                      ) : noteIdx === 0 ? (
                        <><strong className="name">{chip.name}</strong><span className="sub">{chip.year} · {fmtNode(chip.nodeNm)} process</span></>
                      ) : noteIdx === 1 ? (
                        <><em className="eyebrow">Story</em><span className="body">{chip.story}</span></>
                      ) : (
                        <><em className="eyebrow">Fact {noteIdx - 1} of {facts.length}</em><span className="body">{facts[noteIdx - 2]}</span></>
                      )}
                    </motion.span>
                  </AnimatePresence>
                  {!focusRow && (
                    <span className="pager" aria-hidden="true">
                      {Array.from({ length: noteCount }, (_, k) => <i key={k} className={k === noteIdx ? 'on' : ''} />)}
                    </span>
                  )}
                </button>
                {ROWS.map((row, k) => (
                  <motion.button key={`${chip.id}-${row.key}`} className={`row ${focus === row.key ? 'on' : ''}`} style={{ top: rowTop(k) }}
                    initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + k * 0.09, duration: 0.5 }}
                    onClick={() => toggleFocus(row.key)} aria-pressed={focus === row.key}>
                    <span className="lbl">{row.label}</span>
                    <span className="val"><Num to={row.get(chip)} fmt={row.fmt} delay={0.5 + k * 0.09} /></span>
                    <Scale row={row} chip={chip} />
                  </motion.button>
                ))}
              </div>
            );
          })()}

          {pair && (
            <div>
              <button className="note wide" onClick={() => { setFocus(null); poke(); }}>
                <AnimatePresence mode="wait">
                  <motion.span key={focus ?? 'names'} className="note-in"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                    {focusRow ? (
                      <><em className="eyebrow">{focusRow.label}</em><span className="body">{focusRow.why}</span></>
                    ) : (
                      <span className="duo">
                        <span className="side" style={{ '--a': ERA[L.index] }}><strong className="name">{L.chip.name}</strong><span className="sub">{L.chip.year}</span></span>
                        <span className="span">{Math.abs(R.chip.year - L.chip.year)} yrs</span>
                        <span className="side" style={{ '--a': ERA[R.index] }}><strong className="name">{R.chip.name}</strong><span className="sub">{R.chip.year}</span></span>
                      </span>
                    )}
                  </motion.span>
                </AnimatePresence>
              </button>
              {ROWS.map((row, k) => (
                <motion.button key={`${L.chip.id}-${R.chip.id}-${row.key}`} className={`brow ${focus === row.key ? 'on' : ''}`}
                  style={{ top: rowTop(k), '--l': ERA[L.index], '--r': ERA[R.index] }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 + k * 0.09 }}
                  onClick={() => toggleFocus(row.key)} aria-pressed={focus === row.key}
                  aria-label={`${row.label}: ${row.short(row.get(L.chip))} against ${row.short(row.get(R.chip))}`}>
                  <b className="bv l">{row.short(row.get(L.chip))}</b>
                  <span className="bar l"><i style={{ '--w': row.norm(L.chip), animationDelay: `${0.6 + k * 0.09}s` }} /></span>
                  <span className="bl"><em>{row.label}</em><u>{ratio(R.chip, L.chip, row.key)}</u></span>
                  <span className="bar r"><i style={{ '--w': row.norm(R.chip), animationDelay: `${0.6 + k * 0.09}s` }} /></span>
                  <b className="bv r">{row.short(row.get(R.chip))}</b>
                </motion.button>
              ))}
            </div>
          )}

          {count === 1 && !drag && <p className="hint low">Add a second puck to compare</p>}
        </div>
      </main>
    </MotionConfig>
  );
}
