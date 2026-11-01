import { make } from '@/utils/dom';
/** The note's content: an eyebrow over a line of body text. */
export function eyebrowNote(eyebrow, body, bodyClass = 'body') {
    const el = make('span', 'note-in');
    el.append(make('em', 'eyebrow', eyebrow), make('span', bodyClass, body));
    return el;
}
