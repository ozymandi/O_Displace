export function exportSVG(seed) {
    const el = document.getElementById('svgContainer').querySelector('svg');
    if (!el) return false;
    const source = new XMLSerializer().serializeToString(el);
    const blob = new Blob(['<?xml version="1.0" standalone="no"?>\r\n', source], { type: 'image/svg+xml;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `odisplace_${seed}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
}

/**
 * Export the current viewport as PNG via Canvas.
 * @param {number} seed
 * @param {number} scale  1 | 2 | 3 | 4  (multiplier of base 1024px)
 */
export function exportPNG(seed, scale = 1) {
    const el = document.getElementById('svgContainer').querySelector('svg');
    if (!el) return Promise.resolve(false);

    const BASE = 1024;
    const SIZE = BASE * scale;
    const svgSource = new XMLSerializer().serializeToString(el);
    const svgBlob = new Blob([svgSource], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = SIZE;
            canvas.height = SIZE;
            canvas.getContext('2d').drawImage(img, 0, 0, SIZE, SIZE);
            URL.revokeObjectURL(url);
            canvas.toBlob(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `odisplace_${seed}@${scale}x.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                resolve(true);
            }, 'image/png');
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
        img.src = url;
    });
}
