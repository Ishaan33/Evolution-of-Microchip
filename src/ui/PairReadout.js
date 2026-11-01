import { eyebrowNote } from '@/ui/note';
import { Swap } from '@/ui/Swap';
import { ERA } from '@/ui/tokens';
import { make } from '@/utils/dom';
/** Two docked chips: their names and the years between them, under the dial. */
export class PairReadout {
    el = make('div');
    id;
    L;
    R;
    swap;
    constructor([L, R], { onNote }) {
        this.L = L;
        this.R = R;
        this.id = `${L.chip.id}-${R.chip.id}`;
        const note = make('button', 'note wide');
        note.addEventListener('click', onNote);
        this.swap = new Swap(note, { duration: 0.3, enterY: 6 });
        this.el.append(note);
    }
    update({ focus, focusRow }) {
        const { L, R } = this;
        this.swap.show(focus ?? 'names', () => {
            if (focusRow)
                return eyebrowNote(focusRow.label, focusRow.why);
            const side = ({ chip, index }) => {
                const el = make('span', 'side');
                el.style.setProperty('--a', ERA[index]);
                el.append(make('strong', 'name', chip.name), make('span', 'sub', String(chip.year)));
                return el;
            };
            const duo = make('span', 'duo');
            duo.append(side(L), side(R));
            const el = make('span', 'note-in');
            el.append(duo);
            return el;
        });
    }
    destroy() {
        this.swap.destroy();
        this.el.remove();
    }
}
