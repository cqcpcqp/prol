import { useState, useEffect, useCallback } from 'react';
import FileTree from './components/FileTree';
import CodeViewer from './components/CodeViewer';
import TerminalChat from './components/TerminalChat';
import DiffViewer from './components/DiffViewer';
import SettingsModal from './components/SettingsModal';
import WelcomeScreen from './components/WelcomeScreen';
import { open } from '@tauri-apps/plugin-dialog';
import { Settings, Play, Plus } from 'lucide-react';
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

// 后端返回的 Session 结构
interface LoadedSession {
  metadata: {
    id: string;
    title: string;
    project_path: string;
    paradigm: string;
  };
  messages: Message[];
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

  // 设置模态框
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 文件树刷新
  const [fileTreeKey, setFileTreeKey] = useState(0);
  const refreshFileTree = () => setFileTreeKey((k) => k + 1);

  // 创建新会话
  const createNewSession = useCallback(async (projectPath: string) => {
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
  }, [currentParadigm]);

  // 打开项目
  const openProject = useCallback(async () => {
    try {
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
    } catch (error) {
      console.error('Failed to open project:', error);
    }
  }, [createNewSession]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + , 打开设置
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
      // Ctrl/Cmd + O 打开项目
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        openProject();
      }
      // Ctrl/Cmd + N 新建会话
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (project) {
          createNewSession(project.path);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, openProject, createNewSession]);

  // 加载历史会话
  const loadSession = async (session: Session) => {
    try {
      const loadedSession = await invoke<LoadedSession>('load_session', {
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
    // 检查文件是否存在
    const exists = await invoke<boolean>('file_exists', { filePath });
    const originalContent = exists
      ? await invoke<string>('read_file', { filePath }).catch(() => '')
      : '';

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
      // 检查文件是否存在
      const exists = await invoke<boolean>('file_exists', {
        filePath: pendingChange.filePath,
      });

      await invoke('write_file', {
        filePath: pendingChange.filePath,
        content: pendingChange.newContent,
      });

      if (selectedFile === pendingChange.filePath) {
        await loadFile(pendingChange.filePath);
      }

      // 刷新文件树（如果是新文件）
      if (!exists) {
        refreshFileTree();
        // 选中新创建的文件
        setSelectedFile(pendingChange.filePath);
      }

      // 记录代码变更到会话
      if (currentSessionId) {
        await invoke('record_code_change', {
          sessionId: currentSessionId,
          filePath: pendingChange.filePath,
          changeType: exists ? 'modify' : 'create',
          description: exists ? 'AI modified file' : 'AI created new file',
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
      <>
        <WelcomeScreen onOpenProject={openProject} />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </>
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
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-[#30363d] rounded transition-colors"
            title="设置 (Ctrl+,)"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - File Tree with Session List */}
        <div style={{ width: leftWidth }} className="flex-shrink-0 border-r border-[#30363d]">
          <FileTree
            key={fileTreeKey}
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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
