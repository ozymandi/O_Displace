import { random } from './prng.js';

const W = 1024;
const H = 1024;

let _offsets = [];
let _size = 1;

/**
 * Compute the NxN layer matrix brightness offsets.
 * Must be called after the PRNG is seeded (i.e., inside generatePattern).
 */
export function computeMatrix(size, start, end, randomFactor, invert) {
    _size = size;
    _offsets = [];
    const totalCells = size * size;
    const cells = [];

    for (let my = 0; my < size; my++) {
        _offsets[my] = [];
        for (let mx = 0; mx < size; mx++) {
            const idx = my * size + mx;
            const noise = (random() * 2 - 1) * (randomFactor / 100) * (totalCells * 2);
            cells.push({ x: mx, y: my, sortKey: idx + noise });
        }
    }

    cells.sort((a, b) => a.sortKey - b.sortKey);

    for (let i = 0; i < totalCells; i++) {
        let norm = totalCells > 1 ? i / (totalCells - 1) : 0;
        if (invert) norm = 1.0 - norm;
        const offset = start + norm * (end - start);
        _offsets[cells[i].y][cells[i].x] = offset;
    }
}

export function getCellOffset(px, py) {
    const cx = Math.max(0, Math.min(W - 1, px));
    const cy = Math.max(0, Math.min(H - 1, py));
    const cellX = Math.floor(cx / (W / _size));
    const cellY = Math.floor(cy / (H / _size));
    return _offsets[cellY][cellX];
}
