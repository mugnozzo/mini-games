(function () {
  const { state, constants } = App;

  const PRESET_COLORS = [
    '#000000', '#ffffff', '#888888', '#c0c0c0',
    '#7a4b00', '#c47a3d', '#ffcf9e', '#ff0000',
    '#ff8800', '#ffee00', '#00c000', '#00c0c0',
    '#0066ff', '#6a00c0', '#ff00c0', '#ff4da6',
  ];

  let swatchesEl = null;
  let usedSwatchesEl = null;
  let colorPickerEl = null;

  function makeSwatchBtn(hex) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.style.backgroundColor = hex;
    btn.dataset.color = hex;
    btn.title = hex;
    if (hex.toLowerCase() === state.currentColor.toLowerCase()) btn.classList.add('active');
    return btn;
  }

  function handleSwatchClick(e) {
    const btn = e.target.closest('.swatch');
    if (!btn) return;
    setCurrentColor(btn.dataset.color);
  }

  function init(swatchesContainer, colorPicker, usedSwatchesContainer) {
    swatchesEl = swatchesContainer;
    colorPickerEl = colorPicker;
    usedSwatchesEl = usedSwatchesContainer;

    const fragment = document.createDocumentFragment();
    PRESET_COLORS.forEach((hex) => fragment.appendChild(makeSwatchBtn(hex)));
    swatchesEl.appendChild(fragment);

    swatchesEl.addEventListener('click', handleSwatchClick);
    usedSwatchesEl.addEventListener('click', handleSwatchClick);

    colorPickerEl.addEventListener('input', (e) => {
      setCurrentColor(e.target.value);
    });

    colorPickerEl.value = state.currentColor;
    refreshUsedColors();
  }

  function refreshUsedColors() {
    const seen = new Set();
    const colors = [];
    state.pixels.forEach((hex) => {
      if (hex === constants.WHITE) return;
      const key = hex.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      colors.push(hex);
    });

    usedSwatchesEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    colors.forEach((hex) => fragment.appendChild(makeSwatchBtn(hex)));
    usedSwatchesEl.appendChild(fragment);
  }

  function setCurrentColor(hex) {
    state.currentColor = hex;
    colorPickerEl.value = hex;
    const key = hex.toLowerCase();
    [swatchesEl, usedSwatchesEl].forEach((container) => {
      container.querySelectorAll('.swatch').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.color.toLowerCase() === key);
      });
    });
  }

  App.palette = { init, setCurrentColor, refreshUsedColors, PRESET_COLORS };
})();
