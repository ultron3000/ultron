const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const TARGET_URL = "https://pandastreams.shop/player/stream-54.php";
const JSON_FILE_PATH = path.join(__dirname, 'channels.json');

async function fetchFreshBrowserToken() {
  console.log("Launching headless automated browser runner...");
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set matching spoofing headers to bypass page security blocks
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    await page.setExtraHTTPHeaders({
      "Referer": "https://pandastreams.shop/"
    });

    console.log(`Navigating to target player canvas page...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Look for the live text link inside the generated scripts
    const extractedUrl = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      const regex = /(https?:\/\/[^\s"'`]+\.m3u8\?md5=[^\s"'`&\\]+&expires=\d+)/i;
      const match = html.match(regex);
      return match ? match[0] : null;
    });

    return extractedUrl;
  } catch (error) {
    console.error("Browser extraction routine crashed:", error);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

async function updateChannelList() {
  const freshUrl = await fetchFreshBrowserToken();
  
  if (!freshUrl) {
    console.log("Process aborted: Fresh active token link could not be parsed via browser runtime.");
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
    // Clean backslashes out of url strings if present
    const cleanUrl = freshUrl.replace(/\\/g, '');
    console.log(`Found channel "FOX FIFA". Prior URL: ${channels[targetIndex].video}`);
    channels[targetIndex].video = cleanUrl;
    console.log(`Updated to fresh stream URL: ${cleanUrl}`);

    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(channels, null, 2), 'utf8');
    console.log("channels.json has been updated successfully.");
  } else {
    console.error('Target channel named "FOX FIFA" was not found in channels.json.');
    process.exit(1);
  }
}

updateChannelList();
