# Research Notes - TRON (TRC20 USDT)

Updated: 2026-02-13

## Official sources
- TronWeb `getEventResult` API docs: https://tronweb.network/docu/docs/API%20List/utils/getEventResult/
- TRON Developers: TRC-20 contract interaction: https://developers.tron.network/docs/trc20-contract-interaction
- TRON transaction query reference: https://developers.tron.network/reference/gettransactionbyid
- TRON API key guidance (rate limit / authenticated quota): https://developers.tron.network/reference/select-network#how-to-get-an-api-key

## Implementation decisions
1. TRON watcher uses contract event polling for `Transfer` events on configured TRC20 token contracts.
2. Incoming address normalization handles hex-style TRON addresses (`41...`) to base58 when needed.
3. Payment confirmation uses block-depth threshold with:
   - `confirmations = currentBlock - eventBlock + 1`
4. Matching remains strict:
   - `token_contract`, `to_address`, `raw_amount`, and confirmation threshold all required.
5. Production recommendation:
   - Set `TRON_API_KEY` and pass `TRON-PRO-API-KEY` header in watcher requests.
   - Use conservative polling/scan tuning (`TRON_WATCH_POLL_MS`, `TRON_EVENT_LIMIT`) to avoid 429.

## Safety behavior
- Any malformed event payload (missing tx hash / amount / block) is skipped, never auto-confirmed.
- Repeated payments are persisted as separate `payments` rows and routed to `EXTRA_PAYMENT` handling.
