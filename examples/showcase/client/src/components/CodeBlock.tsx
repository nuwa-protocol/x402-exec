/**
 * CodeBlock Component
 * 
 * Syntax-highlighted code block with support for loading code from external files
 */

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  borderColor?: string;
}

export function CodeBlock({ 
  code, 
  language = 'typescript', 
  title, 
  borderColor = '#28a745' 
}: CodeBlockProps) {
  return (
    <div
      style={{
        margin: '20px 0',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        borderLeft: `4px solid ${borderColor}`,
      }}
    >
      {title && (
        <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>{title}</h4>
      )}
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: '6px',
          fontSize: '13px',
        }}
        showLineNumbers={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

