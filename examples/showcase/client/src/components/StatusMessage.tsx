/**
 * StatusMessage Component
 *
 * A reusable component for displaying status messages (success, error, warning, info).
 * Provides consistent styling and layout for all status indicators across the app.
 */

import { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type MessageType = "success" | "error" | "warning" | "info";

interface StatusMessageProps {
  type: MessageType;
  title: string;
  children?: ReactNode;
  className?: string;
}

const getVariant = (type: MessageType) => {
  switch (type) {
    case "success":
      return "default" as const;
    case "error":
      return "destructive" as const;
    case "warning":
      return "default" as const;
    case "info":
      return "default" as const;
    default:
      return "default" as const;
  }
};

const getIcon = (type: MessageType) => {
  switch (type) {
    case "success":
      return "✅";
    case "error":
      return "❌";
    case "warning":
      return "⚠️";
    case "info":
      return "ℹ️";
    default:
      return "ℹ️";
  }
};

export function StatusMessage({ type, title, children, className = "" }: StatusMessageProps) {
  const variant = getVariant(type);
  const icon = getIcon(type);

  return (
    <Alert className={cn("mt-5", className)} variant={variant}>
      <AlertTitle className="flex items-center gap-2">
        {icon} {title}
      </AlertTitle>
      {children && <AlertDescription>{children}</AlertDescription>}
    </Alert>
  );
}
