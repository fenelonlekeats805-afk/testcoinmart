# Research Notes - TON

Updated: 2026-02-12

## Official sources
- TON address format reference: https://docs.ton.org/foundations/addresses/formats
- TON transfer example docs: https://docs.ton.org/standard/wallets/highload/v3/send-single-transfer
- TON mnemonics reference: https://docs.ton.org/standard/wallets/mnemonics
- TON SDK (`@ton/ton`) API reference via package types:
  - `TonClient`, `WalletContractV4` in `node_modules/@ton/ton/dist`
- TON crypto SDK (`@ton/crypto`) mnemonic/key APIs:
  - `mnemonicValidate`, `mnemonicToPrivateKey` in `node_modules/@ton/crypto/dist/mnemonic/mnemonic.d.ts`
  - README usage section: `node_modules/@ton/crypto/README.md`

## Implementation decisions
1. Dispatcher uses wallet v4 transfer flow via `TonClient` + `WalletContractV4`.
2. Address validation is done through SDK address parser before send.
3. Confirmation check uses wallet `seqno` increment (submission acknowledged) before marking fulfilled.
4. On error, route to `FULFILL_FAILED_MANUAL`.
5. Sender key supports both:
   - 64-byte secret key hex (`TON_SENDER_SECRET_KEY_HEX`, optional `0x` prefix), or
   - 24-word mnemonic (`TON_SENDER_MNEMONIC`).
   For backward compatibility, a 24-word value in `TON_SENDER_SECRET_KEY_HEX` is also accepted.

## Safety behavior
- Missing TON config values fail closed (manual queue), never silent auto-send.
