import {ISealingService} from "../ICryptoService";
import * as naclUtil from "tweetnacl-util";
import * as nacl from "tweetnacl";


export class X25519XSalsa20Poly1305SealingService implements ISealingService {

  /**
   * 使用X25519-XSalsa20-Poly1305封装密钥（MetaMask兼容）
   * @param encryptionKey 要封装的密钥
   * @param publicKey 接收者的X25519公钥（base64格式）
   */
  async sealKey(encryptionKey: Buffer, publicKey: string): Promise<string> {
    try {
      console.log('🔐 Sealing key using X25519-XSalsa20-Poly1305...');

      // 1. 解码接收者公钥
      const recipientPublicKey = naclUtil.decodeBase64(publicKey);
      if (recipientPublicKey.length !== 32) {
        throw new Error('Invalid public key length. Expected 32 bytes for X25519.');
      }

      // 2. 生成临时密钥对
      const ephemeralKeyPair = nacl.box.keyPair();

      // 3. 生成随机nonce
      const nonce = nacl.randomBytes(nacl.box.nonceLength); // 24 bytes for XSalsa20

      // 4. 使用NaCl box加密密钥
      const ciphertext = nacl.box(
          encryptionKey,
          nonce,
          recipientPublicKey,
          ephemeralKeyPair.secretKey
      );

      // 5. 构建MetaMask兼容的payload
      const payload = {
        version: 'x25519-xsalsa20-poly1305',
        nonce: naclUtil.encodeBase64(nonce),
        ephemPublicKey: naclUtil.encodeBase64(ephemeralKeyPair.publicKey),
        ciphertext: naclUtil.encodeBase64(ciphertext),
      };

      // 6. 返回base64编码的JSON
      const payloadJson = JSON.stringify(payload);
      const sealedKey = Buffer.from(payloadJson).toString('base64');

      console.log(`✅ Key sealed successfully using X25519-XSalsa20-Poly1305`);
      console.log(`Payload size: ${sealedKey.length} characters`);

      return sealedKey;

    } catch (error: any) {
      throw new Error(`X25519 key sealing failed: ${error.message}`);
    }
  }

  /**
   * 使用X25519-XSalsa20-Poly1305解封密钥
   * @param sealedKey 封装的密钥（base64编码的JSON）
   * @param privateKey 接收者的X25519私钥（base64格式）
   */
  async unsealKey(sealedKey: string, privateKey: string): Promise<Buffer> {
    try {
      console.log('🔓 Unsealing key using X25519-XSalsa20-Poly1305...');

      // 1. 解析payload
      const payloadJson = Buffer.from(sealedKey, 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);

      // 2. 验证版本
      if (payload.version !== 'x25519-xsalsa20-poly1305') {
        throw new Error(`Unsupported payload version: ${payload.version}`);
      }

      // 3. 解码组件
      const nonce = naclUtil.decodeBase64(payload.nonce);
      const ephemeralPublicKey = naclUtil.decodeBase64(payload.ephemPublicKey);
      const ciphertext = naclUtil.decodeBase64(payload.ciphertext);
      const recipientPrivateKey = naclUtil.decodeBase64(privateKey);

      // 4. 验证组件长度
      if (nonce.length !== nacl.box.nonceLength) {
        throw new Error(`Invalid nonce length: ${nonce.length}`);
      }
      if (ephemeralPublicKey.length !== 32) {
        throw new Error(`Invalid ephemeral public key length: ${ephemeralPublicKey.length}`);
      }
      if (recipientPrivateKey.length !== 32) {
        throw new Error(`Invalid private key length: ${recipientPrivateKey.length}`);
      }

      // 5. 使用NaCl box解密
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
      throw new Error(`X25519 key unsealing failed: ${error.message}`);
    }
  }
}