export function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

export function createEnhancedCanvas(image, options = {}) {
  const { grayscale = true, contrast = 1.3, brightness = 1.03, scale = 2 } = options;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < data.data.length; i += 4) {
    let r=data.data[i], g=data.data[i+1], b=data.data[i+2];
    if (grayscale) { const v=0.299*r+0.587*g+0.114*b; r=g=b=v; }
    data.data[i] = Math.max(0,Math.min(255,((r-128)*contrast+128)*brightness));
    data.data[i+1] = Math.max(0,Math.min(255,((g-128)*contrast+128)*brightness));
    data.data[i+2] = Math.max(0,Math.min(255,((b-128)*contrast+128)*brightness));
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export function canvasToBlob(canvas, type='image/jpeg', quality=0.92) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}
