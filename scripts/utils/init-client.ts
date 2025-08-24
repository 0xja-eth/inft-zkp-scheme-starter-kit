import { ethers } from 'ethers';
import { AgentNFTClient } from '../../shared/lib/clients/AgentNFTClient';
import { VerifierClient } from '../../shared/lib/clients/VerifierClient';
import { getScriptConfig, printConfig } from './get-config';
import {ZGStorageService} from "../../shared/lib/services/storage/ZGStorageService";
import {LocalStorageService} from "../../shared/lib/services/storage/LocalStorageService";
import {ZKCryptoService} from "../../shared/lib/services/crypto/CryptoServices";

/**
 * Initialize AgentNFTClient with standard setup (based on mint-agent.ts pattern)
 */
export function initializeAgentClient(requireWallet = true) {
  // Get configuration
  console.log('🔍 Loading configuration...');
  const config = getScriptConfig({ requireWallet, requireContract: true });
  
  // Print configuration
  printConfig(config);

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(config.network.rpcUrl);

  const wallet = config.wallet.privateKey ? new ethers.Wallet(config.wallet.privateKey, provider) : undefined;

  // Setup services
  const storage = wallet ?
      config.storage.zg ?
          new ZGStorageService(wallet, config.storage.zg, {
            fallbackServices: [ new LocalStorageService(config.storage.local) ]
          }) :
          new LocalStorageService(config.storage.local) :
      undefined;
  const zkCrypto = new ZKCryptoService()

  // Setup clients
  const verifierClient = wallet ? new VerifierClient(
    config.contracts.verifierAddress, wallet
  ) : undefined;

  const agentNFTClient = new AgentNFTClient(
    config.contracts.agentNFTAddress, verifierClient, wallet, storage, zkCrypto
  );

  return {
    provider,
    wallet,
    config,
    verifierClient,
    agentNFTClient
  };
}