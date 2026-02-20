# Target Marketplaces (4/5/6)

This file is the operational checklist for the selected channels:

4. Agent Skills (`agent-skills.cc`)
5. AgentSkillsRepo (`agentskillsrepo.com`)
6. Agent Skills Index (`agentskillsindex.com`)

## Canonical listing data
- Name: `get test faucet`
- Repository: `https://github.com/fenelonlekeats805-afk/testcoinmart`
- Root skill file: `https://github.com/fenelonlekeats805-afk/testcoinmart/blob/main/SKILL.md`
- Skill JSON URL: `https://testcoinmart.top/v1/skills/get-test-faucet`
- Skills index URL: `https://testcoinmart.top/v1/skills`
- OpenAPI URL: `https://testcoinmart.top/v1/skills/openapi.yaml`
- Guide URL: `https://testcoinmart.top/skills`

## Copy-paste summary
`get test faucet` helps agents get testnet tokens with a faucet-first strategy, then falls back to paid purchase on TestCoin Mart when faucet quota is insufficient.

## Platform submission steps

### 4) Agent Skills (`agent-skills.cc`)
1. Open the submit page and sign in with GitHub if prompted.
2. Submit repository URL: `https://github.com/fenelonlekeats805-afk/testcoinmart`.
3. Confirm that crawler can find `SKILL.md` at repo root.
4. Verify listing links point to `testcoinmart.top`.

### 5) AgentSkillsRepo (`agentskillsrepo.com`)
1. Open `https://www.agentskillsrepo.com/submit`.
2. Paste repo URL and skill title `get test faucet`.
3. Add short description from the summary above.
4. Provide skill endpoint: `https://testcoinmart.top/v1/skills/get-test-faucet`.
5. Submit and wait for moderation/indexing.

### 6) Agent Skills Index (`agentskillsindex.com`)
1. Open `https://agentskillsindex.com/submit`.
2. Submit repo URL and skill URL.
3. Ensure root `SKILL.md` exists (required by many indexers).
4. After approval, validate the indexed links resolve to `200`.

## Post-submit validation
Run:

```bash
curl https://testcoinmart.top/v1/skills
curl https://testcoinmart.top/v1/skills/get-test-faucet
curl https://testcoinmart.top/v1/skills/openapi.yaml
```

All should return `200`.
