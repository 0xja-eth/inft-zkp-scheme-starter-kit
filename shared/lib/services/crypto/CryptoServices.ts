import {CryptoService} from "./ICryptoService";
import {ECIESSealingService} from "./sealing/ECIESSealingService";
import {AES256GCMEncryptionService} from "./encryption/AES256GCMEncryptionService";
import {X25519XSalsa20Poly1305SealingService} from "./sealing/X25519XSalsa20Poly1305SealingService";
import {FeistelZKEncryptionService} from "./encryption/FeistelZKEncryptionService";
import {ZKSymmetricSealingService} from "./sealing/ZKSymmetricSealingService";
import {StreamCipherEncryptionService} from "./encryption/StreamCipherEncryptionService";

/**
 * 通用加密服务组合
 * 集成AES-256-GCM加密和ECIES密钥封装，提供标准的加密功能
 * 
 * 技术特性:
 * 1. 加密算法: AES-256-GCM，提供认证加密
 * 2. 密钥封装: ECIES (椭圆曲线集成加密方案)
 * 3. 安全级别: 高强度，适合生产环境
 * 4. 性能特点: 硬件加速支持，快速加解密
 * 5. 兼容性: 广泛的库和工具支持
 * 6. 适用场景: 标准数据加密、文件保护、通信安全
 */
export class GeneralCryptoService extends CryptoService {

  protected encryptionService = new AES256GCMEncryptionService();
  protected sealingService = new ECIESSealingService();

}

/**
 * MetaMask兼容加密服务组合
 * 集成AES-256-GCM加密和X25519-XSalsa20-Poly1305密钥封装
 * 
 * 技术特性:
 * 1. 加密算法: AES-256-GCM，与Web标准兼容
 * 2. 密钥封装: X25519-XSalsa20-Poly1305，MetaMask标准方案
 * 3. 椭圆曲线: Curve25519，高效且安全
 * 4. 消息认证: Poly1305，防止篡改
 * 5. 浏览器兼容: 与MetaMask eth_encrypt/eth_decrypt完全兼容
 * 6. 适用场景: 区块链应用、钱包集成、跨平台加密
 */
export class MetamaskCryptoService extends CryptoService {

  protected encryptionService = new AES256GCMEncryptionService();
  protected sealingService = new X25519XSalsa20Poly1305SealingService();

}

/**
 * ZK友好的加密服务组合
 * 集成XOR加密和ZK对称密钥封装
 *
 * ZK电路组合说明:
 * 1. 加密部分使用XOR操作，约束数量O(n)
 * 2. 密钥封装使用对称加密，约束数量O(k)其中k为密钥长度
 * 3. 总约束数量约为数据长度+密钥长度，非常ZK友好
 * 4. 可生成加密正确性证明和密钥知识证明
 * 5. 电路模板支持：XOREncrypt(n) + KeySeal(k)
 */
export class ZKCryptoService extends CryptoService {

  protected encryptionService = new StreamCipherEncryptionService();
  protected sealingService = new ZKSymmetricSealingService();

}
