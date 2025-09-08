// === CANADIAN AMAZON JOB SEARCH CONFIG ===

// Canadian Amazon job search URL
const SEARCH_URL = "https://hiring.amazon.ca/app#/jobSearch";

// How often to check for new jobs (in milliseconds)
const REFRESH_INTERVAL = 1.5 * 60 * 1000; // 1.5 minutes

// Target postal codes to monitor (Vancouver area: Richmond, Delta, Vancouver, Burnaby, Surrey, Coquitlam, Langley, Pitt Meadows)
const TARGET_POSTAL_CODES = [
  "V6V", // Richmond
  "V6X", // Richmond West
  "V4G", // Delta
  "V4C", // Delta North
  "V3X", // Coquitlam
  "V3K", // Coquitlam East
  "V6B", // Vancouver Downtown
  "V5K", // Vancouver East
  "V6A", // Vancouver West
  "V7C", // North Vancouver
  "V3Y", // Burnaby South
  "V5A", // Burnaby North
  "V3N", // Surrey North
  "V3R", // Surrey East
  "V2Y", // Langley
  "V3W", // Pitt Meadows
];

// Location keywords to watch for
const TARGET_LOCATIONS = [
  "Richmond",
  "Delta", 
  "Vancouver",
  "Burnaby",
  "Surrey",
  "Coquitlam",
  "North Vancouver",
  "Langley",
  "Pitt Meadows"
];

module.exports = {
  SEARCH_URL,
  REFRESH_INTERVAL,
  CHECK_INTERVAL: REFRESH_INTERVAL, // Alias for consistency
  TARGET_POSTAL_CODES,
  TARGET_LOCATIONS
};