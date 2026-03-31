#Assignment realted urls
Frontend : https://tic-tac-ten-lake.vercel.app/
Backend : https://api.cashlens.in/

# Tic-Tac-Toe Multiplayer

This project is a two-player tic-tac-toe game built with a React frontend and a Nakama backend. The game logic is server-authoritative: moves are validated on the server, game state lives on the server, and the frontend only renders the latest state it receives over Nakama realtime updates.

The app supports:

- quick match automatic matchmaking
- private room creation and joining
- classic and timed game modes
- disconnect handling
- responsive multiplayer UI

## Stack

- Frontend: React, TypeScript, Vite
- Backend: Nakama with a Go runtime module
- Database: PostgreSQL
- Local orchestration: Docker Compose

## Project Structure

```text
frontend/         React app
nakama/           Docker Compose, Nakama config, runtime module
nakama/backend/   Go authoritative match logic
```

## Setup

### Prerequisites

- Node.js 20+
- npm
- Docker
- Docker Compose

### 1. Start the backend locally

```bash
cd nakama
cp .env.example .env
docker compose up --build
```

This starts:

- PostgreSQL
- Nakama
- the Go plugin builder container that compiles the runtime module

### 2. Start the frontend locally

In a second terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

By default the frontend expects Nakama at `127.0.0.1:7350`.

## Environment Variables

### Frontend

`frontend/.env`

```env
VITE_NAKAMA_SERVER_KEY=defaultkey
VITE_NAKAMA_HOST=127.0.0.1
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_SSL=false
```

Notes:

- `VITE_NAKAMA_SERVER_KEY` must match the backend `NAKAMA_SERVER_KEY`
- `VITE_NAKAMA_SSL` should be `true` in production when the backend is exposed through HTTPS

### Backend

`nakama/.env`

```env
POSTGRES_PASSWORD=localdb
NAKAMA_SERVER_KEY=defaultkey
NAKAMA_SESSION_ENCRYPTION_KEY=replace-me-with-a-long-random-string
NAKAMA_REFRESH_ENCRYPTION_KEY=replace-me-with-a-long-random-string
NAKAMA_HTTP_KEY=replace-me-with-a-long-random-string
NAKAMA_GRPC_PORT=7349
NAKAMA_HTTP_PORT=7350
NAKAMA_CONSOLE_PORT=7351
```

For deployment, the secret values should be replaced with real random strings.

## Architecture And Design Decisions

### Server-authoritative gameplay

The backend owns the game state. Each match runs as a Nakama authoritative match handler written in Go.

That means:

- the server decides whether a move is valid
- the server decides whose turn it is
- the server decides when the game is won, drawn, or forfeited
- clients cannot change board state directly

This was the most important design choice for the assignment because it prevents client-side cheating and keeps multiplayer state consistent.

### Match flow

There are two ways to start a game:

- Quick Match: players are paired automatically by Nakama matchmaker
- Private Room: one player creates a room, another joins it by room code or room list

Each game is isolated inside its own authoritative match instance, so multiple games can run at the same time without sharing state.

### Timed mode

Timed mode adds a 30-second move timer. The backend tracks turn deadlines and ends the match automatically if a player does not move before the timer expires.

### Frontend state model

The frontend is intentionally thin:

- it authenticates the player
- joins matches
- subscribes to realtime match data
- fetches an initial snapshot on room join
- renders whatever state the server sends

The frontend never computes game outcomes itself.

## API / Server Configuration

The frontend talks to Nakama over:

- REST for authentication and RPC calls
- WebSockets for realtime match updates

### Main frontend actions

- authenticate player with device auth
- create room via RPC
- list rooms via RPC
- fetch match snapshot via RPC
- join authoritative match
- send move messages over realtime socket

### Nakama runtime responsibilities

The Go runtime module:

- registers the authoritative `tictactoe` match
- registers room creation and room listing RPCs
- creates matchmaker matches
- validates moves
- broadcasts updated game state
- handles disconnects
- enforces timed-mode turn deadlines

### Docker Compose setup

`nakama/docker-compose.yml` runs:

- `postgres`
- `nakama`
- `plugin-builder`

The backend plugin is built from `nakama/backend/main.go` and mounted into the Nakama container.

## How To Test Multiplayer

### Local test

1. Start Nakama with Docker Compose.
2. Start the frontend with Vite.
3. Open two browser tabs.
4. Log in with two different usernames.
5. Test both flows:

- Quick Match
- Create Room / Join Room

6. Verify:

- moves update in real time on both tabs
- invalid moves are rejected
- winner modal appears when the game ends
- timed mode ends the game when a player runs out of time

### Basic manual test checklist

- login succeeds with a new username
- duplicate usernames show a clear error
- room creation moves the creator into a waiting room
- joining by room code works
- quick match pairs two users into the same game
- game ends correctly on win
- game ends correctly on draw
- timed mode forfeits correctly on timeout
- disconnecting one player ends the match gracefully

## Deployment

### Deployment approach used

For this project, the frontend and backend are deployed separately:

- frontend on Vercel
- Nakama on a GCP Compute Engine VM
- PostgreSQL running with Nakama via Docker Compose on the same VM
- Caddy used as the HTTPS reverse proxy in front of Nakama

This approach kept the infrastructure simple enough for an assignment while still exposing a public multiplayer backend over HTTPS/WSS.

### Backend deployment process

1. Create a GCP Compute Engine VM.
2. Install Docker, Docker Compose, Git, and Caddy.
3. Clone this repository onto the VM.
4. Create `nakama/.env` from `nakama/.env.example`.
5. Start the backend:

```bash
cd nakama
docker compose up --build -d
```

6. Configure Caddy to proxy a public domain to Nakama:

```caddy
api.cashlens.in {
    reverse_proxy 127.0.0.1:7350
}
```

7. Point DNS for `api.cashlens.in` to the VM IP.
8. Allow only ports `22`, `80`, and `443` at the firewall level.

### Frontend deployment process

1. Import the `frontend` directory into Vercel.
2. Set these environment variables in Vercel:

```env
VITE_NAKAMA_SERVER_KEY=<same as backend NAKAMA_SERVER_KEY>
VITE_NAKAMA_HOST=api.cashlens.in
VITE_NAKAMA_PORT=443
VITE_NAKAMA_SSL=true
```

3. Trigger a production deployment.

## Tradeoffs

This implementation is intentionally practical rather than overbuilt.

Choices made for the assignment:

- one VM instead of a more complex multi-service cloud setup
- Docker Compose for speed and reproducibility
- authoritative backend logic prioritized over extra product features

If this were extended further, the next improvements would be:

- managed Postgres
- CI pipeline for automated validation
- leaderboard persistence
- reconnect/resume flow
- stronger observability and alerting
