import { getScriptParams } from '../utils/get-config';
import { initializeAgentClient } from '../utils/init-client';

async function main() {
  try {
    // Initialize client and get parameters
    const { agentNFTClient, wallet } = initializeAgentClient();
    const params = getScriptParams();
    
    // 验证参数
    if (!params.tokenId || !params.recipientAddress) {
      console.log('Usage: npm run clone-example <tokenId> <recipientAddress>');
      console.log('Example: npm run clone-example 1 0x742d35Cc6634C0532925a3b8D0C3C19D2A8aE');
      console.log('Or set TOKEN_ID and RECIPIENT_ADDRESS in .env file');
      process.exit(1);
    }

    console.log(`Starting clone process...`);
    console.log(`Source Token ID: ${params.tokenId}`);
    console.log(`Recipient: ${params.recipientAddress}`);

    // Check current owner
    console.log('\nChecking source token ownership...');
    const tokenInfo = await agentNFTClient.getTokenInfo(params.tokenId!);
    console.log(`Current owner: ${tokenInfo.owner}`);
    console.log(`Data descriptions: ${tokenInfo.dataDescriptions.join(', ')}`);
    
    if (tokenInfo.owner.toLowerCase() !== wallet!.address.toLowerCase()) {
      throw new Error(`You don't own token ${params.tokenId}. Current owner: ${tokenInfo.owner}`);
    }

    // Optional modifications for the clone
    const modifications = {
      description: 'Cloned AI agent with enhanced capabilities',
      tags: [...(tokenInfo.dataDescriptions[0]?.includes('finance') ? ['finance'] : []), 'cloned', 'enhanced'],
      config: {
        temperature: 0.8, // Slightly higher creativity for clone
        specialization: 'enhanced-analysis',
      }
    };

    // Clone the token
    console.log('\nExecuting clone with modifications...');
    console.log('Modifications:', JSON.stringify(modifications, null, 2));
    
    const result = await agentNFTClient.clone(params.tokenId!, params.recipientAddress!, modifications);
    
    console.log('\n✅ Clone successful!');
    console.log(`New Token ID: ${result.newTokenId}`);
    console.log(`Transaction Hash: ${result.txHash}`);

    // Verify clone
    console.log('\nVerifying clone...');
    const clonedTokenInfo = await agentNFTClient.getTokenInfo(result.newTokenId);
    console.log(`Clone owner: ${clonedTokenInfo.owner}`);
    console.log(`Clone data descriptions: ${clonedTokenInfo.dataDescriptions.join(', ')}`);
    
    if (clonedTokenInfo.owner.toLowerCase() === params.recipientAddress!.toLowerCase()) {
      console.log('✅ Clone verified!');
    } else {
      console.log('❌ Clone verification failed');
    }

    // Show comparison
    console.log('\n📊 Comparison:');
    console.log(`Original Token ${params.tokenId}: Owner=${tokenInfo.owner}, Descriptions=${tokenInfo.dataDescriptions.length}`);
    console.log(`Cloned Token ${result.newTokenId}: Owner=${clonedTokenInfo.owner}, Descriptions=${clonedTokenInfo.dataDescriptions.length}`);

  } catch (error: any) {
    console.error('❌ Clone failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n🎉 Clone example completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}