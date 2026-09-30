import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  ledger,
} from "../contracts/managed/nox-split/contract/index.js";
import {
  createPrivateState,
  witnesses,
  type NoxSplitPrivateState,
} from "../src/witnesses.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const managed = join(root, "contracts", "managed", "nox-split");

const COIN = "0".repeat(64);
const ADDR = RT.sampleContractAddress();

function setup(amount: bigint) {
  const privateState: NoxSplitPrivateState = createPrivateState(amount);
  const contract = new Contract(witnesses);
  const ctor = contract.initialState(
    RT.createConstructorContext(privateState, COIN),
  );
  const ctx = RT.createCircuitContext(
    ADDR,
    COIN,
    ctor.currentContractState,
    ctor.currentPrivateState,
  );
  return { contract, ctx, privateState };
}

describe("NoxSplit managed artifacts", () => {
  it("ships compiler, contract, keys, and zkir directories", () => {
    for (const dir of ["compiler", "contract", "keys", "zkir"]) {
      expect(existsSync(join(managed, dir)), `missing ${dir}`).toBe(true);
    }
  });

  it("lists expected circuits and witness in contract-info.json", () => {
    const infoPath = join(managed, "compiler", "contract-info.json");
    expect(existsSync(infoPath)).toBe(true);
    const info = JSON.parse(readFileSync(infoPath, "utf8")) as {
      circuits: { name: string }[];
      witnesses: { name: string }[];
      "compiler-version": string;
    };
    expect(info["compiler-version"]).toBe("0.31.1");
    const names = info.circuits.map((c) => c.name).sort();
    expect(names).toEqual(
      [
        "commitSplit",
        "getLastSplitCommitted",
        "getLatestSplitCommitment",
        "getSplitCommitCount",
      ].sort(),
    );
    expect(info.witnesses.map((w) => w.name)).toContain("privateSplitClaim");
  });

  it("has prover/verifier keys for every circuit", () => {
    const keys = readdirSync(join(managed, "keys"));
    for (const circuit of [
      "commitSplit",
      "getSplitCommitCount",
      "getLastSplitCommitted",
      "getLatestSplitCommitment",
    ]) {
      expect(keys).toContain(`${circuit}.prover`);
      expect(keys).toContain(`${circuit}.verifier`);
    }
  });
});

describe("NoxSplit runtime ledger", () => {
  it("starts with lastSplitCommitted=false, count=0, empty commitment", () => {
    const { ctx } = setup(100n);
    const state = ledger(ctx.currentQueryContext.state);
    expect(state.lastSplitCommitted).toBe(false);
    expect(state.splitCommitCount).toBe(0n);
    expect(state.latestSplitCommitment.every((b) => b === 0)).toBe(true);
  });

  it("amount > 0 sets lastSplitCommitted=true and bumps count", () => {
    const { contract, ctx } = setup(5_000n);
    const after = contract.impureCircuits.commitSplit(ctx, 5_000n);
    const state = ledger(after.context.currentQueryContext.state);
    expect(state.lastSplitCommitted).toBe(true);
    expect(state.splitCommitCount).toBe(1n);
    expect(state.latestSplitCommitment.some((b) => b !== 0)).toBe(true);

    const committed = contract.impureCircuits.getLastSplitCommitted(
      after.context,
    );
    expect(committed.result).toBe(true);
    const count = contract.impureCircuits.getSplitCommitCount(after.context);
    expect(count.result).toBe(1n);
  });

  it("amount == 0 still commits with lastSplitCommitted=false", () => {
    const { contract, ctx } = setup(0n);
    const after = contract.impureCircuits.commitSplit(ctx, 0n);
    const state = ledger(after.context.currentQueryContext.state);
    expect(state.lastSplitCommitted).toBe(false);
    expect(state.splitCommitCount).toBe(1n);
    expect(state.latestSplitCommitment.some((b) => b !== 0)).toBe(true);
  });

  it("increments splitCommitCount across successive commits", () => {
    const { contract, ctx } = setup(10n);
    const first = contract.impureCircuits.commitSplit(ctx, 10n);
    const second = contract.impureCircuits.commitSplit(first.context, 20n);
    const state = ledger(second.context.currentQueryContext.state);
    expect(state.splitCommitCount).toBe(2n);
    expect(state.lastSplitCommitted).toBe(true);
    const commitment = contract.impureCircuits.getLatestSplitCommitment(
      second.context,
    );
    expect((commitment.result as Uint8Array).some((b) => b !== 0)).toBe(true);
  });

  it("does not put cleartext amount on the public ledger view", () => {
    const { contract, ctx } = setup(9_999n);
    const after = contract.impureCircuits.commitSplit(ctx, 9_999n);
    const state = ledger(after.context.currentQueryContext.state);
    const keys = Object.keys(state).sort();
    expect(keys).toEqual(
      ["lastSplitCommitted", "latestSplitCommitment", "splitCommitCount"].sort(),
    );
    // Public fields only — no amount / recipient cleartext keys.
    expect("amount" in state).toBe(false);
    expect("recipients" in state).toBe(false);
    const commitmentHex = Array.from(state.latestSplitCommitment as Uint8Array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    // Commitment is a hash, not the LE encoding of 9999.
    expect(commitmentHex.startsWith("0f27000000000000")).toBe(false);
  });
});
