const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = __dirname;
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(rootDir, "data");
const dataFile = path.join(dataDir, "lottery.json");
const port = Number(process.env.PORT || 3000);

const defaultData = {
  settings: {
    title: "好运转盘抽奖",
    dailyChances: 3,
    participantCount: 12860,
    winRateText: "100%",
  },
  prizes: [
    { id: "p1", name: "66 元微信立减金", desc: "可在活动商户消费时抵扣", tag: "大奖", color: "#f43f5e", weight: 4, stock: 20, enabled: true },
    { id: "p2", name: "8.8 元红包", desc: "微信零钱红包，即刻到账", tag: "热门", color: "#f59e0b", weight: 12, stock: 100, enabled: true },
    { id: "p3", name: "会员月卡", desc: "领取后 7 日内激活有效", tag: "福利", color: "#10b981", weight: 8, stock: 60, enabled: true },
    { id: "p4", name: "奶茶兑换券", desc: "线下门店出示券码核销", tag: "畅销", color: "#276ef1", weight: 10, stock: 80, enabled: true },
    { id: "p5", name: "2 元随机红包", desc: "小额好运，也很开心", tag: "必中", color: "#8b5cf6", weight: 38, stock: 9999, enabled: true },
    { id: "p6", name: "谢谢参与", desc: "送你一次好运加成", tag: "安慰奖", color: "#64748b", weight: 28, stock: 9999, enabled: true },
  ],
  records: [
    { id: "r1", user: "陈*玲", prizeId: "p2", prizeName: "8.8 元红包", createdAt: "2026-06-07T10:10:00.000Z" },
    { id: "r2", user: "李*明", prizeId: "p4", prizeName: "奶茶兑换券", createdAt: "2026-06-07T10:08:00.000Z" },
    { id: "r3", user: "周*南", prizeId: "p3", prizeName: "会员月卡", createdAt: "2026-06-07T10:06:00.000Z" },
  ],
  userChances: {},
};

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) writeData(defaultData);
}

function readData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function writeData(data) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), "utf8");
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) reject(new Error("请求内容过大"));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function publicConfig(data) {
  const prizes = data.prizes.map(({ weight, ...prize }) => prize);
  return {
    settings: data.settings,
    prizes,
    records: data.records.slice(0, 20),
  };
}

function adminConfig(data) {
  return {
    settings: data.settings,
    prizes: data.prizes,
    records: data.records.slice(0, 100),
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getUserId(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket.remoteAddress || "local";
  return crypto.createHash("sha1").update(ip).digest("hex").slice(0, 16);
}

function availablePrizes(data) {
  return data.prizes.filter((prize) => prize.enabled && Number(prize.weight) > 0 && Number(prize.stock) > 0);
}

function pickPrize(data) {
  const pool = availablePrizes(data);
  if (pool.length === 0) return null;

  const total = pool.reduce((sum, prize) => sum + Number(prize.weight), 0);
  let cursor = Math.random() * total;

  for (const prize of pool) {
    cursor -= Number(prize.weight);
    if (cursor <= 0) return prize;
  }

  return pool[pool.length - 1];
}

function sanitizePrize(input, index) {
  return {
    id: String(input.id || `p${Date.now()}${index}`),
    name: String(input.name || "未命名奖品").trim(),
    desc: String(input.desc || "").trim(),
    tag: String(input.tag || "奖品").trim(),
    color: /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : "#f59e0b",
    weight: Math.max(0, Number(input.weight) || 0),
    stock: Math.max(0, Math.floor(Number(input.stock) || 0)),
    enabled: Boolean(input.enabled),
  };
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  if (url.pathname === "/api/config" && req.method === "GET") {
    return sendJson(res, 200, publicConfig(readData()));
  }

  if (url.pathname === "/api/admin/config" && req.method === "GET") {
    return sendJson(res, 200, adminConfig(readData()));
  }

  if (url.pathname === "/api/admin/config" && req.method === "POST") {
    const body = await parseBody(req);
    const data = readData();
    data.settings = {
      title: String(body.settings?.title || "好运转盘抽奖").trim(),
      dailyChances: Math.max(1, Math.floor(Number(body.settings?.dailyChances) || 3)),
      participantCount: Math.max(0, Math.floor(Number(body.settings?.participantCount) || 0)),
      winRateText: String(body.settings?.winRateText || "100%").trim(),
    };
    data.prizes = Array.isArray(body.prizes) ? body.prizes.map(sanitizePrize) : data.prizes;
    writeData(data);
    return sendJson(res, 200, adminConfig(data));
  }

  if (url.pathname === "/api/lottery/draw" && req.method === "POST") {
    const data = readData();
    const userId = getUserId(req);
    const key = `${userId}:${todayKey()}`;
    const used = Number(data.userChances[key] || 0);
    const dailyChances = Number(data.settings.dailyChances || 3);

    if (used >= dailyChances) {
      return sendJson(res, 429, { message: "今日抽奖机会已用完", remainingChances: 0 });
    }

    const prize = pickPrize(data);
    if (!prize) {
      return sendJson(res, 409, { message: "暂无可抽奖品，请稍后再试", remainingChances: dailyChances - used });
    }

    prize.stock = Math.max(0, Number(prize.stock) - 1);
    data.userChances[key] = used + 1;

    const record = {
      id: crypto.randomUUID(),
      user: "我",
      prizeId: prize.id,
      prizeName: prize.name,
      createdAt: new Date().toISOString(),
    };
    data.records.unshift(record);
    data.records = data.records.slice(0, 200);
    writeData(data);

    const publicPrize = { ...prize };
    delete publicPrize.weight;

    return sendJson(res, 200, {
      prize: publicPrize,
      prizeIndex: data.prizes.findIndex((item) => item.id === prize.id),
      remainingChances: dailyChances - data.userChances[key],
      records: data.records.slice(0, 20),
    });
  }

  return sendJson(res, 404, { message: "接口不存在" });
}

function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(rootDir, pathname));

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("页面不存在");
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml",
    };

    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(content);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { message: error.message || "服务器异常" });
  }
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(port, () => {
    ensureDataFile();
    console.log(`Lottery H5 running at http://localhost:${port}`);
    console.log(`Admin console running at http://localhost:${port}/admin.html`);
  });
}

module.exports = { createServer };
