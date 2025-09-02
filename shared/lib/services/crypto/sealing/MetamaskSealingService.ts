import { ISealingService } from '../ICryptoService';
import { encrypt, decrypt, getEncryptionPublicKey } from '@metamask/eth-sig-util';
import { ethers } from 'ethers';

/**
 * MetaMask 兼容的密钥封装服务
 *
 * 基于 @metamask/eth-sig-util 实现，完全兼容 MetaMask 的加密标准
 * 支持 eth_getEncryptionPublicKey 和 eth_decrypt 流程
 *
 * 使用方式：
 * 1. 前端调用 MetaMask 的 eth_getEncryptionPublicKey 获取 base64 公钥
 * 2. 使用该公钥进行密钥封装
 * 3. 前端可以用 eth_decrypt 解封装
 */
export class X25519XSalsa20Poly1305SealingService implements ISealingService {

  /**
   * 从以太坊私钥获取加密公钥
   * @param ethereumPrivateKey 以太坊私钥 (0x前缀或不带前缀)
   * @returns base64 编码的加密公钥
   */
  static getEncryptionPublicKeyFromPrivateKey(ethereumPrivateKey: string): string {
    const cleanPrivateKey = ethereumPrivateKey.startsWith('0x')
        ? ethereumPrivateKey.slice(2)
        : ethereumPrivateKey;

    return getEncryptionPublicKey(cleanPrivateKey);
  }

  /**
   * 封装密钥，兼容 MetaMask 加密格式
   * @param encryptionKey 要封装的密钥数据
   * @param recipientPublicKey 接收者的加密公钥 (base64 格式)
   * @returns 加密后的数据 (JSON 字符串)
   */
  async sealKey(
      encryptionKey: Buffer,
      recipientPublicKey: string
  ): Promise<string> {
    try {
      console.log('🔐 Sealing key using @metamask/eth-sig-util...');

      // 使用 @metamask/eth-sig-util 的 encrypt 函数
      const encryptedData = encrypt({
        publicKey: recipientPublicKey,
        data: encryptionKey.toString('base64'), // 将密钥转换为 base64
        version: 'x25519-xsalsa20-poly1305'
      });

      // 返回 JSON 字符串格式的加密数据
      const result = JSON.stringify(encryptedData);

      console.log('✅ Key sealed successfully');
      console.log(`📦 Encrypted data length: ${result.length} chars`);

      return result;

    } catch (error: any) {
      console.error('❌ Key sealing failed:', error);
      throw new Error(`Failed to seal key: ${error.message}`);
    }
  }

  /**
   * 解封密钥，兼容 MetaMask 解密格式
   * @param encryptedData 加密的数据 (JSON 字符串)
   * @param recipientPrivateKey 接收者的以太坊私钥
   * @returns 解密后的原始密钥
   */
  async unsealKey(
      encryptedData: string,
      recipientPrivateKey: string
  ): Promise<Buffer> {
    try {
      console.log('🔓 Unsealing key using @metamask/eth-sig-util...');

      const cleanPrivateKey = recipientPrivateKey.startsWith('0x')
          ? recipientPrivateKey.slice(2)
          : recipientPrivateKey;

      // 解析加密数据
      const encryptedObject = JSON.parse(encryptedData);

      // 使用 @metamask/eth-sig-util 的 decrypt 函数
      const decryptedBase64 = decrypt({
        encryptedData: encryptedObject,
        privateKey: cleanPrivateKey
      });

      // 从 base64 转换回 Buffer
      const decryptedKey = Buffer.from(decryptedBase64, 'base64');

      console.log('✅ Key unsealed successfully');
      console.log(`🔑 Decrypted key length: ${decryptedKey.length} bytes`);

      return decryptedKey;

    } catch (error: any) {
      console.error('❌ Key unsealing failed:', error);
      throw new Error(`Failed to unseal key: ${error.message}`);
    }
  }

  /**
   * 从 Signer 获取加密公钥
   * @param signer ethers Signer 实例
   * @returns base64 编码的加密公钥
   */
  static async getEncryptionPublicKeyFromSigner(signer: ethers.Signer): Promise<string> {
    try {
      // 尝试直接通过 MetaMask provider 获取
      if (signer.provider && 'send' in signer.provider) {
        const address = await signer.getAddress();
        const publicKey = await (signer.provider as any).send('eth_getEncryptionPublicKey', [address]);
        return publicKey;
      }

      // 如果没有 MetaMask provider，尝试从私钥派生
      if ('privateKey' in signer && (signer as any).privateKey) {
        return this.getEncryptionPublicKeyFromPrivateKey((signer as any).privateKey);
      }

      throw new Error('Unable to derive encryption public key from signer');

    } catch (error: any) {
      console.error('Failed to get encryption public key from signer:', error);
      throw error;
    }
  }

  /**
   * 验证加密数据的完整性
   * @param encryptedData 加密数据 JSON 字符串
   * @returns 验证结果
   */
  static validateEncryptedData(encryptedData: string): boolean {
    try {
      const parsed = JSON.parse(encryptedData);

      // 检查必需的字段
      const requiredFields = ['version', 'nonce', 'ephemPublicKey', 'ciphertext'];
      const hasAllFields = requiredFields.every(field => field in parsed);

      // 检查版本
      const isValidVersion = parsed.version === 'x25519-xsalsa20-poly1305';

      return hasAllFields && isValidVersion;

    } catch {
      return false;
    }
  }

  /**
   * 创建测试用的密钥对
   * @returns 包含私钥和对应公钥的对象
   */
  static createTestKeyPair(): {
    privateKey: string;
    publicKey: string;
    address: string;
  } {
    // 生成随机的以太坊钱包
    const wallet = ethers.Wallet.createRandom();

    return {
      privateKey: wallet.privateKey,
      publicKey: this.getEncryptionPublicKeyFromPrivateKey(wallet.privateKey),
      address: wallet.address
    };
  }

  /**
   * 获取 MetaMask 兼容的公钥（从以太坊私钥派生）
   * 注意：实际使用中应该从前端的 eth_getEncryptionPublicKey 获取
   */
  static getMetaMaskPublicKey(ethereumPrivateKey: string): string {
    return this.getEncryptionPublicKeyFromPrivateKey(ethereumPrivateKey);
  }

  /**
   * 为了向后兼容，保留原有的方法名
   */
  static deriveX25519KeyPairFromEthereumKey(ethereumPrivateKey: string): {
    publicKey: string; // base64
    privateKey: string; // hex (注意：这里返回原始的以太坊私钥，因为 @metamask/eth-sig-util 直接使用它)
  } {
    const cleanPrivateKey = ethereumPrivateKey.startsWith('0x')
        ? ethereumPrivateKey.slice(2)
        : ethereumPrivateKey;

    return {
      publicKey: this.getEncryptionPublicKeyFromPrivateKey(ethereumPrivateKey),
      privateKey: cleanPrivateKey // 返回原始私钥，让 @metamask/eth-sig-util 处理派生
    };
  }
}

/**
 * 辅助函数：批量封装多个密钥
 */
export async function sealMultipleKeys(
    keys: Buffer[],
    recipientPublicKey: string
): Promise<string[]> {
  const sealingService = new X25519XSalsa20Poly1305SealingService();

  const sealPromises = keys.map(key =>
      sealingService.sealKey(key, recipientPublicKey)
  );

  return Promise.all(sealPromises);
}

/**
 * 辅助函数：批量解封多个密钥
 */
export async function unsealMultipleKeys(
    encryptedKeys: string[],
    recipientPrivateKey: string
): Promise<Buffer[]> {
  const sealingService = new X25519XSalsa20Poly1305SealingService();

  const unsealPromises = encryptedKeys.map(encryptedKey =>
      sealingService.unsealKey(encryptedKey, recipientPrivateKey)
  );

  return Promise.all(unsealPromises);
}