import { render, handleInput, handlePaletteChange, openPaletteModal, closePaletteModal,
         bindColorSlots, bindHexPaste, bindASEImport, bindExport, resetDefaults, shufflePalette, log } from './ui.js';
import { getSeed } from './prng.js';

// Expose to inline HTML onclick attributes
window.handleInput = handleInput;
window.handlePaletteChange = handlePaletteChange;
window.openPaletteModal = openPaletteModal;
window.closePaletteModal = closePaletteModal;
window.generateNew = () => render(true);
window.resetDefaults    = resetDefaults;
window.shufflePalette   = shufflePalette;

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
    log("O'Displace initialized.");

    // Show/hide custom palette button
    const paletteVal = document.getElementById('paletteSelect').value;
    document.getElementById('editCustomBtn').style.display = paletteVal === 'custom' ? 'flex' : 'none';

    // Display initial seed
    document.getElementById('seedDisplay').value = getSeed();

    // Bind all UI interactions
    bindColorSlots();
    bindHexPaste();
    bindASEImport();
    bindExport();

    // Initial render
    render(false);
});
