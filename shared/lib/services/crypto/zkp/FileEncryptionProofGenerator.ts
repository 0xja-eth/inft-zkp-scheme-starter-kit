import * as snarkjs from "snarkjs";
import * as fs from "fs";
import * as path from "path";
import {StreamCipherEncryptionService} from "../encryption/StreamCipherEncryptionService";

/**
 * File encryption ZK proof generator using StreamEncVerify circuit
 * Generates proofs for file encryption verification
 */
export class FileEncryptionProofGenerator {
  private readonly circuitWasmPath: string;
  private readonly circuitZkeyPath: string;

  private encryptionService = new StreamCipherEncryptionService();

  constructor(buildDir: string = "/Users/jarei/Desktop/Paratrix/AI/0g-study/0g-inft-starter-kit/build") {
    this.circuitWasmPath = path.join(buildDir, "StreamEncVerify.wasm");
    this.circuitZkeyPath = path.join(buildDir, "stream_enc_verify_final.zkey");
  }

  /**
   * Generate ZK proof for file encryption
   */
  async generateProof(data: string, key: Buffer, encryptedData?: Buffer): Promise<{
    proof: any;
    publicSignals: string[];
  }> {
    // Generate circuit inputs
    const inputs = await this.encryptionService.generateCircuitInputs(data, key, encryptedData);
    
    // Check if circuit files exist
    if (!fs.existsSync(this.circuitWasmPath)) {
      throw new Error(`Circuit WASM file not found: ${this.circuitWasmPath}. Please compile the circuit first.`);
    }
    
    if (!fs.existsSync(this.circuitZkeyPath)) {
      throw new Error(`Circuit zkey file not found: ${this.circuitZkeyPath}. Please run trusted setup first.`);
    }

    console.log("Generating proof with inputs:", {
      nonce: inputs.nonce,
      mac: inputs.mac,
      cipherLength: inputs.cipher.length,
      keyLength: inputs.key.length,
      msgLength: inputs.msg.length
    });

    // Generate proof using snarkjs
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      this.circuitWasmPath,
      this.circuitZkeyPath
    );

    return { proof, publicSignals };
  }

  /**
   * Verify ZK proof
   */
  async verifyProof(proof: any, publicSignals: string[]): Promise<boolean> {
    const vkeyPath = path.join(path.dirname(this.circuitZkeyPath), "verification_key.json");
    
    if (!fs.existsSync(vkeyPath)) {
      throw new Error(`Verification key not found: ${vkeyPath}. Please export verification key first.`);
    }

    const vKey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));
    
    return await snarkjs.groth16.verify(vKey, publicSignals, proof);
  }

  /**
   * Export verification key from zkey file
   */
  async exportVerificationKey(): Promise<void> {
    const vkeyPath = path.join(path.dirname(this.circuitZkeyPath), "verification_key.json");
    
    const vKey = await snarkjs.zKey.exportVerificationKey(this.circuitZkeyPath);
    fs.writeFileSync(vkeyPath, JSON.stringify(vKey, null, 2));
    
    console.log(`Verification key exported to: ${vkeyPath}`);
  }

  /**
   * Get build instructions for circuit compilation and setup
   */
  static getBuildInstructions(): string[] {
    return [
      "# 1. Compile circuit",
      "circom circuits/StreamEncVerify.circom --r1cs --wasm --sym -o build",
      "",
      "# 2. Start Powers of Tau ceremony", 
      "snarkjs powersoftau new bn128 12 build/pot12_0000.ptau -v",
      "",
      "# 3. Contribute to ceremony",
      "snarkjs powersoftau contribute build/pot12_0000.ptau build/pot12_0001.ptau --name=\"First contribution\" -v",
      "",
      "# 4. Prepare phase 2",
      "snarkjs powersoftau prepare phase2 build/pot12_0001.ptau build/pot12_final.ptau -v",
      "",
      "# 5. Generate zkey",
      "snarkjs groth16 setup build/StreamEncVerify.r1cs build/pot12_final.ptau build/stream_enc_verify_0000.zkey",
      "",
      "# 6. Contribute to phase 2",
      "snarkjs zkey contribute build/stream_enc_verify_0000.zkey build/stream_enc_verify_final.zkey --name=\"First contribution\" -v",
      "",
      "# 7. Export verification key",
      "snarkjs zkey export verificationkey build/stream_enc_verify_final.zkey build/verification_key.json"
    ];
  }

  /**
   * Check if circuit is ready for proof generation
   */
  isCircuitReady(): { ready: boolean; missing: string[] } {
    const missing: string[] = [];
    
    if (!fs.existsSync(this.circuitWasmPath)) {
      missing.push("WASM file");
    }
    
    if (!fs.existsSync(this.circuitZkeyPath)) {
      missing.push("zkey file");
    }
    
    const vkeyPath = path.join(path.dirname(this.circuitZkeyPath), "verification_key.json");
    if (!fs.existsSync(vkeyPath)) {
      missing.push("verification key");
    }
    
    return {
      ready: missing.length === 0,
      missing
    };
  }
}