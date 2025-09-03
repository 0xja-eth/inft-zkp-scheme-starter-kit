import crypto from 'crypto';
import { poseidonAsync, initPoseidon } from '../../../utils/Poseidon';
import {
  buffer2Bigint,
  bigint2Buffer,
  bufferToBigints,
  bigintsToBuffer,
} from '../../../utils/BufferConverter';
import { IEncryptionService } from '../ICryptoService';

/**
 * Stream cipher encryption service compatible with StreamEncVerify circuit
 * Uses Poseidon hash for keystream generation with state-based approach
 */
export class StreamCipherEncryptionService implements IEncryptionService {
  private static readonly BLOCK_BYTES = 16;
  private static readonly N = 128; // Fixed 128 blocks

  constructor() {
    initPoseidon();
  }

  generateKey(): Buffer {
    return crypto.randomBytes(32);
  }

  async encrypt(data: string, key: Buffer): Promise<Buffer> {
    await initPoseidon();

    const jsonBuf = Buffer.from(data, 'utf8');

    if (
      jsonBuf.length >
      StreamCipherEncryptionService.N * StreamCipherEncryptionService.BLOCK_BYTES
    ) {
      throw new Error(
        `Data too large for ${StreamCipherEncryptionService.N} blocks (max ${StreamCipherEncryptionService.N * StreamCipherEncryptionService.BLOCK_BYTES} bytes)`
      );
    }

    // Pad data to fixed size
    const padded = Buffer.alloc(
      StreamCipherEncryptionService.N * StreamCipherEncryptionService.BLOCK_BYTES
    );
    jsonBuf.copy(padded);

    // Convert to message blocks
    const msgBlocks = bufferToBigints(padded, StreamCipherEncryptionService.BLOCK_BYTES);

    // Generate nonce (4 bytes)
    const nonceBuf = crypto.randomBytes(4);
    const nonce = buffer2Bigint(nonceBuf);

    // Convert key to single field element
    const keyField = BigInt('0x' + key.toString('hex'));

    // 1. Generate state = Poseidon(key, nonce)
    const state = await poseidonAsync([keyField, nonce]);

    // 2. Generate keystream ks[i] = Poseidon(state, i) mod 2^128
    const ks: bigint[] = [];
    const mod128 = (1n << 128n) - 1n; // 2^128 - 1
    for (let i = 0; i < StreamCipherEncryptionService.N; i++) {
      const hashVal = await poseidonAsync([state, BigInt(i)]);
      ks.push(hashVal & mod128); // Constrain to 128 bits
    }

    // 3. Generate cipher
    const cipher: bigint[] = [];
    for (let i = 0; i < StreamCipherEncryptionService.N; i++) {
      cipher.push(msgBlocks[i] ^ ks[i]);
    }

    // 4. Generate MAC using chain
    const acc: bigint[] = [];
    acc[0] = await poseidonAsync([0n, cipher[0]]);
    for (let i = 1; i < StreamCipherEncryptionService.N; i++) {
      acc[i] = await poseidonAsync([acc[i - 1], cipher[i]]);
    }
    const digest = acc[StreamCipherEncryptionService.N - 1];
    const mac = await poseidonAsync([nonce, digest]);

    // Pack result: nonce(4) + mac(32) + cipher(N*16)
    const result = Buffer.alloc(
      4 + 32 + StreamCipherEncryptionService.N * StreamCipherEncryptionService.BLOCK_BYTES
    );
    let offset = 0;

    // Write nonce
    nonceBuf.copy(result, offset);
    offset += 4;

    const macBuf = bigint2Buffer(mac, 32);
    macBuf.copy(result, offset);
    offset += 32;

    // Write cipher
    const cipherBuf = bigintsToBuffer(cipher, StreamCipherEncryptionService.BLOCK_BYTES);
    cipherBuf.copy(result, offset);

    return result;
  }

  async decrypt(encryptedData: Buffer, key: Buffer): Promise<string> {
    const {
      nonce,
      cipher,
      mac: expectedMac,
    } = await StreamCipherEncryptionService.parseEncryptedData(encryptedData);

    // Convert key to single field element
    const keyField = BigInt('0x' + key.toString('hex'));

    // 1. Generate state = Poseidon(key, nonce)
    const state = await poseidonAsync([keyField, nonce]);

    // 2. Generate keystream ks[i] = Poseidon(state, i) mod 2^128
    const ks: bigint[] = [];
    const mod128 = (1n << 128n) - 1n; // 2^128 - 1
    for (let i = 0; i < StreamCipherEncryptionService.N; i++) {
      const hashVal = await poseidonAsync([state, BigInt(i)]);
      ks.push(hashVal & mod128); // Constrain to 128 bits
    }

    // 3. Verify MAC
    const acc: bigint[] = [];
    acc[0] = await poseidonAsync([0n, cipher[0]]);
    for (let i = 1; i < StreamCipherEncryptionService.N; i++) {
      acc[i] = await poseidonAsync([acc[i - 1], cipher[i]]);
    }
    const digest = acc[StreamCipherEncryptionService.N - 1];
    const computedMac = await poseidonAsync([nonce, digest]);

    if (computedMac !== expectedMac) {
      throw new Error('MAC verification failed - data may be corrupted');
    }

    // 4. Decrypt message
    const msgBlocks: bigint[] = [];
    for (let i = 0; i < StreamCipherEncryptionService.N; i++) {
      msgBlocks.push(cipher[i] ^ ks[i]);
    }

    // Convert back to buffer and extract original data
    const msgBuf = bigintsToBuffer(msgBlocks, StreamCipherEncryptionService.BLOCK_BYTES);

    // Find actual data length (remove padding)
    let actualLength = msgBuf.length;
    while (actualLength > 0 && msgBuf[actualLength - 1] === 0) {
      actualLength--;
    }

    return msgBuf.subarray(0, actualLength).toString('utf8');
  }

  public static async parseEncryptedData(encryptedData: Buffer): Promise<{
    nonce: bigint;
    mac: bigint;
    cipher: bigint[];
  }> {
    await initPoseidon();

    if (
      encryptedData.length !==
      4 + 32 + StreamCipherEncryptionService.N * StreamCipherEncryptionService.BLOCK_BYTES
    ) {
      throw new Error('Invalid encrypted data size');
    }

    let offset = 0;

    // Extract nonce
    const nonceBuf = encryptedData.subarray(offset, offset + 4);
    const nonce = buffer2Bigint(nonceBuf);

    offset += 4;

    // Extract MAC
    const macBuf = encryptedData.subarray(offset, offset + 32);
    const mac = buffer2Bigint(macBuf);

    offset += 32;

    // Extract cipher
    const cipherBuf = encryptedData.subarray(offset);
    const cipher = bufferToBigints(cipherBuf, StreamCipherEncryptionService.BLOCK_BYTES);

    return { nonce, mac, cipher };
  }

  /**
   * Generate circuit inputs for StreamEncVerify
   */
  public static async generateCircuitInputs(
    data: string,
    key: Buffer,
    encryptedData?: Buffer
  ): Promise<{
    nonce: string;
    mac: string;
    cipher: string[];
    // Private inputs
    key: string;
    msg: string[];
  }> {
    const jsonBuf = Buffer.from(data, 'utf8');

    if (
      jsonBuf.length >
      StreamCipherEncryptionService.N * StreamCipherEncryptionService.BLOCK_BYTES
    ) {
      throw new Error(`Data too large for ${StreamCipherEncryptionService.N} blocks`);
    }

    // Pad data
    const padded = Buffer.alloc(
      StreamCipherEncryptionService.N * StreamCipherEncryptionService.BLOCK_BYTES
    );
    jsonBuf.copy(padded);
    const msgBlocks = bufferToBigints(padded, StreamCipherEncryptionService.BLOCK_BYTES);

    const keyField = BigInt('0x' + key.toString('hex'));

    if (encryptedData) {
      const { nonce, cipher, mac } = await this.parseEncryptedData(encryptedData);

      return {
        nonce: nonce.toString(),
        mac: mac.toString(),
        cipher: cipher.map(c => c.toString()),
        key: keyField.toString(),
        msg: msgBlocks.map(m => m.toString()),
      };
    }

    // Generate nonce
    const nonceBuf = crypto.randomBytes(4);
    const nonce = buffer2Bigint(nonceBuf);

    // Generate state and keystream
    const state = await poseidonAsync([keyField, nonce]);
    const ks: bigint[] = [];
    const mod128 = (1n << 128n) - 1n; // 2^128 - 1
    for (let i = 0; i < StreamCipherEncryptionService.N; i++) {
      const hashVal = await poseidonAsync([state, BigInt(i)]);
      ks.push(hashVal & mod128); // Constrain to 128 bits
    }

    // Generate cipher
    const cipher: bigint[] = [];
    for (let i = 0; i < StreamCipherEncryptionService.N; i++) {
      cipher.push(msgBlocks[i] ^ ks[i]);
    }

    // Generate MAC
    const acc: bigint[] = [];
    acc[0] = await poseidonAsync([0n, cipher[0]]);
    for (let i = 1; i < StreamCipherEncryptionService.N; i++) {
      acc[i] = await poseidonAsync([acc[i - 1], cipher[i]]);
    }
    const digest = acc[StreamCipherEncryptionService.N - 1];
    const mac = await poseidonAsync([nonce, digest]);

    return {
      nonce: nonce.toString(),
      mac: mac.toString(),
      cipher: cipher.map(c => c.toString()),
      key: keyField.toString(),
      msg: msgBlocks.map(m => m.toString()),
    };
  }
}
