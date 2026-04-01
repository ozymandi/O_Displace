import { random } from '../prng.js';

export function drawWires(x, y, color, lineWidth, crossProb, maxNodes, nodeSpacing, randomCenter) {
    const len = random() * 500 + 100;
    const isCross = random() < crossProb / 100;
    const rcPct = randomCenter / 100;
    const shiftH = (random() * 2 - 1) * (len / 2) * rcPct;
    const shiftV = (random() * 2 - 1) * (len / 2) * rcPct;

    const hX = x - len / 2 + shiftH;
    const hY = y - lineWidth / 2;
    const vX = x - lineWidth / 2;
    const vY = y - len / 2 + shiftV;

    const parts = [`<g fill="${color}">`];

    if (isCross) {
        parts.push(`<rect x="${hX}" y="${hY}" width="${len}" height="${lineWidth}" />`);
        parts.push(`<rect x="${vX}" y="${vY}" width="${lineWidth}" height="${len}" />`);
        if (maxNodes > 0) {
            parts.push(`<g fill="none" stroke="${color}" stroke-width="${lineWidth}">`);
            const nAmt = Math.floor(random() * maxNodes) + 1;
            for (let n = 1; n <= nAmt; n++) {
                const bS = lineWidth + n * nodeSpacing * 2;
                parts.push(`<rect x="${x - bS / 2}" y="${y - bS / 2}" width="${bS}" height="${bS}" />`);
            }
            parts.push('</g>');
        }
    } else {
        if (random() > 0.5) parts.push(`<rect x="${hX}" y="${hY}" width="${len}" height="${lineWidth}" />`);
        else parts.push(`<rect x="${vX}" y="${vY}" width="${lineWidth}" height="${len}" />`);
    }

    parts.push('</g>');
    return parts.join('');
}
