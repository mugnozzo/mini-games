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

  // All in-bounds cell indices covered by a square brush of the given size, centered on
  // centerIndex (size 1 = just the cell itself; even sizes bias down-right of center).
  function brushIndices(centerIndex, size, width, height) {
    if (size <= 1) return [centerIndex];
    const cx = centerIndex % width;
    const cy = Math.floor(centerIndex / width);
    const half = Math.floor((size - 1) / 2);
    const indices = [];
    for (let y = cy - half; y < cy - half + size; y++) {
      if (y < 0 || y >= height) continue;
      for (let x = cx - half; x < cx - half + size; x++) {
        if (x < 0 || x >= width) continue;
        indices.push(y * width + x);
      }
    }
    return indices;
  }

  // A "stroke" covers both a plain click (1+ cells via the brush) and a drag (many cells),
  // unified so every press produces exactly one history entry regardless of how many cells
  // or brush points it touches.
  let stroke = null; // { mode: 'paint' | 'erase', color, lastCenter, touched: Map<index, {index, before, after}> }

  function applyToStroke(index, color) {
    if (stroke.touched.has(index)) return;
    const before = state.pixels[index];
    if (before === color) {
      stroke.touched.set(index, { index, before, after: before });
      return;
    }
    grid.setCell(index, color);
    stroke.touched.set(index, { index, before, after: color });
  }

  function beginStroke(index, mode) {
    const brushSize = state.brushSize || 1;
    let color;
    if (mode === 'erase') {
      color = WHITE;
    } else if (brushSize <= 1) {
      // Single-cell brush: preserve the existing click-to-toggle convenience.
      color = state.pixels[index] === state.currentColor ? WHITE : state.currentColor;
    } else {
      // A multi-cell brush has no single sensible toggle target, so it always paints flat.
      color = state.currentColor;
    }
    stroke = { mode, color, lastCenter: index, touched: new Map() };
    brushIndices(index, brushSize, state.width, state.height).forEach((i) => applyToStroke(i, color));
  }

  function continueStroke(index) {
    if (!stroke || stroke.lastCenter === index) return;
    stroke.lastCenter = index;

    // Reaching a second point means this is a real drag, not a click: a paint stroke always
    // applies the current color from here on (no toggle), even if the first point toggled to white.
    if (stroke.mode === 'paint' && stroke.color !== state.currentColor) {
      stroke.color = state.currentColor;
      stroke.touched.forEach((entry) => {
        if (entry.after !== stroke.color) {
          grid.setCell(entry.index, stroke.color);
          entry.after = stroke.color;
        }
      });
    }

    const brushSize = state.brushSize || 1;
    brushIndices(index, brushSize, state.width, state.height).forEach((i) => applyToStroke(i, stroke.color));
  }

  function endStroke() {
    if (!stroke) return;
    const changes = Array.from(stroke.touched.values()).filter((c) => c.before !== c.after);
    stroke = null;
    if (changes.length > 0) App.history.pushPixelChanges(changes);
  }

  function handleClearAll() {
    const changes = [];
    state.pixels.forEach((color, index) => {
      if (color !== WHITE) changes.push({ index, before: color, after: WHITE });
    });
    if (changes.length === 0) return;
    changes.forEach((c) => grid.setCell(c.index, c.after));
    App.history.pushPixelChanges(changes);
  }

  App.tools = { floodFill, handleFill, brushIndices, beginStroke, continueStroke, endStroke, handleClearAll };
})();
