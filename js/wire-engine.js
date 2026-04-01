import { random, getSeed, setSeed, newSeed } from './prng.js';
import { getColor } from './palette.js';

const W = 1024, H = 1024;

const TILE_OFFSETS = [
    [-W, -H], [0, -H], [W, -H],
    [-W,  0],          [W,  0],
    [-W,  H], [0,  H], [W,  H],
];

function tile(shape) {
    return TILE_OFFSETS
        .map(([dx, dy]) => `<g transform="translate(${dx},${dy})">${shape}</g>`)
        .join('') + shape;
}

/** Draw a decorative end cap at point (x, y) */
function drawEndCap(x, y, color, sw, type) {
    const r = Math.max(3, sw * 2.5);
    switch (type) {
        case 'circle':
            return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
        case 'square':
            return `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" fill="${color}"/>`;
        case 'circle-outline':
            return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
        case 'square-outline':
            return `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
        case 'cross': {
            const a = r * 1.2;
            return `<line x1="${x - a}" y1="${y}" x2="${x + a}" y2="${y}" stroke="${color}" stroke-width="${sw}" stroke-linecap="square"/>`
                 + `<line x1="${x}" y1="${y - a}" x2="${x}" y2="${y + a}" stroke="${color}" stroke-width="${sw}" stroke-linecap="square"/>`;
        }
        case 'diamond':
            return `<polygon points="${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}" fill="${color}"/>`;
        default:
            return '';
    }
}

/** Apply symmetry copies around canvas center */
function symmetrize(shape, symmetry, radialSteps) {
    switch (symmetry) {
        case 'horizontal':
            return shape + `<g transform="scale(-1,1) translate(-${W},0)">${shape}</g>`;
        case 'vertical':
            return shape + `<g transform="scale(1,-1) translate(0,-${H})">${shape}</g>`;
        case 'both':
            return shape
                + `<g transform="scale(-1,1) translate(-${W},0)">${shape}</g>`
                + `<g transform="scale(1,-1) translate(0,-${H})">${shape}</g>`
                + `<g transform="scale(-1,-1) translate(-${W},-${H})">${shape}</g>`;
        case 'radial': {
            const cx = W / 2, cy = H / 2;
            let out = shape;
            for (let i = 1; i < radialSteps; i++) {
                const deg = (360 / radialSteps) * i;
                out += `<g transform="rotate(${deg},${cx},${cy})">${shape}</g>`;
            }
            return out;
        }
        default:
            return shape;
    }
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

const DIRS = {
    cardinal: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    diagonal: [[1, 1], [-1, 1], [1, -1], [-1, -1]],
    any:      [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]],
};

const INV_SQRT2 = 1 / Math.sqrt(2);
const DIRS_45 = [
    [1, 0], [INV_SQRT2, INV_SQRT2], [0, 1], [-INV_SQRT2, INV_SQRT2],
    [-1, 0], [-INV_SQRT2, -INV_SQRT2], [0, -1], [INV_SQRT2, -INV_SQRT2],
];

/** Snap a continuous angle to the nearest 45° direction vector */
function snapDir(angle) {
    const idx = Math.round(angle / (Math.PI / 4)) & 7;
    return DIRS_45[idx];
}

/** Returns a 0–1 value based on layer index and mode. Calls random() only for 'random' mode. */
function computeT(idx, total, mode) {
    const t = total <= 1 ? 0.5 : idx / (total - 1);
    switch (mode) {
        case 'linear':     return t;
        case 'inv-linear': return 1 - t;
        case 'curve':      return Math.sin(Math.PI * t);
        case 'inv-curve':  return 1 - Math.sin(Math.PI * t);
        case 'random':     return random();
        default:           return t;
    }
}

function toGray(v) {
    const h = Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0').toUpperCase();
    return `#${h}${h}${h}`;
}

function modulateColor(hex, factor) {
    hex = hex.replace('#', '');
    const clamp = n => Math.max(0, Math.min(255, Math.round(n)));
    const pad = n => clamp(n).toString(16).padStart(2, '0').toUpperCase();
    return `#${pad(parseInt(hex.substr(0, 2), 16) * factor)}${pad(parseInt(hex.substr(2, 2), 16) * factor)}${pad(parseInt(hex.substr(4, 2), 16) * factor)}`;
}

export function generateWirePattern(p) {
    const seed = p.createNewSeed ? newSeed() : getSeed();
    if (!p.createNewSeed) setSeed(seed);

    const svgParts = [
        `<svg class="canvas-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`,
        `<defs><clipPath id="canvasClip"><rect width="${W}" height="${H}" /></clipPath>${NORMAL_MAP_FILTER}</defs>`,
    ];

    const content = buildContent(p);

    if (p.renderMode === 'normal') {
        svgParts.push(`<g filter="url(#normalMapFilter)">${content}</g>`);
    } else {
        svgParts.push(content);
    }

    svgParts.push('</svg>');
    return { svg: svgParts.join(''), seed };
}

function buildContent(p) {
    const parts = [`<g clip-path="url(#canvasClip)">`];

    const bgColor = p.renderMode !== 'color' ? '#000000' : toGray(p.bgBrightness);
    parts.push(`<rect width="${W}" height="${H}" fill="${bgColor}" />`);

    const dirPool = (p.stepDirections === 'conical' || p.stepDirections === 'burst')
        ? DIRS.any
        : (DIRS[p.stepDirections] || DIRS.any);

    for (let layer = 0; layer < p.layerCount; layer++) {
        const tColor = computeT(layer, p.layerCount, p.colorMode);
        const tWidth = computeT(layer, p.layerCount, p.widthMode);

        // Stroke color
        let strokeColor;
        if (p.renderMode !== 'color') {
            strokeColor = toGray(20 + tColor * 235);
        } else if (p.palette === 'grayscale' && p.colorMode !== 'random') {
            strokeColor = toGray(20 + tColor * 235);
        } else {
            const base = getColor(p.palette, p.customColors);
            strokeColor = p.colorMode === 'random' ? base : modulateColor(base, 0.15 + tColor * 0.85);
        }

        // Stroke width
        const strokeWidth = Math.max(1, Math.round(1 + tWidth * (p.maxWireWidth - 1)));

        for (let w = 0; w < p.wiresPerLayer; w++) {
            // Origin point
            const ox = W / 2 + (random() - 0.5) * 2 * p.maxOriginSpread;
            const oy = H / 2 + (random() - 0.5) * 2 * p.maxOriginSpread;

            let cx = ox, cy = oy;
            const pts = [`${Math.round(cx)},${Math.round(cy)}`];

            // Initial direction
            let dir;
            if (p.stepDirections === 'burst') {
                // Evenly distributed radial angle, small jitter
                const totalWires = p.layerCount * p.wiresPerLayer;
                const wireIdx = layer * p.wiresPerLayer + w;
                const baseAngle = (wireIdx / totalWires) * Math.PI * 2;
                const jitter = (random() - 0.5) * (Math.PI * 2 / totalWires) * 0.5;
                const a = baseAngle + jitter;
                dir = [Math.cos(a), Math.sin(a)];
            } else if (p.stepDirections === 'conical') {
                const dx = ox - W / 2, dy = oy - H / 2;
                const len = Math.sqrt(dx * dx + dy * dy);
                const rawAngle = len < 1 ? random() * Math.PI * 2 : Math.atan2(dy, dx);
                dir = snapDir(rawAngle);
            } else {
                dir = dirPool[Math.floor(random() * dirPool.length)];
            }

            const steps = 4 + Math.floor(random() * 5); // 4–8 segments
            for (let s = 0; s < steps; s++) {
                const len = p.minStepLength + random() * (p.maxStepLength - p.minStepLength);
                cx += dir[0] * len;
                cy += dir[1] * len;
                pts.push(`${Math.round(cx)},${Math.round(cy)}`);

                // Update direction
                if (p.stepDirections === 'burst') {
                    const a = Math.atan2(dir[1], dir[0]) + (random() - 0.5) * 0.45;
                    dir = [Math.cos(a), Math.sin(a)];
                } else if (p.stepDirections === 'conical') {
                    // Stay same or turn ±45°
                    const turn = Math.floor(random() * 3) - 1; // -1, 0, +1
                    const a = Math.atan2(dir[1], dir[0]) + turn * (Math.PI / 4);
                    dir = snapDir(a);
                } else if (random() > 0.35) {
                    dir = dirPool[Math.floor(random() * dirPool.length)];
                }
            }

            const lastPt = pts[pts.length - 1].split(',');
            const ex = parseFloat(lastPt[0]), ey = parseFloat(lastPt[1]);
            const cap = p.lineCap !== 'none' ? drawEndCap(ex, ey, strokeColor, strokeWidth, p.lineCap) : '';
            const baseShape = `<polyline points="${pts.join(' ')}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="square" stroke-linejoin="miter"/>${cap}`;
            const shape = symmetrize(baseShape, p.symmetry, p.radialSteps);
            parts.push(p.seamless ? tile(shape) : shape);
        }
    }

    parts.push('</g>');
    return parts.join('');
}
