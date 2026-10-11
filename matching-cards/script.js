// =========================================================
// 1. CONSTANTS & ASSETS
// =========================================================
// To add a new card image: drop a new SVG/PNG into images/,
// then add its path to CARD_IMAGES below. The max number of
// pairs playable equals CARD_IMAGES.length.
const CARD_IMAGES = [
  'images/shape-01.svg',
  'images/shape-02.svg',
  'images/shape-03.svg',
  'images/shape-04.svg',
  'images/shape-05.svg',
  'images/shape-06.svg',
  'images/shape-07.svg',
  'images/shape-08.svg',
  'images/shape-09.svg',
  'images/shape-10.svg',
  'images/shape-11.svg',
  'images/shape-12.svg',
];
const MAX_PAIRS = CARD_IMAGES.length;
const CARD_COUNT_OPTIONS = [4, 6, 8, 12, 16, 18, 20, 24].filter(n => n <= MAX_PAIRS * 2);
const MISMATCH_DELAY_MS = 900;
const CARD_GAP = 8;
const MIN_CARD_SIZE = 24; // safety floor only, not a usability target
const MAX_CARD_SIZE = 160;
const BOTTOM_BUFFER = 16;

// =========================================================
// 2. STATE
// =========================================================
let gameState = null;
let timerInterval = null;
let lastConfig = null; // remembered for "Play Again" prefill

// =========================================================
// 3. SETUP SCREEN LOGIC
// =========================================================
const els = {}; // populated on DOMContentLoaded

function populateCardCountSelect() {
  els.cardCountSelect.innerHTML = '';
  CARD_COUNT_OPTIONS.forEach(n => {
    const opt = document.createElement('option');
    opt.value = String(n);
    opt.textContent = `${n} cards (${n / 2} pairs)`;
    els.cardCountSelect.appendChild(opt);
  });
  const mid = CARD_COUNT_OPTIONS[Math.floor(CARD_COUNT_OPTIONS.length / 2)];
  els.cardCountSelect.value = String(mid);
}

function renderPlayerNameInputs(count) {
  els.playerNamesList.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'playerName';
    input.dataset.index = String(i);
    input.placeholder = `Player ${i + 1}`;
    els.playerNamesList.appendChild(input);
  }
}

function factorPairs(total) {
  const pairs = [];
  for (let rows = 1; rows <= total; rows++) {
    if (total % rows === 0) pairs.push([rows, total / rows]);
  }
  return pairs;
}

function computeAutoGrid(total, containerW, containerH) {
  const pairs = factorPairs(total);
  const nonDegenerate = pairs.filter(([r, c]) => r > 1 && c > 1);
  const candidates = nonDegenerate.length > 0 ? nonDegenerate : pairs;

  const aspectContainer = containerW / containerH;
  let best = null;
  let bestScore = -Infinity;

  candidates.forEach(([rows, cols]) => {
    const cellW = containerW / cols;
    const cellH = containerH / rows;
    const cellSize = Math.min(cellW, cellH);
    const aspectGrid = cols / rows;
    const aspectPenalty = Math.abs(Math.log(aspectGrid / aspectContainer));
    const score = cellSize - aspectPenalty * (cellSize * 0.15);
    if (score > bestScore) {
      bestScore = score;
      best = [rows, cols];
    }
  });

  return best || [1, total];
}

// While the game screen is visible, measure its real layout so the grid is
// guaranteed to fit without scrolling. While still on the setup screen the
// game screen is display:none (unmeasurable), so fall back to a heuristic
// for the auto-grid preview only; the real sizing always re-measures live.
function getAvailableBoardArea() {
  if (els.gameScreen.classList.contains('hidden')) {
    const width = document.querySelector('main').clientWidth;
    const height = window.innerHeight * 0.55;
    return { width, height };
  }
  const top = els.gameBoard.getBoundingClientRect().top;
  const width = els.gameBoard.clientWidth || window.innerWidth * 0.9;
  const height = Math.max(window.innerHeight - top - BOTTOM_BUFFER, 150);
  return { width, height };
}

function refreshAutoGridDisplay() {
  const total = Number(els.cardCountSelect.value);
  const { width, height } = getAvailableBoardArea();
  const [rows, cols] = computeAutoGrid(total, width, height);
  els.autoGridDisplay.textContent = `${rows} rows x ${cols} cols`;
}

function onManualInputsChanged() {
  const total = Number(els.cardCountSelect.value);
  const rows = Number(els.manualRows.value);
  const cols = Number(els.manualCols.value);
  const valid = rows > 0 && cols > 0 && rows * cols === total;
  els.manualGridError.textContent = valid || !rows || !cols
    ? ''
    : `Rows x cols must equal ${total}.`;
  els.startGameButton.disabled = els.manualModeRadio.checked && !valid;
}

function onGridModeChanged() {
  const manual = els.manualModeRadio.checked;
  els.autoGridField.classList.toggle('hidden', manual);
  els.manualGridField.classList.toggle('hidden', !manual);
  if (manual) {
    onManualInputsChanged();
  } else {
    els.startGameButton.disabled = false;
    refreshAutoGridDisplay();
  }
}

function onCardCountChanged() {
  if (!els.manualModeRadio.checked) refreshAutoGridDisplay();
  else onManualInputsChanged();
}

function resolveGridChoice() {
  const total = Number(els.cardCountSelect.value);
  if (els.manualModeRadio.checked) {
    return [Number(els.manualRows.value), Number(els.manualCols.value)];
  }
  const { width, height } = getAvailableBoardArea();
  return computeAutoGrid(total, width, height);
}

function onStartGameSubmit(e) {
  e.preventDefault();
  const total = Number(els.cardCountSelect.value);
  const playerCount = Number(els.playerCountInput.value);
  const [rows, cols] = resolveGridChoice();

  if (rows * cols !== total) {
    els.manualGridError.textContent = `Rows x cols must equal ${total}.`;
    return;
  }

  const names = Array.from(els.playerNamesList.querySelectorAll('.playerName'))
    .map((input, i) => input.value.trim() || `Player ${i + 1}`);

  lastConfig = { total, playerCount, rows, cols };
  initGame({ total, rows, cols, playerNames: names });
}

// =========================================================
// 4. BOARD GENERATION
// =========================================================
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildDeck(totalCards) {
  const pairCount = totalCards / 2;
  const chosenImages = shuffle(CARD_IMAGES.slice()).slice(0, pairCount);
  const deck = [];
  chosenImages.forEach((imagePath, imageIndex) => {
    deck.push({ id: `${imageIndex}-a`, imageIndex, imagePath, matched: false, revealed: false });
    deck.push({ id: `${imageIndex}-b`, imageIndex, imagePath, matched: false, revealed: false });
  });
  return shuffle(deck);
}

function initGame({ total, rows, cols, playerNames }) {
  gameState = {
    totalCards: total,
    rows,
    cols,
    deck: buildDeck(total),
    players: playerNames.map(name => ({ name, tries: 0, matches: 0, wrongTries: 0 })),
    currentPlayerIndex: 0,
    flippedCardIds: [],
    lockBoard: false,
    startTime: Date.now(),
    matchesFound: 0,
    gameOver: false,
  };

  els.setupScreen.classList.add('hidden');
  els.endScreen.classList.add('hidden');
  els.gameScreen.classList.remove('hidden');

  // Scoreboard affects the game-bar's height, which the board's available
  // vertical space is measured against, so render it before the board.
  renderScoreboard();
  renderBoard();
  startClock();
}

// =========================================================
// 5. RENDERING
// =========================================================
function renderBoard() {
  els.gameBoard.innerHTML = '';

  gameState.deck.forEach(card => {
    els.gameBoard.appendChild(renderCard(card));
  });

  applyCardSizing();
}

// Sizes cards in px (rather than 1fr/aspect-ratio) so the grid fills the
// actually-available viewport area in BOTH directions, with no page
// scrolling, no matter which rows x cols layout was chosen. Column width
// and row height are computed independently (not forced to a shared
// square size) so leftover horizontal space isn't left unused just
// because height was the tighter constraint, and vice versa.
function applyCardSizing() {
  const { rows, cols } = gameState;
  const { width, height } = getAvailableBoardArea();
  const rawCellW = (width - CARD_GAP * (cols - 1)) / cols;
  const rawCellH = (height - CARD_GAP * (rows - 1)) / rows;
  const cellW = Math.max(MIN_CARD_SIZE, Math.min(MAX_CARD_SIZE, Math.floor(rawCellW)));
  const cellH = Math.max(MIN_CARD_SIZE, Math.min(MAX_CARD_SIZE, Math.floor(rawCellH)));

  els.gameBoard.style.setProperty('--gap', `${CARD_GAP}px`);
  els.gameBoard.style.gridTemplateColumns = `repeat(${cols}, ${cellW}px)`;
  els.gameBoard.style.gridTemplateRows = `repeat(${rows}, ${cellH}px)`;
}

function renderCard(cardData) {
  const cardEl = document.createElement('div');
  cardEl.className = 'card';
  cardEl.dataset.id = cardData.id;
  if (cardData.revealed) cardEl.classList.add('flipped');
  if (cardData.matched) cardEl.classList.add('matched');

  const inner = document.createElement('div');
  inner.className = 'card-inner';

  const back = document.createElement('div');
  back.className = 'card-face card-back';

  const front = document.createElement('div');
  front.className = 'card-face card-front';
  const img = document.createElement('img');
  img.src = cardData.imagePath;
  img.alt = '';
  front.appendChild(img);

  inner.appendChild(back);
  inner.appendChild(front);
  cardEl.appendChild(inner);

  cardEl.addEventListener('click', () => onCardClick(cardData.id));
  return cardEl;
}

function renderScoreboard() {
  els.scoreboard.innerHTML = '';
  gameState.players.forEach((player, i) => {
    const pill = document.createElement('div');
    pill.className = 'score-pill' + (i === gameState.currentPlayerIndex ? ' current' : '');
    pill.textContent = `${player.name}: ${player.matches} matches, ${player.wrongTries} wrong, ${player.tries} tries`;
    els.scoreboard.appendChild(pill);
  });
}

function startClock() {
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 250);
}

function stopClock() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function updateTimerDisplay() {
  els.timerDisplay.textContent = formatElapsed(Date.now() - gameState.startTime);
}

// =========================================================
// 6. INTERACTION / FLIP-MATCH LOGIC
// =========================================================
function findCard(id) {
  return gameState.deck.find(c => c.id === id);
}

function onCardClick(id) {
  if (gameState.gameOver || gameState.lockBoard) return;
  const card = findCard(id);
  if (!card || card.matched || card.revealed) return;
  if (gameState.flippedCardIds.includes(id)) return;

  flipCard(id);

  if (gameState.flippedCardIds.length === 2) {
    resolveTurn();
  }
}

function flipCard(id) {
  const card = findCard(id);
  card.revealed = true;
  gameState.flippedCardIds.push(id);
  updateCardElement(id);
}

function updateCardElement(id) {
  const card = findCard(id);
  const el = els.gameBoard.querySelector(`[data-id="${id}"]`);
  if (!el) return;
  el.classList.toggle('flipped', card.revealed);
  el.classList.toggle('matched', card.matched);
}

function resolveTurn() {
  const [idA, idB] = gameState.flippedCardIds;
  const cardA = findCard(idA);
  const cardB = findCard(idB);
  const player = gameState.players[gameState.currentPlayerIndex];
  player.tries++;

  if (cardA.imageIndex === cardB.imageIndex) {
    handleMatch(cardA, cardB, player);
  } else {
    handleMismatch(cardA, cardB);
  }
}

function handleMatch(cardA, cardB, player) {
  cardA.matched = true;
  cardB.matched = true;
  player.matches++;
  gameState.matchesFound++;
  gameState.flippedCardIds = [];
  updateCardElement(cardA.id);
  updateCardElement(cardB.id);
  renderScoreboard();

  if (!checkGameOver()) {
    // same player continues
  }
}

function handleMismatch(cardA, cardB) {
  const player = gameState.players[gameState.currentPlayerIndex];
  player.wrongTries++;
  gameState.lockBoard = true;
  renderScoreboard();

  setTimeout(() => {
    cardA.revealed = false;
    cardB.revealed = false;
    gameState.flippedCardIds = [];
    gameState.lockBoard = false;
    updateCardElement(cardA.id);
    updateCardElement(cardB.id);
    advanceTurn();
  }, MISMATCH_DELAY_MS);
}

function advanceTurn() {
  gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
  renderScoreboard();
}

// =========================================================
// 7. END GAME / WINNER
// =========================================================
function checkGameOver() {
  if (gameState.matchesFound === gameState.totalCards / 2) {
    gameState.gameOver = true;
    endGame();
    return true;
  }
  return false;
}

function determineWinner(players) {
  const sorted = players.slice().sort((a, b) => {
    if (b.matches !== a.matches) return b.matches - a.matches;
    if (a.wrongTries !== b.wrongTries) return a.wrongTries - b.wrongTries;
    return a.tries - b.tries;
  });
  const top = sorted[0];
  const ties = sorted.filter(p =>
    p.matches === top.matches && p.wrongTries === top.wrongTries && p.tries === top.tries
  );
  return ties.length > 1 ? { tie: true, players: ties } : { tie: false, player: top };
}

function endGame() {
  stopClock();
  const elapsed = formatElapsed(Date.now() - gameState.startTime);

  els.summaryTableBody.innerHTML = '';
  gameState.players.forEach(p => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${p.name}</td><td>${p.matches}</td><td>${p.wrongTries}</td><td>${p.tries}</td>`;
    els.summaryTableBody.appendChild(row);
  });
  els.elapsedTimeSummary.textContent = `Total game time: ${elapsed}`;

  if (gameState.players.length > 1) {
    const result = determineWinner(gameState.players);
    els.endTitle.textContent = result.tie
      ? `It's a tie between ${result.players.map(p => p.name).join(' and ')}!`
      : `🏆 ${result.player.name} wins!`;
  } else {
    els.endTitle.textContent = 'Game complete!';
  }

  els.gameScreen.classList.add('hidden');
  els.endScreen.classList.remove('hidden');
}

function onPlayAgainClick() {
  els.endScreen.classList.add('hidden');
  els.setupScreen.classList.remove('hidden');
  if (lastConfig) {
    els.cardCountSelect.value = String(lastConfig.total);
    els.playerCountInput.value = String(lastConfig.playerCount);
    renderPlayerNameInputs(lastConfig.playerCount);
  }
  refreshAutoGridDisplay();
}

// =========================================================
// 8. INIT / EVENT WIRING
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
  els.setupScreen = document.getElementById('setup-screen');
  els.gameScreen = document.getElementById('game-screen');
  els.endScreen = document.getElementById('end-screen');
  els.setupForm = document.getElementById('setup-form');
  els.cardCountSelect = document.getElementById('cardCountSelect');
  els.playerCountInput = document.getElementById('playerCountInput');
  els.playerNamesList = document.getElementById('playerNamesList');
  els.autoGridField = document.getElementById('autoGridField');
  els.autoGridDisplay = document.getElementById('autoGridDisplay');
  els.refitButton = document.getElementById('refitButton');
  els.manualGridField = document.getElementById('manualGridField');
  els.manualRows = document.getElementById('manualRows');
  els.manualCols = document.getElementById('manualCols');
  els.manualGridError = document.getElementById('manualGridError');
  els.startGameButton = document.getElementById('startGameButton');
  els.autoModeRadio = document.querySelector('input[name="gridMode"][value="auto"]');
  els.manualModeRadio = document.querySelector('input[name="gridMode"][value="manual"]');
  els.gameBoard = document.getElementById('game-board');
  els.scoreboard = document.getElementById('scoreboard');
  els.timerDisplay = document.getElementById('timerDisplay');
  els.endTitle = document.getElementById('endTitle');
  els.summaryTableBody = document.getElementById('summaryTableBody');
  els.elapsedTimeSummary = document.getElementById('elapsedTimeSummary');
  els.playAgainButton = document.getElementById('playAgainButton');

  populateCardCountSelect();
  renderPlayerNameInputs(Number(els.playerCountInput.value));
  refreshAutoGridDisplay();

  els.cardCountSelect.addEventListener('change', onCardCountChanged);
  els.playerCountInput.addEventListener('input', () => {
    const count = Math.max(1, Math.min(6, Number(els.playerCountInput.value) || 1));
    renderPlayerNameInputs(count);
  });
  document.querySelectorAll('input[name="gridMode"]').forEach(radio => {
    radio.addEventListener('change', onGridModeChanged);
  });
  els.refitButton.addEventListener('click', refreshAutoGridDisplay);
  els.manualRows.addEventListener('input', onManualInputsChanged);
  els.manualCols.addEventListener('input', onManualInputsChanged);
  els.setupForm.addEventListener('submit', onStartGameSubmit);
  els.playAgainButton.addEventListener('click', onPlayAgainClick);

  let resizeTimeout = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (!els.gameScreen.classList.contains('hidden') && gameState) {
        applyCardSizing();
      } else if (!els.setupScreen.classList.contains('hidden') && !els.manualModeRadio.checked) {
        refreshAutoGridDisplay();
      }
    }, 150);
  });
});
