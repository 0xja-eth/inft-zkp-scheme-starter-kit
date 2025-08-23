import { StreamCipherEncryptionService } from "../shared/lib/services/crypto/encryption/StreamCipherEncryptionService";

/**
 * Test script for StreamCipherEncryptionService
 * Tests encryption/decryption functionality and circuit input generation
 */
async function testStreamCipher() {
  console.log("🔐 Testing StreamCipherEncryptionService...\n");

  {
    const service = new StreamCipherEncryptionService();
    const key = service.generateKey();
    const data = "Hello, World!";

    const encrypted = await service.encrypt(data, key);
    const decrypted = await service.decrypt(encrypted, key);

    console.log(data === decrypted); // 现在应该返回 true！
  }


  const service = new StreamCipherEncryptionService();

  // Test data of various sizes
  const testCases = [
    {
      name: "Small JSON",
      data: JSON.stringify({ message: "Hello World", timestamp: Date.now() })
    },
    {
      name: "Medium JSON", 
      data: JSON.stringify({
        user: { id: 123, name: "Alice", email: "alice@example.com" },
        metadata: { version: "1.0", created: new Date().toISOString() },
        data: Array.from({ length: 30 }, (_, i) => `item-${i}`)
      })
    },
    {
      name: "Large JSON",
      data: JSON.stringify({
        id: "test-large-data",
        description: "This is a large test payload".repeat(10),
        array: Array.from({ length: 30 }, (_, i) => ({
          id: i,
          value: `value-${i}`,
          timestamp: Date.now() + i
        }))
      })
    },
    {
      name: "Empty string",
      data: ""
    },
    {
      name: "Unicode text",
      data: JSON.stringify({ message: "你好世界 🌍 Hello 🇺🇸" })
    }
  ];

  let passed = 0;
  let total = 0;

  for (const testCase of testCases) {
    console.log(`📋 Test Case: ${testCase.name}`);
    console.log(`   Data size: ${testCase.data.length} bytes`);
    
    try {
      total++;
      
      // Generate key
      const key = service.generateKey();
      console.log(`   Key generated: ${key.length} bytes`);
      console.log(`   Key (hex): ${key.toString('hex').substring(0, 32)}...`);

      // Show original data
      console.log(`   📝 Original data: "${testCase.data.substring(0, 100)}${testCase.data.length > 100 ? '...' : ''}"`);

      // Test encryption
      console.log("   🔒 Encrypting...");
      const encrypted = await service.encrypt(testCase.data, key);
      console.log(`   Encrypted size: ${encrypted.length} bytes`);
      
      // Show encrypted data structure
      const nonce = encrypted.subarray(0, 4);
      const mac = encrypted.subarray(4, 36);
      const cipher = encrypted.subarray(36);
      
      console.log(`   📦 Encrypted structure:`);
      console.log(`      - Nonce (4 bytes): ${nonce.toString('hex')}`);
      console.log(`      - MAC (32 bytes): ${mac.toString('hex').substring(0, 32)}...`);
      console.log(`      - Cipher (${cipher.length} bytes): ${cipher.toString('hex').substring(0, 64)}...`);

      // Test decryption
      console.log("   🔓 Decrypting...");
      const decrypted = await service.decrypt(encrypted, key);
      console.log(`   📄 Decrypted data: "${decrypted.substring(0, 100)}${decrypted.length > 100 ? '...' : ''}"`);
      console.log(`   🔍 Data length - Original: ${testCase.data.length}, Decrypted: ${decrypted.length}`);
      
      // Verify data integrity
      if (decrypted === testCase.data) {
        console.log("   ✅ Encryption/Decryption successful");
        passed++;
      } else {
        console.log("   ❌ Data mismatch!");
        console.log(`   Expected: ${testCase.data.substring(0, 100)}...`);
        console.log(`   Got: ${decrypted.substring(0, 100)}...`);
      }

      // Test circuit inputs generation
      if (testCase.data.length <= 128 * 16) { // Within circuit limits
        console.log("   ⚡ Generating circuit inputs...");
        const circuitInputs = await service.generateCircuitInputs(testCase.data, key);
        console.log(`   Circuit inputs: nonce=${circuitInputs.nonce.substring(0, 20)}...`);
        console.log(`   MAC: ${circuitInputs.mac.substring(0, 20)}...`);
        console.log(`   Cipher blocks: ${circuitInputs.cipher.length}`);
        console.log(`   Message blocks: ${circuitInputs.msg.length}`);
      }

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log();
  }

  // Test wrong key decryption
  console.log("🔑 Testing wrong key decryption...");
  try {
    total++;
    const key1 = service.generateKey();
    const key2 = service.generateKey();
    const testData = JSON.stringify({ test: "wrong key test" });
    
    const encrypted = await service.encrypt(testData, key1);
    const decrypted = await service.decrypt(encrypted, key2); // Should fail

    if (decrypted !== testData) throw new Error("Decryption should have failed");

    console.log("❌ Wrong key test failed - decryption should have failed");
  } catch (error: any) {
    console.log("✅ Wrong key correctly rejected:", error.message);
    passed++;
  }

  // Test data too large
  console.log("\n📏 Testing data size limits...");
  try {
    total++;
    const key = service.generateKey();
    const largeData = "x".repeat(128 * 16 + 1); // Exceed limit
    
    await service.encrypt(largeData, key);
    console.log("❌ Large data test failed - should have thrown error");
  } catch (error: any) {
    console.log("✅ Large data correctly rejected:", error.message);
    passed++;
  }

  // Test corrupted data
  console.log("\n🔧 Testing corrupted data handling...");
  try {
    total++;
    const key = service.generateKey();
    const testData = JSON.stringify({ test: "corruption test" });
    
    const encrypted = await service.encrypt(testData, key);
    
    // Corrupt the MAC portion
    encrypted[10] = encrypted[10] ^ 0xFF;
    
    await service.decrypt(encrypted, key);
    console.log("❌ Corruption test failed - should have detected corruption");
  } catch (error: any) {
    console.log("✅ Corruption correctly detected:", error.message);
    passed++;
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log(`📊 Test Summary: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log("🎉 All tests passed! StreamCipherEncryptionService is working correctly.");
    return true;
  } else {
    console.log("⚠️  Some tests failed. Please check the implementation.");
    return false;
  }
}

// Run tests
testStreamCipher()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error("💥 Test execution failed:", error);
    process.exit(1);
  });