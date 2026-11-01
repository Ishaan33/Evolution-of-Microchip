import { Swap } from '@/ui/Swap';
import { ERA } from '@/ui/tokens';
import { make } from '@/utils/dom';
import { fmtNode } from '@/utils/metrics';
/** The empty table: the title, the chip on show and the invitation to lift a puck. */
export class AttractPanel {
    el = make('div', 'attract');
    chips;
    swap;
    constructor(chips) {
        this.chips = chips;
        const title = make('h1', 'title', 'Evolution of the Microchip');
        const slot = make('div', 'attract-slot');
        const hint = make('p', 'hint', 'Lift a puck ');
        hint.append(make('b', '', 'and place it on a ring'));
        this.el.append(title, slot, hint);
        this.swap = new Swap(slot, { duration: 0.45, enterY: 7, exitY: -5 });
    }
    show(cycle) {
        const chip = this.chips[cycle];
        this.swap.show(cycle, () => {
            const sub = make('span', 'sub', `${chip.year} · ${chip.name} · ${fmtNode(chip.nodeNm)}`);
            sub.style.setProperty('--a', ERA[cycle]);
            return sub;
        });
    }
    destroy() {
        this.swap.destroy();
        this.el.remove();
    }
}
