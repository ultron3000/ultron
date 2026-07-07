const fs = require('fs');
const path = require('path');

// Utilizing a public CORS/impersonation proxy to bypass the data-center challenge page
const TARGET_URL = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://pandastreams.shop/player/stream-54.php");
const JSON_FILE_PATH = path.join(__dirname, 'channels.json');

async function fetchFreshTokenLink() {
  try {
    console.log("Requesting page context via proxy bypass engine...");
    
    const response = await fetch(TARGET_URL, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) throw new Error(`Server returned HTTP Status Code: ${response.status}`);
    const htmlText = await response.text();

    // Look for patterns where the token configuration strings are defined inside script tags
    const pattern = /(https?:\/\/[^\s"'`<>]+?\.m3u8\?md5=[^\s"'`<>&\\]+&expires=\d+)/i;
    let match = htmlText.match(pattern);

    if (!match) {
      console.log("Primary pattern failed. Checking for multi-line configurations...");
      // Flexible fallback matching line targeting alternative premium stream paths
      const flexiblePattern = /(https?:\/\/[^\s"'`<>]+?\/premium54\/[^\s"'<>]+?\.m3u8[^"'\s<>]*)/i;
      match = htmlText.match(flexiblePattern);
    }

    if (match && match[1]) {
      let finalUrl = match[1].replace(/\\/g, ''); // Clear escaping markers
      return finalUrl;
    }

    // Try extracting via token splits if hidden as variable parameters
    const md5Match = htmlText.match(/md5\s*=\s*["']([^"']+)["']/);
    const expiresMatch = htmlText.match(/expires\s*=\s*["']?(\d+)["']?/);
    if (md5Match && expiresMatch) {
      const rebuiltUrl = `https://vomos.phantemlis.top/premium54/tracks-v1a1/mono.m3u8?md5=${md5Match[1]}&expires=${expiresMatch[1]}`;
      return rebuiltUrl;
    }

    console.error("The streaming link was obscured, or the page response structure was altered.");
    return null;

  } catch (error) {
    console.error("Collection request failed:", error);
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
    console.log(`Found channel "FOX FIFA". Prior URL: ${channels[targetIndex].video}`);
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
