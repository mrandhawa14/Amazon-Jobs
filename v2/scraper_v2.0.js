const axios = require("axios");
const { sendJobAlertDedup, sendTelegramAlert } = require("./alert");
const config = require("./config");

// GraphQL endpoint
const GRAPHQL_URL = "https://e5mquma77feepi2bdn4d6h3mpu.appsync-api.us-east-1.amazonaws.com/graphql";

// Token storage (update manually when expired)
let currentToken = process.env.AMAZON_API_TOKEN || "";

// Job state
const sentJobs = new Set();
let tokenExpired = false;
let consecutiveFailures = 0;
let lastStatusUpdate = Date.now();
const STATUS_UPDATE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

// --- Job validation ---
function isValidJob(job) {
  if (!job.jobId || !job.jobTitle || !job.locationName) return false;
  if (!job.totalPayRateMin || !job.totalPayRateMax ||
      job.totalPayRateMin > 1000 || job.totalPayRateMax > 1000 ||
      job.totalPayRateMin <= 0 || job.totalPayRateMax <= 0) return false;
  if (!job.city || job.city === 'null' || job.locationName.includes('null')) return false;
  if (job.employmentType && job.employmentType.length > 50) return false;
  return true;
}

// --- Location filtering ---
function isTargetLocation(job) {
  const jobCity = job.city ? job.city.toLowerCase() : '';
  const jobLocation = job.locationName ? job.locationName.toLowerCase() : '';

  for (const target of config.TARGET_LOCATIONS) {
    if (jobCity.includes(target.toLowerCase()) || jobLocation.includes(target.toLowerCase())) {
      return true;
    }
  }

  for (const postal of config.TARGET_POSTAL_CODES) {
    if (jobLocation.includes(postal.toLowerCase())) return true;
  }

  return false;
}

// --- GraphQL payload generator ---
function getPayload() {
  return {
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
          { key: "jobTitle", val: config.TARGET_JOB_TITLES },
          { key: "city", val: config.TARGET_LOCATIONS }
        ],
        dateFilters: [{ key: "firstDayOnSite", range: { startDate: "2025-09-01" } }],
        pageSize: 100,
        sorters: [{ fieldName: "totalPayRateMax", ascending: "false" }]
      }
    }
  };
}

// --- Headers generator ---
function getHeaders() {
  return {
    "content-type": "application/json",
    "authorization": currentToken,
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "origin": "https://hiring.amazon.ca",
    "referer": "https://hiring.amazon.ca/"
  };
}

// --- Check jobs ---
async function checkJobs() {
  if (tokenExpired) return;

  try {
    const res = await axios.post(GRAPHQL_URL, getPayload(), { headers: getHeaders() });
    const jobs = res.data?.data?.searchJobCardsByLocation?.jobCards || [];
    consecutiveFailures = 0;

    for (const job of jobs) {
      if (isValidJob(job) && isTargetLocation(job)) {
        const msg = `📋 POSITION: ${job.jobTitle}\n🏢 ${job.locationName}, ${job.city}\n💰 $${job.totalPayRateMin}-${job.totalPayRateMax}/hour\n🔗 Apply: https://hiring.amazon.ca/app#/jobDetail?jobId=${job.jobId}`;
        await sendJobAlertDedup(msg, job.jobId);
      }
    }

    // Status update
    const now = Date.now();
    if (now - lastStatusUpdate >= STATUS_UPDATE_INTERVAL) {
      await sendTelegramAlert(`📊 Heartbeat: Checked ${jobs.length} jobs. Monitoring continues...`);
      lastStatusUpdate = now;
    }

  } catch (err) {
    consecutiveFailures++;
    console.error("Error fetching jobs:", err.message);
    if (err.response?.status === 401 || err.response?.status === 403) {
      tokenExpired = true;
      await sendTelegramAlert("🚨 Amazon API token expired. Update AMAZON_API_TOKEN to resume monitoring.");
    }
  }
}

// --- Startup notification ---
async function sendStartupNotification() {
  await sendTelegramAlert(`✅ Amazon Job Monitor Started. Checking every ${config.CHECK_INTERVAL / 1000}s`);
}

// --- Run continuously ---
sendStartupNotification();
setInterval(checkJobs, config.CHECK_INTERVAL);
checkJobs();