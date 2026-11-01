/** A new element with a class and optional text. */
export function make(tag, className = '', text) {
    const el = document.createElement(tag);
    if (className)
        el.className = className;
    if (text !== undefined)
        el.textContent = text;
    return el;
}
/** True when the visitor asked for less motion: elements fade but do not travel. */
export const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** The CSS font stack for Oxanium, for text drawn onto canvases. */
export const brandFont = () => getComputedStyle(document.documentElement).getPropertyValue('--font-oxanium');
