// alert_v2.0.js (simplified for single channel)
require('dotenv').config();
const axios = require("axios");
const twilio = require("twilio");

// === TELEGRAM CONFIG ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID_JOBS = Number(process.env.TELEGRAM_CHAT_ID_V2); // single channel
const TELEGRAM_CHAT_ID_STATUS = process.env.TELEGRAM_CHAT_ID_STATUS || "-1003011417488";

// === TWILIO CONFIG ===
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const YOUR_NUMBER = process.env.YOUR_PHONE_NUMBER;
const client = twilio(TWILIO_SID, TWILIO_AUTH);

// === ALERT STATE ===
const sentJobs = new Set();

// Send Telegram message to STATUS channel
async function sendTelegramAlert(message) {
  try {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID_STATUS) return;
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID_STATUS,
      text: `🤖 Amazon Job Monitor\n${message}`,
      parse_mode: "Markdown"
    });
    console.log("✅ Status sent to Status channel");
  } catch (err) {
    console.error("❌ Error sending status alert:", err.message);
  }
}

// Send job alert to single Telegram channel + optional Twilio call
async function sendJobAlert(message) {
  try {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID_JOBS) {
      console.log("⚠️ Missing Telegram config, skipping job alert");
      return;
    }

    console.log("📤 Sending job alert to chat_id:", TELEGRAM_CHAT_ID_JOBS);
    console.log("📤 Message content:", message);

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID_JOBS,
      text: `🚨 Amazon Job Alert 🚨\n${message}`,
      parse_mode: "Markdown"
    });

    console.log(`✅ Job alert sent to ${TELEGRAM_CHAT_ID_JOBS}`);

    // Optional Twilio call
    if (TWILIO_SID && TWILIO_AUTH && TWILIO_NUMBER && YOUR_NUMBER) {
      console.log("Making phone call to:", YOUR_NUMBER);
      await client.calls.create({
        to: YOUR_NUMBER,
        from: TWILIO_NUMBER,
        twiml: `<Response><Say voice="alice">New Amazon warehouse job alert! Check your phone for details.</Say></Response>`
      });
      console.log("✅ Phone call initiated");
    } else {
      console.log("⚠️ Twilio config incomplete, skipping phone call");
    }
  } catch (err) {
    console.error("❌ Error in sendJobAlert:", err.message);
  }
}

// Deduplicated job alert
async function sendJobAlertDedup(message, jobId) {
  if (sentJobs.has(jobId)) {
    console.log("⚠️ Duplicate job alert skipped:", jobId);
    return;
  }
  sentJobs.add(jobId);
  await sendJobAlert(message);
}

// Legacy wrapper for status
async function sendAlert(message) {
  return await sendTelegramAlert(message);
}

// === EXPORTS ===
module.exports = {
  sendAlert,
  sendTelegramAlert,
  sendJobAlert,
  sendJobAlertDedup
};