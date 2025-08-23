import { Metadata } from '../../shared/lib/types';
import { initializeAgentClient } from '../utils/init-client';

const DefaultMetadata: Metadata = {
  "name": "Aurora Assistant",
  "description": "Aurora is an intelligent multi-domain assistant designed to help users manage tasks, perform quick research, and interact with Web3 services seamlessly.",
  "avatar": "https://example.com/aurora.png",
  "externalUrl": "https://example.com/aurora",
  "version": "2.1.0",
  "model": "gpt-5-mini",
  "personality": "Calm, informative, and slightly humorous. Enjoys making conversations engaging while staying concise.",
  "capabilities": [
    {
      "name": "TextGeneration",
      "description": "Generate natural and coherent text based on user prompts.",
      "input": "A short text prompt.",
      "output": "A paragraph of generated text.",
      "preconditions": ["User provides a valid text prompt."],
      "postconditions": ["Returns a generated text response."]
    },
    {
      "name": "SentimentAnalysis",
      "description": "Analyze the sentiment of a given text.",
      "input": "User message or text content.",
      "output": "Sentiment score from -1 (negative) to 1 (positive).",
      "preconditions": ["User provides a non-empty text string."],
      "postconditions": ["Stores the sentiment score for context improvement."]
    },
    {
      "name": "Web3TransactionHelper",
      "description": "Assist users in initiating simple Web3 transactions.",
      "input": "Transaction details such as amount and recipient address.",
      "output": "Transaction hash upon success.",
      "preconditions": ["User is connected to a supported wallet."],
      "postconditions": ["Transaction is broadcasted to the blockchain."]
    }
  ],
  "attributes": {
    "responseTimeMs": 135,
    "interactionCount": 764,
    "lastActive": "2025-08-23T08:20:00Z",
    "maxTokenLimit": 2048,
    "language": "English",
    "uptimePercent": 99.95,
    "energyMode": "balanced",
    "memorySlots": 64,
    "versionAgeDays": 18
  }
}

async function main() {
  try {
    // Initialize client
    const { agentNFTClient } = initializeAgentClient();

    console.log('Starting mint process...');
    console.log('AI Model Data:', JSON.stringify(DefaultMetadata, null, 2));

    // Mint the AgentNFT
    const result = await agentNFTClient.mint(DefaultMetadata);
    
    console.log('\n✅ Mint successful!');
    console.log(`Token ID: ${result.tokenId}`);
    console.log(`Transaction Hash: ${result.txHash}`);
    console.log(`Root Hash: ${result.rootHash}`);
    console.log(`Sealed Key: ${result.sealedKey}`);

    // Get token information
    console.log('\nFetching token information...');
    const tokenInfo = await agentNFTClient.getTokenInfo(result.tokenId);
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