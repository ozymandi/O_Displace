import { random, getSeed, setSeed, newSeed } from './prng.js';
import { getColor, adjustBrightness } from './palette.js';
import { computeMatrix, getCellOffset } from './matrix.js';
import { drawSolid } from './modules/solid.js';
import { drawAlpha } from './modules/alpha.js';
import { drawGrid } from './modules/grid.js';
import { drawVBars } from './modules/vbars.js';
import { drawHBars } from './modules/hbars.js';
import { drawWires } from './modules/wires.js';

const W = 1024;
const H = 1024;
const GRID = 10;

const TILE_OFFSETS = [
    [-W, -H], [0, -H], [W, -H],
    [-W,  0],          [W,  0],
    [-W,  H], [0,  H], [W,  H],
];

/** Wrap a shape string into 8 surrounding copies (+ original at 0,0). ClipPath handles visibility. */
function tile(shape) {
    return TILE_OFFSETS
        .map(([dx, dy]) => `<g transform="translate(${dx},${dy})">${shape}</g>`)
        .join('') + shape;
}

const NORMAL_MAP_FILTER = `
<filter id="normalMapFilter" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="linearRGB">
    <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.33 0.33 0.33 0 0" result="hMap" />
    <feConvolveMatrix in="hMap" order="3" kernelMatrix="-1 0 1  -2 0 2  -1 0 1" divisor="2" result="dx" preserveAlpha="true"/>
    <feConvolveMatrix in="hMap" order="3" kernelMatrix="-1 -2 -1  0 0 0  1 2 1" divisor="2" result="dy" preserveAlpha="true"/>
    <feColorMatrix in="dx" type="matrix" values="0 0 0 1 0.5  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="rChannel" />
    <feColorMatrix in="dy" type="matrix" values="0 0 0 0 0  0 0 0 1 0.5  0 0 0 0 0  0 0 0 0 1" result="gChannel" />
    <feComposite in="rChannel" in2="gChannel" operator="arithmetic" k2="1" k3="1" result="rgChannels" />
    <feColorMatrix in="rgChannels" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 0 0 1  0 0 0 1 0" />
</filter>`;

/**
 * Generate a pattern SVG string from the given parameters.
 * @returns {{ svg: string, seed: number }}
 */
export function generatePattern(p) {
    // Seed management
    const seed = p.createNewSeed ? newSeed() : getSeed();
    if (!p.createNewSeed) setSeed(seed); // reset PRNG to start of same seed

    // Layer matrix (consumes PRNG calls — must happen before drawing)
    if (p.matrix.enable) {
        computeMatrix(p.matrix.size, p.matrix.start, p.matrix.end, p.matrix.randomFactor, p.matrix.invert);
    }

    // --- Build SVG ---
    const parts = [
        `<svg class="canvas-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`,
        `<defs><clipPath id="canvasClip"><rect width="${W}" height="${H}" /></clipPath>${NORMAL_MAP_FILTER}</defs>`,
    ];

    const content = buildContent(p, seed);

    if (p.renderMode === 'normal') {
        parts.push(`<g filter="url(#normalMapFilter)">${content}</g>`);
    } else {
        parts.push(content);
    }

    parts.push('</svg>');
    return { svg: parts.join(''), seed };
}

function buildContent(p, _seed) {
    const { renderMode, palette, customColors, bgBrightness, matrix: m } = p;
    const parts = [`<g clip-path="url(#canvasClip)">`];

    // Background color
    let baseBg;
    if (renderMode !== 'color') {
        baseBg = '#000000';
    } else {
        const bgHex = Math.floor(bgBrightness).toString(16).padStart(2, '0').toUpperCase();
        baseBg = palette === 'grayscale' ? `#${bgHex}${bgHex}${bgHex}` : getColor(palette, customColors);
    }

    // Matrix cell backgrounds
    if (m.enable) {
        const cellW = W / m.size;
        const cellH = H / m.size;
        for (let my = 0; my < m.size; my++) {
            for (let mx = 0; mx < m.size; mx++) {
                const px = mx * cellW + cellW / 2;
                const py = my * cellH + cellH / 2;
                const offset = getCellOffset(px, py);
                let bg;
                if (renderMode === 'color') {
                    bg = adjustBrightness(baseBg, offset);
                } else {
                    const v = Math.max(0, Math.min(255, Math.floor(64 + (offset / 100) * 64)));
                    const h = v.toString(16).padStart(2, '0').toUpperCase();
                    bg = `#${h}${h}${h}`;
                }
                parts.push(`<rect x="${mx * cellW}" y="${my * cellH}" width="${cellW + 1}" height="${cellH + 1}" fill="${bg}" />`);
            }
        }
    } else {
        parts.push(`<rect width="${W}" height="${H}" fill="${baseBg}" />`);
    }

    // Active drawing modules
    const active = [];
    if (p.solid.enable)  active.push(0);
    if (p.alpha.enable)  active.push(1);
    if (p.grid.enable)   active.push(2);
    if (p.vbar.enable)   active.push(3);
    if (p.hbar.enable)   active.push(4);
    if (p.wire.enable)   active.push(5);

    if (active.length > 0) {
        for (let i = 0; i < p.iterations; i++) {
            const x = Math.round((random() * W) / GRID) * GRID;
            const y = Math.round((random() * H) / GRID) * GRID;

            let color;
            if (renderMode !== 'color') {
                let base = 20, range = 235;
                if (m.enable) {
                    const off = getCellOffset(x, y);
                    base = Math.floor(64 + (off / 100) * 64);
                    range = 127;
                }
                const v = Math.max(0, Math.min(255, Math.floor(base + (i / p.iterations) * range)));
                const h = v.toString(16).padStart(2, '0').toUpperCase();
                color = `#${h}${h}${h}`;
            } else {
                color = getColor(palette, customColors);
                if (m.enable) color = adjustBrightness(color, getCellOffset(x, y));
            }

            const mod = active[Math.floor(random() * active.length)];
            let shape;
            switch (mod) {
                case 0: shape = drawSolid(x, y, color, GRID, p.solid.scale); break;
                case 1: {
                    const op = renderMode === 'color' ? p.alpha.opacity / 100 : 1.0;
                    shape = drawAlpha(x, y, color, GRID, p.alpha.scale, op);
                    break;
                }
                case 2: shape = drawGrid(x, y, color, p.grid.amount, p.grid.scale, p.grid.spacing); break;
                case 3: shape = drawVBars(x, y, color, p.vbar.amount, p.vbar.scale, p.vbar.spacing); break;
                case 4: shape = drawHBars(x, y, color, p.hbar.amount, p.hbar.scale, p.hbar.spacing); break;
                case 5: shape = drawWires(x, y, color, p.wire.lineWidth, p.wire.crossProb, p.wire.nodeAmount, p.wire.nodeSpacing, p.wire.randomCenter); break;
            }
            parts.push(p.seamless ? tile(shape) : shape);
        }
    }

    parts.push('</g>');
    return parts.join('');
}
