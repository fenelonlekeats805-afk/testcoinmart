# get test faucet

## Summary
Faucet-first skill for developers and coding agents.
Try official faucet sources first, and fallback to TestCoin Mart paid API when faucet is insufficient.

## Base URL
`https://testcoinmart.top/v1`

## Primary Skill Endpoint
`GET /skills/get-test-faucet`

## OpenAPI
`GET /skills/openapi.yaml`

## Workflow
1. `GET /products`
2. Select product and quantity using `minPurchaseQty` and `quantityStep`
3. `POST /orders`
4. Pick one `paymentOptions` entry and pay exact amount
5. Poll `GET /orders/{order_id}` every 3-5 seconds

## Hard Rules
- Exact raw amount only (`expectedRawAmount`).
- No duplicate payments for the same order address.
- Solana SKU requires `solCluster` (`devnet|testnet`).
- Sui SKU requires valid `0x`-prefixed Sui address.
- Terminal statuses: `FULFILLED`, `FULFILL_FAILED_MANUAL`, `EXPIRED`.

## Public Endpoints
- `GET https://testcoinmart.top/v1/skills`
- `GET https://testcoinmart.top/v1/skills/get-test-faucet`
- `GET https://testcoinmart.top/v1/skills/buy`
- `GET https://testcoinmart.top/v1/skills/openapi.yaml`
