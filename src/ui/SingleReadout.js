import { eyebrowNote } from '@/ui/note';
import { Swap } from '@/ui/Swap';
import { ERA } from '@/ui/tokens';
import { make } from '@/utils/dom';
import { fmtNode, fmtTransistors } from '@/utils/metrics';
/** One docked chip: a note to tap through (name, story, facts) under the dial. */
export class SingleReadout {
    el = make('div');
    id;
    chip;
    swap;
    note = make('button', 'note');
    pager = make('span', 'pager');
    constructor({ chip, index }, { onNote }) {
        this.chip = chip;
        this.id = chip.id;
        this.el.style.setProperty('--a', ERA[index]);
        const { note } = this;
        note.addEventListener('click', onNote);
        this.pager.ariaHidden = 'true';
        note.append(this.pager);
        this.swap = new Swap(note, { duration: 0.3, enterY: 6 });
        this.el.append(note);
    }
    update({ focusRow, noteIdx, noteCount, focus }) {
        const { chip, pager } = this;
        this.swap.show(`${focus}-${noteIdx}-${chip.id}`, () => {
            if (focusRow)
                return eyebrowNote(focusRow.label, focusRow.why);
            if (noteIdx === 1)
                return eyebrowNote('Story', chip.story, 'body story');
            if (noteIdx > 1)
                return eyebrowNote(`Fact ${noteIdx - 1} of ${chip.facts.length}`, chip.facts[noteIdx - 2]);
            const el = make('span', 'note-in');
            el.append(make('strong', 'name', chip.name), make('span', 'sub', `${fmtNode(chip.nodeNm)} process · ${fmtTransistors(chip.transistors)} transistors`));
            return el;
        });
        if (focusRow)
            pager.remove();
        else if (!pager.isConnected)
            this.note.append(pager);
        if (pager.childElementCount !== noteCount)
            pager.replaceChildren(...Array.from({ length: noteCount }, () => make('i')));
        [...pager.children].forEach((d, k) => { d.className = k === noteIdx ? 'on' : ''; });
    }
    destroy() {
        this.swap.destroy();
        this.el.remove();
    }
}
