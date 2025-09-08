const axios = require("axios");
const twilio = require("twilio");
require('dotenv').config();

// === TELEGRAM CONFIG ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID_JOBS = process.env.TELEGRAM_CHAT_ID_JOBS || "-1002985301415";
const TELEGRAM_CHAT_ID_STATUS = process.env.TELEGRAM_CHAT_ID_STATUS || "-1003011417488";

// Fallback to old single channel if new ones not set
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// === TWILIO CONFIG ===
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const YOUR_NUMBER = process.env.YOUR_PHONE_NUMBER;

const client = twilio(TWILIO_SID, TWILIO_AUTH);

// === ALERT STATE ===
const sentJobs = new Set();

// === ALERT FUNCTIONS ===

// Send Telegram message to STATUS channel
async function sendTelegramAlert(message) {
  try {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID_STATUS) {
      console.log("⚠️ Missing Telegram config, skipping status alert");
      return;
    }

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

// Send job alerts (Telegram + optional Twilio call)
async function sendJobAlert(message, chatIds = [TELEGRAM_CHAT_ID_JOBS]) {
  try {
    if (!TELEGRAM_TOKEN || !chatIds.length) {
      console.log("⚠️ Missing Telegram config, skipping job alert");
      return;
    }

    for (const id of chatIds) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: id,
        text: `🚨 Amazon Job Alert 🚨\n${message}`,
        parse_mode: "Markdown"
      });
    }

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

    console.log("✅ JOB ALERT sent");
  } catch (err) {
    console.error("❌ Error sending job alert:", err.message);
  }
}

// Deduplicated job alert
async function sendJobAlertDedup(message, jobId, chatIds) {
  if (sentJobs.has(jobId)) {
    console.log("⚠️ Duplicate job alert skipped:", jobId);
    return;
  }
  sentJobs.add(jobId);
  await sendJobAlert(message, chatIds);
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