
import React from 'react';
import { CaseRecord, ImageType, TextLabel } from '../types';
import { Icons } from '../constants';

interface JSONPreviewProps {
  data: CaseRecord;
}

export const JSONPreview: React.FC<JSONPreviewProps> = ({ data }) => {
  // Parse diagnostic basis if it's structured JSON
  const processContent = (label: string, content: string) => {
    if (label === TextLabel.DIAGNOSTIC_BASIS) {
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      } catch (e) {
        // Fallback to text
      }
    }
    return content;
  };

  const exportData = {
    ...data,
    training_data: {
      metadata: {
        id: data.caseId,
        category: data.organCategory
      },
      images: {
        he: data.images.filter(img => img.type === ImageType.HE).map(img => ({
          magnification: img.magnification,
          annotation: img.description,
          filename: img.fileName
        })),
        ihc: data.images.filter(img => img.type === ImageType.IHC).map(img => ({
          magnification: img.magnification,
          annotation: img.description,
          filename: img.fileName
        }))
      },
      sections: data.textSections.reduce((acc, curr) => {
        acc[curr.label] = processContent(curr.label, curr.content);
        return acc;
      }, {} as any)
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    alert('JSON数据已复制到剪贴板！');
  };

  return (
    <div className="bg-gray-900 rounded-[2rem] p-8 text-gray-300 font-mono text-[11px] overflow-hidden flex flex-col h-full border border-gray-800 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-tight">
          <Icons.FileText /> Export Schema Preview
        </h3>
        <button 
          onClick={handleCopy}
          className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2 font-sans text-[10px] font-black uppercase tracking-widest"
        >
          <Icons.Check /> Copy JSON
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-black/40 rounded-2xl p-6 custom-scrollbar leading-relaxed border border-white/5">
        <pre>{JSON.stringify(exportData, null, 2)}</pre>
      </div>
    </div>
  );
};
