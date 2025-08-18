import { ethers } from 'ethers';
import { AgentNFTClient } from '../../lib/AgentNFTClient';
import { getScriptConfig, getScriptParams, printConfig } from '../utils/get-config';

async function main() {
  try {
    // 获取配置
    console.log('🔍 Loading configuration...');
    const config = getScriptConfig({ requireWallet: true, requireContract: true });
    const params = getScriptParams();
    
    // 验证参数
    if (!params.tokenId || !params.recipientAddress) {
      console.log('Usage: npm run transfer-example <tokenId> <recipientAddress>');
      console.log('Example: npm run transfer-example 1 0x742d35Cc6634C0532925a3b8D0C3C19D2A8aE');
      console.log('Or set TOKEN_ID and RECIPIENT_ADDRESS in .env file');
      process.exit(1);
    }

    // 打印配置信息
    printConfig(config);

    // Setup provider and client
    const provider = new ethers.JsonRpcProvider(config.network.rpcUrl);

    const encryptionConfig = {
      algorithm: 'aes-256-gcm' as const,
      keyDerivation: 'pbkdf2' as const,
      iterations: 100000,
      keyLength: 32,
      ivLength: 12,
      tagLength: 16,
    };

    const client = new AgentNFTClient(
      config.contracts.agentNFTAddress,
      config.wallet.privateKey,
      provider,
      config.ogStorage
    );

    console.log(`Starting transfer process...`);
    console.log(`Token ID: ${params.tokenId}`);
    console.log(`Recipient: ${params.recipientAddress}`);

    // Check current owner
    console.log('\nChecking current ownership...');
    const tokenInfo = await client.getTokenInfo(params.tokenId!);
    console.log(`Current owner: ${tokenInfo.owner}`);
    
    const wallet = new ethers.Wallet(config.wallet.privateKey);
    if (tokenInfo.owner.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error(`You don't own token ${params.tokenId}. Current owner: ${tokenInfo.owner}`);
    }

    // Transfer the token
    console.log('\nExecuting transfer...');
    const txHash = await client.transfer(params.tokenId!, params.recipientAddress!);
    
    console.log('\n✅ Transfer successful!');
    console.log(`Transaction Hash: ${txHash}`);

    // Verify transfer
    console.log('\nVerifying transfer...');
    const updatedTokenInfo = await client.getTokenInfo(params.tokenId!);
    console.log(`New owner: ${updatedTokenInfo.owner}`);
    
    if (updatedTokenInfo.owner.toLowerCase() === params.recipientAddress!.toLowerCase()) {
      console.log('✅ Transfer verified!');
    } else {
      console.log('❌ Transfer verification failed');
    }

  } catch (error: any) {
    console.error('❌ Transfer failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n🎉 Transfer example completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}