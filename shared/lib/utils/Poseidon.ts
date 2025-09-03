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
  return poseidon!.F.toObject(hash);
}
