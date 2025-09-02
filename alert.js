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

// Generate text-based job summary (no browser automation)
async function generateJobSummary(job) {
  try {
    console.log(`📝 Generating text summary for job ${job.jobId}`);
    
    // Extract job details from API response (no browser needed)
    const summary = `
============================================
🔎 AMAZON JOB DETAILS
============================================

📋 POSITION INFORMATION:
• Title: ${job.jobTitle}
• Type: ${job.employmentType || 'Not specified'}
• Location: ${job.locationName}, ${job.city || 'Unknown'}
• Job ID: ${job.jobId}

💰 COMPENSATION:
• Pay Rate: $${job.totalPayRateMin}-${job.totalPayRateMax}/hour

🔗 APPLICATION:
• Apply directly: https://hiring.amazon.ca/app#/jobDetail/${job.jobId}
• Application deadline: Typically 24-48 hours from posting

⚠️ NOTE: Amazon jobs often disappear quickly.
• Apply immediately for best chances
• Have resume ready before clicking link
• Complete application in one session
============================================`;
    
    console.log(`✅ Text summary generated for ${job.jobId}`);
    return summary;
  } catch (err) {
    console.error(`❌ Summary generation failed for job ${job.jobId}:`, err.message);
    return `Failed to generate summary for job ${job.jobId}. Please check the job details manually.`;
  }
}

// Send job alert with detailed text summary (no browser automation)
async function sendJobAlertWithSummary(message, job) {
  try {
    // Validate required variables
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID_JOBS) {
      console.log("⚠️ Missing Telegram config, skipping job alert");
      return;
    }
    
    // 1. Send compact job alert first
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID_JOBS,
      text: `🚨 Amazon Job Alert 🚨\n${message}`,
      parse_mode: "Markdown"
    });
    
    // 2. Generate and send detailed text summary 
    const jobSummary = await generateJobSummary(job);
    
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID_JOBS,
      text: jobSummary,
      parse_mode: "Markdown"
    });
    
    // 3. Twilio voice call (temporarily disabled)
    console.log("Phone call would be made here:", YOUR_NUMBER);
    
    console.log("✅ JOB ALERT with detailed summary sent to Jobs channel");
    
  } catch (err) {
    console.error("❌ Error sending job alert with summary:", err.message);
    // Don't throw - just log and continue
  }
}

// Keep old function name for compatibility but remove screenshot functionality
async function sendJobAlertWithScreenshot(message, job) {
  return await sendJobAlertWithSummary(message, job);
}

// Legacy function for compatibility
async function sendAlert(message) {
  return await sendTelegramAlert(message);
}

module.exports = { sendAlert, sendTelegramAlert, sendJobAlert, sendJobAlertWithScreenshot };
