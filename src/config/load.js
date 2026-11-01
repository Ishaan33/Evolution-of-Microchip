import appJson from '../../config/app.json';
import chipsJson from '../../config/chips.json';
import { appSchema, chipsSchema } from '@/config/schema';
/** Validates bundled config. Throws with a readable message on any problem. */
export function loadConfig() {
    const app = appSchema.parse(appJson);
    const chips = chipsSchema.parse(chipsJson).chips;
    const ids = new Set();
    for (const c of chips) {
        if (ids.has(c.id))
            throw new Error(`Duplicate chip id: ${c.id}`);
        ids.add(c.id);
    }
    return { app, chips };
}
