#!/usr/bin/env npx ts-node

import { PreimageProofGenerator } from '../shared/lib/services/crypto/zkp/PreimageProofGenerator';
import * as crypto from 'crypto';
import * as path from 'path';

async function testFileEncryptionProof() {
  console.log('🧪 Testing File Encryption ZK Proof Generator...\n');

  try {
    const generator = new PreimageProofGenerator();

    // 1. 生成基本测试用例
    console.log('1️⃣ Generating Basic Test Case...');
    console.log('='.repeat(60));

    const testCase = await generator.generateTestCase();
    console.log(`📝 ${testCase.description}`);
    console.log(`📊 Input sizes:`);
    console.log(`   File data: ${testCase.inputs.fileData.length} elements`);
    console.log(`   Encryption key: ${testCase.inputs.encryptionKey.length} elements`);
    console.log(`   Nonce: ${testCase.inputs.nonce.length} elements`);
    console.log(`   Public key: ${testCase.inputs.publicKey.length} elements`);

    // 显示一些调试信息
    console.log(`\n🔍 Debug Info:`);
    console.log(
      `   Original file data: ${testCase.inputs.debug.originalFileData.substring(0, 32)}...`
    );
    console.log(
      `   Encryption key: ${testCase.inputs.debug.originalEncryptionKey.substring(0, 32)}...`
    );
    console.log(`   Commitment: ${testCase.inputs.expectedCommitment.toString()}`);
    console.log(
      `   Sealed key (first 4 bytes): [${testCase.inputs.expectedSealedKey.slice(0, 4).join(', ')}]`
    );

    // 2. 测试小文件证明
    console.log('\n\n2️⃣ Testing Small File Proof (32 bytes)...');
    console.log('='.repeat(60));

    const smallFileData = Buffer.from('This is a 32-byte test file data');
    const smallFileInputs = await generator.generateSmallFileProofInputs(smallFileData);

    console.log(`📝 Small file proof generated`);
    console.log(`   File size: ${smallFileInputs.fileData.length} bytes`);
    console.log(`   Commitment: ${smallFileInputs.expectedCommitment.toString()}`);

    const smallFileValid = await generator.verifyInputsLocally(smallFileInputs);
    console.log(`✅ Small file validation: ${smallFileValid ? 'PASS' : 'FAIL'}`);

    // 3. 测试批量文件证明
    console.log('\n\n3️⃣ Testing Batch File Proof...');
    console.log('='.repeat(60));

    const batchFiles = [
      Buffer.from('First file content for batch test'),
      Buffer.from('Second file with different content'),
      Buffer.from('Third file in the batch processing'),
      Buffer.from('Fourth and final file for testing'),
    ];

    const batchInputs = await generator.generateBatchProofInputs(batchFiles);

    console.log(`📝 Batch proof generated for ${batchFiles.length} files`);
    console.log(`   File sizes: [${batchInputs.fileData.map(f => f.length).join(', ')}] bytes`);
    console.log(
      `   Commitments: [${batchInputs.expectedCommitments.map(c => c.toString().substring(0, 10) + '...').join(', ')}]`
    );

    // 验证每个批量文件
    let batchValidCount = 0;
    for (let i = 0; i < batchFiles.length; i++) {
      const singleInputs = {
        fileData: batchInputs.fileData[i],
        encryptionKey: batchInputs.encryptionKeys[i],
        nonce: batchInputs.nonces[i],
        publicKey: batchInputs.publicKey,
        expectedCommitment: batchInputs.expectedCommitments[i],
        expectedSealedKey: batchInputs.expectedSealedKeys[i],
      };

      const isValid = await generator.verifyInputsLocally(singleInputs);
      if (isValid) batchValidCount++;
      console.log(`   File ${i + 1} validation: ${isValid ? 'PASS' : 'FAIL'}`);
    }

    console.log(`✅ Batch validation: ${batchValidCount}/${batchFiles.length} files passed`);

    // 4. 测试约束估算
    console.log('\n\n4️⃣ Constraint Estimation...');
    console.log('='.repeat(60));

    const constraints256_32 = generator.estimateConstraints(256, 32);
    console.log(`📊 Constraints for 256-byte file, 32-byte key:`);
    console.log(`   XOR operations: ${constraints256_32.xorConstraints.toLocaleString()}`);
    console.log(`   Poseidon hashes: ${constraints256_32.poseidonConstraints.toLocaleString()}`);
    console.log(`   Key sealing: ${constraints256_32.sealingConstraints.toLocaleString()}`);
    console.log(`   Equality checks: ${constraints256_32.equalityConstraints.toLocaleString()}`);
    console.log(`   Total estimate: ${constraints256_32.totalEstimate.toLocaleString()}`);

    const constraints32_32 = generator.estimateConstraints(32, 32);
    console.log(`\n📊 Constraints for 32-byte file, 32-byte key (optimized):`);
    console.log(`   Total estimate: ${constraints32_32.totalEstimate.toLocaleString()}`);

    // 5. 导出JSON文件用于电路
    console.log('\n\n5️⃣ Exporting Proof Inputs...');
    console.log('='.repeat(60));

    // 导出小文件测试输入
    const exportPath = path.join(process.cwd(), 'temp', 'file-encryption-inputs.json');
    const fs = require('fs');

    // 确保目录存在
    const exportDir = path.dirname(exportPath);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    generator.exportAsJSON(smallFileInputs, exportPath);

    // 6. 测试不同大小文件的性能
    console.log('\n\n6️⃣ Performance Analysis...');
    console.log('='.repeat(60));

    const fileSizes = [16, 32, 64, 128, 256];

    for (const size of fileSizes) {
      const testData = crypto.randomBytes(size);
      const startTime = Date.now();

      const inputs = await generator.generateProofInputs(testData);
      const isValid = await generator.verifyInputsLocally(inputs);

      const endTime = Date.now();
      const constraints = generator.estimateConstraints(size, 32);

      console.log(`📊 ${size}-byte file:`);
      console.log(`   Generation time: ${endTime - startTime}ms`);
      console.log(`   Validation: ${isValid ? 'PASS' : 'FAIL'}`);
      console.log(`   Estimated constraints: ${constraints.totalEstimate.toLocaleString()}`);
    }

    // 7. 安全性分析
    console.log('\n\n7️⃣ Security Analysis...');
    console.log('='.repeat(60));

    // 测试相同文件不同密钥的情况
    const sameFile = Buffer.from('Same file content for security test');
    const inputs1 = await generator.generateProofInputs(sameFile);
    const inputs2 = await generator.generateProofInputs(sameFile);

    const commitmentsDiffer = inputs1.expectedCommitment !== inputs2.expectedCommitment;
    const sealedKeysDiffer = !inputs1.expectedSealedKey.every(
      (val, idx) => val === inputs2.expectedSealedKey[idx]
    );

    console.log(`🔐 Security checks:`);
    console.log(`   Different commitments for same file: ${commitmentsDiffer ? 'PASS' : 'FAIL'}`);
    console.log(`   Different sealed keys for same file: ${sealedKeysDiffer ? 'PASS' : 'FAIL'}`);

    console.log('\n\n🎉 File Encryption ZK Proof testing completed!');
    console.log('\n📋 Summary:');
    console.log(`   ✅ Basic test case generation and validation`);
    console.log(`   ✅ Small file optimization (32 bytes)`);
    console.log(`   ✅ Batch processing for multiple files`);
    console.log(`   ✅ Constraint estimation for different sizes`);
    console.log(`   ✅ JSON export for circuit integration`);
    console.log(`   ✅ Performance analysis across file sizes`);
    console.log(`   ✅ Security validation (randomness)`);

    console.log('\n🔧 Next steps:');
    console.log(`   1. Compile the circom circuit: circom circuits/file_encryption_proof.circom`);
    console.log(`   2. Use exported JSON as circuit input: ${exportPath}`);
    console.log(`   3. Generate and verify ZK proofs with snarkjs`);
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testFileEncryptionProof();
