# Deedz the Goose Online

A real hosted version of **Deedz the Goose: Honk Commander** built to run as a managed web application rather than a static demo.

The browser game remains the front end. A Node.js service now provides:

- PostgreSQL-backed global leaderboard
- Persistent global honk, run, and boss-win counters
- Live online-player presence over WebSockets
- Runtime and database health endpoints
- Graceful SIGTERM handling for managed deployments
- Structured runtime events for deployment/application logs

## Why this branch exists

`infrastry-online` is intended to be deployed as a real Infrastry application. It gives the platform meaningful responsibilities: run the Node application, supply the dynamic port, provision/connect PostgreSQL, route HTTPS and WebSockets, monitor health, and replace application runtimes while the leaderboard remains durable.

The original `main` branch remains the static game prototype.

## Runtime requirements

- Node.js 20+
- `PORT` supplied by the hosting platform
- `DATABASE_URL` pointing to PostgreSQL

Start command:

```bash
npm start
```

## Health endpoints

- `GET /healthz` — process liveness
- `GET /readyz` — PostgreSQL readiness
- `GET /api/status` — runtime identity/status
- `GET /api/snapshot` — public game stats and leaderboard

## Simple real-world verification

1. Deploy this branch with PostgreSQL attached.
2. Open the live URL and play a run.
3. Confirm the score appears on the Goose Board.
4. Note the global run/honk counters.
5. Deploy a harmless code update or replace the application runtime.
6. Confirm the game comes back online and the leaderboard/counters are still present.

That demonstrates the practical separation between a replaceable application runtime and durable managed data.

## Controls

| Action | Key |
|---|---|
| Move | A/D or Arrow Left/Right |
| Jump | Space, W, or Arrow Up |
| Dash | Shift |
| Honk | H |
| Stick swing | J |
| Throw breadcrumb | K |
| Start/restart | Enter or button |
