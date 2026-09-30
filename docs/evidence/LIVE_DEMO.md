# Live demo

| Field | Value |
|---|---|
| Live URL | TBD after Vercel deploy |
| Network | Midnight Preprod |
| Wallet | 1AM (primary) |
| Demo flow | Connect → Deploy/Join → enter private amount → Commit private split → ledger tape updates |

## Steps

1. Open the live URL and install [1AM](https://1am.xyz) if needed.
2. Connect on **Preprod**.
3. Deploy a new split run (or Join the README Preprod address).
4. Optionally label local recipient slots (browser-only).
5. Enter a private total amount → **Commit private split**.
6. Confirm the public tape shows `splitCommitCount++`, a new commitment, and `lastSplitCommitted`.
7. Confirm the private amount field clears after success.
