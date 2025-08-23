import { ISealingService } from "../ICryptoService";
import { XORZKEncryptionService } from "../encryption/XORZKEncryptionService";
import crypto from "crypto";

/**
 * ZK友好的对称密钥封装服务
 * 使用共享密钥进行对称加密，适合ZK电路验证
 * 
 * ZK电路实现说明:
 * 1. 对称密钥封装：sealedKey[i] = dataKey[i] XOR wrappingKey[i]
 * 2. 在circom中实现为：sealedKey[i] <== dataKey[i] + wrappingKey[i] - 2 * dataKey[i] * wrappingKey[i]
 * 3. 约束数量：O(k) 其中k为密钥长度，每字节1个约束
 * 4. 支持多种封装方案：对称、哈希派生、承诺方案
 * 5. 电路模板：KeySeal(k) 接收dataKey[k]和wrappingKey[k]输入，输出sealedKey[k]
 * 6. 哈希派生方案：使用Poseidon哈希从秘密+接收者ID派生wrappingKey
 * 7. 承诺方案：使用Pedersen承诺验证密钥知识和开放值
 * 
 * Circom验证电路:
 * ```circom
 * pragma circom 2.0.0;
 * include "circomlib/circuits/poseidon.circom";
 * include "circomlib/circuits/pedersen.circom";
 * 
 * // 基础对称密钥封装验证电路
 * template KeySealVerify(keySize) {
 *     signal input dataKey[keySize];
 *     signal input wrappingKey[keySize];
 *     signal input expectedSealedKey[keySize];
 *     signal output isValid;
 * 
 *     signal computedSealedKey[keySize];
 * 
 *     // 计算封装密钥: sealedKey[i] = dataKey[i] XOR wrappingKey[i]
 *     for (var i = 0; i < keySize; i++) {
 *         computedSealedKey[i] <== dataKey[i] + wrappingKey[i] - 2 * dataKey[i] * wrappingKey[i];
 *     }
 * 
 *     // 验证结果匹配
 *     component eq[keySize];
 *     signal validBits[keySize];
 *     for (var i = 0; i < keySize; i++) {
 *         eq[i] = IsEqual();
 *         eq[i].in[0] <== computedSealedKey[i];
 *         eq[i].in[1] <== expectedSealedKey[i];
 *         validBits[i] <== eq[i].out;
 *     }
 * 
 *     component and = MultiAND(keySize);
 *     and.in <== validBits;
 *     isValid <== and.out;
 * }
 * 
 * // 哈希派生密钥封装验证电路
 * template HashDerivedKeySeal(keySize) {
 *     signal input dataKey[keySize];
 *     signal input secret[16];  // 最多16字节秘密
 *     signal input recipientId; // 接收者ID作为单个字段元素
 *     signal input expectedSealedKey[keySize];
 *     signal output isValid;
 * 
 *     // 使用Poseidon哈希派生wrapping key
 *     component hasher = Poseidon(17); // 16个秘密字节 + 1个接收者ID
 *     for (var i = 0; i < 16; i++) {
 *         hasher.inputs[i] <== secret[i];
 *     }
 *     hasher.inputs[16] <== recipientId;
 * 
 *     // 将哈希输出扩展为keySize长度的wrapping key
 *     signal wrappingKey[keySize];
 *     for (var i = 0; i < keySize; i++) {
 *         wrappingKey[i] <== hasher.out; // 简化版本，实际应该做更复杂的扩展
 *     }
 * 
 *     // 验证封装
 *     component keySeal = KeySealVerify(keySize);
 *     keySeal.dataKey <== dataKey;
 *     keySeal.wrappingKey <== wrappingKey;
 *     keySeal.expectedSealedKey <== expectedSealedKey;
 *     isValid <== keySeal.isValid;
 * }
 * 
 * // 承诺方案密钥封装验证电路
 * template CommitmentKeySeal() {
 *     signal input dataKey;
 *     signal input blinding;
 *     signal input commitment;
 *     signal input recipientCommitment;
 *     signal input expectedSealedKey;
 *     signal output isValid;
 * 
 *     // 验证承诺正确性: commitment = Poseidon(dataKey, blinding)
 *     component commitHasher = Poseidon(2);
 *     commitHasher.inputs[0] <== dataKey;
 *     commitHasher.inputs[1] <== blinding;
 *     
 *     component commitEq = IsEqual();
 *     commitEq.in[0] <== commitHasher.out;
 *     commitEq.in[1] <== commitment;
 *     signal commitValid <== commitEq.out;
 * 
 *     // 从两个承诺派生共享密钥
 *     component sharedKeyHasher = Poseidon(2);
 *     sharedKeyHasher.inputs[0] <== commitment;
 *     sharedKeyHasher.inputs[1] <== recipientCommitment;
 *     signal sharedKey <== sharedKeyHasher.out;
 * 
 *     // 验证密钥封装: sealedKey = dataKey XOR sharedKey
 *     signal computedSealedKey <== dataKey + sharedKey - 2 * dataKey * sharedKey;
 *     
 *     component sealEq = IsEqual();
 *     sealEq.in[0] <== computedSealedKey;
 *     sealEq.in[1] <== expectedSealedKey;
 *     signal sealValid <== sealEq.out;
 * 
 *     // 两个条件都必须满足
 *     component finalAnd = AND();
 *     finalAnd.a <== commitValid;
 *     finalAnd.b <== sealValid;
 *     isValid <== finalAnd.out;
 * }
 * ```
 */
export class ZKSymmetricSealingService implements ISealingService {

  private xorService = new XORZKEncryptionService();

  async sealKey(encryptionKey: Buffer, publicKey: string): Promise<string> {
    try {
      const wrappingKey = this.deriveWrappingKey(publicKey);
      const encryptedKey = await this.xorService.encrypt(
        encryptionKey.toString('hex'),
        wrappingKey
      );

      const sealedData = {
        version: 'zk-symmetric-v1',
        algorithm: 'xor',
        encryptedKey: encryptedKey.toString('base64'),
        keyHash: crypto.createHash('sha256').update(encryptionKey).digest('hex'),
        metadata: {
          isZKFriendly: true,
          canGenerateProof: true
        }
      };

      return Buffer.from(JSON.stringify(sealedData)).toString('base64');
    } catch (error: any) {
      throw new Error(`ZK symmetric key sealing failed: ${error.message}`);
    }
  }

  async unsealKey(sealedKey: string, privateKey: string): Promise<Buffer> {
    try {
      const sealedData = JSON.parse(Buffer.from(sealedKey, 'base64').toString());

      if (sealedData.version !== 'zk-symmetric-v1') {
        throw new Error(`Unsupported version: ${sealedData.version}`);
      }

      const wrappingKey = this.deriveWrappingKey(privateKey);
      const encryptedKeyBuffer = Buffer.from(sealedData.encryptedKey, 'base64');
      const decryptedHex = await this.xorService.decrypt(encryptedKeyBuffer, wrappingKey);
      const unsealedKey = Buffer.from(decryptedHex, 'hex');

      const computedHash = crypto.createHash('sha256').update(unsealedKey).digest('hex');
      if (computedHash !== sealedData.keyHash) {
        throw new Error('Key hash verification failed - data may be corrupted');
      }

      return unsealedKey;
    } catch (error: any) {
      throw new Error(`ZK symmetric key unsealing failed: ${error.message}`);
    }
  }

  private deriveWrappingKey(input: string): Buffer {
    return crypto.createHash('sha256').update(input).digest();
  }
}