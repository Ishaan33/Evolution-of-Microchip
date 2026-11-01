import { puckSize } from '@/layout/table';
import { ERA } from '@/ui/tokens';
const SVG = 'http://www.w3.org/2000/svg';
/** What is engraved in the film: a socket for each puck along the lower rim, with its year showing once the puck is away. */
export class TableFace {
    el = document.createElementNS(SVG, 'svg');
    years;
    sockets;
    constructor(app, chips, home) {
        this.el.setAttribute('class', 'layer');
        this.el.setAttribute('viewBox', '0 0 100 100');
        this.el.setAttribute('aria-hidden', 'true');
        this.el.style.zIndex = 1;
        const r = puckSize(app) / 2 + 0.5;
        this.el.innerHTML = `
      ${chips.map((_, i) => `<circle cx="${home[i].x}" cy="${home[i].y}" r="${r}" class="socket"/>`).join('')}
      ${chips.map((c, i) => `<text x="${home[i].x}" y="${home[i].y}" dy="0.62" class="year" style="--a:${ERA[i]}">${c.year}</text>`).join('')}`;
        this.years = [...this.el.querySelectorAll('.year')];
        this.sockets = [...this.el.querySelectorAll('.socket')];
    }
    update({ empty }) {
        this.years.forEach((y, i) => {
            const away = empty[i];
            y.classList.toggle('on', away);
            this.sockets[i].classList.toggle('open', away);
        });
    }
}
