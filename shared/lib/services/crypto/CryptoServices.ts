import { CryptoService } from './ICryptoService';
import { AES256GCMEncryptionService } from './encryption/AES256GCMEncryptionService';
import { StreamCipherEncryptionService } from './encryption/StreamCipherEncryptionService';
import { X25519XSalsa20Poly1305SealingService } from "./sealing/X25519XSalsa20Poly1305SealingService";

/**
 * 通用加密服务组合
 * 集成AES-256-GCM加密和ECIES密钥封装，提供标准的加密功能
 */
export class GeneralCryptoService extends CryptoService {
  protected encryptionService = new AES256GCMEncryptionService();
  protected sealingService = new X25519XSalsa20Poly1305SealingService();
}

/**
 * ZK友好的加密服务组合
 * 集成XOR加密和X25519-XSalsa20-Poly1305密钥封装（Metamask 兼容）
 */
export class ZKCryptoService extends CryptoService {
  protected encryptionService = new StreamCipherEncryptionService();
  protected sealingService = new X25519XSalsa20Poly1305SealingService();
}
