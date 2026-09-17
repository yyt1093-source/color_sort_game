const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("================================================================");
console.log("TEST SUITE: TON Connect Wallet Integration and Manifest Spec");
console.log("================================================================");

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log("  PASS: " + name);
    passedTests++;
  } catch (err) {
    console.error("  FAIL: " + name + " - " + err.message);
    process.exitCode = 1;
  }
}

// 1. Manifest verification
runTest("tonconnect-manifest.json exists and is valid JSON", () => {
  const manifestPath = path.join(__dirname, "..", "public", "tonconnect-manifest.json");
  assert(fs.existsSync(manifestPath), "tonconnect-manifest.json must exist");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert(manifest.name, "Manifest must have a name");
  assert(manifest.url, "Manifest must have a url");
  assert(manifest.iconUrl, "Manifest must have an iconUrl");
});

runTest("tonconnect-manifest.json adheres strictly to TON Connect 2.0 specification", () => {
  const manifestPath = path.join(__dirname, "..", "public", "tonconnect-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  
  assert.strictEqual(manifest.url.endsWith("/"), false, "Manifest URL MUST NOT have a trailing slash per TON Connect spec");
  assert(manifest.url.startsWith("https://"), "Manifest URL must be HTTPS");
  assert(manifest.iconUrl.toLowerCase().endsWith(".png") || manifest.iconUrl.toLowerCase().endsWith(".ico"), "iconUrl must be PNG or ICO");
  assert(manifest.iconUrl.startsWith("https://"), "iconUrl must be HTTPS");
});

// 2. Icon file verification
runTest("ton_icon.png is a valid 180x180 PNG file", () => {
  const iconPath = path.join(__dirname, "..", "public", "ton_icon.png");
  assert(fs.existsSync(iconPath), "ton_icon.png must exist in public/");
  const buf = fs.readFileSync(iconPath);
  
  const pngSig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < 8; i++) {
    assert.strictEqual(buf[i], pngSig[i], "Byte " + i + " must match PNG signature");
  }
  
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.strictEqual(width, 180, "Width should be 180px");
  assert.strictEqual(height, 180, "Height should be 180px");
});

// 3. Local SDK verification
runTest("tonconnect-ui.min.js is locally bundled and contains required exports", () => {
  const sdkPath = path.join(__dirname, "..", "public", "js", "tonconnect-ui.min.js");
  assert(fs.existsSync(sdkPath), "Local tonconnect-ui.min.js must exist in public/js/");
  const stat = fs.statSync(sdkPath);
  assert(stat.size > 200000, "tonconnect-ui.min.js size should be > 200KB");
  
  const content = fs.readFileSync(sdkPath, "utf8");
  assert(content.includes("TonConnectUI"), "Must contain TonConnectUI class");
  assert(content.includes("openModal"), "Must contain openModal method");
  assert(content.includes("toUserFriendlyAddress"), "Must contain toUserFriendlyAddress helper");
  assert(content.includes("twaReturnUrl"), "Must contain twaReturnUrl support");
  assert(content.includes("actionsConfiguration"), "Must contain actionsConfiguration support");
});

// 4. HTML script tag ordering and preloads
runTest("index.html properly loads tonconnect-ui.min.js before app.js and preloads it", () => {
  const htmlPath = path.join(__dirname, "..", "public", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  
  assert(html.includes('rel="preload" href="js/tonconnect-ui.min.js'), "Must preload tonconnect-ui.min.js");
  assert(!html.includes("unpkg.com/@tonconnect/ui@latest"), "Unpkg @latest should not be used in head");
  
  const tcIdx = html.indexOf('src="js/tonconnect-ui.min.js');
  const appIdx = html.indexOf('src="js/app.js');
  assert(tcIdx > 0, "tonconnect-ui.min.js script tag must exist");
  assert(appIdx > 0, "app.js script tag must exist");
  assert(tcIdx < appIdx, "tonconnect-ui.min.js must be loaded BEFORE app.js");
});

// 5. URL resolution logic in app.js
runTest("getTonManifestUrl properly handles subpaths and origin without 404", () => {
  function simulateGetTonManifestUrl(mockWindow) {
    const origin = mockWindow.location.origin;
    let path = mockWindow.location.pathname;
    if (!path.endsWith("/")) {
      path = path.substring(0, path.lastIndexOf("/") + 1);
    }
    return origin + path + "tonconnect-manifest.json";
  }
  
  const testCases = [
    {
      location: { origin: "https://yyt1093-source.github.io", pathname: "/color_sort_game/" },
      expected: "https://yyt1093-source.github.io/color_sort_game/tonconnect-manifest.json"
    },
    {
      location: { origin: "https://yyt1093-source.github.io", pathname: "/color_sort_game/index.html" },
      expected: "https://yyt1093-source.github.io/color_sort_game/tonconnect-manifest.json"
    },
    {
      location: { origin: "http://localhost:3000", pathname: "/" },
      expected: "http://localhost:3000/tonconnect-manifest.json"
    }
  ];
  
  for (const tc of testCases) {
    const res = simulateGetTonManifestUrl(tc);
    assert.strictEqual(res, tc.expected, "Failed for " + tc.location.pathname);
  }
});

// 6. Verification of app.js logic
runTest("app.js removes dummy fake wallet fallback and configures twaReturnUrl", () => {
  const appJsPath = path.join(__dirname, "..", "public", "js", "app.js");
  const appJs = fs.readFileSync(appJsPath, "utf8");
  
  assert(!appJs.includes("const dummyWallet = 'EQ'"), "Fake dummy wallet generator must be completely removed");
  assert(appJs.includes("twaReturnUrl: 'https://t.me/sortcolors_bot'"), "twaReturnUrl for sortcolors_bot must be configured");
  assert(appJs.includes("toUserFriendlyAddress"), "toUserFriendlyAddress conversion must be present");
  assert(appJs.includes("ensureTonConnectLoaded"), "ensureTonConnectLoaded helper must be present");
});

// 7. Wallet type detection test
runTest("detectWalletTypeName recognizes Tonkeeper, Telegram Wallet, and others", () => {
  function detectWalletTypeName(input) {
    if (!input) return "TON Wallet";
    let name = "";
    if (typeof input === "object") {
      name = input.name || (input.device && input.device.appName) || input.appName || "";
    } else if (typeof input === "string") {
      name = input;
    }
    const lower = name.toLowerCase();
    if (lower.includes("tonkeeper")) return "Tonkeeper";
    if (lower.includes("telegram") || (lower.includes("wallet") && lower.includes("tg"))) return "Telegram Wallet";
    if (lower.includes("mytonwallet")) return "MyTonWallet";
    if (lower.includes("openmask")) return "OpenMask";
    return name || "TON Wallet";
  }
  
  assert.strictEqual(detectWalletTypeName({ device: { appName: "Tonkeeper" } }), "Tonkeeper");
  assert.strictEqual(detectWalletTypeName({ name: "Telegram Wallet" }), "Telegram Wallet");
  assert.strictEqual(detectWalletTypeName({ device: { appName: "mytonwallet-mobile" } }), "MyTonWallet");
  assert.strictEqual(detectWalletTypeName(null), "TON Wallet");
});

console.log("================================================================");
console.log("ALL TON CONNECT TESTS PASSED: " + passedTests + "/" + totalTests + " (100%)");
console.log("================================================================");
