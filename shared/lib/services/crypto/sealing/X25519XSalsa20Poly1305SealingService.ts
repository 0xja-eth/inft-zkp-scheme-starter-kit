import { ISealingService } from '../ICryptoService';
import * as naclUtil from 'tweetnacl-util';
import * as nacl from 'tweetnacl';
import crypto from 'crypto';
import {ethers} from "ethers";

/**
 * MetaMask 兼容的密钥封装服务
 * 
 * 这个服务完全按照 MetaMask 的 eth_getEncryptionPublicKey/eth_decrypt 标准实现
 * 
 * 使用方式：
 * 1. 前端调用 MetaMask 的 eth_getEncryptionPublicKey 获取 base64 公钥
 * 2. 使用该公钥进行密钥封装
 * 3. 前端可以用 eth_decrypt 解封装
 */
export class X25519XSalsa20Poly1305SealingService implements ISealingService {
  
  /**
   * 从以太坊私钥派生 X25519 密钥对（模拟 MetaMask 的行为）
   * @param ethereumPrivateKey 以太坊私钥
   * @returns X25519 密钥对
   */
  static deriveX25519KeyPairFromEthereumKey(ethereumPrivateKey: string): {
    publicKey: string; // base64
    privateKey: string; // base64
  } {
    const cleanPrivateKey = ethereumPrivateKey.startsWith('0x') 
      ? ethereumPrivateKey.slice(2) 
      : ethereumPrivateKey;
    
    // 使用与 MetaMask 类似的派生方法
    const ethPrivateKeyBuffer = Buffer.from(cleanPrivateKey, 'hex');
    
    // 使用 HKDF 派生 X25519 私钥（模拟 MetaMask 的内部逻辑）
    const x25519PrivateKey = crypto.hkdfSync(
      'sha256',
      ethPrivateKeyBuffer,
      Buffer.from('metamask-encryption-salt', 'utf8'),
      Buffer.from('metamask-x25519-derivation', 'utf8'),
      32
    );
    
    const keyPair = nacl.box.keyPair.fromSecretKey(new Uint8Array(x25519PrivateKey));
    
    return {
      publicKey: naclUtil.encodeBase64(keyPair.publicKey),
      privateKey: naclUtil.encodeBase64(keyPair.secretKey),
    };
  }

  /**
   * 封装密钥，完全兼容 MetaMask 格式
   * @param encryptionKey 要封装的密钥
   * @param metaMaskPublicKey MetaMask 的 base64 公钥 (从 eth_getEncryptionPublicKey 获取)
   */
  async sealKey(encryptionKey: Buffer, metaMaskPublicKey: string): Promise<string> {
    try {
      console.log('🔐 Sealing key using MetaMask-compatible X25519-XSalsa20-Poly1305...');

      // 1. 解码 MetaMask 公钥（应该是 base64 格式）
      const recipientPublicKey = naclUtil.decodeBase64(metaMaskPublicKey);
      if (recipientPublicKey.length !== 32) {
        throw new Error(`Invalid MetaMask public key length: ${recipientPublicKey.length}. Expected 32 bytes.`);
      }

      // 2. 生成临时密钥对
      const ephemeralKeyPair = nacl.box.keyPair();

      // 3. 生成随机 nonce
      const nonce = nacl.randomBytes(nacl.box.nonceLength); // 24 bytes

      // 4. 使用 NaCl box 加密
      const ciphertext = nacl.box(
        new Uint8Array(encryptionKey),
        nonce,
        recipientPublicKey,
        ephemeralKeyPair.secretKey
      );

      // 5. 构建紧凑格式 payload (移除固定字段以减少合约存储成本)
      // 格式: nonce(24字节) + ephemPublicKey(32字节) + ciphertext(变长)
      const compactPayload = Buffer.concat([
        Buffer.from(nonce),
        Buffer.from(ephemeralKeyPair.publicKey),
        Buffer.from(ciphertext)
      ]);

      // 6. 返回 hex 编码的紧凑格式
      const sealedKey = ethers.hexlify(compactPayload) // .toString("hex") // .toString('base64');

      console.log(`✅ Key sealed successfully using compact format`);
      console.log(`Compact payload size: ${sealedKey.length} chars (vs ~${Math.ceil(sealedKey.length * 1.8)} chars in JSON format)`);

      return sealedKey;
    } catch (error: any) {
      throw new Error(`MetaMask key sealing failed: ${error.message}`);
    }
  }

  /**
   * 解封装密钥（用于服务端测试，实际使用中前端会调用 MetaMask 的 eth_decrypt）
   * @param sealedKey 封装的密钥（Hex 编码的紧凑格式）
   * @param ethereumPrivateKey 以太坊私钥（会派生出 X25519 私钥）
   */
  async unsealKey(sealedKey: string, ethereumPrivateKey: string): Promise<Buffer> {
    try {
      console.log('🔓 Unsealing key using derived X25519 key...');

      // 1. 从以太坊私钥派生 X25519 私钥
      const derivedKeyPair = X25519XSalsa20Poly1305SealingService.deriveX25519KeyPairFromEthereumKey(ethereumPrivateKey);
      const recipientPrivateKey = naclUtil.decodeBase64(derivedKeyPair.privateKey);

      // 2. 解析紧凑格式 payload
      // const compactPayload = Buffer.from(sealedKey, 'hex');
      const compactPayload = ethers.getBytes(sealedKey);

      // 验证最小长度: nonce(24) + ephemPublicKey(32) + ciphertext(至少16)
      if (compactPayload.length < 72) {
        throw new Error(`Invalid compact payload length: ${compactPayload.length}, minimum 72 bytes`);
      }

      // 3. 提取组件 (固定长度)
      const nonce = new Uint8Array(compactPayload.subarray(0, 24));
      const ephemeralPublicKey = new Uint8Array(compactPayload.subarray(24, 56)); 
      const ciphertext = new Uint8Array(compactPayload.subarray(56));

      // 4. 验证组件长度（已通过固定偏移量保证）
      if (nonce.length !== nacl.box.nonceLength) {
        throw new Error(`Invalid nonce length: ${nonce.length}`);
      }
      if (ephemeralPublicKey.length !== 32) {
        throw new Error(`Invalid ephemeral public key length: ${ephemeralPublicKey.length}`);
      }

      // 5. 解密
      const decryptedKey = nacl.box.open(
        ciphertext,
        nonce,
        ephemeralPublicKey,
        recipientPrivateKey
      );

      if (!decryptedKey) {
        throw new Error('Failed to decrypt: invalid ciphertext or keys');
      }

      console.log(`✅ Key unsealed successfully (${decryptedKey.length} bytes)`);
      return Buffer.from(decryptedKey);
    } catch (error: any) {
      throw new Error(`Compact key unsealing failed: ${error.message}`);
    }
  }

  /**
   * 为了兼容 MetaMask，提供从紧凑格式转换为 MetaMask JSON 格式的方法
   * @param compactSealedKey 紧凑格式的密钥
   * @returns MetaMask 兼容的 JSON 格式
   */
  static convertCompactToMetaMaskFormat(compactSealedKey: string): string {
    try {
      // 解析紧凑格式
      const compactPayload = Buffer.from(compactSealedKey, 'base64');
      
      if (compactPayload.length < 72) {
        throw new Error(`Invalid compact payload length: ${compactPayload.length}`);
      }

      // 提取组件
      const nonce = compactPayload.subarray(0, 24);
      const ephemeralPublicKey = compactPayload.subarray(24, 56);
      const ciphertext = compactPayload.subarray(56);

      // 构建 MetaMask 标准格式
      const metaMaskPayload = {
        version: 'x25519-xsalsa20-poly1305',
        nonce: naclUtil.encodeBase64(nonce),
        ephemPublicKey: naclUtil.encodeBase64(ephemeralPublicKey),
        ciphertext: naclUtil.encodeBase64(ciphertext),
      };

      return Buffer.from(JSON.stringify(metaMaskPayload)).toString('base64');
    } catch (error: any) {
      throw new Error(`Compact to MetaMask conversion failed: ${error.message}`);
    }
  }

  /**
   * 从 MetaMask JSON 格式转换为紧凑格式
   * @param metaMaskSealedKey MetaMask 格式的密钥
   * @returns 紧凑格式的密钥
   */
  static convertMetaMaskToCompactFormat(metaMaskSealedKey: string): string {
    try {
      // 解析 MetaMask 格式
      const payloadJson = Buffer.from(metaMaskSealedKey, 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);

      // 验证版本
      if (payload.version !== 'x25519-xsalsa20-poly1305') {
        throw new Error(`Unsupported version: ${payload.version}`);
      }

      // 解码组件
      const nonce = naclUtil.decodeBase64(payload.nonce);
      const ephemeralPublicKey = naclUtil.decodeBase64(payload.ephemPublicKey);
      const ciphertext = naclUtil.decodeBase64(payload.ciphertext);

      // 构建紧凑格式
      const compactPayload = Buffer.concat([
        Buffer.from(nonce),
        Buffer.from(ephemeralPublicKey),
        Buffer.from(ciphertext)
      ]);

      return compactPayload.toString('base64');
    } catch (error: any) {
      throw new Error(`MetaMask to compact conversion failed: ${error.message}`);
    }
  }

  /**
   * 获取 MetaMask 兼容的公钥（从以太坊私钥派生）
   * 注意：实际使用中应该从前端的 eth_getEncryptionPublicKey 获取
   */
  static getMetaMaskPublicKey(ethereumPrivateKey: string): string {
    const derivedKeyPair = this.deriveX25519KeyPairFromEthereumKey(ethereumPrivateKey);
    return derivedKeyPair.publicKey;
  }
}