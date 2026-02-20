# get test faucet

Faucet-first skill for developers and coding agents: try official testnet faucets first, then buy testnet coins from TestCoin Mart when faucet quota or speed is not enough.

## Endpoints
- Skills index: `https://testcoinmart.top/v1/skills`
- Default skill: `https://testcoinmart.top/v1/skills/get-test-faucet`
- OpenAPI: `https://testcoinmart.top/v1/skills/openapi.yaml`
- Human guide: `https://testcoinmart.top/skills`

## Core flow
1. Discover supported products with `GET /v1/products`.
2. Create order with `POST /v1/orders`.
3. Pay exact amount to the order-specific payin address.
4. Poll `GET /v1/orders/{order_id}` until final state.

## Final states
- `FULFILLED`
- `FULFILL_FAILED_MANUAL`
- `EXPIRED`

## Guardrails
- Exact raw amount matching.
- Per-order dedicated payin addresses.
- Confirmation threshold per payment chain.
- No automatic refunds in V1.
