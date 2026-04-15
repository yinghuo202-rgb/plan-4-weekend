(function () {
  const STORAGE_KEY = "weekend-wheel-config";
  const CURRENT_VERSION = 2;

  const DEFAULT_TITLE = "周末计划转盘";
  const MAX_HISTORY = 8;
  const MAX_TITLE_LENGTH = 24;
  const MAX_LABEL_LENGTH = 18;
  const MIN_WEIGHT = 1;
  const MAX_WEIGHT = 10;

  const PALETTE = [
    "#F2C8C2",
    "#F4D8B3",
    "#F2E4BC",
    "#D5E5CB",
    "#C9DDEE",
    "#D8D0EA",
    "#EBCFDF",
    "#D5E4DE"
  ];

  const LEGACY_DEFAULT_LABELS = [
    "补觉回血",
    "看一部电影",
    "出去吃点好吃的",
    "读书半小时",
    "去运动一下",
    "整理房间",
    "短遄出门",
    "和朋友见面"
  ];

  const DEFAULT_LABELS = [
    "一起做早餐",
    "赖床聊天",
    "去公园散步",
    "一起ꤚ单车",
    "早午餐约会",
    "逛菜市场做饭",
    "一起烤饼干",
    "去花店挑花",
    "咖啡馆发呆",
    "一起看展览",
    "去书店选书",
    "交换想读清单",
    "看一场电影",
    "重温老电影",
    "一起追剧",
    "做情侣问答",
    "拍一组合照",
    "去江边吹风",
    "去山上看日落",
    "夜骑兜风",
    "打卡新餐厅",
    "吃火锅约会",
    "一起做寿司",
    "做甜品实验",
    "泡茶聊天",
    "去宠物咖啡店",
    "逛家居店",
    "整理房间",
    "给彼此写信",
    "做愿望板",
    "一起健身",
    "双人拉伸",
    "打羽毛球",
    "去游泲",
    "打保龄球",
    "去桌游店",
    "玩双人游戏",
    "拼一幅拼图",
    "做乐高小屋",
    "一起画画",
    "学拍短视频",
    "做手工饰品",
    "去陶艺体验",
    "录情侣播客",
    "一起唱K",
    "学一支舞",
    "去听livehouse",
    "晚上看星星",
    "一起看日出",
    "去露营野餐",
    "阳台小野餐",
    "去海边走走",
    "周边短遄游",
    "坐公交去终点站",
    "去老街闲逛",
    "逛夜市",
    "一起夹娃娃",
    "坐摩天轮",
    "去游乐园",
    "逛超市采购",
    "做一顿大餐",
    "比赛摆盘",
    "一起洗车",
    "打扫厨房",
    "研究新菜谱",
    "换情侣头像",
    "做手机相册",
    "整理旅行照片",
    "规划下一次旅行",
    "做存钱计划",
    "一起记账",
    "逛中古店",
    "逛文创市集",
    "去二手书店",
    "买一束晚安花",
    "一起泡脚",
    "做面膜放松",
    "互相按摩",
    "听播客散步",
    "去天台吹风",
    "吃路边小吃",
    "一起学调饮",
    "做冰箱贴",
    "看纪录片",
    "交换童年故事",
    "做未来清单",
    "去拍证件照风",
    "逛便利店挑零食",
    "只带50元约会",
    "走一条陌生小路",
    "去拍晚霞",
    "一起喂流浪猫",
    "逛植物店",
    "养一盆小绿植",
    "写下三件开心事",
    "一起做冥想",
    "看球赛或比赛",
    "学一道地方菜",
    "挑下周约会日",
    "给彼此挑礼物"
  ];
  let memoryConfig = null;

  function looksLikeLegacyDefault(items) {
    if (!Array.isArray(items) || items.length !== LEGACY_DEFAULT_LABELS.length) {
      return false;
    }

    return items.every((item, index) => {
      const label = item && typeof item.label === "string" ? item.label.trim() : "";
      return label === LEGACY_DEFAULT_LABELS[index];
    });
  }

  function createId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function cleanText(value, fallback, maxLength) {
    const text = typeof value === "string" ? value.trim() : "";
    return text.slice(0, maxLength) || fallback;
  }

  function cleanId(value) {
    const text = typeof value === "string" ? value.trim() : "";
    return /^[A-Za-z0-9_-]+$/.test(text) ? text : createId();
  }

  function cleanColor(value, index) {
    const text = typeof value === "string" ? value.trim() : "";
    return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(text) ? text : PALETTE[index % PALETTE.length];
  }

  function clampWeight(value) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) {
      return MIN_WEIGHT;
    }

    return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, number));
  }

  function uniqueStrings(values) {
    return [...new Set(values.filter((value) => typeof value === "string" && value))];
  }

  function createItem(partial = {}, index = 0) {
    return {
      id: cleanId(partial.id),
      label: cleanText(partial.label, `周末计划 ${index + 1}`, MAX_LABEL_LENGTH),
      weight: clampWeight(partial.weight),
      enabled: partial.enabled !== false,
      color: cleanColor(partial.color, index)
    };
  }

  function createDefaultConfig() {
    return {
      version: CURRENT_VERSION,
      title: DEFAULT_TITLE,
      drawMode: "repeat",
      items: DEFAULT_LABELS.map((label, index) => createItem({ label, color: PALETTE[index % PALETTE.length] }, index)),
      roundExcludedIds: [],
      resultHistory: [],
      updatedAt: new Date().toISOString()
    };
  }

  function createBlankItem(index = 0) {
    return createItem(
      {
        label: `新的计划 ${index + 1}`,
        weight: MIN_WEIGHT,
        enabled: true
      },
      index
    );
  }

  function normalizeConfig(input, options = {}) {
    const { requireItems = false } = options;
    const defaultConfig = createDefaultConfig();

    if (!input || typeof input !== "object") {
      if (requireItems) {
        throw new Error("配置文件格式不正确。");
      }

      return defaultConfig;
    }

    const inputHasItems = Array.isArray(input.items);
    const normalizedItems = inputHasItems
      ? input.items
          .map((item, index) => createItem(item, index))
          .filter((item) => typeof item.label === "string" && item.label)
      : defaultConfig.items;

    if (requireItems && normalizedItems.length === 0) {
      throw new Error("导入文件至少需要包含 1 个项目。");
    }

    const items = inputHasItems ? normalizedItems : defaultConfig.items;
    const validItemIds = new Set(items.map((item) => item.id));
    const rawExcludedIds = Array.isArray(input.roundExcludedIds) ? input.roundExcludedIds : [];
    const rawHistory = Array.isArray(input.resultHistory) ? input.resultHistory : [];

    return {
      version: CURRENT_VERSION,
      title: cleanText(input.title, DEFAULT_TITLE, MAX_TITLE_LENGTH),
      drawMode: input.drawMode === "no-repeat" ? "no-repeat" : "repeat",
      items,
      roundExcludedIds: uniqueStrings(rawExcludedIds).filter((id) => validItemIds.has(id)),
      resultHistory: rawHistory
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => value.trim().slice(0, MAX_LABEL_LENGTH))
        .slice(0, MAX_HISTORY),
      updatedAt: typeof input.updatedAt === "string" && input.updatedAt ? input.updatedAt : new Date().toISOString()
    };
  }

  function loadConfig() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        const defaultConfig = createDefaultConfig();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultConfig));
        return defaultConfig;
      }

      const parsed = JSON.parse(raw);
      const parsedVersion = typeof parsed.version === "number" ? parsed.version : 1;
      if (parsedVersion < CURRENT_VERSION && looksLikeLegacyDefault(parsed.items)) {
        const migratedConfig = createDefaultConfig();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedConfig));
        return migratedConfig;
      }

      return normalizeConfig(parsed);
    } catch (error) {
      if (memoryConfig) {
        return normalizeConfig(memoryConfig);
      }

      const defaultConfig = createDefaultConfig();
      memoryConfig = defaultConfig;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultConfig));
      } catch {
        // Ignore storage errors and still return the in-memory default config.
      }
      return defaultConfig;
    }
  }

  function saveConfig(config) {
    const normalizedConfig = normalizeConfig({
      ...config,
      updatedAt: new Date().toISOString()
    });

    memoryConfig = normalizedConfig;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedConfig));
    } catch {
      // Ignore storage errors and keep the current session in memory.
    }
    return normalizedConfig;
  }

  function resetConfig() {
    return saveConfig(createDefaultConfig());
  }

  function getEnabledItems(config) {
    return config.items.filter((item) => item.enabled);
  }

  function getAvailableItems(config) {
    const enabledItems = getEnabledItems(config);

    if (config.drawMode !== "no-repeat") {
      return enabledItems;
    }

    const excludedIds = new Set(config.roundExcludedIds);
    return enabledItems.filter((item) => !excludedIds.has(item.id));
  }

  function pushHistory(config, label) {
    return [label, ...config.resultHistory].slice(0, MAX_HISTORY);
  }

  function serializeConfig(config) {
    return JSON.stringify(normalizeConfig(config), null, 2);
  }

  window.WeekendWheelStorage = {
    STORAGE_KEY,
    PALETTE,
    createBlankItem,
    normalizeConfig,
    loadConfig,
    saveConfig,
    resetConfig,
    getEnabledItems,
    getAvailableItems,
    pushHistory,
    serializeConfig
  };
})();
