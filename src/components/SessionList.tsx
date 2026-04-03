import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Clock, MessageSquare, Trash2, Download, Plus } from 'lucide-react';

interface Session {
  id: string;
  title: string;
  project_path: string;
  paradigm: string;
  updated_at: string;
  message_count: number;
}

interface SessionListProps {
  projectPath: string;
  currentSessionId: string | null;
  onSessionSelect: (session: Session) => void;
  onNewSession: () => void;
}

const SessionList: React.FC<SessionListProps> = ({
  projectPath,
  currentSessionId,
  onSessionSelect,
  onNewSession,
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    loadSessions();
  }, [projectPath]);

  const loadSessions = async () => {
    try {
      const result = await invoke<Session[]>('get_project_sessions', {
        projectPath,
      });
      setSessions(result);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个会话吗？')) return;

    try {
      await invoke('delete_session', { sessionId });
      await loadSessions();
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const exportSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const markdown = await invoke<string>('export_session', { sessionId });
      // 下载文件
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${sessionId.slice(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export session:', error);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // 小于1小时显示"xx分钟前"
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return minutes < 1 ? '刚刚' : `${minutes}分钟前`;
    }

    // 小于24小时显示"xx小时前"
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours}小时前`;
    }

    // 显示日期
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getParadigmIcon = (paradigm: string) => {
    switch (paradigm) {
      case 'vibe':
        return '💭';
      case 'spec':
        return '📋';
      case 'harness':
        return '🧪';
      default:
        return '💭';
    }
  };

  return (
    <div className="border-t border-[#30363d]">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#21262d]"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-300">历史会话</span>
          <span className="text-xs text-gray-500">({sessions.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNewSession();
            }}
            className="p-1 hover:bg-[#30363d] rounded"
            title="新建会话"
          >
            <Plus size={14} className="text-gray-400" />
          </button>
          <span className="text-xs text-gray-500">
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {/* Session List */}
      {isExpanded && (
        <div className="max-h-48 overflow-auto">
          {sessions.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-500">
              暂无历史会话
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSessionSelect(session)}
                className={`group flex items-start gap-2 px-3 py-2 cursor-pointer border-l-2 ${
                  currentSessionId === session.id
                    ? 'bg-[#1f2937] border-blue-500'
                    : 'hover:bg-[#21262d] border-transparent'
                }`}
              >
                <span className="text-sm mt-0.5">{getParadigmIcon(session.paradigm)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200 truncate">
                    {session.title}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <MessageSquare size={10} />
                      {session.message_count}
                    </span>
                    <span>·</span>
                    <span>{formatTime(session.updated_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => exportSession(session.id, e)}
                    className="p-1 hover:bg-[#30363d] rounded"
                    title="导出"
                  >
                    <Download size={12} className="text-gray-400" />
                  </button>
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="p-1 hover:bg-[#30363d] rounded"
                    title="删除"
                  >
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SessionList;