import { random } from '../prng.js';

export function drawAlpha(x, y, color, gridSize, scale, opacity) {
    const aw = Math.round((random() * ((scale / 100) * 400) + 50) / gridSize) * gridSize;
    const ah = Math.round((random() * ((scale / 100) * 400) + 50) / gridSize) * gridSize;
    return `<rect x="${x}" y="${y}" width="${aw}" height="${ah}" fill="${color}" fill-opacity="${opacity}" />`;
}
