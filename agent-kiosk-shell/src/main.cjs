const path = require("path");
const { pathToFileURL } = require("url");
const { app, BrowserWindow, screen, session } = require("electron");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("disable-renderer-backgrounding");

const MEDIA_PERMISSIONS = new Set([
  "media",
  "microphone",
  "camera",
  "fullscreen",
  "display-capture",
]);

function printUsageAndExit(message) {
  if (message) {
    console.error(message);
    console.error("");
  }

  console.error(
    "Usage: electron . --target-url=<http(s)://host[:port][/path][?query]> [--display-number=<1-based-index> | --display-id=<id>]",
  );
  process.exit(1);
}

function readArgumentValue(argv, index) {
  const current = argv[index];
  const next = argv[index + 1];

  if (!next || next.startsWith("--")) {
    printUsageAndExit(`Missing value for ${current}`);
  }

  return next;
}

function parseCliOptions(argv) {
  let rawTargetUrl = "";
  let rawDisplayId = null;
  let rawDisplayNumber = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--target-url") {
      rawTargetUrl = readArgumentValue(argv, index);
      index += 1;
      continue;
    }

    if (arg.startsWith("--target-url=")) {
      rawTargetUrl = arg.slice("--target-url=".length);
      continue;
    }

    if (arg === "--display-id") {
      rawDisplayId = readArgumentValue(argv, index);
      index += 1;
      continue;
    }

    if (arg.startsWith("--display-id=")) {
      rawDisplayId = arg.slice("--display-id=".length);
      continue;
    }

    if (arg === "--display-number") {
      rawDisplayNumber = readArgumentValue(argv, index);
      index += 1;
      continue;
    }

    if (arg.startsWith("--display-number=")) {
      rawDisplayNumber = arg.slice("--display-number=".length);
    }
  }

  if (!rawTargetUrl) {
    printUsageAndExit("Missing required --target-url option.");
  }

  let targetUrl;

  try {
    targetUrl = new URL(rawTargetUrl);
  } catch {
    printUsageAndExit(`Invalid target URL: ${rawTargetUrl}`);
  }

  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    printUsageAndExit(`Unsupported target URL protocol: ${targetUrl.protocol}`);
  }

  if (targetUrl.protocol === "http:" && !isLoopbackHostname(targetUrl.hostname)) {
    printUsageAndExit(
      "Plain HTTP targets are only allowed for localhost or other loopback addresses. Use HTTPS for remote hosts.",
    );
  }

  let displayId = null;
  let displayNumber = null;

  if (rawDisplayId != null) {
    const parsedDisplayId = Number.parseInt(rawDisplayId, 10);

    if (Number.isNaN(parsedDisplayId)) {
      printUsageAndExit(`Invalid display ID: ${rawDisplayId}`);
    }

    displayId = parsedDisplayId;
  }

  if (rawDisplayNumber != null) {
    const parsedDisplayNumber = Number.parseInt(rawDisplayNumber, 10);

    if (Number.isNaN(parsedDisplayNumber) || parsedDisplayNumber < 1) {
      printUsageAndExit(`Invalid display number: ${rawDisplayNumber}`);
    }

    displayNumber = parsedDisplayNumber;
  }

  if (displayId != null && displayNumber != null) {
    printUsageAndExit("Use either --display-id or --display-number, not both.");
  }

  return {
    displayId,
    displayNumber,
    targetOrigin: targetUrl.origin,
    targetUrl,
  };
}

function isLoopbackHostname(hostname) {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "::1"
  );
}

function buildManagedTargetUrl(targetUrl) {
  const managedTargetUrl = new URL(targetUrl.toString());
  managedTargetUrl.searchParams.set("autostart", "1");
  managedTargetUrl.searchParams.set("shell", "electron");
  return managedTargetUrl.toString();
}

function getDisconnectedPageUrl() {
  return pathToFileURL(path.join(__dirname, "disconnected.html")).toString();
}

function getOrderedDisplays() {
  return [...screen.getAllDisplays()].sort((left, right) => {
    if (left.bounds.x !== right.bounds.x) {
      return left.bounds.x - right.bounds.x;
    }

    if (left.bounds.y !== right.bounds.y) {
      return left.bounds.y - right.bounds.y;
    }

    return left.id - right.id;
  });
}

function getDisplayBounds({ displayId, displayNumber }) {
  if (displayId == null && displayNumber == null) {
    return screen.getPrimaryDisplay().bounds;
  }

  if (displayNumber != null) {
    const orderedDisplays = getOrderedDisplays();
    const selectedDisplay = orderedDisplays[displayNumber - 1];

    if (!selectedDisplay) {
      const availableDisplayNumbers = orderedDisplays.map((_, index) => index + 1).join(", ");
      printUsageAndExit(
        `Unknown display number ${displayNumber}. Available display numbers: ${availableDisplayNumbers || "none"}`,
      );
    }

    return selectedDisplay.bounds;
  }

  const selectedDisplay = screen.getAllDisplays().find((display) => display.id === displayId);

  if (!selectedDisplay) {
    const availableDisplays = screen.getAllDisplays().map((display) => display.id).join(", ");
    printUsageAndExit(`Unknown display ID ${displayId}. Available displays: ${availableDisplays || "none"}`);
  }

  return selectedDisplay.bounds;
}

function isAllowedOrigin(value, allowedOrigin) {
  if (!value) {
    return false;
  }

  try {
    return new URL(value).origin === allowedOrigin;
  } catch {
    return false;
  }
}

function installPermissionHandlers(allowedOrigin) {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    if (!MEDIA_PERMISSIONS.has(permission)) {
      return false;
    }

    return isAllowedOrigin(requestingOrigin, allowedOrigin);
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const requestingUrl =
      details?.requestingUrl ??
      details?.requestingOrigin ??
      details?.embeddingOrigin ??
      "";

    callback(MEDIA_PERMISSIONS.has(permission) && isAllowedOrigin(requestingUrl, allowedOrigin));
  });
}

function createMainWindow(bounds) {
  const mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    autoHideMenuBar: true,
    backgroundColor: "#020617",
    frame: false,
    fullscreenable: true,
    movable: false,
    resizable: false,
    show: false,
    simpleFullscreen: process.platform === "darwin",
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.once("ready-to-show", () => {
    if (process.platform === "darwin") {
      mainWindow.setSimpleFullScreen(true);
    }
    mainWindow.show();
    mainWindow.focus();
  });

  return mainWindow;
}

async function loadTargetPage(mainWindow, state) {
  state.mode = "target";
  await mainWindow.loadURL(state.managedTargetUrl);
}

async function loadDisconnectedPage(mainWindow, state) {
  state.mode = "disconnected";
  await mainWindow.loadURL(state.disconnectedPageUrl);
}

function installShortcutHandler(mainWindow, state) {
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") {
      return;
    }

    const isPrimaryModifierPressed = input.control || input.meta;
    if (!isPrimaryModifierPressed || input.alt || input.shift) {
      return;
    }

    const key = (input.key || "").toLowerCase();

    if (key === "q") {
      event.preventDefault();
      app.quit();
      return;
    }

    if (key === "r") {
      event.preventDefault();

      if (state.mode === "disconnected") {
        void loadTargetPage(mainWindow, state);
        return;
      }

      mainWindow.webContents.reloadIgnoringCache();
      return;
    }

    if (key === "b") {
      event.preventDefault();

      if (state.mode !== "disconnected") {
        void loadDisconnectedPage(mainWindow, state);
      }
    }
  });
}

async function main() {
  const options = parseCliOptions(process.argv.slice(1));

  await app.whenReady();

  installPermissionHandlers(options.targetOrigin);

  const state = {
    disconnectedPageUrl: getDisconnectedPageUrl(),
    managedTargetUrl: buildManagedTargetUrl(options.targetUrl),
    mode: "target",
  };

  const mainWindow = createMainWindow(getDisplayBounds(options));
  installShortcutHandler(mainWindow, state);

  await loadTargetPage(mainWindow, state);
}

app.on("window-all-closed", () => {
  app.quit();
});

main().catch((error) => {
  console.error(error);
  app.exit(1);
});
