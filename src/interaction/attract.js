/** Timers for an unattended table: a minute without a touch clears the docks; an empty table cycles through the chips. */
export class Attract {
    timing;
    onIdle;
    onCycle;
    lastTouch = performance.now();
    lastCycle = performance.now();
    constructor(timing, onIdle, onCycle) {
        this.timing = timing;
        this.onIdle = onIdle;
        this.onCycle = onCycle;
    }
    touch() { this.lastTouch = performance.now(); }
    restartCycle() { this.lastCycle = performance.now(); }
    update(now, count) {
        if (count > 0) {
            if (now - this.lastTouch > this.timing.idleReset)
                this.onIdle();
        }
        else if (now - this.lastCycle > this.timing.attractCycle) {
            this.lastCycle = now;
            this.onCycle();
        }
    }
}
