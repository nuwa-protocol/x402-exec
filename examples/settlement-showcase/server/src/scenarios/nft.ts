/**
 * Scenario 2: Random NFT Mint
 * Generates payment requirements for NFT minting with sequential token IDs
 */

import { appConfig } from '../config.js';
import { encodeNFTMintData } from '../utils/hookData.js';
import { generateSalt } from '../utils/commitment.js';
import { ethers } from 'ethers';

// Simple in-memory counter for token IDs (in production, query contract)
let nextTokenId = 0;

/**
 * Gets the next available token ID from contract
 * @returns Next token ID to mint
 */
async function getNextTokenId(): Promise<number> {
  try {
    const provider = new ethers.JsonRpcProvider(appConfig.rpcUrl);
    const abi = ['function totalSupply() view returns (uint256)'];
    const contract = new ethers.Contract(appConfig.randomNFTAddress, abi, provider);
    const totalSupply = await contract.totalSupply();
    return Number(totalSupply);
  } catch (error) {
    console.error('Error fetching token ID from contract:', error);
    // Fallback to local counter
    return nextTokenId++;
  }
}

export interface NFTMintParams {
  recipient: string;
  merchantAddress?: string;
  resource?: string;
}

/**
 * Generates payment requirements for NFT minting
 * @param params Recipient address
 * @returns Payment requirements object
 */
export async function generateNFTPayment(params: NFTMintParams) {
  const { recipient, merchantAddress, resource } = params;
  
  if (!ethers.isAddress(recipient)) {
    throw new Error('Invalid recipient address');
  }
  
  // Use provided merchant address or fallback to resource server address
  const merchant = merchantAddress || appConfig.resourceServerAddress;
  
  if (!ethers.isAddress(merchant)) {
    throw new Error('Invalid merchant address');
  }
  
  // Get next token ID
  const tokenId = await getNextTokenId();
  
  // Check if max supply reached
  if (tokenId >= 1000) {
    throw new Error('Max NFT supply reached (1000)');
  }
  
  // Encode hook data
  const hookData = encodeNFTMintData({
    nftContract: appConfig.randomNFTAddress,
    tokenId,
    recipient,
    merchant,
  });
  
  // Generate unique salt for this settlement
  const salt = generateSalt();
  
  // Facilitator fee (0.01 USDC = 10000 in 6 decimals)
  const facilitatorFee = '10000';
  
  return {
    scheme: 'exact' as const,
    network: appConfig.network as any, // Cast to any to resolve type incompatibility
    maxAmountRequired: '100000', // 0.1 USDC
    asset: appConfig.usdcAddress,
    payTo: appConfig.settlementRouterAddress,
    resource: resource || '/api/scenario-2/payment', // Use provided resource or fallback
    description: `Random NFT #${tokenId}: Pay $0.1 and receive an NFT`,
    mimeType: 'application/json',
    maxTimeoutSeconds: 600, // 10 minutes validity window (total 20 min with validAfter offset)
    extra: {
      // Required for EIP-712 signature (USDC contract domain)
      name: 'USDC',
      version: '2',
      // Settlement-specific data
      settlementRouter: appConfig.settlementRouterAddress,
      salt,
      payTo: appConfig.resourceServerAddress, // Resource server's address as the final recipient
      facilitatorFee,
      hook: appConfig.nftMintHookAddress,
      hookData,
      nftTokenId: tokenId,
    },
  };
}

/**
 * Get scenario information
 */
export async function getScenarioInfo() {
  const currentSupply = await getNextTokenId();
  const remaining = 1000 - currentSupply;
  
  return {
    id: 2,
    name: 'Random NFT Mint',
    description: 'Mint a random NFT on payment',
    price: '$0.1 USDC',
    collection: {
      name: 'Random NFT',
      symbol: 'RNFT',
      maxSupply: 1000,
      currentSupply,
      remaining,
    },
  };
}

