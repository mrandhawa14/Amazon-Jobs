// === CANADIAN AMAZON JOB SEARCH CONFIG ===

// Canadian Amazon job search URL
const SEARCH_URL = "https://hiring.amazon.ca/app#/jobSearch";

// How often to check for new jobs (in milliseconds)
const REFRESH_INTERVAL = 1.5 * 60 * 1000; // 1.5 minutes

// Target postal codes to monitor (Richmond, Delta, Vancouver area)
const TARGET_POSTAL_CODES = [
  "V6V", // Richmond
  "V4G", // Delta  
  "V3X", // Coquitlam
  "V6B", // Vancouver Downtown
  "V5K", // Vancouver East
  "V6A", // Vancouver
  "V7C", // North Vancouver
];

// Location keywords to watch for
const TARGET_LOCATIONS = [
  "Richmond",
  "Delta", 
  "Vancouver",
  "Burnaby",
  "Surrey",
  "Coquitlam",
  "North Vancouver"
];

module.exports = {
  SEARCH_URL,
  REFRESH_INTERVAL,
  CHECK_INTERVAL: REFRESH_INTERVAL, // Alias for consistency
  TARGET_POSTAL_CODES,
  TARGET_LOCATIONS
};
