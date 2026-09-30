# NoxSplit — deployment

| Field | Value |
|---|---|
| Network | Preprod (Level 2 — Waxing Crescent) |
| Contract address | `PENDING_PREPROD_DEPLOY` |
| Deployer unshielded | `(deploy via 1AM UI or MIDNIGHT_SEED)` |
| Timestamp (UTC) | pending |
| Proof server | `http://127.0.0.1:6300` (or wallet prover) |
| Indexer | `https://indexer.preprod.midnight.network/api/v4/graphql` |
| Node / RPC | `https://rpc.preprod.midnight.network` |
| Faucet | `https://faucet.preprod.midnight.network` |

## Notes

- Level 2 requires a **Preprod** address.
- Preferred path: open the live Vercel app → Connect 1AM → **Deploy new run** → paste address here and in README.
- CLI alternate: `MIDNIGHT_SEED=<64-hex> npm run deploy:preprod` (local proof-server required).
- Secrets (seeds) are never committed.

## Update command

```bash
MIDNIGHT_CONTRACT_ADDRESS=<hex> RECORD_ONLY=1 npm run deploy:preprod
```
