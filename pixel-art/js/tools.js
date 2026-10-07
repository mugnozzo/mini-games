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

  // All in-bounds cell indices covered by a round brush of the given size, centered on
  // centerIndex (size 1 = just the cell itself; even sizes bias down-right of center).
  function brushIndices(centerIndex, size, width, height) {
    if (size <= 1) return [centerIndex];
    const cx = centerIndex % width;
    const cy = Math.floor(centerIndex / width);
    const half = Math.floor((size - 1) / 2);
    // For even sizes the true center sits between cells, not on one — measuring distance
    // from that midpoint (rather than the asymmetric bounding box's corner cell) keeps the
    // shape symmetric instead of growing a stray single-cell spike on one side.
    const centerOffset = size % 2 === 0 ? 0.5 : 0;
    const radius = size / 2;
    const indices = [];
    for (let y = cy - half; y < cy - half + size; y++) {
      if (y < 0 || y >= height) continue;
      const dy = y - cy - centerOffset;
      for (let x = cx - half; x < cx - half + size; x++) {
        if (x < 0 || x >= width) continue;
        const dx = x - cx - centerOffset;
        if (dx * dx + dy * dy > radius * radius) continue;
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
    const color = mode === 'erase' ? WHITE : state.currentColor;
    stroke = { mode, color, lastCenter: index, touched: new Map() };
    brushIndices(index, brushSize, state.width, state.height).forEach((i) => applyToStroke(i, color));
  }

  function continueStroke(index) {
    if (!stroke || stroke.lastCenter === index) return;
    stroke.lastCenter = index;
    const brushSize = state.brushSize || 1;
    brushIndices(index, brushSize, state.width, state.height).forEach((i) => applyToStroke(i, stroke.color));
  }

  function endStroke() {
    if (!stroke) return;
    const changes = Array.from(stroke.touched.values()).filter((c) => c.before !== c.after);
    stroke = null;
    if (changes.length > 0) App.history.pushPixelChanges(changes);
  }

  // Bresenham's line algorithm: every integer grid point from (x0,y0) to (x1,y1) inclusive.
  function linePoints(x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    while (true) {
      points.push({ x, y });
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return points;
  }

  // All in-bounds cells covered by stamping the round brush at every point along the line
  // from startIndex to endIndex — the "thick line" shape, consistent with how a dragged
  // freehand stroke already applies the brush along its path.
  function lineIndices(startIndex, endIndex, brushSize, width, height) {
    const start = App.coordsOf(startIndex, width);
    const end = App.coordsOf(endIndex, width);
    const cells = new Set();
    linePoints(start.x, start.y, end.x, end.y).forEach((p) => {
      brushIndices(p.y * width + p.x, brushSize, width, height).forEach((i) => cells.add(i));
    });
    return cells;
  }

  // A "line" drag previews non-destructively: every move recomputes the full line fresh from
  // the gesture's ORIGINAL pre-drag snapshot (never cumulatively), so dragging the endpoint
  // around always shows exactly the current candidate line — cells that fall out of the new
  // line are reverted to their true original color, not left as stale "ghost" paint.
  let lineStroke = null; // { startIndex, prevPixels, lastEnd, touched: Map<index, {index, before, after}> }

  function applyLinePreview(endIndex) {
    const brushSize = state.brushSize || 1;
    const cells = lineIndices(lineStroke.startIndex, endIndex, brushSize, state.width, state.height);

    lineStroke.touched.forEach((entry, idx) => {
      if (!cells.has(idx)) grid.setCell(idx, entry.before);
    });

    const nextTouched = new Map();
    cells.forEach((idx) => {
      const before = lineStroke.prevPixels[idx];
      nextTouched.set(idx, { index: idx, before, after: state.currentColor });
      grid.setCell(idx, state.currentColor);
    });
    lineStroke.touched = nextTouched;
    lineStroke.lastEnd = endIndex;
  }

  function beginLine(index) {
    lineStroke = { startIndex: index, prevPixels: state.pixels.slice(), lastEnd: null, touched: new Map() };
    applyLinePreview(index);
  }

  function continueLine(index) {
    if (!lineStroke || lineStroke.lastEnd === index) return;
    applyLinePreview(index);
  }

  function endLine() {
    if (!lineStroke) return;
    const changes = Array.from(lineStroke.touched.values()).filter((c) => c.before !== c.after);
    lineStroke = null;
    if (changes.length > 0) App.history.pushPixelChanges(changes);
  }

  function pickColor(index) {
    App.palette.setCurrentColor(state.pixels[index]);
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

  App.tools = {
    floodFill, handleFill, brushIndices, beginStroke, continueStroke, endStroke, handleClearAll, pickColor,
    linePoints, lineIndices, beginLine, continueLine, endLine,
  };
})();
