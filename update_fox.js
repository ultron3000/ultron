const fs = require('fs');
const path = require('path');

// Target source URL containing the tokenized streaming link
const TARGET_URL = "https://pandastreams.shop/player/stream-54.php";
const JSON_FILE_PATH = path.join(__dirname, 'channels.json');

async function fetchFreshTokenLink() {
  try {
    console.log("Fetching live webpage to extract fresh tokens...");
    const response = await fetch(TARGET_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://pandastreams.shop/"
      }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const htmlText = await response.text();
    
    // Regular expression targeting the specific .m3u8 link pattern with its md5 and expires signatures
    const regex = /(https:\/\/vomos\.phantemlis\.top\/premium54\/[^\s"\']+mono\.m3u8\?md5=[^&"\']+\&expires=\d+)/;
    const match = htmlText.match(regex);
    
    if (match && match[0]) {
      return match[0];
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

  // Verify the channels.json file exists
  if (!fs.existsSync(JSON_FILE_PATH)) {
    console.error(`Error: ${JSON_FILE_PATH} not found in root directory.`);
    process.exit(1);
  }

  // Read and parse the existing channels list safely
  let channels = [];
  try {
    const rawData = fs.readFileSync(JSON_FILE_PATH, 'utf8');
    channels = JSON.parse(rawData);
  } catch (err) {
    console.error("Failed to parse channels.json safely:", err);
    process.exit(1);
  }

  // Locate the target channel object named "FOX FIFA"
  const targetIndex = channels.findIndex(item => item.title === "FOX FIFA");

  if (targetIndex !== -1) {
    // Modify ONLY the video link of the target channel
    console.log(`Found channel "FOX FIFA". Updating stream URL...`);
    channels[targetIndex].video = freshUrl;

    // Write back the updated array to channels.json with clean formatting
    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(channels, null, 2), 'utf8');
    console.log("channels.json has been updated successfully.");
  } else {
    console.error('Target channel named "FOX FIFA" was not found in channels.json.');
    console.log('Please verify that the "title" parameter in your JSON file matches "FOX FIFA" exactly.');
    process.exit(1);
  }
}

updateChannelList();
