import { parseEther } from "ethers";
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AgentNFTDeployModule = buildModule("AgentNFTDeployModule", (m) => {
  // 1. Parameters from environment variables with defaults
  const nftName = m.getParameter("nftName", process.env.ZG_NFT_NAME || "0G Agent NFT");
  const nftSymbol = m.getParameter("nftSymbol", process.env.ZG_NFT_SYMBOL || "A0GIA");
  const chainURL = m.getParameter("chainURL", process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai");
  const indexerURL = m.getParameter("indexerURL", process.env.ZG_INDEXER_URL || "https://indexer-storage-testnet-turbo.0g.ai");
  const initialVerifierAddress = m.getParameter("initialVerifierAddress", "0x0000000000000000000000000000000000000000");

  // 2. Deploy TEEVerifier first
  const teeVerifier = m.contract("TEEVerifier", [initialVerifierAddress], {
    id: "TEEVerifier",
  });

  // 3. Deploy AgentNFT implementation
  const agentNFTImpl = m.contract("AgentNFT", [], {
    id: "AgentNFTImpl",
  });

  // 4. Deploy UpgradeableBeacon for AgentNFT
  const agentNFTBeacon = m.contract("UpgradeableBeacon", [agentNFTImpl, m.getAccount(0)], {
    id: "AgentNFTBeacon",
    after: [agentNFTImpl],
  });

  // 5. Prepare initialization data for AgentNFT proxy
  // Note: In Ignition, we need to encode the initialization data manually
  const initializationData = m.encodeFunctionCall(agentNFTImpl, "initialize", [
    nftName,
    nftSymbol, 
    teeVerifier,
    chainURL,
    indexerURL
  ], {
    id: "encodeInitData",
    after: [teeVerifier, agentNFTBeacon],
  });

  // 6. Deploy BeaconProxy with initialization data
  const agentNFTProxy = m.contract("BeaconProxy", [agentNFTBeacon, initializationData], {
    id: "AgentNFTProxy",
    after: [agentNFTBeacon, initializationData],
  });

  // 7. Return all deployed contracts
  return {
    teeVerifier,
    agentNFTImpl,
    agentNFTBeacon,
    agentNFTProxy,
    // Convenience: return the proxy as the main AgentNFT contract
    agentNFT: agentNFTProxy,
  };
});

export default AgentNFTDeployModule;