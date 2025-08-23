export interface IEncryptionService {
  generateKey(): Buffer;
  encrypt(data: string, key: Buffer): Promise<Buffer>;
  decrypt(encryptedData: Buffer, key: Buffer): Promise<string>;
}

export interface ISealingService {
  sealKey(encryptionKey: Buffer, publicKey: string): Promise<string>;
  unsealKey(sealedKey: string, privateKey: string): Promise<Buffer>;
}

export abstract class CryptoService implements IEncryptionService, ISealingService {

  protected encryptionService: IEncryptionService | undefined
  protected sealingService: ISealingService | undefined

  generateKey(): Buffer {
    return this.encryptionService!.generateKey()
  }

  encrypt(data: string, key: Buffer): Promise<Buffer> {
    return this.encryptionService!.encrypt(data, key)
  }
  decrypt(encryptedData: Buffer, key: Buffer): Promise<string> {
    return this.encryptionService!.decrypt(encryptedData, key)
  }
  sealKey(encryptionKey: Buffer, publicKey: string): Promise<string> {
    return this.sealingService!.sealKey(encryptionKey, publicKey);
  }
  unsealKey(sealedKey: string, privateKey: string): Promise<Buffer> {
    return this.sealingService!.unsealKey(sealedKey, privateKey);
  }
}