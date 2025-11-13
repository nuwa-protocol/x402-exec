/**
 * PaymentButton Component
 *
 * A standardized payment button with support for different states (idle, success).
 * Provides consistent styling and interaction patterns across payment scenarios.
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaymentButtonProps {
  onClick: () => void;
  isCompleted?: boolean;
  idleLabel?: string;
  completedLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function PaymentButton({
  onClick,
  isCompleted = false,
  idleLabel = "💳 Pay Now",
  completedLabel = "✅ Payment Complete",
  disabled = false,
  className = "",
}: PaymentButtonProps) {
  const isDisabled = disabled || isCompleted;

  return (
    <Button
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        "w-full border-0",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className
      )}
      style={{
        background: isDisabled ? undefined : 'rgb(34, 197, 94)',
        borderRadius: '12px',
        padding: '16px 32px',
        fontSize: '18px',
        fontWeight: '700',
        color: 'white',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      {isCompleted ? completedLabel : idleLabel}
    </Button>
  );
}
