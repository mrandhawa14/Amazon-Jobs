const axios = require("axios");
const twilio = require("twilio");
const { chromium } = require('playwright');
const fs = require('fs');
const FormData = require('form-data');
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

// === ALERT FUNCTIONS ===

// Send Telegram message to STATUS channel (for status updates)
async function sendTelegramAlert(message) {
  try {
    // Validate required variables
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
    // Don't throw - just log and continue
  }
}

// Send both Telegram to JOBS channel + Phone call (for actual job alerts)
async function sendJobAlert(message) {
  try {
    // Validate required variables
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID_JOBS) {
      console.log("⚠️ Missing Telegram config, skipping job alert");
      return;
    }
    
    // 1. Telegram message to JOBS channel
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID_JOBS,
      text: `🚨 Amazon Job Alert 🚨\n${message}`,
      parse_mode: "Markdown"
    });

    // 2. Twilio voice call (temporarily disabled for debugging)
    console.log("Phone call would be made here:", YOUR_NUMBER);
    // await client.calls.create({
    //   to: YOUR_NUMBER,
    //   from: TWILIO_NUMBER,
    //   twiml: `<Response><Say voice="alice">New Amazon warehouse job alert! ${message}</Say></Response>`
    // });

    console.log("✅ JOB ALERT sent to Jobs channel + Phone Call");
  } catch (err) {
    console.error("❌ Error sending job alert:", err.message);
    // Don't throw - just log and continue
  }
}

// Take screenshot of job posting
async function takeJobScreenshot(jobId) {
  let browser;
  try {
    console.log(`📸 Taking screenshot for job ${jobId}`);
    
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Railway compatibility
    });
    
    const page = await browser.newPage();
    const jobUrl = `https://hiring.amazon.ca/app#/jobDetail/${jobId}`;
    
    await page.goto(jobUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000); // Wait for dynamic content
    
    const screenshot = await page.screenshot({ 
      path: `job-${jobId}.png`,
      fullPage: true,
      type: 'png'
    });
    
    console.log(`✅ Screenshot saved: job-${jobId}.png`);
    return `job-${jobId}.png`;
    
  } catch (err) {
    console.error(`❌ Screenshot failed for job ${jobId}:`, err.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Send job alert with screenshot
async function sendJobAlertWithScreenshot(message, jobId) {
  try {
    // Validate required variables
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID_JOBS) {
      console.log("⚠️ Missing Telegram config, skipping job alert");
      return;
    }
    
    // 1. Send text message first
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID_JOBS,
      text: `🚨 Amazon Job Alert 🚨\n${message}`,
      parse_mode: "Markdown"
    });
    
    // 2. Take and send screenshot
    const screenshotPath = await takeJobScreenshot(jobId);
    
    if (screenshotPath && fs.existsSync(screenshotPath)) {
      const formData = new FormData();
      formData.append('chat_id', TELEGRAM_CHAT_ID_JOBS);
      formData.append('photo', fs.createReadStream(screenshotPath));
      formData.append('caption', `📸 Job Posting Screenshot - ${jobId}`);
      
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, formData, {
        headers: formData.getHeaders()
      });
      
      // Clean up screenshot file
      fs.unlinkSync(screenshotPath);
      console.log(`✅ Screenshot sent and cleaned up: ${screenshotPath}`);
    }
    
    // 3. Twilio voice call (temporarily disabled)
    console.log("Phone call would be made here:", YOUR_NUMBER);
    
    console.log("✅ JOB ALERT with screenshot sent to Jobs channel");
    
  } catch (err) {
    console.error("❌ Error sending job alert with screenshot:", err.message);
    // Don't throw - just log and continue
  }
}

// Legacy function for compatibility
async function sendAlert(message) {
  return await sendTelegramAlert(message);
}

module.exports = { sendAlert, sendTelegramAlert, sendJobAlert, sendJobAlertWithScreenshot };
