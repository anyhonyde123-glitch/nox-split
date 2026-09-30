import { useCallback, useEffect, useRef, useState } from "react";
import "@midnight-ntwrk/dapp-connector-api";
import { useMidnightWallet } from "./hooks/useLaceWallet";
import { clearProvidersCache, getProviders } from "./lib/providers";
import {
  commitSplit,
  deployNoxSplit,
  joinNoxSplit,
  readPublicState,
  type PublicLedgerView,
} from "./lib/noxSplitApi";
import { DEFAULT_CONTRACT_ADDRESS, PREPROD } from "./lib/config";

function shortAddr(value: string): string {
  if (value.length < 20) return value;
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

type RecipientSlot = { id: number; label: string };

const INITIAL_RECIPIENTS: RecipientSlot[] = [
  { id: 1, label: "Recipient 1" },
  { id: 2, label: "Recipient 2" },
  { id: 3, label: "Recipient 3" },
];

export default function App() {
  const wallet = useMidnightWallet();
  const [contractAddress, setContractAddress] = useState(
    DEFAULT_CONTRACT_ADDRESS,
  );
  const [joined, setJoined] = useState(false);
  const [runTitle, setRunTitle] = useState("March payroll batch");
  const [recipients, setRecipients] =
    useState<RecipientSlot[]>(INITIAL_RECIPIENTS);
  const [amountInput, setAmountInput] = useState("");
  const [ledger, setLedger] = useState<PublicLedgerView | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [status, setStatus] = useState(
    "Connect 1AM on Preprod to open a split run.",
  );
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const autoJoinTried = useRef(false);

  const walletLabel = wallet.walletName ?? "1AM";

  const requireApi = useCallback(() => {
    const session = wallet.session.current;
    if (!session) throw new Error("Connect 1AM first");
    return session.api;
  }, [wallet.session]);

  const doJoin = useCallback(
    async (address: string, silent = false) => {
      const trimmed = address.trim();
      if (!trimmed) {
        setActionError("Paste a Preprod contract address first.");
        return false;
      }
      if (!silent) {
        setActionBusy(true);
        setActionError(null);
        setStatus("Joining split run via indexer (no wallet tx)…");
      }
      try {
        const providers = await getProviders(requireApi());
        await joinNoxSplit(providers, trimmed);
        const view = await readPublicState(providers, trimmed);
        setLedger(view);
        setJoined(true);
        setContractAddress(trimmed);
        setStatus(`Joined run ${shortAddr(trimmed)} — ready to commit`);
        setActionError(null);
        return true;
      } catch (err) {
        setJoined(false);
        setActionError(err instanceof Error ? err.message : String(err));
        setStatus("Join failed.");
        return false;
      } finally {
        if (!silent) setActionBusy(false);
      }
    },
    [requireApi],
  );

  useEffect(() => {
    if (!wallet.connected) {
      autoJoinTried.current = false;
      setJoined(false);
      clearProvidersCache();
      setStatus("Connect 1AM on Preprod to open a split run.");
      return;
    }
    if (autoJoinTried.current || joined || !contractAddress.trim()) return;
    autoJoinTried.current = true;
    setStatus("Auto-joining Preprod split run…");
    void doJoin(contractAddress, true).then((ok) => {
      if (!ok) {
        setStatus("Connect OK — Deploy a new run or Join an existing address.");
      }
    });
  }, [wallet.connected, contractAddress, joined, doJoin]);

  async function onDeploy() {
    setActionBusy(true);
    setActionError(null);
    setStatus("Deploying NoxSplit run to Preprod (proving may take a minute)…");
    try {
      const providers = await getProviders(requireApi());
      const { address } = await deployNoxSplit(providers, 0n);
      setContractAddress(address);
      setJoined(true);
      const view = await readPublicState(providers, address);
      setLedger(view);
      setStatus(`Deployed new run ${shortAddr(address)}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      setStatus("Deploy failed.");
    } finally {
      setActionBusy(false);
    }
  }

  async function onCommit() {
    const amount = BigInt(amountInput.trim() || "0");
    if (amount < 0n) {
      setActionError("Amount must be a non-negative integer.");
      return;
    }
    if (!contractAddress.trim() || !joined) {
      setActionError("Deploy or join a split run first.");
      return;
    }

    setActionBusy(true);
    setActionError(null);
    setStatus("Proving split commitment…");
    try {
      const providers = await getProviders(requireApi());
      const result = await commitSplit(
        providers,
        contractAddress.trim(),
        amount,
      );
      setLedger(result.public);
      setTxHash(result.txHash ?? null);
      setAmountInput("");
      setStatus(
        `Split committed. Public tape updated — private amount cleared locally.`,
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      setStatus("Commit failed.");
    } finally {
      setActionBusy(false);
    }
  }

  function updateRecipient(id: number, label: string) {
    setRecipients((rows) =>
      rows.map((row) => (row.id === id ? { ...row, label } : row)),
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1>NoxSplit</h1>
          <p>
            Commit a private payroll split on Midnight Preprod. Observers see
            that a split happened — never the amount.
          </p>
        </div>
        <div className="wallet-box">
          {wallet.connected ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={wallet.disconnect}
                disabled={wallet.busy || actionBusy}
              >
                Disconnect {walletLabel}
              </button>
              <div className="wallet-meta">
                <div>
                  Network: <strong>{wallet.session.current?.networkId ?? "preprod"}</strong>
                </div>
                <div title={wallet.address ?? ""}>
                  {shortAddr(wallet.address ?? "")}
                </div>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void wallet.connect()}
              disabled={wallet.busy}
            >
              {wallet.busy ? "Connecting…" : "Connect 1AM"}
            </button>
          )}
          {wallet.error ? <div className="error-line">{wallet.error}</div> : null}
        </div>
      </header>

      <div className="layout">
        <section className="panel">
          <h2>Split run</h2>
          <p className="hint">
            Recipient labels stay in your browser only. The private total is
            proven in-circuit and never mirrored on the public ledger tape.
          </p>

          <div className="field">
            <label htmlFor="run-title">Run title (local only)</label>
            <input
              id="run-title"
              value={runTitle}
              onChange={(e) => setRunTitle(e.target.value)}
              placeholder="e.g. March payroll batch"
            />
          </div>

          <div className="recipients">
            {recipients.map((row) => (
              <div className="recipient-row" key={row.id}>
                <span>Slot {row.id}</span>
                <input
                  aria-label={`Recipient ${row.id} local label`}
                  value={row.label}
                  onChange={(e) => updateRecipient(row.id, e.target.value)}
                  placeholder={`Recipient ${row.id}`}
                />
              </div>
            ))}
          </div>

          <div className="field">
            <label htmlFor="amount">Private total amount</label>
            <input
              id="amount"
              inputMode="numeric"
              value={amountInput}
              onChange={(e) =>
                setAmountInput(e.target.value.replace(/[^\d]/g, ""))
              }
              placeholder="e.g. 1250000"
              autoComplete="off"
            />
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!wallet.connected || actionBusy || !joined}
              onClick={() => void onCommit()}
            >
              {actionBusy && status.includes("Proving")
                ? "Proving split commitment…"
                : "Commit private split"}
            </button>
          </div>

          <div className="status-line">{status}</div>
          {actionError ? <div className="error-line">{actionError}</div> : null}
          {txHash ? (
            <div className="status-line">
              Tx: <code>{txHash}</code>
            </div>
          ) : null}
        </section>

        <section className="panel tape">
          <h2>Ledger tape</h2>
          <p className="hint">
            Public Preprod view — count, commitment hash, and committed flag
            only.
          </p>

          <div className="contract-row">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="contract">Contract address</label>
              <input
                id="contract"
                value={contractAddress}
                onChange={(e) => {
                  setContractAddress(e.target.value);
                  setJoined(false);
                }}
                placeholder="Paste Preprod contract address"
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!wallet.connected || actionBusy}
              onClick={() => void onDeploy()}
            >
              Deploy new run
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!wallet.connected || actionBusy}
              onClick={() => void doJoin(contractAddress)}
            >
              Join run
            </button>
          </div>

          <div className="tape-grid" style={{ marginTop: "1rem" }}>
            <div className="tape-item">
              <span className="k">splitCommitCount</span>
              <span className="v">
                {ledger ? ledger.splitCommitCount.toString() : "—"}
              </span>
            </div>
            <div className="tape-item">
              <span className="k">lastSplitCommitted</span>
              <span className="v">
                {ledger ? String(ledger.lastSplitCommitted) : "—"}
              </span>
            </div>
            <div className="tape-item">
              <span className="k">latestSplitCommitment</span>
              <span className="v">
                {ledger?.latestSplitCommitmentHex
                  ? shortAddr(ledger.latestSplitCommitmentHex)
                  : "—"}
              </span>
            </div>
            <div className="tape-item">
              <span className="k">explorer</span>
              <span className="v">
                {contractAddress.trim() ? (
                  <a
                    href={`${PREPROD.explorerContractBase}/${contractAddress.trim()}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--ledger)" }}
                  >
                    Preprod contract
                  </a>
                ) : (
                  "—"
                )}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
