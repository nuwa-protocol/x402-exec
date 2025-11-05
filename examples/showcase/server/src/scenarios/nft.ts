/**
 * Scenario 2: Random NFT Mint
 * Generates payment requirements for NFT minting with sequential token IDs
 */

import { appConfig, getNetworkConfig, getUsdcDomainForNetwork } from '../config.js';
import { encodeNFTMintData } from '../utils/hookData.js';
import { generateSalt } from '../utils/commitment.js';
import { ethers } from 'ethers';

// Simple in-memory counter for token IDs (in production, query contract)
let nextTokenId = 0;

/**
 * Gets the next available token ID from contract
 * @param network Network to query
 * @returns Next token ID to mint
 */
async function getNextTokenId(network: string = appConfig.defaultNetwork): Promise<number> {
  try {
    const networkConfig = getNetworkConfig(network);
    const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    const abi = ['function totalSupply() view returns (uint256)'];
    const contract = new ethers.Contract(networkConfig.randomNFTAddress, abi, provider);
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
  network?: string;
}

/**
 * Generates payment requirements for NFT minting
 * @param params Recipient address
 * @returns Payment requirements object
 */
export async function generateNFTPayment(params: NFTMintParams) {
  const { recipient, merchantAddress, resource, network = appConfig.defaultNetwork } = params;
  const networkConfig = getNetworkConfig(network);
  
  if (!ethers.isAddress(recipient)) {
    throw new Error('Invalid recipient address');
  }
  
  // Use provided merchant address or fallback to resource server address
  const merchant = merchantAddress || appConfig.resourceServerAddress;
  
  if (!ethers.isAddress(merchant)) {
    throw new Error('Invalid merchant address');
  }
  
  // Get next token ID
  const tokenId = await getNextTokenId(network);
  
  // Check if max supply reached
  if (tokenId >= 1000) {
    throw new Error('Max NFT supply reached (1000)');
  }
  
  // Encode hook data (recipient removed - NFTMintHook now uses payer parameter directly)
  const hookData = encodeNFTMintData({
    nftContract: networkConfig.randomNFTAddress,
    tokenId,
    merchant,
  });
  
  // Generate unique salt for this settlement
  const salt = generateSalt();
  
  // Get correct USDC domain info for the network
  const usdcDomain = getUsdcDomainForNetwork(network);
  
  // Facilitator fee (0.01 USDC = 10000 in 6 decimals)
  const facilitatorFee = '10000';
  
  return {
    scheme: 'exact' as const,
    network: network as any, // Cast to any to resolve type incompatibility
    maxAmountRequired: '100000', // 0.1 USDC
    asset: networkConfig.usdcAddress,
    payTo: networkConfig.settlementRouterAddress,
    resource: resource || '/api/scenario-2/payment', // Use provided resource or fallback
    description: `Random NFT #${tokenId}: Pay $0.1 and receive an NFT on ${network}`,
    mimeType: 'application/json',
    maxTimeoutSeconds: 3600, // 1 hour validity window (total 70 min with validAfter offset)
    extra: {
      // Required for EIP-712 signature (USDC contract domain)
      name: usdcDomain.name,
      version: usdcDomain.version,
      // Settlement-specific data
      settlementRouter: networkConfig.settlementRouterAddress,
      salt,
      payTo: appConfig.resourceServerAddress, // Resource server's address as the final recipient
      facilitatorFee,
      hook: networkConfig.nftMintHookAddress,
      hookData,
      nftTokenId: tokenId,
    },
  };
}

/**
 * Get scenario information for all supported networks
 */
export async function getScenarioInfo() {
  const supportedNetworks = Object.keys(appConfig.networks);
  const networkInfo: Record<string, any> = {};
  
  // Get NFT collection info for each network
  for (const network of supportedNetworks) {
    try {
      const currentSupply = await getNextTokenId(network);
      const remaining = 1000 - currentSupply;
      
      networkInfo[network] = {
        collection: {
          name: 'Random NFT',
          symbol: 'RNFT',
          maxSupply: 1000,
          currentSupply,
          remaining,
        },
      };
    } catch (error) {
      console.warn(`Failed to get NFT info for network ${network}:`, error);
      // Fallback info for networks that might not have contracts deployed
      networkInfo[network] = {
        collection: {
          name: 'Random NFT',
          symbol: 'RNFT',
          maxSupply: 1000,
          currentSupply: 0,
          remaining: 1000,
        },
      };
    }
  }
  
  return {
    id: 2,
    name: 'Random NFT Mint',
    description: 'Mint a random NFT on payment',
    price: '$0.1 USDC',
    networks: networkInfo,
    // Keep legacy format for backward compatibility
    collection: networkInfo[appConfig.defaultNetwork]?.collection || {
      name: 'Random NFT',
      symbol: 'RNFT',
      maxSupply: 1000,
      currentSupply: 0,
      remaining: 1000,
    },
  };
}

