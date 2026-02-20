# Skills Marketplace Publish

Skill listing name: `get test faucet`

## Public URLs for listing
- Skills index: `https://testcoinmart.top/v1/skills`
- Skill payload: `https://testcoinmart.top/v1/skills/get-test-faucet`
- OpenAPI: `https://testcoinmart.top/v1/skills/openapi.yaml`
- Human guide: `https://testcoinmart.top/skills`

## Suggested listing copy
- Title: `get test faucet`
- One-line: `Faucet-first testnet token skill with paid fallback when faucet quota is insufficient.`
- Category: `Developer Tools` / `Blockchain`

## Quick validation before publish
1. `curl https://testcoinmart.top/v1/skills`
2. `curl https://testcoinmart.top/v1/skills/get-test-faucet`
3. `curl https://testcoinmart.top/v1/skills/openapi.yaml`
4. Confirm endpoints return `200`.

## Known marketplaces
- SkillHub (auto-index style via public skill docs)
- Agent skill directories that accept OpenAPI/JSON skill links

## Notes
- Keep `/v1/skills/get-test-faucet` stable. Market listings should point to this URL.
- Update `version` in `docs/skills/get-test-faucet-skill.json` when behavior changes.
