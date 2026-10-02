(function () {
  const { state } = App;

  const PRESET_COLORS = [
    '#000000', '#ffffff', '#888888', '#c0c0c0',
    '#7a4b00', '#c47a3d', '#ffcf9e', '#ff0000',
    '#ff8800', '#ffee00', '#00c000', '#00c0c0',
    '#0066ff', '#6a00c0', '#ff00c0', '#ff4da6',
  ];

  let swatchesEl = null;
  let colorPickerEl = null;

  function init(swatchesContainer, colorPicker) {
    swatchesEl = swatchesContainer;
    colorPickerEl = colorPicker;

    const fragment = document.createDocumentFragment();
    PRESET_COLORS.forEach((hex) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.style.backgroundColor = hex;
      btn.dataset.color = hex;
      btn.title = hex;
      if (hex === state.currentColor) btn.classList.add('active');
      fragment.appendChild(btn);
    });
    swatchesEl.appendChild(fragment);

    swatchesEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.swatch');
      if (!btn) return;
      setCurrentColor(btn.dataset.color);
    });

    colorPickerEl.addEventListener('input', (e) => {
      setCurrentColor(e.target.value);
    });

    colorPickerEl.value = state.currentColor;
  }

  function setCurrentColor(hex) {
    state.currentColor = hex;
    colorPickerEl.value = hex;
    swatchesEl.querySelectorAll('.swatch').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.color.toLowerCase() === hex.toLowerCase());
    });
  }

  App.palette = { init, setCurrentColor, PRESET_COLORS };
})();
