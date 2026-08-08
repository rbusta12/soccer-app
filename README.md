# Soccer Scores API

A small REST API that serves live soccer scores and standings for major
leagues (EPL, La Liga, Serie A, Bundesliga, Ligue 1, MLS), built as a
demonstration of containerized, CI/CD-deployed, secured infrastructure —
not just application code.

## Why this project

Most student projects stop at "the app runs on my laptop." This one is
built to demonstrate the full path from code to a running, monitored,
secured service in the cloud: containerization, automated testing and
static analysis in CI, a reverse proxy with HTTPS, and basic hardening
against unauthorized access.

## Architecture

```
                    ┌─────────────────┐
   Client  ───────▶ │  Nginx (HTTPS)  │
                    └────────┬────────┘
                             │ reverse proxy, port 3000
                    ┌────────▼────────┐
                    │  Docker container │
                    │  Express app      │
                    │  (this repo)      │
                    └────────┬────────┘
                             │ REST calls, cached 30s
                    ┌────────▼────────┐
                    │  ESPN public API  │
                    └───────────────────┘
```

- **App layer**: Node.js/Express, organized as routes → services, so route
  handlers stay thin and all external-API logic lives in one place
  (`src/services/espnService.js`). This is the repository/service pattern —
  it means the routes don't know or care that the data source is ESPN, which
  makes it easy to swap in a different provider or add a database later.
- **Caching**: a small hand-rolled TTL cache (`src/services/ttlCache.js`,
  backed by a `Map` for O(1) lookups) avoids hammering the upstream API on
  every request.
- **Testing**: Jest + Supertest. The service layer's external `fetch` call
  is mocked in tests, so the suite is fast and deterministic — it never
  depends on ESPN's API being up.
- **CI**: GitHub Actions runs lint, tests (with coverage), and a Docker
  build on every push and PR (see `.github/workflows/ci.yml`).
- **Containerization**: multi-stage Dockerfile, runs as a non-root user,
  includes a `HEALTHCHECK`.
- **Deployment** (see below): EC2 instance behind Nginx, HTTPS via
  Certbot/Let's Encrypt, SSH restricted to key-based auth from specific
  IPs, fail2ban for intrusion logging.

## Endpoints

| Method | Path                        | Description                          |
|--------|-----------------------------|---------------------------------------|
| GET    | `/health`                   | Health check (used by Docker/LB)     |
| GET    | `/api/matches/:league`      | Today's matches for a league         |
| GET    | `/api/standings/:league`    | Current standings for a league       |

Supported league keys: `epl`, `laliga`, `seriea`, `bundesliga`, `ligue1`, `mls`

Example:
```
GET /api/matches/epl
GET /api/standings/epl
```

## Local development

```bash
npm install
npm run dev        # runs with --watch on http://localhost:3000
npm test           # run the test suite
npm run test:coverage
npm run lint
```

## Running with Docker

```bash
docker build -t soccer-scores-api .
docker run -p 3000:3000 soccer-scores-api
```

## Deployment (cloud)

1. Provision an EC2 (or Azure VM) instance, restrict SSH (port 22) to your
   IP via the security group.
2. Install Docker and Nginx on the instance.
3. Configure Nginx as a reverse proxy from port 443 → container's port 3000,
   with a TLS cert from Let's Encrypt/Certbot.
4. Install and configure `fail2ban` to log and block repeated failed SSH
   attempts.
5. Extend the GitHub Actions workflow's `deploy` job (stubbed in
   `ci.yml`) to SSH into the instance and pull/run the latest image on
   every push to `main`.

## Design notes / what I'd do differently at scale

- The TTL cache is in-process, so it won't be shared across multiple
  instances behind a load balancer — at scale this would move to Redis.
- League config (`LEAGUES` in `espnService.js`) is hardcoded; a real
  product would pull this from a config service or database.
- No auth/rate-limiting is implemented on the API itself yet — for a
  public-facing service this would need at minimum basic rate limiting.

## Incident: the deploy that timed out for two different reasons

While wiring up automated deploys through GitHub Actions, I hit two separate
networking failures back to back — worth writing up because neither one was
obvious from the error message alone.

**First failure:** the deploy job used a GitHub-hosted runner that SSHed into
my EC2 instance. It timed out — `dial tcp ***:22: i/o timeout`. My first
instinct was to check the SSH key I'd stored as a GitHub secret, since the
job had also thrown a "no key found" error on an earlier run. But even after
fixing the key, the timeout stayed. That's when it clicked: I'd locked SSH
down to only accept connections from *my own* IP address when I set up the
security group. GitHub's hosted runners come from a totally different,
constantly rotating set of IPs, so my own hardening was blocking my own
deploy. Rather than open SSH back up to the world (which would've undone the
whole point of restricting it), I set up a self-hosted GitHub Actions runner
that lives directly on the EC2 instance. It reaches *out* to GitHub instead
of GitHub reaching *in* to it, so SSH stayed locked to my IP the entire time.

**Second failure, right after fixing the first:** the deploy step ran fine —
pulled the repo, rebuilt the image — but then `docker run` failed with
`iptables: No chain/target/match by that name`. Odd, since the exact same
`docker run` command had worked perfectly a dozen times earlier in this
project. The difference was that I'd installed `firewalld` a step earlier
(as a dependency for setting up fail2ban), and starting it had rewritten the
system's iptables rules out from under Docker, wiping out the `DOCKER` chain
Docker relies on to map container ports. A `systemctl restart docker` got
Docker to rebuild its own chain, but the container *still* wasn't reachable
afterward — `docker ps` showed it healthy, `docker logs` showed it listening
on port 3000, and the port mapping looked correct, so the container itself
clearly wasn't the problem. Running `firewall-cmd --get-active-zones`
was the moment it actually clicked: only the `docker0` bridge showed up as
an active zone, meaning firewalld's default `public` zone — the one that
actually governs incoming traffic from the internet — didn't have port
3000 (or even 80/443) opened at all. It had been invisibly filtering
everything the whole time. Once I explicitly opened those ports in both
the `public` and `docker` zones and reloaded, everything came back —
confirmed by re-running the exact same `curl` test I'd used earlier, plus
checking the live HTTPS URL in a browser to make sure the entire chain
(internet → Nginx → firewalld → container) was intact end to end.

Nothing about either failure was visible from a single command's output —
both needed comparing what changed between "it worked" and "it broke" (an
IP restriction I'd set myself; a firewall daemon I'd installed for an
unrelated reason) to actually find the cause.

## What this project demonstrates

- **Node.js/JavaScript** — entire app is Express/Node.
- **Consuming REST APIs** — `espnService.js` calls and normalizes an
  external REST API.
- **Data structures & algorithms** — hand-rolled TTL cache with tests.
- **Design patterns** — service/repository layer separating routes from
  external data access.
- **Testing** — Jest unit + integration tests with mocking, run in CI.
- **Git/GitHub workflow** — branch protection, PR-based changes.
- **Static analysis** — ESLint wired into CI on every push.
- **CI/CD** — GitHub Actions pipeline (lint → test → build → deploy).
- **Distributed systems debugging** — see `docs/incident-notes.md` for a
  real debugging writeup once you've built and deployed this.
