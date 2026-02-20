# Testcoin V1

V1 standalone site for selling testnet tokens using stablecoin payment confirmation + automated/manual dispatch flows.

## Monorepo layout
- `apps/web` customer website
- `apps/api` public API + order service + admin API
- `apps/admin` admin panel
- `services/watcher-*` payment watchers by chain
- `services/dispatcher-*` fulfillment dispatchers by ecosystem
- `packages/db` Prisma schema + seed
- `packages/shared` shared types
- `docs/skills` public skill guide/OpenAPI for agents
- `docs/research` web research evidence for external dependencies
- `infra` docker compose + monitoring

## Quick start
1. Copy `.env.example` to `.env` and fill all required values.
2. Install dependencies:
   - `npm install`
3. Generate Prisma client:
   - `npm run prisma:generate -w @testcoin/db`
4. Run migrations:
   - `npm run prisma:migrate -w @testcoin/db`
5. Seed products:
   - `npx ts-node packages/db/src/seed.ts`
6. Start stack:
   - `docker compose -f infra/docker-compose.yml up`

## Security notes
- Never share `.env` in chat, screenshots, archives, or tickets.
- Use `npm run package:deploy` to build deployment archive; it excludes `.env` and other sensitive files by default.
- Rotate credentials immediately if any password/key was pasted in public or semi-public channels.

## Public API
- `GET /v1/products`
- `POST /v1/orders` (IP limit)
- `GET /v1/orders/{order_id}`
- `POST /v1/support_tickets`
- `GET /v1/skills`

Swagger:
- `GET /v1/docs`

## Security model highlights
- One-order-one-address per chain+token.
- Exact raw amount match only.
- Confirmation thresholds by chain.
- Strict one-way order state transitions.
- DB uniqueness guardrails:
  - `payments.tx_hash`
  - `shipments.order_id`
  - `order_payment_addresses(order_id,chain,tokenSymbol)`

## Current V1 default behavior
- EVM, Solana, TON, and Sui dispatchers support auto-send when configured.
- Sui SKU replaces the legacy BTC Signet SKU in V1 product set.
- Orders support `quantity` (validated by per-product `minPurchaseQty` + `quantityStep`), and dispatch amount scales linearly by quantity.
- Any missing chain/token config causes explicit failure instead of guessed behavior.
