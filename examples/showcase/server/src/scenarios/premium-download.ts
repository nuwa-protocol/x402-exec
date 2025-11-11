/**
 * Scenario: Premium Content Download
 * 
 * Demonstrates Server Mode use case where:
 * - Resource exists off-chain (downloadable file)
 * - Server verifies payment before granting access
 * - Generates temporary download URL with expiration
 */

import type { Address } from 'viem';
import { TransferHook } from '@x402x/core';

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  fileName: string;
  fileSize: string;
  price: string; // USD format like "$1.00"
  mimeType: string;
}

export interface PurchaseRequest {
  walletAddress: Address;
  contentId: string;
  network: string;
}

export interface DownloadAccess {
  contentId: string;
  downloadUrl: string;
  expiresAt: string; // ISO timestamp
  fileName: string;
}

/**
 * Available premium content
 */
const CONTENT_CATALOG: Record<string, ContentItem> = {
  'x402-protocol-guide': {
    id: 'x402-protocol-guide',
    title: 'x402 Protocol Whitepaper',
    description: 'Official whitepaper of the x402 payment protocol',
    fileName: 'x402-whitepaper.pdf',
    fileSize: '2.5 MB',
    price: '$0.10',
    mimeType: 'application/pdf',
  },
};

/**
 * Get content catalog
 */
export function getContentCatalog(): ContentItem[] {
  return Object.values(CONTENT_CATALOG);
}

/**
 * Get specific content item
 */
export function getContentItem(contentId: string): ContentItem | null {
  return CONTENT_CATALOG[contentId] || null;
}

/**
 * Get scenario information
 */
export function getScenarioInfo() {
  return {
    name: 'Premium Content Download',
    description: 'Purchase and download premium digital content with payment verification',
    mode: 'server',
    features: [
      'Off-chain resource delivery',
      'Payment verification before access',
      'Temporary download URLs',
      'Access control and tracking',
    ],
    catalog: getContentCatalog(),
  };
}

/**
 * Generate temporary download URL
 * In production, this would:
 * - Generate signed URL with expiration
 * - Store access record in database
 * - Track download attempts
 */
export function generateDownloadUrl(
  contentId: string,
  walletAddress: Address,
  expirationHours: number = 24
): DownloadAccess {
  const content = getContentItem(contentId);
  if (!content) {
    throw new Error(`Content not found: ${contentId}`);
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expirationHours);

  // In production, generate a signed URL with:
  // - Unique token for this purchase
  // - Expiration timestamp
  // - HMAC signature to prevent tampering
  // For demo, use a simple URL with token
  const token = Buffer.from(`${walletAddress}-${contentId}-${Date.now()}`).toString('base64');
  
  return {
    contentId,
    downloadUrl: `/api/download/${contentId}?token=${token}`,
    expiresAt: expiresAt.toISOString(),
    fileName: content.fileName,
  };
}

/**
 * Verify download token
 * In production, this would verify:
 * - Token signature
 * - Expiration time
 * - Purchase record exists
 * - Download limit not exceeded
 */
export function verifyDownloadToken(contentId: string, token: string): boolean {
  try {
    // For demo, just check token format
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    return decoded.includes(contentId);
  } catch {
    return false;
  }
}

