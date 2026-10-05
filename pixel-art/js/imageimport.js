(function () {
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  // Scales the image onto an offscreen canvas sized to fit within maxDim while preserving
  // aspect ratio, letting the browser's own (high-quality) image scaling do the downsampling/
  // averaging work rather than hand-rolling a box filter.
  function rasterize(img, maxDim) {
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    if (!srcW || !srcH) throw new Error('Image has no dimensions.');

    let width, height;
    if (srcW >= srcH) {
      width = maxDim;
      height = Math.max(1, Math.round((maxDim * srcH) / srcW));
    } else {
      height = maxDim;
      width = Math.max(1, Math.round((maxDim * srcW) / srcH));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Fill white first so any transparent areas in the source image composite onto white,
    // matching the canvas's own white-default background instead of leaving stray alpha.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const { data } = ctx.getImageData(0, 0, width, height);
    const pixels = new Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      pixels[i] = rgbToHex(data[o], data[o + 1], data[o + 2]);
    }

    return { width, height, pixels };
  }

  function importImageFile(file, maxDim, callback) {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        callback({ error: null, ...rasterize(img, maxDim) });
      } catch (e) {
        callback({ error: 'Could not process this image.' });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      callback({ error: 'Could not load this image file.' });
    };
    img.src = url;
  }

  App.imageImport = { importImageFile };
})();
