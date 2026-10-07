(function () {
  const { state, grid, zoom, palette, tools, history, fileio, imageImport, constants } = App;
  const { WHITE, MAX_DIM } = constants;

  const els = {
    sidebarToggleBtn: document.getElementById('sidebar-toggle'),
    sidebar: document.getElementById('sidebar'),
    titleInput: document.getElementById('title-input'),
    widthInput: document.getElementById('width-input'),
    widthValue: document.getElementById('width-value'),
    heightInput: document.getElementById('height-input'),
    heightValue: document.getElementById('height-value'),
    sizeHint: document.getElementById('size-hint'),
    importImageBtn: document.getElementById('import-image-btn'),
    importImageInput: document.getElementById('import-image-input'),
    importMaxSizeInput: document.getElementById('import-max-size-input'),
    importMaxSizeValue: document.getElementById('import-max-size-value'),
    imageError: document.getElementById('image-error'),
    zoomSlider: document.getElementById('zoom-slider'),
    zoomValue: document.getElementById('zoom-value'),
    zoomModeToolbar: document.getElementById('zoom-mode-toolbar'),
    canvasArea: document.getElementById('canvas-area'),
    toolToolbar: document.getElementById('tool-toolbar'),
    clearBtn: document.getElementById('clear-btn'),
    brushSlider: document.getElementById('brush-slider'),
    brushValue: document.getElementById('brush-value'),
    colorPicker: document.getElementById('color-picker'),
    swatches: document.getElementById('swatches'),
    usedSwatches: document.getElementById('used-swatches'),
    undoBtn: document.getElementById('undo-btn'),
    redoBtn: document.getElementById('redo-btn'),
    saveJsonBtn: document.getElementById('save-json-btn'),
    loadJsonBtn: document.getElementById('load-json-btn'),
    loadJsonInput: document.getElementById('load-json-input'),
    fileError: document.getElementById('file-error'),
    scaleInput: document.getElementById('scale-input'),
    exportPngBtn: document.getElementById('export-png-btn'),
    grid: document.getElementById('grid'),
    fullscreenBtn: document.getElementById('fullscreen-toggle'),
  };

  function init() {
    grid.setOnResize(() => {
      els.widthInput.value = state.width;
      els.heightInput.value = state.height;
      syncSizeLabels();
      zoom.recomputeFit(els.canvasArea);
      syncZoomUI();
    });
    grid.init(els.grid);
    palette.init(els.swatches, els.colorPicker, els.usedSwatches);
    history.init((canUndo, canRedo) => {
      els.undoBtn.disabled = !canUndo;
      els.redoBtn.disabled = !canRedo;
      palette.refreshUsedColors();
    });

    const startCollapsed = window.matchMedia('(max-width: 700px)').matches;
    els.sidebar.classList.add('no-transition');
    setSidebarCollapsed(startCollapsed);
    void els.sidebar.offsetWidth;
    els.sidebar.classList.remove('no-transition');

    els.sidebarToggleBtn.addEventListener('click', () => {
      setSidebarCollapsed(!els.sidebar.classList.contains('collapsed'));
    });

    els.sidebar.addEventListener('transitionend', (e) => {
      if (e.propertyName !== 'width') return;
      if (zoom.recomputeFit(els.canvasArea)) syncZoomUI();
    });

    if (document.documentElement.requestFullscreen) {
      els.fullscreenBtn.addEventListener('click', () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      });

      document.addEventListener('fullscreenchange', () => {
        const isFullscreen = !!document.fullscreenElement;
        els.fullscreenBtn.textContent = isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
        els.fullscreenBtn.setAttribute('aria-pressed', String(isFullscreen));
      });
    } else {
      els.fullscreenBtn.style.display = 'none';
    }

    els.titleInput.addEventListener('input', () => {
      state.title = els.titleInput.value;
    });

    els.widthInput.addEventListener('input', handleSizeSliderInput);
    els.heightInput.addEventListener('input', handleSizeSliderInput);
    // 'change' covers the normal release-after-drag and each discrete keyboard step; 'pointerup'
    // is a redundant (idempotent) safety net for the edge case where a drag ends back at its
    // starting value, which some browsers don't fire 'change' for.
    els.widthInput.addEventListener('change', commitSizeDrag);
    els.heightInput.addEventListener('change', commitSizeDrag);
    els.widthInput.addEventListener('pointerup', commitSizeDrag);
    els.heightInput.addEventListener('pointerup', commitSizeDrag);

    els.importMaxSizeInput.addEventListener('input', () => {
      els.importMaxSizeValue.textContent = els.importMaxSizeInput.value;
    });

    els.importImageBtn.addEventListener('click', () => els.importImageInput.click());
    els.importImageInput.addEventListener('change', () => {
      const file = els.importImageInput.files[0];
      els.importImageInput.value = '';
      if (!file) return;
      const maxSize = Number(els.importMaxSizeInput.value);
      imageImport.importImageFile(file, maxSize, handleImageImportResult);
    });

    els.zoomSlider.addEventListener('input', () => {
      zoom.setZoom(Number(els.zoomSlider.value), 'manual');
      syncZoomUI();
    });

    els.zoomModeToolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.zoom-mode-btn');
      if (!btn) return;
      switch (btn.dataset.mode) {
        case 'manual': zoom.setZoom(state.cellSize, 'manual'); break;
        case 'fit-width': zoom.fitWidth(els.canvasArea); break;
        case 'fit-height': zoom.fitHeight(els.canvasArea); break;
        case 'contain': zoom.fitContain(els.canvasArea); break;
      }
      syncZoomUI();
    });

    window.addEventListener('resize', () => {
      if (zoom.recomputeFit(els.canvasArea)) syncZoomUI();
    });

    let lastPaintTool = 'paint';

    els.toolToolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.tool-btn');
      if (!btn) return;
      setCurrentTool(btn.dataset.tool);
    });

    function setCurrentTool(toolName) {
      state.currentTool = toolName;
      if (toolName === 'paint' || toolName === 'fill' || toolName === 'line') lastPaintTool = toolName;
      els.toolToolbar.querySelectorAll('.tool-btn').forEach((b) => {
        const active = b.dataset.tool === toolName;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      els.grid.classList.toggle('crosshair-cursor', toolName === 'picker' || toolName === 'line');
    }

    els.clearBtn.addEventListener('click', () => tools.handleClearAll());

    els.brushSlider.addEventListener('input', () => {
      state.brushSize = Number(els.brushSlider.value);
      els.brushValue.textContent = els.brushSlider.value;
    });

    let activeDrag = null; // null | 'stroke' | 'line'

    els.grid.addEventListener('pointerdown', (e) => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      e.preventDefault();
      const index = Number(cell.dataset.index);

      if (e.button === 2) {
        tools.beginStroke(index, 'erase');
        activeDrag = 'stroke';
        return;
      }
      if (e.button !== 0) return;

      if (state.currentTool === 'fill') {
        tools.handleFill(index);
        return;
      }
      if (state.currentTool === 'picker') {
        tools.pickColor(index);
        setCurrentTool(lastPaintTool);
        return;
      }
      if (state.currentTool === 'line') {
        tools.beginLine(index);
        activeDrag = 'line';
        return;
      }
      tools.beginStroke(index, 'paint');
      activeDrag = 'stroke';
    });

    document.addEventListener('pointermove', (e) => {
      if (!activeDrag) return;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const cell = target && target.closest && target.closest('.cell');
      if (!cell) return;
      const index = Number(cell.dataset.index);
      if (activeDrag === 'line') tools.continueLine(index);
      else tools.continueStroke(index);
    });

    const endActiveDrag = () => {
      if (activeDrag === 'line') tools.endLine();
      else if (activeDrag === 'stroke') tools.endStroke();
      activeDrag = null;
    };
    document.addEventListener('pointerup', endActiveDrag);
    document.addEventListener('pointercancel', endActiveDrag);

    els.grid.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    els.undoBtn.addEventListener('click', () => history.undo());
    els.redoBtn.addEventListener('click', () => history.redo());

    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        history.redo();
      }
    });

    els.saveJsonBtn.addEventListener('click', () => fileio.saveJSON());

    els.loadJsonBtn.addEventListener('click', () => els.loadJsonInput.click());
    els.loadJsonInput.addEventListener('change', () => {
      const file = els.loadJsonInput.files[0];
      els.loadJsonInput.value = '';
      if (!file) return;
      fileio.loadJSONFile(file, handleLoadResult);
    });

    els.exportPngBtn.addEventListener('click', () => {
      const scale = clampInt(els.scaleInput.value, 1, 32, 10);
      els.scaleInput.value = scale;
      fileio.exportPNG(scale);
    });
  }

  function setSidebarCollapsed(collapsed) {
    els.sidebar.classList.toggle('collapsed', collapsed);
    els.sidebarToggleBtn.setAttribute('aria-expanded', String(!collapsed));
    els.sidebarToggleBtn.textContent = collapsed ? '☰' : '✕';
  }

  function syncZoomUI() {
    els.zoomSlider.value = state.cellSize;
    els.zoomValue.textContent = state.cellSize + 'px';
    els.zoomModeToolbar.querySelectorAll('.zoom-mode-btn').forEach((btn) => {
      const active = btn.dataset.mode === state.zoomMode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function clampInt(value, min, max, fallback) {
    let n = Math.round(Number(value));
    if (!Number.isFinite(n)) n = fallback;
    return Math.min(max, Math.max(min, n));
  }

  function syncSizeLabels() {
    els.widthValue.textContent = els.widthInput.value;
    els.heightValue.textContent = els.heightInput.value;
  }

  // Read-only: computes what the grid should show for a candidate size, *without* touching
  // state.hiddenPixels. Safe to call on every 'input' tick of a drag — repeated calls are
  // idempotent since nothing is consumed/mutated along the way. Pixels beyond the gesture's
  // starting bounds are sourced from the persisted hiddenPixels map (read-only lookup); pixels
  // within the starting bounds come straight from the gesture-start snapshot. Also returns how
  // many pixels would end up hidden if this size were committed, for the live hint text.
  function previewResize(prevWidth, prevHeight, prevPixels, newWidth, newHeight) {
    const nextPixels = App.makePixels(newWidth, newHeight);
    const simulatedHidden = new Set(state.hiddenPixels.keys());

    for (let y = 0; y < prevHeight; y++) {
      for (let x = 0; x < prevWidth; x++) {
        if (x < newWidth && y < newHeight) continue;
        if (prevPixels[App.indexOf(x, y, prevWidth)] !== WHITE) simulatedHidden.add(y * MAX_DIM + x);
      }
    }

    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        let color;
        if (x < prevWidth && y < prevHeight) {
          color = prevPixels[App.indexOf(x, y, prevWidth)];
        } else {
          const key = y * MAX_DIM + x;
          color = state.hiddenPixels.get(key) || WHITE;
          simulatedHidden.delete(key);
        }
        if (color !== WHITE) nextPixels[App.indexOf(x, y, newWidth)] = color;
      }
    }

    return { pixels: nextPixels, hiddenCount: simulatedHidden.size };
  }

  // The one real mutation of state.hiddenPixels for a resize — called exactly once, when a
  // drag gesture commits, diffing its start size directly against its final size (the
  // intermediate ticks in between never touched state.hiddenPixels at all).
  function commitResize(prevWidth, prevHeight, prevPixels, newWidth, newHeight) {
    for (let y = 0; y < prevHeight; y++) {
      for (let x = 0; x < prevWidth; x++) {
        if (x < newWidth && y < newHeight) continue;
        const color = prevPixels[App.indexOf(x, y, prevWidth)];
        if (color !== WHITE) state.hiddenPixels.set(y * MAX_DIM + x, color);
      }
    }
    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        if (x < prevWidth && y < prevHeight) continue;
        state.hiddenPixels.delete(y * MAX_DIM + x);
      }
    }
  }

  let sizeDrag = null; // { prevWidth, prevHeight, prevPixels }

  function handleSizeSliderInput() {
    if (!sizeDrag) {
      sizeDrag = {
        prevWidth: state.width,
        prevHeight: state.height,
        prevPixels: state.pixels.slice(),
      };
    }

    const newWidth = Number(els.widthInput.value);
    const newHeight = Number(els.heightInput.value);
    const { pixels: nextPixels, hiddenCount } = previewResize(sizeDrag.prevWidth, sizeDrag.prevHeight, sizeDrag.prevPixels, newWidth, newHeight);
    grid.buildGrid(newWidth, newHeight, nextPixels);

    els.sizeHint.textContent = hiddenCount > 0 ? `${hiddenCount} pixel(s) hidden — grow the canvas to bring them back.` : '';
  }

  function commitSizeDrag() {
    if (!sizeDrag) return;
    const { prevWidth, prevHeight, prevPixels } = sizeDrag;
    sizeDrag = null;
    if (prevWidth === state.width && prevHeight === state.height) return;

    const prevHidden = Array.from(state.hiddenPixels.entries());
    commitResize(prevWidth, prevHeight, prevPixels, state.width, state.height);
    history.pushResize(
      prevWidth, prevHeight, prevPixels,
      state.width, state.height, state.pixels.slice(),
      prevHidden, Array.from(state.hiddenPixels.entries()),
    );
  }

  function handleLoadResult(result) {
    if (result.error) {
      els.fileError.textContent = result.error;
      return;
    }
    els.fileError.textContent = '';

    state.title = result.title;
    els.titleInput.value = result.title;
    state.hiddenPixels = result.hiddenPixels;

    grid.buildGrid(result.width, result.height, result.pixels);
    history.clear();
  }

  function handleImageImportResult(result) {
    if (result.error) {
      els.imageError.textContent = result.error;
      return;
    }
    els.imageError.textContent = '';

    const hasContent = state.pixels.some((c) => c !== WHITE);
    if (hasContent) {
      const ok = confirm('Importing this image will replace the current drawing. Continue?');
      if (!ok) return;
    }

    const prevWidth = state.width;
    const prevHeight = state.height;
    const prevPixels = state.pixels.slice();
    const prevHidden = Array.from(state.hiddenPixels.entries());
    state.hiddenPixels = new Map();

    grid.buildGrid(result.width, result.height, result.pixels);
    history.pushResize(
      prevWidth, prevHeight, prevPixels,
      result.width, result.height, result.pixels.slice(),
      prevHidden, [],
    );
  }

  init();
})();
