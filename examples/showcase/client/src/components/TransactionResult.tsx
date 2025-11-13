/**
 * TransactionResult Component
 *
 * Displays transaction details including hash, network info, and explorer link.
 * Used after successful payment transactions.
 */

import { type Network, NETWORKS } from "../config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DetailItem {
  label: string;
  value: string | JSX.Element;
}

interface TransactionResultProps {
  txHash: string;
  network: Network;
  details?: DetailItem[];
  onNewTransaction?: () => void;
  newTransactionLabel?: string;
}

export function TransactionResult({
  txHash,
  network,
  details = [],
  onNewTransaction,
  newTransactionLabel = "Make Another Payment",
}: TransactionResultProps) {
  const networkConfig = NETWORKS[network];

  return (
    <Card className="mt-5 border-green-200 bg-green-50 shadow-brand-lg">
      <CardHeader>
        <CardTitle className="text-green-800 flex items-center gap-2">
          ✅ Transaction Successful!
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Transaction Hash */}
        <div>
          <div className="text-sm font-bold text-green-800 mb-2">
            Transaction Hash:
          </div>
          <code className="block bg-white p-3 rounded text-xs font-mono break-all border">
            {txHash}
          </code>
        </div>

        {/* Details */}
        {details.length > 0 && (
          <div className="text-sm leading-relaxed">
            <div className="font-bold text-green-800 mb-2">
              📊 Transaction Details:
            </div>
            <ul className="mt-2 ml-5 space-y-1">
              {details.map((item, index) => (
                <li key={index}>
                  {item.label}: {item.value}
                </li>
              ))}
              <li>
                Network: <strong>{networkConfig.name}</strong>
              </li>
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button asChild className="bg-green-600 hover:bg-green-700">
            <a
              href={`${networkConfig.explorerUrl}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              🔍 View on Explorer →
            </a>
          </Button>

          {onNewTransaction && (
            <Button
              onClick={onNewTransaction}
              variant="outline"
              size="default"
            >
              {newTransactionLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
