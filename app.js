const { STORAGE_KEY, getAvailableItems, getEnabledItems, loadConfig, pushHistory, saveConfig } = window.WeekendWheelStorage;
const { buildWheel, calculateSpinRotation, pickSegment } = window.WeekendWheelEngine;

const wheelTitle = document.querySelector("#wheelTitle");
const wheelSummary = document.querySelector("#wheelSummary");
const wheelSvg = document.querySelector("#wheelSvg");
const wheelRotor = document.querySelector("#wheelRotor");
const spinButton = document.querySelector("#spinButton");
const resetRoundButton = document.querySelector("#resetRoundButton");
const statusBanner = document.querySelector("#statusBanner");
const latestResult = document.querySelector("#latestResult");
const resultsList = document.querySelector("#resultsList");
const totalCount = document.querySelector("#totalCount");
const enabledCount = document.querySelector("#enabledCount");
const availableCount = document.querySelector("#availableCount");
const modeButtons = [...document.querySelectorAll(".segment-button[data-mode]")];
const resultModal = document.querySelector("#resultModal");
const resultModalText = document.querySelector("#resultModalText");
const resultModalClose = document.querySelector("#resultModalClose");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const SPIN_ACCELERATION_RATIO = 0.2;

let config = loadConfig();
let currentSegments = [];
let currentRotation = 0;
let spinTimer = null;
let spinFrameId = null;
let isSpinning = false;
let lastAnnouncement = "";
let displayedWheelSignature = "";

function escapeMarkup(value) {
  return String(value)
    .split("&")
    .join("&amp;")
    .split("<")
    .join("&lt;")
    .split(">")
    .join("&gt;")
    .split('"')
    .join("&quot;");
}

function normalizeDegrees(angle) {
  return ((angle % 360) + 360) % 360;
}

function createWheelSignature(items) {
  return items
    .map((item) => [item.id, item.label, item.weight, item.color].join("::"))
    .join("|");
}

function stopWheelMotion() {
  window.clearTimeout(spinTimer);
  if (spinFrameId !== null) {
    window.cancelAnimationFrame(spinFrameId);
    spinFrameId = null;
  }
  if (typeof wheelRotor.getAnimations === "function") {
    wheelRotor.getAnimations().forEach((animation) => animation.cancel());
  }
  wheelRotor.style.transition = "none";
}

function applyWheelRotation(rotation) {
  wheelRotor.style.transform = `rotate(${rotation}deg)`;
}

function setStatus(message, tone = "") {
  statusBanner.textContent = message;
  statusBanner.classList.remove("is-emphasis", "is-success", "is-danger");

  if (tone) {
    statusBanner.classList.add(tone);
  }
}

function setLatestResult() {
  latestResult.textContent = config.resultHistory.length ? config.resultHistory[0] : "还没有抽取结果";
}

function closeResultModal() {
  if (!resultModal || resultModal.hidden) {
    return;
  }

  resultModal.hidden = true;
  document.body.classList.remove("is-modal-open");
}

function openResultModal(label) {
  if (!resultModal || !resultModalText) {
    return;
  }

  resultModalText.textContent = label;
  resultModal.hidden = false;
  document.body.classList.add("is-modal-open");
}

function setModeButtons() {
  for (const button of modeButtons) {
    const isActive = button.dataset.mode === config.drawMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function renderSummary() {
  const enabledItems = getEnabledItems(config);
  const availableItems = getAvailableItems(config);

  wheelSummary.innerHTML = `
    <span class="pill"><span>模式</span><strong>${config.drawMode === "repeat" ? "可重复" : "本轮不重复"}</strong></span>
    <span class="pill"><span>候选</span><strong>${availableItems.length}</strong></span>
  `;

  totalCount.textContent = String(config.items.length);
  enabledCount.textContent = String(enabledItems.length);
  availableCount.textContent = String(availableItems.length);
}

function renderResultsList() {
  const history = config.resultHistory.slice(0, 5);

  if (!history.length) {
    resultsList.innerHTML = `
      <li>
        <span>还没有历史记录</span>
        <span class="result-index">等待第一次旋转</span>
      </li>
    `;
    return;
  }

  resultsList.innerHTML = history
    .map(
      (label, index) => `
        <li>
          <span>${escapeMarkup(label)}</span>
          <span class="result-index">#${index + 1}</span>
        </li>
      `
    )
    .join("");
}

function renderWheel(items, options = {}) {
  const { preserveRotation = false } = options;
  const wheel = buildWheel(items);
  currentSegments = wheel.segments;
  displayedWheelSignature = createWheelSignature(items);
  wheelSvg.innerHTML = wheel.markup;

  if (!preserveRotation) {
    currentRotation = 0;
  }

  stopWheelMotion();
  applyWheelRotation(currentRotation);
}

function ensureWheelMatchesCurrentPool(options = {}) {
  const { preserveRotation = false } = options;
  const availableItems = getAvailableItems(config);
  const nextSignature = createWheelSignature(availableItems);

  if (nextSignature !== displayedWheelSignature) {
    renderWheel(availableItems, { preserveRotation: false });
  } else if (!isSpinning) {
    stopWheelMotion();
    if (!preserveRotation) {
      currentRotation = 0;
    }
    applyWheelRotation(currentRotation);
  }

  return availableItems;
}

function animateSpin(fromRotation, toRotation, duration) {
  stopWheelMotion();
  if (prefersReducedMotion.matches) {
    applyWheelRotation(toRotation);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const totalDistance = toRotation - fromRotation;
    const safeDuration = Math.max(120, duration);
    const accelerationDuration = Math.max(120, safeDuration * SPIN_ACCELERATION_RATIO);
    const decelerationDuration = Math.max(120, safeDuration - accelerationDuration);
    const acceleration = (2 * totalDistance) / (accelerationDuration * safeDuration);
    const peakVelocity = acceleration * accelerationDuration;
    const deceleration = peakVelocity / decelerationDuration;
    const accelerationDistance = 0.5 * acceleration * accelerationDuration * accelerationDuration;
    const startTime = performance.now();

    function step(now) {
      const elapsed = Math.min(now - startTime, safeDuration);
      let travelledDistance = 0;

      if (elapsed <= accelerationDuration) {
        travelledDistance = 0.5 * acceleration * elapsed * elapsed;
      } else {
        const decelerationElapsed = elapsed - accelerationDuration;
        travelledDistance =
          accelerationDistance +
          peakVelocity * decelerationElapsed -
          0.5 * deceleration * decelerationElapsed * decelerationElapsed;
      }

      applyWheelRotation(fromRotation + travelledDistance);

      if (elapsed >= safeDuration) {
        stopWheelMotion();
        applyWheelRotation(toRotation);
        resolve();
        return;
      }

      spinFrameId = window.requestAnimationFrame(step);
    }

    spinFrameId = window.requestAnimationFrame(step);
  });
}

function updateControls() {
  const enabledItems = getEnabledItems(config);
  const availableItems = getAvailableItems(config);
  const emptyPool = availableItems.length === 0;
  const noEnabledItems = enabledItems.length === 0;

  spinButton.disabled = isSpinning || emptyPool;
  resetRoundButton.disabled = isSpinning || config.roundExcludedIds.length === 0;

  if (isSpinning) {
    setStatus("转盘正在旋转，请稍等结果。", "is-emphasis");
    return;
  }

  if (noEnabledItems) {
    setStatus("当前没有启用项目，先去设置页添加或启用计划。", "is-danger");
    return;
  }

  if (lastAnnouncement) {
    const suffix =
      config.drawMode === "no-repeat" && availableItems.length === 0
        ? " 本轮已抽完，点击“重置本轮”可以重新开始。"
        : "";
    setStatus(`${lastAnnouncement}${suffix}`, "is-success");
    return;
  }

  if (config.drawMode === "no-repeat" && availableItems.length === 0) {
    setStatus("本轮已经全部抽完，点击“重置本轮”开启下一轮。", "is-emphasis");
    return;
  }

  if (availableItems.length === 1) {
    setStatus("当前只有 1 个可抽项目，旋转后会直接落在它上面。");
    return;
  }

  if (availableItems.length > 24) {
    setStatus("当前选项较多，转盘已切换为紧凑显示模式；完整文案会在结果弹窗和设置页展示。");
    return;
  }

  setStatus("点击“开始旋转”抽一个周末安排。");
}

function renderAll(options = {}) {
  const { freezeWheel = false, preserveRotation = false } = options;
  wheelTitle.textContent = config.title;
  setModeButtons();
  renderSummary();
  setLatestResult();
  renderResultsList();
  if (!freezeWheel) {
    ensureWheelMatchesCurrentPool({ preserveRotation });
  }
  updateControls();
}

function finishSpin(selectedSegment, finalRotation) {
  isSpinning = false;
  currentRotation = normalizeDegrees(finalRotation);
  stopWheelMotion();
  applyWheelRotation(currentRotation);

  const nextExcludedIds =
    config.drawMode === "no-repeat"
      ? [...new Set([...config.roundExcludedIds, selectedSegment.item.id])]
      : config.roundExcludedIds;

  config = saveConfig({
    ...config,
    roundExcludedIds: nextExcludedIds,
    resultHistory: pushHistory(config, selectedSegment.item.label)
  });

  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(24);
  }

  lastAnnouncement = `抽中了“${selectedSegment.item.label}”。`;
  openResultModal(selectedSegment.item.label);
  renderAll({ freezeWheel: true, preserveRotation: true });
}

async function handleSpin() {
  if (isSpinning) {
    return;
  }

  closeResultModal();
  ensureWheelMatchesCurrentPool({ preserveRotation: true });
  if (!currentSegments.length) {
    return;
  }

  const selectedSegment = pickSegment(currentSegments);
  if (!selectedSegment) {
    return;
  }

  isSpinning = true;
  lastAnnouncement = "";
  updateControls();

  const nextRotation = calculateSpinRotation(currentRotation, selectedSegment);
  const duration = prefersReducedMotion.matches ? 320 : 6600 + Math.round(Math.random() * 900);

  await animateSpin(currentRotation, nextRotation, duration);
  finishSpin(selectedSegment, nextRotation);
}

function handleModeChange(mode) {
  if (mode !== "repeat" && mode !== "no-repeat") {
    return;
  }

  config = saveConfig({
    ...config,
    drawMode: mode
  });
  lastAnnouncement = "";
  currentRotation = 0;
  closeResultModal();
  renderAll();
}

function resetRound() {
  if (!config.roundExcludedIds.length) {
    return;
  }

  config = saveConfig({
    ...config,
    roundExcludedIds: []
  });
  lastAnnouncement = "已清空本轮排除列表，可以重新抽取所有启用项目。";
  currentRotation = 0;
  closeResultModal();
  renderAll();
}

spinButton.addEventListener("click", handleSpin);
resetRoundButton.addEventListener("click", resetRound);
if (resultModalClose) {
  resultModalClose.addEventListener("click", closeResultModal);
}

if (resultModal) {
  resultModal.addEventListener("click", (event) => {
    if (event.target === resultModal) {
      closeResultModal();
    }
  });
}

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    handleModeChange(button.dataset.mode);
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeResultModal();
  }
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) {
    return;
  }

  stopWheelMotion();
  isSpinning = false;
  config = loadConfig();
  lastAnnouncement = "";
  currentRotation = 0;
  closeResultModal();
  renderAll();
});

window.addEventListener("pageshow", () => {
  stopWheelMotion();
  isSpinning = false;
  config = loadConfig();
  currentRotation = 0;
  closeResultModal();
  renderAll();
});

renderAll();
