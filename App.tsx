
import React, { useState, useRef, useEffect } from 'react';
import { Clue, Message, AgentResponse } from './types.ts';
import { INITIAL_CASE } from './constants.ts';
import { getDetectiveResponse, generateClueVisual } from './services/geminiService.ts';
import ClueBoard from './components/ClueBoard.tsx';
import ClueDetail from './components/ClueDetail.tsx';
import SaveModal from './components/SaveModal.tsx';

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
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // 初始化开场白
  useEffect(() => {
    if (messages.length === 0) {
      const intro: Message = {
        id: 'intro',
        role: 'assistant',
        text: "雨下得真大，侦探。斯威顿庄园的人都各怀鬼胎。我是你的助手。现场已经封锁了，但在那些上流社会的秘密发酵前，我们得赶紧行动。你打算先从哪儿查起？",
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
      const history = messages.slice(-6).map(m => ({
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
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap justify-between items-center shadow-2xl z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 border border-amber-900/50 rounded flex items-center justify-center shadow-lg">
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
              <span>💾</span> 保存
            </button>
            <button 
              onClick={() => { setModalMode('load'); setModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-all"
            >
              <span>📂</span> 读取
            </button>
          </div>
          <div className="flex items-center bg-slate-800/30 px-3 py-1.5 rounded-full border border-slate-700">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse mr-2"></span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">正在调查</span>
          </div>
        </div>
      </header>

      {saveStatus && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-amber-600 text-white px-6 py-2 rounded-full shadow-2xl typewriter-font text-sm animate-fade-in border border-white/20">
          {saveStatus}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
            {/* 案情背景卡片 */}
            <div className="bg-slate-900/90 border-l-4 border-amber-600 p-8 rounded-r-lg shadow-2xl max-w-4xl mx-auto mb-12 animate-fade-in">
              <div className="flex items-center gap-3 mb-6 opacity-80">
                 <div className="h-[2px] flex-1 bg-amber-900/30"></div>
                 <span className="text-amber-500 font-bold typewriter-font text-lg tracking-widest uppercase">绝密案卷：{INITIAL_CASE.title}</span>
                 <div className="h-[2px] flex-1 bg-amber-900/30"></div>
              </div>
              <p className="typewriter-font text-slate-300 leading-relaxed text-base italic whitespace-pre-wrap first-letter:text-4xl first-letter:font-bold first-letter:text-amber-500 first-letter:mr-2 first-letter:float-left">
                {caseContext}
              </p>
            </div>

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`max-w-[85%] md:max-w-[70%] p-5 rounded-2xl shadow-xl ${
                  msg.role === 'user' 
                  ? 'bg-amber-700/80 text-white rounded-tr-none border border-amber-600/50' 
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none typewriter-font'
                }`}>
                  <p className="text-[15px] leading-relaxed">{msg.text}</p>
                  <div className="flex justify-between items-center mt-3 opacity-40 border-t border-white/10 pt-2">
                    <span className="text-[9px] uppercase font-bold tracking-tighter">{msg.role === 'user' ? '侦探' : '助手'}</span>
                    <span className="text-[9px]">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl rounded-tl-none flex items-center gap-4">
                   <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                   </div>
                   <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">正在整理线索...</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-900/95 border-t border-slate-800 backdrop-blur-xl z-10">
            <form onSubmit={handleSendMessage} className="max-w-5xl mx-auto flex gap-4">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="向助手下达指令，例如：“带我去书房看看” 或 “询问管家当时的细节”..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-6 py-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-600/50 transition-all placeholder:text-slate-600 text-sm"
              />
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-10 py-4 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2"
              >
                {isLoading ? '调查中' : '行动'}
              </button>
            </form>
          </div>
        </div>
        
        <aside className="w-96 hidden lg:block border-l border-slate-800 shadow-2xl z-10">
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
    </div>
  );
};

export default App;
