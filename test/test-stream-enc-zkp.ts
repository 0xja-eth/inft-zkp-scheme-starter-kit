import { PreimageProofGenerator } from "../shared/lib/services/crypto/zkp/PreimageProofGenerator";
import { StreamCipherEncryptionService } from "../shared/lib/services/crypto/encryption/StreamCipherEncryptionService";
import * as fs from "fs";
import * as path from "path";

async function testStreamEncZKP() {
  console.log("🚀 Testing StreamEncVerify ZK Proof System");
  
  const prover = new PreimageProofGenerator();
  const encService = new StreamCipherEncryptionService();
  
  // Check if circuit is ready
  const status = prover.isCircuitReady();
  console.log("📋 Circuit status:", status);
  
  if (!status.ready) {
    console.error("❌ Circuit not ready. Missing:", status.missing);
    return;
  }
  
  // Test data - simple JSON
  const testData = JSON.stringify({
    name: "Test Agent",
    description: "A test agent for ZK proof verification",
    version: "1.0.0",
    metadata: {
      created: Date.now(),
      owner: "0x1234567890123456789012345678901234567890"
    }
  });
  
  console.log("📝 Test data length:", testData.length, "bytes");
  
  // Generate encryption key
  const key = encService.generateKey();
  console.log("🔑 Generated 32-byte key");
  
  try {
    // Encrypt data
    console.log("🔒 Encrypting data...");
    const encryptedData = await encService.encrypt(testData, key);
    console.log("✅ Encryption successful, output length:", encryptedData.length, "bytes");
    
    // Decrypt to verify
    console.log("🔓 Verifying decryption...");
    const decryptedData = await encService.decrypt(encryptedData, key);
    console.log("✅ Decryption successful, matches original:", decryptedData === testData);
    
    // Generate ZK proof
    console.log("⚡ Generating ZK proof...");
    const startTime = Date.now();
    const { proof, publicSignals } = await prover.generateProof(testData, key, encryptedData);
    const proofTime = Date.now() - startTime;
    
    console.log("✅ Proof generation successful in", proofTime, "ms");
    console.log("📊 Public signals count:", publicSignals.length);
    console.log("🔍 First few public signals:", publicSignals.slice(0, 5));
    
    // Save proof to file
    const proofData = {
      proof,
      publicSignals,
      metadata: {
        timestamp: new Date().toISOString(),
        proofTime,
        dataLength: testData.length,
        encryptedDataLength: encryptedData.length
      }
    };
    
    const proofDir = "proofs";
    if (!fs.existsSync(proofDir)) {
      fs.mkdirSync(proofDir, { recursive: true });
    }
    
    const proofFile = path.join(proofDir, `stream_enc_proof_${Date.now()}.json`);
    fs.writeFileSync(proofFile, JSON.stringify(proofData, null, 2));
    console.log("💾 Proof saved to:", proofFile);
    
    // Verify ZK proof
    console.log("🔍 Verifying ZK proof...");
    const verifyStartTime = Date.now();
    const isValid = await prover.verifyProof(proof, publicSignals);
    const verifyTime = Date.now() - verifyStartTime;
    
    console.log("✅ Proof verification result:", isValid, "in", verifyTime, "ms");
    
    if (isValid) {
      console.log("🎉 All tests passed! ZK proof system is working correctly.");
    } else {
      console.log("❌ Proof verification failed!");
    }
    
  } catch (error) {
    console.error("❌ Error during testing:", error);
  }
}

// Run test
testStreamEncZKP().catch(console.error);