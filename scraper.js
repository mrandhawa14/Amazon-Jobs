// scraper.js
const axios = require("axios");
const { sendJobAlert, sendTelegramAlert } = require("./alert");
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
        ]}
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
let lastStatusUpdate = Date.now();
let totalChecks = 0;
const STATUS_UPDATE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours between status updates

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
  totalChecks++;
  const currentTime = Date.now();
  
  try {
    const res = await axios.post(GRAPHQL_URL, payload, { headers: getHeaders() });
    const jobs = res.data?.data?.searchJobCardsByLocation?.jobCards || [];

    if (jobs.length > 0) {
      for (const job of jobs) {
        const msg = `🚨 ${job.jobTitle} - ${job.locationName} (${job.city})\n💼 Type: ${job.employmentType}\n💰 Pay: $${job.totalPayRateMin}-${job.totalPayRateMax}`;
        console.log(msg);
        await sendJobAlert(msg); // Telegram + Phone alert for jobs
      }
    } else {
      // Only send status update if 4 hours have passed since last update
      if (currentTime - lastStatusUpdate >= STATUS_UPDATE_INTERVAL) {
        const uptime = Math.floor((currentTime - Date.now() + (totalChecks * config.CHECK_INTERVAL)) / (60 * 60 * 1000));
        const statusMsg = `📋 Heartbeat Update\n\n✅ Script running normally\n📈 Checks completed: ${totalChecks}\n⏱️ Uptime: ~${uptime}h\n📅 Last check: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Vancouver' })}\n\n🔍 No jobs found in recent checks - monitoring continues...`;
        console.log("Sending periodic status update...");
        await sendTelegramAlert(statusMsg);
        lastStatusUpdate = currentTime;
      } else {
        console.log("No jobs found at this check. (Status update suppressed)");
      }
    }
  } catch (err) {
    // Always send error notifications immediately
    const errorMsg = `❌ Error in Amazon Job Monitor\n\n📁 Details: ${err.message}\n📊 Status Code: ${err.response?.status}\n⏰ Time: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Vancouver' })}`;
    await sendTelegramAlert(errorMsg);
    
    if (err.response?.status === 403 || err.response?.status === 401) {
      console.error("🔑 Authentication failed - token may be expired");
      console.error("💡 To fix: Visit https://hiring.amazon.ca in browser, get new session token from network tab");
    }
    console.error("❌ Error fetching jobs:", err.message);
    console.error("📊 Status:", err.response?.status);
    console.error("📋 Response:", err.response?.data);
  }
}

// Send startup notification
async function sendStartupNotification() {
  const startupMsg = `🟢 Amazon Job Monitor Started\n\n📊 **Configuration:**\n• Check interval: ${config.CHECK_INTERVAL / 1000}s\n• Monitoring: Richmond, Delta, Vancouver area\n• Job types: Any employment type\n\n⏰ Started at: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Vancouver' })}`;
  await sendTelegramAlert(startupMsg);
}

// Run continuously
console.log(`⏳ Starting Amazon job watcher (interval: ${config.CHECK_INTERVAL / 1000}s)...`);
sendStartupNotification();
setInterval(checkJobs, config.CHECK_INTERVAL);

// First run immediately
checkJobs();
