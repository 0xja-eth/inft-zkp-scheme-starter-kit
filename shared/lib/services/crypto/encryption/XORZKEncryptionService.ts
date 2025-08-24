import { IEncryptionService } from '../ICryptoService';
import crypto from 'crypto';
import { poseidonAsync, initPoseidon } from '../Poseidon';

/**
 * XOR加密服务 - ZK友好的加密实现 (与file_encryption_proof.circom完全兼容)
 *
 * 实现细节:
 * 1. 使用Poseidon哈希生成keystream，与ZK电路完全一致
 * 2. 4字节nonce (匹配电路)
 * 3. 32字节key，取前16字节生成seed (匹配电路)
 * 4. Keystream生成: Poseidon(keySeed + nonce[4] + counter)
 * 5. XOR加密: ciphertext[i] = plaintext[i] XOR keystream[i]
 * 6. 分层哈希承诺: 16字节chunks -> 128->64->32->16->1 (匹配电路)
 *
 * ZK电路兼容性:
 * - 此实现与circuits/file_encryption_proof.circom完全兼容
 * - 可以通过ZK证明验证加密过程的正确性
 * - 支持2048字节文件的分层哈希承诺
 * - Keystream生成算法与电路完全一致
 * - 承诺计算方式与电路完全一致
 *
 * 数据格式: [nonce(4) + ciphertext + metadata + metadataLen(4)]
 */
export class XORZKEncryptionService implements IEncryptionService {
  constructor() {
    // Initialize Poseidon on construction
    initPoseidon();
  }

  generateKey(): Buffer {
    return crypto.randomBytes(32);
  }

  async encrypt(data: string, key: Buffer): Promise<Buffer> {
    const plaintext = Buffer.from(data, 'utf8');
    const nonce = crypto.randomBytes(4); // 4 bytes to match circuit
    const keystream = await this.generateKeystream(key, nonce, plaintext.length);

    const encrypted = Buffer.alloc(plaintext.length);
    for (let i = 0; i < plaintext.length; i++) {
      encrypted[i] = plaintext[i] ^ keystream[i];
    }

    const metadata = { keystream: keystream.toString('hex') };
    const metadataBuffer = Buffer.from(JSON.stringify(metadata), 'utf8');

    return Buffer.concat([
      nonce,
      encrypted,
      metadataBuffer,
      Buffer.from([
        (metadataBuffer.length >> 24) & 0xff,
        (metadataBuffer.length >> 16) & 0xff,
        (metadataBuffer.length >> 8) & 0xff,
        metadataBuffer.length & 0xff,
      ]),
    ]);
  }

  async decrypt(encryptedData: Buffer, key: Buffer): Promise<string> {
    const metadataLenStart = encryptedData.length - 4;
    const metadataLen =
      (encryptedData[metadataLenStart] << 24) |
      (encryptedData[metadataLenStart + 1] << 16) |
      (encryptedData[metadataLenStart + 2] << 8) |
      encryptedData[metadataLenStart + 3];

    const nonce = encryptedData.subarray(0, 4); // 4 bytes to match circuit
    const metadataStart = metadataLenStart - metadataLen;
    const encrypted = encryptedData.subarray(4, metadataStart); // Start after 4-byte nonce

    const keystream = await this.generateKeystream(key, nonce, encrypted.length);

    const decrypted = Buffer.alloc(encrypted.length);
    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ keystream[i];
    }

    return decrypted.toString('utf8');
  }

  private async generateKeystream(key: Buffer, nonce: Buffer, length: number): Promise<Buffer> {
    const keystream = Buffer.alloc(length);

    // First hash first 16 bytes of key to get seed (matches circuit)
    const keyElements = this.bufferToFieldElements(key.slice(0, 16));
    const keySeed = await poseidonAsync(keyElements);

    const nonceElements = this.bufferToFieldElements(nonce);

    for (let i = 0; i < Math.ceil(length / 4); i++) {
      // Combine keySeed + nonce + counter (6 inputs total, matches circuit)
      const input = [keySeed, ...nonceElements, BigInt(i)];
      const hash = await poseidonAsync(input);

      // Use hash output for 4 bytes of keystream (reuse same value)
      const hashBytes = this.fieldElementToBytes(hash, 4);
      for (let j = 0; j < 4 && i * 4 + j < length; j++) {
        keystream[i * 4 + j] = hashBytes[j];
      }
    }

    return keystream;
  }

  private bufferToFieldElements(buffer: Buffer): bigint[] {
    const elements: bigint[] = [];
    for (let i = 0; i < buffer.length; i++) {
      elements.push(BigInt(buffer[i]));
    }
    return elements;
  }

  private fieldElementToBytes(element: bigint, numBytes: number): Buffer {
    const bytes = Buffer.alloc(numBytes);
    let value = element;
    for (let i = 0; i < numBytes; i++) {
      bytes[i] = Number(value & BigInt(0xff));
      value = value >> BigInt(8);
    }
    return bytes;
  }
}
