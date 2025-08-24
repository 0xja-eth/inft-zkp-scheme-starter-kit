import { IEncryptionService } from '../ICryptoService';
import crypto from 'crypto';

export class AES256GCMEncryptionService implements IEncryptionService {
  /**
   * Generate a cryptographically secure random key
   */
  generateKey(): Buffer {
    return crypto.randomBytes(32);
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  async encrypt(data: string, key: Buffer): Promise<Buffer> {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

      let encrypted = cipher.update(data, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const tag = cipher.getAuthTag();

      // Return: iv + encrypted + tag
      return Buffer.concat([iv, encrypted, tag]);
    } catch (error: any) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  async decrypt(encryptedData: Buffer, key: Buffer): Promise<string> {
    try {
      const iv = encryptedData.subarray(0, 16);
      const tag = encryptedData.subarray(-16);
      const encrypted = encryptedData.subarray(16, -16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error: any) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
}
