/**
 * ScenarioCard Component
 *
 * A container component for scenario pages providing consistent layout and styling.
 * Includes header with title and optional badge, description area, and form/action area.
 */

import { ReactNode } from "react";

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
  return (
    <div className={`scenario-card ${className}`}>
      {/* Header */}
      <div className="scenario-header">
        <h2>{title}</h2>
        {badge && <span className="badge badge-new">{badge}</span>}
      </div>

      {/* Description */}
      <div className="scenario-description">{description}</div>

      {/* Content/Actions */}
      <div className="scenario-form">{children}</div>

      {/* Styles */}
      <style>{`
        .badge-new {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
