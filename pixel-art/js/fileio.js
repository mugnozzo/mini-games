(function () {
  const { state, constants } = App;
  const { WHITE } = constants;

  function sanitizeFilename(title) {
    let name = (title || '').trim();
    name = name.replace(/[^A-Za-z0-9 _-]/g, '_');
    name = name.replace(/\s+/g, ' ').trim();
    name = name.slice(0, 100);
    return name || 'untitled';
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function buildSaveObject() {
    const paletteIndex = new Map();
    const palette = [];
    const pixels = [];

    function addPixel(x, y, color) {
      if (color === WHITE) return;
      let c = paletteIndex.get(color);
      if (c === undefined) {
        c = palette.length;
        palette.push(color);
        paletteIndex.set(color, c);
      }
      pixels.push({ x, y, c });
    }

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        addPixel(x, y, state.pixels[App.indexOf(x, y, state.width)]);
      }
    }

    // Pixels trimmed off by a previous shrink are stored out-of-band in state.hiddenPixels —
    // fold them into the same sparse list (as entries with x/y beyond the visible width/height)
    // so the saved file preserves the whole project, not just what's currently visible.
    state.hiddenPixels.forEach((color, key) => {
      addPixel(key % constants.MAX_DIM, Math.floor(key / constants.MAX_DIM), color);
    });

    return {
      version: 1,
      title: state.title,
      width: state.width,
      height: state.height,
      palette,
      pixels,
    };
  }

  function saveJSON() {
    const obj = buildSaveObject();
    const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
    downloadBlob(blob, sanitizeFilename(state.title) + '.json');
  }

  const HEX_RE = /^#[0-9a-fA-F]{6}$/;

  function validateDrawing(obj) {
    if (!obj || typeof obj !== 'object') return 'File is not a valid drawing (not an object).';
    if (!Number.isInteger(obj.width) || obj.width < 1 || obj.width > constants.MAX_DIM) {
      return `Invalid width (must be an integer between 1 and ${constants.MAX_DIM}).`;
    }
    if (!Number.isInteger(obj.height) || obj.height < 1 || obj.height > constants.MAX_DIM) {
      return `Invalid height (must be an integer between 1 and ${constants.MAX_DIM}).`;
    }
    if (!Array.isArray(obj.palette) || !obj.palette.every((c) => typeof c === 'string' && HEX_RE.test(c))) {
      return 'Invalid palette (must be an array of hex colors).';
    }
    if (!Array.isArray(obj.pixels)) return 'Invalid pixels list.';
    for (const p of obj.pixels) {
      if (!p || typeof p !== 'object') return 'Invalid pixel entry.';
      // x/y are bounds-checked against the max canvas size, not width/height — entries beyond
      // the visible area are valid: they're pixels hidden by a previous shrink.
      if (!Number.isInteger(p.x) || p.x < 0 || p.x >= constants.MAX_DIM) return 'Pixel x out of bounds.';
      if (!Number.isInteger(p.y) || p.y < 0 || p.y >= constants.MAX_DIM) return 'Pixel y out of bounds.';
      if (!Number.isInteger(p.c) || p.c < 0 || p.c >= obj.palette.length) return 'Pixel color index out of bounds.';
    }
    return null;
  }

  function loadFromObject(obj) {
    const error = validateDrawing(obj);
    if (error) return { error };

    const width = obj.width;
    const height = obj.height;
    const pixels = App.makePixels(width, height);
    const hiddenPixels = new Map();

    obj.pixels.forEach((p) => {
      const color = obj.palette[p.c];
      if (p.x < width && p.y < height) {
        pixels[App.indexOf(p.x, p.y, width)] = color;
      } else {
        hiddenPixels.set(p.y * constants.MAX_DIM + p.x, color);
      }
    });

    const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title : 'Untitled';

    return { error: null, title, width, height, pixels, hiddenPixels };
  }

  function loadJSONFile(file, onDone) {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        onDone({ error: 'File is not valid JSON.' });
        return;
      }
      onDone(loadFromObject(parsed));
    };
    reader.onerror = () => onDone({ error: 'Could not read the file.' });
    reader.readAsText(file);
  }

  function exportPNG(scale) {
    const canvas = document.createElement('canvas');
    canvas.width = state.width * scale;
    canvas.height = state.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const color = state.pixels[App.indexOf(x, y, state.width)];
        if (color === WHITE) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }

    canvas.toBlob((blob) => {
      downloadBlob(blob, sanitizeFilename(state.title) + '.png');
    }, 'image/png');
  }

  App.fileio = { sanitizeFilename, saveJSON, loadJSONFile, exportPNG };
})();
