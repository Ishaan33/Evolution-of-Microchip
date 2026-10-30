'use client';

import { useEffect, useState } from 'react';
import { animate } from 'motion/react';

// Counts from 0 up to a value, formatting each step with fmt.
export default function Num({ to, fmt, delay = 0.35, duration = 1.3 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const a = animate(0, to, { duration, delay, ease: [0.16, 1, 0.3, 1], onUpdate: setV });
    return () => a.stop();
  }, [to, delay, duration]);
  const done = Math.abs(v - to) <= Math.abs(to) * 0.002;
  const step = to >= 10 ? Math.round(v) : +v.toFixed(to < 1 ? 4 : 1);
  return <>{fmt(done ? to : step)}</>;
}
