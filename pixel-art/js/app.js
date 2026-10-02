(function () {
  const { state, grid, zoom, palette, tools, history, fileio, constants } = App;
  const { WHITE, MAX_DIM } = constants;

  const els = {
    sidebarToggleBtn: document.getElementById('sidebar-toggle'),
    sidebar: document.getElementById('sidebar'),
    titleInput: document.getElementById('title-input'),
    widthInput: document.getElementById('width-input'),
    heightInput: document.getElementById('height-input'),
    applySizeBtn: document.getElementById('apply-size-btn'),
    sizeHint: document.getElementById('size-hint'),
    zoomSlider: document.getElementById('zoom-slider'),
    zoomValue: document.getElementById('zoom-value'),
    fitWidthBtn: document.getElementById('fit-width-btn'),
    fitHeightBtn: document.getElementById('fit-height-btn'),
    canvasArea: document.getElementById('canvas-area'),
    toolToolbar: document.getElementById('tool-toolbar'),
    colorPicker: document.getElementById('color-picker'),
    swatches: document.getElementById('swatches'),
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
      zoom.recomputeFit(els.canvasArea);
      syncZoomUI();
    });
    grid.init(els.grid);
    palette.init(els.swatches, els.colorPicker);
    history.init((canUndo, canRedo) => {
      els.undoBtn.disabled = !canUndo;
      els.redoBtn.disabled = !canRedo;
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

  function applySize() {
    const newWidth = clampInt(els.widthInput.value, 1, MAX_DIM, state.width);
    const newHeight = clampInt(els.heightInput.value, 1, MAX_DIM, state.height);
    els.widthInput.value = newWidth;
    els.heightInput.value = newHeight;

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
    els.widthInput.value = result.width;
    els.heightInput.value = result.height;

    grid.buildGrid(result.width, result.height, result.pixels);
    history.clear();
  }

  init();
})();
