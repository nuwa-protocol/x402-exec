/**
 * StatusMessage Component
 * 
 * A reusable component for displaying status messages (success, error, warning, info).
 * Provides consistent styling and layout for all status indicators across the app.
 */

import { ReactNode } from 'react';

type MessageType = 'success' | 'error' | 'warning' | 'info';

interface StatusMessageProps {
  type: MessageType;
  title: string;
  children?: ReactNode;
  className?: string;
}

const typeConfig: Record<MessageType, { icon: string; bgColor: string; borderColor: string; titleColor: string }> = {
  success: {
    icon: '✅',
    bgColor: '#d4edda',
    borderColor: '#c3e6cb',
    titleColor: '#155724',
  },
  error: {
    icon: '❌',
    bgColor: '#fee',
    borderColor: '#fcc',
    titleColor: '#c00',
  },
  warning: {
    icon: '⚠️',
    bgColor: '#fff3cd',
    borderColor: '#ffeaa7',
    titleColor: '#856404',
  },
  info: {
    icon: 'ℹ️',
    bgColor: '#d1ecf1',
    borderColor: '#bee5eb',
    titleColor: '#0c5460',
  },
};

export function StatusMessage({ type, title, children, className = '' }: StatusMessageProps) {
  const config = typeConfig[type];

  return (
    <div
      className={`status-message ${className}`}
      style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: config.bgColor,
        borderRadius: '8px',
        border: `1px solid ${config.borderColor}`,
      }}
    >
      <h4 style={{ margin: '0 0 10px 0', color: config.titleColor }}>
        {config.icon} {title}
      </h4>
      {children && (
        <div style={{ fontSize: '14px', color: config.titleColor }}>
          {children}
        </div>
      )}
    </div>
  );
}

