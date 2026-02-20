# Research Notes - Faucet Paths (SKU-aligned)

Updated: 2026-02-13

Purpose:
- Provide agent-usable faucet routes for all 8 V1 SKUs.
- Define when to fall back to paid purchase API.

Source policy:
- Prefer official docs and official project-owned faucet pages.
- If faucet route is interactive (wallet connect, captcha, social login), mark as `manual_or_semi_auto`.

## SKU -> Faucet map

### 1) `xlayer_okb_test` (X Layer Testnet OKB)
- Official faucet page:
  - https://web3.okx.com/xlayer/faucet
- Official docs hub:
  - https://www.okx.com/web3/build/docs
- Notes:
  - Docs state daily faucet limit and bridge path from Sepolia test assets.
  - Automation level: `manual_or_semi_auto` (web flow).

### 2) `sui_testnet_sui` (Sui Testnet SUI)
- Official docs (Get Sui from faucet):
  - https://docs.sui.io/guides/developer/getting-started/get-coins
- Official faucet API endpoint (from docs):
  - `POST https://faucet.testnet.sui.io/v2/gas`
- Notes:
  - Docs explicitly mention rate limiting and endpoint usage.
  - Automation level: `auto` (API-friendly).

### 3) `sepolia_eth_test` (Sepolia ETH)
- Official Ethereum docs:
  - https://ethereum.org/en/developers/docs/networks/
- Faucet references listed on official docs include:
  - https://faucets.chain.link/sepolia
- Notes:
  - Amount/cooldown vary by faucet provider.
  - Automation level: `manual_or_semi_auto`.

### 4) `ton_test` (TON Test Token)
- Official TON docs (Get testnet coins):
  - https://docs.ton.org/v3/guidelines/smart-contracts/getting-started/testnet
- Notes:
  - Official path includes `@testgiver_ton_bot` and web form route.
  - Automation level: `manual_or_semi_auto` (bot/form based).

### 5) `solana_test` (Solana Test Token, devnet/testnet)
- Official Solana docs:
  - https://solana.com/docs/references/clusters
- Official faucet UI:
  - https://faucet.solana.com/
- Official cookbook airdrop references:
  - https://solana.com/developers/cookbook/development/test-sol
- Notes:
  - Devnet is the standard app testing network; testnet is for validator/network stress scenarios.
  - Automation level: `auto` for RPC `requestAirdrop` on supported cluster, otherwise `manual_or_semi_auto`.

### 6) `bnb_test` (BSC Testnet BNB)
- Official BNB Chain faucet page:
  - https://www.bnbchain.org/en/testnet-faucet
- Official docs (faucet references):
  - https://docs.bnbchain.org/bnb-smart-chain/developers/faucet/
- Notes:
  - Often includes anti-abuse gating/cooldown.
  - Automation level: `manual_or_semi_auto`.

### 7) `base_sepolia_eth_test` (Base Sepolia ETH)
- Official Base docs:
  - https://docs.base.org/base-chain/network-information/network-faucets
- Notes:
  - Base docs list official/partner faucet options for Base Sepolia assets.
  - Automation level: `manual_or_semi_auto`.

### 8) `arbitrum_sepolia_eth_test` (Arbitrum Sepolia ETH)
- Official Arbitrum docs:
  - https://docs.arbitrum.io/for-devs/dev-tools-and-resources/chain-info
- Notes:
  - Docs include Arbitrum Sepolia faucet options and bridge resources.
  - Automation level: `manual_or_semi_auto`.

## Fallback-to-paid decision (agent policy)

Use paid API fallback when any condition is true:
1. Faucet claim fails by provider limit/rate-limit/captcha or unavailable status.
2. Faucet amount received is below target amount needed by user.
3. Time budget exceeded (recommended default: 120-180 seconds per order intent).
4. SKU requires urgent delivery and faucet path is interactive-only.

Then run paid flow:
1. `GET /v1/products`
2. Validate quantity by `minPurchaseQty` + `quantityStep`
3. `POST /v1/orders`
4. Pay exact amount from `paymentOptions`
5. Poll `GET /v1/orders/{orderId}` until terminal status.
