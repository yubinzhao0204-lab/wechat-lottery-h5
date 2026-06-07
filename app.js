let prizes = [];

const state = {
  chances: 3,
  spinning: false,
  rotation: 0,
  records: [],
};

const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
const spinButton = document.getElementById("spinButton");
const chanceCount = document.getElementById("chanceCount");
const participantCount = document.getElementById("participantCount");
const winRateText = document.getElementById("winRateText");
const pageTitle = document.getElementById("pageTitle");
const prizeList = document.getElementById("prizeList");
const recordList = document.getElementById("recordList");
const modal = document.getElementById("resultModal");
const resultTitle = document.getElementById("resultTitle");
const resultDesc = document.getElementById("resultDesc");
const resultIcon = document.getElementById("resultIcon");
const closeModal = document.getElementById("closeModal");
const confirmButton = document.getElementById("confirmButton");
const toast = document.getElementById("toast");

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "请求失败");
  return payload;
}

async function loadConfig() {
  const data = await requestJson("/api/config");
  prizes = data.prizes;
  state.records = data.records;
  state.chances = Number(data.settings.dailyChances || 3);
  document.title = data.settings.title;
  pageTitle.textContent = data.settings.title;
  chanceCount.textContent = state.chances;
  participantCount.textContent = Number(data.settings.participantCount || 0).toLocaleString("zh-CN");
  winRateText.textContent = data.settings.winRateText || "100%";
  drawWheel();
  renderPrizeList();
  renderRecords();
  updateChanceView();
}

function drawWheel() {
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 22;
  const slice = (Math.PI * 2) / Math.max(prizes.length, 1);

  ctx.clearRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(center, center, radius + 16, 0, Math.PI * 2);
  ctx.fillStyle = "#ffdf7d";
  ctx.fill();

  if (!prizes.length) {
    ctx.fillStyle = "#b91722";
    ctx.font = "bold 34px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("暂无奖品", center, center);
    return;
  }

  prizes.forEach((prize, index) => {
    const start = index * slice - Math.PI / 2;
    const end = start + slice;

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = index % 2 === 0 ? "#fff7df" : "#ffe2a6";
    ctx.fill();

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = prize.color;
    ctx.font = "bold 29px Microsoft YaHei, sans-serif";
    wrapCanvasText(prize.name, radius - 38, 9, 138, 34);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(center, center, 72, 0, Math.PI * 2);
  ctx.fillStyle = "#d7212d";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, 54, 0, Math.PI * 2);
  ctx.fillStyle = "#ffce53";
  ctx.fill();
}

function wrapCanvasText(text, x, y, maxWidth, lineHeight) {
  const chars = text.split("");
  let line = "";
  let offsetY = y;

  chars.forEach((char, index) => {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, offsetY);
      line = char;
      offsetY += lineHeight;
    } else {
      line = testLine;
    }

    if (index === chars.length - 1) {
      ctx.fillText(line, x, offsetY);
    }
  });
}

function renderPrizeList() {
  prizeList.innerHTML = prizes
    .map(
      (prize) => `
        <li>
          <span class="prize-name">${escapeHtml(prize.name)}<small>${escapeHtml(prize.desc)}</small></span>
          <span class="tag" style="background:${prize.color}">${escapeHtml(prize.tag)}</span>
        </li>
      `,
    )
    .join("");
}

function renderRecords() {
  recordList.innerHTML = state.records
    .slice(0, 5)
    .map(
      (record) => `
        <li>
          <span class="record-name">${escapeHtml(record.user)}<small>刚刚抽中</small></span>
          <strong>${escapeHtml(record.prizeName)}</strong>
        </li>
      `,
    )
    .join("");
}

function updateChanceView() {
  chanceCount.textContent = state.chances;
  spinButton.disabled = state.spinning || state.chances <= 0 || prizes.length === 0;
}

async function spin() {
  if (state.spinning) return;
  if (state.chances <= 0) {
    showToast("今日抽奖机会已用完，明天再来试试。");
    return;
  }

  state.spinning = true;
  updateChanceView();

  let result;
  try {
    result = await requestJson("/api/lottery/draw", { method: "POST", body: "{}" });
  } catch (error) {
    state.spinning = false;
    updateChanceView();
    showToast(error.message);
    return;
  }

  const prizeIndex = Math.max(0, result.prizeIndex);
  const sliceDeg = 360 / prizes.length;
  const prizeCenterDeg = prizeIndex * sliceDeg + sliceDeg / 2;
  const targetDeg = 360 - prizeCenterDeg;
  const rounds = 6 + Math.floor(Math.random() * 3);
  state.rotation += rounds * 360 + targetDeg - (state.rotation % 360);
  canvas.style.transform = `rotate(${state.rotation}deg)`;

  window.setTimeout(() => {
    state.spinning = false;
    state.chances = result.remainingChances;
    state.records = result.records;
    prizes[prizeIndex] = result.prize;
    renderPrizeList();
    renderRecords();
    updateChanceView();
    showResult(result.prize);
  }, 5000);
}

function showResult(prize) {
  resultTitle.textContent = prize.name;
  resultDesc.textContent = prize.desc;
  resultIcon.textContent = prize.name === "谢谢参与" ? "喜" : "奖";
  modal.hidden = false;
}

function hideResult() {
  modal.hidden = true;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

function shareActivity() {
  showToast("微信内可通过右上角菜单转发给好友。");
}

function showRules() {
  showToast("每人每天按后台配置获得抽奖机会，奖品以页面展示和实际库存为准。");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

spinButton.addEventListener("click", spin);
closeModal.addEventListener("click", hideResult);
confirmButton.addEventListener("click", hideResult);
document.getElementById("shareButton").addEventListener("click", shareActivity);
document.getElementById("rulesButton").addEventListener("click", showRules);

loadConfig().catch((error) => {
  showToast(`连接后台失败：${error.message}`);
  drawWheel();
  updateChanceView();
});
