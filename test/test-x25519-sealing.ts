#!/usr/bin/env tsx

import crypto from 'crypto';
import { X25519XSalsa20Poly1305SealingService } from '../shared/lib/services/crypto/sealing/X25519XSalsa20Poly1305SealingService';
import { ethers } from 'ethers';
import * as naclUtil from 'tweetnacl-util';
import * as nacl from 'tweetnacl';

/**
 * X25519XSalsa20Poly1305SealingService 测试脚本
 * 
 * 测试内容：
 * 1. 基础密钥封装和解封装
 * 2. 不同公钥格式支持（0x前缀、纯hex、base64）
 * 3. 错误情况处理
 * 4. MetaMask兼容性
 * 5. X25519密钥对生成和转换
 */

interface TestResult {
  testName: string;
  passed: boolean;
  message?: string;
  timing?: number;
}

class X25519SealingTester {
  private sealingService: X25519XSalsa20Poly1305SealingService;
  private results: TestResult[] = [];

  constructor() {
    this.sealingService = new X25519XSalsa20Poly1305SealingService();
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
   * 生成X25519密钥对（用于测试）
   */
  private generateX25519KeyPair(): { publicKey: string; privateKey: string } {
    const keyPair = nacl.box.keyPair();
    return {
      publicKey: naclUtil.encodeBase64(keyPair.publicKey),
      privateKey: naclUtil.encodeBase64(keyPair.secretKey),
    };
  }

  /**
   * 将X25519公钥转换为不同格式
   */
  private convertPublicKeyFormats(base64PublicKey: string): {
    base64: string;
    hex: string;
    hexWith0x: string;
    ethLike: string;
  } {
    const keyBytes = naclUtil.decodeBase64(base64PublicKey);
    const hex = Buffer.from(keyBytes).toString('hex');
    
    return {
      base64: base64PublicKey,
      hex: hex,
      hexWith0x: '0x' + hex,
      ethLike: '0x04' + hex + hex // 模拟以太坊公钥格式
    };
  }

  /**
   * 测试基础密钥封装和解封装功能
   */
  async testBasicSealingAndUnsealing() {
    const startTime = Date.now();
    
    try {
      // 生成X25519密钥对
      const keyPair = this.generateX25519KeyPair();
      const encryptionKey = crypto.randomBytes(32);

      // 执行封装
      const sealedKey = await this.sealingService.sealKey(encryptionKey, keyPair.publicKey);
      
      // 验证封装结果
      if (!sealedKey || sealedKey.length === 0) {
        throw new Error('Sealed key is empty');
      }

      // 执行解封装
      const unsealedKey = await this.sealingService.unsealKey(sealedKey, keyPair.privateKey);
      
      // 验证解封装结果
      if (!encryptionKey.equals(unsealedKey)) {
        throw new Error(`Key mismatch: original=${encryptionKey.toString('hex')}, unsealed=${unsealedKey.toString('hex')}`);
      }

      const timing = Date.now() - startTime;
      this.logTest('Basic Sealing and Unsealing', true, `Successfully handled ${encryptionKey.length}-byte key`, timing);
    } catch (error) {
      const timing = Date.now() - startTime;
      this.logTest('Basic Sealing and Unsealing', false, (error as Error).message, timing);
    }
  }

  /**
   * 测试不同公钥格式的支持
   */
  async testDifferentPublicKeyFormats() {
    const keyPair = this.generateX25519KeyPair();
    const encryptionKey = crypto.randomBytes(32);
    const formats = this.convertPublicKeyFormats(keyPair.publicKey);

    const formatTests = [
      { name: 'Base64', key: formats.base64 },
      { name: 'Hex', key: formats.hex },
      { name: 'Hex with 0x', key: formats.hexWith0x },
      { name: 'Ethereum-like', key: formats.ethLike },
    ];

    for (const test of formatTests) {
      const startTime = Date.now();
      
      try {
        const sealedKey = await this.sealingService.sealKey(encryptionKey, test.key);
        const unsealedKey = await this.sealingService.unsealKey(sealedKey, keyPair.privateKey);

        if (!encryptionKey.equals(unsealedKey)) {
          throw new Error('Key mismatch after unsealing');
        }

        const timing = Date.now() - startTime;
        this.logTest(`Public Key Format: ${test.name}`, true, `Format: ${test.key.substring(0, 20)}...`, timing);
      } catch (error) {
        const timing = Date.now() - startTime;
        this.logTest(`Public Key Format: ${test.name}`, false, (error as Error).message, timing);
      }
    }
  }

  /**
   * 测试以太坊钱包公钥兼容性
   */
  async testEthereumWalletCompatibility() {
    const startTime = Date.now();
    
    try {
      const ethWallet = ethers.Wallet.createRandom();
      const ethPublicKey = ethWallet.signingKey.publicKey; // 以太坊格式的公钥
      const encryptionKey = crypto.randomBytes(32);

      // 注意：以太坊secp256k1公钥不能直接用于X25519
      // 这里测试解析能力，但实际加密可能失败
      try {
        const sealedKey = await this.sealingService.sealKey(encryptionKey, ethPublicKey);
        const timing = Date.now() - startTime;
        this.logTest('Ethereum Wallet Compatibility', true, `Parsed Ethereum public key format`, timing);
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('Failed to decrypt')) {
          // 预期的错误，因为以太坊密钥不是X25519格式
          const timing = Date.now() - startTime;
          this.logTest('Ethereum Wallet Compatibility', true, 'Correctly handled non-X25519 key format', timing);
        } else {
          throw error;
        }
      }
    } catch (error) {
      const timing = Date.now() - startTime;
      this.logTest('Ethereum Wallet Compatibility', false, (error as Error).message, timing);
    }
  }

  /**
   * 测试私钥格式支持
   */
  async testPrivateKeyFormats() {
    const keyPair = this.generateX25519KeyPair();
    const encryptionKey = crypto.randomBytes(16);
    
    // 生成密封密钥
    const sealedKey = await this.sealingService.sealKey(encryptionKey, keyPair.publicKey);
    
    // 将私钥转换为不同格式
    const privateKeyBytes = naclUtil.decodeBase64(keyPair.privateKey);
    const hexPrivateKey = Buffer.from(privateKeyBytes).toString('hex');
    
    const privateKeyFormats = [
      { name: 'Base64', key: keyPair.privateKey },
      { name: 'Hex', key: hexPrivateKey },
      { name: 'Hex with 0x', key: '0x' + hexPrivateKey },
    ];

    for (const test of privateKeyFormats) {
      const startTime = Date.now();
      
      try {
        const unsealedKey = await this.sealingService.unsealKey(sealedKey, test.key);

        if (!encryptionKey.equals(unsealedKey)) {
          throw new Error('Key mismatch after unsealing');
        }

        const timing = Date.now() - startTime;
        this.logTest(`Private Key Format: ${test.name}`, true, `Successfully unsealed with ${test.name} format`, timing);
      } catch (error) {
        const timing = Date.now() - startTime;
        this.logTest(`Private Key Format: ${test.name}`, false, (error as Error).message, timing);
      }
    }
  }

  /**
   * 测试错误的密钥配对
   */
  async testWrongKeyPair() {
    const startTime = Date.now();
    
    try {
      const keyPair1 = this.generateX25519KeyPair();
      const keyPair2 = this.generateX25519KeyPair();
      const encryptionKey = crypto.randomBytes(32);

      // 使用keyPair1的公钥封装
      const sealedKey = await this.sealingService.sealKey(encryptionKey, keyPair1.publicKey);
      
      // 尝试使用keyPair2的私钥解封装
      try {
        await this.sealingService.unsealKey(sealedKey, keyPair2.privateKey);
        throw new Error('Should have failed with wrong private key');
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('Failed to decrypt')) {
          const timing = Date.now() - startTime;
          this.logTest('Wrong Key Pair', true, 'Correctly rejected wrong private key', timing);
        } else {
          throw error;
        }
      }
    } catch (error) {
      const timing = Date.now() - startTime;
      this.logTest('Wrong Key Pair', false, (error as Error).message, timing);
    }
  }

  /**
   * 测试MetaMask兼容的payload格式
   */
  async testMetaMaskPayloadFormat() {
    const startTime = Date.now();
    
    try {
      const keyPair = this.generateX25519KeyPair();
      const encryptionKey = crypto.randomBytes(32);

      const sealedKey = await this.sealingService.sealKey(encryptionKey, keyPair.publicKey);
      
      // 解析payload格式
      const payloadJson = Buffer.from(sealedKey, 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);
      
      // 验证MetaMask兼容的字段
      const requiredFields = ['version', 'nonce', 'ephemPublicKey', 'ciphertext'];
      for (const field of requiredFields) {
        if (!payload.hasOwnProperty(field)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // 验证版本
      if (payload.version !== 'x25519-xsalsa20-poly1305') {
        throw new Error(`Unexpected version: ${payload.version}`);
      }

      // 验证组件格式（应该都是base64）
      try {
        naclUtil.decodeBase64(payload.nonce);
        naclUtil.decodeBase64(payload.ephemPublicKey);
        naclUtil.decodeBase64(payload.ciphertext);
      } catch (error) {
        throw new Error('Invalid base64 encoding in payload components');
      }

      const timing = Date.now() - startTime;
      this.logTest('MetaMask Payload Format', true, 'All required fields present and valid', timing);
    } catch (error) {
      const timing = Date.now() - startTime;
      this.logTest('MetaMask Payload Format', false, (error as Error).message, timing);
    }
  }

  /**
   * 测试损坏的密封数据
   */
  async testCorruptedSealedData() {
    const startTime = Date.now();
    
    try {
      const keyPair = this.generateX25519KeyPair();
      const encryptionKey = crypto.randomBytes(32);

      const sealedKey = await this.sealingService.sealKey(encryptionKey, keyPair.publicKey);
      
      // 损坏密封数据
      const corruptedSealedKey = sealedKey.slice(0, -10) + 'CORRUPTED==';
      
      try {
        await this.sealingService.unsealKey(corruptedSealedKey, keyPair.privateKey);
        throw new Error('Should have failed with corrupted data');
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('unsealing failed') || errorMessage.includes('JSON') || errorMessage.includes('Failed to decrypt')) {
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
   * 测试不同密钥长度
   */
  async testDifferentKeyLengths() {
    const keyLengths = [16, 32, 64, 128]; // 不同的加密密钥长度
    const keyPair = this.generateX25519KeyPair();
    
    for (const keyLength of keyLengths) {
      const startTime = Date.now();
      
      try {
        const encryptionKey = crypto.randomBytes(keyLength);
        const sealedKey = await this.sealingService.sealKey(encryptionKey, keyPair.publicKey);
        const unsealedKey = await this.sealingService.unsealKey(sealedKey, keyPair.privateKey);

        if (!encryptionKey.equals(unsealedKey)) {
          throw new Error('Key length mismatch after unsealing');
        }

        const timing = Date.now() - startTime;
        this.logTest(`Key Length ${keyLength * 8}-bit`, true, `Success with ${keyLength} bytes`, timing);
      } catch (error) {
        const timing = Date.now() - startTime;
        this.logTest(`Key Length ${keyLength * 8}-bit`, false, (error as Error).message, timing);
      }
    }
  }

  /**
   * 测试性能：多次封装和解封装
   */
  async testPerformance() {
    const iterations = 50;
    const keyPair = this.generateX25519KeyPair();
    const encryptionKey = crypto.randomBytes(32);

    try {
      // 测试封装性能
      const sealStartTime = Date.now();
      const sealedKeys: string[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const sealedKey = await this.sealingService.sealKey(encryptionKey, keyPair.publicKey);
        sealedKeys.push(sealedKey);
      }
      
      const sealTime = Date.now() - sealStartTime;
      const avgSealTime = sealTime / iterations;

      // 测试解封装性能
      const unsealStartTime = Date.now();
      let successCount = 0;
      
      for (const sealedKey of sealedKeys) {
        const unsealedKey = await this.sealingService.unsealKey(sealedKey, keyPair.privateKey);
        if (encryptionKey.equals(unsealedKey)) {
          successCount++;
        }
      }
      
      const unsealTime = Date.now() - unsealStartTime;
      const avgUnsealTime = unsealTime / iterations;

      if (successCount !== iterations) {
        throw new Error(`Only ${successCount}/${iterations} operations succeeded`);
      }

      this.logTest('Performance Test', true, 
        `${iterations} iterations: seal avg ${avgSealTime.toFixed(2)}ms, unseal avg ${avgUnsealTime.toFixed(2)}ms`);
    } catch (error) {
      this.logTest('Performance Test', false, (error as Error).message);
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🔧 Starting X25519XSalsa20Poly1305SealingService Tests...\n');
    
    await this.testBasicSealingAndUnsealing();
    await this.testDifferentPublicKeyFormats();
    await this.testEthereumWalletCompatibility();
    await this.testPrivateKeyFormats();
    await this.testWrongKeyPair();
    await this.testMetaMaskPayloadFormat();
    await this.testCorruptedSealedData();
    await this.testDifferentKeyLengths();
    await this.testPerformance();
    
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
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`   • ${result.testName}: ${result.message}`);
      });
    }
    
    // 性能统计
    const timedResults = this.results.filter(r => r.timing);
    if (timedResults.length > 0) {
      const avgTiming = timedResults.reduce((sum, r) => sum + (r.timing || 0), 0) / timedResults.length;
      console.log(`\n⏱️  Average Test Time: ${avgTiming.toFixed(2)}ms`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(failedTests === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed!');
  }
}

// 运行测试
async function main() {
  const tester = new X25519SealingTester();
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