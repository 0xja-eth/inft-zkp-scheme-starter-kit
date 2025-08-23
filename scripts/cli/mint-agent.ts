import { ethers } from 'ethers';
import { AgentNFTClient } from '../../shared/lib/AgentNFTClient';
import { AIModelData } from '../../shared/lib/types';
import { getScriptConfig, printConfig } from '../utils/get-config';

async function main() {
  try {
    // 获取配置
    console.log('🔍 Loading configuration...');
    const config = getScriptConfig({ requireWallet: true, requireContract: true });
    
    // 打印配置信息
    printConfig(config);

    // Setup provider and client
    const provider = new ethers.JsonRpcProvider(config.network.rpcUrl);

    const client = new AgentNFTClient(
      config.contracts.agentNFTAddress,
      config.wallet.privateKey,
      provider,
      config.ogStorage,
    );

    // AI Model data to mint
    const aiModelData: AIModelData = {
      model: 'gpt-4-agent',
      weights: 'https://storage.example.com/weights/gpt4-agent-v1.bin',
      config: {
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 0.9,
        specialization: 'financial-analysis',
      },
      capabilities: [
        'natural-language-processing',
        'financial-analysis',
        'risk-assessment',
        'report-generation'
      ],
      description: 'Advanced AI agent specialized in financial analysis and risk assessment',
      tags: ['finance', 'analysis', 'gpt-4', 'enterprise'],
    };

    console.log('Starting mint process...');
    console.log('AI Model Data:', JSON.stringify(aiModelData, null, 2));

    // Mint the AgentNFT
    const result = await client.mint(aiModelData);
    
    console.log('\n✅ Mint successful!');
    console.log(`Token ID: ${result.tokenId}`);
    console.log(`Transaction Hash: ${result.txHash}`);
    console.log(`Root Hash: ${result.rootHash}`);
    console.log(`Sealed Key: ${result.sealedKey}`);

    // Get token information
    console.log('\nFetching token information...');
    const tokenInfo = await client.getTokenInfo(result.tokenId);
    console.log('Token Info:', JSON.stringify(tokenInfo, null, 2));

  } catch (error: any) {
    console.error('❌ Mint failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n🎉 Mint example completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}