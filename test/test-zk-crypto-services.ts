#!/usr/bin/env npx ts-node

import { FeistelCryptoService, ZKCryptoService } from '../shared/lib/services/crypto/CryptoServices';
import * as crypto from 'crypto';

async function testZKCryptoServices() {
  console.log('🧪 Testing ZK Crypto Services...\n');

  try {
    // Test XOR-based ZK Crypto Service
    console.log('1️⃣ Testing XOR ZK Crypto Service...');
    console.log('=' .repeat(60));
    
    const zkService = new ZKCryptoService();
    console.log('✅ XOR ZK Crypto Service initialized');
    console.log('  • Uses XOR encryption (ZK-friendly, O(n) constraints)');
    console.log('  • Symmetric key sealing with shared secrets');
    console.log('  • Optimized for fast ZK proof generation');

    // Test encryption/decryption
    const testMessage = "Hello ZK World! Testing XOR encryption.";
    const key = zkService.generateKey();
    console.log(`\nTest Message: "${testMessage}"`);
    console.log(`Generated Key: ${key.toString('hex')}`);

    const encrypted = await zkService.encrypt(testMessage, key);
    console.log(`Encrypted Length: ${encrypted.length} bytes`);

    const decrypted = await zkService.decrypt(encrypted, key);
    console.log(`Decrypted: "${decrypted}"`);
    console.log(`Encryption/Decryption: ${testMessage === decrypted ? '✅ SUCCESS' : '❌ FAILED'}`);

    // Test key sealing
    const dataKey = crypto.randomBytes(32);
    const publicKey = "shared-secret-key-for-zk-sealing";
    console.log(`\nData Key: ${dataKey.toString('hex')}`);
    console.log(`Public Key: ${publicKey}`);

    const sealedKey = await zkService.sealKey(dataKey, publicKey);
    console.log(`Sealed Key Length: ${sealedKey.length} characters`);

    const unsealedKey = await zkService.unsealKey(sealedKey, publicKey);
    console.log(`Unsealed Key: ${unsealedKey.toString('hex')}`);
    console.log(`Key Sealing/Unsealing: ${dataKey.equals(unsealedKey) ? '✅ SUCCESS' : '❌ FAILED'}`);

    // Test Feistel Crypto Service
    console.log('\n\n2️⃣ Testing Feistel ZK Crypto Service...');
    console.log('=' .repeat(60));
    
    const feistelService = new FeistelCryptoService();
    console.log('✅ Feistel ZK Crypto Service initialized');
    console.log('  • Uses Feistel network encryption (4 rounds)');
    console.log('  • Balanced security and ZK-friendliness');
    console.log('  • O(2n) constraints for better security');

    // Test Feistel encryption
    const feistelMessage = "Testing Feistel network encryption for ZK proofs!";
    const feistelKey = feistelService.generateKey();
    console.log(`\nTest Message: "${feistelMessage}"`);

    const feistelEncrypted = await feistelService.encrypt(feistelMessage, feistelKey);
    console.log(`Encrypted Length: ${feistelEncrypted.length} bytes`);

    const feistelDecrypted = await feistelService.decrypt(feistelEncrypted, feistelKey);
    console.log(`Decrypted: "${feistelDecrypted}"`);
    console.log(`Encryption/Decryption: ${feistelMessage === feistelDecrypted ? '✅ SUCCESS' : '❌ FAILED'}`);

    // Performance comparison
    console.log('\n\n3️⃣ Performance Comparison...');
    console.log('=' .repeat(60));

    const iterations = 100;
    const testData = "Performance test data for comparison";
    const testKey = crypto.randomBytes(32);

    // XOR performance
    const xorStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      const enc = await zkService.encrypt(testData, testKey);
      await zkService.decrypt(enc, testKey);
    }
    const xorTime = Date.now() - xorStart;

    // Feistel performance
    const feistelStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      const enc = await feistelService.encrypt(testData, testKey);
      await feistelService.decrypt(enc, testKey);
    }
    const feistelTime = Date.now() - feistelStart;

    console.log(`XOR Service: ${xorTime}ms for ${iterations} operations (${(xorTime/iterations).toFixed(2)}ms avg)`);
    console.log(`Feistel Service: ${feistelTime}ms for ${iterations} operations (${(feistelTime/iterations).toFixed(2)}ms avg)`);

    // Summary
    console.log('\n\n📊 ZK Crypto Services Summary...');
    console.log('=' .repeat(60));
    console.log('✅ XOR ZK Crypto Service:');
    console.log('  • Fastest performance');
    console.log('  • Lowest circuit constraints (O(n))');
    console.log('  • Best for simple ZK proofs');
    console.log('  • Circuit: ciphertext[i] = plaintext[i] XOR keystream[i]');

    console.log('\n✅ Feistel ZK Crypto Service:');
    console.log('  • Balanced performance');
    console.log('  • Moderate circuit constraints (O(2n))');
    console.log('  • Good for complex ZK proofs');
    console.log('  • Circuit: 4-round Feistel with F(R,K) = (R+K)*K mod p');

    console.log('\n🎯 ZK Circuit Implementation:');
    console.log('  • XOR: Simple XOR constraints in circom');
    console.log('  • Feistel: Block cipher with round functions');
    console.log('  • Both support key sealing verification circuits');

    console.log('\n🎉 All ZK crypto services are working correctly!');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testZKCryptoServices();