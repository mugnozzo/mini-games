window.App = window.App || {};

(function () {
  const WHITE = '#ffffff';
  const MAX_DIM = 64;
  const MIN_CELL_SIZE = 4;
  const MAX_CELL_SIZE = 64;
  const DEFAULT_CELL_SIZE = 16;

  function makePixels(width, height) {
    return new Array(width * height).fill(WHITE);
  }

  const state = {
    title: 'Untitled',
    width: 16,
    height: 16,
    pixels: makePixels(16, 16),
    currentColor: '#000000',
    currentTool: 'paint',
    brushSize: 1,
    cellSize: DEFAULT_CELL_SIZE,
    zoomMode: 'contain', // 'manual' | 'fit-width' | 'fit-height' | 'contain'
    // Pixels trimmed off by shrinking the canvas, keyed by `y * MAX_DIM + x` so they can be
    // restored if the canvas is grown back out to reveal that coordinate again.
    hiddenPixels: new Map(),
  };

  function indexOf(x, y, width) {
    return y * width + x;
  }

  function coordsOf(index, width) {
    return { x: index % width, y: Math.floor(index / width) };
  }

  App.state = state;
  App.constants = { WHITE, MAX_DIM, MIN_CELL_SIZE, MAX_CELL_SIZE, DEFAULT_CELL_SIZE };
  App.indexOf = indexOf;
  App.coordsOf = coordsOf;
  App.makePixels = makePixels;
})();
