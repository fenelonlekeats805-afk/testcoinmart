# Testcoin Agent Skill Guide

## Goal
Enable any agent/script to get V1 testnet tokens with:
1. Faucet-first strategy
2. Paid API fallback when faucet is insufficient

## API references
- OpenAPI: `docs/skills/openapi.yaml`
- Marketplace name skill JSON: `docs/skills/get-test-faucet-skill.json`
- Skill JSON: `docs/skills/testcoin-buy-skill.json`
- Faucet-first Skill JSON: `docs/skills/testcoin-faucet-first-skill.json`
- Faucet research map: `docs/research/faucets.md`

## Recommended skill entry (for Clawdbot/Codex/Claude Code)
- Prefer `get-test-faucet-skill.json`.
- Agent intent:
  - "Try official faucet routes for selected SKU first."
  - "If faucet fails or amount is insufficient within time budget, auto-switch to paid purchase flow."

## Public curl usage
- List skills:
  - `curl https://testcoinmart.top/v1/skills`
- Get marketplace default skill (`get test faucet`):
  - `curl https://testcoinmart.top/v1/skills/get-test-faucet`
- Get faucet-first skill JSON:
  - `curl https://testcoinmart.top/v1/skills/faucet-first`
- Get purchase-only skill JSON:
  - `curl https://testcoinmart.top/v1/skills/buy`
- Get OpenAPI YAML:
  - `curl https://testcoinmart.top/v1/skills/openapi.yaml`

## Mandatory rules
1. Use exact amount only. Raw token amount must equal `expectedRawAmount`.
2. Quantity must satisfy product `minPurchaseQty` and `quantityStep`.
3. Do not pay after expiration (`10 minutes`).
4. Never send duplicate payment to the same order address.
5. For Solana SKU, include `solCluster` (`devnet` or `testnet`) when creating order.
6. For Sui SKU, provide a valid `0x`-prefixed Sui address.
7. Faucet fallback rule: if faucet claim fails/rate-limits/insufficient amount/time budget exceeded, switch to paid API flow.

## Purchase flow
1. `GET /v1/products`
2. Select `quantity` by product `minPurchaseQty` and `quantityStep`
3. `POST /v1/orders`
4. Use one item from `paymentOptions` (chain + token + address + exact amount)
5. Pay exact stablecoin amount
6. Poll `GET /v1/orders/{order_id}` every 3-5 seconds until one of:
   - `FULFILLED`
   - `FULFILL_FAILED_MANUAL`
   - `EXPIRED`

## Error handling
- `429` on order creation: wait and retry later.
- `EXPIRED`: do not auto-pay, create support ticket.
- `EXTRA_PAYMENT`: manual-only handling.
- Faucet unavailable/insufficient: use paid fallback (no retries beyond configured faucet attempts).
