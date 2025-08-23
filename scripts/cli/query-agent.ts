import { ethers } from 'ethers';
import { getScriptConfig, printConfig } from '../utils/get-config';
import { initializeAgentClient } from '../utils/init-client';

/**
 * 查询合约信息的脚本，无需参数，从环境变量获取所有配置
 */
async function main() {
  try {
    // 获取配置（查询操作不需要私钥）
    console.log('🔍 Loading configuration...');
    const config = getScriptConfig({ requireWallet: false, requireContract: true });
    
    // 打印配置信息
    printConfig(config);
    
    // 如果有私钥，使用 AgentNFTClient；否则直接使用 provider
    const hasPrivateKey = process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length > 0;

    const { provider, agentNFTClient, wallet } = initializeAgentClient(!!hasPrivateKey);

    // 获取合约信息
    console.log('\n📄 Contract Information:');
    console.log('=' .repeat(50));

    const contractInfo = await agentNFTClient.getContractInfo();
    console.log(`NFT Name: ${contractInfo.name}`);
    console.log(`NFT Symbol: ${contractInfo.symbol}`);
    console.log(`Contract Version: ${contractInfo.version}`);
    console.log(`Verifier Address: ${contractInfo.verifier}`);
    console.log(`Contract Address: ${contractInfo.address}`);

    // 获取网络信息
    const networkInfo = await provider.getNetwork();
    console.log(`Network: ${networkInfo.name} (Chain ID: ${networkInfo.chainId})`);

    // 查询现有 tokens
    console.log('\n🔍 Checking for existing tokens...');
    console.log('=' .repeat(50));

    const existingTokens = await agentNFTClient.getExistingTokens(10);

    if (existingTokens.length === 0) {
      console.log('ℹ️  No tokens found. This is normal for a new deployment.');
      console.log('💡 Run `pnpm run mint-example` to create your first token!');
    } else {
      console.log(`\n✅ Found ${existingTokens.length} token(s): ${existingTokens.join(', ')}`);

      // 显示每个 token 的详细信息
      for (const tokenId of existingTokens) {
        try {
          const tokenInfo = await agentNFTClient.getTokenInfo(tokenId);
          console.log(`\n📝 Token ${tokenId}:`);
          console.log(`   Owner: ${tokenInfo.owner}`);
          console.log(`   Data Items: ${tokenInfo.dataHashes.length}`);
          console.log(`   Descriptions: ${tokenInfo.dataDescriptions.length > 0 ? tokenInfo.dataDescriptions[0] : 'None'}`);
          console.log(`   Authorized Users: ${tokenInfo.authorizedUsers.length}`);
        } catch (error) {
          console.log(`\n❌ Error getting info for token ${tokenId}: ${(error as Error).message}`);
        }
      }
    }

    if (wallet) {
      // 钱包信息
      console.log('\n👤 Wallet Information:');
      console.log('=' .repeat(50));
      console.log(`Address: ${wallet.address}`);
      
      const balance = await provider.getBalance(wallet.address);
      console.log(`Balance: ${balance} OG`);
      
      // 获取拥有的 tokens
      const ownedTokens = await agentNFTClient.getOwnedTokens(wallet.address, 10);
      if (ownedTokens.length > 0) {
        console.log(`Owned Tokens: ${ownedTokens.join(', ')}`);
      } else {
        console.log('Owned Tokens: None');
      }
    }
    
    console.log('\n✅ Contract query completed!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n🎉 Query completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}