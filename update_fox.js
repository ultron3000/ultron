const fs = require('fs');
const path = require('path');

const TARGET_URL = "https://pandastreams.shop/player/stream-54.php";
const JSON_FILE_PATH = path.join(__dirname, 'channels.json');

async function fetchFreshTokenLink() {
  try {
    console.log("Requesting page context via clean browser impersonation layer...");
    
    // We fetch the player source using headers designed to avoid bot-flagging thresholds
    const response = await fetch(TARGET_URL, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://pandastreams.shop/",
        "Cache-Control": "max-age=0"
      }
    });

    if (!response.ok) throw new Error(`Server returned HTTP Status Code: ${response.status}`);
    const htmlText = await response.text();

    // Look for patterns where the token configuration string variables are set inside the script segments
    // Even if hidden or split, standard parameters appear inline in clear text patterns
    const pattern = /["'](https?:\/\/[^"'\s<>]+?\.m3u8\?md5=[^"'\s<>&\\]+&expires=\d+)["']/i;
    let match = htmlText.match(pattern);

    if (!match) {
      // Secondary flexible matching block checking for variations in streaming endpoints
      const flexiblePattern = /(https?:\/\/[^"'\s<>]+?\/premium54\/[^"'\s<>]+?\.m3u8[^"'\s<>]*)/i;
      match = htmlText.match(flexiblePattern);
    }

    if (match && match[1]) {
      let finalUrl = match[1].replace(/\\/g, ''); // Clear any backslash escape notation
      return finalUrl;
    }

    console.error("The link parameters were obscured or blocked by an anti-bot challenge page.");
    return null;

  } catch (error) {
    console.error("Network collection request failed:", error);
    return null;
  }
}

async function updateChannelList() {
  const freshUrl = await fetchFreshTokenLink();
  
  if (!freshUrl) {
    console.log("Process aborted: Fresh active token link could not be captured.");
    process.exit(1);
  }

  if (!fs.existsSync(JSON_FILE_PATH)) {
    console.error(`Error: ${JSON_FILE_PATH} not found.`);
    process.exit(1);
  }

  let channels = [];
  try {
    const rawData = fs.readFileSync(JSON_FILE_PATH, 'utf8');
    channels = JSON.parse(rawData);
  } catch (err) {
    console.error("Failed to parse channels.json safely:", err);
    process.exit(1);
  }

  const targetIndex = channels.findIndex(item => item.title === "FOX FIFA");

  if (targetIndex !== -1) {
    console.log(`Found channel "FOX FIFA". Modifying stream reference target...`);
    channels[targetIndex].video = freshUrl;
    console.log(`Updated to fresh stream URL: ${freshUrl}`);

    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(channels, null, 2), 'utf8');
    console.log("channels.json has been updated successfully.");
  } else {
    console.error('Target channel named "FOX FIFA" was not found in channels.json.');
    process.exit(1);
  }
}

updateChannelList();
