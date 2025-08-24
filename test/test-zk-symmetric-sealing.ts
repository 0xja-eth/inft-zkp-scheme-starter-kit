#!/usr/bin/env tsx

import crypto from 'crypto';
import { ZKSymmetricSealingService } from '../shared/lib/services/crypto/sealing/ZKSymmetricSealingService';
import { ethers } from 'ethers';

/**
 * ZKSymmetricSealingService 测试脚本
 *
 * 测试内容：
 * 1. 基础密钥封装和解封装
 * 2. 不同密钥长度的处理
 * 3. 错误情况处理
 * 4. 数据完整性验证
 * 5. ZK友好性验证
 */

interface TestResult {
  testName: string;
  passed: boolean;
  message?: string;
  timing?: number;
}

class ZKSymmetricSealingTester {
  private sealingService: ZKSymmetricSealingService;
  private results: TestResult[] = [];

  constructor() {
    this.sealingService = new ZKSymmetricSealingService();
  }

  private logTest(testName: string, passed: boolean, message?: string, timing?: number) {
    const result: TestResult = { testName, passed, message, timing };
    this.results.push(result);

    const status = passed ? '✅ PASS' : '❌ FAIL';
    const timingStr = timing ? ` (${timing.toFixed(2)}ms)` : '';
    console.log(`${status} ${testName}${timingStr}`);
    if (message) {
      console.log(`   ${message}`);
    }
  }

  /**
   * 测试基础密钥封装和解封装功能
   */
  async testBasicSealingAndUnsealing() {
    const startTime = Date.now();

    try {
      // 生成测试数据
      const encryptionKey = crypto.randomBytes(32); // 256-bit key
      const wallet = ethers.Wallet.createRandom();
      const publicKey = wallet.signingKey.publicKey;
      const privateKey = wallet.privateKey;

      // 执行封装
      const sealedKey = await this.sealingService.sealKey(encryptionKey, publicKey);

      // 验证封装结果
      if (!sealedKey || sealedKey.length === 0) {
        throw new Error('Sealed key is empty');
      }

      // 执行解封装
      const unsealedKey = await this.sealingService.unsealKey(sealedKey, privateKey);

      // 验证解封装结果
      if (!encryptionKey.equals(unsealedKey)) {
        throw new Error(
          `Key mismatch: original=${encryptionKey.toString('hex')}, unsealed=${unsealedKey.toString('hex')}`
        );
      }

      const timing = Date.now() - startTime;
      this.logTest(
        'Basic Sealing and Unsealing',
        true,
        `Key length: ${encryptionKey.length} bytes`,
        timing
      );
    } catch (error) {
      const timing = Date.now() - startTime;
      this.logTest('Basic Sealing and Unsealing', false, (error as Error).message, timing);
    }
  }

  /**
   * 测试不同密钥长度
   */
  async testDifferentKeyLengths() {
    const keyLengths = [16, 24, 32, 64]; // 128-bit, 192-bit, 256-bit, 512-bit

    for (const keyLength of keyLengths) {
      const startTime = Date.now();

      try {
        const encryptionKey = crypto.randomBytes(keyLength);
        const wallet = ethers.Wallet.createRandom();
        const publicKey = wallet.signingKey.publicKey;
        const privateKey = wallet.privateKey;

        const sealedKey = await this.sealingService.sealKey(encryptionKey, publicKey);
        const unsealedKey = await this.sealingService.unsealKey(sealedKey, privateKey);

        if (!encryptionKey.equals(unsealedKey)) {
          throw new Error('Key length mismatch after unsealing');
        }

        const timing = Date.now() - startTime;
        this.logTest(
          `Key Length ${keyLength * 8}-bit`,
          true,
          `Success with ${keyLength} bytes`,
          timing
        );
      } catch (error) {
        const timing = Date.now() - startTime;
        this.logTest(`Key Length ${keyLength * 8}-bit`, false, (error as Error).message, timing);
      }
    }
  }

  /**
   * 测试错误的私钥解封装
   */
  async testWrongPrivateKey() {
    const startTime = Date.now();

    try {
      const encryptionKey = crypto.randomBytes(32);
      const wallet1 = ethers.Wallet.createRandom();
      const wallet2 = ethers.Wallet.createRandom();

      // 使用wallet1的公钥封装
      const sealedKey = await this.sealingService.sealKey(
        encryptionKey,
        wallet1.signingKey.publicKey
      );

      // 尝试使用wallet2的私钥解封装
      try {
        await this.sealingService.unsealKey(sealedKey, wallet2.privateKey);
        throw new Error('Should have failed with wrong private key');
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('Key hash verification failed')) {
          const timing = Date.now() - startTime;
          this.logTest('Wrong Private Key', true, 'Correctly rejected wrong private key', timing);
        } else {
          throw error;
        }
      }
    } catch (error) {
      const timing = Date.now() - startTime;
      this.logTest('Wrong Private Key', false, (error as Error).message, timing);
    }
  }

  /**
   * 测试损坏的密封数据
   */
  async testCorruptedSealedData() {
    const startTime = Date.now();

    try {
      const encryptionKey = crypto.randomBytes(32);
      const wallet = ethers.Wallet.createRandom();
      const publicKey = wallet.signingKey.publicKey;
      const privateKey = wallet.privateKey;

      const sealedKey = await this.sealingService.sealKey(encryptionKey, publicKey);

      // 损坏密封数据的一个字符
      const corruptedSealedKey = sealedKey.slice(0, -5) + 'XXXXX';

      try {
        await this.sealingService.unsealKey(corruptedSealedKey, privateKey);
        throw new Error('Should have failed with corrupted data');
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('unsealing failed') || errorMessage.includes('JSON')) {
          const timing = Date.now() - startTime;
          this.logTest('Corrupted Sealed Data', true, 'Correctly rejected corrupted data', timing);
        } else {
          throw error;
        }
      }
    } catch (error) {
      const timing = Date.now() - startTime;
      this.logTest('Corrupted Sealed Data', false, (error as Error).message, timing);
    }
  }

  /**
   * 测试密封数据结构和元数据
   */
  async testSealedDataStructure() {
    const startTime = Date.now();

    try {
      const encryptionKey = crypto.randomBytes(32);
      const wallet = ethers.Wallet.createRandom();
      const publicKey = wallet.signingKey.publicKey;

      const sealedKey = await this.sealingService.sealKey(encryptionKey, publicKey);

      // 解析密封数据结构
      const sealedData = JSON.parse(Buffer.from(sealedKey, 'base64').toString());

      // 验证必需字段
      const requiredFields = ['version', 'algorithm', 'encryptedKey', 'keyHash', 'metadata'];
      for (const field of requiredFields) {
        if (!sealedData.hasOwnProperty(field)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // 验证版本和算法
      if (sealedData.version !== 'zk-symmetric-v1') {
        throw new Error(`Unexpected version: ${sealedData.version}`);
      }
      if (sealedData.algorithm !== 'xor') {
        throw new Error(`Unexpected algorithm: ${sealedData.algorithm}`);
      }

      // 验证元数据
      if (!sealedData.metadata.isZKFriendly) {
        throw new Error('Should be ZK friendly');
      }
      if (!sealedData.metadata.canGenerateProof) {
        throw new Error('Should support proof generation');
      }

      // 验证密钥哈希
      const expectedHash = crypto.createHash('sha256').update(encryptionKey).digest('hex');
      if (sealedData.keyHash !== expectedHash) {
        throw new Error('Key hash mismatch');
      }

      const timing = Date.now() - startTime;
      this.logTest('Sealed Data Structure', true, 'All structure validations passed', timing);
    } catch (error) {
      const timing = Date.now() - startTime;
      this.logTest('Sealed Data Structure', false, (error as Error).message, timing);
    }
  }

  /**
   * 测试性能：多次封装和解封装
   */
  async testPerformance() {
    const iterations = 100;
    const encryptionKey = crypto.randomBytes(32);
    const wallet = ethers.Wallet.createRandom();
    const publicKey = wallet.signingKey.publicKey;
    const privateKey = wallet.privateKey;

    try {
      // 测试封装性能
      const sealStartTime = Date.now();
      const sealedKeys: string[] = [];

      for (let i = 0; i < iterations; i++) {
        const sealedKey = await this.sealingService.sealKey(encryptionKey, publicKey);
        sealedKeys.push(sealedKey);
      }

      const sealTime = Date.now() - sealStartTime;
      const avgSealTime = sealTime / iterations;

      // 测试解封装性能
      const unsealStartTime = Date.now();
      let successCount = 0;

      for (const sealedKey of sealedKeys) {
        const unsealedKey = await this.sealingService.unsealKey(sealedKey, privateKey);
        if (encryptionKey.equals(unsealedKey)) {
          successCount++;
        }
      }

      const unsealTime = Date.now() - unsealStartTime;
      const avgUnsealTime = unsealTime / iterations;

      if (successCount !== iterations) {
        throw new Error(`Only ${successCount}/${iterations} operations succeeded`);
      }

      this.logTest(
        'Performance Test',
        true,
        `${iterations} iterations: seal avg ${avgSealTime.toFixed(2)}ms, unseal avg ${avgUnsealTime.toFixed(2)}ms`
      );
    } catch (error) {
      this.logTest('Performance Test', false, (error as Error).message);
    }
  }

  /**
   * 测试一致性：相同输入应该产生不同的密封结果（因为有随机性）
   */
  async testConsistency() {
    const startTime = Date.now();

    try {
      const encryptionKey = crypto.randomBytes(32);
      const wallet = ethers.Wallet.createRandom();
      const publicKey = wallet.signingKey.publicKey;
      const privateKey = wallet.privateKey;

      // 多次封装相同的密钥
      const sealedKey1 = await this.sealingService.sealKey(encryptionKey, publicKey);
      const sealedKey2 = await this.sealingService.sealKey(encryptionKey, publicKey);

      // 密封结果应该可能不同（如果包含随机性），但都应该能正确解封装
      const unsealedKey1 = await this.sealingService.unsealKey(sealedKey1, privateKey);
      const unsealedKey2 = await this.sealingService.unsealKey(sealedKey2, privateKey);

      if (!encryptionKey.equals(unsealedKey1) || !encryptionKey.equals(unsealedKey2)) {
        throw new Error('Inconsistent unsealing results');
      }

      const timing = Date.now() - startTime;
      this.logTest('Consistency Test', true, 'Multiple seals produce consistent unsealing', timing);
    } catch (error) {
      const timing = Date.now() - startTime;
      this.logTest('Consistency Test', false, (error as Error).message, timing);
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🔧 Starting ZKSymmetricSealingService Tests...\n');

    await this.testBasicSealingAndUnsealing();
    await this.testDifferentKeyLengths();
    await this.testWrongPrivateKey();
    await this.testCorruptedSealedData();
    await this.testSealedDataStructure();
    await this.testPerformance();
    await this.testConsistency();

    this.printSummary();
  }

  /**
   * 打印测试结果摘要
   */
  private printSummary() {
    console.log('\n📊 Test Summary:');
    console.log('='.repeat(50));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`   • ${result.testName}: ${result.message}`);
        });
    }

    // 性能统计
    const timedResults = this.results.filter(r => r.timing);
    if (timedResults.length > 0) {
      const avgTiming =
        timedResults.reduce((sum, r) => sum + (r.timing || 0), 0) / timedResults.length;
      console.log(`\n⏱️  Average Test Time: ${avgTiming.toFixed(2)}ms`);
    }

    console.log('\n' + '='.repeat(50));
    console.log(failedTests === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed!');
  }
}

// 运行测试
async function main() {
  const tester = new ZKSymmetricSealingTester();
  try {
    await tester.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// 直接运行脚本时执行测试
if (require.main === module) {
  main();
}
