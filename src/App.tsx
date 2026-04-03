import React, { useState, useEffect } from 'react';
import FileTree from './components/FileTree';
import CodeViewer from './components/CodeViewer';
import TerminalChat from './components/TerminalChat';
import DiffViewer from './components/DiffViewer';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, Settings, Play, Plus } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface Project {
  path: string;
  name: string;
}

interface Session {
  id: string;
  title: string;
  project_path: string;
  paradigm: string;
  updated_at: string;
  message_count: number;
}

interface PendingChange {
  filePath: string;
  originalContent: string;
  newContent: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type: 'text' | 'code' | 'terminal';
  isStreaming?: boolean;
}

function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(400);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  // 会话状态
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentParadigm, setCurrentParadigm] = useState('vibe');

  // 打开项目
  const openProject = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });

    if (selected && typeof selected === 'string') {
      const pathParts = selected.split('/');
      const name = pathParts[pathParts.length - 1] || 'project';
      setProject({ path: selected, name });

      // 创建新会话
      await createNewSession(selected);
    }
  };

  // 创建新会话
  const createNewSession = async (projectPath: string) => {
    try {
      const sessionId = await invoke<string>('create_session', {
        projectPath,
        paradigm: currentParadigm,
      });
      setCurrentSessionId(sessionId);
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: '你好！我是你的AI编程助手。描述你想实现的功能，我会帮你编写代码。',
          type: 'text',
        },
      ]);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  // 加载历史会话
  const loadSession = async (session: Session) => {
    try {
      const loadedSession = await invoke<{ messages: Message[] }>('load_session', {
        sessionId: session.id,
      });

      setCurrentSessionId(session.id);
      setCurrentParadigm(session.paradigm);
      setMessages(loadedSession.messages);
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  // 保存消息到会话
  const saveMessageToSession = async (role: string, content: string) => {
    if (!currentSessionId) return;

    try {
      await invoke('save_session_message', {
        sessionId: currentSessionId,
        role,
        content,
      });
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  };

  useEffect(() => {
    if (selectedFile) {
      loadFile(selectedFile);
    }
  }, [selectedFile]);

  const loadFile = async (path: string) => {
    try {
      const content = await invoke<string>('read_file', { filePath: path });
      setFileContent(content);
    } catch (error) {
      console.error('Failed to read file:', error);
      setFileContent('');
    }
  };

  // 应用AI代码变更
  const applyAIChange = async (filePath: string, newContent: string) => {
    const originalContent = await invoke<string>('read_file', { filePath }).catch(() => '');

    setPendingChange({
      filePath,
      originalContent,
      newContent,
    });
  };

  // 接受变更
  const handleAcceptChange = async () => {
    if (!pendingChange) return;

    try {
      await invoke('write_file', {
        filePath: pendingChange.filePath,
        content: pendingChange.newContent,
      });

      if (selectedFile === pendingChange.filePath) {
        await loadFile(pendingChange.filePath);
      }

      // 记录代码变更到会话
      if (currentSessionId) {
        await invoke('record_code_change', {
          sessionId: currentSessionId,
          filePath: pendingChange.filePath,
          changeType: 'modify',
          description: 'AI generated modification',
        });
      }

      setPendingChange(null);
    } catch (error) {
      console.error('Failed to apply change:', error);
      alert(`应用变更失败: ${error}`);
    }
  };

  // 拒绝变更
  const handleRejectChange = () => {
    setPendingChange(null);
  };

  const handleResize = (panel: 'left' | 'right', delta: number) => {
    if (panel === 'left') {
      setLeftWidth(Math.max(180, Math.min(400, leftWidth + delta)));
    } else {
      setRightWidth(Math.max(300, Math.min(600, rightWidth - delta)));
    }
  };

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0d1117]">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">AI IDE</h1>
          <p className="text-gray-400 mb-8">面向产品经理的零配置开发环境</p>
          <button
            onClick={openProject}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <FolderOpen size={20} />
            打开项目
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0d1117]">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-[#30363d] bg-[#161b22]">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-white">{project.name}</span>
          <span className="text-sm text-gray-500">{project.path}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-[#30363d] rounded transition-colors">
            <Play size={18} className="text-green-500" />
          </button>
          <button className="p-2 hover:bg-[#30363d] rounded transition-colors">
            <Plus size={18} />
          </button>
          <button className="p-2 hover:bg-[#30363d] rounded transition-colors">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - File Tree with Session List */}
        <div style={{ width: leftWidth }} className="flex-shrink-0 border-r border-[#30363d]">
          <FileTree
            projectPath={project.path}
            onFileSelect={setSelectedFile}
            selectedFile={selectedFile}
            currentSessionId={currentSessionId}
            onSessionSelect={loadSession}
            onNewSession={() => createNewSession(project.path)}
          />
        </div>

        {/* Resizer - Left */}
        <div
          className="resizer"
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startWidth = leftWidth;

            const handleMouseMove = (e: MouseEvent) => {
              handleResize('left', e.clientX - startX);
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        />

        {/* Center Panel - Code Viewer */}
        <div className="flex-1 bg-[#0d1117] overflow-auto">
          {selectedFile ? (
            <CodeViewer filePath={selectedFile} content={fileContent} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <p>选择一个文件查看内容</p>
            </div>
          )}
        </div>

        {/* Resizer - Right */}
        <div
          className="resizer"
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startWidth = rightWidth;

            const handleMouseMove = (e: MouseEvent) => {
              handleResize('right', startX - e.clientX);
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        />

        {/* Right Panel - Terminal Chat */}
        <div style={{ width: rightWidth }} className="flex-shrink-0 border-l border-[#30363d]">
          <TerminalChat
            projectPath={project.path}
            selectedFile={selectedFile}
            sessionId={currentSessionId}
            paradigm={currentParadigm}
            messages={messages}
            setMessages={setMessages}
            onApplyChange={applyAIChange}
            onSaveMessage={saveMessageToSession}
          />
        </div>
      </div>

      {/* Diff Viewer Modal */}
      {pendingChange && (
        <DiffViewer
          filePath={pendingChange.filePath}
          originalContent={pendingChange.originalContent}
          newContent={pendingChange.newContent}
          onAccept={handleAcceptChange}
          onReject={handleRejectChange}
          onClose={handleRejectChange}
        />
      )}
    </div>
  );
}

export default App;