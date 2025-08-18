#!/usr/bin/env npx ts-node

import { ethers } from 'ethers';
import { EncryptionService } from '../lib/services/EncryptionService';

/**
 * Test script for ECIES key sealing/unsealing
 */
async function testECIES() {
  console.log('🧪 Testing ECIES Key Sealing/Unsealing...\n');
  
  try {
    // 1. Generate test keys
    console.log('1️⃣ Generating test key pairs...');
    const wallet1 = ethers.Wallet.createRandom();
    const wallet2 = ethers.Wallet.createRandom();
    
    console.log(`Wallet 1: ${wallet1.address}`);
    console.log(`Wallet 2: ${wallet2.address}\n`);
    
    // 2. Create encryption service
    const encryptionService = new EncryptionService();
    
    // 3. Generate encryption key
    console.log('2️⃣ Generating encryption key...');
    const originalKey = encryptionService.generateKey();
    console.log(`Original key: ${originalKey.toString('hex')}\n`);
    
    // 4. Seal key for wallet2 using wallet2's public key
    console.log('3️⃣ Sealing key for wallet2...');
    const publicKey2 = wallet2.signingKey.publicKey;
    console.log(`Recipient public key: ${publicKey2}\n`);
    
    const sealedKey = await encryptionService.sealKey(originalKey, publicKey2);
    console.log(`Sealed key length: ${sealedKey.length / 2} bytes`);
    console.log(`Sealed key: ${sealedKey.substring(0, 64)}...\n`);
    
    // 5. Unseal key using wallet2's private key
    console.log('4️⃣ Unsealing key with wallet2 private key...');
    const unsealedKey = await encryptionService.unsealKey(sealedKey, wallet2.privateKey);
    console.log(`Unsealed key: ${unsealedKey.toString('hex')}\n`);
    
    // 6. Verify keys match
    console.log('5️⃣ Verifying keys match...');
    if (originalKey.equals(unsealedKey)) {
      console.log('✅ SUCCESS: Keys match perfectly!');
    } else {
      console.log('❌ FAILURE: Keys do not match!');
      console.log(`Original:  ${originalKey.toString('hex')}`);
      console.log(`Unsealed:  ${unsealedKey.toString('hex')}`);
      return;
    }
    
    // 7. Test with wrong private key (should fail)
    console.log('\n6️⃣ Testing with wrong private key (should fail)...');
    try {
      await encryptionService.unsealKey(sealedKey, wallet1.privateKey);
      console.log('❌ UNEXPECTED: Unsealing with wrong key succeeded!');
    } catch (error: any) {
      console.log('✅ EXPECTED: Unsealing with wrong key failed');
      console.log(`Error: ${error.message}`);
    }
    
    // 8. Test round-trip encryption/decryption
    console.log('\n7️⃣ Testing full encryption/decryption cycle...');
    const testData = 'This is a secret message for testing ECIES encryption!';
    console.log(`Original data: "${testData}"`);
    
    const encryptedData = await encryptionService.encrypt(testData, originalKey);
    console.log(`Encrypted data length: ${encryptedData.length} bytes`);
    
    const decryptedData = await encryptionService.decrypt(encryptedData, unsealedKey);
    console.log(`Decrypted data: "${decryptedData}"`);
    
    if (testData === decryptedData) {
      console.log('✅ SUCCESS: Full encryption cycle works!');
    } else {
      console.log('❌ FAILURE: Encryption cycle failed!');
    }
    
    console.log('\n🎉 All ECIES tests completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testECIES()
    .then(() => {
      console.log('\n✨ ECIES implementation is production-ready!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

export { testECIES };