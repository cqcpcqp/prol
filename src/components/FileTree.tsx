import React, { useState, useEffect, useCallback } from 'react';
import { Folder, File, ChevronRight, ChevronDown } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import SessionList from './SessionList';

interface FileNode {
  name: string;
  path: string;
  is_directory: boolean;
  children?: FileNode[];
}

interface Session {
  id: string;
  title: string;
  project_path: string;
  paradigm: string;
  updated_at: string;
  message_count: number;
}

interface FileTreeProps {
  projectPath: string;
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
  currentSessionId: string | null;
  onSessionSelect: (session: Session) => void;
  onNewSession: () => void;
}

const FileTree: React.FC<FileTreeProps> = ({
  projectPath,
  onFileSelect,
  selectedFile,
  currentSessionId,
  onSessionSelect,
  onNewSession,
}) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set([projectPath]));

  const loadDirectory = useCallback(async (path: string) => {
    try {
      const result = await invoke<FileNode[]>('read_directory', { dirPath: path });
      return result;
    } catch (error) {
      console.error('Failed to read directory:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    loadDirectory(projectPath).then(setFiles);
  }, [projectPath, loadDirectory]);

  const toggleDir = async (node: FileNode) => {
    if (!node.is_directory) {
      onFileSelect(node.path);
      return;
    }

    const newExpanded = new Set(expandedDirs);
    if (expandedDirs.has(node.path)) {
      newExpanded.delete(node.path);
    } else {
      newExpanded.add(node.path);
      if (!node.children || node.children.length === 0) {
        const children = await loadDirectory(node.path);
        node.children = children;
      }
    }
    setExpandedDirs(newExpanded);
  };

  const getFileIcon = (name: string, isDirectory: boolean) => {
    if (isDirectory) {
      return <Folder size={16} className="text-yellow-500" />;
    }

    const ext = name.split('.').pop()?.toLowerCase();
    const iconColors: Record<string, string> = {
      js: 'text-yellow-400',
      ts: 'text-blue-400',
      tsx: 'text-blue-400',
      jsx: 'text-blue-400',
      py: 'text-green-400',
      rs: 'text-orange-400',
      html: 'text-orange-500',
      css: 'text-blue-300',
      json: 'text-gray-400',
      md: 'text-white',
    };

    return <File size={16} className={iconColors[ext || ''] || 'text-gray-400'} />;
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedDirs.has(node.path);
    const isSelected = selectedFile === node.path;

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 px-2 py-1 cursor-pointer text-sm ${
            isSelected ? 'bg-blue-600 text-white' : 'hover:bg-[#21262d] text-gray-300'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => toggleDir(node)}
        >
          {node.is_directory && (
            <span className="w-4">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          {!node.is_directory && <span className="w-4" />}
          {getFileIcon(node.name, node.is_directory)}
          <span className="ml-1 truncate">{node.name}</span>
        </div>

        {node.is_directory && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* File Tree Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-10 flex items-center px-3 border-b border-[#30363d]">
          <span className="text-xs font-semibold text-gray-400 uppercase">文件</span>
        </div>
        <div className="flex-1 overflow-auto py-2">
          {files.map((node) => renderNode(node))}
        </div>
      </div>

      {/* Session List Section */}
      <SessionList
        projectPath={projectPath}
        currentSessionId={currentSessionId}
        onSessionSelect={onSessionSelect}
        onNewSession={onNewSession}
      />
    </div>
  );
};

export default FileTree;