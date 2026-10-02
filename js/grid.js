(function () {
  const { state } = App;

  let gridEl = null;

  function init(el) {
    gridEl = el;
    buildGrid(state.width, state.height, state.pixels);
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
  }

  function setCell(index, color) {
    state.pixels[index] = color;
    const cell = gridEl.children[index];
    if (cell) cell.style.backgroundColor = color;
  }

  App.grid = { init, buildGrid, setCell };
})();
