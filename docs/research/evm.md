# Research Notes - EVM (BSC / BASE)

Updated: 2026-02-13

## Official sources
- ERC-20 standard (Transfer event): https://eips.ethereum.org/EIPS/eip-20
- ethers v6 provider APIs (`getLogs`, `getBlockNumber`, receipts): https://docs.ethers.org/v6/api/providers/
- BNB Smart Chain JSON-RPC docs: https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/
- Base docs + network access references: https://docs.base.org
- Circle official USDC contract list (mainnet/testnet): https://developers.circle.com/stablecoins/usdc-contract-addresses
- Tether official supported protocols (contract discovery entry): https://tether.to/en/supported-protocols

## Implementation decisions
1. Payment watcher decodes only ERC-20 `Transfer(address,address,uint256)` logs.
2. Exact payment matching is done with all of:
   - `token_contract` exact match
   - `to_address` exact match to order address
   - `raw_amount` exact integer match (`uint256` as string)
   - `confirmations >= chain threshold`
3. Confirmations formula used in code:
   - `currentBlock - txBlock + 1`
4. Token contracts and decimals are **environment-driven** (no hardcoding in code), and service fails at startup if missing.
5. Watchers query `eth_getLogs` with indexed `to` topic filters from active order addresses (not full-contract scans) to reduce rate-limit pressure and false positives.
6. Scan range uses conservative block windows (`*_LOG_BLOCK_STEP`) and per-request delay (`*_LOG_REQUEST_DELAY_MS`) for public RPC compatibility.

## Why this is safe for V1
- Avoids ambiguous amount matching in public unauthenticated API mode.
- Keeps chain configuration auditable and explicit per environment.
- Prevents accidental deployment with guessed decimals/contracts.
