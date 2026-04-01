import { random } from '../prng.js';

export function drawGrid(x, y, color, maxAmount, scale, spacing) {
    const gSize = (scale / 100) * 40;
    const step = gSize + ((spacing / 100) * 20);
    const amount = Math.floor(random() * maxAmount) + 1;
    const parts = [`<g fill="${color}">`];
    for (let gx = 0; gx < amount; gx++) {
        for (let gy = 0; gy < amount; gy++) {
            if (random() > 0.3) {
                parts.push(`<rect x="${x + gx * step}" y="${y + gy * step}" width="${gSize}" height="${gSize}" />`);
            }
        }
    }
    parts.push('</g>');
    return parts.join('');
}
