import { ethers } from 'ethers';
import { getScriptConfig, printConfig } from '../utils/get-config';

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
    
    // 设置 provider
    const provider = new ethers.JsonRpcProvider(config.network.rpcUrl);
    
    // 加载合约实例（只读，不需要私钥）
    const AgentNFTArtifact = require('../../artifacts/contracts/AgentNFT.sol/AgentNFT.json');
    const contract = new ethers.Contract(config.contracts.agentNFTAddress, AgentNFTArtifact.abi, provider);
    
    console.log('\n📄 Contract Information:');
    console.log('=' .repeat(50));
    
    // 基本信息
    const [name, symbol, version] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.VERSION()
    ]);
    
    console.log(`NFT Name: ${name}`);
    console.log(`NFT Symbol: ${symbol}`);
    console.log(`Contract Version: ${version}`);
    
    // 验证器地址
    const verifierAddress = await contract.verifier();
    console.log(`Verifier Address: ${verifierAddress}`);
    
    // 检查网络信息
    const network = await provider.getNetwork();
    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
    
    // 尝试查询现有的 tokens
    console.log('\n🔍 Checking for existing tokens...');
    console.log('=' .repeat(50));
    
    let tokenCount = 0;
    for (let i = 1; i <= 10; i++) {
      try {
        const owner = await contract.ownerOf(i);
        const dataHashes = await contract.dataHashesOf(i);
        const dataDescriptions = await contract.dataDescriptionsOf(i);
        const authorizedUsers = await contract.authorizedUsersOf(i);
        
        console.log(`\n📝 Token ${i}:`);
        console.log(`   Owner: ${owner}`);
        console.log(`   Data Items: ${dataHashes.length}`);
        console.log(`   Descriptions: ${dataDescriptions.length > 0 ? dataDescriptions[0] : 'None'}`);
        console.log(`   Authorized Users: ${authorizedUsers.length}`);
        
        tokenCount++;
      } catch (error) {
        // Token doesn't exist, continue
        break;
      }
    }
    
    if (tokenCount === 0) {
      console.log('ℹ️  No tokens found. This is normal for a new deployment.');
      console.log('💡 Run `pnpm run mint-example` to create your first token!');
    } else {
      console.log(`\n✅ Found ${tokenCount} token(s) total.`);
    }
    
    // 如果有 PRIVATE_KEY，显示钱包信息
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
      const wallet = new ethers.Wallet(privateKey, provider);
      const balance = await provider.getBalance(wallet.address);
      
      console.log('\n👤 Wallet Information:');
      console.log('=' .repeat(50));
      console.log(`Address: ${wallet.address}`);
      console.log(`Balance: ${ethers.formatEther(balance)} OG`);
      
      // 检查该钱包拥有的 tokens
      let ownedTokens = [];
      for (let i = 1; i <= tokenCount; i++) {
        try {
          const owner = await contract.ownerOf(i);
          if (owner.toLowerCase() === wallet.address.toLowerCase()) {
            ownedTokens.push(i);
          }
        } catch (error) {
          // Token doesn't exist
        }
      }
      
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