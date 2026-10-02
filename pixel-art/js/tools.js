(function () {
  const { state, grid, constants } = App;
  const { WHITE } = constants;

  function floodFill(startIndex, width, height, pixels, fillColor) {
    const target = pixels[startIndex];
    if (target === fillColor) return [];

    const changes = [];
    const visited = new Set();
    const queue = [startIndex];

    while (queue.length > 0) {
      const i = queue.shift();
      if (visited.has(i) || pixels[i] !== target) continue;
      visited.add(i);
      changes.push({ index: i, before: target, after: fillColor });

      const x = i % width;
      const y = Math.floor(i / width);

      if (x > 0) queue.push(i - 1);
      if (x < width - 1) queue.push(i + 1);
      if (y > 0) queue.push(i - width);
      if (y < height - 1) queue.push(i + width);
    }

    return changes;
  }

  function handleFill(index) {
    const changes = floodFill(index, state.width, state.height, state.pixels, state.currentColor);
    if (changes.length === 0) return;
    changes.forEach((c) => grid.setCell(c.index, c.after));
    App.history.pushPixelChanges(changes);
  }

  // A "stroke" covers both a plain click (1 cell) and a drag (many cells), unified so
  // every press produces exactly one history entry regardless of how many cells it touches.
  let stroke = null; // { mode: 'paint' | 'erase', color, touched: Map<index, {index, before, after}> }

  function beginStroke(index, mode) {
    const before = state.pixels[index];
    const color = mode === 'erase' ? WHITE : (before === state.currentColor ? WHITE : state.currentColor);
    stroke = { mode, color, touched: new Map() };
    if (before !== color) grid.setCell(index, color);
    stroke.touched.set(index, { index, before, after: color });
  }

  function continueStroke(index) {
    if (!stroke || stroke.touched.has(index)) return;

    // Reaching a second cell means this is a real drag, not a click: a paint stroke always
    // applies the current color from here on (no toggle), even if the first cell toggled to white.
    if (stroke.mode === 'paint' && stroke.color !== state.currentColor) {
      stroke.color = state.currentColor;
      stroke.touched.forEach((entry) => {
        if (entry.after !== stroke.color) {
          grid.setCell(entry.index, stroke.color);
          entry.after = stroke.color;
        }
      });
    }

    const before = state.pixels[index];
    if (before === stroke.color) {
      stroke.touched.set(index, { index, before, after: before });
      return;
    }
    grid.setCell(index, stroke.color);
    stroke.touched.set(index, { index, before, after: stroke.color });
  }

  function endStroke() {
    if (!stroke) return;
    const changes = Array.from(stroke.touched.values()).filter((c) => c.before !== c.after);
    stroke = null;
    if (changes.length > 0) App.history.pushPixelChanges(changes);
  }

  App.tools = { floodFill, handleFill, beginStroke, continueStroke, endStroke };
})();
