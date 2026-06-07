const titleInput = document.getElementById("titleInput");
const dailyChancesInput = document.getElementById("dailyChancesInput");
const participantInput = document.getElementById("participantInput");
const winRateInput = document.getElementById("winRateInput");
const prizeEditor = document.getElementById("prizeEditor");
const recordList = document.getElementById("recordList");
const saveButton = document.getElementById("saveButton");
const reloadButton = document.getElementById("reloadButton");
const addPrizeButton = document.getElementById("addPrizeButton");
const saveState = document.getElementById("saveState");
const toast = document.getElementById("toast");

let prizes = [];

async function requestJson(url, options = {}) {
  let response;

  try {
    response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (error) {
    throw new Error("本地服务未启动或已断开，请在项目目录运行 npm start 后再保存。");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "请求失败");
  return payload;
}

async function loadConfig() {
  const data = await requestJson("/api/admin/config");
  titleInput.value = data.settings.title;
  dailyChancesInput.value = data.settings.dailyChances;
  participantInput.value = data.settings.participantCount;
  winRateInput.value = data.settings.winRateText;
  prizes = data.prizes.map((prize) => ({ ...prize }));
  renderPrizeEditor();
  renderRecords(data.records);
  markClean();
}

function renderPrizeEditor() {
  prizeEditor.innerHTML = prizes
    .map(
      (prize, index) => `
        <article class="prize-card" data-index="${index}">
          <label>
            <span>奖品名称</span>
            <input data-field="name" type="text" value="${escapeHtml(prize.name)}" />
          </label>
          <label>
            <span>奖品说明</span>
            <input data-field="desc" type="text" value="${escapeHtml(prize.desc)}" />
          </label>
          <label>
            <span>标签</span>
            <input data-field="tag" type="text" value="${escapeHtml(prize.tag)}" />
          </label>
          <label>
            <span>权重</span>
            <input data-field="weight" type="number" min="0" step="1" value="${prize.weight}" />
          </label>
          <label>
            <span>库存</span>
            <input data-field="stock" type="number" min="0" step="1" value="${prize.stock}" />
          </label>
          <label>
            <span>颜色</span>
            <span class="color-field">
              <input data-field="color" type="color" value="${prize.color}" />
              <input data-field="colorText" type="text" value="${prize.color}" />
            </span>
          </label>
          <div>
            <label class="toggle-row">
              <input data-field="enabled" type="checkbox" ${prize.enabled ? "checked" : ""} />
              <span>启用</span>
            </label>
            <button class="danger-button" data-action="remove" type="button">删除</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderRecords(records) {
  if (!records.length) {
    recordList.innerHTML = '<div class="record-item">暂无中奖记录</div>';
    return;
  }

  recordList.innerHTML = records
    .slice(0, 20)
    .map(
      (record) => `
        <div class="record-item">
          <strong>${escapeHtml(record.user)} 抽中 ${escapeHtml(record.prizeName)}</strong>
          <small>${formatTime(record.createdAt)}</small>
        </div>
      `,
    )
    .join("");
}

function collectSettings() {
  return {
    title: titleInput.value.trim(),
    dailyChances: Number(dailyChancesInput.value),
    participantCount: Number(participantInput.value),
    winRateText: winRateInput.value.trim(),
  };
}

function updatePrize(index, field, value) {
  const prize = prizes[index];
  if (!prize) return;

  if (field === "enabled") {
    prize.enabled = value;
  } else if (field === "weight" || field === "stock") {
    prize[field] = Math.max(0, Number(value) || 0);
  } else if (field === "colorText" || field === "color") {
    prize.color = value;
    syncColorInputs(index, value);
  } else {
    prize[field] = value;
  }

  markDirty();
}

function syncColorInputs(index, value) {
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return;
  const card = prizeEditor.querySelector(`[data-index="${index}"]`);
  if (!card) return;
  card.querySelector('[data-field="color"]').value = value;
  card.querySelector('[data-field="colorText"]').value = value;
}

async function saveConfig() {
  const data = await requestJson("/api/admin/config", {
    method: "POST",
    body: JSON.stringify({
      settings: collectSettings(),
      prizes,
    }),
  });
  prizes = data.prizes;
  renderPrizeEditor();
  renderRecords(data.records);
  markClean();
  showToast("配置已保存，前台刷新后生效。");
}

function addPrize() {
  prizes.push({
    id: `p${Date.now()}`,
    name: "新奖品",
    desc: "请填写奖品说明",
    tag: "奖品",
    color: "#f59e0b",
    weight: 1,
    stock: 10,
    enabled: true,
  });
  renderPrizeEditor();
  markDirty();
}

function removePrize(index) {
  prizes.splice(index, 1);
  renderPrizeEditor();
  markDirty();
}

function markDirty() {
  saveState.textContent = "有未保存修改";
  saveState.style.color = "#d9272f";
}

function markClean() {
  saveState.textContent = "已同步";
  saveState.style.color = "#16a34a";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatTime(value) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

prizeEditor.addEventListener("input", (event) => {
  const card = event.target.closest(".prize-card");
  if (!card) return;
  updatePrize(Number(card.dataset.index), event.target.dataset.field, event.target.value);
});

prizeEditor.addEventListener("change", (event) => {
  const card = event.target.closest(".prize-card");
  if (!card) return;
  if (event.target.dataset.field === "enabled") {
    updatePrize(Number(card.dataset.index), "enabled", event.target.checked);
  }
});

prizeEditor.addEventListener("click", (event) => {
  if (event.target.dataset.action !== "remove") return;
  const card = event.target.closest(".prize-card");
  removePrize(Number(card.dataset.index));
});

[titleInput, dailyChancesInput, participantInput, winRateInput].forEach((input) => {
  input.addEventListener("input", markDirty);
});

saveButton.addEventListener("click", () => {
  saveConfig().catch((error) => showToast(error.message));
});

reloadButton.addEventListener("click", () => {
  loadConfig().catch((error) => showToast(error.message));
});

addPrizeButton.addEventListener("click", addPrize);

loadConfig().catch((error) => showToast(error.message));
