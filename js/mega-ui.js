import { parseASE } from './palette.js';
import { getSeed } from './prng.js';
import { generateMegastructure } from './mega-engine.js';
import { exportSVG, exportPNG } from './export.js';

export function log(msg) {
    const el = document.getElementById('consoleLog');
    const t = new Date().toISOString().split('T')[1].slice(0,8);
    el.value += `[${t}] ${msg}\n`;
    el.scrollTop = el.scrollHeight;
}

function val(id) { return parseFloat(document.getElementById(id).value); }
function modeVal(param) {
    const g = document.querySelector(`.seg-group[data-param="${param}"]`);
    return g?.querySelector('.seg-btn.active')?.dataset.value ?? '';
}

export function collectParams(createNewSeed = false) {
    return {
        createNewSeed,
        renderMode:    document.getElementById('renderMode').value,
        bgBrightness:  val('bgBrightness'),
        blockColor:    document.getElementById('blockColor').value,

        // Layout
        ratio:         val('ratio'),
        blockCount:    Math.max(3, Math.min(9, Math.round(val('blockCount')))),
        anchor:        modeVal('anchor'),

        // Block shape
        variation:     val('variation'),
        overhang:      val('overhang'),
        margin:        val('margin'),

        // Detail
        precision:     val('precision'),
        detailDepth:   val('detailDepth'),
        smoothness:    val('smoothness'),

        // Layers
        layerCount:    Math.max(1, Math.min(4, Math.round(val('layerCount')))),
        layerShading:  modeVal('layerShading'),
        gapMode:       modeVal('gapMode'),
        gapAmount:     val('gapAmount'),
        gapRandomness: val('gapRandomness'),
    };
}

export function render(createNewSeed = false) {
    const params = collectParams(createNewSeed);
    const { svg, seed } = generateMegastructure(params);
    document.getElementById('svgContainer').innerHTML = svg;
    document.getElementById('seedDisplay').value = seed;
    if (createNewSeed) log(`Generated new seed: ${seed} [${params.renderMode.toUpperCase()}]`);
}

export function handleInput() { render(false); }

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

export function resetDefaults() {
    const DEFAULTS_VAL = {
        bgBrightness: 18, ratio: 0.8, blockCount: 5,
        variation: 0.35, overhang: 0.25, margin: 12,
        precision: 0.5, detailDepth: 0.5, smoothness: 0.2,
        layerCount: 2, gapAmount: 0.4, gapRandomness: 0.5,
    };
    for (const [id, v] of Object.entries(DEFAULTS_VAL)) {
        const el = document.getElementById(id);
        if (el) el.value = v;
    }
    const DEFAULTS_MODE = {
        anchor: 'both', layerShading: 'sub', gapMode: 'uniform',
    };
    for (const [param, val] of Object.entries(DEFAULTS_MODE)) {
        const group = document.querySelector(`.seg-group[data-param="${param}"]`);
        if (!group) continue;
        group.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === val));
    }
    document.getElementById('blockColor').value = '#7a8a99';
    document.getElementById('renderMode').value = 'color';
    render(false);
    log('Settings reset to defaults.');
}
