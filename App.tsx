import React, { useState, useRef, useEffect } from 'react';
import { Clue, Message, AgentResponse } from './types';
import { INITIAL_CASE } from './constants';
import { getDetectiveResponse, generateClueVisual } from './services/geminiService';
import ClueBoard from './components/ClueBoard';
import ClueDetail from './components/ClueDetail';
import SaveModal from './components/SaveModal';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [clues, setClues] = useState<Clue[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'save' | 'load'>('save');
  const [caseContext] = useState(INITIAL_CASE.initialContext);
  const [showBriefing, setShowBriefing] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // 初始化开场白
  useEffect(() => {
    if (messages.length === 0) {
      const intro: Message = {
        id: 'intro',
        role: 'assistant',
        text: "雨打在窗台上，声音像是一群不耐烦的催债人。庄园里的空气冷得能冻住人的骨髓。我是老刘，你的助手。案发现场已经清理得差不多了，但真正的线索往往藏在人心缝隙里。侦探，我们要从哪一页档案开始翻起？",
        timestamp: Date.now()
      };
      setMessages([intro]);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const onSaveToSlot = (slotIndex: number) => {
    const saveData = {
      messages,
      clues,
      timestamp: Date.now(),
      caseId: INITIAL_CASE.id,
      preview: messages.length > 0 ? messages[messages.length - 1].text.substring(0, 30) : "新案件调查开始"
    };
    localStorage.setItem(`detective_save_slot_${slotIndex}`, JSON.stringify(saveData));
    setSaveStatus(`档案已存入第 ${slotIndex} 号文件柜`);
    setModalOpen(false);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const onLoadFromSlot = (slotIndex: number) => {
    const rawData = localStorage.getItem(`detective_save_slot_${slotIndex}`);
    if (!rawData) return;
    try {
      const { messages: savedMessages, clues: savedClues } = JSON.parse(rawData);
      setMessages(savedMessages);
      setClues(savedClues);
      setSaveStatus(`成功调取第 ${slotIndex} 号档案`);
      setShowBriefing(false);
      setModalOpen(false);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e) {
      setSaveStatus('档案损坏，无法读取');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const history = messages.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.text }]
      }));

      const response: AgentResponse = await getDetectiveResponse(history, userMessage.text, caseContext);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: response.message,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (response.newClues && response.newClues.length > 0) {
        for (const clueData of response.newClues) {
          let content = clueData.contentText || '';
          if (clueData.type === 'image' || clueData.type === 'map') {
            const visual = await generateClueVisual(clueData.contentPrompt || clueData.title);
            content = visual || 'https://picsum.photos/400/400?grayscale';
          }
          const newClue: Clue = {
            id: Math.random().toString(36).substr(2, 9),
            title: clueData.title,
            description: clueData.description,
            type: clueData.type,
            content: content,
            timestamp: Date.now()
          };
          setClues(prev => [newClue, ...prev]);
        }
      }
    } catch (error) {
      console.error("Gemini API Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-200 selection:bg-amber-500/30">
      {/* 沉浸式开场简报 */}
      {showBriefing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6">
          <div className="max-w-3xl w-full bg-[#1a1a1a] p-10 border border-amber-900/30 shadow-[0_0_50px_rgba(0,0,0,1)] relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-600 shadow-[0_0_10px_rgba(217,119,6,0.5)]"></div>
            <div className="flex justify-between items-start mb-8 border-b border-amber-900/20 pb-4">
              <div>
                <h2 className="typewriter-font text-3xl font-bold text-amber-600 tracking-tighter uppercase">侦探简报：{INITIAL_CASE.title}</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold mt-1">案卷编号 47-11-14 | 机密</p>
              </div>
              <div className="text-right">
                <p className="typewriter-font text-slate-500 text-xs">地点: {INITIAL_CASE.location}</p>
                <p className="typewriter-font text-slate-500 text-xs">状态: 调查进行中</p>
              </div>
            </div>
            
            <div className="prose prose-invert max-w-none mb-10">
              <p className="typewriter-font text-slate-300 leading-relaxed italic whitespace-pre-wrap text-lg">
                {caseContext}
              </p>
            </div>

            <div className="flex justify-center">
              <button 
                onClick={() => setShowBriefing(false)}
                className="group relative px-12 py-4 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-sm transition-all shadow-[0_5px_15px_rgba(0,0,0,0.3)] hover:shadow-amber-900/40 active:translate-y-1"
              >
                <span className="relative z-10 typewriter-font tracking-widest">接受委托</span>
                <div className="absolute inset-0 border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
            </div>
            
            <div className="mt-8 pt-4 border-t border-amber-900/10 flex justify-between items-center opacity-30">
               <span className="text-[10px] typewriter-font uppercase">局长签名: ________________</span>
               <span className="text-[10px] typewriter-font uppercase">日期: 1947.11.14</span>
            </div>
          </div>
        </div>
      )}

      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap justify-between items-center shadow-2xl z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 border border-amber-900/50 rounded flex items-center justify-center shadow-lg cursor-help" onClick={() => setShowBriefing(true)}>
            <span className="text-2xl filter contrast-125 grayscale">🕵️</span>
          </div>
          <div>
            <h1 className="text-xl font-bold typewriter-font tracking-tight text-amber-500">黑色侦探：AI 探案助手</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">档案编号：{INITIAL_CASE.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 sm:mt-0">
          <div className="flex bg-slate-950/50 rounded-lg p-1 border border-slate-800">
            <button 
              onClick={() => { setModalMode('save'); setModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-all"
            >
              <span>💾</span> 存盘
            </button>
            <button 
              onClick={() => { setModalMode('load'); setModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-all"
            >
              <span>📂</span> 调档
            </button>
          </div>
          <div className="flex items-center bg-amber-900/10 px-3 py-1.5 rounded-full border border-amber-900/20">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse mr-2 shadow-[0_0_5px_rgba(245,158,11,0.5)]"></span>
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">正在调查</span>
          </div>
        </div>
      </header>

      {saveStatus && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-amber-600 text-white px-6 py-2 rounded-full shadow-2xl typewriter-font text-sm animate-fade-in border border-white/20">
          {saveStatus}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 flex flex-col relative bg-slate-950">
          {/* 背景暗角效果 */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-10"></div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth z-0 custom-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`max-w-[85%] md:max-w-[75%] p-5 rounded-sm shadow-xl relative ${
                  msg.role === 'user' 
                  ? 'bg-amber-800/20 text-slate-200 border-r-4 border-amber-600' 
                  : 'bg-slate-900/80 border-l-4 border-slate-700 text-slate-300 typewriter-font'
                }`}>
                  {/* 角色标识 */}
                  <div className={`text-[9px] uppercase font-black tracking-widest mb-2 opacity-30 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.role === 'user' ? '侦探本人' : '助手 老刘'}
                  </div>
                  
                  <p className="text-[16px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  
                  <div className="flex justify-end mt-3 opacity-20 pt-2 text-[8px]">
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-900/40 border-l-4 border-amber-700 p-4 rounded-sm flex items-center gap-4">
                   <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                   </div>
                   <p className="text-[10px] text-amber-700 uppercase font-bold tracking-[0.3em]">老刘正在翻阅卷宗...</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-900 border-t border-slate-800 z-20">
            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="输入指令... (例如：检查酒杯、盘问遗孀、搜索书架)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-sm px-6 py-4 text-slate-200 focus:outline-none focus:border-amber-700/50 transition-all placeholder:text-slate-700 text-sm typewriter-font"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="bg-amber-700 hover:bg-amber-600 disabled:bg-slate-800 disabled:text-slate-600 text-white px-8 py-4 rounded-sm font-bold shadow-lg transition-all active:translate-y-1 flex items-center gap-2 typewriter-font uppercase tracking-widest"
              >
                {isLoading ? '调查中' : '行动'}
              </button>
            </form>
          </div>
        </div>
        
        <aside className="w-96 hidden lg:block border-l border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.5)] z-20">
          <ClueBoard clues={clues} onSelectClue={setSelectedClue} />
        </aside>
      </div>

      <ClueDetail clue={selectedClue} onClose={() => setSelectedClue(null)} />
      
      <SaveModal 
        isOpen={modalOpen} 
        mode={modalMode} 
        onClose={() => setModalOpen(false)} 
        onSelectSlot={modalMode === 'save' ? onSaveToSlot : onLoadFromSlot}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #020617;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </div>
  );
};

export default App;