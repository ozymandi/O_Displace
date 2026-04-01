import { random } from '../prng.js';

export function drawSolid(x, y, color, gridSize, scale) {
    const sw = Math.round((random() * ((scale / 100) * 300) + 20) / gridSize) * gridSize;
    const sh = Math.round((random() * ((scale / 100) * 300) + 20) / gridSize) * gridSize;
    return `<rect x="${x}" y="${y}" width="${sw}" height="${sh}" fill="${color}" />`;
}
