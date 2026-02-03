
import React from 'react';
import { ImageRecord, ImageType, Magnification } from '../types';
import { MAGNIFICATIONS, Icons } from '../constants';

interface ImageEntryProps {
  image: ImageRecord;
  onUpdate: (id: string, updates: Partial<ImageRecord>) => void;
  onRemove: (id: string) => void;
}

export const ImageEntry: React.FC<ImageEntryProps> = ({ image, onUpdate, onRemove }) => {
  const isDescriptionEmpty = !image.description.trim();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group relative flex gap-6 mb-4">
      <button 
        onClick={() => onRemove(image.id)}
        className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
        title="移除"
      >
        <Icons.Trash />
      </button>

      <div className="w-48 h-48 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 relative group/img">
        <img 
          src={image.url} 
          alt="Preview" 
          className="w-full h-full object-cover transition-transform group-hover/img:scale-105" 
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-xs font-medium">预览</span>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">染色类型</label>
            <div className="flex gap-2">
              {[ImageType.HE, ImageType.IHC].map(type => (
                <button
                  key={type}
                  onClick={() => onUpdate(image.id, { type })}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                    image.type === type 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">放大倍率</label>
            <select
              value={image.magnification}
              onChange={(e) => onUpdate(image.id, { magnification: e.target.value as Magnification })}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {MAGNIFICATIONS.map(mag => (
                <option key={mag} value={mag}>{mag}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            图片描述 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={image.description}
            onChange={(e) => onUpdate(image.id, { description: e.target.value })}
            placeholder="必填：描述图片显示的内容，如：显示明显的乳头结构，间质硬化..."
            className={`w-full bg-white border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${
              isDescriptionEmpty ? 'border-amber-200 bg-amber-50/20' : 'border-gray-300'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
