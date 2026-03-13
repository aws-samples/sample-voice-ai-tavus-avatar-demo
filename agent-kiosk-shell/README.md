# Agent Kiosk Shell

A small Electron wrapper for browser-based voice/video agent front ends.

## Behavior

- Loads a target web app URL in a borderless macOS simple-fullscreen window
- Appends `?autostart=1&shell=electron` so the hosted app can join immediately on load
- `Cmd+R` reloads the target app
- `Cmd+B` replaces the target app with a local `Disconnected` screen until the next `Cmd+R`
- `Cmd+Q` quits the shell
- Automatically approves media permissions for the configured target origin inside Electron

## Install

```bash
cd agent-kiosk-shell
npm install
cp .env.example .env
```

## Run

```bash
npm start -- --target-url=http://localhost:3000
```

Optional:

```bash
npm start -- --target-url=https://your-app.vercel.app --display-number=2
```

Auto-click a demo's own connect button:

```bash
npm start -- --target-url=https://rxconnect-deepgram-sagemaker-pipecat.fly.dev/ --auto-click-text=Connect
```

Built-in Gradient Bang sign-in flow:

```bash
npm start -- --target-url=https://game.gradient-bang.com --automation=gradient-bang
```

Notes:

- Remote targets must use `https://`
- Plain `http://` is only allowed for `localhost` and other loopback addresses
- `display-number` is a 1-based physical-display index sorted left-to-right, then top-to-bottom
- `display-id` still works if you want to target Electron's raw display ID directly
- `auto-click-text` clicks the first enabled clickable element whose text matches exactly
- `auto-click-selector` lets you target a specific DOM selector instead
- `automation=gradient-bang` enables the built-in Gradient Bang login-and-character-selection flow

Gradient Bang `.env` variables:

- `GRADIENT_BANG_EMAIL`
- `GRADIENT_BANG_PASSWORD`
- `GRADIENT_BANG_CHARACTER_NAME`
  `GRADIENT_BANG_CHARACTER` also works as an alias for the character name

## Hosted App Contract

The hosted app should support:

- `autostart=1` to immediately start a new session on page load
- page unload cleanup so reloads and `Cmd+B` cleanly end active sessions

`tavus-avatar` now supports this contract.
