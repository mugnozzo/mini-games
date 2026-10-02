(function () {
  const { state } = App;

  let gridEl = null;
  let onResize = null;

  function init(el) {
    gridEl = el;
    setCellSize(state.cellSize);
    buildGrid(state.width, state.height, state.pixels);
  }

  function setOnResize(fn) {
    onResize = fn;
  }

  function buildGrid(width, height, pixels) {
    state.width = width;
    state.height = height;
    state.pixels = pixels;

    gridEl.style.setProperty('--cols', String(width));
    gridEl.innerHTML = '';

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < pixels.length; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = String(i);
      cell.style.backgroundColor = pixels[i];
      fragment.appendChild(cell);
    }
    gridEl.appendChild(fragment);

    if (onResize) onResize();
  }

  function setCell(index, color) {
    state.pixels[index] = color;
    const cell = gridEl.children[index];
    if (cell) cell.style.backgroundColor = color;
  }

  function setCellSize(size) {
    state.cellSize = size;
    gridEl.style.setProperty('--cell-size', size + 'px');
  }

  App.grid = { init, buildGrid, setCell, setCellSize, setOnResize };
})();
