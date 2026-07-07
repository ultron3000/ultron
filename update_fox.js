const fs = require('fs');
const path = require('path');

const TARGET_URL = "https://pandastreams.shop/player/stream-54.php";
const JSON_FILE_PATH = path.join(__dirname, 'channels.json');

async function fetchFreshTokenLink() {
  try {
    console.log("Fetching live webpage to extract fresh tokens...");
    const response = await fetch(TARGET_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://pandastreams.shop/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
      }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const htmlText = await response.text();
    
    // Broad search pattern to find the .m3u8 configuration regardless of domain adjustments
    const broadRegex = /(https?:\/\/[^\s"'`]+\.m3u8\?md5=[^\s"'`&\\]+&expires=\d+)/i;
    let match = htmlText.match(broadRegex);
    
    // Fallback parser if the URL is broken into separate layout variables inside the script block
    if (!match) {
      console.log("Broad match failed. Attempting script variable parameter extraction...");
      const md5Match = htmlText.match(/md5\s*=\s*["']([^"']+)["']/);
      const expiresMatch = htmlText.match(/expires\s*=\s*["']?(\d+)["']?/);
      const hostMatch = htmlText.match(/(https?:\/\/[a-z0-9.-]+\/premium54\/[^\s"'\n]+)/);
      
      if (md5Match && expiresMatch && hostMatch) {
        let baseStream = hostMatch[1].split('?')[0];
        if (!baseStream.endsWith('mono.m3u8') && !baseStream.endsWith('.m3u8')) {
          baseStream = baseStream.replace(/\/$/, '') + '/mono.m3u8';
        }
        const rebuiltUrl = `${baseStream}?md5=${md5Match[1]}&expires=${expiresMatch[1]}`;
        return rebuiltUrl;
      }
    }

    if (match && match[0]) {
      // Remove any escaping backslashes inserted by character encoders
      return match[0].replace(/\\/g, '');
    } else {
      console.error("Could not find the streaming URL pattern inside the HTML source code.");
      return null;
    }
  } catch (error) {
    console.error("Failed fetching or parsing the live token:", error);
    return null;
  }
}

async function updateChannelList() {
  const freshUrl = await fetchFreshTokenLink();
  if (!freshUrl) {
    console.log("Process aborted: Fresh URL was not retrieved.");
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
    console.log(`Updated to new stream URL: ${freshUrl}`);

    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(channels, null, 2), 'utf8');
    console.log("channels.json has been updated successfully.");
  } else {
    console.error('Target channel named "FOX FIFA" was not found in channels.json.');
    process.exit(1);
  }
}

updateChannelList();
