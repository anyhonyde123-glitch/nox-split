import { CompiledContract } from "@midnight-ntwrk/compact-js";
import {
  createCircuitCallTxInterface,
  deployContract,
  verifyContractState,
} from "@midnight-ntwrk/midnight-js-contracts";
import { ContractExecutable } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { sampleSigningKey } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { Contract, ledger } from "@ns/contract";
import {
  createPrivateState,
  PRIVATE_STATE_ID,
  witnesses,
  bytesToHex,
  type NoxSplitPrivateState,
} from "@ns/witnesses";
import type { NoxSplitProviders } from "./providers";

export type PublicLedgerView = {
  lastSplitCommitted: boolean;
  splitCommitCount: bigint;
  latestSplitCommitmentHex: string;
};

const compiledContract = CompiledContract.make("nox-split", Contract).pipe(
  CompiledContract.withWitnesses(witnesses as never),
);

export type DeployedNoxSplit = {
  deployTxData: {
    private: {
      signingKey: string;
      initialPrivateState: NoxSplitPrivateState;
    };
    public: {
      contractAddress: string;
      initialContractState: unknown;
    };
  };
  callTx: ReturnType<typeof createCircuitCallTxInterface>;
};

function bindPrivateState(
  providers: NoxSplitProviders,
  contractAddress: string,
): void {
  providers.privateStateProvider.setContractAddress(contractAddress);
}

function makeCallTx(providers: NoxSplitProviders, contractAddress: string) {
  return createCircuitCallTxInterface(
    providers,
    compiledContract,
    contractAddress,
    PRIVATE_STATE_ID,
  );
}

export async function deployNoxSplit(
  providers: NoxSplitProviders,
  amountForInitialState = 0n,
): Promise<{ contract: DeployedNoxSplit; address: string }> {
  const contract = await deployContract(providers, {
    compiledContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: createPrivateState(amountForInitialState),
  });
  const address = contract.deployTxData.public.contractAddress;
  bindPrivateState(providers, address);
  return {
    contract: {
      ...(contract as unknown as DeployedNoxSplit),
      callTx: makeCallTx(providers, address),
    },
    address,
  };
}

/**
 * Attach to an already-deployed Preprod contract.
 * Uses HTTP indexer queries (no watchForDeployTxData hang after later calls).
 */
export async function joinNoxSplit(
  providers: NoxSplitProviders,
  contractAddress: string,
  privateState?: NoxSplitPrivateState,
): Promise<DeployedNoxSplit> {
  const address = contractAddress.trim();
  if (!address) throw new Error("Contract address required");

  bindPrivateState(providers, address);

  const currentContractState =
    await providers.publicDataProvider.queryContractState(address);
  if (!currentContractState) {
    throw new Error(`No contract found on Preprod at ${address}`);
  }

  const initialContractState =
    (await providers.publicDataProvider.queryDeployContractState(address)) ??
    currentContractState;

  const circuitIds =
    ContractExecutable.make(compiledContract).getProvableCircuitIds();
  const verifierKeys =
    await providers.zkConfigProvider.getVerifierKeys(circuitIds);
  verifyContractState(verifierKeys, currentContractState);

  const existingKey =
    await providers.privateStateProvider.getSigningKey(address);
  const signingKey = existingKey ?? sampleSigningKey();
  if (!existingKey) {
    await providers.privateStateProvider.setSigningKey(address, signingKey);
  }

  const initialPrivateState = privateState ?? createPrivateState(0n);
  await providers.privateStateProvider.set(
    PRIVATE_STATE_ID,
    initialPrivateState,
  );

  return {
    deployTxData: {
      private: { signingKey, initialPrivateState },
      public: { contractAddress: address, initialContractState },
    },
    callTx: makeCallTx(providers, address),
  };
}

export async function readPublicState(
  providers: NoxSplitProviders,
  contractAddress: string,
): Promise<PublicLedgerView> {
  const state =
    await providers.publicDataProvider.queryContractState(contractAddress);
  if (!state) {
    throw new Error(`No contract state at ${contractAddress}`);
  }
  const view = ledger(state.data);
  return {
    lastSplitCommitted: Boolean(view.lastSplitCommitted),
    splitCommitCount: view.splitCommitCount as bigint,
    latestSplitCommitmentHex: bytesToHex(
      view.latestSplitCommitment as Uint8Array,
    ),
  };
}

/**
 * Prove + submit commitSplit, then refresh public view from indexer.
 */
export async function commitSplit(
  providers: NoxSplitProviders,
  contractAddress: string,
  amount: bigint,
): Promise<{
  txHash?: string;
  public: PublicLedgerView;
}> {
  const address = contractAddress.trim();
  if (!address) throw new Error("Contract address required");

  bindPrivateState(providers, address);
  await providers.privateStateProvider.set(
    PRIVATE_STATE_ID,
    createPrivateState(amount),
  );

  const before = await readPublicState(providers, address);
  const callTx = makeCallTx(providers, address);
  const txData = await callTx.commitSplit(amount);
  const pub = txData.public as { txHash?: string; txId?: string };

  let publicView = before;
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 1200));
    publicView = await readPublicState(providers, address);
    if (publicView.splitCommitCount !== before.splitCommitCount) break;
  }

  return {
    txHash: pub.txHash ?? pub.txId,
    public: publicView,
  };
}
