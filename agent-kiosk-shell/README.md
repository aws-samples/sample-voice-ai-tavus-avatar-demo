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
```

## Run

```bash
npm start -- --target-url=http://localhost:3000
```

Optional:

```bash
npm start -- --target-url=https://your-app.vercel.app --display-number=2
```

Notes:

- Remote targets must use `https://`
- Plain `http://` is only allowed for `localhost` and other loopback addresses
- `display-number` is a 1-based physical-display index sorted left-to-right, then top-to-bottom
- `display-id` still works if you want to target Electron's raw display ID directly

## Hosted App Contract

The hosted app should support:

- `autostart=1` to immediately start a new session on page load
- page unload cleanup so reloads and `Cmd+B` cleanly end active sessions

`tavus-avatar` now supports this contract.
