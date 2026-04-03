import { FolderOpen, Clock, Zap, Shield } from 'lucide-react';

interface WelcomeScreenProps {
  onOpenProject: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpenProject }) => {
  const features = [
    {
      icon: <Zap size={20} style={{ color: '#fbbf24' }} />,
      title: 'AI 驱动开发',
      description: '自然语言描述需求，AI 自动生成代码',
    },
    {
      icon: <Shield size={20} style={{ color: '#4ade80' }} />,
      title: '零环境配置',
      description: '自动管理 Python/Node 运行时，无需手动安装',
    },
    {
      icon: <Clock size={20} style={{ color: '#60a5fa' }} />,
      title: '会话历史',
      description: '自动保存对话记录，随时回溯和导出',
    },
  ];

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0d1117',
        padding: '32px',
      }}
    >
      <div style={{ maxWidth: '600px', width: '100%' }}>
        {/* Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              backgroundColor: '#2563eb',
              borderRadius: '16px',
              marginBottom: '24px',
            }}
          >
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>
              AI
            </span>
          </div>
          <h1
            style={{
              fontSize: '36px',
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '12px',
            }}
          >
            AI IDE
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '18px' }}>
            面向产品经理的零配置开发环境
          </p>
        </div>

        {/* Open Project Button */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <button
            onClick={onOpenProject}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px 32px',
              backgroundColor: '#2563eb',
              color: 'white',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1d4ed8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
            }}
          >
            <FolderOpen size={24} />
            打开项目
          </button>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '12px' }}>
            快捷键: Ctrl+O / Cmd+O
          </p>
        </div>

        {/* Features */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          {features.map((feature, index) => (
            <div
              key={index}
              style={{
                padding: '16px',
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '8px',
              }}
            >
              <div style={{ marginBottom: '12px' }}>{feature.icon}</div>
              <h3
                style={{
                  color: 'white',
                  fontWeight: 500,
                  marginBottom: '4px',
                  fontSize: '14px',
                }}
              >
                {feature.title}
              </h3>
              <p style={{ color: '#9ca3af', fontSize: '13px' }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Shortcuts */}
        <div
          style={{
            padding: '16px',
            backgroundColor: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '8px',
          }}
        >
          <h3
            style={{
              color: '#d1d5db',
              fontWeight: 500,
              marginBottom: '12px',
              fontSize: '14px',
            }}
          >
            快捷键
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
              fontSize: '13px',
            }}
          >
            {[
              { label: '打开项目', key: 'Ctrl+O' },
              { label: '新建会话', key: 'Ctrl+N' },
              { label: '设置', key: 'Ctrl+,' },
              { label: '发送消息', key: 'Enter' },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#9ca3af',
                }}
              >
                <span>{item.label}</span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    color: '#6b7280',
                  }}
                >
                  {item.key}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
