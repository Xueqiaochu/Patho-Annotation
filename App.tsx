
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenAI, Type } from "@google/genai";
import { CaseRecord, TextRecord, ImageRecord, TextLabel, ImageType, Magnification, User, UserRole } from './types';
import { TextEntry } from './components/TextEntry';
import { ImageEntry } from './components/ImageEntry';
import { JSONPreview } from './components/JSONPreview';
import { Icons, ORGAN_CATEGORIES } from './constants';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs`;

const DB_NAME = 'PathologyDataPlatform';
const STORE_CASES = 'cases';
const STORE_DRAFTS = 'drafts';
const DB_VERSION = 4;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CASES)) db.createObjectStore(STORE_CASES, { keyPath: 'caseId' });
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) db.createObjectStore(STORE_DRAFTS, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveToDB = async (storeName: string, data: any): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(data);
};

const removeFromDB = async (storeName: string, key: string): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).delete(key);
};

const getAllFromDB = async (storeName: string): Promise<any[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
  });
};

const cropImageByCoordinates = (base64: string, mimeType: string, box: [number, number, number, number]): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = `data:${mimeType};base64,${base64}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const [ymin, xmin, ymax, xmax] = box;
      const x = (xmin / 1000) * img.width;
      const y = (ymin / 1000) * img.height;
      const width = ((xmax - xmin) / 1000) * img.width;
      const height = ((ymax - ymin) / 1000) * img.height;
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL(mimeType).split(',')[1]);
    };
  });
};

interface QueuedImage {
  id: string;
  data: string;
  type: string;
  name: string;
  selected: boolean;
}

interface DraftRecord extends CaseRecord {
  id: string;
  status: 'draft';
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'history'>('edit');
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [globalHistory, setGlobalHistory] = useState<CaseRecord[]>([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [queuedImages, setQueuedImages] = useState<QueuedImage[]>([]);
  const [draftCases, setDraftCases] = useState<DraftRecord[]>([]);
  const [selectedDraftIndex, setSelectedDraftIndex] = useState<number>(0);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  const currentCase = draftCases[selectedDraftIndex] || null;

  const loadAllData = async () => {
    const cases = await getAllFromDB(STORE_CASES);
    setGlobalHistory(cases.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()));
    const drafts = await getAllFromDB(STORE_DRAFTS);
    setDraftCases(drafts);
  };

  useEffect(() => { if (user) loadAllData(); }, [user]);

  const unifiedHistory = useMemo(() => {
    const confirmed = globalHistory.map(c => ({ ...c, status: 'confirmed' as const }));
    const drafts = draftCases.map(d => ({ ...d, status: 'draft' as const }));
    return [...confirmed, ...drafts].sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
  }, [globalHistory, draftCases]);

  const togglePageSelection = (id: string) => {
    setQueuedImages(prev => prev.map(img => img.id === id ? { ...img, selected: !img.selected } : img));
  };

  const setAllSelection = (selected: boolean) => {
    setQueuedImages(prev => prev.map(img => ({ ...img, selected })));
  };

  const processBatchSequentially = async () => {
    const imagesToProcess = queuedImages.filter(img => img.selected);
    if (imagesToProcess.length === 0) return;

    const CHUNK_SIZE = 2;
    setBatchProgress({ current: 0, total: Math.ceil(imagesToProcess.length / CHUNK_SIZE) });
    setIsAIProcessing(true);
    setIsMinimized(false);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      for (let i = 0; i < imagesToProcess.length; i += CHUNK_SIZE) {
        const chunk = imagesToProcess.slice(i, i + CHUNK_SIZE);
        setBatchProgress(prev => ({ ...prev, current: Math.floor(i / CHUNK_SIZE) + 1 }));

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{
            parts: [
              { text: `你是一个专业的病理学专家。你的任务是从提供的扫描页图片中精准提取病理病例数据。
              
【核心任务】：
1. 识别病例标题与章节。
2. 提取文本板块：病人资料、大体检查、病理诊断、诊断依据、鉴别诊断、免疫组化、知识拓展。
3. 识别显微镜像（插图）：
   - 提供 box_2d 坐标 [ymin, xmin, ymax, xmax]，范围 0-1000。
   - 识别图像类型：HE染色 或 免疫组化。
   - 【重点：提取放大倍率】：请在图片说明或图注中寻找放大倍率信息。通常表现为 "x10", "x20", "x40", "x100", "x200", "x400" 或 "10x", "20x" 等。如果明确提到倍数但不是上述值，请映射到最接近的值或设为"其他"。
   - 提取该图对应的描述文字。

【重要规则】：
- 如果页面没有诊断信息，返回空数组。` },
              ...chunk.map(img => ({ inlineData: { mimeType: img.type, data: img.data } }))
            ]
          }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                cases: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      chapterNumber: { type: Type.STRING },
                      caseNumber: { type: Type.STRING },
                      organCategory: { type: Type.STRING },
                      textSections: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            label: { type: Type.STRING, enum: Object.values(TextLabel) },
                            content: { type: Type.STRING }
                          }
                        }
                      },
                      detectedImages: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                            type: { type: Type.STRING, enum: ['HE染色', '免疫组化'] },
                            magnification: { type: Type.STRING, enum: ['x10', 'x20', 'x40', 'x100', 'x200', 'x400', '其他'] },
                            description: { type: Type.STRING },
                            originalImageIndex: { type: Type.INTEGER }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        });

        const result = JSON.parse(response.text || '{"cases": []}');
        const chunkDrafts: DraftRecord[] = [];

        for (const aiCase of result.cases) {
          const caseId = `Case-${aiCase.chapterNumber || '0'}-${aiCase.caseNumber || '0'}`;
          const imagePromises = (aiCase.detectedImages || []).map(async (imgInfo: any) => {
            const source = chunk[imgInfo.originalImageIndex ?? 0];
            if (!source || !imgInfo.box_2d) return null;
            const croppedBase64 = await cropImageByCoordinates(source.data, source.type, imgInfo.box_2d);
            return {
              id: uuidv4(),
              url: `data:${source.type};base64,${croppedBase64}`,
              fileName: `Auto_${source.name}`,
              type: imgInfo.type === '免疫组化' ? ImageType.IHC : ImageType.HE,
              magnification: (imgInfo.magnification as Magnification) || Magnification.OTHER,
              description: imgInfo.description || ''
            } as ImageRecord;
          });

          const images = (await Promise.all(imagePromises)).filter(img => img !== null) as ImageRecord[];
          const newDraft: DraftRecord = {
            id: uuidv4(),
            caseId,
            userId: user!.id,
            username: user!.username,
            organCategory: aiCase.organCategory || '',
            textSections: (aiCase.textSections || []).map((s: any) => ({ ...s, id: uuidv4() })),
            images,
            submittedAt: new Date().toISOString(),
            status: 'draft'
          };
          chunkDrafts.push(newDraft);
          await saveToDB(STORE_DRAFTS, newDraft);
        }
        setDraftCases(prev => [...prev, ...chunkDrafts]);
      }
      setQueuedImages([]);
      setNotification({ type: 'success', message: '处理完成！请在列表中校对生成的数据。' });
    } catch (err) {
      setNotification({ type: 'error', message: '处理异常。' });
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAIProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      const imgs: QueuedImage[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.height = vp.height; canvas.width = vp.width;
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
        imgs.push({ id: uuidv4(), data: canvas.toDataURL('image/jpeg', 0.8).split(',')[1], type: 'image/jpeg', name: `p${i}`, selected: true });
        setBatchProgress({ current: i, total: pdf.numPages });
      }
      setQueuedImages(imgs);
      setNotification({ type: 'success', message: `PDF 解析完成，共 ${imgs.length} 页。请选择需要提取的页面。` });
    } catch (err) { setNotification({ type: 'error', message: 'PDF 解析失败' }); }
    finally { setIsAIProcessing(false); setBatchProgress({ current: 0, total: 0 }); }
  };

  const handleCaseSubmit = async () => {
    if (!currentCase) return;
    try {
      const confirmed = { ...currentCase, submittedAt: new Date().toISOString() };
      delete (confirmed as any).id;
      delete (confirmed as any).status;
      await saveToDB(STORE_CASES, confirmed);
      await removeFromDB(STORE_DRAFTS, currentCase.id);
      await loadAllData();
      setNotification({ type: 'success', message: '已存档' });
    } catch (err) { setNotification({ type: 'error', message: '失败' }); }
  };

  const handleDraftDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await removeFromDB(STORE_DRAFTS, id);
    setDraftCases(prev => prev.filter(d => d.id !== id));
  };

  if (!user) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 text-white font-black italic">
      <button onClick={() => setUser({ id: uuidv4(), username: 'Operator_01', role: UserRole.USER })} className="text-6xl tracking-tighter hover:text-blue-500 transition-colors uppercase">Start Annotation Platform</button>
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 font-sans">
      {isAIProcessing && (
        <div className={`fixed z-[200] transition-all duration-700 ${isMinimized ? 'bottom-8 right-8 w-80' : 'inset-0 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-6'}`}>
          <div className={`bg-white rounded-[3rem] p-10 text-center shadow-4xl relative border-t-8 border-blue-600 animate-in zoom-in-95 ${isMinimized ? 'w-full shadow-2xl' : 'max-w-md w-full p-16'}`}>
             <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 animate-[scan_2s_infinite]"></div>
             <div className={`${isMinimized ? 'w-12 h-12' : 'w-24 h-24'} border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6`}></div>
             <h3 className={`${isMinimized ? 'text-lg' : 'text-3xl'} font-black text-gray-900 mb-2 tracking-tighter italic uppercase`}>
               {batchProgress.total > 0 ? `Batch: ${batchProgress.current}/${batchProgress.total}` : 'Parsing...'}
             </h3>
             <button onClick={() => setIsMinimized(!isMinimized)} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">{isMinimized ? 'Expand' : 'Minimize'}</button>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="max-w-md w-full rounded-[3rem] bg-white p-14 text-center shadow-3xl border-2 border-emerald-500">
             <p className="text-2xl font-black text-gray-900 mb-10 tracking-tighter italic">{notification.message}</p>
             <button onClick={() => setNotification(null)} className="w-full py-6 bg-emerald-600 text-white rounded-2xl font-black text-xl">OK</button>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-100 px-10 py-5 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white"><Icons.FileText /></div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tighter italic uppercase">Expert <span className="text-blue-600">Workflow</span></h1>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest italic">Multi-modal Extraction</p>
          </div>
        </div>
        <div className="flex bg-gray-100 p-1.5 rounded-2xl">
          <button onClick={() => setActiveTab('edit')} className={`px-8 py-3 text-sm font-black rounded-xl transition-all ${activeTab === 'edit' ? 'bg-white shadow-md text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>控制台</button>
          <button onClick={() => setActiveTab('history')} className={`px-8 py-3 text-sm font-black rounded-xl transition-all ${activeTab === 'history' ? 'bg-white shadow-md text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>数据流 ({unifiedHistory.length})</button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {activeTab === 'history' ? (
          <div className="max-w-7xl mx-auto p-16 overflow-y-auto h-full custom-scrollbar">
            <h2 className="text-5xl font-black tracking-tighter italic mb-12 uppercase">实时数据流</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {unifiedHistory.map(item => (
                <div 
                  key={(item as any).id || item.caseId} 
                  onClick={() => { if ((item as any).status === 'draft') { setSelectedDraftIndex(draftCases.findIndex(d => d.id === (item as any).id)); setActiveTab('edit'); } }}
                  className={`bg-white border-2 p-10 rounded-[4rem] shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group cursor-pointer ${ (item as any).status === 'draft' ? 'border-amber-400 bg-amber-50/30' : 'border-transparent hover:border-blue-500' }`}
                >
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`font-black text-3xl ${(item as any).status === 'draft' ? 'text-amber-600' : 'text-blue-600'}`}>{item.caseId}</div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${ (item as any).status === 'draft' ? 'bg-amber-500 text-white animate-pulse' : 'bg-blue-100 text-blue-600' }`}>
                        {(item as any).status === 'draft' ? '待校对' : '已入库'}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 italic font-bold">{item.textSections[0]?.content.substring(0, 100)}...</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full">
            <div className="flex-1 p-12 overflow-y-auto custom-scrollbar">
              <div className="max-w-5xl mx-auto space-y-16 pb-64">
                
                <div className="bg-white border-4 border-blue-500 rounded-[5rem] p-16 shadow-2xl">
                  {queuedImages.length === 0 ? (
                    <div className="grid grid-cols-2 gap-10 py-10">
                      <div onClick={() => pdfInputRef.current?.click()} className="flex flex-col items-center py-20 cursor-pointer bg-blue-50 rounded-[4.5rem] border-4 border-dashed border-blue-200 hover:bg-blue-100 transition-all">
                        <input type="file" ref={pdfInputRef} accept="application/pdf" onChange={handlePDFUpload} className="hidden" />
                        <div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mb-8"><Icons.Book /></div>
                        <h2 className="text-3xl font-black text-blue-900 italic uppercase">PDF 导入</h2>
                      </div>
                      <div onClick={() => aiFileInputRef.current?.click()} className="flex flex-col items-center py-20 cursor-pointer bg-gray-50 rounded-[4.5rem] border-4 border-dashed border-gray-200 hover:bg-white transition-all">
                        <input type="file" ref={aiFileInputRef} multiple accept="image/*" onChange={(e) => {
                          const files = e.target.files;
                          if (files) Array.from(files).forEach((f: File) => {
                            const r = new FileReader();
                            r.onload = () => setQueuedImages(prev => [...prev, { id: uuidv4(), data: (r.result as string).split(',')[1], type: f.type, name: f.name, selected: true }]);
                            r.readAsDataURL(f);
                          });
                        }} className="hidden" />
                        <div className="w-24 h-24 bg-gray-900 text-white rounded-[2.5rem] flex items-center justify-center mb-8"><Icons.Upload /></div>
                        <h2 className="text-3xl font-black text-gray-900 italic uppercase">图片上传</h2>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="flex justify-between items-end mb-12">
                        <div>
                          <h3 className="text-4xl font-black text-blue-900 italic uppercase mb-2">筛选有效页面</h3>
                          <p className="text-blue-500/50 font-black uppercase text-[10px] tracking-widest italic">请剔除封面、目录等无用内容</p>
                        </div>
                        <div className="flex gap-4">
                          <button onClick={() => setAllSelection(true)} className="px-6 py-3 bg-blue-50 text-blue-600 rounded-xl text-xs font-black">全选</button>
                          <button onClick={() => setAllSelection(false)} className="px-6 py-3 bg-gray-100 text-gray-400 rounded-xl text-xs font-black">取消全选</button>
                          <button onClick={() => setQueuedImages([])} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Icons.Trash /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-6 mb-16 max-h-[500px] overflow-y-auto p-6 bg-gray-50 rounded-[2.5rem] custom-scrollbar border-2 border-dashed border-gray-200">
                        {queuedImages.map((img) => (
                          <div 
                            key={img.id} 
                            onClick={() => togglePageSelection(img.id)}
                            className={`relative aspect-[3/4.5] rounded-[1.5rem] overflow-hidden cursor-pointer border-4 transition-all ${img.selected ? 'border-blue-600 scale-100 shadow-xl' : 'border-transparent opacity-40 scale-95 grayscale'}`}
                          >
                            <img src={`data:${img.type};base64,${img.data}`} className="w-full h-full object-cover" />
                            {img.selected && (
                              <div className="absolute top-3 right-3 bg-blue-600 text-white rounded-full p-1 shadow-lg">
                                <Icons.Check />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <button 
                        onClick={processBatchSequentially} 
                        disabled={queuedImages.filter(i => i.selected).length === 0}
                        className="w-full py-10 bg-blue-600 text-white rounded-[3rem] font-black text-4xl hover:bg-blue-700 shadow-3xl uppercase italic disabled:opacity-50"
                      >
                        启动提取 ({queuedImages.filter(i => i.selected).length} 页)
                      </button>
                    </div>
                  )}

                  {draftCases.length > 0 && queuedImages.length === 0 && (
                    <div className="w-full mt-10">
                      <h3 className="text-2xl font-black text-blue-900 italic uppercase mb-6">提取队列</h3>
                      <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar">
                        {draftCases.map((d, i) => (
                          <div key={d.id} onClick={() => setSelectedDraftIndex(i)} className={`flex-shrink-0 relative px-8 py-5 rounded-[1.5rem] font-black cursor-pointer transition-all ${selectedDraftIndex === i ? 'bg-blue-600 text-white shadow-xl' : 'bg-white border-2 border-gray-100 text-gray-400'}`}>
                            {d.caseId}
                            <button onClick={(e) => handleDraftDelete(d.id, e)} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"><Icons.Close /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {currentCase && (
                  <div className="animate-in fade-in slide-in-from-bottom-20 duration-1000">
                    <div className="bg-white p-20 rounded-[5rem] border border-gray-100 shadow-4xl mb-24 relative overflow-hidden">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-16 border-b border-gray-100 pb-16 mb-20">
                        <div className="flex-shrink-0">
                          <label className="text-[12px] font-black text-gray-300 uppercase tracking-[0.4em] mb-4 block italic">Case ID</label>
                          <div className="text-7xl font-black text-blue-600 tracking-tighter">{currentCase.caseId}</div>
                        </div>
                        <div className="flex-1">
                          <label className="text-[12px] font-black text-gray-300 uppercase tracking-[0.4em] mb-4 block italic">Diagnosis Category</label>
                          <select 
                            value={currentCase.organCategory} 
                            onChange={(e) => {
                              const updated = { ...currentCase, organCategory: e.target.value };
                              setDraftCases(prev => prev.map((d, i) => i === selectedDraftIndex ? updated : d));
                              saveToDB(STORE_DRAFTS, updated);
                            }} 
                            className="w-full bg-gray-50 border-4 border-transparent rounded-[2.2rem] px-10 py-7 text-xl font-black focus:border-blue-600 outline-none"
                          >
                            <option value="">MATCH CHAPTER...</option>
                            {ORGAN_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>
                      </div>

                      <section className="mb-24">
                        <h2 className="text-4xl font-black text-gray-900 mb-12 flex items-center gap-6 tracking-tighter italic uppercase"><Icons.FileText /> 文字校核</h2>
                        <div className="space-y-10">
                          {currentCase.textSections.map(s => (
                            <TextEntry 
                              key={s.id} 
                              section={s} 
                              onUpdate={(id, up) => {
                                const updated = { ...currentCase, textSections: currentCase.textSections.map(x => x.id === id ? { ...x, ...up } : x) };
                                setDraftCases(prev => prev.map((d, i) => i === selectedDraftIndex ? updated : d));
                                saveToDB(STORE_DRAFTS, updated);
                              }} 
                              onRemove={(id) => {
                                const updated = { ...currentCase, textSections: currentCase.textSections.filter(x => x.id !== id) };
                                setDraftCases(prev => prev.map((d, i) => i === selectedDraftIndex ? updated : d));
                                saveToDB(STORE_DRAFTS, updated);
                              }} 
                            />
                          ))}
                        </div>
                      </section>

                      <section className="mb-24">
                        <h2 className="text-4xl font-black text-gray-900 mb-12 flex items-center gap-6 tracking-tighter italic uppercase"><Icons.Image /> 视觉子图校核 ({currentCase.images.length})</h2>
                        <div className="grid grid-cols-1 gap-14">
                          {currentCase.images.map(img => (
                            <ImageEntry 
                              key={img.id} 
                              image={img} 
                              onUpdate={(id, up) => {
                                const updated = { ...currentCase, images: currentCase.images.map(x => x.id === id ? { ...x, ...up } : x) };
                                setDraftCases(prev => prev.map((d, i) => i === selectedDraftIndex ? updated : d));
                                saveToDB(STORE_DRAFTS, updated);
                              }} 
                              onRemove={(id) => {
                                const updated = { ...currentCase, images: currentCase.images.filter(x => x.id !== id) };
                                setDraftCases(prev => prev.map((d, i) => i === selectedDraftIndex ? updated : d));
                                saveToDB(STORE_DRAFTS, updated);
                              }} 
                            />
                          ))}
                        </div>
                      </section>

                      <div className="flex justify-center pt-16 border-t border-gray-100">
                        <button onClick={handleCaseSubmit} className="px-48 py-10 bg-emerald-600 text-white rounded-[3.5rem] font-black text-4xl hover:bg-emerald-700 shadow-3xl uppercase italic tracking-tighter">确认存档</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {currentCase && <div className="w-[600px] border-l border-gray-100 bg-white p-14 hidden 2xl:block"><JSONPreview data={currentCase} /></div>}
          </div>
        )}
      </main>

      <style>{`
        @keyframes scan { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; border: 3px solid transparent; background-clip: content-box; }
        .shadow-4xl { box-shadow: 0 50px 100px -20px rgba(0, 0, 0, 0.4); }
      `}</style>
    </div>
  );
};

export default App;
