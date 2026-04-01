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

function toGray(v) {
    const h = Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0').toUpperCase();
    return `#${h}${h}${h}`;
}

function hexToGray(hex) {
    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);
    return toGray(Math.round(0.299 * r + 0.587 * g + 0.114 * b));
}

function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const WORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function randomWord() {
    const len = 2 + Math.floor(random() * 4);
    let w = '';
    for (let i = 0; i < len; i++) w += WORD_CHARS[Math.floor(random() * WORD_CHARS.length)];
    return w;
}

/** Build SVG path for a rectangular cell with per-corner style. */
function buildRectPath(x, y, w, h, corners, radius) {
    const r = Math.max(0, Math.min(radius, w / 2, h / 2));
    const [tl, tr, br, bl] = corners;
    const x1 = x + w, y1 = y + h;

    function offset(type) { return (type === 'sharp' || r === 0) ? 0 : r; }

    const otl = offset(tl), otr = offset(tr), obr = offset(br), obl = offset(bl);

    let d = `M ${x + otl} ${y}`;

    // top edge → top-right
    d += ` L ${x1 - otr} ${y}`;
    if (otr > 0) {
        if (tr === 'round') d += ` Q ${x1} ${y} ${x1} ${y + otr}`;
        else d += ` L ${x1} ${y + otr}`;
    }

    // right edge → bottom-right
    d += ` L ${x1} ${y1 - obr}`;
    if (obr > 0) {
        if (br === 'round') d += ` Q ${x1} ${y1} ${x1 - obr} ${y1}`;
        else d += ` L ${x1 - obr} ${y1}`;
    }

    // bottom edge → bottom-left
    d += ` L ${x + obl} ${y1}`;
    if (obl > 0) {
        if (bl === 'round') d += ` Q ${x} ${y1} ${x} ${y1 - obl}`;
        else d += ` L ${x} ${y1 - obl}`;
    }

    // left edge → top-left
    d += ` L ${x} ${y + otl}`;
    if (otl > 0) {
        if (tl === 'round') d += ` Q ${x} ${y} ${x + otl} ${y}`;
        else d += ` L ${x + otl} ${y}`;
    }

    return d + ' Z';
}

/** Build SVG polygon path for a hexagon. */
function buildHexPath(cx, cy, w, h, orientation) {
    let pts;
    if (orientation === 'row') {
        // Pointy-top
        const rx = w / 2, ry = h / 2, qy = h / 4;
        pts = [
            [cx,      cy - ry],
            [cx + rx, cy - qy],
            [cx + rx, cy + qy],
            [cx,      cy + ry],
            [cx - rx, cy + qy],
            [cx - rx, cy - qy],
        ];
    } else {
        // Flat-top
        const rx = w / 2, ry = h / 2, qx = w / 4;
        pts = [
            [cx + rx, cy],
            [cx + qx, cy - ry],
            [cx - qx, cy - ry],
            [cx - rx, cy],
            [cx - qx, cy + ry],
            [cx + qx, cy + ry],
        ];
    }
    return 'M ' + pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' L ') + ' Z';
}

/** Compute cell layout array from params. */
function computeCells(p) {
    const cells = [];
    const { gridType, cellsX, cellsY, margin } = p;

    if (gridType === 'grid' || gridType === 'brick-row' || gridType === 'brick-col') {
        // Seamless: cells at col*W/cellsX so tile boundary gap == margin
        // Non-seamless: cells fill canvas fully (last edge touches W)
        const cellW = p.seamless ? W / cellsX - margin : (W - margin * (cellsX - 1)) / cellsX;
        const cellH = p.seamless ? H / cellsY - margin : (H - margin * (cellsY - 1)) / cellsY;
        const stepX = p.seamless ? W / cellsX : cellW + margin;
        const stepY = p.seamless ? H / cellsY : cellH + margin;
        for (let row = 0; row < cellsY; row++) {
            for (let col = 0; col < cellsX; col++) {
                let x = col * stepX;
                let y = row * stepY;
                if (gridType === 'brick-row' && row % 2 === 1) x += cellW / 2;
                if (gridType === 'brick-col' && col % 2 === 1) y += cellH / 2;
                cells.push({ x, y, w: cellW, h: cellH, cx: x + cellW / 2, cy: y + cellH / 2, isHex: false });
            }
        }
    } else if (gridType === 'hex-row') {
        // Pointy-top: stagger by row
        const hexH = cellsY <= 1 ? H : H / ((cellsY - 1) * 0.75 + 1);
        const hexW = W / (cellsX + 0.5);
        for (let row = 0; row < cellsY; row++) {
            for (let col = 0; col < cellsX; col++) {
                const cx = (col + 0.5) * hexW + (row % 2 === 1 ? hexW * 0.5 : 0);
                const cy = row * hexH * 0.75 + hexH / 2;
                cells.push({ cx, cy, w: hexW, h: hexH, x: cx - hexW / 2, y: cy - hexH / 2, isHex: true, hexOri: 'row' });
            }
        }
    } else { // hex-col
        // Flat-top: stagger by column
        const hexW = cellsX <= 1 ? W : W / ((cellsX - 1) * 0.75 + 1);
        const hexH = H / (cellsY + 0.5);
        for (let row = 0; row < cellsY; row++) {
            for (let col = 0; col < cellsX; col++) {
                const cx = col * hexW * 0.75 + hexW / 2;
                const cy = (row + 0.5) * hexH + (col % 2 === 1 ? hexH * 0.5 : 0);
                cells.push({ cx, cy, w: hexW, h: hexH, x: cx - hexW / 2, y: cy - hexH / 2, isHex: true, hexOri: 'col' });
            }
        }
    }

    return cells;
}

function pickColor(mode, monoColor, p) {
    if (mode === 'none') return 'none';
    if (p.renderMode !== 'color') {
        return mode === 'mono' ? hexToGray(monoColor) : toGray(Math.floor(random() * 240) + 15);
    }
    if (mode === 'mono') return monoColor;
    return getColor(p.palette, p.customColors);
}

function vary(base, amplitude) {
    // amplitude 0-2: ±0% to ±100%
    return Math.max(0, base * (1 + (random() - 0.5) * amplitude));
}

/** Render one cell, return SVG string and updated counter. */
function renderCell(cell, p, bgColor, ctr) {
    if (random() * 100 > p.visibility) return { svg: '', ctr };

    const { x, y, w, h, cx, cy, isHex, hexOri } = cell;
    const parts = [];

    // Fill
    const fillColor = pickColor(p.fillMode, p.fillColor, p);

    // Border
    const borderColor = pickColor(p.borderMode, p.borderColor, p);
    const borderWidth = p.borderMode !== 'none'
        ? Math.max(0.5, vary(p.borderWidth, p.borderWidthRandom))
        : 0;

    // Cell shape
    let pathD;
    if (isHex) {
        pathD = buildHexPath(cx, cy, w, h, hexOri);
    } else {
        const r = vary(p.cornerRadius, p.cornerRadiusRandom);
        pathD = buildRectPath(x, y, w, h, [p.cornerTL, p.cornerTR, p.cornerBR, p.cornerBL], r);
    }

    const strokeAttr = borderColor !== 'none' && borderWidth > 0
        ? ` stroke="${borderColor}" stroke-width="${borderWidth.toFixed(2)}"`
        : '';
    parts.push(`<path d="${pathD}" fill="${fillColor}"${strokeAttr}/>`);

    // Corner figures (rect cells only)
    if (!isHex && p.cornerFigEnable) {
        const figR = Math.max(0.5, vary(p.borderWidth * p.cornerFigMult, p.cornerFigRandom));
        const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
        // fallback: border → fill → light gray
        const figFill = borderColor !== 'none' ? borderColor
            : fillColor !== 'none' ? fillColor : toGray(180);
        const bgFill = fillColor !== 'none' ? fillColor : bgColor;
        const sw = Math.max(1, borderWidth);  // full border width for stroked figures
        for (const [fx, fy] of corners) {
            const cx = fx.toFixed(2), cy = fy.toFixed(2);
            const r = figR.toFixed(2);
            switch (p.cornerFigType) {
                case 'circle':
                    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${figFill}"/>`);
                    break;
                case 'square':
                    parts.push(`<rect x="${(fx - figR).toFixed(2)}" y="${(fy - figR).toFixed(2)}" width="${(figR * 2).toFixed(2)}" height="${(figR * 2).toFixed(2)}" fill="${figFill}"/>`);
                    break;
                case 'circle-outline':
                    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bgFill}" stroke="${figFill}" stroke-width="${sw.toFixed(2)}"/>`);
                    break;
                case 'square-outline':
                    parts.push(`<rect x="${(fx - figR).toFixed(2)}" y="${(fy - figR).toFixed(2)}" width="${(figR * 2).toFixed(2)}" height="${(figR * 2).toFixed(2)}" fill="${bgFill}" stroke="${figFill}" stroke-width="${sw.toFixed(2)}"/>`);
                    break;
                case 'cross':
                    parts.push(`<line x1="${(fx - figR * 1.2).toFixed(2)}" y1="${cy}" x2="${(fx + figR * 1.2).toFixed(2)}" y2="${cy}" stroke="${figFill}" stroke-width="${sw.toFixed(2)}" stroke-linecap="square"/>`);
                    parts.push(`<line x1="${cx}" y1="${(fy - figR * 1.2).toFixed(2)}" x2="${cx}" y2="${(fy + figR * 1.2).toFixed(2)}" stroke="${figFill}" stroke-width="${sw.toFixed(2)}" stroke-linecap="square"/>`);
                    break;
                case 'diamond':
                    parts.push(`<polygon points="${cx},${(fy - figR).toFixed(2)} ${(fx + figR).toFixed(2)},${cy} ${cx},${(fy + figR).toFixed(2)} ${(fx - figR).toFixed(2)},${cy}" fill="${figFill}"/>`);
                    break;
            }
        }
    }

    // Inner grid (rect cells only) — clipped to cell shape including rounded/chamfer corners
    if (!isHex && p.innerGridEnable && (p.innerGridX > 0 || p.innerGridY > 0)) {
        const igW = Math.max(0.3, vary(p.borderWidth * p.innerGridThickMult, p.innerGridThickRandom));
        const igOp = Math.min(1, Math.max(0, vary(p.innerGridOpacity, p.innerGridOpacityRandom)));
        const igColor = borderColor !== 'none' ? borderColor : (fillColor !== 'none' ? toGray(128) : toGray(128));
        // Unique clip ID based on cell position (safe for seamless because clipPath coords
        // are interpreted in the coordinate system of the referencing element)
        const clipId = `ig_${Math.round(x * 10)}_${Math.round(y * 10)}`;
        parts.push(`<defs><clipPath id="${clipId}"><path d="${pathD}"/></clipPath></defs>`);
        parts.push(`<g clip-path="url(#${clipId})">`);
        for (let i = 1; i <= p.innerGridX; i++) {
            const lx = (x + w * i / (p.innerGridX + 1)).toFixed(2);
            parts.push(`<line x1="${lx}" y1="${y.toFixed(2)}" x2="${lx}" y2="${(y + h).toFixed(2)}" stroke="${igColor}" stroke-width="${igW.toFixed(2)}" opacity="${igOp.toFixed(3)}"/>`);
        }
        for (let i = 1; i <= p.innerGridY; i++) {
            const ly = (y + h * i / (p.innerGridY + 1)).toFixed(2);
            parts.push(`<line x1="${x.toFixed(2)}" y1="${ly}" x2="${(x + w).toFixed(2)}" y2="${ly}" stroke="${igColor}" stroke-width="${igW.toFixed(2)}" opacity="${igOp.toFixed(3)}"/>`);
        }
        parts.push(`</g>`);
    }

    // Text
    if (p.textEnable && random() * 100 <= p.textVisibility) {
        let lines = [];
        if (p.textMode === 'custom' && p.customLines.length > 0) {
            lines = p.customLines.slice(0, p.textLineCount);
            while (lines.length < p.textLineCount) lines.push('');
        } else {
            for (let i = 0; i < p.textLineCount; i++) {
                const words = [];
                for (let j = 0; j < p.textWordsPerLine; j++) words.push(randomWord());
                lines.push(words.join(' '));
            }
        }

        if (p.counterPos === 'before') lines = [`${ctr}`, ...lines];
        else if (p.counterPos === 'after') lines = [...lines, `${ctr}`];

        const textColor = borderColor !== 'none' ? borderColor
            : fillColor !== 'none' ? (p.renderMode !== 'color' ? toGray(255 - parseInt(hexToGray(fillColor).substr(1, 2), 16)) : bgColor)
            : (p.renderMode !== 'color' ? toGray(200) : '#FFFFFF');

        const margin = p.textMargin;
        const maxFontH = h / (lines.length * 1.35);
        const maxFontW = w / Math.max(1, ...lines.map(l => l.length)) / 0.6;
        const fontSize = Math.max(4, Math.min(maxFontH, maxFontW, w * 0.9)) * (p.textFontSize ?? 1);
        const lineH = fontSize * 1.35;
        const totalH = lines.length * lineH;

        const anchor = p.textAnchor; // 'tl','tc','tr','ml','mc','mr','bl','bc','br'
        const hPart = anchor[1] || 'c';
        const vPart = anchor[0];

        const textX = hPart === 'l' ? x + margin : hPart === 'r' ? x + w - margin : cx;
        const svgAnchor = hPart === 'l' ? 'start' : hPart === 'r' ? 'end' : 'middle';

        let baseY;
        if (vPart === 't') baseY = y + margin + fontSize;
        else if (vPart === 'b') baseY = y + h - margin - totalH + fontSize;
        else baseY = cy - totalH / 2 + fontSize;

        // Background rect
        if (p.textBgEnable && fillColor !== 'none') {
            const estW = Math.max(...lines.map(l => l.length)) * fontSize * 0.6 + margin;
            const estH = totalH + 2;
            const bx = svgAnchor === 'start' ? textX - 2 : svgAnchor === 'end' ? textX - estW + 2 : textX - estW / 2;
            const by = baseY - fontSize - 1;
            parts.push(`<rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${estW.toFixed(2)}" height="${estH.toFixed(2)}" fill="${fillColor}"/>`);
        }

        // Border rect
        if (p.textBorderEnable && borderColor !== 'none') {
            const estW = Math.max(...lines.map(l => l.length)) * fontSize * 0.6 + margin;
            const estH = totalH + 2;
            const bx = svgAnchor === 'start' ? textX - 2 : svgAnchor === 'end' ? textX - estW + 2 : textX - estW / 2;
            const by = baseY - fontSize - 1;
            parts.push(`<rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${estW.toFixed(2)}" height="${estH.toFixed(2)}" fill="none" stroke="${borderColor}" stroke-width="0.5"/>`);
        }

        for (let i = 0; i < lines.length; i++) {
            const ty = (baseY + i * lineH).toFixed(2);
            parts.push(`<text x="${textX.toFixed(2)}" y="${ty}" font-family="'Courier New',monospace" font-size="${fontSize.toFixed(2)}" fill="${textColor}" text-anchor="${svgAnchor}">${escapeXml(lines[i])}</text>`);
        }
    }

    return { svg: parts.join(''), ctr: ctr + 1 };
}

export function generateGridPattern(p) {
    const seed = p.createNewSeed ? newSeed() : getSeed();
    if (!p.createNewSeed) setSeed(seed);

    const filterAttr = p.renderMode === 'normal' ? ' filter="url(#normalMapFilter)"' : '';
    const bgColor = p.renderMode !== 'color' ? '#000000' : toGray(p.bgBrightness);

    const cells = computeCells(p);
    let ctr = 1;

    const parts = [
        `<svg class="canvas-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`,
        `<defs><clipPath id="canvasClip"><rect width="${W}" height="${H}"/></clipPath>${NORMAL_MAP_FILTER}</defs>`,
        `<g clip-path="url(#canvasClip)"${filterAttr}>`,
        `<rect width="${W}" height="${H}" fill="${bgColor}"/>`,
    ];

    const cellParts = [];
    for (const cell of cells) {
        const result = renderCell(cell, p, bgColor, ctr);
        ctr = result.ctr;
        if (result.svg) cellParts.push(result.svg);
    }
    const cellsSvg = cellParts.join('');
    parts.push(p.seamless ? tile(cellsSvg) : cellsSvg);

    parts.push('</g></svg>');
    return { svg: parts.join(''), seed };
}
