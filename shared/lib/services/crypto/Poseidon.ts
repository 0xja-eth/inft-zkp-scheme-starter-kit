import { buildPoseidon, Poseidon } from 'circomlibjs';

let poseidon: Poseidon | null = null;

export async function initPoseidon(): Promise<void> {
  poseidon ||= await buildPoseidon();
}

export async function poseidonAsync(inputs: bigint[]): Promise<bigint> {
  await initPoseidon();

  const hash = poseidon!(inputs);
  return poseidon!.F.toObject(hash);
}

export function poseidonSync(inputs: bigint[]): bigint {
  if (!poseidon) throw new Error('Poseidon is not initialized');

  const hash = poseidon!(inputs);
  const hashStr = poseidon!.F.toString(hash);
  return BigInt(hashStr);
}

export function bigint2Buffer(b: bigint, length?: number): Buffer {
  let hex = b.toString(16);
  if (hex.length % 2) hex = '0' + hex; // 确保偶数位

  let buf = Buffer.from(hex, 'hex');

  if (length !== undefined) {
    if (buf.length > length) {
      throw new Error(`BigInt too large to fit in ${length} bytes`);
    }
    // 前导 0 补齐
    if (buf.length < length) {
      const padding = Buffer.alloc(length - buf.length, 0);
      buf = Buffer.concat([padding, buf]);
    }
  }

  return buf;
}

export function buffer2Bigint(b: Buffer): bigint {
  return BigInt('0x' + b.toString('hex'));
}
