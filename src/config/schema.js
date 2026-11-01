import { z } from 'zod';
const point = z.tuple([z.number(), z.number()]);
const hero = z.object({ x: z.number(), y: z.number(), width: z.number().positive(), grab: z.number().positive() });
export const appSchema = z.object({
    display: z.object({ diameterMm: z.number().positive() }),
    pucks: z.object({
        /** How pucks are detected. "auto" reads the touch surface when there is one and simulates them otherwise. */
        sensor: z.enum(['auto', 'touch', 'sim']),
        diameterMm: z.number().positive(), homeRadius: z.number(), arc: point,
        socketTolerance: z.number().positive(), footToleranceMm: z.number().positive(),
        spring: z.object({ stiffness: z.number().positive(), damping: z.number().positive() }),
        /** Chip id -> the three distances between a puck's conductive feet, in mm, shortest first. */
        signatures: z.record(z.string(), z.tuple([z.number(), z.number(), z.number()])),
    }),
    dock: z.object({ positions: z.tuple([point, point]), radius: z.number().positive(), snap: z.number() }),
    dial: z.object({
        inner: z.number().positive(), width: z.number().positive(), gap: z.number().min(0),
        pairSpanDeg: z.number().positive(), stagger: z.number().min(0), conduitDelay: z.number().min(0),
    }),
    hero: z.object({
        attract: hero,
        single: hero,
        pair: hero.extend({ x: point }),
        shrink: z.number().min(0).max(1),
    }),
    camera: z.object({ fov: z.number(), near: z.number(), far: z.number() }),
    bloom: z.object({ strength: z.number().min(0), radius: z.number().min(0), threshold: z.number().min(0) }),
    timing: z.object({ idleReset: z.number(), attractCycle: z.number(), airTimeout: z.number(), liftGrace: z.number() }),
});
/** Specs from the evolution-1 prototype. story/facts are placeholder copy until HCL supplies final data. */
export const chipsSchema = z.object({
    chips: z.array(z.object({
        id: z.string().min(1),
        year: z.number().int(),
        name: z.string().min(1),
        cores: z.number().positive(),
        speedGHz: z.number().positive(),
        powerW: z.number().positive(),
        nodeNm: z.number().positive(),
        transistors: z.number().positive(),
        story: z.string(),
        facts: z.array(z.string()),
    })).min(1),
});
