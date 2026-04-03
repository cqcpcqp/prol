import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Terminal, Play, Package, Settings, Key } from 'lucide-react';
import { invoke, Channel } from '@tauri-apps/api/core';
import { codeToHtml } from 'shiki';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type: 'text' | 'code' | 'terminal';
  isStreaming?: boolean;
}

interface TerminalChatProps {
  projectPath: string;
  selectedFile: string | null;
  sessionId: string | null;
  paradigm: string;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onApplyChange?: (filePath: string, newContent: string) => void;
  onSaveMessage?: (role: string, content: string) => void;
}

interface AIConfig {
  default_provider: string;
  openai?: { api_key: string };
  anthropic?: { api_key: string };
}

interface Paradigm {
  id: string;
  name: string;
  description: string;
}

// 代码块解析
interface CodeBlockType {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

const parseCodeBlocks = (content: string): CodeBlockType[] => {
  const blocks: CodeBlockType[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // 添加代码块前的文本
    if (match.index > lastIndex) {
      blocks.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }

    // 添加代码块
    blocks.push({
      type: 'code',
      language: match[1] || 'text',
      content: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  // 添加剩余文本
  if (lastIndex < content.length) {
    blocks.push({
      type: 'text',
      content: content.slice(lastIndex),
    });
  }

  return blocks.length > 0 ? blocks : [{ type: 'text', content }];
};

interface CodeBlockProps {
  code: string;
  language: string;
  suggestedPath?: string | null;
  onApplyChange?: (filePath: string, content: string) => void;
  projectPath?: string;
}

// 代码块组件
const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  suggestedPath,
  onApplyChange,
  projectPath,
}) => {
  const [highlighted, setHighlighted] = useState('');
  const [customPath, setCustomPath] = useState('');
  const [showApply, setShowApply] = useState(false);

  useEffect(() => {
    codeToHtml(code, {
      lang: language,
      theme: 'github-dark',
    }).then(setHighlighted);
  }, [code, language]);

  const handleApply = () => {
    const filePath = customPath || suggestedPath;
    if (filePath && onApplyChange) {
      // 确保路径是绝对的
      const fullPath = filePath.startsWith('/') || filePath.includes(':\\')
        ? filePath
        : `${projectPath}/${filePath}`;
      onApplyChange(fullPath, code);
    }
  };

  const displayPath = suggestedPath || customPath;

  return (
    <div className="my-2 rounded-lg overflow-hidden bg-[#0d1117] border border-[#30363d]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{language}</span>
          {onApplyChange && (
            <button
              onClick={() => setShowApply(!showApply)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {showApply ? '取消' : '应用'}
            </button>
          )}
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          复制
        </button>
      </div>

      {showApply && onApplyChange && (
        <div className="px-3 py-2 bg-[#21262d] border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customPath || suggestedPath || ''}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="文件路径..."
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-white"
            />
            <button
              onClick={handleApply}
              disabled={!displayPath}
              className="px-2 py-1 bg-green-600 rounded text-xs text-white hover:bg-green-700 disabled:opacity-50"
            >
              确认
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {suggestedPath ? '已检测到建议路径，可直接确认' : '请输入文件路径'}
          </p>
        </div>
      )}

      <div
        className="p-3 overflow-x-auto text-sm"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
};

// 从文本中提取可能的文件路径
const extractFilePath = (text: string): string | null => {
  // 匹配 `path/to/file.ext` 或 "path/to/file.ext" 或 'path/to/file.ext'
  const patterns = [
    /`([^`]+\.[a-zA-Z0-9]+)`/,
    /"([^"]+\.[a-zA-Z0-9]+)"/,
    /'([^']+\.[a-zA-Z0-9]+)'/,
    /文件[：:]\s*([\w\/\.\-]+)/,
    /file[：:]\s*([\w\/\.\-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
};

interface MarkdownContentProps {
  content: string;
  onApplyChange?: (filePath: string, content: string) => void;
  projectPath?: string;
}

// Markdown渲染组件
const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, onApplyChange, projectPath }) => {
  const blocks = parseCodeBlocks(content);

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          // 尝试从代码块前的文本中提取文件路径
          const prevBlock = blocks[index - 1];
          let suggestedPath: string | null = null;

          if (prevBlock?.type === 'text') {
            // 从最后几行提取路径
            const lastLines = prevBlock.content.split('\n').slice(-3).join('\n');
            suggestedPath = extractFilePath(lastLines);
          }

          return (
            <CodeBlock
              key={index}
              code={block.content}
              language={block.language || 'text'}
              suggestedPath={suggestedPath}
              onApplyChange={onApplyChange}
              projectPath={projectPath}
            />
          );
        }

        // 文本处理（简化版Markdown）
        const lines = block.content.split('\n');
        return (
          <div key={index} className="space-y-1">
            {lines.map((line, i) => {
              // 标题
              if (line.startsWith('### ')) {
                return <h3 key={i} className="text-lg font-bold text-white mt-3">{line.slice(4)}</h3>;
              }
              if (line.startsWith('## ')) {
                return <h2 key={i} className="text-xl font-bold text-white mt-4">{line.slice(3)}</h2>;
              }
              if (line.startsWith('# ')) {
                return <h1 key={i} className="text-2xl font-bold text-white mt-4">{line.slice(2)}</h1>;
              }
              // 列表项
              if (line.startsWith('- ')) {
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>{line.slice(2)}</span>
                  </div>
                );
              }
              // 数字列表
              if (/^\d+\. /.test(line)) {
                const num = line.match(/^\d+/)?.[0];
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-blue-400 min-w-[1.5em]">{num}.</span>
                    <span>{line.replace(/^\d+\. /, '')}</span>
                  </div>
                );
              }
              // 普通段落
              if (line.trim()) {
                return <p key={i} className="text-gray-200 leading-relaxed">{line}</p>;
              }
              // 空行
              return <div key={i} className="h-2" />;
            })}
          </div>
        );
      })}
    </div>
  );
};

const TerminalChat: React.FC<TerminalChatProps> = ({
  projectPath,
  selectedFile,
  sessionId,
  paradigm: initialParadigm,
  messages,
  setMessages,
  onApplyChange: _onApplyChange,
  onSaveMessage,
}) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('openai');
  const [paradigm, setParadigm] = useState(initialParadigm);
  const [paradigms, setParadigms] = useState<Paradigm[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingMessageId = useRef<string | null>(null);

  // 加载可用范式
  useEffect(() => {
    const loadParadigms = async () => {
      try {
        const result = await invoke<Paradigm[]>('get_paradigms');
        setParadigms(result);
      } catch (error) {
        console.error('Failed to load paradigms:', error);
      }
    };
    loadParadigms();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkConfig = useCallback(async () => {
    try {
      const config = await invoke<AIConfig>('get_config');
      const hasKey = config.openai?.api_key || config.anthropic?.api_key;
      if (hasKey) {
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: '你好！我是你的AI编程助手。描述你想实现的功能，我会帮你编写代码。',
            type: 'text',
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to get config:', error);
    }
  }, []);

  useEffect(() => {
    checkConfig();
  }, [checkConfig]);

  // 流式发送消息
  const sendMessageStream = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: input,
      type: 'text',
    };

    // 保存用户消息到会话
    if (sessionId && onSaveMessage) {
      onSaveMessage('user', input);
    }

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    // 创建AI消息占位
    const aiMessageId = (Date.now() + 1).toString();
    streamingMessageId.current = aiMessageId;

    setMessages((prev) => [
      ...prev,
      {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        type: 'text',
        isStreaming: true,
      },
    ]);

    try {
      // 创建Channel接收流式数据
      const channel = new Channel<{
        content: string;
        is_done: boolean;
      }>();

      // 设置消息处理器
      let accumulatedContent = '';
      channel.onmessage = (chunk) => {
        accumulatedContent += chunk.content;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? {
                  ...msg,
                  content: accumulatedContent,
                  isStreaming: !chunk.is_done,
                }
              : msg
          )
        );

        if (chunk.is_done) {
          setIsProcessing(false);
          streamingMessageId.current = null;
          // 保存AI回复到会话
          if (sessionId && onSaveMessage) {
            onSaveMessage('assistant', accumulatedContent);
          }
        }
      };

      // 调用流式API
      await invoke('generate_code_stream_channel', {
        request: {
          user_input: userMessage.content,
          project_path: projectPath,
          session_id: sessionId,
        },
        onChunk: channel,
      });
    } catch (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: `错误: ${error}\\n\\n请检查：\\n1. API密钥是否已配置\\n2. 网络连接是否正常`,
                isStreaming: false,
              }
            : msg
        )
      );
      setIsProcessing(false);
      streamingMessageId.current = null;
    }
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) return;

    try {
      await invoke('set_api_key', {
        request: {
          provider,
          api_key: apiKey,
        },
      });

      setShowSettings(false);
      setApiKey('');

      const systemMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'system',
        content: `API密钥已保存（${provider}）`,
        type: 'text',
      };
      setMessages((prev) => [...prev, systemMessage]);
      checkConfig();
    } catch (error) {
      alert(`保存失败: ${error}`);
    }
  };

  const runCode = async () => {
    if (!selectedFile) {
      addSystemMessage('请先选择一个文件');
      return;
    }

    try {
      addSystemMessage(`正在运行 ${selectedFile}...`);

      const result = await invoke<{
        stdout: string;
        stderr: string;
        exit_code: number;
      }>('run_code', {
        projectPath,
        file: selectedFile.split('/').pop(),
      });

      const output = result.stdout || result.stderr || '执行完成（无输出）';
      const outputMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'system',
        content: output,
        type: 'terminal',
      };

      setMessages((prev) => [...prev, outputMessage]);
    } catch (error) {
      addSystemMessage(`运行失败: ${error}`);
    }
  };

  const installPackage = async () => {
    const packageName = prompt('输入要安装的包名:');
    if (!packageName) return;

    try {
      addSystemMessage(`正在安装 ${packageName}...`);

      const result = await invoke<{
        stdout: string;
        stderr: string;
        exit_code: number;
      }>('install_dependency', {
        projectPath,
        package: packageName,
      });

      const outputMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'system',
        content:
          result.exit_code === 0
            ? `✅ ${packageName} 安装成功`
            : `❌ 安装失败: ${result.stderr}`,
        type: 'terminal',
      };

      setMessages((prev) => [...prev, outputMessage]);
    } catch (error) {
      addSystemMessage(`安装失败: ${error}`);
    }
  };

  const addSystemMessage = (content: string) => {
    const message: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'system',
      content,
      type: 'text',
    };
    setMessages((prev) => [...prev, message]);
  };

  // 切换范式
  const switchParadigm = async (newParadigm: string) => {
    try {
      await invoke('set_paradigm', { paradigmId: newParadigm });
      setParadigm(newParadigm);

      const paradigmNames: Record<string, string> = {
        vibe: '💭 Vibe（氛围编程）',
        spec: '📋 Spec（规格编程）',
        harness: '🧪 Harness（约束编程）',
      };

      const systemMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'system',
        content: `已切换到 ${paradigmNames[newParadigm]} 模式`,
        type: 'text',
      };
      setMessages((prev) => [...prev, systemMessage]);
    } catch (error) {
      console.error('Failed to switch paradigm:', error);
    }
  };

  // 获取消息图标
  const getMessageIcon = (role: string) => {
    switch (role) {
      case 'assistant':
        return <Bot size={16} className="text-blue-400" />;
      case 'user':
        return <User size={16} className="text-green-400" />;
      case 'system':
        return <Terminal size={16} className="text-gray-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117] terminal-chat relative">
      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 w-80">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Key size={18} />
              API 配置
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-sm">提供商</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full mt-1 bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white text-sm"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-sm">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full mt-1 bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 px-3 py-2 border border-[#30363d] rounded text-gray-300 text-sm hover:bg-[#30363d]"
                >
                  取消
                </button>
                <button
                  onClick={saveApiKey}
                  className="flex-1 px-3 py-2 bg-blue-600 rounded text-white text-sm hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-[#30363d]">
        <span className="text-xs font-semibold text-gray-400 uppercase">AI 助手</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 hover:bg-[#30363d] rounded transition-colors"
            title="配置API密钥"
          >
            <Settings size={14} className="text-gray-400" />
          </button>
          <button
            onClick={runCode}
            className="p-1.5 hover:bg-[#30363d] rounded transition-colors"
            title="运行当前文件"
          >
            <Play size={14} className="text-green-500" />
          </button>
          <button
            onClick={installPackage}
            className="p-1.5 hover:bg-[#30363d] rounded transition-colors"
            title="安装依赖"
          >
            <Package size={14} className="text-yellow-500" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className="flex-shrink-0 mt-1">{getMessageIcon(message.role)}</div>
            <div
              className={`max-w-[85%] p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.role === 'system'
                  ? 'bg-[#21262d] text-gray-300 font-mono text-sm'
                  : 'bg-[#21262d] text-gray-200'
              }`}
            >
              {message.role === 'assistant' ? (
                <>
                  <MarkdownContent
                    content={message.content}
                    onApplyChange={_onApplyChange}
                    projectPath={projectPath}
                  />
                  {message.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-blue-400 ml-1 animate-pulse" />
                  )}
                </>
              ) : (
                <pre className="whitespace-pre-wrap break-words">{message.content}</pre>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#30363d]">
        <div className="flex items-center gap-2 bg-[#21262d] rounded-lg px-3 py-2">
          <span className="text-gray-500">&gt;</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessageStream();
              }
            }}
            placeholder="描述你想实现的功能..."
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
            disabled={isProcessing}
          />
          <button
            onClick={sendMessageStream}
            disabled={isProcessing || !input.trim()}
            className="p-1.5 hover:bg-[#30363d] rounded transition-colors disabled:opacity-50"
          >
            <Send size={16} className="text-blue-400" />
          </button>
        </div>
        <div className="flex gap-2 mt-2 text-xs">
          {paradigms.map((p) => (
            <button
              key={p.id}
              onClick={() => switchParadigm(p.id)}
              className={`px-2 py-1 rounded transition-colors ${
                paradigm === p.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#21262d] text-gray-500 hover:bg-[#30363d]'
              }`}
              title={p.description}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TerminalChat;