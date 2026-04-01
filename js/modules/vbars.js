import { random } from '../prng.js';

export function drawVBars(x, y, color, maxAmount, scale, spacing) {
    const height = (scale / 100) * 200;
    const gap = (spacing / 100) * 15;
    const amount = Math.floor(random() * maxAmount) + 2;
    const parts = [`<g fill="${color}">`];
    let pos = 0;
    for (let b = 0; b < amount; b++) {
        const w = random() * 15 + 2;
        parts.push(`<rect x="${x + pos}" y="${y}" width="${w}" height="${height}" />`);
        pos += w + gap;
    }
    parts.push('</g>');
    return parts.join('');
}
