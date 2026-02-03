
import React, { useState, useEffect } from 'react';
import { TextRecord, TextLabel, REQUIRED_TEXT_LABELS } from '../types';
import { TEXT_LABELS, Icons } from '../constants';

interface TextEntryProps {
  section: TextRecord;
  onUpdate: (id: string, updates: Partial<TextRecord>) => void;
  onRemove: (id: string) => void;
}

interface DiagnosticBasisStructured {
  gross: string;
  he: string;
  ihc: string;
  general: string;
}

export const TextEntry: React.FC<TextEntryProps> = ({ section, onUpdate, onRemove }) => {
  const isRequired = REQUIRED_TEXT_LABELS.includes(section.label);
  const isDiagnosticBasis = section.label === TextLabel.DIAGNOSTIC_BASIS;

  // Local state for structured diagnostic basis if applicable
  const [structuredBasis, setStructuredBasis] = useState<DiagnosticBasisStructured>(() => {
    if (isDiagnosticBasis) {
      try {
        const parsed = JSON.parse(section.content);
        if (typeof parsed === 'object' && parsed !== null) {
          return {
            gross: parsed.gross || '',
            he: parsed.he || '',
            ihc: parsed.ihc || '',
            general: parsed.general || ''
          };
        }
      } catch (e) {
        // Not a JSON string, treat as general text
      }
    }
    return { gross: '', he: '', ihc: '', general: section.content };
  });

  const handleStructuredChange = (key: keyof DiagnosticBasisStructured, value: string) => {
    const next = { ...structuredBasis, [key]: value };
    setStructuredBasis(next);
    // If all sub-fields are empty except general, just save general as plain text
    // Otherwise save as JSON
    if (next.gross || next.he || next.ihc) {
      onUpdate(section.id, { content: JSON.stringify(next) });
    } else {
      onUpdate(section.id, { content: next.general });
    }
  };

  const hasAnyContent = () => {
    if (isDiagnosticBasis) {
      return !!(structuredBasis.general.trim() || structuredBasis.gross.trim() || structuredBasis.he.trim() || structuredBasis.ihc.trim());
    }
    return !!section.content.trim();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group relative mb-4">
      <button 
        onClick={() => onRemove(section.id)}
        className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
        title="移除"
      >
        <Icons.Trash />
      </button>

      <div className="flex flex-col gap-4">
        <div className="w-64">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            内容板块 {isRequired && <span className="text-red-500">*</span>}
          </label>
          <select
            value={section.label}
            onChange={(e) => onUpdate(section.id, { label: e.target.value as TextLabel })}
            className={`w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${
              isRequired && !hasAnyContent() ? 'border-amber-300 shadow-[0_0_0_2px_rgba(245,158,11,0.1)]' : 'border-gray-300'
            }`}
          >
            {TEXT_LABELS.map(label => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            {section.label} 详细内容 {isRequired && <span className="text-red-500">*</span>}
          </label>
          
          {isDiagnosticBasis ? (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">大体检查依据 (可选)</span>
                  <textarea
                    value={structuredBasis.gross}
                    onChange={(e) => handleStructuredChange('gross', e.target.value)}
                    placeholder="依据大体检查的发现..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">HE 染色依据 (可选)</span>
                  <textarea
                    value={structuredBasis.he}
                    onChange={(e) => handleStructuredChange('he', e.target.value)}
                    placeholder="依据镜下 HE 染色的特征..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">免疫组化依据 (可选)</span>
                  <textarea
                    value={structuredBasis.ihc}
                    onChange={(e) => handleStructuredChange('ihc', e.target.value)}
                    placeholder="依据免疫组化标记的结果..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">综合/其他依据</span>
                <textarea
                  value={structuredBasis.general}
                  onChange={(e) => handleStructuredChange('general', e.target.value)}
                  placeholder="通用的诊断依据描述..."
                  className={`w-full bg-white border rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-colors h-32 ${
                    isRequired && !hasAnyContent() ? 'border-amber-200 bg-amber-50/20' : 'border-gray-300'
                  }`}
                />
              </div>
            </div>
          ) : (
            <textarea
              value={section.content}
              onChange={(e) => onUpdate(section.id, { content: e.target.value })}
              placeholder={isRequired ? "必填：请粘贴该章节对应的文字内容..." : "选填：请粘贴文字内容..."}
              rows={5}
              className={`w-full bg-white border rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-colors ${
                isRequired && !section.content.trim() ? 'border-amber-200 bg-amber-50/30' : 'border-gray-300'
              }`}
            />
          )}
        </div>
      </div>
    </div>
  );
};
