
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CaseRecord, TextRecord, ImageRecord, TextLabel, ImageType, Magnification, REQUIRED_TEXT_LABELS, User, UserRole } from './types';
import { TextEntry } from './components/TextEntry';
import { ImageEntry } from './components/ImageEntry';
import { JSONPreview } from './components/JSONPreview';
import { Icons, ORGAN_CATEGORIES } from './constants';

// --- Database Layer ---
const DB_NAME = 'PathologyDataPlatform';
const STORE_CASES = 'cases';
const STORE_USERS = 'users';
const DB_VERSION = 3;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CASES)) {
        db.createObjectStore(STORE_CASES, { keyPath: 'caseId' });
      }
      if (!db.objectStoreNames.contains(STORE_USERS)) {
        db.createObjectStore(STORE_USERS, { keyPath: 'username' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveCaseToDB = async (caseData: CaseRecord): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_CASES, 'readwrite');
    const store = transaction.objectStore(STORE_CASES);
    const request = store.put(caseData);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getAllCasesFromDB = async (): Promise<CaseRecord[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_CASES, 'readonly');
    const store = transaction.objectStore(STORE_CASES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveUserToDB = async (userData: User): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_USERS, 'readwrite');
    const store = transaction.objectStore(STORE_USERS);
    const request = store.put(userData);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getUserFromDB = async (username: string): Promise<User | undefined> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_USERS, 'readonly');
    const store = transaction.objectStore(STORE_USERS);
    const request = store.get(username);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getAllUsersFromDB = async (): Promise<User[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_USERS, 'readonly');
    const store = transaction.objectStore(STORE_USERS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deleteUserFromDB = async (username: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_USERS, 'readwrite');
    const store = transaction.objectStore(STORE_USERS);
    const request = store.delete(username);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- Components ---

const Login: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showRegisterPortal, setShowRegisterPortal] = useState(false);
  const [adminAuth, setAdminAuth] = useState({ username: '', password: '' });
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  // Default Admin Account Logic: qiaochu / 123456
  useEffect(() => {
    const ensureDefaultAdmin = async () => {
      const admin = await getUserFromDB('qiaochu');
      if (!admin) {
        await saveUserToDB({
          id: uuidv4(),
          username: 'qiaochu',
          password: '123456',
          role: UserRole.ADMIN
        });
      }
    };
    ensureDefaultAdmin();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedName = username.trim();
    if (!trimmedName) return;

    const user = await getUserFromDB(trimmedName);
    if (user) {
      if (user.password && user.password !== password) {
        setError('密码错误，请重试。');
        return;
      }
      onLogin(user);
    } else {
      setError('用户名未注册，请联系管理员。');
    }
  };

  const handleVerifyAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // The user explicitly stated: initial admin qiaochu/123456
    if (adminAuth.username === 'qiaochu' && adminAuth.password === '123456') {
      setIsAdminVerified(true);
      return;
    }
    
    // Also check other admins in DB
    const user = await getUserFromDB(adminAuth.username);
    if (user && user.role === UserRole.ADMIN && user.password === adminAuth.password) {
      setIsAdminVerified(true);
    } else {
      setError('管理员身份验证失败。');
    }
  };

  if (showRegisterPortal) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-[2.5rem] shadow-2xl p-12 animate-in zoom-in-95 duration-500">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-gray-900 tracking-tighter">成员注册/管理</h2>
            <button onClick={() => { setShowRegisterPortal(false); setIsAdminVerified(false); setError(''); }} className="p-2 text-gray-400 hover:text-rose-500 transition-colors">
              <Icons.Close />
            </button>
          </div>

          {!isAdminVerified ? (
            <form onSubmit={handleVerifyAdmin} className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-xs text-amber-700 font-bold leading-relaxed">
                  注册新成员需要管理员权限。
                  <br />
                  <span className="text-[10px] opacity-75">初始管理员: qiaochu / 123456</span>
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">管理员账号</label>
                <input 
                  type="text" 
                  required
                  value={adminAuth.username}
                  onChange={e => setAdminAuth({...adminAuth, username: e.target.value})}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">管理员密码</label>
                <input 
                  type="password" 
                  required
                  value={adminAuth.password}
                  onChange={e => setAdminAuth({...adminAuth, password: e.target.value})}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold focus:border-blue-500 outline-none"
                />
              </div>
              {error && <p className="text-rose-500 text-[10px] font-black px-1">{error}</p>}
              <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100">
                验证身份并进入
              </button>
            </form>
          ) : (
            <UserManagement standalone />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-12 animate-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-100">
            <Icons.FileText />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tighter">病理标注平台</h1>
          <p className="text-sm text-gray-400 font-bold mt-2 uppercase tracking-widest">Dataset Annotation System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">您的姓名/工号</label>
            <input 
              required
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入您的姓名..."
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">登录密码</label>
            <input 
              required
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码..."
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
            />
            {error && <p className="mt-2 text-rose-500 text-[10px] font-black px-1">{error}</p>}
          </div>
          <button 
            type="submit"
            className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-lg hover:bg-black active:scale-95 transition-all shadow-xl mt-4"
          >
            进入工作台
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-gray-100 text-center">
          <button 
            onClick={() => setShowRegisterPortal(true)}
            className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 w-full py-2 hover:bg-blue-50 rounded-xl"
          >
            <Icons.Plus /> 管理员入口：注册新成员
          </button>
        </div>
      </div>
    </div>
  );
};

const UserManagement: React.FC<{ standalone?: boolean }> = ({ standalone }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.USER);

  const loadUsers = async () => {
    const list = await getAllUsersFromDB();
    setUsers(list);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPassword.trim()) return;
    const existing = await getUserFromDB(newName.trim());
    if (existing) {
      alert('该用户名已注册！');
      return;
    }
    const newUser: User = { 
      id: uuidv4(), 
      username: newName.trim(), 
      password: newPassword, 
      role: newRole 
    };
    await saveUserToDB(newUser);
    setNewName('');
    setNewPassword('');
    loadUsers();
  };

  const handleDelete = async (username: string) => {
    if (username === 'qiaochu') {
      alert('初始管理员账号无法删除。');
      return;
    }
    if (confirm(`确定要删除用户 "${username}" 吗？`)) {
      await deleteUserFromDB(username);
      loadUsers();
    }
  };

  return (
    <div className={standalone ? "" : "max-w-4xl mx-auto p-12"}>
      <div className={standalone ? "mb-8" : "mb-12"}>
        <h2 className={standalone ? "text-xl font-black text-gray-900" : "text-3xl font-black text-gray-900 tracking-tighter"}>成员权限管理</h2>
        <p className="text-sm text-gray-400 mt-2 font-medium">只有在系统中备案的成员才能登录工作平台。</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-[2.5rem] p-8 mb-10 shadow-sm border-2 border-blue-50">
        <h3 className="text-xs font-black text-gray-800 uppercase mb-6 flex items-center gap-2 tracking-widest">
          <Icons.Plus /> 注册新标注员/管理员
        </h3>
        <form onSubmit={handleAddUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              type="text" 
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="姓名/工号 (作为登录名)..."
              className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none transition-all"
            />
            <input 
              type="password" 
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="设置登录初始密码..."
              className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex gap-4">
            <select 
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold outline-none cursor-pointer"
            >
              <option value={UserRole.USER}>普通标注员 (User)</option>
              <option value={UserRole.ADMIN}>系统管理员 (Admin)</option>
            </select>
            <button type="submit" className="bg-blue-600 text-white px-10 py-3 rounded-xl font-black text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95">
              立即注册
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">成员名单 ({users.length})</h3>
        <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
          {users.map(u => (
            <div key={u.id} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center justify-between hover:bg-white hover:border-blue-100 transition-all group">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${u.role === UserRole.ADMIN ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-500'}`}>
                  {u.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-black text-sm text-gray-900">{u.username}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{u.role}</span>
                    <span className="text-[10px] text-gray-300">•</span>
                    <span className="text-[10px] text-gray-300 font-mono">ID: {u.id.slice(0,8)}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleDelete(u.username)}
                className="p-2 text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                title="删除成员"
              >
                <Icons.Trash />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [caseData, setCaseData] = useState<CaseRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'history' | 'users'>('edit');
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'warning', message: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalHistory, setGlobalHistory] = useState<CaseRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initNewCase = (currentUser: User) => ({
    caseId: `CASE-${Date.now().toString().slice(-6)}`,
    userId: currentUser.id,
    username: currentUser.username,
    organCategory: '',
    textSections: [],
    images: []
  });

  const loadHistory = async () => {
    try {
      const cases = await getAllCasesFromDB();
      setGlobalHistory(cases.sort((a, b) => 
        new Date(b.submittedAt || b.updatedAt || 0).getTime() - 
        new Date(a.submittedAt || a.updatedAt || 0).getTime()
      ));
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  const history = useMemo(() => {
    if (!user) return [];
    if (user.role === UserRole.ADMIN) return globalHistory;
    return globalHistory.filter(c => c.username === user.username);
  }, [globalHistory, user]);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const query = searchQuery.toLowerCase();
    return history.filter(item => 
      item.caseId.toLowerCase().includes(query) || 
      item.organCategory.toLowerCase().includes(query) ||
      (user?.role === UserRole.ADMIN && item.username?.toLowerCase().includes(query))
    );
  }, [history, searchQuery, user]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (activeTab !== 'edit' || !user) return;
      const items = event.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64 = e.target?.result as string;
              addImage(base64, blob.name || 'pasted-image.png');
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab, user]);

  if (!user) {
    return <Login onLogin={(u) => {
      setUser(u);
      setCaseData(initNewCase(u));
    }} />;
  }

  const checkDuplicates = (field: 'caseId' | 'patientData', value: string) => {
    if (!value.trim()) return;
    
    if (field === 'caseId') {
      const isDuplicate = globalHistory.some(c => c.caseId === value && c.caseId !== caseData?.caseId);
      if (isDuplicate) {
        setNotification({ type: 'error', message: `Case ID "${value}" 已被他人占用，请使用唯一标识符！` });
      }
    } else {
      const similarCase = globalHistory.find(c => {
        const patientSection = c.textSections.find(s => s.label === TextLabel.PATIENT_DATA);
        return patientSection && patientSection.content.trim() === value.trim() && c.caseId !== caseData?.caseId;
      });
      if (similarCase) {
        setNotification({ 
          type: 'warning', 
          message: `查重提醒：系统发现 "${similarCase.caseId}" 已录入相同病人资料（录入人：${similarCase.username || '匿名'}）。\n为避免重复标注，请核实后再继续。` 
        });
      }
    }
  };

  const addTextSection = () => {
    if (!caseData) return;
    const newSection: TextRecord = { id: uuidv4(), label: TextLabel.PATIENT_DATA, content: '' };
    setCaseData(prev => prev ? ({ ...prev, textSections: [...prev.textSections, newSection] }) : null);
  };

  const updateTextSection = (id: string, updates: Partial<TextRecord>) => {
    if (!caseData) return;
    const section = caseData.textSections.find(s => s.id === id);
    if (section?.label === TextLabel.PATIENT_DATA && updates.content) {
      checkDuplicates('patientData', updates.content);
    }
    setCaseData(prev => prev ? ({
      ...prev,
      textSections: prev.textSections.map(s => s.id === id ? { ...s, ...updates } : s)
    }) : null);
  };

  const removeTextSection = (id: string) => {
    setCaseData(prev => prev ? ({ ...prev, textSections: prev.textSections.filter(s => s.id !== id) }) : null);
  };

  const addImage = (url: string, fileName: string) => {
    const newImage: ImageRecord = {
      id: uuidv4(),
      url,
      fileName,
      type: ImageType.HE,
      magnification: Magnification.X20,
      description: ''
    };
    setCaseData(prev => prev ? ({ ...prev, images: [...prev.images, newImage] }) : null);
  };

  const updateImage = (id: string, updates: Partial<ImageRecord>) => {
    setCaseData(prev => prev ? ({
      ...prev,
      images: prev.images.map(img => img.id === id ? { ...img, ...updates } : img)
    }) : null);
  };

  const removeImage = (id: string) => {
    setCaseData(prev => prev ? ({ ...prev, images: prev.images.filter(img => img.id !== id) }) : null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    (Array.from(files) as File[]).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => addImage(event.target?.result as string, file.name);
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateCase = (): { valid: boolean; errors: string[] } => {
    if (!caseData) return { valid: false, errors: ['数据异常'] };
    const errors: string[] = [];
    
    if (globalHistory.some(c => c.caseId === caseData.caseId && c.submittedAt && !history.includes(c))) {
      errors.push('Case ID 已在库中存在（可能由其他用户录入），请更换 ID。');
    }

    if (!caseData.organCategory) errors.push('请选择章节分类。');

    const presentLabels = new Set();
    caseData.textSections.forEach(s => {
      if (s.content.trim()) presentLabels.add(s.label);
    });

    REQUIRED_TEXT_LABELS.forEach(label => {
      if (!presentLabels.has(label)) errors.push(`缺少必填板块：${label}`);
    });

    const heCount = caseData.images.filter(img => img.type === ImageType.HE).length;
    if (heCount < 2) errors.push(`HE 图片数量不足 (当前:${heCount}/至少2)。`);

    if (caseData.images.some(img => !img.description.trim())) errors.push('所有图片描述均不能为空。');

    return { valid: errors.length === 0, errors };
  };

  const handleSubmit = async () => {
    const { valid, errors } = validateCase();
    if (!valid) {
      setNotification({ type: 'error', message: errors.join('\n') });
      return;
    }

    try {
      const isNew = !globalHistory.some(item => item.caseId === caseData?.caseId);
      const dataToSave = {
        ...caseData!,
        [isNew ? 'submittedAt' : 'updatedAt']: new Date().toISOString()
      };

      await saveCaseToDB(dataToSave);
      setNotification({ type: 'success', message: '保存成功！' });
      await loadHistory();
      if (isNew) setTimeout(() => startNewCase(), 1500);
    } catch (err) {
      setNotification({ type: 'error', message: '数据库写入失败' });
    }
  };

  const startNewCase = () => {
    setCaseData(initNewCase(user));
    setActiveTab('edit');
    setNotification(null);
  };

  const exportAllToCSV = () => {
    if (user.role !== UserRole.ADMIN) return;
    const headers = ['CaseID', 'Creator', 'Organ', 'SubmittedAt', 'TextBlocks', 'HE_Count', 'IHC_Count'];
    const rows = globalHistory.map(c => [
      c.caseId,
      c.username || 'N/A',
      c.organCategory,
      c.submittedAt || '',
      c.textSections.length,
      c.images.filter(i => i.type === ImageType.HE).length,
      c.images.filter(i => i.type === ImageType.IHC).length
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pathology_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const handleLogout = () => {
    setUser(null);
    setCaseData(null);
    setActiveTab('edit');
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {notification && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`max-w-md w-full rounded-2xl shadow-2xl bg-white border-2 ${
            notification.type === 'success' ? 'border-emerald-500' : notification.type === 'warning' ? 'border-amber-500' : 'border-rose-500'
          }`}>
            <div className={`px-6 py-4 flex items-center gap-3 border-b ${
              notification.type === 'success' ? 'bg-emerald-50 text-emerald-700' : notification.type === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {notification.type === 'success' ? <Icons.Check /> : <Icons.Alert />}
              <h3 className="font-bold text-lg">
                {notification.type === 'success' ? '操作成功' : notification.type === 'warning' ? '查重警告' : '验证不通过'}
              </h3>
            </div>
            <div className="p-8">
              <p className="text-sm leading-relaxed whitespace-pre-line text-gray-700">{notification.message}</p>
              <button 
                onClick={() => setNotification(null)}
                className={`mt-8 w-full py-4 rounded-xl font-black transition-all ${
                  notification.type === 'success' ? 'bg-emerald-600 text-white' : notification.type === 'warning' ? 'bg-amber-600 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                好的
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100"><Icons.FileText /></div>
          <div>
            <h1 className="text-xl font-black text-gray-900">病理标注 · {user.username}</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{user.role}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative mr-4 hidden md:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400"><Icons.Search /></div>
            <input
              type="text"
              placeholder="搜索 Case ID 或 章节..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 w-64 transition-all"
            />
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl mr-4">
            <button onClick={() => setActiveTab('edit')} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'edit' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>工作台</button>
            <button onClick={() => setActiveTab('history')} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>数据库({history.length})</button>
            {user.role === UserRole.ADMIN && (
              <button onClick={() => setActiveTab('users')} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'users' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>成员管理</button>
            )}
          </div>
          
          {user.role === UserRole.ADMIN && (
            <button onClick={exportAllToCSV} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-black hover:bg-black transition-all shadow-lg active:scale-95">
              <Icons.Download /> 导出全量
            </button>
          )}

          <div className="h-8 w-[1px] bg-gray-200 mx-2" />

          <button 
            onClick={handleLogout} 
            className="flex items-center gap-2 px-4 py-2.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all text-sm font-bold group"
            title="退出登录"
          >
            <div className="group-hover:rotate-12 transition-transform"><Icons.LogOut /></div>
            <span>退出</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {activeTab === 'users' && user.role === UserRole.ADMIN && <UserManagement />}

          {activeTab === 'history' && (
            <div className="max-w-6xl mx-auto p-12 animate-in fade-in slide-in-from-bottom-4">
              <div className="mb-10">
                <h2 className="text-3xl font-black text-gray-900 tracking-tighter flex items-center gap-3"><Icons.History /> {user.role === UserRole.ADMIN ? '系统全量数据' : '我的标注记录'}</h2>
                <p className="text-sm text-gray-400 mt-2 font-medium italic">共检索到 {filteredHistory.length} 份标准病理数据集</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredHistory.map((item) => (
                  <div key={item.caseId} className="bg-white border border-gray-200 rounded-[2rem] p-6 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all flex flex-col h-full group border-2 border-transparent hover:border-blue-100">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-xl text-blue-600 tracking-tighter truncate">#{item.caseId}</div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-gray-400 font-black uppercase px-2 py-0.5 bg-gray-100 rounded tracking-widest">{item.organCategory || '未分类'}</span>
                          {user.role === UserRole.ADMIN && <span className="text-[10px] text-blue-500 font-black bg-blue-50 px-2 py-0.5 rounded uppercase">@{item.username}</span>}
                        </div>
                      </div>
                      <button onClick={() => {setCaseData(item); setActiveTab('edit');}} className="p-3 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"><Icons.Edit /></button>
                    </div>
                    <div className="flex-1 mb-8">
                      <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed font-medium">
                        {item.textSections.find(s => s.label === TextLabel.PATIENT_DATA)?.content || "暂无预览..."}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                      <div className="flex gap-1.5">
                        <span className="bg-pink-50 text-pink-600 text-[10px] font-black px-2.5 py-1 rounded-lg">{item.images.filter(img => img.type === ImageType.HE).length} HE</span>
                        <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2.5 py-1 rounded-lg">{item.textSections.length} BLKS</span>
                      </div>
                      <span className="text-[10px] text-gray-300 font-black">{new Date(item.submittedAt || 0).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(activeTab === 'edit' && caseData) && (
            <div className="flex h-full overflow-hidden animate-in fade-in">
              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-16 pb-40">
                  <div className="bg-white p-10 rounded-[2.5rem] border border-gray-200 shadow-sm space-y-10 border-b-8 border-b-blue-600/10">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-8">
                      <div className="flex items-center gap-5 flex-1">
                        <div className="w-14 h-14 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center border border-gray-100"><Icons.FileText /></div>
                        <div className="flex-1">
                          <label className="block text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Unique Case Identifier</label>
                          <input 
                            type="text" 
                            value={caseData.caseId} 
                            onBlur={(e) => checkDuplicates('caseId', e.target.value)}
                            onChange={(e) => setCaseData({...caseData, caseId: e.target.value})}
                            className="bg-transparent text-gray-900 border-none focus:ring-0 text-3xl font-black p-0 w-full tracking-tighter"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                         <span className="text-[10px] text-gray-400 font-black uppercase mb-2 tracking-widest">Job Integrity</span>
                         <div className="flex gap-1.5">
                            {REQUIRED_TEXT_LABELS.map((_, i) => (
                              <div key={i} className={`w-4 h-2 rounded-full transition-all duration-500 ${i < caseData.textSections.filter(s => s.content.trim()).length ? 'bg-emerald-500 w-6' : 'bg-gray-200'}`} />
                            ))}
                            <div className={`w-4 h-2 rounded-full transition-all duration-500 ${caseData.images.filter(img => img.type === ImageType.HE).length >= 2 ? 'bg-pink-500 w-6' : 'bg-gray-200'}`} />
                         </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-gray-900 text-white rounded-lg flex items-center justify-center text-[10px]">1</span>
                        章节/器官分类 <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={caseData.organCategory}
                        onChange={(e) => setCaseData({...caseData, organCategory: e.target.value})}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold focus:border-blue-500 outline-none transition-all cursor-pointer hover:bg-white"
                      >
                        <option value="">点击展开分类列表...</option>
                        {ORGAN_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                  </div>

                  <section>
                    <div className="mb-8 flex items-center justify-between">
                      <h2 className="text-xl font-black text-gray-900 flex items-center gap-3 tracking-tight"><Icons.FileText /> 2. 文字数据录入 (Labels)</h2>
                    </div>
                    <div className="space-y-6">
                      {caseData.textSections.map(s => (
                        <TextEntry key={s.id} section={s} onUpdate={updateTextSection} onRemove={removeTextSection} />
                      ))}
                      <button onClick={addTextSection} className="w-full py-6 border-2 border-dashed border-gray-200 rounded-[2rem] flex flex-col items-center justify-center bg-white hover:bg-blue-50 hover:border-blue-200 transition-all group">
                        <div className="flex items-center gap-3 font-black group-active:scale-95 transition-all text-blue-500"><Icons.Plus /> <span>添加新的文本内容板块</span></div>
                      </button>
                    </div>
                  </section>

                  <section>
                    <div className="mb-8 flex items-center justify-between">
                      <h2 className="text-xl font-black text-gray-900 flex items-center gap-3 tracking-tight"><Icons.Image /> 3. 图像数据标注 (Pathology)</h2>
                      <div className="text-[10px] font-black text-gray-400 uppercase bg-gray-100 px-3 py-1 rounded-full">Supports Pasting (Ctrl+V)</div>
                    </div>
                    <input type="file" ref={fileInputRef} multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
                    <div className="space-y-6">
                      {caseData.images.map(img => <ImageEntry key={img.id} image={img} onUpdate={updateImage} onRemove={removeImage} />)}
                      <button onClick={() => fileInputRef.current?.click()} className="w-full py-10 border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center bg-white hover:bg-indigo-50 hover:border-indigo-200 transition-all group shadow-sm">
                        <div className="w-14 h-14 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all group-active:scale-90"><Icons.Plus /></div>
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest group-hover:text-indigo-600">批量上传或拖拽图片到此</span>
                      </button>
                    </div>
                  </section>

                  <div className="bg-white border border-gray-200 rounded-[3rem] p-12 flex flex-col items-center text-center shadow-2xl border-t-8 border-t-emerald-500">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner"><Icons.Check /></div>
                    <h3 className="text-3xl font-black text-gray-900 tracking-tighter mb-4">准备好提交数据了吗？</h3>
                    <p className="text-sm text-gray-500 mb-10 max-w-md font-medium">数据保存后将永久存储在数据库中，您可以随时在“数据库”中查看或导出。</p>
                    <div className="flex gap-5 w-full max-w-lg">
                      <button onClick={handleSubmit} className="flex-1 py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 active:scale-95 transition-all shadow-xl shadow-emerald-100">确认并保存</button>
                      <button onClick={startNewCase} className="px-10 py-5 bg-gray-100 text-gray-600 rounded-2xl font-black hover:bg-gray-200 transition-all">开启新病例</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-[480px] border-l border-gray-200 bg-gray-50 p-8 overflow-y-auto hidden lg:block custom-scrollbar">
                <JSONPreview data={caseData} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
