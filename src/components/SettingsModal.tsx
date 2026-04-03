import { useState, useEffect } from 'react';
import { X, Key, Server, Database } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AIConfig {
  default_provider: string;
  openai?: { api_key: string };
  anthropic?: { api_key: string };
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'runtime'>('ai');
  const [, setConfig] = useState<AIConfig | null>(null);
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [provider, setProvider] = useState('openai');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const cfg = await invoke<AIConfig>('get_config');
      setConfig(cfg);
      setProvider(cfg.default_provider);
      if (cfg.openai?.api_key) {
        setOpenaiKey(cfg.openai.api_key);
      }
      if (cfg.anthropic?.api_key) {
        setAnthropicKey(cfg.anthropic.api_key);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const saveSettings = async () => {
    try {
      if (openaiKey) {
        await invoke('set_api_key', {
          request: { provider: 'openai', api_key: openaiKey },
        });
      }
      if (anthropicKey) {
        await invoke('set_api_key', {
          request: { provider: 'anthropic', api_key: anthropicKey },
        });
      }
      setMessage('设置已保存');
      setTimeout(() => setMessage(''), 2000);
    } catch (error) {
      setMessage(`保存失败: ${error}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg w-[600px] h-[500px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
          <h2 className="text-white font-semibold">设置</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#30363d] rounded transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-[#30363d] p-2">
            <button
              onClick={() => setActiveTab('ai')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                activeTab === 'ai'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-[#21262d]'
              }`}
            >
              <Key size={16} />
              AI 配置
            </button>
            <button
              onClick={() => setActiveTab('runtime')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors mt-1 ${
                activeTab === 'runtime'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-[#21262d]'
              }`}
            >
              <Database size={16} />
              运行时
            </button>
          </div>

          {/* Settings Content */}
          <div className="flex-1 p-6 overflow-auto">
            {activeTab === 'ai' && (
              <div className="space-y-6">
                {/* Default Provider */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    默认提供商
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white text-sm"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>

                {/* OpenAI API Key */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    用于 GPT-4, GPT-3.5 等模型
                  </p>
                </div>

                {/* Anthropic API Key */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Anthropic API Key
                  </label>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    用于 Claude 3 系列模型
                  </p>
                </div>

                {message && (
                  <div className="text-sm text-green-400">{message}</div>
                )}

                <button
                  onClick={saveSettings}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                >
                  保存设置
                </button>
              </div>
            )}

            {activeTab === 'runtime' && (
              <div className="space-y-6">
                <div className="p-4 bg-[#0d1117] rounded border border-[#30363d]">
                  <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                    <Server size={16} />
                    运行时管理
                  </h3>
                  <p className="text-sm text-gray-400">
                    Python 和 Node.js 运行时将自动下载到 ~/.ai-ide/runtimes/
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white">已安装运行时</h4>
                  <RuntimeList />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 运行时列表组件
const RuntimeList: React.FC = () => {
  const [runtimes, setRuntimes] = useState<Array<{ name: string; version: string }>>([]);

  useEffect(() => {
    loadRuntimes();
  }, []);

  const loadRuntimes = async () => {
    try {
      const result = await invoke<Array<{ name: string; version: string }>>('list_installed_runtimes');
      setRuntimes(result);
    } catch (error) {
      console.error('Failed to load runtimes:', error);
    }
  };

  if (runtimes.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-2">
        暂无已安装的运行时
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {runtimes.map((rt) => (
        <div
          key={rt.name}
          className="flex items-center justify-between px-3 py-2 bg-[#0d1117] rounded text-sm"
        >
          <span className="text-gray-300">{rt.name}</span>
          <span className="text-gray-500">{rt.version}</span>
        </div>
      ))}
    </div>
  );
};

export default SettingsModal;
