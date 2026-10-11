(function () {
  const { state, constants } = App;

  const PRESET_COLORS = [
    '#000000', '#ffffff', '#888888', '#c0c0c0',
    '#7a4b00', '#c47a3d', '#ffcf9e', '#ff0000',
    '#ff8800', '#ffee00', '#00c000', '#00c0c0',
    '#0066ff', '#6a00c0', '#ff00c0', '#ff4da6',
  ];

  const COLLAPSED_ROWS = 3;

  let swatchesEl = null;
  let usedSwatchesEl = null;
  let colorPickerEl = null;
  let usedPaletteEl = null;
  let usedHeadingEl = null;
  let usedToggleEl = null;
  let expanded = false;

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
    if (usedSwatchesEl.contains(btn)) setExpanded(false);
  }

  function init(swatchesContainer, colorPicker, usedSwatchesContainer, usedPaletteContainer, usedHeadingElement, usedToggleButton) {
    swatchesEl = swatchesContainer;
    colorPickerEl = colorPicker;
    usedSwatchesEl = usedSwatchesContainer;
    usedPaletteEl = usedPaletteContainer;
    usedHeadingEl = usedHeadingElement;
    usedToggleEl = usedToggleButton;

    const fragment = document.createDocumentFragment();
    PRESET_COLORS.forEach((hex) => fragment.appendChild(makeSwatchBtn(hex)));
    swatchesEl.appendChild(fragment);

    swatchesEl.addEventListener('click', handleSwatchClick);
    usedSwatchesEl.addEventListener('click', handleSwatchClick);

    colorPickerEl.addEventListener('input', (e) => {
      setCurrentColor(e.target.value);
    });

    usedToggleEl.addEventListener('click', (e) => {
      e.stopPropagation();
      setExpanded(!expanded);
    });

    document.addEventListener('click', (e) => {
      if (!expanded) return;
      if (usedPaletteEl.contains(e.target)) return;
      setExpanded(false);
    });

    colorPickerEl.value = state.currentColor;
    refreshUsedColors();
  }

  function setExpanded(value) {
    expanded = value;
    usedPaletteEl.classList.toggle('expanded', expanded);
    usedToggleEl.textContent = expanded ? 'Collapse' : 'Expand';
    usedToggleEl.setAttribute('aria-expanded', String(expanded));
  }

  function updateCollapsedHeight() {
    const firstSwatch = usedSwatchesEl.querySelector('.swatch');
    if (!firstSwatch) {
      usedPaletteEl.hidden = true;
      usedHeadingEl.hidden = true;
      usedSwatchesEl.style.removeProperty('--used-collapsed-height');
      usedToggleEl.hidden = true;
      setExpanded(false);
      return;
    }

    usedPaletteEl.hidden = false;
    usedHeadingEl.hidden = false;

    const swatchHeight = firstSwatch.getBoundingClientRect().height;
    const gap = parseFloat(getComputedStyle(usedSwatchesEl).rowGap) || 0;
    const collapsedHeight = COLLAPSED_ROWS * swatchHeight + (COLLAPSED_ROWS - 1) * gap;
    usedSwatchesEl.style.setProperty('--used-collapsed-height', `${collapsedHeight}px`);

    const overflows = usedSwatchesEl.scrollHeight > collapsedHeight + 1;
    usedToggleEl.hidden = !overflows;
    if (!overflows) setExpanded(false);
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
    updateCollapsedHeight();
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
