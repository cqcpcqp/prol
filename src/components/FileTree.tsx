import React, { useState, useEffect, useCallback } from 'react';
import { Folder, File, ChevronRight, ChevronDown, Plus, Trash2 } from 'lucide-react';
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
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode | null;
  } | null>(null);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [createInDir, setCreateInDir] = useState('');

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

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();

    // 边界检测，防止菜单超出窗口
    const menuWidth = 160;
    const menuHeight = 80;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

    setContextMenu({
      x,
      y,
      node,
    });
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;

    const targetDir = createInDir || projectPath;
    const filePath = `${targetDir}/${newFileName}`;

    try {
      await invoke('create_file', { filePath });
      // Refresh the directory
      const parentDir = targetDir === projectPath ? projectPath : targetDir;
      const refreshed = await loadDirectory(parentDir);

      // Update the file tree
      if (parentDir === projectPath) {
        setFiles(refreshed);
      } else {
        // Find and update the specific directory node
        const updateNodeChildren = (nodes: FileNode[]): FileNode[] => {
          return nodes.map((node) => {
            if (node.path === parentDir) {
              return { ...node, children: refreshed };
            }
            if (node.children) {
              return { ...node, children: updateNodeChildren(node.children) };
            }
            return node;
          });
        };
        setFiles((prev) => updateNodeChildren(prev));
      }

      setIsCreatingFile(false);
      setNewFileName('');
      setCreateInDir('');

      // Select the new file
      onFileSelect(filePath);
    } catch (error) {
      console.error('Failed to create file:', error);
      alert(`创建文件失败: ${error}`);
    }
  };

  const handleDelete = async () => {
    if (!contextMenu?.node) return;

    const node = contextMenu.node;
    const confirmMsg = node.is_directory
      ? `确定要删除文件夹 "${node.name}" 及其所有内容吗？`
      : `确定要删除文件 "${node.name}" 吗？`;

    if (!confirm(confirmMsg)) return;

    try {
      if (node.is_directory) {
        await invoke('delete_directory', { dirPath: node.path });
      } else {
        await invoke('delete_file', { filePath: node.path });
      }

      // Refresh root directory
      const refreshed = await loadDirectory(projectPath);
      setFiles(refreshed);

      if (selectedFile === node.path) {
        onFileSelect('');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      alert(`删除失败: ${error}`);
    }

    setContextMenu(null);
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
          onContextMenu={(e) => handleContextMenu(e, node)}
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

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* File Tree Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-10 flex items-center justify-between px-3 border-b border-[#30363d]">
          <span className="text-xs font-semibold text-gray-400 uppercase">文件</span>
          <button
            onClick={() => {
              setCreateInDir(projectPath);
              setIsCreatingFile(true);
            }}
            className="p-1 hover:bg-[#30363d] rounded transition-colors"
            title="新建文件"
          >
            <Plus size={14} className="text-gray-400" />
          </button>
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-[#161b22] border border-[#30363d] rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node?.is_directory && (
            <button
              onClick={() => {
                setCreateInDir(contextMenu.node!.path);
                setIsCreatingFile(true);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-[#21262d] flex items-center gap-2"
            >
              <Plus size={14} />
              新建文件
            </button>
          )}
          <button
            onClick={handleDelete}
            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-[#21262d] flex items-center gap-2"
          >
            <Trash2 size={14} />
            删除
          </button>
        </div>
      )}

      {/* Create File Modal */}
      {isCreatingFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 w-80">
            <h3 className="text-white font-semibold mb-4">新建文件</h3>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="文件名..."
              className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white text-sm mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFile();
                if (e.key === 'Escape') {
                  setIsCreatingFile(false);
                  setNewFileName('');
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsCreatingFile(false);
                  setNewFileName('');
                }}
                className="flex-1 px-3 py-2 border border-[#30363d] rounded text-gray-300 text-sm hover:bg-[#30363d]"
              >
                取消
              </button>
              <button
                onClick={handleCreateFile}
                disabled={!newFileName.trim()}
                className="flex-1 px-3 py-2 bg-blue-600 rounded text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileTree;
