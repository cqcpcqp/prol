import React, { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';

interface CodeViewerProps {
  filePath: string;
  content: string;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ filePath, content }) => {
  const [highlightedCode, setHighlightedCode] = useState<string>('');

  const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      tsx: 'tsx',
      jsx: 'jsx',
      py: 'python',
      rs: 'rust',
      html: 'html',
      css: 'css',
      json: 'json',
      md: 'markdown',
      yml: 'yaml',
      yaml: 'yaml',
      toml: 'toml',
      sh: 'bash',
      bash: 'bash',
    };
    return languageMap[ext] || 'text';
  };

  useEffect(() => {
    const highlight = async () => {
      try {
        const html = await codeToHtml(content, {
          lang: getLanguage(filePath),
          theme: 'github-dark',
        });
        setHighlightedCode(html);
      } catch (error) {
        console.error('Failed to highlight code:', error);
        // Fallback to plain text
        setHighlightedCode(`<pre><code>${content}</code></pre>`);
      }
    };

    highlight();
  }, [content, filePath]);

  const fileName = filePath.split('/').pop() || '';

  return (
    <div className="h-full flex flex-col">
      {/* File Header */}
      <div className="h-10 flex items-center px-4 border-b border-[#30363d] bg-[#161b22]">
        <span className="text-sm text-gray-300">{fileName}</span>
      </div>

      {/* Code Content */}
      <div className="flex-1 overflow-auto code-viewer">
        <div
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
          className="h-full"
        />
      </div>
    </div>
  );
};

export default CodeViewer;
