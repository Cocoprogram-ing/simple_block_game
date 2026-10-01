# Simple Block Game

A tiny multiplayer 3D block sandbox. One flat 30 x 30 platform, one block type. Walk, jump, break blocks, place blocks, and play with friends in the browser.

Stack: TypeScript, Three.js, Node.js (Express + `ws`), Vite, npm.

## How it works

- `server/` is a Node.js server. It keeps the world and the players in memory, serves the built client, and accepts WebSocket connections at `/ws`.
- `client/` is the browser game (Three.js). It renders the world and sends your actions to the server.
- `shared/` holds the constants and message types used by both.
- The server is authoritative for blocks. A client only sends "break block at x,y,z" or "place block at x,y,z". The server checks that the player exists, the coordinates are valid, the player is close enough, the block exists (or the spot is free and touches another block), and nobody is standing inside the new block. Only then does it change the world and broadcast the change. The client never edits the world on its own.
- Player positions are reported by each client and relayed to the others. The server sanity-checks them but does not simulate movement.
- Blocks can only be placed above the 30 x 30 footprint, up to 16 blocks high. The world is in memory, so it resets when the server restarts.

## Run locally

You need Node.js 18 or newer.

```bash
npm install
npm run build
npm start
```

Open http://localhost:3000. Open a second browser tab to see two players.

For development with auto-reload (client on port 5173, server on 3000):

```bash
npm install
npm run dev
```

Open http://localhost:5173.

Optional type check: `npm run typecheck`

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Space | Jump |
| Mouse | Look |
| Left click | Break block |
| Right click | Place block |
| ESC | Unlock mouse (click the screen to resume) |

If you fall off the platform you respawn in the middle.

## Upload to GitHub

1. Create a new empty repository on https://github.com/new (no README, no .gitignore).
2. In the project folder run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY` with the URL GitHub shows you, for example `https://github.com/your-name/simple-block-game.git`.

`npm install` creates `package-lock.json`. Commit it (the commands above do).

## Deploy to Render

1. Create a free account at https://render.com.
2. In the Render dashboard, connect GitHub (Account Settings > GitHub, or just follow the prompt when you create the service) and allow access to your repository.
3. Click **New +** > **Web Service**.
4. Select your `simple-block-game` repository.
5. Fill in the form (Render may pre-fill this from `render.yaml`):
   - Runtime: **Node**
   - Branch: `main`
   - Build Command: `npm install --include=dev && npm run build`
   - Start Command: `npm start`
   - Instance type: Free
6. Environment variables: set `NODE_VERSION` to `20`. Do **not** set `PORT`; Render provides it and the server reads it.
7. Click **Create Web Service** and wait for the deploy to finish.
8. Open the `https://your-service.onrender.com` URL shown at the top of the page, enter a username, and click PLAY.
9. Send the URL to a friend.

Alternative: **New +** > **Blueprint**, pick the repository, and Render reads `render.yaml` for you.

Notes:
- WebSockets work on Render with no extra setup. The client connects to the same host the page came from (`wss://` on https).
- The free plan sleeps after a while without traffic, so the first visit can take about a minute to wake up. Blocks placed or broken are lost when the service restarts.

## Project structure

```
simple-block-game/
├── client/
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── main.ts               username menu, starts the game
│       ├── game/Game.ts          scene, input, main loop, message handling
│       ├── world/ClientWorld.ts  block rendering, collision, targeting ray
│       ├── player/LocalPlayer.ts movement, gravity, jumping, collision
│       ├── player/RemotePlayers.ts other players, labels, interpolation
│       └── networking/Network.ts WebSocket wrapper
├── server/src/
│   ├── index.ts                  HTTP + WebSocket server, validation
│   ├── world.ts                  authoritative block set
│   └── players.ts                connected players
├── shared/src/index.ts           constants and message types
├── package.json
├── tsconfig.json
├── render.yaml
├── .env.example
└── .gitignore
```
