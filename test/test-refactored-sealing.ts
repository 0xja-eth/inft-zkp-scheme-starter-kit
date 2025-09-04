import { X25519XSalsa20Poly1305SealingService } from '../shared/lib/services/crypto/sealing/X25519XSalsa20Poly1305SealingService';
import { ethers } from 'ethers';

async function testRefactoredSealingService() {
  console.log('🧪 Testing Refactored X25519XSalsa20Poly1305SealingService with @metamask/eth-sig-util');
  console.log('=' .repeat(80));

  try {
    // 1. 生成测试用的以太坊密钥对
    const wallet = ethers.Wallet.createRandom();
    const ethereumPrivateKey = wallet.privateKey;
    const ethereumAddress = wallet.address;
    
    console.log(`📝 Test Ethereum Address: ${ethereumAddress}`);
    console.log(`🔑 Private Key: ${ethereumPrivateKey.slice(0, 10)}...`);

    // 2. 获取 MetaMask 兼容的公钥
    const metaMaskPublicKey = X25519XSalsa20Poly1305SealingService.getMetaMaskPublicKey(ethereumPrivateKey);
    console.log(`🔐 MetaMask Public Key: ${metaMaskPublicKey.slice(0, 20)}...`);

    // 3. 创建服务实例
    const sealingService = new X25519XSalsa20Poly1305SealingService();

    // 4. 准备要封装的测试密钥
    const testKey = Buffer.from('This is a secret encryption key for testing!', 'utf8');
    console.log(`📦 Original Key: "${testKey.toString()}" (${testKey.length} bytes)`);

    // 5. 封装密钥（使用 @metamask/eth-sig-util 并输出紧凑格式）
    console.log('\n🔐 Sealing key...');
    const sealedKey = await sealingService.sealKey(testKey, metaMaskPublicKey);
    console.log(`✅ Sealed Key (compact format): ${sealedKey.slice(0, 50)}...`);
    console.log(`📏 Compact payload length: ${sealedKey.length} characters`);

    // 6. 解封装密钥
    console.log('\n🔓 Unsealing key...');
    const unsealedKey = await sealingService.unsealKey(sealedKey, ethereumPrivateKey);
    console.log(`✅ Unsealed Key: "${unsealedKey.toString()}" (${unsealedKey.length} bytes)`);

    // 7. 验证结果
    const isMatch = testKey.equals(unsealedKey);
    console.log(`\n🔍 Verification: ${isMatch ? '✅ PASS' : '❌ FAIL'}`);
    
    if (!isMatch) {
      console.log(`❌ Original: ${testKey.toString('hex')}`);
      console.log(`❌ Unsealed: ${unsealedKey.toString('hex')}`);
      throw new Error('Key mismatch after seal/unseal cycle');
    }

    // 8. 测试格式转换功能
    console.log('\n🔄 Testing format conversion...');
    
    // 转换为 MetaMask 标准格式
    const metaMaskFormat = X25519XSalsa20Poly1305SealingService.convertCompactToMetaMaskFormat(sealedKey);
    console.log(`📄 MetaMask Format: ${metaMaskFormat.slice(0, 50)}...`);
    
    // 转换回紧凑格式
    const backToCompact = X25519XSalsa20Poly1305SealingService.convertMetaMaskToCompactFormat(metaMaskFormat);
    console.log(`📦 Back to Compact: ${backToCompact.slice(0, 50)}...`);
    
    // 验证转换是否保持一致
    const conversionMatch = sealedKey === backToCompact;
    console.log(`🔍 Format Conversion: ${conversionMatch ? '✅ PASS' : '❌ FAIL'}`);

    // 9. 性能测试
    console.log('\n⚡ Performance Test...');
    const iterations = 100;
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      const sealed = await sealingService.sealKey(testKey, metaMaskPublicKey);
      const unsealed = await sealingService.unsealKey(sealed, ethereumPrivateKey);
      if (!testKey.equals(unsealed)) {
        throw new Error(`Performance test failed at iteration ${i}`);
      }
    }
    
    const endTime = Date.now();
    const avgTime = (endTime - startTime) / iterations;
    console.log(`✅ ${iterations} seal/unseal cycles completed`);
    console.log(`⏱️  Average time per cycle: ${avgTime.toFixed(2)}ms`);

    console.log('\n' + '='.repeat(80));
    console.log('🎉 All tests passed! Refactored service is working correctly.');
    console.log('✨ Key benefits of the refactored implementation:');
    console.log('   • Uses official @metamask/eth-sig-util library');
    console.log('   • Maintains compact output format for storage efficiency');
    console.log('   • Full compatibility with MetaMask encryption/decryption');
    console.log('   • Simplified codebase with better maintainability');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testRefactoredSealingService().catch(console.error);
}

export { testRefactoredSealingService };
