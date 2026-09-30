# Live demo

| Field | Value |
|---|---|
| Live URL | https://nox-split.vercel.app |
| GitHub | https://github.com/anyhonyde123-glitch/nox-split |
| Network | Midnight Preprod |
| Wallet | 1AM (primary) |
| Demo flow | Connect → Deploy/Join → enter private amount → Commit private split → ledger tape updates |

## Steps

1. Open https://nox-split.vercel.app and install [1AM](https://1am.xyz) if needed.
2. Connect on **Preprod**.
3. Deploy a new split run (or Join the README / DEPLOYMENT Preprod address once recorded).
4. Optionally label local recipient slots (browser-only).
5. Enter a private total amount → **Commit private split**.
6. Confirm the public tape shows `splitCommitCount++`, a new commitment, and `lastSplitCommitted`.
7. Confirm the private amount field clears after success.
