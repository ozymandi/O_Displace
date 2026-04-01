import { random } from '../prng.js';

export function drawHBars(x, y, color, maxAmount, scale, spacing) {
    const width = (scale / 100) * 200;
    const gap = (spacing / 100) * 15;
    const amount = Math.floor(random() * maxAmount) + 2;
    const parts = [`<g fill="${color}">`];
    let pos = 0;
    for (let b = 0; b < amount; b++) {
        const h = random() * 15 + 2;
        parts.push(`<rect x="${x}" y="${y + pos}" width="${width}" height="${h}" />`);
        pos += h + gap;
    }
    parts.push('</g>');
    return parts.join('');
}
