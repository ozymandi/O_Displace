import { parseASE } from './palette.js';
import { getSeed } from './prng.js';
import { generateWirePattern } from './wire-engine.js';
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
function modeVal(param) {
    const group = document.querySelector(`.seg-group[data-param="${param}"]`);
    return group?.querySelector('.seg-btn.active')?.dataset.value ?? '';
}

// --- Collect params ---
export function collectWireParams(createNewSeed = false) {
    const customColors = [];
    for (let i = 0; i < 5; i++) {
        if (checked(`en${i}`)) customColors.push(document.getElementById(`c${i}`).value);
    }
    return {
        createNewSeed,
        seamless:        checked('seamlessEnable'),
        renderMode:      document.getElementById('renderMode').value,
        palette:         document.getElementById('paletteSelect').value,
        customColors,
        bgBrightness:    val('bgBrightness'),
        layerCount:      Math.max(1, parseInt(val('layerCount'))),
        wiresPerLayer:   Math.max(1, parseInt(val('wiresPerLayer'))),
        maxWireWidth:    Math.max(1, parseInt(val('maxWireWidth'))),
        maxOriginSpread: Math.max(0, parseInt(val('maxOriginSpread'))),
        minStepLength:   Math.max(1, parseInt(val('minStepLength'))),
        maxStepLength:   Math.max(1, parseInt(val('maxStepLength'))),
        colorMode:       modeVal('colorMode'),
        widthMode:       modeVal('widthMode'),
        stepDirections:  modeVal('stepDirections'),
        symmetry:        modeVal('symmetry'),
        radialSteps:     Math.max(2, parseInt(val('radialSteps'))),
        lineCap:         modeVal('lineCap'),
        capStart:        checked('capStart'),
        capEnd:          checked('capEnd'),
        capRandom:       val('capRandom'),
    };
}

// --- Render ---
export function render(createNewSeed = false) {
    const params = collectWireParams(createNewSeed);
    const { svg, seed } = generateWirePattern(params);
    document.getElementById('svgContainer').innerHTML = svg;
    document.getElementById('seedDisplay').value = seed;
    if (createNewSeed) log(`Generated new seed: ${seed} [${params.renderMode.toUpperCase()}]`);
}

export function handleInput() {
    if (checked('livePreview')) render(false);
}

// --- Shuffle palette ---
export function shufflePalette() {
    const slots = [];
    for (let i = 0; i < 5; i++) {
        slots.push({
            color: document.getElementById(`c${i}`).value,
            hex:   document.getElementById(`h${i}`).value,
            on:    document.getElementById(`en${i}`).checked,
        });
    }
    for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    for (let i = 0; i < 5; i++) {
        document.getElementById(`c${i}`).value    = slots[i].color;
        document.getElementById(`h${i}`).value    = slots[i].hex;
        document.getElementById(`en${i}`).checked = slots[i].on;
    }
    handleInput();
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
    bgBrightness: 8,
    renderMode: 'color',
    paletteSelect: 'grayscale',
    livePreview: true,
    seamlessEnable: false,
    layerCount: 12,
    wiresPerLayer: 3,
    maxWireWidth: 32,
    maxOriginSpread: 0,
    minStepLength: 64,
    maxStepLength: 512,
    radialSteps: 6,
};
const MODE_DEFAULTS = {
    colorMode: 'linear',
    widthMode: 'random',
    stepDirections: 'any',
    symmetry: 'none',
    lineCap: 'none',
    capStart: true,
    capEnd: false,
    capRandom: 0,
};

export function resetDefaults() {
    for (const [id, value] of Object.entries(DEFAULTS)) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.type === 'checkbox') el.checked = value;
        else el.value = value;
    }
    for (const [param, value] of Object.entries(MODE_DEFAULTS)) {
        const group = document.querySelector(`.seg-group[data-param="${param}"]`);
        if (!group) continue;
        group.querySelectorAll('.seg-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === value);
        });
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

    document.getElementById('btnPngConfirm').addEventListener('click', async () => {
        const scale = parseInt(document.getElementById('pngScale').value) || 1;
        document.getElementById('pngPopup').style.display = 'none';
        log(`Rendering PNG @ ${scale}x (${1024 * scale}px)…`);
        const ok = await exportPNG(getSeed(), scale);
        if (ok) log(`PNG saved: odisplace_${getSeed()}@${scale}x.png`);
        else log('PNG export failed.');
    });
}
