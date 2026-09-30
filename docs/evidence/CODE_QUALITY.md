# Code quality audit — NoxSplit

## Stack

| Layer | Choice |
|---|---|
| Compact | 0.31.1 |
| compact-runtime | 0.16.x |
| Midnight.js | 4.1.1 |
| Web | Vite + React 19 + TypeScript |
| Wallet | 1AM primary; dappConnectorProofProvider → HTTP fallback |
| Tests | Vitest (13) |
| CI | GitHub Actions: npm ci → test → web:sync-zk → web ci → web build |

## Privacy review

- Public ledger fields only: `lastSplitCommitted`, `splitCommitCount`, `latestSplitCommitment`
- Witness `privateSplitClaim`: LE u64 amount + `"NoxSplit"` tag
- UI clears private amount after successful commit
- Recipient labels never sent to circuits / ledger

## Architecture hygiene

- Session-cached providers (`getProviders`)
- `setContractAddress` rebound before commit
- Join uses indexer HTTP (no `watchForDeployTxData` hang)
- Vite ledger / onchain-runtime dedupe + Buffer/events/assert polyfills
- ZK assets synced to `web/public/zk/nox-split/`

## Risks / follow-ups

- Preprod deploy address must be recorded after funded 1AM deploy
- Demo video still a submission artifact
- Indexer lag handled via short poll loop after commit
