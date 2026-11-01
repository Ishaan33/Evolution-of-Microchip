import { bindGrab } from '@/interaction/input';
import { AttractPanel } from '@/ui/AttractPanel';
import { PairReadout } from '@/ui/PairReadout';
import { SingleReadout } from '@/ui/SingleReadout';
import { make } from '@/utils/dom';
/** Everything drawn over the 3D chips. Each part lives while its key does, so running animations are never restarted. */
export class Hud {
    el = make('div', 'hud');
    cfg;
    actions;
    grabs = new Map();
    attract = null;
    single = null;
    pair = null;
    heldId = null;
    /** In the empty ring beside a single chip. */
    hint = make('p', 'hint low', 'Add a second puck');
    /** Names the chip in hand while the table is otherwise empty. */
    hold = make('div', 'hold');
    constructor(cfg, actions) {
        this.cfg = cfg;
        this.actions = actions;
    }
    update(s) {
        this.syncGrabs(s);
        this.syncAttract(s);
        this.syncSingle(s);
        this.syncPair(s);
        const want = [
            ...this.grabs.values(),
            this.attract?.el, this.single?.el, this.pair?.el,
            s.count === 1 && !s.drag ? this.hint : null,
            s.count === 0 && s.dragChip ? this.hold : null,
        ].filter(Boolean);
        if (s.count === 1) {
            const free = this.cfg.app.dock.positions[s.slots[0] ? 1 : 0];
            this.hint.style.left = `${free[0]}%`;
            this.hint.style.top = `${free[1]}%`;
        }
        if (s.dragChip && this.heldId !== s.dragChip.chip.id) {
            this.heldId = s.dragChip.chip.id;
            const name = make('strong', 'name', s.dragChip.chip.name);
            const sub = make('span', 'sub', `${s.dragChip.chip.year} · place it on a glowing ring`);
            sub.style.setProperty('--a', s.dragChip.color);
            this.hold.replaceChildren(name, sub);
        }
        want.forEach((e, i) => {
            if (this.el.children[i] !== e)
                this.el.insertBefore(e, this.el.children[i] ?? null);
        });
        while (this.el.children.length > want.length)
            this.el.lastElementChild.remove();
    }
    syncGrabs({ heroes, count }) {
        const { hero } = this.cfg.app;
        const keys = new Set(heroes.map((h) => h.key));
        for (const key of this.grabs.keys()) {
            if (!keys.has(key))
                this.grabs.delete(key);
        }
        const size = `${count === 2 ? hero.pair.grab : hero.single.grab}%`;
        for (const h of heroes) {
            let el = this.grabs.get(h.key);
            if (!el) {
                el = make('div', 'grab');
                el.role = 'img';
                el.ariaLabel = `${h.chip.name}. Drag to turn it, tap to open it up.`;
                bindGrab(el, () => this.actions.ctl[el.dataset.ctl], this.actions.poke);
                this.grabs.set(h.key, el);
            }
            el.dataset.ctl = h.ctl;
            const st = el.style;
            st.left = `${h.pos[0]}%`;
            st.top = `${h.pos[1]}%`;
            st.width = size;
            st.height = size;
        }
    }
    syncAttract({ count, drag, cycle }) {
        const show = count === 0 && !drag;
        if (show && !this.attract)
            this.attract = new AttractPanel(this.cfg.chips);
        if (!show && this.attract) {
            this.attract.destroy();
            this.attract = null;
        }
        this.attract?.show(cycle);
    }
    syncSingle(s) {
        if (this.single && this.single.id !== s.single?.chip.id) {
            this.single.destroy();
            this.single = null;
        }
        if (s.single && !this.single) {
            this.single = new SingleReadout(s.single, { onNote: this.actions.advanceNote });
        }
        this.single?.update(s);
    }
    syncPair(s) {
        const id = s.pair ? `${s.pair[0].chip.id}-${s.pair[1].chip.id}` : null;
        if (this.pair && this.pair.id !== id) {
            this.pair.destroy();
            this.pair = null;
        }
        if (s.pair && !this.pair) {
            this.pair = new PairReadout(s.pair, { onNote: this.actions.clearFocus });
        }
        this.pair?.update(s);
    }
    destroy() {
        this.attract?.destroy();
        this.single?.destroy();
        this.pair?.destroy();
        this.el.remove();
    }
}
