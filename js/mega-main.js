import { render, handleInput, bindExport, resetDefaults, log } from './mega-ui.js';
import { getSeed } from './prng.js';

window.handleInput   = handleInput;
window.generateNew   = () => render(true);
window.resetDefaults = resetDefaults;

document.querySelectorAll('.seg-group').forEach(group => {
    group.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            group.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            handleInput();
        });
    });
});

document.querySelectorAll('.scale-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('pngScale').value = btn.dataset.scale;
    });
});

const pngPopup = document.getElementById('pngPopup');
document.getElementById('btnExportPNG').addEventListener('click', e => {
    e.stopPropagation();
    pngPopup.style.display = pngPopup.style.display === 'none' ? 'block' : 'none';
});
document.addEventListener('click', e => {
    if (!pngPopup.contains(e.target)) pngPopup.style.display = 'none';
});

window.addEventListener('load', () => {
    log('Megastructure generator initialized.');
    document.getElementById('seedDisplay').value = getSeed();
    bindExport();
    render(false);
});
