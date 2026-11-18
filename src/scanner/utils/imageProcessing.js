export function loadImage(source) {
  return new Promise((resolve, reject) => {
    if (!source) {
      reject(new Error('No image source available.'));
      return;
    }
    const image = new Image();
    image.onload = () => {
      if (!Number.isFinite(image.naturalWidth) || !Number.isFinite(image.naturalHeight) || image.naturalWidth < 1 || image.naturalHeight < 1) {
        reject(new Error('Captured image has invalid dimensions. Please retake the photo.'));
        return;
      }
      resolve(image);
    };
    image.onerror = () => reject(new Error('Could not load the captured image. Please retake the photo.'));
    image.src = source;
  });
}

function safeDimension(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(32767, Math.max(1, Math.round(n)));
}

export function createEnhancedCanvas(image, options = {}) {
  const { grayscale = true, contrast = 1.3, brightness = 1.03, scale = 2 } = options;
  const sourceWidth = safeDimension(image?.naturalWidth ?? image?.width);
  const sourceHeight = safeDimension(image?.naturalHeight ?? image?.height);
  const width = safeDimension(sourceWidth * Number(scale || 1));
  const height = safeDimension(sourceHeight * Number(scale || 1));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available in this browser.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);

  const data = ctx.getImageData(0, 0, width, height);
  const safeContrast = Number.isFinite(Number(contrast)) ? Number(contrast) : 1.3;
  const safeBrightness = Number.isFinite(Number(brightness)) ? Number(brightness) : 1.03;

  for (let i = 0; i < data.data.length; i += 4) {
    let r = data.data[i];
    let g = data.data[i + 1];
    let b = data.data[i + 2];
    if (grayscale) {
      const v = 0.299 * r + 0.587 * g + 0.114 * b;
      r = g = b = v;
    }
    data.data[i] = Math.max(0, Math.min(255, ((r - 128) * safeContrast + 128) * safeBrightness));
    data.data[i + 1] = Math.max(0, Math.min(255, ((g - 128) * safeContrast + 128) * safeBrightness));
    data.data[i + 2] = Math.max(0, Math.min(255, ((b - 128) * safeContrast + 128) * safeBrightness));
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve, reject) => {
    if (!canvas || !Number.isFinite(canvas.width) || !Number.isFinite(canvas.height) || canvas.width < 1 || canvas.height < 1) {
      reject(new Error('Invalid canvas size. Please retake the photo.'));
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create image data. Please retake the photo.'));
    }, type, quality);
  });
}
