# Product proposal — NoxSplit

**Idea:** Private Payroll / Splits  
**Category:** Payments / Confidential DeFi  
**Network:** Midnight Preprod (L2/L3)

## Product

NoxSplit lets a payroll operator **commit a private split total** on Midnight. Recipients and amounts stay off the public ledger; observers only learn that a split was committed, how many commits exist, and a commitment hash.

## Why Midnight

- Private circuit parameters for the payroll amount
- Persistent hash commitments without cleartext disclosure
- Wallet-native proving via 1AM / dapp connector

## Data model (L2/L3)

| Data | Visibility |
|---|---|
| Private total amount | Private (circuit + witness claim) |
| Recipient labels (UI slots) | Local browser only — never on-chain |
| `splitCommitCount` | Public |
| `latestSplitCommitment` | Public |
| `lastSplitCommitted` | Public |

## Idea form answers

**Q1 — What are you building?**  
A private payroll/split commitment dApp: prove a split total was committed without revealing the amount on the public Midnight ledger.

**Q2 — Why does privacy matter?**  
Payroll amounts and recipient allocations are sensitive. Publishing cleartext totals enables inference attacks and competitive leakage. NoxSplit discloses only that a run was committed.

## Level 4–6 scope (proposal only — not implemented)

- L4: Multi-party recipient claims / encrypted allocation proofs
- L5: Recurring payroll schedules + role-gated operator keys
- L6: Mainnet hardening, indexer analytics, audit trail export
