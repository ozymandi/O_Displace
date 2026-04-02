import { random, getSeed, setSeed, newSeed } from './prng.js';

const W = 1024, H = 1024;

function hexToRgb(hex) {
    return [parseInt(hex.substr(1,2),16), parseInt(hex.substr(3,2),16), parseInt(hex.substr(5,2),16)];
}
function rgbToHex(r,g,b) {
    return '#' + [r,g,b].map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
}
function shadeColor(hex, factor) {
    const [r,g,b] = hexToRgb(hex);
    return rgbToHex(r*factor, g*factor, b*factor);
}
function toGray(v) {
    const h = Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0').toUpperCase();
    return `#${h}${h}${h}`;
}

const NORMAL_MAP_FILTER = `
<filter id="normalMapFilter" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse" color-interpolation-filters="linearRGB">
    <feColorMatrix in="SourceGraphic" type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0" result="gray"/>
    <feConvolveMatrix in="gray" order="3" kernelMatrix="-1 0 1  -2 0 2  -1 0 1" divisor="4" bias="0.5" result="dx"/>
    <feConvolveMatrix in="gray" order="3" kernelMatrix="1 2 1  0 0 0  -1 -2 -1" divisor="4" bias="0.5" result="dy"/>
    <feColorMatrix in="dx" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="rOnly"/>
    <feColorMatrix in="dy" type="matrix" values="0 0 0 0 0  1 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="gOnly"/>
    <feComposite in="rOnly" in2="gOnly" operator="arithmetic" k2="1" k3="1" result="rg"/>
    <feColorMatrix in="rg" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 0 0 1  0 0 0 1 0"/>
</filter>`;

/** Compute block layout from params */
function computeBlocks(p) {
    const { blockCount, ratio, variation, margin, anchor, overhang } = p;
    const isVertComp = ratio >= 0.5;
    const blocks = [];

    if (isVertComp) {
        // Blocks arranged left→right (vertical columns)
        const totalMargin = margin * (blockCount - 1);
        const baseW = (W - totalMargin) / blockCount;
        const rawW = Array.from({length: blockCount}, () => Math.max(10, baseW * (1 + (random()-0.5) * variation)));
        const wScale = (W - totalMargin) / rawW.reduce((a,b)=>a+b, 0);

        let x = 0;
        for (let i = 0; i < blockCount; i++) {
            const w = rawW[i] * wScale;
            const minH = H * (1 - overhang);
            const h = Math.max(20, minH + random() * (H - minH) * Math.max(0.1, variation));
            let y;
            if (anchor === 'start')  { y = 0; }
            else if (anchor === 'end') { y = H - h; }
            else if (anchor === 'both') { y = 0; blocks.push({ x, y, w: Math.max(10, w), h: H, isVertComp, index: i, blockCount }); x += w + margin; continue; }
            else { y = random() * Math.max(0, H - h); }
            blocks.push({ x, y, w: Math.max(10, w), h, isVertComp, index: i, blockCount });
            x += w + margin;
        }
    } else {
        // Blocks stacked top→bottom (horizontal bands)
        const totalMargin = margin * (blockCount - 1);
        const baseH = (H - totalMargin) / blockCount;
        const rawH = Array.from({length: blockCount}, () => Math.max(10, baseH * (1 + (random()-0.5) * variation)));
        const hScale = (H - totalMargin) / rawH.reduce((a,b)=>a+b, 0);

        let y = 0;
        for (let i = 0; i < blockCount; i++) {
            const h = rawH[i] * hScale;
            const minW = W * (1 - overhang);
            const w = Math.max(20, minW + random() * (W - minW) * Math.max(0.1, variation));
            let x;
            if (anchor === 'start')  { x = 0; }
            else if (anchor === 'end') { x = W - w; }
            else if (anchor === 'both') { x = 0; blocks.push({ x: 0, y, w: W, h: Math.max(10, h), isVertComp, index: i, blockCount }); y += h + margin; continue; }
            else { x = random() * Math.max(0, W - w); }
            blocks.push({ x, y, w: Math.max(10, w), h: Math.max(10, h), isVertComp, index: i, blockCount });
            y += h + margin;
        }
    }
    return blocks;
}

/** Generate chips (notch/protrusion specs) for one block.
 *  d > 0 = outward protrusion; d < 0 = inward cut
 *  Inner shared edges only get inward cuts.
 */
function generateChips(block, p) {
    const { x, y, w, h, isVertComp, index, blockCount } = block;
    const chips = [];

    const dominance = Math.abs(p.ratio - 0.5) * 2; // 0..1
    // Density per edge [top, right, bottom, left]
    const densities = isVertComp
        ? [0.2 + (1-dominance)*0.25, 0.4 + dominance*0.5, 0.2 + (1-dominance)*0.25, 0.4 + dominance*0.5]
        : [0.4 + dominance*0.5, 0.2 + (1-dominance)*0.25, 0.4 + dominance*0.5, 0.2 + (1-dominance)*0.25];

    // Inner edges (shared boundary with adjacent block) — only inward cuts allowed
    const innerEdge = isVertComp
        ? [false, index < blockCount-1, false, index > 0]
        : [index > 0, false, index < blockCount-1, false];

    const edgeLens = [w, h, w, h];
    const minChipSize = 6 + p.smoothness * 40;
    const maxDepth = 3 + p.detailDepth * 22;

    for (let edge = 0; edge < 4; edge++) {
        const edgeLen = edgeLens[edge];
        const density = densities[edge];
        const inner = innerEdge[edge];

        const maxChips = Math.max(1, Math.floor(edgeLen / (minChipSize * 2.8)));
        const numChips = Math.round(maxChips * density * (0.3 + random() * 0.7));

        const edgeChips = [];
        for (let i = 0; i < numChips; i++) {
            for (let attempt = 0; attempt < 10; attempt++) {
                const chipFrac = (minChipSize + random() * minChipSize) / edgeLen;
                const t1 = 0.04 + random() * Math.max(0, 0.88 - chipFrac);
                const t2 = Math.min(0.96, t1 + chipFrac);
                if (t2 - t1 < 0.02) continue;
                const overlap = edgeChips.some(c => !(t2 <= c.t1 + 0.01 || t1 >= c.t2 - 0.01));
                if (!overlap) {
                    const sign = inner ? -1 : (random() > 0.35 ? -1 : 1);
                    const d = sign * (maxDepth * 0.25 + random() * maxDepth * 0.75);
                    edgeChips.push({ edge, t1, t2, d });
                    break;
                }
            }
        }
        chips.push(...edgeChips);
    }
    return chips;
}

/** Build SVG polygon path from block and chips.
 *  Convention: d > 0 = protrusion outward from block, d < 0 = inward cut.
 *  Traversal: clockwise — top L→R, right T→B, bottom R→L, left B→T.
 */
function buildPolygon(bx, by, bw, bh, chips) {
    const byEdge = [[],[],[],[]];
    for (const c of chips) byEdge[c.edge].push(c);
    byEdge[0].sort((a,b)=>a.t1-b.t1); // top L→R
    byEdge[1].sort((a,b)=>a.t1-b.t1); // right T→B
    byEdge[2].sort((a,b)=>b.t1-a.t1); // bottom R→L
    byEdge[3].sort((a,b)=>b.t1-a.t1); // left B→T

    const pts = [];

    // Top edge
    pts.push([bx, by]);
    for (const c of byEdge[0]) {
        pts.push([bx + c.t1*bw, by]);
        pts.push([bx + c.t1*bw, by - c.d]);
        pts.push([bx + c.t2*bw, by - c.d]);
        pts.push([bx + c.t2*bw, by]);
    }
    pts.push([bx + bw, by]);

    // Right edge
    for (const c of byEdge[1]) {
        pts.push([bx + bw, by + c.t1*bh]);
        pts.push([bx + bw + c.d, by + c.t1*bh]);
        pts.push([bx + bw + c.d, by + c.t2*bh]);
        pts.push([bx + bw, by + c.t2*bh]);
    }
    pts.push([bx + bw, by + bh]);

    // Bottom edge (R→L, so t2 encountered first)
    for (const c of byEdge[2]) {
        pts.push([bx + c.t2*bw, by + bh]);
        pts.push([bx + c.t2*bw, by + bh + c.d]);
        pts.push([bx + c.t1*bw, by + bh + c.d]);
        pts.push([bx + c.t1*bw, by + bh]);
    }
    pts.push([bx, by + bh]);

    // Left edge (B→T, so t2 encountered first)
    for (const c of byEdge[3]) {
        pts.push([bx, by + c.t2*bh]);
        pts.push([bx - c.d, by + c.t2*bh]);
        pts.push([bx - c.d, by + c.t1*bh]);
        pts.push([bx, by + c.t1*bh]);
    }

    return 'M ' + pts.map(p => p[0].toFixed(1)+','+p[1].toFixed(1)).join(' L ') + ' Z';
}

/** Gap probability for a block on a given layer */
function gapProb(block, layerFactor, p) {
    // layerFactor: 0=back (no gaps), 1=front (full gaps)
    const baseAmt = p.gapAmount * layerFactor;
    if (p.gapMode === 'none' || baseAmt <= 0) return 0;

    const cx = (block.x + block.w/2) / W;
    const cy = (block.y + block.h/2) / H;
    let spatial = 1;

    switch (p.gapMode) {
        case 'radial': {
            const dist = Math.sqrt((cx-0.5)**2 + (cy-0.5)**2) * 1.4;
            spatial = Math.max(0, 1 - dist);
            break;
        }
        case 'sin': {
            const t = block.isVertComp ? cx : cy;
            spatial = 0.5 + 0.5 * Math.sin(t * Math.PI * 3);
            break;
        }
        case 'edges': {
            const edge = 1 - Math.min(cx, 1-cx, cy, 1-cy) * 4;
            spatial = Math.max(0, edge);
            break;
        }
        case 'dir-l': spatial = 1 - cx; break;
        case 'dir-r': spatial = cx; break;
        case 'dir-t': spatial = 1 - cy; break;
        case 'dir-b': spatial = cy; break;
        default: spatial = 1; // uniform
    }

    const noise = 1 + (random() - 0.5) * p.gapRandomness * 1.5;
    return Math.max(0, Math.min(1, baseAmt * spatial * noise));
}

/** Color for a layer: back layers are darker (sub mode) or lighter (add mode) */
function layerColor(layer, layerCount, blockColor, shadingMode, renderMode) {
    if (renderMode !== 'color') {
        const base = 140;
        const factor = layerCount <= 1 ? 1 : (shadingMode === 'sub'
            ? 0.35 + (layer / (layerCount-1)) * 0.65
            : 1.0 - (layer / (layerCount-1)) * 0.6);
        return toGray(base * factor);
    }
    const factor = layerCount <= 1 ? 1 : (shadingMode === 'sub'
        ? 0.3 + (layer / (layerCount-1)) * 0.7
        : 1.0 - (layer / (layerCount-1)) * 0.65);
    return shadeColor(blockColor, factor);
}

export function generateMegastructure(p) {
    const seed = p.createNewSeed ? newSeed() : getSeed();
    if (!p.createNewSeed) setSeed(seed);

    const filterAttr = p.renderMode === 'normal' ? ' filter="url(#normalMapFilter)"' : '';
    const bgColor = p.renderMode !== 'color' ? '#000000' : toGray(p.bgBrightness);

    const parts = [
        `<svg class="canvas-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`,
        `<defs><clipPath id="canvasClip"><rect width="${W}" height="${H}"/></clipPath>${NORMAL_MAP_FILTER}</defs>`,
        `<g clip-path="url(#canvasClip)"${filterAttr}>`,
        `<rect width="${W}" height="${H}" fill="${bgColor}"/>`,
    ];

    // Generate block layout once (shared across layers)
    const blocks = computeBlocks(p);

    // Render layers back → front
    for (let layer = 0; layer < p.layerCount; layer++) {
        const layerFactor = p.layerCount <= 1 ? 1 : layer / (p.layerCount - 1);
        const color = layerColor(layer, p.layerCount, p.blockColor, p.layerShading, p.renderMode);

        for (const block of blocks) {
            // Back layer (layer 0) is always fully visible; front layers have gaps
            if (layer > 0) {
                const prob = gapProb(block, layerFactor, p);
                if (random() < prob) continue; // this block is a gap → skip (reveals layer below)
            }
            const chips = generateChips(block, p);
            const pathD = buildPolygon(block.x, block.y, block.w, block.h, chips);
            parts.push(`<path d="${pathD}" fill="${color}"/>`);
        }
    }

    parts.push('</g></svg>');
    return { svg: parts.join(''), seed };
}
