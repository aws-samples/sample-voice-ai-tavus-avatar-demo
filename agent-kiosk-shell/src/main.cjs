const fs = require("fs");
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
    "Usage: electron . --target-url=<http(s)://host[:port][/path][?query]> [--display-number=<1-based-index> | --display-id=<id>] [--auto-click-text=<text>] [--auto-click-selector=<selector>] [--automation=<name>] [--devtools] [--trace-fetch=<url-substring>]",
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

function stripSurroundingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadDotEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const fileContents = fs.readFileSync(envFilePath, "utf8");

  for (const rawLine of fileContents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = stripSurroundingQuotes(line.slice(separatorIndex + 1).trim());

    if (!key || process.env[key] != null) {
      continue;
    }

    process.env[key] = value;
  }
}

function parseCliOptions(argv) {
  let rawAutoClickSelector = null;
  let rawAutoClickText = null;
  let rawTargetUrl = "";
  let rawDisplayId = null;
  let rawDisplayNumber = null;
  let rawAutomation = null;
  let openDevTools = false;
  let rawTraceFetch = null;

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
      continue;
    }

    if (arg === "--auto-click-text") {
      rawAutoClickText = readArgumentValue(argv, index);
      index += 1;
      continue;
    }

    if (arg.startsWith("--auto-click-text=")) {
      rawAutoClickText = arg.slice("--auto-click-text=".length);
      continue;
    }

    if (arg === "--auto-click-selector") {
      rawAutoClickSelector = readArgumentValue(argv, index);
      index += 1;
      continue;
    }

    if (arg.startsWith("--auto-click-selector=")) {
      rawAutoClickSelector = arg.slice("--auto-click-selector=".length);
      continue;
    }

    if (arg === "--automation") {
      rawAutomation = readArgumentValue(argv, index);
      index += 1;
      continue;
    }

    if (arg.startsWith("--automation=")) {
      rawAutomation = arg.slice("--automation=".length);
      continue;
    }

    if (arg === "--devtools") {
      openDevTools = true;
      continue;
    }

    if (arg === "--trace-fetch") {
      rawTraceFetch = readArgumentValue(argv, index);
      index += 1;
      continue;
    }

    if (arg.startsWith("--trace-fetch=")) {
      rawTraceFetch = arg.slice("--trace-fetch=".length);
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

  const autoClickSelector = rawAutoClickSelector?.trim() || null;
  const autoClickText = rawAutoClickText?.trim() || null;

  if (rawAutoClickSelector != null && autoClickSelector == null) {
    printUsageAndExit("--auto-click-selector must not be empty.");
  }

  if (rawAutoClickText != null && autoClickText == null) {
    printUsageAndExit("--auto-click-text must not be empty.");
  }

  const automation = rawAutomation?.trim() || null;
  if (rawAutomation != null && automation == null) {
    printUsageAndExit("--automation must not be empty.");
  }

  const traceFetch = rawTraceFetch?.trim() || null;
  if (rawTraceFetch != null && traceFetch == null) {
    printUsageAndExit("--trace-fetch must not be empty.");
  }

  return {
    autoClick:
      autoClickSelector != null || autoClickText != null
        ? {
            selector: autoClickSelector,
            text: autoClickText,
          }
        : null,
    automation,
    displayId,
    displayNumber,
    openDevTools,
    traceFetch,
    targetOrigin: targetUrl.origin,
    targetUrl,
  };
}

function getGradientBangAutomation() {
  const email = process.env.GRADIENT_BANG_EMAIL?.trim() || null;
  const password = process.env.GRADIENT_BANG_PASSWORD?.trim() || null;
  const characterName =
    process.env.GRADIENT_BANG_CHARACTER_NAME?.trim() ||
    process.env.GRADIENT_BANG_CHARACTER?.trim() ||
    null;

  if (!email || !password || !characterName) {
    printUsageAndExit(
      "Gradient Bang automation requires GRADIENT_BANG_EMAIL, GRADIENT_BANG_PASSWORD, and GRADIENT_BANG_CHARACTER_NAME (or GRADIENT_BANG_CHARACTER) in agent-kiosk-shell/.env.",
    );
  }

  return {
    characterName,
    email,
    password,
    profile: "gradient-bang",
  };
}

function getTargetAutomation(automationName) {
  if (!automationName) {
    return null;
  }

  if (automationName === "gradient-bang") {
    return getGradientBangAutomation();
  }

  printUsageAndExit(`Unknown automation profile: ${automationName}`);
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

function installNetworkTraceHandlers(traceFetch) {
  if (!traceFetch) {
    return;
  }

  const needle = traceFetch.toLowerCase();
  const matches = (url) => typeof url === "string" && url.toLowerCase().includes(needle);

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (matches(details.url)) {
      console.log(
        "[Network trace before]",
        JSON.stringify({
          id: details.id,
          method: details.method,
          resourceType: details.resourceType,
          url: details.url,
        }),
      );
    }

    callback({});
  });

  session.defaultSession.webRequest.onCompleted((details) => {
    if (!matches(details.url)) {
      return;
    }

    console.log(
      "[Network trace completed]",
      JSON.stringify({
        id: details.id,
        method: details.method,
        resourceType: details.resourceType,
        statusCode: details.statusCode,
        statusLine: details.statusLine,
        url: details.url,
      }),
    );
  });

  session.defaultSession.webRequest.onErrorOccurred((details) => {
    if (!matches(details.url)) {
      return;
    }

    console.log(
      "[Network trace error]",
      JSON.stringify({
        id: details.id,
        method: details.method,
        resourceType: details.resourceType,
        error: details.error,
        url: details.url,
      }),
    );
  });
}

function createMainWindow(bounds, options = {}) {
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

    if (options.openDevTools) {
      mainWindow.webContents.openDevTools({ mode: "detach", activate: true });
    }
  });

  return mainWindow;
}

function getGradientBangAutomationScript(automation, options = {}) {
  const scriptConfig = JSON.stringify({
    allowCredentialSubmit: options.allowCredentialSubmit !== false,
    characterName: automation.characterName,
    email: automation.email,
    password: automation.password,
  });

  return `
    (() => {
      const config = ${scriptConfig};
      const deadline = Date.now() + 90000;
      const warmupDeadline = Date.now() + 6000;
      const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
      const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim().toLowerCase();
      const steps = [];
      let hasSubmittedCredentials = !config.allowCredentialSubmit;
      const INTERACTIVE_SELECTOR = 'button, a, [role="button"], input[type="button"], input[type="submit"], [tabindex]';
      const targetTexts = {
        back: "back",
        character: normalize(config.characterName),
        loginError: "incorrect username or password",
        join: "join",
        newCharacter: "new character",
        signIn: "sign in",
      };

      const recordStep = (message) => {
        steps.push({ at: new Date().toISOString(), message });
      };

      const isVisible = (element) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          style.opacity !== "0"
        );
      };

      const getVisibleText = (element) => {
        const text =
          element.innerText ||
          element.textContent ||
          element.getAttribute("value") ||
          "";
        return normalize(text);
      };

      const findElementByExactText = (text) => {
        if (!text) {
          return null;
        }

        const candidates = Array.from(document.querySelectorAll("button, a, div, span, p, h1, h2, h3, h4, h5, h6"));
        return candidates.find((element) => isVisible(element) && getVisibleText(element) === text) || null;
      };

      const findActionableElementByExactText = (text) => {
        if (!text) {
          return null;
        }

        const interactiveCandidates = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR));
        const directInteractiveMatch = interactiveCandidates.find(
          (element) => isVisible(element) && getVisibleText(element) === text,
        );
        if (directInteractiveMatch) {
          return directInteractiveMatch;
        }

        const textCandidates = Array.from(document.querySelectorAll("button, a, div, span, p, h1, h2, h3, h4, h5, h6"));
        for (const element of textCandidates) {
          if (!isVisible(element) || getVisibleText(element) !== text) {
            continue;
          }

          const actionableAncestor = element.closest(INTERACTIVE_SELECTOR);
          if (actionableAncestor && isVisible(actionableAncestor)) {
            return actionableAncestor;
          }

          return element;
        }

        return null;
      };

      const listVisibleScreenTexts = () => {
        const candidates = Array.from(document.querySelectorAll("button, a, input, h1, h2, h3, h4, h5, h6, p, span, div"));
        const texts = [];

        for (const element of candidates) {
          if (!(element instanceof HTMLElement) || !isVisible(element)) {
            continue;
          }

          const text = getVisibleText(element);
          if (!text || text.length < 2) {
            continue;
          }

          texts.push(text);
          if (texts.length >= 16) {
            break;
          }
        }

        return texts;
      };

      const findInput = (selectorList) => {
        for (const selector of selectorList) {
          const input = document.querySelector(selector);
          if (input instanceof HTMLInputElement && isVisible(input)) {
            return input;
          }
        }

        return null;
      };

      const isDisabled = (element) => {
        if (!(element instanceof HTMLElement)) {
          return true;
        }

        return (
          element.hasAttribute("disabled") ||
          element.getAttribute("aria-disabled") === "true" ||
          (element instanceof HTMLButtonElement && element.disabled)
        );
      };

      const getDebugSnapshot = () => ({
        screenTexts: listVisibleScreenTexts(),
        steps,
      });

      const createDebugError = (message) => {
        const snapshot = getDebugSnapshot();
        return new Error(
          message + " " + JSON.stringify(snapshot),
        );
      };

      const findReactClickTarget = (element) => {
        for (let current = element; current; current = current.parentElement) {
          const reactPropsKey = Object.keys(current).find((key) => key.startsWith("__reactProps$"));
          if (!reactPropsKey) {
            continue;
          }

          const reactProps = current[reactPropsKey];
          if (reactProps && typeof reactProps.onClick === "function") {
            return {
              element: current,
              onClick: reactProps.onClick,
            };
          }
        }

        return null;
      };

      const triggerReactClick = async (element) => {
        const reactTarget = findReactClickTarget(element);
        if (!reactTarget) {
          return false;
        }

        let defaultPrevented = false;
        let propagationStopped = false;
        const event = {
          bubbles: true,
          button: 0,
          cancelable: true,
          currentTarget: reactTarget.element,
          defaultPrevented: false,
          isDefaultPrevented: () => defaultPrevented,
          isPropagationStopped: () => propagationStopped,
          nativeEvent: {
            detail: 1,
            target: reactTarget.element,
            type: "click",
          },
          persist: () => {},
          preventDefault: () => {
            defaultPrevented = true;
            event.defaultPrevented = true;
          },
          stopPropagation: () => {
            propagationStopped = true;
          },
          target: reactTarget.element,
          type: "click",
        };

        reactTarget.onClick(event);
        await sleep(900);
        return true;
      };

      const clickElement = async (element) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        element.scrollIntoView({ block: "center", inline: "center" });
        await sleep(250);
        if (await triggerReactClick(element)) {
          return true;
        }
        element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        element.click();
        await sleep(900);
        return true;
      };

      const setInputValue = async (input, value) => {
        const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        const setter = descriptor && descriptor.set;

        input.focus();
        if (setter) {
          setter.call(input, value);
        } else {
          input.value = value;
        }

        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.blur();
        await sleep(200);
      };

      const waitForLoginOutcome = async () => {
        const submitDeadline = Math.min(deadline, Date.now() + 20000);
        const idleFormDeadline = Date.now() + 2500;

        while (Date.now() < submitDeadline) {
          if (findElementByExactText(targetTexts.character) || findElementByExactText(targetTexts.newCharacter)) {
            recordStep("Reached character selection");
            return "character-select";
          }

          if (findElementByExactText(targetTexts.loginError)) {
            recordStep("Login error banner displayed");
            throw createDebugError("Gradient Bang login failed.");
          }

          const emailInput = findInput([
            'input[type="email"]',
            'input[autocomplete="email"]',
            'input[name="email"]',
            'input:not([type="password"])',
          ]);
          const passwordInput = findInput([
            'input[type="password"]',
            'input[autocomplete="current-password"]',
            'input[name="password"]',
          ]);
        const joinButton = findActionableElementByExactText(targetTexts.join);
        const signInButton = findElementByExactText(targetTexts.signIn);

          if (signInButton && !emailInput && !passwordInput) {
            recordStep("Returned to sign-in landing screen");
            throw createDebugError("Gradient Bang returned to the sign-in landing screen after login submit.");
          }

          if (
            Date.now() > idleFormDeadline &&
            emailInput &&
            passwordInput &&
            joinButton &&
            !isDisabled(joinButton)
          ) {
            recordStep("Login form returned to idle state");
            throw createDebugError("Gradient Bang login form returned to idle without advancing.");
          }

          await sleep(500);
        }

        throw createDebugError("Timed out waiting for the Gradient Bang login response.");
      };

      const completeSignIn = async () => {
        const emailInput = findInput([
          'input[type="email"]',
          'input[autocomplete="email"]',
          'input[name="email"]',
          'input:not([type="password"])',
        ]);
        const passwordInput = findInput([
          'input[type="password"]',
          'input[autocomplete="current-password"]',
          'input[name="password"]',
        ]);

        if (!emailInput || !passwordInput) {
          return false;
        }

        if (hasSubmittedCredentials) {
          return "waiting";
        }

        recordStep("Found sign-in form");
        await setInputValue(emailInput, config.email);
        await setInputValue(passwordInput, config.password);

        const joinButton = findActionableElementByExactText(targetTexts.join);
        if (!joinButton || isDisabled(joinButton)) {
          return false;
        }

        recordStep("Submitting sign-in form");
        console.log("__AGENT_KIOSK_GRADIENT_BANG_SIGNIN_SUBMITTED__");
        hasSubmittedCredentials = true;
        await clickElement(joinButton);
        return waitForLoginOutcome();
      };

      const waitForPostCharacterEntry = async () => {
        while (Date.now() < deadline) {
          const hasLoginField = Boolean(findInput([
            'input[type="email"]',
            'input[type="password"]',
          ]));

          const stillOnEntryScreens = [
            targetTexts.signIn,
            targetTexts.join,
            targetTexts.back,
            targetTexts.newCharacter,
            targetTexts.character,
          ].some((text) => findElementByExactText(text));

          if (!hasLoginField && !stillOnEntryScreens) {
            return {
              ok: true,
              screenTexts: listVisibleScreenTexts(),
              steps,
            };
          }

          await sleep(500);
        }

        throw new Error(
          "Character was selected, but the app did not advance past the login/character selection screens before timeout.",
        );
      };

      const selectCharacter = async () => {
        const characterElement = findActionableElementByExactText(targetTexts.character);
        if (!characterElement) {
          return false;
        }

        recordStep("Selecting character");
        await clickElement(characterElement);
        return waitForPostCharacterEntry();
      };

      const run = async () => {
        while (Date.now() < deadline) {
          if (Date.now() < warmupDeadline) {
            await sleep(250);
            continue;
          }

          const characterSelectionResult = await selectCharacter();
          if (characterSelectionResult) {
            recordStep("Automation finished");
            return characterSelectionResult;
          }

          if (!config.allowCredentialSubmit) {
            if (findElementByExactText(targetTexts.loginError)) {
              recordStep("Login error banner displayed after prior submit");
              throw createDebugError("Gradient Bang login failed after the single allowed sign-in attempt.");
            }

            const signInButton = findElementByExactText(targetTexts.signIn);
            const hasLoginField = Boolean(findInput([
              'input[type="email"]',
              'input[type="password"]',
            ]));

            if (signInButton || hasLoginField) {
              recordStep("Sign-in screen remained visible after prior submit");
              throw createDebugError("Gradient Bang returned to sign-in after the single allowed sign-in attempt.");
            }
          }

          const backButton = findActionableElementByExactText(targetTexts.back);
          if (backButton && await completeSignIn()) {
            continue;
          }

          const signInButton = findActionableElementByExactText(targetTexts.signIn);
          if (signInButton) {
            recordStep("Opening sign-in dialog");
            await clickElement(signInButton);
            continue;
          }

          const signInResult = await completeSignIn();
          if (signInResult === "character-select" || signInResult === "waiting") {
            continue;
          }

          await sleep(400);
        }

        throw createDebugError("Timed out while running the Gradient Bang login sequence.");
      };

      return run();
    })();
  `;
}

function getAutoClickScript(autoClick) {
  const scriptConfig = JSON.stringify({
    selector: autoClick?.selector ?? null,
    text: autoClick?.text ?? null,
  });

  return `
    (() => {
      const config = ${scriptConfig};
      const deadline = Date.now() + 15000;
      const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim().toLowerCase();
      const targetText = config.text ? normalize(config.text) : null;
      const candidateSelector = config.selector || 'button, [role="button"], input[type="button"], input[type="submit"], a';

      const isClickable = (element) => {
        return (
          element instanceof HTMLElement &&
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-disabled") !== "true"
        );
      };

      const matches = (element) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        if (config.selector && !element.matches(config.selector)) {
          return false;
        }

        if (!isClickable(element)) {
          return false;
        }

        if (targetText == null) {
          return true;
        }

        const visibleText =
          element.innerText ||
          element.textContent ||
          element.getAttribute("value") ||
          "";
        const normalizedText = normalize(visibleText);

        return normalizedText === targetText;
      };

      const findMatch = () => {
        try {
          return Array.from(document.querySelectorAll(candidateSelector)).find(matches) || null;
        } catch {
          return null;
        }
      };

      const attemptClick = () => {
        const element = findMatch();

        if (!element) {
          if (Date.now() < deadline) {
            window.setTimeout(attemptClick, 250);
          }
          return;
        }

        element.scrollIntoView({ block: "center", inline: "center" });

        window.setTimeout(() => {
          element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
          element.click();
        }, 750);
      };

      attemptClick();
      return true;
    })();
  `;
}

function getFetchTraceScript(traceFetch) {
  const scriptConfig = JSON.stringify({
    needle: traceFetch,
  });

  return `
    (() => {
      const config = ${scriptConfig};
      const needle = (config.needle || "").toLowerCase();
      if (!needle || window.__agentKioskFetchTraceInstalled) {
        return true;
      }

      window.__agentKioskFetchTraceInstalled = true;
      const originalFetch = window.fetch.bind(window);

      const normalizeHeaders = (headers) => {
        try {
          if (!headers) {
            return null;
          }

          if (headers instanceof Headers) {
            return Object.fromEntries(headers.entries());
          }

          if (Array.isArray(headers)) {
            return Object.fromEntries(headers);
          }

          if (typeof headers === "object") {
            return headers;
          }
        } catch {}

        return null;
      };

      const normalizeUrl = (input) => {
        if (typeof input === "string") {
          return input;
        }

        if (input instanceof Request) {
          return input.url;
        }

        return String(input || "");
      };

      window.fetch = async (...args) => {
        const [input, init] = args;
        const url = normalizeUrl(input);
        const method =
          init?.method ||
          (input instanceof Request ? input.method : null) ||
          "GET";
        const shouldTrace = url.toLowerCase().includes(needle);

        if (!shouldTrace) {
          return originalFetch(...args);
        }

        const requestBody =
          typeof init?.body === "string"
            ? init.body
            : input instanceof Request
              ? null
              : null;

        console.log("__AGENT_KIOSK_FETCH_TRACE__" + JSON.stringify({
          phase: "request",
          url,
          method,
          headers: normalizeHeaders(init?.headers || (input instanceof Request ? input.headers : null)),
          body: requestBody,
        }));

        try {
          const response = await originalFetch(...args);
          let responseBody = null;

          try {
            responseBody = await response.clone().text();
          } catch {}

          console.log("__AGENT_KIOSK_FETCH_TRACE__" + JSON.stringify({
            phase: "response",
            url,
            method,
            status: response.status,
            ok: response.ok,
            headers: normalizeHeaders(response.headers),
            body: responseBody,
          }));

          return response;
        } catch (error) {
          console.log("__AGENT_KIOSK_FETCH_TRACE__" + JSON.stringify({
            phase: "error",
            url,
            method,
            error: error instanceof Error ? error.message : String(error),
          }));
          throw error;
        }
      };

      return true;
    })();
  `;
}

function installFetchTraceHandler(mainWindow, state) {
  if (!state.traceFetch) {
    return;
  }

  mainWindow.webContents.on("did-finish-load", () => {
    if (state.mode !== "target") {
      return;
    }

    void mainWindow.webContents.executeJavaScript(getFetchTraceScript(state.traceFetch), true).catch((error) => {
      console.error("Fetch trace install failed:", error);
    });
  });
}

function installConsoleBridgeHandler(mainWindow, state) {
  mainWindow.webContents.on("console-message", (_event, _level, message) => {
    if (message === "__AGENT_KIOSK_GRADIENT_BANG_SIGNIN_SUBMITTED__") {
      state.targetAutomationDidSubmitCredentials = true;
      return;
    }

    if (message.startsWith("__AGENT_KIOSK_FETCH_TRACE__")) {
      console.log("[Fetch trace]", message.slice("__AGENT_KIOSK_FETCH_TRACE__".length));
    }
  });
}

function installTargetAutomationHandler(mainWindow, state) {
  if (!state.targetAutomation) {
    return;
  }

  mainWindow.webContents.on("did-finish-load", () => {
    if (state.mode !== "target") {
      return;
    }

    let script = null;

    if (state.targetAutomation.profile === "gradient-bang") {
      script = getGradientBangAutomationScript(state.targetAutomation, {
        allowCredentialSubmit: !state.targetAutomationDidSubmitCredentials,
      });
    }

    if (!script) {
      return;
    }

    void mainWindow.webContents.executeJavaScript(script, true)
      .then(async (result) => {
        console.log("[Target automation succeeded]", JSON.stringify(result));

        if (!process.env.KIOSK_AUTOMATION_CAPTURE_PATH) {
          return;
        }

        const image = await mainWindow.webContents.capturePage();
        const capturePath = path.resolve(process.cwd(), process.env.KIOSK_AUTOMATION_CAPTURE_PATH);
        fs.writeFileSync(capturePath, image.toPNG());
        console.log(`[Target automation capture] Saved screenshot to ${capturePath}`);
      })
      .catch(async (error) => {
        console.error("Target automation failed:", error);

        if (!process.env.KIOSK_AUTOMATION_CAPTURE_PATH) {
          return;
        }

        try {
          const image = await mainWindow.webContents.capturePage();
          const capturePath = path.resolve(process.cwd(), process.env.KIOSK_AUTOMATION_CAPTURE_PATH);
          fs.writeFileSync(capturePath, image.toPNG());
          console.log(`[Target automation capture] Saved failure screenshot to ${capturePath}`);
        } catch (captureError) {
          console.error("Target automation capture failed:", captureError);
        }
      });
  });
}

function installAutoClickHandler(mainWindow, state) {
  if (!state.autoClick || state.targetAutomation) {
    return;
  }

  mainWindow.webContents.on("did-finish-load", () => {
    if (state.mode !== "target") {
      return;
    }

    void mainWindow.webContents.executeJavaScript(getAutoClickScript(state.autoClick), true).catch((error) => {
      console.error("Auto-click failed:", error);
    });
  });
}

async function loadTargetPage(mainWindow, state) {
  state.mode = "target";
  state.targetAutomationDidSubmitCredentials = false;
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

      state.targetAutomationDidSubmitCredentials = false;
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

  loadDotEnvFile(path.join(__dirname, "..", ".env"));

  await app.whenReady();

  installPermissionHandlers(options.targetOrigin);
  installNetworkTraceHandlers(options.traceFetch);

  const state = {
    autoClick: options.autoClick,
    disconnectedPageUrl: getDisconnectedPageUrl(),
    managedTargetUrl: buildManagedTargetUrl(options.targetUrl),
    mode: "target",
    targetAutomationDidSubmitCredentials: false,
    targetAutomation: getTargetAutomation(options.automation),
    traceFetch: options.traceFetch,
  };

  const mainWindow = createMainWindow(getDisplayBounds(options), {
    openDevTools: options.openDevTools,
  });
  installConsoleBridgeHandler(mainWindow, state);
  installFetchTraceHandler(mainWindow, state);
  installTargetAutomationHandler(mainWindow, state);
  installAutoClickHandler(mainWindow, state);
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
