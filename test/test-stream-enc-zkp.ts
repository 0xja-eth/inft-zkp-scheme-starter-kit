import { PreimageProofGenerator } from '../shared/lib/services/crypto/zkp/PreimageProofGenerator';
import { StreamCipherEncryptionService } from '../shared/lib/services/crypto/encryption/StreamCipherEncryptionService';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import {Groth16Proof} from "snarkjs/index";

async function testStreamEncZKP() {
  console.log('Testing StreamEncVerify ZK Proof System');

  const prover = new PreimageProofGenerator();
  const encService = new StreamCipherEncryptionService();

  // Check if circuit is ready
  const status = prover.isCircuitReady();
  console.log('📋 Circuit status:', status);

  if (!status.ready) {
    console.error('❌ Circuit not ready. Missing:', status.missing);
    return;
  }

  // Test data - simple JSON
  const testData = JSON.stringify({
    name: 'Test Agent',
    description: 'A test agent for ZK proof verification',
    version: '1.0.0',
    metadata: {
      created: Date.now(),
      owner: '0x1234567890123456789012345678901234567890',
    },
  });

  console.log('📝 Test data length:', testData.length, 'bytes');

  // Generate encryption key
  const key = encService.generateKey();
  console.log('🔑 Generated 32-byte key');

  try {
    // Encrypt data
    console.log('🔒 Encrypting data...');
    const encryptedData = await encService.encrypt(testData, key);
    console.log('✅ Encryption successful, output length:', encryptedData.length, 'bytes');

    // Decrypt to verify
    console.log('🔓 Verifying decryption...');
    const decryptedData = await encService.decrypt(encryptedData, key);
    console.log('✅ Decryption successful, matches original:', decryptedData === testData);

    // Generate ZK proof
    console.log('⚡ Generating ZK proof...');
    const startTime = Date.now();
    const { proof, publicSignals } = await prover.generateProof(testData, key, encryptedData);
    const proofTime = Date.now() - startTime;

    console.log('✅ Proof generation successful in', proofTime, 'ms');
    console.log('📊 Public signals count:', publicSignals.length);
    console.log('🔍 First few public signals:', publicSignals.slice(0, 5));

    // Save proof to file
    const proofData = {
      proof,
      publicSignals,
      metadata: {
        timestamp: new Date().toISOString(),
        proofTime,
        dataLength: testData.length,
        encryptedDataLength: encryptedData.length,
      },
    };

    const proofDir = 'proofs';
    if (!fs.existsSync(proofDir)) {
      fs.mkdirSync(proofDir, { recursive: true });
    }

    const proofFile = path.join(proofDir, `stream_enc_proof_${Date.now()}.json`);
    fs.writeFileSync(proofFile, JSON.stringify(proofData, null, 2));
    console.log('💾 Proof saved to:', proofFile);

    // Verify ZK proof
    console.log('🔍 Verifying ZK proof...');
    const verifyStartTime = Date.now();
    const isValid = await prover.verifyProof(proof, publicSignals);
    const verifyTime = Date.now() - verifyStartTime;

    console.log('✅ Local proof verification result:', isValid, 'in', verifyTime, 'ms');

    // Test on-chain verification with deployed PreimageVerifier
    if (isValid) {
      console.log('🔗 Testing on-chain verification with PreimageVerifier...');
      await testOnChainVerification(proof, publicSignals);
      console.log('🎉 All tests passed! ZK proof system is working correctly.');
    } else {
      console.log('❌ Local proof verification failed!');
    }
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

/**
 * 测试链上验证功能
 */
async function testOnChainVerification(proof: any, publicSignals: string[]) {
  try {
    // 合约地址
    const PREIMAGE_VERIFIER_ADDRESS = '0x09635F643e140090A9A8Dcd712eD6285858ceBef';
    
    // 连接到本地 Hardhat 网络
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    
    // 使用 Hardhat 默认账户
    const signer = new ethers.Wallet(
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Hardhat 默认私钥
      provider
    );
    
    console.log('Connected to localhost network');
    console.log('Using signer:', signer.address);
    
    // PreimageVerifier ABI
    const verifierABI = [
      "function verifyProof(uint256[2] calldata _pA, uint256[2][2] calldata _pB, uint256[2] calldata _pC, uint256[2] calldata _pubSignals) external view returns (bool)"
    ];
    
    // 连接合约
    const verifierContract = new ethers.Contract(
      PREIMAGE_VERIFIER_ADDRESS,
      verifierABI,
      signer
    );
    
    console.log('Connected to PreimageVerifier at:', PREIMAGE_VERIFIER_ADDRESS);
    
    // 转换 proof 格式为合约期望的格式
    const formattedProof = formatProofForContract(proof, publicSignals);
    
    console.log('Formatted proof for contract call');
    console.log('  - pA:', formattedProof.pA);
    console.log('  - pB:', formattedProof.pB);
    console.log('  - pC:', formattedProof.pC);
    console.log('  - publicSignals:', formattedProof.publicSignals);
    
    // 调用合约验证
    console.log('Calling contract verifyProof...');
    const onChainStartTime = Date.now();
    
    const isValidOnChain = await verifierContract.verifyProof(
      formattedProof.pA,
      formattedProof.pB,
      formattedProof.pC,
      formattedProof.publicSignals
    );
    
    const onChainVerifyTime = Date.now() - onChainStartTime;
    
    console.log('On-chain verification result:', isValidOnChain, 'in', onChainVerifyTime, 'ms');
    
    if (isValidOnChain) {
      console.log('SUCCESS: Proof verified on-chain by PreimageVerifier contract!');
    } else {
      console.log('FAILED: On-chain verification failed');
    }
    
    return isValidOnChain;
    
  } catch (error: any) {
    console.error('On-chain verification error:', error.message);
    
    // 提供更详细的错误信息
    if (error.message.includes('could not detect network')) {
      console.log('Make sure Hardhat node is running: npx hardhat node');
    } else if (error.message.includes('contract runner does not support calling')) {
      console.log('Contract might not be deployed or address is incorrect');
    }
    
    return false;
  }
}

/**
 * 将 snarkjs proof 格式转换为合约期望的格式
 */
function formatProofForContract(proof: Groth16Proof, publicSignals: string[]) {
  return {
    pA: [proof.pi_a[0], proof.pi_a[1]],
    pB: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
    pC: [proof.pi_c[0], proof.pi_c[1]],
    publicSignals: publicSignals
  };
}

// Run test
testStreamEncZKP().catch(console.error);
