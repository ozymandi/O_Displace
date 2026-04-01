import { render, handleInput, handlePaletteChange, openPaletteModal, closePaletteModal,
         bindColorSlots, bindHexPaste, bindASEImport, bindExport, resetDefaults, log } from './ui.js';
import { getSeed } from './prng.js';

// Expose to inline HTML onclick attributes
window.handleInput = handleInput;
window.handlePaletteChange = handlePaletteChange;
window.openPaletteModal = openPaletteModal;
window.closePaletteModal = closePaletteModal;
window.generateNew = () => render(true);
window.resetDefaults = resetDefaults;

// Scale selector
document.querySelectorAll('.scale-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('pngScale').value = btn.dataset.scale;
    });
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
