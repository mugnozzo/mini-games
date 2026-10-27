// =========================================================
// 1. CONSTANTS
// =========================================================
// Index matches Date.getUTCDay() (0 = Sunday); buttons are
// laid out in DISPLAY_ORDER, Monday first.
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DEFAULT_FROM = '1900-01-01';
const DEFAULT_TO = '2099-12-31';
const NEXT_DATE_DELAY_MS = 700;
const DAY_MS = 24 * 60 * 60 * 1000;

// =========================================================
// 2. STATE
// =========================================================
let gameState = null;
let nextDateTimeout = null;
let lastReport = null; // built on "End", used by the export button

const els = {}; // populated on DOMContentLoaded

// =========================================================
// 3. DATE HELPERS
// =========================================================
// All dates are handled in UTC so timezones/DST can't shift the weekday.
function parseInputDate(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function randomDateBetween(fromMs, toMs) {
  const days = Math.round((toMs - fromMs) / DAY_MS);
  const offset = Math.floor(Math.random() * (days + 1));
  return new Date(fromMs + offset * DAY_MS);
}

function formatDate(date) {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatClock(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatSeconds(ms) {
  return ms === null ? '–' : (ms / 1000).toFixed(1) + ' s';
}

// =========================================================
// 4. GAME LOGIC
// =========================================================
function startGame() {
  const fromMs = parseInputDate(els.fromDate.value);
  const toMs = parseInputDate(els.toDate.value);
  if (fromMs === null || toMs === null) {
    els.rangeError.textContent = 'Please choose both dates.';
    return;
  }
  if (fromMs > toMs) {
    els.rangeError.textContent = '"From" must be before "To".';
    return;
  }
  els.rangeError.textContent = '';

  gameState = {
    fromMs, toMs,
    fromIso: els.fromDate.value, toIso: els.toDate.value,
    startedAt: new Date(),
    currentDate: null,
    shownAt: 0, shownAtWall: null,
    guesses: 0, right: 0, wrong: 0,
    totalMs: 0, minMs: null, maxMs: null,
    log: [],
  };
  lastReport = null;
  els.exportButton.hidden = true;
  els.logBody.replaceChildren();
  els.logEmpty.hidden = false;
  els.logRange.textContent =
    `Range: ${formatDate(new Date(fromMs))} – ${formatDate(new Date(toMs))}`;

  els.fromDate.disabled = true;
  els.toDate.disabled = true;
  els.startEndButton.textContent = 'End';
  els.startEndButton.classList.replace('start', 'end');
  renderStats();
  nextDate();
}

function endGame() {
  clearTimeout(nextDateTimeout);
  lastReport = buildReport(gameState, new Date());
  gameState = null;
  els.exportButton.hidden = false;

  els.fromDate.disabled = false;
  els.toDate.disabled = false;
  els.startEndButton.textContent = 'Start';
  els.startEndButton.classList.replace('end', 'start');
  els.dateDisplay.textContent = 'Press Start to play again';
  els.dateDisplay.classList.add('idle');
  setFeedback('', '');
  resetButtons(true);
}

function nextDate() {
  gameState.currentDate = randomDateBetween(gameState.fromMs, gameState.toMs);
  els.dateDisplay.textContent = formatDate(gameState.currentDate);
  els.dateDisplay.classList.remove('idle');
  setFeedback('', '');
  resetButtons(false);
  gameState.shownAt = performance.now();
  gameState.shownAtWall = new Date();
}

function handleGuess(dayIndex, button) {
  if (!gameState || button.disabled) return;

  const elapsed = performance.now() - gameState.shownAt;
  const correctIndex = gameState.currentDate.getUTCDay();
  const isRight = dayIndex === correctIndex;

  gameState.guesses++;
  if (isRight) gameState.right++;
  else gameState.wrong++;
  gameState.totalMs += elapsed;
  gameState.minMs = gameState.minMs === null ? elapsed : Math.min(gameState.minMs, elapsed);
  gameState.maxMs = gameState.maxMs === null ? elapsed : Math.max(gameState.maxMs, elapsed);
  renderStats();

  const entry = {
    n: gameState.guesses,
    date: toIsoDate(gameState.currentDate),
    dateText: formatDate(gameState.currentDate),
    range: { from: gameState.fromIso, to: gameState.toIso },
    correctWeekday: WEEKDAYS[correctIndex],
    guessedWeekday: WEEKDAYS[dayIndex],
    right: isRight,
    timeMs: Math.round(elapsed),
    shownAt: gameState.shownAtWall.toISOString(),
    guessedAt: new Date().toISOString(),
  };
  gameState.log.push(entry);
  appendLogRow(entry);

  resetButtons(true);
  button.classList.add(isRight ? 'right' : 'wrong');
  if (isRight) {
    setFeedback('Right!', 'right');
  } else {
    els.weekdayButtons.querySelector(`[data-day="${correctIndex}"]`).classList.add('right');
    setFeedback(`Wrong – it was ${WEEKDAYS[correctIndex]}.`, 'wrong');
  }

  // Wrong answers stay on screen a bit longer so the correct day can be read.
  nextDateTimeout = setTimeout(nextDate, isRight ? NEXT_DATE_DELAY_MS : NEXT_DATE_DELAY_MS * 2);
}

// =========================================================
// 5. REPORT EXPORT
// =========================================================
function buildReport(state, endedAt) {
  const round = ms => (ms === null ? null : Math.round(ms));
  return {
    game: 'weekday',
    startedAt: state.startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt - state.startedAt,
    range: { from: state.fromIso, to: state.toIso },
    summary: {
      guesses: state.guesses,
      right: state.right,
      wrong: state.wrong,
      totalTimeMs: round(state.totalMs),
      meanTimeMs: state.guesses ? round(state.totalMs / state.guesses) : null,
      minTimeMs: round(state.minMs),
      maxTimeMs: round(state.maxMs),
    },
    guesses: state.log,
  };
}

function exportReport() {
  if (!lastReport) return;
  // e.g. 2026-10-27T09:14:03.512Z -> 2026-10-27_09-14-03 (UTC, like the timestamps inside)
  const stamp = lastReport.startedAt.slice(0, 19).replace('T', '_').replaceAll(':', '-');
  const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `weekday-report-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// =========================================================
// 6. RENDERING
// =========================================================
function buildWeekdayButtons() {
  for (const dayIndex of DISPLAY_ORDER) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = WEEKDAYS[dayIndex];
    button.dataset.day = dayIndex;
    button.disabled = true;
    button.addEventListener('click', () => handleGuess(dayIndex, button));
    els.weekdayButtons.appendChild(button);
  }
}

function resetButtons(disabled) {
  for (const button of els.weekdayButtons.children) {
    button.disabled = disabled;
    button.classList.remove('right', 'wrong');
  }
}

function setFeedback(text, kind) {
  els.feedback.textContent = text;
  els.feedback.className = 'feedback ' + kind;
}

function appendLogRow(entry) {
  const row = document.createElement('tr');
  const cells = [
    [entry.n, 'num'],
    [entry.dateText, ''],
    [entry.correctWeekday, ''],
    [entry.guessedWeekday, ''],
    [entry.right ? '✓ Right' : '✗ Wrong', entry.right ? 'right' : 'wrong'],
    [formatSeconds(entry.timeMs), 'num'],
    [formatClock(new Date(entry.guessedAt)), 'num'],
  ];
  for (const [text, className] of cells) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    row.appendChild(cell);
  }
  els.logBody.appendChild(row);
  els.logEmpty.hidden = true;
}

function renderStats() {
  els.statGuesses.textContent = gameState.guesses;
  els.statRight.textContent = gameState.right;
  els.statWrong.textContent = gameState.wrong;
  els.statTotal.textContent = gameState.guesses ? formatSeconds(gameState.totalMs) : '–';
  els.statMean.textContent = gameState.guesses ? formatSeconds(gameState.totalMs / gameState.guesses) : '–';
  els.statMin.textContent = formatSeconds(gameState.minMs);
  els.statMax.textContent = formatSeconds(gameState.maxMs);
}

// =========================================================
// 7. INIT
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
  for (const id of ['fromDate', 'toDate', 'startEndButton', 'rangeError', 'dateDisplay',
    'feedback', 'weekdayButtons', 'statGuesses', 'statRight', 'statWrong',
    'statTotal', 'statMean', 'statMin', 'statMax',
    'exportButton', 'logRange', 'logBody', 'logEmpty']) {
    els[id] = document.getElementById(id);
  }

  els.fromDate.value = DEFAULT_FROM;
  els.toDate.value = DEFAULT_TO;
  els.dateDisplay.classList.add('idle');
  buildWeekdayButtons();

  els.startEndButton.addEventListener('click', () => {
    if (gameState) endGame();
    else startGame();
  });
  els.exportButton.addEventListener('click', exportReport);
});
