// scraper.js
const axios = require("axios");
const { sendJobAlert, sendTelegramAlert, sendJobAlertWithScreenshot } = require("./alert");
const config = require("./config");

// GraphQL endpoint
const GRAPHQL_URL = "https://e5mquma77feepi2bdn4d6h3mpu.appsync-api.us-east-1.amazonaws.com/graphql";

// GraphQL payload (with your filters)
const payload = {
  operationName: "searchJobCardsByLocation",
  query: `query searchJobCardsByLocation($searchJobRequest: SearchJobRequest!) {
    searchJobCardsByLocation(searchJobRequest: $searchJobRequest) {
      nextToken
      jobCards {
        jobId
        jobTitle
        employmentType
        city
        locationName
        totalPayRateMin
        totalPayRateMax
      }
    }
  }`,
  variables: {
    searchJobRequest: {
      locale: "en-CA",
      country: "Canada",
      keyWords: "",
      equalFilters: [],
      containFilters: [
        { key: "isPrivateSchedule", val: ["false"] },
        { key: "scheduleShift", val: ["EarlyMorning","Daytime","Evening","Night","Weekday","Weekend"] },
        { key: "jobTitle", val: [
          "Amazon Fulfilment Centre Warehouse Associate",
          "Amazon Sortation Center Warehouse Associate",
          "Amazon Delivery Station Warehouse Associate"
        ]},
        // Add location filtering to GraphQL query (primary filter)
        { key: "city", val: config.TARGET_LOCATIONS }
      ],
      dateFilters: [
        { key: "firstDayOnSite", range: { startDate: "2025-09-01" } }
      ],
      pageSize: 100,
      sorters: [{ fieldName: "totalPayRateMax", ascending: "false" }]
    }
  }
};

// Token storage (you'll need to update this manually when it expires)
let currentToken = process.env.AMAZON_API_TOKEN || "Bearer Status|unauthenticated|Session|eyJhbGciOiJLTVMiLCJ0eXAiOiJKV1QifQ.eyJpYXQiOjE3NTY3MTM5MjAsImV4cCI6MTc1NjcxNzUyMH0.AQICAHidzPmCkg52ERUUfDIMwcDZBDzd+C71CJf6w0t6dq2uqwEODCaeVmQhcMsmUGi60a5GAAAAtDCBsQYJKoZIhvcNAQcGoIGjMIGgAgEAMIGaBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDCwGqBup49tPWjjXegIBEIBtFh3/B62vS74RGoTfb3pk+LiIhxqKzMAsnoc5o6Iq62n7ktkOEXi+W0YJ9cC+WYsNLHiU4KAuP7p3wQQr5jFr4XdP+qo2ueffAlj/OD3f4pWxDFZci8EvMAD4NR/H/8dLDG8lOygv/8E6O8vqWA==";

// Status notification control
const scriptStartTime = Date.now();
let lastStatusUpdate = Date.now();
let totalChecks = 0;
const STATUS_UPDATE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours between status updates

// Token expiration tracking
let tokenExpired = false;
let consecutiveFailures = 0;
let lastTokenExpiryNotification = 0;
const TOKEN_EXPIRY_NOTIFICATION_INTERVAL = 24 * 60 * 60 * 1000; // Only notify once per day when expired

// Job validation function to filter out phantom/corrupt jobs
function isValidJob(job) {
  // Check for required fields
  if (!job.jobId || !job.jobTitle || !job.locationName) {
    return false;
  }
  
  // Check for corrupted pay rates
  if (!job.totalPayRateMin || !job.totalPayRateMax || 
      job.totalPayRateMin > 1000 || job.totalPayRateMax > 1000 || 
      job.totalPayRateMin <= 0 || job.totalPayRateMax <= 0) {
    return false;
  }
  
  // Check for suspicious job IDs (known phantom jobs)
  if (job.jobId === 'JOB-CA-0000000354') {
    return false; // This specific job ID is confirmed phantom
  }
  
  // Check for missing or suspicious location data
  if (!job.city || job.city === 'null' || job.locationName.includes('null')) {
    return false;
  }
  
  // Check for reasonable employment type
  if (job.employmentType && job.employmentType.length > 50) {
    return false; // Unusually long employment type suggests corruption
  }
  
  return true; // Job passes all validation checks
}

// Location filtering function - CRITICAL FIX for NS alerts issue
function isTargetLocation(job) {
  const jobCity = job.city ? job.city.toLowerCase() : '';
  const jobLocation = job.locationName ? job.locationName.toLowerCase() : '';
  
  // Check if job location matches any target location
  for (const targetLocation of config.TARGET_LOCATIONS) {
    const target = targetLocation.toLowerCase();
    if (jobCity.includes(target) || jobLocation.includes(target)) {
      return true;
    }
  }
  
  // Check if job location matches any target postal codes
  for (const postalCode of config.TARGET_POSTAL_CODES) {
    if (jobLocation.includes(postalCode.toLowerCase())) {
      return true;
    }
  }
  
  console.log(`🚫 Job ${job.jobId} filtered out - location '${job.locationName}, ${job.city}' not in target areas`);
  return false;
}

// Headers generator function
function getHeaders() {
  return {
    "content-type": "application/json",
    "authorization": currentToken,
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "origin": "https://hiring.amazon.ca",
    "referer": "https://hiring.amazon.ca/"
  };
}

// Job checker
async function checkJobs() {
  // Skip checks if token is known to be expired
  if (tokenExpired) {
    const currentTime = Date.now();
    // Send daily reminder about expired token
    if (currentTime - lastTokenExpiryNotification >= TOKEN_EXPIRY_NOTIFICATION_INTERVAL) {
      const reminderMsg = `⏸️ Amazon Job Monitor Paused\n\n🔑 **Token Expired**\n• Monitoring stopped to prevent spam\n• Please update AMAZON_API_TOKEN in Railway\n• Will resume automatically when token is updated\n\n📅 Token expired: ${Math.floor(consecutiveFailures / (24 * 60 / 1.5))} days ago\n🔄 Daily reminder (not spam)`;
      await sendTelegramAlert(reminderMsg);
      lastTokenExpiryNotification = currentTime;
    }
    console.log("⏸️ Skipping job check - token expired. Update AMAZON_API_TOKEN to resume.");
    return;
  }

  totalChecks++;
  const currentTime = Date.now();
  
  try {
    const res = await axios.post(GRAPHQL_URL, payload, { headers: getHeaders() });
    const jobs = res.data?.data?.searchJobCardsByLocation?.jobCards || [];

    // Reset failure counter on successful request
    consecutiveFailures = 0;
    
    // If we were previously in expired state, send recovery notification
    if (tokenExpired) {
      tokenExpired = false;
      const recoveryMsg = `✅ Amazon Job Monitor Resumed\n\n🔑 **Token Updated Successfully**\n• Authentication restored\n• Job monitoring resumed\n• System back to normal operation\n\n🔄 Ready to catch new opportunities!`;
      await sendTelegramAlert(recoveryMsg);
    }

    if (jobs.length > 0) {
      let validJobs = 0;
      
      for (const job of jobs) {
        // Validate job data to filter out phantom/corrupt jobs
        if (isValidJob(job)) {
          // CRITICAL: Check if job is in target location (fixes NS alerts bug)
          if (isTargetLocation(job)) {
            const msg = `🚨 ${job.jobTitle} - ${job.locationName} (${job.city})\n💼 Type: ${job.employmentType}\n💰 Pay: $${job.totalPayRateMin}-${job.totalPayRateMax}/hour\n🆔 Job ID: ${job.jobId}\n\n🔗 Apply: https://hiring.amazon.ca/app#/jobDetail/${job.jobId}`;
            console.log(msg);
            await sendJobAlertWithScreenshot(msg, job); // Telegram + Text Summary + Phone alert
            validJobs++;
          } else {
            console.log(`📍 Skipping job outside target area: ${job.jobId} - ${job.locationName}, ${job.city}`);
          }
        } else {
          console.log(`⚠️ Skipping invalid/phantom job: ${job.jobId} - ${job.jobTitle}`);
        }
      }
      
      if (validJobs === 0) {
        console.log(`🛡️ Found ${jobs.length} job(s) but all were invalid/phantom - no alerts sent`);
      }
    } else {
      // Only send status update if 4 hours have passed since last update
      if (currentTime - lastStatusUpdate >= STATUS_UPDATE_INTERVAL) {
        const uptime = Math.floor((currentTime - scriptStartTime) / (60 * 60 * 1000));
        const statusMsg = `📋 Heartbeat Update\n\n✅ Script running normally\n📈 Checks completed: ${totalChecks}\n⏱️ Uptime: ~${uptime}h\n📅 Last check: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Vancouver' })}\n\n🔍 No jobs found in recent checks - monitoring continues...`;
        console.log("Sending periodic status update...");
        await sendTelegramAlert(statusMsg);
        lastStatusUpdate = currentTime;
      } else {
        console.log("No jobs found at this check. (Status update suppressed)");
      }
    }
  } catch (err) {
    consecutiveFailures++;
    
    // Check if this is a token expiration error
    if (err.response?.status === 403 || err.response?.status === 401) {
      console.error("🔑 Authentication failed - token expired");
      
      // Mark token as expired after 2 consecutive auth failures to avoid false positives
      if (consecutiveFailures >= 2 && !tokenExpired) {
        tokenExpired = true;
        lastTokenExpiryNotification = 0; // Reset to send immediate notification
        
        const expirationMsg = `🚨 Amazon Job Monitor - Token Expired\n\n🔑 **Authentication Failed**\n• Amazon API token has expired\n• Job monitoring automatically paused\n• No more error spam - this is the only notification\n\n🔧 **To Fix:**\n1. Visit https://hiring.amazon.ca in browser\n2. Get new session token from network tab\n3. Update AMAZON_API_TOKEN in Railway\n4. System will resume automatically\n\n⏸️ Monitoring paused until token updated`;
        await sendTelegramAlert(expirationMsg);
        
        console.error("⏸️ TOKEN EXPIRED - Pausing job checks. Update AMAZON_API_TOKEN to resume.");
        return; // Don't send regular error notification
      }
    } else {
      // Reset consecutive failures for non-auth errors
      consecutiveFailures = 0;
    }
    
    // Send regular error notification for non-expiration errors or first failure
    if (!tokenExpired) {
      const errorMsg = `❌ Error in Amazon Job Monitor\n\n📁 Details: ${err.message}\n📊 Status Code: ${err.response?.status}\n⏰ Time: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Vancouver' })}`;
      await sendTelegramAlert(errorMsg);
    }
    
    console.error("❌ Error fetching jobs:", err.message);
    console.error("📊 Status:", err.response?.status);
    console.error("📋 Response:", err.response?.data);
  }
}

// Send startup notification
async function sendStartupNotification() {
  try {
    const startupMsg = `✅ Amazon Job Monitor Running Smoothly\n\n📊 **System Status:**\n• Check interval: ${config.CHECK_INTERVAL / 1000}s\n• Monitoring: Richmond, Delta, Vancouver area\n• Job types: Any employment type\n• Platform: Railway (auto-restart enabled)\n\n⏰ Last refresh: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Vancouver' })}`;
    await sendTelegramAlert(startupMsg);
  } catch (err) {
    console.log("Startup notification failed, but continuing...", err.message);
  }
}

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Don't exit, keep running
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  // Don't exit, keep running
});

// Run continuously
console.log(`⏳ Starting Amazon job watcher (interval: ${config.CHECK_INTERVAL / 1000}s)...`);
sendStartupNotification();
setInterval(checkJobs, config.CHECK_INTERVAL);

// First run immediately  
checkJobs();
