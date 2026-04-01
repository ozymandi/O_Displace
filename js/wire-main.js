import { render, handleInput, handlePaletteChange, openPaletteModal, closePaletteModal,
         bindColorSlots, bindHexPaste, bindASEImport, bindExport, resetDefaults, log } from './wire-ui.js';
import { getSeed } from './prng.js';

// Expose to inline HTML onclick handlers
window.handleInput      = handleInput;
window.handlePaletteChange = handlePaletteChange;
window.openPaletteModal = openPaletteModal;
window.closePaletteModal = closePaletteModal;
window.generateNew      = () => render(true);
window.resetDefaults    = resetDefaults;

// Mode segment buttons
document.querySelectorAll('.seg-group').forEach(group => {
    group.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            group.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            handleInput();
        });
    });
});

// Scale selector
document.querySelectorAll('.scale-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('pngScale').value = btn.dataset.scale;
    });
});

// PNG popup toggle
const pngPopup = document.getElementById('pngPopup');
document.getElementById('btnExportPNG').addEventListener('click', e => {
    e.stopPropagation();
    pngPopup.style.display = pngPopup.style.display === 'none' ? 'block' : 'none';
});
document.addEventListener('click', e => {
    if (!pngPopup.contains(e.target)) pngPopup.style.display = 'none';
});

window.addEventListener('load', () => {
    log("Wire generator initialized.");

    const paletteVal = document.getElementById('paletteSelect').value;
    document.getElementById('editCustomBtn').style.display = paletteVal === 'custom' ? 'flex' : 'none';
    document.getElementById('seedDisplay').value = getSeed();

    bindColorSlots();
    bindHexPaste();
    bindASEImport();
    bindExport();

    render(false);
});
