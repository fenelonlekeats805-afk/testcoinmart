# Research Notes - Sui (Testnet SUI dispatch)

Updated: 2026-02-12

## Official sources
- Sui TypeScript SDK docs (Sui client / execute tx): https://sdk.mystenlabs.com/typescript/sui-client
- Transaction building basics (`splitCoins`, transfer objects): https://sdk.mystenlabs.com/typescript/transaction-building/basics
- Sui coin management model (object-based coins): https://docs.sui.io/guides/developer/sui-101/coin-mgt
- Sui address utilities (`isValidSuiAddress`): https://sdk.mystenlabs.com/typescript/utils
- Sui public network endpoints: https://docs.sui.io/references/sui-api/sui-graphql/reference/devnet-network
- Sui finality/consensus concepts: https://docs.sui.io/concepts/research-papers

## Implementation decisions
1. V1 Sui SKU is fixed to **testnet** fulfillment.
2. Address validation requires:
   - `0x` prefix
   - SDK-level `isValidSuiAddress` check
3. Dispatcher flow:
   - query sender SUI balance with `client.getCoins()`
   - ensure `totalBalance >= dispatchAmount + gasBudget`
   - build transaction with object model (`splitCoins(tx.gas, [amount])`)
   - transfer resulting coin object to destination
   - `signAndExecuteTransaction` then `waitForTransaction`
   - persist tx digest as shipment tx hash
4. Failure policy:
   - Any Sui SDK/RPC/signing error routes order to `FULFILL_FAILED_MANUAL` with reason.

## Notes
- Sui is object-based, so dispatch cannot be implemented as EVM-like balance subtraction assumptions.
- Gas budget and sender key are mandatory environment configs for production.
