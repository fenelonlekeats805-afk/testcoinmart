# Research Notes - Stablecoin Contracts & Decimals

Updated: 2026-02-12

## Official sources
- Circle official USDC contract addresses: https://developers.circle.com/stablecoins/usdc-contract-addresses
- Circle supported domains/chains: https://developers.circle.com/stablecoins/supported-domains
- Tether supported protocols: https://tether.to/en/supported-protocols

## Implementation policy
1. Stablecoin contract addresses are operator-provided environment variables.
2. Decimals are operator-provided environment variables and validated at startup.
3. Service startup fails if required contract/decimal config is missing.

## Reason
- Avoids hardcoded values drifting across environments.
- Makes all payment-critical parameters explicit and reviewable.
