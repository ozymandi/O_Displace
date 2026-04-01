import { parseASE } from './palette.js';
import { getSeed } from './prng.js';
import { generatePattern } from './engine.js';
import { exportSVG, exportPNG } from './export.js';

// --- Logging ---
export function log(msg) {
    const el = document.getElementById('consoleLog');
    const t = new Date().toISOString().split('T')[1].slice(0, 8);
    el.value += `[${t}] ${msg}\n`;
    el.scrollTop = el.scrollHeight;
}

// --- Read helpers ---
function val(id) { return parseFloat(document.getElementById(id).value); }
function checked(id) { return document.getElementById(id).checked; }

// --- Collect all params from DOM ---
export function collectParams(createNewSeed = false) {
    // Custom palette colors
    const customColors = [];
    for (let i = 0; i < 5; i++) {
        if (checked(`en${i}`)) customColors.push(document.getElementById(`c${i}`).value);
    }

    return {
        createNewSeed,
        iterations: Math.max(1, parseInt(val('globalIter'))),
        palette: document.getElementById('paletteSelect').value,
        renderMode: document.getElementById('renderMode').value,
        bgBrightness: val('bgBrightness'),
        customColors,
        matrix: {
            enable: checked('matrixEnable'),
            size: parseInt(val('matrixSize')),
            start: val('matrixStart'),
            end: val('matrixEnd'),
            randomFactor: val('matrixRandom'),
            invert: checked('matrixInvert'),
        },
        solid: { enable: checked('solidEnable'), scale: val('solidScale') },
        alpha: { enable: checked('alphaEnable'), scale: val('alphaScale'), opacity: val('alphaOpacity') },
        grid:  { enable: checked('gridEnable'),  scale: val('gridScale'), spacing: val('gridSpacing'), amount: val('gridAmount') },
        vbar:  { enable: checked('vBarEnable'),  scale: val('vBarScale'), spacing: val('vBarSpacing'), amount: val('vBarAmount') },
        hbar:  { enable: checked('hBarEnable'),  scale: val('hBarScale'), spacing: val('hBarSpacing'), amount: val('hBarAmount') },
        wire: {
            enable: checked('wireEnable'),
            lineWidth: val('wireWidth'),
            crossProb: val('crossProb'),
            nodeAmount: parseInt(val('nodeAmount')),
            nodeSpacing: parseInt(val('nodeSpacing')),
            randomCenter: val('wireCenter'),
        },
    };
}

// --- Render ---
export function render(createNewSeed = false) {
    const params = collectParams(createNewSeed);
    const { svg, seed } = generatePattern(params);
    document.getElementById('svgContainer').innerHTML = svg;
    document.getElementById('seedDisplay').value = seed;
    if (createNewSeed) log(`Generated new seed: ${seed} [${params.renderMode.toUpperCase()}]`);
}

export function handleInput() {
    if (checked('livePreview')) render(false);
}

// --- Palette modal ---
export function openPaletteModal() {
    document.getElementById('paletteModal').style.display = 'flex';
}
export function closePaletteModal() {
    document.getElementById('paletteModal').style.display = 'none';
    handleInput();
}

export function handlePaletteChange() {
    const isCustom = document.getElementById('paletteSelect').value === 'custom';
    document.getElementById('editCustomBtn').style.display = isCustom ? 'flex' : 'none';
    if (isCustom) openPaletteModal();
    handleInput();
}

// --- Color picker ↔ hex text sync ---
export function bindColorSlots() {
    for (let i = 0; i < 5; i++) {
        const picker = document.getElementById(`c${i}`);
        const hexInput = document.getElementById(`h${i}`);

        picker.addEventListener('input', e => {
            hexInput.value = e.target.value.toUpperCase();
            handleInput();
        });

        hexInput.addEventListener('input', e => {
            let v = e.target.value.trim();
            if (!v.startsWith('#')) v = '#' + v;
            if (/^#[0-9A-F]{6}$/i.test(v)) {
                picker.value = v; handleInput();
            } else if (/^#[0-9A-F]{3}$/i.test(v)) {
                const full = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
                picker.value = full; handleInput();
            }
        });
    }
}

// --- Smart hex/CSS paste ---
export function bindHexPaste() {
    document.getElementById('hexPaste').addEventListener('input', e => {
        const text = e.target.value;
        const hexMatches = text.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || [];
        const rgbMatches = text.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g) || [];
        const fromRgb = rgbMatches.map(str => {
            const parts = str.match(/\d+/g);
            const r = Math.min(255, parseInt(parts[0]));
            const g = Math.min(255, parseInt(parts[1]));
            const b = Math.min(255, parseInt(parts[2]));
            return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        });
        const all = [...hexMatches, ...fromRgb].map(h => {
            if (h.length === 4) return '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
            return h.toUpperCase();
        });
        if (all.length > 0) {
            const limit = Math.min(all.length, 5);
            for (let i = 0; i < limit; i++) {
                document.getElementById(`c${i}`).value = all[i];
                document.getElementById(`h${i}`).value = all[i];
                document.getElementById(`en${i}`).checked = true;
            }
            log(`Smart Paste: ${limit} colors parsed.`);
        }
    });
}

// --- ASE file import ---
export function bindASEImport() {
    document.getElementById('aseFile').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const colors = parseASE(event.target.result);
                if (colors.length === 0) { log('ASE Parser: No colors found.'); return; }
                const limit = Math.min(colors.length, 5);
                for (let i = 0; i < 5; i++) {
                    if (i < limit) {
                        document.getElementById(`c${i}`).value = colors[i];
                        document.getElementById(`h${i}`).value = colors[i];
                        document.getElementById(`en${i}`).checked = true;
                    } else {
                        document.getElementById(`en${i}`).checked = false;
                    }
                }
                log(`ASE Parser: ${limit} colors loaded.`);
            } catch (err) {
                log(`ASE parse error: ${err.message}`);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

// --- Reset to defaults ---
const DEFAULTS = {
    globalIter: 1500, bgBrightness: 30,
    renderMode: 'color', paletteSelect: 'grayscale',
    livePreview: true,
    matrixEnable: true,  matrixSize: 4, matrixStart: -50, matrixEnd: 50, matrixRandom: 15, matrixInvert: false,
    solidEnable: true,   solidScale: 80,
    alphaEnable: true,   alphaScale: 100, alphaOpacity: 50,
    gridEnable: true,    gridScale: 40, gridSpacing: 20, gridAmount: 5,
    vBarEnable: true,    vBarScale: 60, vBarSpacing: 30, vBarAmount: 6,
    hBarEnable: true,    hBarScale: 60, hBarSpacing: 30, hBarAmount: 6,
    wireEnable: true,    wireWidth: 4, crossProb: 30, nodeAmount: 3, nodeSpacing: 10, wireCenter: 30,
};

export function resetDefaults() {
    for (const [id, value] of Object.entries(DEFAULTS)) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.type === 'checkbox') el.checked = value;
        else el.value = value;
    }
    handlePaletteChange();
    handleInput();
    log('Settings reset to defaults.');
}

// --- Export buttons ---
export function bindExport() {
    document.getElementById('btnExportSVG').addEventListener('click', () => {
        const ok = exportSVG(getSeed());
        if (ok) log(`SVG saved: odisplace_${getSeed()}.svg`);
        else log('Export failed: no SVG rendered.');
    });

    document.getElementById('btnExportPNG').addEventListener('click', async () => {
        const scale = parseInt(document.getElementById('pngScale').value) || 1;
        log(`Rendering PNG @ ${scale}x (${1024 * scale}px)…`);
        const ok = await exportPNG(getSeed(), scale);
        if (ok) log(`PNG saved: odisplace_${getSeed()}@${scale}x.png`);
        else log('PNG export failed.');
    });
}
