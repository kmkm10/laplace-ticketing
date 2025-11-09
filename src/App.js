import React, { useState, useRef, useEffect } from 'react';
import { Send, CheckCircle, Clock, AlertCircle, Download, Loader2, User, Plus, Building2, Key, LogOut } from 'lucide-react';

const RequirementsChatbot = () => {
  const [userRole, setUserRole] = useState(null); // 'admin', 'customer', 'engineer'
  const [currentUser, setCurrentUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (userRole === 'customer' && currentUser) {
      setMessages([{
        role: 'assistant',
        content: `こんにちは、${currentUser.companyName}様!\n\n株式会社Laplaceの開発支援チャットボットです。\n\nどのような課題やご要望がありますか?お気軽にお聞かせください。`
      }]);
    }
  }, [userRole, currentUser]);

  const systemPrompt = `あなたは株式会社Laplaceの顧客向け開発支援チャットボットです。

【役割】
顧客から課題をヒアリングし、Laplaceのエンジニアが開発できる形式のチケットを作成する。

【進め方】
1. 課題・要望の詳細ヒアリング
2. 要件の明確化（機能・制約・優先度など）
3. エンジニア向けチケットの生成

【チケット生成のタイミング】
十分な情報が集まり、開発に必要な要件が明確になったら、以下のJSON形式でチケットを生成:

\`\`\`json
{
  "tickets": [
    {
      "title": "チケットタイトル（エンジニアが一目で分かる簡潔な表現）",
      "description": "詳細説明（背景、目的、期待する結果）",
      "acceptance_criteria": [
        "受け入れ基準1（完了の定義）",
        "受け入れ基準2"
      ],
      "technical_notes": "技術的な注意点や制約条件",
      "estimated_hours": 8,
      "priority": "high",
      "dependencies": []
    }
  ]
}
\`\`\`

【重要な原則】
- エンジニアが読んで「何を作ればいいか」が明確に分かること
- 曖昧な表現は避け、具体的な機能や動作を記載
- 受け入れ基準は検証可能なものにする
- 不明点があれば顧客に質問して明確化する

常に日本語で、親しみやすく丁寧に対応してください。`;

  const extractJsonFromMessage = (content) => {
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = content.match(jsonRegex);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        console.error('JSON parse error:', e);
        return null;
      }
    }
    return null;
  };

  const handleCreateCompany = (companyData) => {
    const newCompany = {
      id: `COMP-${Date.now()}`,
      ...companyData,
      createdAt: new Date().toISOString(),
      apiKey: `lp_${Math.random().toString(36).substr(2, 9)}_${Math.random().toString(36).substr(2, 9)}`
    };
    setCompanies(prev => [...prev, newCompany]);
    setShowCompanyModal(false);
  };

  const handleCustomerLogin = (apiKey) => {
    const company = companies.find(c => c.apiKey === apiKey);
    if (company) {
      setCurrentUser(company);
      setUserRole('customer');
    } else {
      alert('無効なAPIキーです');
    }
  };

  const handleLogout = () => {
    setUserRole(null);
    setCurrentUser(null);
    setMessages([]);
    setTickets([]);
    setCustomerInfo(null);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: systemPrompt,
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const data = await response.json();
      const assistantMessage = data.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');

      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);

      const jsonData = extractJsonFromMessage(assistantMessage);
      if (jsonData && jsonData.tickets) {
        const newTickets = jsonData.tickets.map((ticket, idx) => ({
          ...ticket,
          id: `TICKET-${Date.now()}-${idx}`,
          companyId: currentUser.id,
          companyName: currentUser.companyName,
          status: 'pending',
          created_at: new Date().toISOString(),
          completed_at: null
        }));
        setTickets(prev => [...prev, ...newTickets]);
      }

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'エラーが発生しました。もう一度お試しください。'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCompleteTicket = (ticketId) => {
    setTickets(prev => prev.map(ticket => 
      ticket.id === ticketId 
        ? { ...ticket, status: 'completed', completed_at: new Date().toISOString() }
        : ticket
    ));
  };

  const handleExport = () => {
    const exportData = {
      company: currentUser,
      conversation: messages,
      tickets: tickets.filter(t => t.companyId === currentUser?.id),
      exported_at: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laplace_${currentUser?.companyName}_${new Date().getTime()}.json`;
    a.click();
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'completed':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'pending':
        return <Clock className="text-yellow-600" size={20} />;
      default:
        return <AlertCircle className="text-gray-400" size={20} />;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800'
    };
    const labels = {
      pending: '開発中',
      completed: '完了'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  // ログイン画面
  if (!userRole) {
    return (
      <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Laplace 開発支援システム</h1>
            <p className="text-gray-600">ログインしてください</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setUserRole('admin')}
              className="w-full bg-purple-600 text-white px-6 py-4 rounded-lg hover:bg-purple-700 transition font-medium flex items-center justify-center gap-2"
            >
              <Key size={20} />
              Laplace管理者ログイン
            </button>
            <button
              onClick={() => {
                const apiKey = prompt('APIキーを入力してください:');
                if (apiKey) handleCustomerLogin(apiKey);
              }}
              className="w-full bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
            >
              <User size={20} />
              顧客ログイン
            </button>
            <button
              onClick={() => setUserRole('engineer')}
              className="w-full bg-gray-700 text-white px-6 py-4 rounded-lg hover:bg-gray-800 transition font-medium flex items-center justify-center gap-2"
            >
              <User size={20} />
              エンジニアログイン
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Laplace管理画面
  if (userRole === 'admin') {
    return (
      <div className="h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Laplace 管理画面</h1>
              <p className="text-sm text-gray-500">企業アカウント管理</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCompanyModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus size={16} />
                企業アカウント作成
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                <LogOut size={16} />
                ログアウト
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {companies.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <Building2 size={48} className="mx-auto mb-4 opacity-50" />
                <p>まだ企業アカウントがありません</p>
                <p className="text-sm mt-2">「企業アカウント作成」から追加してください</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {companies.map((company) => (
                  <div key={company.id} className="bg-white rounded-lg shadow border p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <Building2 className="text-blue-600 mt-1" size={24} />
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">{company.companyName}</h3>
                          <p className="text-sm text-gray-600 mt-1">担当者: {company.contactName}</p>
                          <p className="text-sm text-gray-600">メール: {company.email}</p>
                          <p className="text-xs text-gray-500 mt-2">作成日: {new Date(company.createdAt).toLocaleDateString('ja-JP')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">APIキー</p>
                        <div className="bg-gray-100 px-3 py-2 rounded font-mono text-sm">
                          {company.apiKey}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 企業作成モーダル */}
        {showCompanyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">企業アカウント作成</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                handleCreateCompany({
                  companyName: formData.get('companyName'),
                  contactName: formData.get('contactName'),
                  email: formData.get('email')
                });
                e.target.reset();
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">企業名</label>
                    <input
                      type="text"
                      name="companyName"
                      required
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="株式会社サンプル"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">担当者名</label>
                    <input
                      type="text"
                      name="contactName"
                      required
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="山田太郎"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                    <input
                      type="email"
                      name="email"
                      required
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="contact@example.com"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCompanyModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    作成
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // エンジニア画面
  if (userRole === 'engineer') {
    return (
      <div className="h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-800">エンジニアダッシュボード</h1>
              <p className="text-sm text-gray-500">Laplace 開発チケット管理</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Download size={16} />
                エクスポート
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                <LogOut size={16} />
                ログアウト
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tickets.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
              <p>まだチケットがありません</p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-4">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="bg-white rounded-lg shadow border p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(ticket.status)}
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{ticket.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">{ticket.id}</p>
                        <p className="text-sm text-blue-600 mt-1 flex items-center gap-1">
                          <Building2 size={14} />
                          {ticket.companyName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(ticket.status)}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        ticket.priority === 'high' ? 'bg-red-100 text-red-800' :
                        ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {ticket.priority === 'high' ? '高' : ticket.priority === 'medium' ? '中' : '低'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">説明</h4>
                      <p className="text-gray-600 text-sm">{ticket.description}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">受け入れ基準</h4>
                      <ul className="space-y-1">
                        {ticket.acceptance_criteria.map((criteria, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="text-blue-600 mt-1">✓</span>
                            <span>{criteria}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {ticket.technical_notes && (
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-1">技術的注意点</h4>
                        <p className="text-gray-600 text-sm bg-yellow-50 p-3 rounded">{ticket.technical_notes}</p>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-4 border-t">
                      <div className="text-sm text-gray-500">
                        見積工数: <span className="font-medium">{ticket.estimated_hours}時間</span>
                        {ticket.completed_at && (
                          <span className="ml-4">
                            完了日時: {new Date(ticket.completed_at).toLocaleString('ja-JP')}
                          </span>
                        )}
                      </div>
                      {ticket.status === 'pending' && (
                        <button
                          onClick={() => handleCompleteTicket(ticket.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <CheckCircle size={16} />
                          完了して納品
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 顧客画面
  return (
    <div className="flex h-screen bg-gray-50">
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Laplace 開発支援チャット</h1>
            <p className="text-sm text-gray-500">{currentUser?.companyName}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={tickets.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              <Download size={16} />
              エクスポート
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              <LogOut size={16} />
              ログアウト
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl px-4 py-3 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-800 border shadow-sm'
              }`}>
                <div className="whitespace-pre-wrap break-words">
                  {msg.content.replace(/```json[\s\S]*?```/g, '')}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border shadow-sm px-4 py-3 rounded-lg flex items-center gap-2">
                <Loader2 className="animate-spin" size={16} />
                <span className="text-gray-600">考え中...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-white border-t px-6 py-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="課題や要望を入力してください..."
              className="flex-1 px-4 py-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="w-96 bg-white border-l overflow-y-auto">
        <div className="p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-800 border-b pb-2">🎫 生成されたチケット</h2>
          
          {tickets.filter(t => t.companyId === currentUser?.id).length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <p className="text-sm">会話を進めると、開発チケットがここに表示されます</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.filter(t => t.companyId === currentUser?.id).map((ticket) => (
                <div key={ticket.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    {getStatusIcon(ticket.status)}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 text-sm">{ticket.title}</h3>
                      <p className="text-xs text-gray-500">{ticket.id}</p>
                    </div>
                    {getStatusBadge(ticket.status)}
                  </div>
                  <p className="text-xs text-gray-600">{ticket.description}</p>
                  <div className="pt-2 border-t text-xs text-gray-500">
                    見積: {ticket.estimated_hours}h
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequirementsChatbot;
