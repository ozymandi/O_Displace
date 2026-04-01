import { parseASE } from './palette.js';
import { getSeed } from './prng.js';
import { generateGridPattern } from './grid-engine.js';
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
export function collectGridParams(createNewSeed = false) {
    const customColors = [];
    for (let i = 0; i < 5; i++) {
        if (checked(`en${i}`)) customColors.push(document.getElementById(`c${i}`).value);
    }

    const customLines = [];
    const lineCount = Math.max(1, parseInt(val('textLineCount')));
    for (let i = 0; i < lineCount; i++) {
        const el = document.getElementById(`customLine${i}`);
        customLines.push(el ? el.value : '');
    }

    return {
        createNewSeed,
        renderMode:           document.getElementById('renderMode').value,
        palette:              document.getElementById('paletteSelect').value,
        customColors,
        bgBrightness:         val('bgBrightness'),

        gridType:             modeVal('gridType'),
        cellsX:               Math.max(1, parseInt(val('cellsX'))),
        cellsY:               Math.max(1, parseInt(val('cellsY'))),
        margin:               Math.max(0, val('margin')),
        visibility:           val('visibility'),

        fillMode:             modeVal('fillMode'),
        fillColor:            document.getElementById('fillColor').value,

        borderMode:           modeVal('borderMode'),
        borderColor:          document.getElementById('borderColor').value,
        borderWidth:          Math.max(0.5, val('borderWidth')),
        borderWidthRandom:    val('borderWidthRandom'),

        cornerTL:             modeVal('cornerTL'),
        cornerTR:             modeVal('cornerTR'),
        cornerBR:             modeVal('cornerBR'),
        cornerBL:             modeVal('cornerBL'),
        cornerRadius:         val('cornerRadius'),
        cornerRadiusRandom:   val('cornerRadiusRandom'),

        cornerFigEnable:      checked('cornerFigEnable'),
        cornerFigType:        modeVal('cornerFigType'),
        cornerFigMult:        val('cornerFigMult'),
        cornerFigRandom:      val('cornerFigRandom'),

        innerGridEnable:      checked('innerGridEnable'),
        innerGridX:           Math.max(0, parseInt(val('innerGridX'))),
        innerGridY:           Math.max(0, parseInt(val('innerGridY'))),
        innerGridThickMult:   val('innerGridThickMult'),
        innerGridThickRandom: val('innerGridThickRandom'),
        innerGridOpacity:     val('innerGridOpacity'),
        innerGridOpacityRandom: val('innerGridOpacityRandom'),

        textEnable:           checked('textEnable'),
        textVisibility:       val('textVisibility'),
        textLineCount:        lineCount,
        textWordsPerLine:     Math.max(1, parseInt(val('textWordsPerLine'))),
        textMode:             modeVal('textMode'),
        customLines,
        counterPos:           modeVal('counterPos'),
        textAnchor:           modeVal('textAnchor'),
        textMargin:           val('textMargin'),
        textBgEnable:         checked('textBgEnable'),
        textBorderEnable:     checked('textBorderEnable'),
    };
}

// --- Render ---
export function render(createNewSeed = false) {
    const params = collectGridParams(createNewSeed);
    const { svg, seed } = generateGridPattern(params);
    document.getElementById('svgContainer').innerHTML = svg;
    document.getElementById('seedDisplay').value = seed;
    if (createNewSeed) log(`Generated new seed: ${seed} [${params.renderMode.toUpperCase()}]`);
}

export function handleInput() {
    if (checked('livePreview')) render(false);
}

// --- Dynamic custom text lines ---
export function updateCustomLines() {
    const count = Math.max(1, parseInt(val('textLineCount')));
    const container = document.getElementById('customLinesContainer');
    const existing = container.querySelectorAll('input').length;

    // Add missing inputs
    for (let i = existing; i < count; i++) {
        const row = document.createElement('div');
        row.className = 'row';
        row.dataset.lineIdx = i;
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.id = `customLine${i}`;
        inp.placeholder = `Line ${i + 1}`;
        inp.style.flex = '1';
        inp.oninput = handleInput;
        row.appendChild(inp);
        container.appendChild(row);
    }

    // Remove extras
    const rows = container.querySelectorAll('[data-line-idx]');
    rows.forEach(row => {
        if (parseInt(row.dataset.lineIdx) >= count) row.remove();
    });
}

// --- UI visibility ---
export function updateFillVis() {
    const mode = modeVal('fillMode');
    document.getElementById('fillColorRow').style.display = mode === 'palette' ? 'none' : (mode === 'mono' ? 'flex' : 'none');
}

export function updateBorderVis() {
    const mode = modeVal('borderMode');
    const show = mode !== 'none';
    document.getElementById('borderColorRow').style.display = (mode === 'mono') ? 'flex' : 'none';
    document.getElementById('borderWidthRow').style.display = show ? 'flex' : 'none';
    document.getElementById('borderWidthRandomRow').style.display = show ? 'flex' : 'none';
}

export function updateCornerVis() {
    const isHex = modeVal('gridType').startsWith('hex');
    const cornerSection = document.getElementById('cornerSection');
    const cornerFigSection = document.getElementById('cornerFigSection');
    const innerGridSection = document.getElementById('innerGridSection');
    cornerSection.style.display = isHex ? 'none' : '';
    cornerFigSection.style.display = isHex ? 'none' : '';
    innerGridSection.style.display = isHex ? 'none' : '';
}

export function updateTextVis() {
    const mode = modeVal('textMode');
    document.getElementById('customLinesContainer').style.display = mode === 'custom' ? '' : 'none';
    document.getElementById('textWordsRow').style.display = mode === 'custom' ? 'none' : 'flex';
}

function updateAll() {
    updateFillVis();
    updateBorderVis();
    updateCornerVis();
    updateTextVis();
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
    cellsX: 8,
    cellsY: 8,
    margin: 4,
    visibility: 100,
    fillColor: '#3A3A3A',
    borderColor: '#888888',
    borderWidth: 2,
    borderWidthRandom: 0,
    cornerRadius: 0,
    cornerRadiusRandom: 0,
    cornerFigEnable: false,
    cornerFigMult: 2,
    cornerFigRandom: 0,
    innerGridEnable: false,
    innerGridX: 1,
    innerGridY: 1,
    innerGridThickMult: 0.5,
    innerGridThickRandom: 0,
    innerGridOpacity: 0.5,
    innerGridOpacityRandom: 0,
    textEnable: false,
    textVisibility: 80,
    textLineCount: 1,
    textWordsPerLine: 1,
    textMargin: 4,
    textBgEnable: false,
    textBorderEnable: false,
};
const MODE_DEFAULTS = {
    gridType:    'grid',
    fillMode:    'mono',
    borderMode:  'mono',
    cornerTL:    'sharp',
    cornerTR:    'sharp',
    cornerBR:    'sharp',
    cornerBL:    'sharp',
    cornerFigType: 'circle',
    textMode:    'random',
    counterPos:  'none',
    textAnchor:  'mc',
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
    updateCustomLines();
    updateAll();
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

export { updateAll };
