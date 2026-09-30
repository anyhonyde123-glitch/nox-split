import { describe, expect, it } from "vitest";
import {
  CLAIM_TAG,
  bytesToHex,
  createPrivateState,
  decodeAmount,
  encodeClaim,
  hexToBytes,
  witnesses,
} from "../src/witnesses.js";

describe("NoxSplit claim encoding", () => {
  it("encodes LE u64 amount in bytes 0..7 with NoxSplit tag at offset 24", () => {
    const claim = encodeClaim(1_250_000n);
    expect(claim).toHaveLength(32);
    const view = new DataView(claim.buffer);
    expect(view.getBigUint64(0, true)).toBe(1_250_000n);
    expect(new TextDecoder().decode(claim.slice(24, 32))).toBe(CLAIM_TAG);
    expect(CLAIM_TAG).toHaveLength(8);
  });

  it("decodeAmount matches encodeClaim", () => {
    expect(decodeAmount(encodeClaim(0n))).toBe(0n);
    expect(decodeAmount(encodeClaim(99n))).toBe(99n);
  });

  it("round-trips hex helpers", () => {
    const claim = encodeClaim(42n);
    const hex = bytesToHex(claim);
    expect(hex).toHaveLength(64);
    expect(bytesToHex(hexToBytes(hex))).toBe(hex);
  });

  it("privateSplitClaim returns the same 32-byte claim", () => {
    const state = createPrivateState(777n);
    const [next, claim] = witnesses.privateSplitClaim({ privateState: state });
    expect(next).toBe(state);
    expect(claim).toHaveLength(32);
    expect(decodeAmount(claim)).toBe(777n);
  });

  it("rejects malformed private claims", () => {
    expect(() =>
      witnesses.privateSplitClaim({
        privateState: { claim: new Uint8Array(16) },
      }),
    ).toThrow(/32-byte claim/);
  });
});
