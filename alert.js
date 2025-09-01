const axios = require("axios");
const twilio = require("twilio");
require('dotenv').config();

// === TELEGRAM CONFIG ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// === TWILIO CONFIG ===
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const YOUR_NUMBER = process.env.YOUR_PHONE_NUMBER;

const client = twilio(TWILIO_SID, TWILIO_AUTH);

// === ALERT FUNCTIONS ===

// Send Telegram message only (for status updates)
async function sendTelegramAlert(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: `🤖 Amazon Job Monitor\n${message}`,
      parse_mode: "Markdown"
    });
    console.log("✅ Status sent via Telegram");
  } catch (err) {
    console.error("❌ Error sending Telegram alert:", err.message);
  }
}

// Send both Telegram + Phone call (for actual job alerts)
async function sendJobAlert(message) {
  try {
    // 1. Telegram message
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: `🚨 Amazon Job Alert 🚨\n${message}`,
      parse_mode: "Markdown"
    });

    // 2. Twilio voice call
    await client.calls.create({
      to: YOUR_NUMBER,
      from: TWILIO_NUMBER,
      twiml: `<Response><Say voice="alice">New Amazon warehouse job alert! ${message}</Say></Response>`
    });

    console.log("✅ JOB ALERT sent via Telegram + Phone Call");
  } catch (err) {
    console.error("❌ Error sending job alert:", err.message);
  }
}

// Legacy function for compatibility
async function sendAlert(message) {
  return await sendTelegramAlert(message);
}

module.exports = { sendAlert, sendTelegramAlert, sendJobAlert };
