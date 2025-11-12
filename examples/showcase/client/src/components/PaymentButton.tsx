/**
 * PaymentButton Component
 *
 * A standardized payment button with support for different states (idle, success).
 * Provides consistent styling and interaction patterns across payment scenarios.
 */

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
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`btn-pay ${className}`}
      style={{
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? "not-allowed" : "pointer",
      }}
    >
      {isCompleted ? completedLabel : idleLabel}
    </button>
  );
}
