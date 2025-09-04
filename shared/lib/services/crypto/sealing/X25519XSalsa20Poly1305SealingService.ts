import { ISealingService } from '../ICryptoService';
import { encrypt, decrypt, getEncryptionPublicKey } from '@metamask/eth-sig-util';
import { ethers } from 'ethers';

/**
 * MetaMask-compatible key sealing service
 * 
 * Uses @metamask/eth-sig-util library for fully compatible encryption/decryption
 * Outputs in compact format to reduce storage costs
 * 
 * Usage:
 * 1. Frontend calls MetaMask's eth_getEncryptionPublicKey to get public key
 * 2. Use that public key for key sealing
 * 3. Frontend can use eth_decrypt to unseal
 */
export class X25519XSalsa20Poly1305SealingService implements ISealingService {

  /**
   * Seal key using @metamask/eth-sig-util and output in compact format
   * @param encryptionKey The key to seal
   * @param metaMaskPublicKey MetaMask public key (obtained from eth_getEncryptionPublicKey)
   */
  async sealKey(encryptionKey: Buffer, metaMaskPublicKey: string): Promise<string> {
    try {
      console.log('🔐 Sealing key using @metamask/eth-sig-util...');

      // 1. Encrypt using @metamask/eth-sig-util
      const encryptedData = encrypt({
        publicKey: metaMaskPublicKey,
        data: encryptionKey.toString('base64'),
        version: 'x25519-xsalsa20-poly1305'
      });

      // 2. Convert to compact format to reduce storage costs
      const compactPayload = this.convertToCompactFormat(encryptedData);

      console.log(`✅ Key sealed successfully using compact format`);
      console.log(`Compact payload size: ${compactPayload.length} chars`);

      return compactPayload;
    } catch (error: any) {
      throw new Error(`MetaMask key sealing failed: ${error.message}`);
    }
  }

  /**
   * Unseal key (for server-side testing, in actual use frontend will call MetaMask's eth_decrypt)
   * @param sealedKey Sealed key (compact format)
   * @param ethereumPrivateKey Ethereum private key
   */
  async unsealKey(sealedKey: string, ethereumPrivateKey: string): Promise<Buffer> {
    try {
      console.log('🔓 Unsealing key using @metamask/eth-sig-util...');

      // 1. Convert compact format to MetaMask standard format
      const metaMaskFormat = this.convertFromCompactFormat(sealedKey);

      // 2. Decrypt using @metamask/eth-sig-util
      const decryptedData = decrypt({
        encryptedData: metaMaskFormat,
        privateKey: ethereumPrivateKey.startsWith('0x') ? ethereumPrivateKey.slice(2) : ethereumPrivateKey
      });

      console.log(`✅ Key unsealed successfully`);
      return Buffer.from(decryptedData, 'base64');
    } catch (error: any) {
      throw new Error(`Key unsealing failed: ${error.message}`);
    }
  }

  /**
   * Convert @metamask/eth-sig-util encryption result to compact format
   * @param encryptedData @metamask/eth-sig-util encryption result
   * @returns Compact format hexadecimal string
   */
  private convertToCompactFormat(encryptedData: any): string {
    try {
      // Decode each component
      const nonce = Buffer.from(encryptedData.nonce, 'base64');
      const ephemPublicKey = Buffer.from(encryptedData.ephemPublicKey, 'base64');
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');

      // Build compact format: nonce(24 bytes) + ephemPublicKey(32 bytes) + ciphertext(variable length)
      const compactPayload = Buffer.concat([
        nonce,
        ephemPublicKey,
        ciphertext
      ]);

      // Return hexadecimal format
      return ethers.hexlify(compactPayload);
    } catch (error: any) {
      throw new Error(`Compact format conversion failed: ${error.message}`);
    }
  }

  /**
   * Convert compact format to @metamask/eth-sig-util compatible format
   * @param compactSealedKey Compact format key (hexadecimal)
   * @returns @metamask/eth-sig-util compatible format
   */
  private convertFromCompactFormat(compactSealedKey: string): any {
    try {
      // Parse compact format
      const compactPayload = ethers.getBytes(compactSealedKey);
      
      // Validate minimum length: nonce(24) + ephemPublicKey(32) + ciphertext(at least 16)
      if (compactPayload.length < 72) {
        throw new Error(`Invalid compact payload length: ${compactPayload.length}, minimum 72 bytes`);
      }

      // Extract components
      const nonce = compactPayload.subarray(0, 24);
      const ephemPublicKey = compactPayload.subarray(24, 56);
      const ciphertext = compactPayload.subarray(56);

      // Build @metamask/eth-sig-util compatible format
      return {
        version: 'x25519-xsalsa20-poly1305',
        nonce: Buffer.from(nonce).toString('base64'),
        ephemPublicKey: Buffer.from(ephemPublicKey).toString('base64'),
        ciphertext: Buffer.from(ciphertext).toString('base64')
      };
    } catch (error: any) {
      throw new Error(`Compact format parsing failed: ${error.message}`);
    }
  }

  /**
   * Get MetaMask-compatible public key (derived from Ethereum private key)
   * Note: In actual use, should be obtained from frontend's eth_getEncryptionPublicKey
   */
  static getMetaMaskPublicKey(ethereumPrivateKey: string): string {
    const cleanPrivateKey = ethereumPrivateKey.startsWith('0x') 
      ? ethereumPrivateKey.slice(2) 
      : ethereumPrivateKey;
    
    return getEncryptionPublicKey(cleanPrivateKey);
  }

  /**
   * Static method: Convert compact format to MetaMask JSON format (for frontend compatibility)
   * @param compactSealedKey Compact format key
   * @returns MetaMask-compatible base64-encoded JSON format
   */
  static convertCompactToMetaMaskFormat(compactSealedKey: string): string {
    try {
      const service = new X25519XSalsa20Poly1305SealingService();
      const metaMaskFormat = service.convertFromCompactFormat(compactSealedKey);
      return Buffer.from(JSON.stringify(metaMaskFormat)).toString('base64');
    } catch (error: any) {
      throw new Error(`Compact to MetaMask conversion failed: ${error.message}`);
    }
  }

  /**
   * Static method: Convert MetaMask JSON format to compact format
   * @param metaMaskSealedKey MetaMask format key (base64-encoded JSON)
   * @returns Compact format hexadecimal string
   */
  static convertMetaMaskToCompactFormat(metaMaskSealedKey: string): string {
    try {
      const payloadJson = Buffer.from(metaMaskSealedKey, 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);

      // Validate version
      if (payload.version !== 'x25519-xsalsa20-poly1305') {
        throw new Error(`Unsupported version: ${payload.version}`);
      }

      const service = new X25519XSalsa20Poly1305SealingService();
      return service.convertToCompactFormat(payload);
    } catch (error: any) {
      throw new Error(`MetaMask to compact conversion failed: ${error.message}`);
    }
  }
}