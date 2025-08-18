import * as crypto from 'crypto';
import { ethers } from 'ethers';

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  
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

  /**
   * Seal key for recipient using ECIES (Elliptic Curve Integrated Encryption Scheme)
   * Production-grade implementation using secp256k1 curve
   */
  async sealKey(encryptionKey: Buffer, recipientPublicKey: string): Promise<string> {
    try {
      console.log('🔐 Sealing key using ECIES...');
      
      // 1. Generate ephemeral key pair
      const ephemeralKeyPair = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1',
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' }
      });

      // 2. Convert recipient's public key to DER format for ECDH
      const recipientPubKeyDER = this.ethersPublicKeyToDER(recipientPublicKey);
      
      // 3. Perform ECDH to derive shared secret
      const ephemeralPrivateKey = crypto.createPrivateKey({
        key: ephemeralKeyPair.privateKey,
        format: 'der',
        type: 'pkcs8'
      });
      
      const recipientPublicKeyObj = crypto.createPublicKey({
        key: recipientPubKeyDER,
        format: 'der',
        type: 'spki'
      });

      const sharedSecret = crypto.diffieHellman({
        privateKey: ephemeralPrivateKey,
        publicKey: recipientPublicKeyObj
      });

      // 4. Derive encryption and MAC keys using HKDF
      const salt = Buffer.alloc(32); // Salt can be empty for simplicity
      const info = Buffer.from('ECIES_ENCRYPTION');
      
      const derivedKeys = crypto.hkdfSync('sha256', sharedSecret, salt, info, 64); // 32 bytes enc + 32 bytes mac
      const encKey = Buffer.from(derivedKeys).subarray(0, 32);
      const macKey = Buffer.from(derivedKeys).subarray(32, 64);

      // 5. Encrypt the data using AES-256-GCM
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
      
      let encrypted = cipher.update(encryptionKey);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const authTag = cipher.getAuthTag();

      // 6. Create MAC over ephemeral public key + iv + encrypted data
      const ephemeralPubKeyRaw = this.derToRawPublicKey(ephemeralKeyPair.publicKey);
      const macData = Buffer.concat([ephemeralPubKeyRaw, iv, encrypted]);
      const mac = crypto.createHmac('sha256', macKey).update(macData).digest();

      // 7. Construct final sealed key: ephemeralPubKey + iv + encrypted + authTag + mac
      const sealedKey = Buffer.concat([
        ephemeralPubKeyRaw,  // 65 bytes (0x04 + 32 + 32)
        iv,                  // 16 bytes
        encrypted,           // 32 bytes (same size as input key)
        authTag,             // 16 bytes
        mac                  // 32 bytes
      ]);

      console.log(`✅ Key sealed successfully (${sealedKey.length} bytes)`);
      return sealedKey.toString('hex');
      
    } catch (error: any) {
      throw new Error(`Key sealing failed: ${error.message}`);
    }
  }

  /**
   * Unseal key using ECIES
   */
  async unsealKey(sealedKeyHex: string, privateKey: string): Promise<Buffer> {
    try {
      console.log('🔓 Unsealing key using ECIES...');
      
      const sealedKey = Buffer.from(sealedKeyHex, 'hex');
      
      // Parse the sealed key components
      let offset = 0;
      const ephemeralPubKeyRaw = sealedKey.subarray(offset, offset + 65); // 65 bytes
      offset += 65;
      
      const iv = sealedKey.subarray(offset, offset + 16); // 16 bytes
      offset += 16;
      
      const encrypted = sealedKey.subarray(offset, offset + 32); // 32 bytes
      offset += 32;
      
      const authTag = sealedKey.subarray(offset, offset + 16); // 16 bytes
      offset += 16;
      
      const mac = sealedKey.subarray(offset); // remaining 32 bytes

      // Convert private key to DER format
      const privateKeyDER = this.ethersPrivateKeyToDER(privateKey);
      const privateKeyObj = crypto.createPrivateKey({
        key: privateKeyDER,
        format: 'der',
        type: 'pkcs8'
      });

      // Convert ephemeral public key to DER format
      const ephemeralPubKeyDER = this.rawPublicKeyToDER(ephemeralPubKeyRaw);
      const ephemeralPubKeyObj = crypto.createPublicKey({
        key: ephemeralPubKeyDER,
        format: 'der',
        type: 'spki'
      });

      // Perform ECDH to derive shared secret
      const sharedSecret = crypto.diffieHellman({
        privateKey: privateKeyObj,
        publicKey: ephemeralPubKeyObj
      });

      // Derive encryption and MAC keys using HKDF
      const salt = Buffer.alloc(32);
      const info = Buffer.from('ECIES_ENCRYPTION');
      
      const derivedKeys = crypto.hkdfSync('sha256', sharedSecret, salt, info, 64);
      const encKey = Buffer.from(derivedKeys).subarray(0, 32);
      const macKey = Buffer.from(derivedKeys).subarray(32, 64);

      // Verify MAC
      const macData = Buffer.concat([ephemeralPubKeyRaw, iv, encrypted]);
      const expectedMac = crypto.createHmac('sha256', macKey).update(macData).digest();
      
      if (!crypto.timingSafeEqual(mac, expectedMac)) {
        throw new Error('MAC verification failed - data may be corrupted or tampered');
      }

      // Decrypt the data
      const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      console.log(`✅ Key unsealed successfully (${decrypted.length} bytes)`);
      return decrypted;
      
    } catch (error: any) {
      throw new Error(`Key unsealing failed: ${error.message}`);
    }
  }

  // Private helper methods for key format conversion

  /**
   * Convert Ethers.js public key (0x04...) to DER format
   */
  private ethersPublicKeyToDER(ethersPublicKey: string): Buffer {
    // Remove 0x prefix if present
    const pubKeyHex = ethersPublicKey.replace('0x', '');
    
    // Ethers public key is already in uncompressed format (0x04 + x + y)
    const pubKeyRaw = Buffer.from(pubKeyHex, 'hex');
    
    return this.rawPublicKeyToDER(pubKeyRaw);
  }

  /**
   * Convert raw public key (65 bytes: 0x04 + x + y) to DER format
   */
  private rawPublicKeyToDER(rawPublicKey: Buffer): Buffer {
    // DER encoding for secp256k1 public key
    // SEQUENCE { SEQUENCE { OID, NULL }, BIT STRING }
    const oid = Buffer.from([
      0x30, 0x10, // SEQUENCE 16 bytes
      0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID for ecPublicKey
      0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x0a // OID for secp256k1
    ]);
    
    const bitString = Buffer.concat([
      Buffer.from([0x03, 0x42, 0x00]), // BIT STRING, 66 bytes, 0 unused bits
      rawPublicKey
    ]);
    
    const totalLength = oid.length + bitString.length;
    const sequence = Buffer.concat([
      Buffer.from([0x30, totalLength]), // SEQUENCE
      oid,
      bitString
    ]);
    
    return sequence;
  }

  /**
   * Convert DER public key to raw format (65 bytes)
   */
  private derToRawPublicKey(derPublicKey: Buffer): Buffer {
    // Find the bit string containing the raw key
    // The raw key is the last 65 bytes in the DER structure
    return derPublicKey.subarray(-65);
  }

  /**
   * Convert Ethers.js private key to DER format
   */
  private ethersPrivateKeyToDER(ethersPrivateKey: string): Buffer {
    // Remove 0x prefix
    const privKeyHex = ethersPrivateKey.replace('0x', '');
    const privKeyBytes = Buffer.from(privKeyHex, 'hex');
    
    // DER encoding for secp256k1 private key (PKCS#8 format)
    // SEQUENCE {
    //   INTEGER 0,
    //   SEQUENCE { OID, OID },
    //   OCTET STRING { 
    //     SEQUENCE {
    //       INTEGER 1,
    //       OCTET STRING privateKey
    //     }
    //   }
    // }
    
    const privateKeyInner = Buffer.concat([
      Buffer.from([0x30, 0x22]), // SEQUENCE 34 bytes
      Buffer.from([0x02, 0x01, 0x01]), // INTEGER 1
      Buffer.from([0x04, 0x20]), // OCTET STRING 32 bytes
      privKeyBytes
    ]);
    
    const privateKeyOuter = Buffer.concat([
      Buffer.from([0x04, 0x24]), // OCTET STRING 36 bytes
      privateKeyInner
    ]);
    
    const algorithm = Buffer.from([
      0x30, 0x10, // SEQUENCE 16 bytes
      0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID for ecPublicKey
      0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x0a // OID for secp256k1
    ]);
    
    const totalLength = 1 + 1 + algorithm.length + privateKeyOuter.length + 1; // version + algorithm + privateKey
    
    const sequence = Buffer.concat([
      Buffer.from([0x30, totalLength + 1]), // SEQUENCE
      Buffer.from([0x02, 0x01, 0x00]), // INTEGER 0 (version)
      algorithm,
      privateKeyOuter
    ]);
    
    return sequence;
  }
}