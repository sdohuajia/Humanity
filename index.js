import fs from "fs";
import fetch from "node-fetch";
import fetchCookie from "fetch-cookie";
import { HttpsProxyAgent } from "https-proxy-agent";
import { CookieJar } from "tough-cookie";
import figlet from "figlet";
import chalk from "chalk";

const BASE_URL = "https://testnet.humanity.org";
const TOKEN_FILE = "tokens.txt";
const PROXY_FILE = "proxy.txt";
const LOG_FILE = "log.txt";

if (!fs.existsSync(TOKEN_FILE)) {
  console.error("❌ 未找到 tokens.txt 文件！");
  process.exit(1);
}

const TOKENS = fs.readFileSync(TOKEN_FILE, "utf-8").split("\n").map(t => t.trim()).filter(Boolean);
const PROXIES = fs.existsSync(PROXY_FILE)
  ? fs.readFileSync(PROXY_FILE, "utf-8").split("\n").map(p => p.trim()).filter(Boolean)
  : [];

function getRandomProxy() {
  if (PROXIES.length > 0) {
    const proxy = PROXIES[Math.floor(Math.random() * PROXIES.length)];
    return new HttpsProxyAgent(proxy);
  }
  return null;
}

function logError(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

function showBanner() {
  console.log(chalk.green("=== Humanity 自动领取 ==="));
}

async function call(endpoint, token, agent, method = "POST", body = {}) {
  const url = BASE_URL + endpoint;
  const jar = new CookieJar();
  const fetchWithCookies = fetchCookie(fetch, jar);

  const headers = {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
    token: token,
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
  };

  try {
    const res = await fetchWithCookies(url, {
      method,
      headers,
      agent,
      body: method === "GET" ? undefined : JSON.stringify(body)
    });

    let responseData;
    try {
      responseData = await res.json();
    } catch (jsonErr) {
      throw new Error(`接收到非JSON数据: ${jsonErr.message}`);
    }

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}: ${responseData.message || "未知错误"}`);
    }

    return responseData;
  } catch (err) {
    throw new Error(`请求失败 (${endpoint}): ${err.message}`);
  }
}

async function processToken(token, index) {
  const agent = getRandomProxy();

  try {
    console.log(chalk.cyan(`\n🔹 开始处理令牌 #${index + 1}`));

    const userInfo = await call("/api/user/userInfo", token, agent);
    console.log("✅ 用户:", userInfo.data.nickName);
    console.log("✅ 钱包:", userInfo.data.ethAddress);

    const balance = await call("/api/rewards/balance", token, agent, "GET");
    console.log(chalk.hex('#FFA500')("💰 当前 HP 积分:", balance.balance.total_rewards));

    const rewardStatus = await call("/api/rewards/daily/check", token, agent);
    console.log("📊 状态:", rewardStatus.message);

    if (!rewardStatus.available) {
      console.log("⏳ 今天已经领取过了，跳过...");
      return;
    }

    const claim = await call("/api/rewards/daily/claim", token, agent);
    
    if (claim && claim.data && claim.data.amount) {
      console.log("🎉 领取成功，HP 积分:", claim.data.amount);
    } else if (claim.message && claim.message.includes('successfully claimed')) {
      console.log("🎉 您已成功领取今日的 HP 积分。");
    } else {
      console.error("❌ 领取失败，收到的数据不符合预期:", claim);
      return;
    }

    const updatedBalance = await call("/api/rewards/balance", token, agent, "GET");

    if (updatedBalance && updatedBalance.balance) {
      console.log(chalk.green("💰 领取后的 HP 积分:", updatedBalance.balance.total_rewards));
    } else {
      console.error("❌ 更新 HP 积分失败，收到的数据不符合预期:", updatedBalance);
    }
  } catch (err) {
    console.error("❌ 错误:", err.message);
    logError(`令牌 #${index + 1} 失败: ${err.message}`);
  }

  const delay = Math.floor(Math.random() * 5000) + 15000;
  console.log(chalk.hex('#FFA500')(`⏳ 等待 ${delay / 1000} 秒...\n`));
  await new Promise(resolve => setTimeout(resolve, delay));
}

function countdown(seconds, onFinish) {
  let remainingTime = seconds;

  const interval = setInterval(() => {
    const hours = Math.floor(remainingTime / 3600);
    const minutes = Math.floor((remainingTime % 3600) / 60);
    const seconds = remainingTime % 60;

    const timeLeft = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    process.stdout.write(`⏳ 等待 ${timeLeft} 再次运行...`);

    remainingTime--;

    if (remainingTime < 0) {
      clearInterval(interval);
      console.log("\n⏳ 倒计时结束，开始新一轮...");
      onFinish(); // 继续下一轮
    }
  }, 1000);
}

async function startRound() {
  console.log(chalk.bgGreen.black.bold(`\n🚀 开始批量领取，共 ${TOKENS.length} 个账户...`));

  for (let i = 0; i < TOKENS.length; i++) {
    await processToken(TOKENS[i], i);
  }

  console.log(chalk.green(`✅ 本轮处理完成，开始24小时倒计时...`));
  countdown(24 * 60 * 60, startRound); // 倒计时结束后重新运行
}

function batchRun() {
  showBanner();
  startRound(); // 开始第一轮
}

batchRun();
