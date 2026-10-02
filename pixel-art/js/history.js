(function () {
  const { state, grid } = App;

  const MAX_HISTORY = 100;
  let undoStack = [];
  let redoStack = [];
  let onChange = null;

  function init(changeCallback) {
    onChange = changeCallback;
    notify();
  }

  function notify() {
    if (onChange) onChange(undoStack.length > 0, redoStack.length > 0);
  }

  function pushPixelChanges(changes) {
    if (!changes || changes.length === 0) return;
    undoStack.push({ type: 'pixels', changes });
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
    notify();
  }

  function pushResize(prevWidth, prevHeight, prevPixels, nextWidth, nextHeight, nextPixels) {
    undoStack.push({
      type: 'resize',
      prevWidth, prevHeight, prevPixels,
      nextWidth, nextHeight, nextPixels,
    });
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
    notify();
  }

  function clear() {
    undoStack = [];
    redoStack = [];
    notify();
  }

  function undo() {
    const entry = undoStack.pop();
    if (!entry) return;
    if (entry.type === 'pixels') {
      entry.changes.forEach((c) => grid.setCell(c.index, c.before));
    } else {
      grid.buildGrid(entry.prevWidth, entry.prevHeight, entry.prevPixels.slice());
    }
    redoStack.push(entry);
    notify();
  }

  function redo() {
    const entry = redoStack.pop();
    if (!entry) return;
    if (entry.type === 'pixels') {
      entry.changes.forEach((c) => grid.setCell(c.index, c.after));
    } else {
      grid.buildGrid(entry.nextWidth, entry.nextHeight, entry.nextPixels.slice());
    }
    undoStack.push(entry);
    notify();
  }

  App.history = { init, pushPixelChanges, pushResize, clear, undo, redo };
})();
