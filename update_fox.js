const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const TARGET_URL = "https://pandastreams.shop/player/stream-54.php";
const JSON_FILE_PATH = path.join(__dirname, 'channels.json');

async function fetchStreamViaNetworkInterception() {
  console.log("Launching headless automated browser runner...");
  let browser;
  let targetM3u8Url = null;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set matching spoofing headers to bypass security walls
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    await page.setExtraHTTPHeaders({
      "Referer": "https://pandastreams.shop/"
    });

    // CRITICAL: Enable request interception to listen to the network traffic
    await page.setRequestInterception(true);

    page.on('request', interceptedRequest => {
      const url = interceptedRequest.url();
      
      // Look for any request going to a .m3u8 file that contains the md5 token
      if (url.includes('.m3u8') && url.includes('md5=') && url.includes('expires=')) {
        console.log(`🎯 Successfully intercepted target stream link from network!`);
        targetM3u8Url = url;
      }
      
      // Always allow the request to continue loading normally
      interceptedRequest.continue();
    });

    console.log(`Navigating to target player canvas page...`);
    // Wait up to 30 seconds for network activity to go idle so streams can load
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 30000 });

    // Give it an extra 5 seconds just in case the player delays initializing
    if (!targetM3u8Url) {
      console.log("Stream not caught instantly. Waiting a few seconds for player playback initialization...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return targetM3u8Url;

  } catch (error) {
    console.error("Browser network interception routine crashed:", error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
      console.log("Browser instance closed.");
    }
  }
}

async function updateChannelList() {
  const freshUrl = await fetchStreamViaNetworkInterception();
  
  if (!freshUrl) {
    console.log("Process aborted: Fresh active token link could not be captured from the network layer.");
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
    console.log(`Updated to fresh intercepted stream URL: ${freshUrl}`);

    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(channels, null, 2), 'utf8');
    console.log("channels.json has been updated successfully.");
  } else {
    console.error('Target channel named "FOX FIFA" was not found in channels.json.');
    process.exit(1);
  }
}

updateChannelList();
