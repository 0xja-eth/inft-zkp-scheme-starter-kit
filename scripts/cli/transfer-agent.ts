import { ethers } from 'ethers';
import { getScriptParams } from '../utils/get-config';
import { initializeAgentClient } from '../utils/init-client';

async function main() {
  try {
    // Initialize client and get parameters
    const { agentNFTClient, wallet } = initializeAgentClient();
    const params = getScriptParams();

    // 验证参数
    if (!params.tokenId || !params.recipientAddress) {
      console.log('Usage: npm run transfer-example <tokenId> <recipientAddress>');
      console.log('Example: npm run transfer-example 1 0x742d35Cc6634C0532925a3b8D0C3C19D2A8aE');
      console.log('Or set TOKEN_ID and RECIPIENT_ADDRESS in .env file');
      process.exit(1);
    }

    console.log(`Starting transfer process...`);
    console.log(`Token ID: ${params.tokenId}`);
    console.log(`Recipient: ${params.recipientAddress}`);

    // Check current owner
    console.log('\nChecking current ownership...');
    const tokenInfo = await agentNFTClient.getTokenInfo(params.tokenId!);
    console.log(`Current owner: ${tokenInfo.owner}`);

    if (tokenInfo.owner.toLowerCase() !== wallet!.address.toLowerCase()) {
      throw new Error(`You don't own token ${params.tokenId}. Current owner: ${tokenInfo.owner}`);
    }

    // Transfer the token
    console.log('\nExecuting transfer...');
    const txHash = await agentNFTClient.transfer(params.tokenId!, params.recipientAddress!);

    console.log('\n✅ Transfer successful!');
    console.log(`Transaction Hash: ${txHash}`);

    // Verify transfer
    console.log('\nVerifying transfer...');
    const updatedTokenInfo = await agentNFTClient.getTokenInfo(params.tokenId!);
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
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}
