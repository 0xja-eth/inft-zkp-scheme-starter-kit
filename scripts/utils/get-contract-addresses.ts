import * as fs from 'fs';
import * as path from 'path';

/**
 * 从 Ignition 部署信息中获取合约地址的工具脚本
 */

export interface DeployedAddresses {
  agentNFT: string;
  agentNFTImpl: string;
  teeVerifier: string;
  zkpVerifier: string;
  agentNFTBeacon: string;
}

/**
 * 从 Ignition 部署文件中读取合约地址
 */
export function getDeployedAddresses(chainId: number | string = 16601): DeployedAddresses {
  const deploymentPath = path.join(
    // __dirname,
    // '..',
    'ignition',
    'deployments',
    `chain-${chainId}`,
    'deployed_addresses.json'
  );

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment found for chain ${chainId}. Please deploy first.`);
  }

  const deployedAddresses = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

  return {
    // 主要使用的代理合约地址
    agentNFT: deployedAddresses['AgentNFTDeployModule#AgentNFTProxy'],
    // 其他合约地址
    agentNFTImpl: deployedAddresses['AgentNFTDeployModule#AgentNFTImpl'],
    teeVerifier: deployedAddresses['AgentNFTDeployModule#TEEVerifier'],
    zkpVerifier: deployedAddresses['AgentNFTDeployModule#ZKPVerifier'],
    agentNFTBeacon: deployedAddresses['AgentNFTDeployModule#AgentNFTBeacon'],
  };
}

/**
 * 设置环境变量中的合约地址（用于其他脚本）
 */
export function setAgentNFTAddress(chainId: number = 16601): string {
  const addresses = getDeployedAddresses(chainId);
  
  // 设置到环境变量
  process.env.AGENT_NFT_ADDRESS = addresses.agentNFT;
  
  console.log(`✅ AgentNFT contract address: ${addresses.agentNFT}`);
  console.log(`📋 All deployed contracts:`);
  console.log(`   - AgentNFT (Proxy): ${addresses.agentNFT}`);
  console.log(`   - Implementation: ${addresses.agentNFTImpl}`);
  console.log(`   - TEE Verifier: ${addresses.teeVerifier}`);
  console.log(`   - Beacon: ${addresses.agentNFTBeacon}`);
  
  return addresses.agentNFT;
}

// 如果直接运行此脚本
if (require.main === module) {
  try {
    setAgentNFTAddress(16601);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}