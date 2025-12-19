import React from 'react';
import { Clue } from '../types';

interface ClueBoardProps {
  clues: Clue[];
  onSelectClue: (clue: Clue) => void;
}

const CLUE_TYPE_MAP: Record<string, string> = {
  text: '档案',
  image: '物证',
  map: '地图'
};

const ClueBoard: React.FC<ClueBoardProps> = ({ clues, onSelectClue }) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 p-4 overflow-hidden">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
        <span className="text-amber-500">📁</span> 线索档案库
      </h2>
      <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-2">
        {clues.length === 0 ? (
          <p className="text-slate-500 italic text-sm text-center py-10">
            暂未收集到任何证据，侦探。
          </p>
        ) : (
          clues.map((clue) => (
            <div
              key={clue.id}
              onClick={() => onSelectClue(clue)}
              className="bg-slate-800 p-3 rounded-lg border border-slate-700 hover:border-amber-500/50 cursor-pointer transition-all group"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500/80">
                  {CLUE_TYPE_MAP[clue.type] || clue.type}
                </span>
                <span className="text-[10px] text-slate-500">
                  {new Date(clue.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-200 group-hover:text-amber-400 truncate">
                {clue.title}
              </h3>
              <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                {clue.description}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ClueBoard;