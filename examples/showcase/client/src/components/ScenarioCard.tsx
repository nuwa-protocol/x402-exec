/**
 * ScenarioCard Component
 *
 * A container component for scenario pages providing consistent layout and styling.
 * Includes header with title and optional badge, description area, and form/action area.
 */

import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ScenarioCardProps {
  title: string;
  badge?: string;
  description: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ScenarioCard({
  title,
  badge,
  description,
  children,
  className = "",
}: ScenarioCardProps) {
  // Determine badge style based on badge text
  const getBadgeStyle = () => {
    if (badge === "Server Mode" || badge === "Server") {
      return {
        background: 'linear-gradient(135deg, rgb(247, 151, 30) 0%, rgb(255, 210, 0) 100%)',
        color: 'white'
      };
    }
    // Serverless Mode or Serverless
    return {
      background: 'linear-gradient(135deg, rgb(102, 126, 234) 0%, rgb(118, 75, 162) 100%)',
      color: 'white'
    };
  };

  const badgeStyle = getBadgeStyle();

  return (
    <Card className={cn("border-0 shadow-none bg-transparent p-0", className)}>
      <CardHeader className="px-0" style={{ paddingBottom: '24px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
          <CardTitle 
            className="text-gray-900"
            style={{
              fontSize: '24px',
              fontWeight: '700',
              lineHeight: 'normal',
              margin: '0'
            }}
          >
            {title}
          </CardTitle>
          {badge && (
            <Badge
              style={{
                background: badgeStyle.background,
                color: badgeStyle.color,
                borderRadius: '12px',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: '600',
                border: 'none'
              }}
            >
              {badge}
            </Badge>
          )}
        </div>
        <CardDescription className="text-base leading-relaxed text-gray-600 px-0">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0 px-0">
        {children}
      </CardContent>
    </Card>
  );
}
