(function () {
  const { state, grid, constants } = App;
  const { MIN_CELL_SIZE, MAX_CELL_SIZE } = constants;

  function clampCellSize(px) {
    return Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, Math.round(px)));
  }

  function setZoom(px, mode) {
    const size = clampCellSize(px);
    state.zoomMode = mode || 'manual';
    grid.setCellSize(size);
    return size;
  }

  function availableSize(containerEl) {
    const style = getComputedStyle(containerEl);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    return {
      width: containerEl.clientWidth - padX,
      height: containerEl.clientHeight - padY,
    };
  }

  function fitWidth(containerEl) {
    const avail = availableSize(containerEl);
    return setZoom(Math.floor(avail.width / state.width), 'fit-width');
  }

  function fitHeight(containerEl) {
    const avail = availableSize(containerEl);
    return setZoom(Math.floor(avail.height / state.height), 'fit-height');
  }

  function fitContain(containerEl) {
    const avail = availableSize(containerEl);
    const widthFit = Math.floor(avail.width / state.width);
    const heightFit = Math.floor(avail.height / state.height);
    return setZoom(Math.min(widthFit, heightFit), 'contain');
  }

  function recomputeFit(containerEl) {
    if (state.zoomMode === 'fit-width') return fitWidth(containerEl);
    if (state.zoomMode === 'fit-height') return fitHeight(containerEl);
    if (state.zoomMode === 'contain') return fitContain(containerEl);
    return null;
  }

  App.zoom = { setZoom, fitWidth, fitHeight, fitContain, recomputeFit, clampCellSize };
})();
