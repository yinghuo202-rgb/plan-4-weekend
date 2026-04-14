const {
  STORAGE_KEY,
  createBlankItem,
  getAvailableItems,
  getEnabledItems,
  loadConfig,
  normalizeConfig,
  resetConfig,
  saveConfig,
  serializeConfig
} = window.WeekendWheelStorage;

const titleInput = document.querySelector("#titleInput");
const settingsSummary = document.querySelector("#settingsSummary");
const itemsList = document.querySelector("#itemsList");
const addItemButton = document.querySelector("#addItemButton");
const restoreDefaultsButton = document.querySelector("#restoreDefaultsButton");
const exportButton = document.querySelector("#exportButton");
const importButton = document.querySelector("#importButton");
const importInput = document.querySelector("#importInput");
const toolsStatus = document.querySelector("#toolsStatus");
const modeButtons = [...document.querySelectorAll(".segment-button[data-mode]")];

let config = loadConfig();

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function setToolsStatus(message, tone = "") {
  toolsStatus.textContent = message;
  toolsStatus.classList.remove("is-emphasis", "is-success", "is-danger");

  if (tone) {
    toolsStatus.classList.add(tone);
  }
}

function persist(announce = "") {
  config = saveConfig(config);

  if (announce) {
    setToolsStatus(announce, "is-success");
  }

  renderMeta();
}

function renderMeta() {
  const enabledItems = getEnabledItems(config);
  const availableItems = getAvailableItems(config);

  titleInput.value = config.title;
  settingsSummary.innerHTML = `共 <strong>${config.items.length}</strong> 个项目，已启用 <strong>${enabledItems.length}</strong> 个，当前可抽 <strong>${availableItems.length}</strong> 个。`;

  for (const button of modeButtons) {
    const isActive = button.dataset.mode === config.drawMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function renderItems() {
  if (!config.items.length) {
    itemsList.innerHTML = `<div class="empty-card">当前没有项目，点击“新增项目”开始添加。</div>`;
    return;
  }

  itemsList.innerHTML = config.items
    .map(
      (item, index) => `
        <article class="item-card" data-id="${item.id}">
          <div class="item-main">
            <div class="item-title-wrap">
              <span class="item-swatch" style="--swatch:${item.color}"></span>
              <input
                class="text-input"
                type="text"
                data-field="label"
                maxlength="18"
                value="${escapeAttribute(item.label)}"
                placeholder="输入计划名称"
              >
            </div>
            <button
              type="button"
              class="toggle-button ${item.enabled ? "is-on" : ""}"
              data-action="toggle"
              aria-pressed="${String(item.enabled)}"
            >${item.enabled ? "已启用" : "已停用"}</button>
          </div>

          <div class="item-controls">
            <div class="weight-control">
              <span class="control-label">权重</span>
              <div class="stepper">
                <button type="button" class="mini-button" data-action="decrease-weight" aria-label="减少权重">-</button>
                <input class="number-input" type="number" min="1" max="10" step="1" data-field="weight" value="${item.weight}">
                <button type="button" class="mini-button" data-action="increase-weight" aria-label="增加权重">+</button>
              </div>
            </div>

            <div class="order-control">
              <span class="control-label">顺序</span>
              <button type="button" class="tool-button" data-action="move-up" ${index === 0 ? "disabled" : ""}>上移</button>
              <button type="button" class="tool-button" data-action="move-down" ${index === config.items.length - 1 ? "disabled" : ""}>下移</button>
              <button type="button" class="tool-button" data-action="delete">删除</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAll() {
  renderMeta();
  renderItems();
}

function findItemIndex(id) {
  return config.items.findIndex((item) => item.id === id);
}

function exportCurrentConfig() {
  const blob = new Blob([serializeConfig(config)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const filename = `weekend-wheel-config-${new Date().toISOString().slice(0, 10)}.json`;

  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  setToolsStatus("当前配置已导出为 JSON 文件。", "is-success");
}

function importConfigFile(file) {
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      config = saveConfig(normalizeConfig(parsed, { requireItems: true }));
      renderAll();
      setToolsStatus("导入成功，当前配置已更新。", "is-success");
    } catch (error) {
      setToolsStatus(error instanceof Error ? error.message : "导入失败，请检查 JSON 文件格式。", "is-danger");
    }
  });

  reader.addEventListener("error", () => {
    setToolsStatus("读取文件失败，请重新选择。", "is-danger");
  });

  reader.readAsText(file);
}

titleInput.addEventListener("change", () => {
  config.title = titleInput.value;
  persist("标题已更新。");
});

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    config.drawMode = button.dataset.mode === "no-repeat" ? "no-repeat" : "repeat";
    persist("默认抽取模式已更新。");
  });
}

addItemButton.addEventListener("click", () => {
  config.items.push(createBlankItem(config.items.length));
  config.roundExcludedIds = config.roundExcludedIds.filter((id) => config.items.some((item) => item.id === id));
  config = saveConfig(config);
  renderAll();
  setToolsStatus("已新增一个计划项。", "is-success");
});

restoreDefaultsButton.addEventListener("click", () => {
  config = resetConfig();
  renderAll();
  setToolsStatus("已恢复为默认周末计划。", "is-success");
});

exportButton.addEventListener("click", exportCurrentConfig);

importButton.addEventListener("click", () => {
  importInput.click();
});

importInput.addEventListener("change", () => {
  const file = importInput.files?.[0];
  if (file) {
    importConfigFile(file);
  }
  importInput.value = "";
});

itemsList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest("[data-action]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const card = button.closest("[data-id]");
  if (!(card instanceof HTMLElement)) {
    return;
  }

  const itemIndex = findItemIndex(card.dataset.id);
  if (itemIndex < 0) {
    return;
  }

  const [item] = config.items.slice(itemIndex, itemIndex + 1);

  switch (button.dataset.action) {
    case "toggle":
      config.items[itemIndex] = { ...item, enabled: !item.enabled };
      persist(item.enabled ? "已停用该计划项。" : "已启用该计划项。");
      renderAll();
      break;
    case "increase-weight":
      config.items[itemIndex] = { ...item, weight: Math.min(10, item.weight + 1) };
      persist("权重已增加。");
      renderAll();
      break;
    case "decrease-weight":
      config.items[itemIndex] = { ...item, weight: Math.max(1, item.weight - 1) };
      persist("权重已减少。");
      renderAll();
      break;
    case "move-up":
      if (itemIndex > 0) {
        const swap = config.items[itemIndex - 1];
        config.items[itemIndex - 1] = item;
        config.items[itemIndex] = swap;
        persist("项目顺序已调整。");
        renderAll();
      }
      break;
    case "move-down":
      if (itemIndex < config.items.length - 1) {
        const swap = config.items[itemIndex + 1];
        config.items[itemIndex + 1] = item;
        config.items[itemIndex] = swap;
        persist("项目顺序已调整。");
        renderAll();
      }
      break;
    case "delete":
      config.items["}
      .filter((candidate) => candidate.id !== item.id);
      config.roundExcludedIds = config.roundExcludedIds.filter((id) => id !== item.id);
      persist("项目已删除。");
      renderAll();
      break;
    default:
      break;
  }
});

itemsList.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const card = target.closest("[data-id]");
  if (!(card instanceof HTMLElement)) {
    return;
  }

  const itemIndex = findItemIndex(card.dataset.id);
  if (itemIndex < 0) {
    return;
  }

  if (target.dataset.field === "label") {
    config.items[itemIndex].label = target.value;
    persist("项目名称已更新。");
    renderAll();
    return;
  }

  if (target.dataset.field === "weight") {
    const weight = Number.parseInt(target.value, 10);
    config.items[itemIndex].weight = Number.isFinite(weight) ? weight : config.items[itemIndex].weight;
    persist("项目权重已更新。");
    renderAll();
  }
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) {
    return;
  }

  config = loadConfig();
  renderAll();
});

window.addEventListener("pageshow", () => {
  config = loadConfig();
  renderAll();
});

renderAll();
