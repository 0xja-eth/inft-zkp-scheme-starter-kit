import { Metadata } from '@/lib/shared';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface MintRequest {
  metadata: Metadata;
  recipientAddress?: string;
}

export interface MintResponse {
  tokenId: number;
  txHash: string;
  rootHash: string;
  sealedKey: string;
}

export interface TransferRequest {
  tokenId: number;
  recipientAddress: string;
  recipientEncPublicKey: string;
  signature: string;
}

export interface TransferResponse {
  txHash: string;
}

export interface CloneRequest {
  tokenId: number;
  recipientAddress: string;
  modifications?: Partial<Metadata>;
}

export interface CloneResponse {
  newTokenId: number;
  txHash: string;
}

export interface UpdateRequest {
  tokenId: number;
  updatedMetadata: Partial<Metadata>;
}

export interface UpdateResponse {
  txHash: string;
}

export interface TokenInfo {
  tokenId: number;
  owner: string;
  dataHashes: string[];
  sealedKeys: string[];
  dataDescriptions: string[];
  authorizedUsers: string[];
}

export interface ContractInfo {
  name: string;
  symbol: string;
  version: string;
  verifier: string;
  address: string;
}

export interface WalletInfo {
  address: string;
  balance: string;
  ownedTokens: number[];
}