# Research Notes - SOL (SPL Token on Solana)

Updated: 2026-02-13

## Official sources
- Solana RPC API reference (`getSignaturesForAddress`, `getTransaction`, `getSlot`): https://solana.com/docs/rpc
- SPL Associated Token Account program: https://spl.solana.com/associated-token-account
- Solana payment verification guidance (token balances / tx verification): https://solana.com/docs/payments/accept-payments/verification-tools

## Implementation decisions
1. Watcher reads candidate signatures by destination address and parses transaction instructions.
2. SPL transfer parsing accepts `transfer` and `transferChecked` instructions from `spl-token`/`spl-token-2022`.
3. ATA handling:
   - For each configured order address, watcher also derives owner ATA for the configured mint.
   - Destination is considered valid if it matches either the configured token-account address or derived ATA.
4. Confirmations use finalized slot depth:
   - `confirmations = finalizedSlot - txSlot + 1`
5. Matching remains strict:
   - mint == configured token contract
   - destination matches order address/ATA candidate
   - raw amount equals expected raw amount
6. Watcher performance decision for reliability:
   - Track address-level slot cursors (`watcher_cursor` keyed by `mint:address`) and only parse signatures with slot newer than cursor.
   - Throttle scans with `SOL_SIGNATURE_LIMIT`, `SOL_SCAN_TARGET_LIMIT`, and `SOL_SCAN_DELAY_MS` to reduce RPC 429 risk.

## Safety behavior
- If mint/destination/amount cannot be resolved from parsed transaction data, watcher skips the tx.
- No fallback to heuristic amount parsing.
