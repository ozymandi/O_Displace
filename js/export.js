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
 * This captures SVG filters (e.g. Normal Map feConvolveMatrix) as rendered by the browser.
 */
export function exportPNG(seed) {
    const el = document.getElementById('svgContainer').querySelector('svg');
    if (!el) return Promise.resolve(false);

    const SIZE = 1024;
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
                link.download = `odisplace_${seed}.png`;
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
