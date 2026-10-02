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

  function handlePaint(index) {
    const before = state.pixels[index];
    const after = before === state.currentColor ? WHITE : state.currentColor;
    if (before === after) return;
    grid.setCell(index, after);
    App.history.pushPixelChanges([{ index, before, after }]);
  }

  function handleErase(index) {
    const before = state.pixels[index];
    if (before === WHITE) return;
    grid.setCell(index, WHITE);
    App.history.pushPixelChanges([{ index, before, after: WHITE }]);
  }

  function handleFill(index) {
    const changes = floodFill(index, state.width, state.height, state.pixels, state.currentColor);
    if (changes.length === 0) return;
    changes.forEach((c) => grid.setCell(c.index, c.after));
    App.history.pushPixelChanges(changes);
  }

  App.tools = { floodFill, handlePaint, handleErase, handleFill };
})();
