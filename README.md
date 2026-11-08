# StockBOT Frontend

The independent React/TypeScript frontend for StockBOT. It consumes the
versioned backend OpenAPI contract and contains no trading logic or backend
source imports. Shared architecture plans are in [`../docs/`](../docs/README.md).

The current backtest workspace runs the synthetic `PLATFORM_DEMO` pipeline and
shows immutable inputs, demo metrics, equity/drawdown, nested placeholder legs,
signals and events. These outputs use `DEMO_UNITS` and are not financial P&L.

## Setup

Node 22 and pnpm 10 are required.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Copy `.env.example` to `.env.local` to set the public API and WebSocket URLs.
Keep the UI, API, and WebSocket hostnames identical in local development (the
defaults consistently use `localhost`). Mixing `localhost` and `127.0.0.1`
prevents the browser from sending the strict HttpOnly session cookie.

The access key is submitted once to the backend and is never written to local
storage, application configuration, or the JavaScript bundle. Every protected
REST request includes the HttpOnly session cookie. The backend protects browser
mutations by validating the browser-supplied `Origin`; there is no frontend
CSRF token to store. An expired session clears in-memory query data and returns
the user to the unlock screen.

## Production container

The production image serves the Vite build through nginx with SPA routing,
no-cache runtime configuration, and baseline static security headers. Runtime
configuration is mandatory, contains no secret, and accepts secure endpoints
only:

```bash
docker build -t stockbot-frontend:0.1.0 .
docker run --rm -p 8080:80 \
  -e STOCKBOT_API_BASE_URL=https://stockbot.example.com \
  -e STOCKBOT_WEBSOCKET_URL=wss://stockbot.example.com/api/v1/ws \
  stockbot-frontend:0.1.0
```

The API and WebSocket URLs must use the same hostname so the session boundary
is predictable. Configure that browser origin in the backend CORS/origin
allowlist. TLS termination may sit in front of this container. Never place an
access key or server secret in a `VITE_*` variable or runtime config.
The development-only `/dev/system` page checks the Phase 1 backend foundation.

## Contract workflow

The committed `contracts/` snapshot is the pinned backend contract. To adopt a
new backend version explicitly:

```bash
BACKEND_WEBSOCKET_PATH=../stockBOT-backend/contracts/websocket-v1.json \
  BACKEND_OPENAPI_PATH=../stockBOT-backend/contracts/openapi.json \
  pnpm contract:sync
pnpm contract:generate
pnpm contract:check
```

`contract:check` independently verifies the pinned REST and WebSocket
checksums, their declared versions, generated REST types, and the WebSocket
demo-safety invariants.

## MVP safety boundary

`PLATFORM_DEMO` remains a synthetic, non-financial `DEMO_UNITS` fixture. The
Library and Studio also support Bull Call Spread V1 with an immutable
derivatives bundle, option contracts, and historical option-close execution.
Its INR outcomes are prominently labelled estimates because configurable
slippage is applied to OHLC closes; they are not executable bid/ask fills.
Broker integration and live trading are intentionally absent.

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm contract:check
pnpm build
```
