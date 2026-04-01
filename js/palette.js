import { random } from './prng.js';

export const PALETTES = {
    cyberpunk: ['#2B0F4C', '#52057B', '#BC00DD', '#FF0055', '#00FFCC', '#FFFFFF'],
    mars:      ['#1A0808', '#3A120E', '#7C2A20', '#B85D33', '#E8A568', '#FCE2C2'],
    ocean:     ['#010B19', '#031C3A', '#05447A', '#0873B9', '#38BDF8', '#BAE6FD'],
};

function grayscaleHex() {
    const val = Math.floor(random() * 255);
    const h = val.toString(16).padStart(2, '0').toUpperCase();
    return `#${h}${h}${h}`;
}

export function getColor(paletteName, customColors = []) {
    if (paletteName === 'grayscale') return grayscaleHex();
    if (paletteName === 'custom') {
        if (customColors.length === 0) return grayscaleHex();
        return customColors[Math.floor(random() * customColors.length)];
    }
    const p = PALETTES[paletteName];
    return p[Math.floor(random() * p.length)];
}

export function adjustBrightness(hex, percent) {
    hex = hex.replace(/^\s*#|\s*$/g, '');
    if (hex.length === 3) hex = hex.replace(/(.)/g, '$1$1');
    let r = parseInt(hex.substr(0, 2), 16);
    let g = parseInt(hex.substr(2, 2), 16);
    let b = parseInt(hex.substr(4, 2), 16);
    const amt = Math.floor((percent / 100) * 255);
    r = Math.max(0, Math.min(255, r + amt));
    g = Math.max(0, Math.min(255, g + amt));
    b = Math.max(0, Math.min(255, b + amt));
    const pad = n => n.toString(16).padStart(2, '0').toUpperCase();
    return `#${pad(r)}${pad(g)}${pad(b)}`;
}

/** Parse Adobe Swatch Exchange (.ase) binary buffer, return hex color array */
export function parseASE(buffer) {
    const view = new DataView(buffer);
    let offset = 4 + 2 + 2; // skip signature + version
    const numBlocks = view.getUint32(offset); offset += 4;
    const colors = [];

    for (let i = 0; i < numBlocks; i++) {
        if (offset >= view.byteLength) break;
        const type = view.getUint16(offset); offset += 2;
        const blockLen = view.getUint32(offset); offset += 4;

        if (type === 1) {
            const blockStart = offset;
            const nameLen = view.getUint16(offset); offset += 2 + nameLen * 2;
            const model = String.fromCharCode(
                view.getUint8(offset), view.getUint8(offset + 1),
                view.getUint8(offset + 2), view.getUint8(offset + 3)
            ); offset += 4;

            let r = 0, g = 0, b = 0, valid = false;
            if (model === 'RGB ') {
                r = view.getFloat32(offset) * 255;
                g = view.getFloat32(offset + 4) * 255;
                b = view.getFloat32(offset + 8) * 255;
                valid = true;
            } else if (model === 'CMYK') {
                const c = view.getFloat32(offset), m = view.getFloat32(offset + 4);
                const y = view.getFloat32(offset + 8), k = view.getFloat32(offset + 12);
                r = 255 * (1 - c) * (1 - k);
                g = 255 * (1 - m) * (1 - k);
                b = 255 * (1 - y) * (1 - k);
                valid = true;
            } else if (model === 'Gray') {
                const gray = view.getFloat32(offset) * 255;
                r = g = b = gray; valid = true;
            }

            if (valid) {
                const clamp = n => Math.max(0, Math.min(255, Math.round(n)));
                r = clamp(r); g = clamp(g); b = clamp(b);
                colors.push('#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase());
            }
            offset = blockStart + blockLen;
        } else {
            offset += blockLen;
        }
    }
    return colors;
}
