import React, { useState, useEffect } from 'react';
import { X, Check, FileCode } from 'lucide-react';
import { codeToHtml } from 'shiki';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  lineNumber: number;
  content: string;
}

interface FileDiff {
  path: string;
  oldContent: string;
  newContent: string;
  diff: DiffLine[];
}

interface DiffViewerProps {
  filePath: string;
  originalContent: string;
  newContent: string;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}

// 简单的行级diff算法
const computeLineDiff = (oldContent: string, newContent: string): DiffLine[] => {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const result: DiffLine[] = [];

  // 使用简单的LCS（最长公共子序列）算法
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // 构建DP表
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯构建diff
  let i = m, j = n;
  const lcs: Array<{ type: 'unchanged'; content: string }> = [];

  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      lcs.unshift({ type: 'unchanged', content: oldLines[i - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  // 构建完整的diff
  let oldIdx = 0, newIdx = 0, lcsIdx = 0;

  while (oldIdx < m || newIdx < n) {
    if (lcsIdx < lcs.length) {
      const lcsLine = lcs[lcsIdx];

      // 添加删除的行
      while (oldIdx < m && oldLines[oldIdx] !== lcsLine.content) {
        result.push({
          type: 'removed',
          lineNumber: oldIdx + 1,
          content: oldLines[oldIdx],
        });
        oldIdx++;
      }

      // 添加新增的行
      while (newIdx < n && newLines[newIdx] !== lcsLine.content) {
        result.push({
          type: 'added',
          lineNumber: newIdx + 1,
          content: newLines[newIdx],
        });
        newIdx++;
      }

      // 添加未改变的行
      if (oldIdx < m && newIdx < n) {
        result.push({
          type: 'unchanged',
          lineNumber: newIdx + 1,
          content: newLines[newIdx],
        });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      }
    } else {
      // 处理剩余行
      while (oldIdx < m) {
        result.push({
          type: 'removed',
          lineNumber: oldIdx + 1,
          content: oldLines[oldIdx],
        });
        oldIdx++;
      }
      while (newIdx < n) {
        result.push({
          type: 'added',
          lineNumber: newIdx + 1,
          content: newLines[newIdx],
        });
        newIdx++;
      }
    }
  }

  return result;
};

const DiffViewer: React.FC<DiffViewerProps> = ({
  filePath,
  originalContent,
  newContent,
  onAccept,
  onReject,
  onClose,
}) => {
  const [diff, setDiff] = useState<DiffLine[]>([]);
  const [stats, setStats] = useState({ added: 0, removed: 0 });

  useEffect(() => {
    const computedDiff = computeLineDiff(originalContent, newContent);
    setDiff(computedDiff);

    const added = computedDiff.filter((l) => l.type === 'added').length;
    const removed = computedDiff.filter((l) => l.type === 'removed').length;
    setStats({ added, removed });
  }, [originalContent, newContent]);

  const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      tsx: 'tsx',
      py: 'python',
      rs: 'rust',
      html: 'html',
      css: 'css',
      json: 'json',
      md: 'markdown',
    };
    return map[ext] || 'text';
  };

  const getLineClass = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return 'bg-green-900/30 border-l-4 border-green-500';
      case 'removed':
        return 'bg-red-900/30 border-l-4 border-red-500';
      default:
        return 'border-l-4 border-transparent';
    }
  };

  const getLinePrefix = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return '+';
      case 'removed':
        return '-';
      default:
        return ' ';
    }
  };

  const getPrefixClass = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return 'text-green-400';
      case 'removed':
        return 'text-red-400';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg w-[90vw] h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
          <div className="flex items-center gap-3">
            <FileCode size={20} className="text-blue-400" />
            <div>
              <h3 className="text-white font-medium">{filePath}</h3>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-green-400">+{stats.added}</span>
                <span className="text-red-400">-{stats.removed}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#30363d] rounded transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-auto bg-[#0d1117] p-4 font-mono text-sm">
          <table className="w-full">
            <tbody>
              {diff.map((line, index) => (
                <tr
                  key={index}
                  className={`${getLineClass(line.type)} hover:bg-[#21262d]`}
                >
                  <td className="w-8 text-right pr-3 text-gray-500 select-none">
                    {line.type !== 'added' ? line.lineNumber : ''}
                  </td>
                  <td className="w-8 text-right pr-3 text-gray-500 select-none">
                    {line.type !== 'removed' ? line.lineNumber : ''}
                  </td>
                  <td className={`w-4 ${getPrefixClass(line.type)}`}>
                    {getLinePrefix(line.type)}
                  </td>
                  <td className="pl-2 whitespace-pre">{line.content || ' '}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-[#30363d]">
          <button
            onClick={onReject}
            className="px-4 py-2 border border-[#30363d] rounded text-gray-300 hover:bg-[#30363d] transition-colors"
          >
            拒绝
          </button>
          <button
            onClick={onAccept}
            className="px-4 py-2 bg-green-600 rounded text-white hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Check size={16} />
            应用变更
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiffViewer;
