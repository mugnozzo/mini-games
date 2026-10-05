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
    applySizeBtn: document.getElementById('apply-size-btn'),
    sizeHint: document.getElementById('size-hint'),
    importImageBtn: document.getElementById('import-image-btn'),
    importImageInput: document.getElementById('import-image-input'),
    imageError: document.getElementById('image-error'),
    zoomSlider: document.getElementById('zoom-slider'),
    zoomValue: document.getElementById('zoom-value'),
    fitWidthBtn: document.getElementById('fit-width-btn'),
    fitHeightBtn: document.getElementById('fit-height-btn'),
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

    els.applySizeBtn.addEventListener('click', applySize);

    els.widthInput.addEventListener('input', () => {
      els.widthValue.textContent = els.widthInput.value;
    });
    els.heightInput.addEventListener('input', () => {
      els.heightValue.textContent = els.heightInput.value;
    });

    els.importImageBtn.addEventListener('click', () => els.importImageInput.click());
    els.importImageInput.addEventListener('change', () => {
      const file = els.importImageInput.files[0];
      els.importImageInput.value = '';
      if (!file) return;
      imageImport.importImageFile(file, MAX_DIM, handleImageImportResult);
    });

    els.zoomSlider.addEventListener('input', () => {
      zoom.setZoom(Number(els.zoomSlider.value), 'manual');
      syncZoomUI();
    });

    els.fitWidthBtn.addEventListener('click', () => {
      zoom.fitWidth(els.canvasArea);
      syncZoomUI();
    });

    els.fitHeightBtn.addEventListener('click', () => {
      zoom.fitHeight(els.canvasArea);
      syncZoomUI();
    });

    window.addEventListener('resize', () => {
      if (zoom.recomputeFit(els.canvasArea)) syncZoomUI();
    });

    els.toolToolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.tool-btn');
      if (!btn) return;
      state.currentTool = btn.dataset.tool;
      els.toolToolbar.querySelectorAll('.tool-btn').forEach((b) => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
    });

    els.clearBtn.addEventListener('click', () => tools.handleClearAll());

    els.brushSlider.addEventListener('input', () => {
      state.brushSize = Number(els.brushSlider.value);
      els.brushValue.textContent = els.brushSlider.value;
    });

    let strokeActive = false;

    els.grid.addEventListener('pointerdown', (e) => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      e.preventDefault();
      const index = Number(cell.dataset.index);

      if (e.button === 2) {
        tools.beginStroke(index, 'erase');
        strokeActive = true;
        return;
      }
      if (e.button !== 0) return;

      if (state.currentTool === 'fill') {
        tools.handleFill(index);
        return;
      }
      tools.beginStroke(index, 'paint');
      strokeActive = true;
    });

    document.addEventListener('pointermove', (e) => {
      if (!strokeActive) return;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const cell = target && target.closest && target.closest('.cell');
      if (!cell) return;
      tools.continueStroke(Number(cell.dataset.index));
    });

    const endActiveStroke = () => {
      if (strokeActive) tools.endStroke();
      strokeActive = false;
    };
    document.addEventListener('pointerup', endActiveStroke);
    document.addEventListener('pointercancel', endActiveStroke);

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

  function applySize() {
    const newWidth = Number(els.widthInput.value);
    const newHeight = Number(els.heightInput.value);

    if (newWidth === state.width && newHeight === state.height) {
      els.sizeHint.textContent = '';
      return;
    }

    const prevWidth = state.width;
    const prevHeight = state.height;
    const prevPixels = state.pixels.slice();

    const nextPixels = App.makePixels(newWidth, newHeight);
    let discarded = 0;
    for (let y = 0; y < prevHeight; y++) {
      for (let x = 0; x < prevWidth; x++) {
        const color = prevPixels[App.indexOf(x, y, prevWidth)];
        if (color === WHITE) continue;
        if (x < newWidth && y < newHeight) {
          nextPixels[App.indexOf(x, y, newWidth)] = color;
        } else {
          discarded++;
        }
      }
    }

    if (discarded > 0) {
      const ok = confirm(`Shrinking will discard ${discarded} painted pixel(s). Continue?`);
      if (!ok) {
        els.widthInput.value = prevWidth;
        els.heightInput.value = prevHeight;
        syncSizeLabels();
        return;
      }
    }

    grid.buildGrid(newWidth, newHeight, nextPixels);
    history.pushResize(prevWidth, prevHeight, prevPixels, newWidth, newHeight, nextPixels.slice());
    els.sizeHint.textContent = discarded > 0 ? `Discarded ${discarded} pixel(s).` : '';
  }

  function handleLoadResult(result) {
    if (result.error) {
      els.fileError.textContent = result.error;
      return;
    }
    els.fileError.textContent = '';

    state.title = result.title;
    els.titleInput.value = result.title;

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

    grid.buildGrid(result.width, result.height, result.pixels);
    history.pushResize(prevWidth, prevHeight, prevPixels, result.width, result.height, result.pixels.slice());
  }

  init();
})();
