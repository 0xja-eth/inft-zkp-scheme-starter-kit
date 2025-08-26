import { ethers } from 'ethers';
import { getScriptParams } from '../utils/get-config';
import { initializeAgentClient } from '../utils/init-client';

async function main() {
  try {
    // Initialize client and get parameters
    const { agentNFTClient, wallet } = initializeAgentClient();
    const params = getScriptParams();

    // 验证参数
    if (!params.tokenId || !params.recipientAddress || !params.recipientEncPublicKey || !params.signature) {
      console.log('Usage: npm run agent:transfer <tokenId> <recipientAddress> <recipientEncPublicKey> <signature>');
      console.log('Example: npm run agent:transfer 1 0x6b315fc332e3b739da8788a86ef860d99d173d0c S/q4UPWGzJbdXxK7c2E9cf9aVeLHWmGtOSBZE0dONUM= ' +
          '0x6dd2ee04ef0236b4ac462bd9f17dcc670659bb824d7cc97d03d7b3b45e5008782352f72ee8034cc8db0ef9062a4b9661fbc320f3a3777045c0c016fdcabede291b');
      console.log('Or set TOKEN_ID, RECIPIENT_ADDRESS, RECIPIENT_ENC_PUBLICKEY and RECIPIENT_SIGNATURE in .env file');
      process.exit(1);
    }

    console.log(`Starting transfer process...`);
    console.log(`Token ID: ${params.tokenId}`);
    console.log(`Recipient: ${params.recipientAddress} (${params.recipientEncPublicKey})`);
    console.log(`signature: ${params.signature}`);

    // Check current owner
    console.log('\nChecking current ownership...');
    const tokenInfo = await agentNFTClient.getTokenInfo(params.tokenId!);
    console.log(`Current owner: ${tokenInfo.owner}`);

    if (tokenInfo.owner.toLowerCase() !== wallet!.address.toLowerCase()) {
      throw new Error(`You don't own token ${params.tokenId}. Current owner: ${tokenInfo.owner}`);
    }

    // Transfer the token
    console.log('\nExecuting transfer...');
    const txHash = await agentNFTClient.transfer(params.tokenId!, params.recipientAddress!, params.recipientEncPublicKey!, params.signature!);

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
