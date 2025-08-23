import { IEncryptionService } from "../ICryptoService";
import crypto from "crypto";

/**
 * Feistel网络加密服务 - ZK友好的块加密实现
 * 
 * ZK电路实现说明:
 * 1. Feistel结构: 数据分为L和R两部分，进行4轮变换
 * 2. 每轮操作: newL = R, newR = L XOR F(R, K_i)
 * 3. F函数在电路中简化为: F(R, K) = (R + K) * K mod p
 * 4. 约束数量: O(rounds * block_size) ≈ 4 * n/2 = 2n约束
 * 5. 电路模板: FeistelEncrypt(rounds) 接受L, R和roundKeys[rounds]输入
 * 
 * Circom验证电路:
 * ```circom
 * pragma circom 2.0.0;
 * include "circomlib/circuits/poseidon.circom";
 * 
 * template FeistelRound() {
 *     signal input L;
 *     signal input R;
 *     signal input roundKey;
 *     signal output newL;
 *     signal output newR;
 * 
 *     // F函数: F(R, K) = (R + K) * K mod p
 *     signal fInput;
 *     signal fOutput;
 *     fInput <== R + roundKey;
 *     fOutput <== fInput * roundKey;
 * 
 *     // Feistel轮函数: newL = R, newR = L XOR F(R, K)
 *     newL <== R;
 *     newR <== L + fOutput - 2 * L * fOutput; // XOR in field arithmetic
 * }
 * 
 * template FeistelEncryptVerify(rounds, blockSize) {
 *     signal input plaintext[blockSize];
 *     signal input roundKeys[rounds];
 *     signal input expectedCiphertext[blockSize];
 *     signal output isValid;
 * 
 *     // 将明文分为L和R两部分
 *     signal L[rounds + 1][blockSize/2];
 *     signal R[rounds + 1][blockSize/2];
 * 
 *     // 初始化L和R
 *     for (var i = 0; i < blockSize/2; i++) {
 *         L[0][i] <== plaintext[i];
 *         R[0][i] <== plaintext[i + blockSize/2];
 *     }
 * 
 *     // Feistel轮变换
 *     component rounds_comp[rounds][blockSize/2];
 *     for (var round = 0; round < rounds; round++) {
 *         for (var i = 0; i < blockSize/2; i++) {
 *             rounds_comp[round][i] = FeistelRound();
 *             rounds_comp[round][i].L <== L[round][i];
 *             rounds_comp[round][i].R <== R[round][i];
 *             rounds_comp[round][i].roundKey <== roundKeys[round];
 *             L[round + 1][i] <== rounds_comp[round][i].newL;
 *             R[round + 1][i] <== rounds_comp[round][i].newR;
 *         }
 *     }
 * 
 *     // 构造最终密文
 *     signal computedCiphertext[blockSize];
 *     for (var i = 0; i < blockSize/2; i++) {
 *         computedCiphertext[i] <== L[rounds][i];
 *         computedCiphertext[i + blockSize/2] <== R[rounds][i];
 *     }
 * 
 *     // 验证密文匹配
 *     component eq[blockSize];
 *     signal validBits[blockSize];
 *     for (var i = 0; i < blockSize; i++) {
 *         eq[i] = IsEqual();
 *         eq[i].in[0] <== computedCiphertext[i];
 *         eq[i].in[1] <== expectedCiphertext[i];
 *         validBits[i] <== eq[i].out;
 *     }
 * 
 *     component and = MultiAND(blockSize);
 *     and.in <== validBits;
 *     isValid <== and.out;
 * }
 * ```
 */
export class FeistelZKEncryptionService implements IEncryptionService {

  private readonly rounds = 4;

  generateKey(): Buffer {
    return crypto.randomBytes(32);
  }

  async encrypt(data: string, key: Buffer): Promise<Buffer> {
    const plaintext = Buffer.from(data, 'utf8');
    const nonce = crypto.randomBytes(16);
    const paddedData = this.padData(plaintext);
    const roundKeys = this.generateRoundKeys(key, nonce);
    const encrypted = this.feistelEncrypt(paddedData, roundKeys);

    const metadata = { originalLength: plaintext.length };
    const metadataBuffer = Buffer.from(JSON.stringify(metadata), 'utf8');

    return Buffer.concat([
      nonce,
      encrypted,
      metadataBuffer,
      Buffer.from([
        (metadataBuffer.length >> 24) & 0xFF,
        (metadataBuffer.length >> 16) & 0xFF,
        (metadataBuffer.length >> 8) & 0xFF,
        metadataBuffer.length & 0xFF
      ])
    ]);
  }

  async decrypt(encryptedData: Buffer, key: Buffer): Promise<string> {
    const metadataLenStart = encryptedData.length - 4;
    const metadataLen = (encryptedData[metadataLenStart] << 24) |
                       (encryptedData[metadataLenStart + 1] << 16) |
                       (encryptedData[metadataLenStart + 2] << 8) |
                       encryptedData[metadataLenStart + 3];

    const nonce = encryptedData.subarray(0, 16);
    const metadataStart = metadataLenStart - metadataLen;
    const encrypted = encryptedData.subarray(16, metadataStart);
    const metadataBuffer = encryptedData.subarray(metadataStart, metadataLenStart);

    const metadata = JSON.parse(metadataBuffer.toString('utf8'));
    const roundKeys = this.generateRoundKeys(key, nonce);
    const decrypted = this.feistelDecrypt(encrypted, roundKeys);

    return decrypted.subarray(0, metadata.originalLength).toString('utf8');
  }

  private feistelEncrypt(data: Buffer, roundKeys: Buffer[]): Buffer {
    const blockSize = Math.ceil(data.length / 2);
    let L = data.subarray(0, blockSize);
    let R = data.subarray(blockSize);

    if (R.length < blockSize) {
      const padded = Buffer.alloc(blockSize);
      R.copy(padded);
      R = padded;
    }

    for (let round = 0; round < this.rounds; round++) {
      const fOutput = this.feistelF(R, roundKeys[round]);
      const newL = Buffer.from(R);
      const newR = Buffer.alloc(L.length);
      
      for (let i = 0; i < L.length; i++) {
        newR[i] = L[i] ^ fOutput[i % fOutput.length];
      }
      
      L = newL;
      R = newR;
    }

    return Buffer.concat([L, R]);
  }

  private feistelDecrypt(data: Buffer, roundKeys: Buffer[]): Buffer {
    const blockSize = data.length / 2;
    let L = data.subarray(0, blockSize);
    let R = data.subarray(blockSize);

    for (let round = this.rounds - 1; round >= 0; round--) {
      const fOutput = this.feistelF(L, roundKeys[round]);
      const newR = Buffer.from(L);
      const newL = Buffer.alloc(R.length);
      
      for (let i = 0; i < R.length; i++) {
        newL[i] = R[i] ^ fOutput[i % fOutput.length];
      }
      
      L = newL;
      R = newR;
    }

    return Buffer.concat([L, R]);
  }

  private feistelF(data: Buffer, key: Buffer): Buffer {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest();
  }

  private generateRoundKeys(key: Buffer, nonce: Buffer): Buffer[] {
    const roundKeys: Buffer[] = [];
    
    for (let i = 0; i < this.rounds; i++) {
      const roundInfo = Buffer.from([i]);
      const hmac = crypto.createHmac('sha256', key);
      hmac.update(nonce);
      hmac.update(roundInfo);
      roundKeys.push(hmac.digest());
    }
    
    return roundKeys;
  }

  private padData(data: Buffer): Buffer {
    if (data.length % 2 === 0) {
      return data;
    }
    
    const padded = Buffer.alloc(data.length + 1);
    data.copy(padded);
    return padded;
  }
}