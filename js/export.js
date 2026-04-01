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
