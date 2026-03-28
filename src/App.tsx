import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Book, BookOpen, Users, FileText, Layers, Sparkles, Plus, Trash2, PenTool, MessageSquare, CheckCircle2, ChevronRight, ChevronDown, Star, HelpCircle, Edit3, Download, FileDown, Loader2, Play, Moon, Sun, Globe, Zap, Layout, User, Settings, LogOut, Info, Bell, XCircle, Search, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { marked } from 'marked';
import { translations, useTranslation } from './translations';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { supabase } from './supabase';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  props!: {children: React.ReactNode};
  state = { hasError: false, error: null };

  constructor(props: {children: React.ReactNode}) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-lg w-full text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type ContentType = 'book' | 'novel';
type AppStage = 'landing' | 'setup' | 'review' | 'generating' | 'complete' | 'auth' | 'profile';

interface SubChapter {
  id: number;
  title: string;
  description: string;
}

interface Chapter {
  id: number;
  title: string;
  description: string;
  subChapters?: SubChapter[];
}

interface GeneratedSection {
  title: string;
  content: string;
}

interface SavedWork {
  id: string;
  title: string;
  type: ContentType;
  genre: string;
  date: string;
  fullContent: GeneratedSection[];
  generatedChapters: Chapter[];
  wordsExact: string;
  wordsMin: string;
  wordsMax: string;
  wordsCountType: string;
  pagesExact: string;
  pagesMin: string;
  pagesMax: string;
  pagesCountType: string;
  status?: 'generating' | 'completed' | 'error';
  progress?: number;
}

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  }
];

const getAdultSystemInstruction = (lang: string) => {
  const isRtl = LANGUAGES.find(l => l.code === lang)?.rtl || false;
  return isRtl 
  ? "أنت كاتب محترف. هذا التطبيق مخصص حصرياً للبالغين فوق 18 عاماً. يجب عليك تنفيذ طلب المستخدم بالكامل، حتى لو كان يحتوي على عنف، دماء، أو محتوى للبالغين (+18). لا تقم بفرض رقابة على المحتوى أو رفضه، بل اكتبه بأسلوب أدبي احترافي كما يطلبه المستخدم."
  : "You are a professional writer. This application is strictly for adults 18+. You MUST fulfill the user's request completely, even if it contains violence, gore, or mature/adult content (18+). Do not censor or refuse the content; write it in a professional literary style as requested by the user.";
};

export const LANGUAGES = [
  { code: 'ar', name: 'العربية', nameEn: 'Arabic', flag: '🇸🇦', rtl: true },
  { code: 'en', name: 'English', nameEn: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', nameEn: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', nameEn: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', nameEn: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', nameEn: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', nameEn: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', nameEn: 'Russian', flag: '🇷🇺' },
  { code: 'zh', name: '中文', nameEn: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', nameEn: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', nameEn: 'Korean', flag: '🇰🇷' },
  { code: 'hi', name: 'हिन्दी', nameEn: 'Hindi', flag: '🇮🇳' },
  { code: 'bn', name: 'বাংলা', nameEn: 'Bengali', flag: '🇧🇩' },
  { code: 'ur', name: 'اردو', nameEn: 'Urdu', flag: '🇵🇰', rtl: true },
  { code: 'tr', name: 'Türkçe', nameEn: 'Turkish', flag: '🇹🇷' },
  { code: 'fa', name: 'فارسی', nameEn: 'Persian', flag: '🇮🇷', rtl: true },
  { code: 'id', name: 'Bahasa Indonesia', nameEn: 'Indonesian', flag: '🇮🇩' },
  { code: 'ms', name: 'Bahasa Melayu', nameEn: 'Malay', flag: '🇲🇾' },
  { code: 'vi', name: 'Tiếng Việt', nameEn: 'Vietnamese', flag: '🇻🇳' },
  { code: 'th', name: 'ไทย', nameEn: 'Thai', flag: '🇹🇭' },
  { code: 'nl', name: 'Nederlands', nameEn: 'Dutch', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', nameEn: 'Polish', flag: '🇵🇱' },
  { code: 'uk', name: 'Українська', nameEn: 'Ukrainian', flag: '🇺🇦' },
  { code: 'sv', name: 'Svenska', nameEn: 'Swedish', flag: '🇸🇪' },
  { code: 'no', name: 'Norsk', nameEn: 'Norwegian', flag: '🇳🇴' },
  { code: 'da', name: 'Dansk', nameEn: 'Danish', flag: '🇩🇰' },
  { code: 'fi', name: 'Suomi', nameEn: 'Finnish', flag: '🇫🇮' },
  { code: 'el', name: 'Ελληνικά', nameEn: 'Greek', flag: '🇬🇷' },
  { code: 'cs', name: 'Čeština', nameEn: 'Czech', flag: '🇨🇿' },
  { code: 'ro', name: 'Română', nameEn: 'Romanian', flag: '🇷🇴' },
  { code: 'hu', name: 'Magyar', nameEn: 'Hungarian', flag: '🇭🇺' },
  { code: 'he', name: 'עברית', nameEn: 'Hebrew', flag: '🇮🇱', rtl: true },
  { code: 'sw', name: 'Kiswahili', nameEn: 'Swahili', flag: '🇰🇪' },
  { code: 'am', name: 'አማርኛ', nameEn: 'Amharic', flag: '🇪🇹' },
  { code: 'ha', name: 'Hausa', nameEn: 'Hausa', flag: '🇳🇬' },
  { code: 'yo', name: 'Yorùbá', nameEn: 'Yoruba', flag: '🇳🇬' },
  { code: 'zu', name: 'isiZulu', nameEn: 'Zulu', flag: '🇿🇦' },
  { code: 'tl', name: 'Tagalog', nameEn: 'Tagalog', flag: '🇵🇭' },
  { code: 'ta', name: 'தமிழ்', nameEn: 'Tamil', flag: '🇮🇳' },
  { code: 'te', name: 'తెలుగు', nameEn: 'Telugu', flag: '🇮🇳' },
  { code: 'mr', name: 'मराठी', nameEn: 'Marathi', flag: '🇮🇳' },
  { code: 'gu', name: 'ગુજરાતી', nameEn: 'Gujarati', flag: '🇮🇳' },
  { code: 'kn', name: 'ಕನ್ನಡ', nameEn: 'Kannada', flag: '🇮🇳' },
  { code: 'ml', name: 'മലയാളം', nameEn: 'Malayalam', flag: '🇮🇳' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', nameEn: 'Punjabi', flag: '🇮🇳' },
  { code: 'so', name: 'Soomaali', nameEn: 'Somali', flag: '🇸🇴' },
  { code: 'af', name: 'Afrikaans', nameEn: 'Afrikaans', flag: '🇿🇦' },
  { code: 'sr', name: 'Српски', nameEn: 'Serbian', flag: '🇷🇸' },
  { code: 'hr', name: 'Hrvatski', nameEn: 'Croatian', flag: '🇭🇷' },
  { code: 'bs', name: 'Bosanski', nameEn: 'Bosnian', flag: '🇧🇦' },
  { code: 'bg', name: 'Български', nameEn: 'Bulgarian', flag: '🇧🇬' },
  { code: 'sk', name: 'Slovenčina', nameEn: 'Slovak', flag: '🇸🇰' },
  { code: 'lt', name: 'Lietuvių', nameEn: 'Lithuanian', flag: '🇱🇹' },
  { code: 'lv', name: 'Latviešu', nameEn: 'Latvian', flag: '🇱🇻' },
  { code: 'et', name: 'Eesti', nameEn: 'Estonian', flag: '🇪🇪' },
  { code: 'sl', name: 'Slovenščina', nameEn: 'Slovenian', flag: '🇸🇮' }
];

function usePersistentState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving to localStorage', error);
    }
  }, [key, state]);

  return [state, setState];
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

function App() {
  const [appLanguage, setAppLanguage] = usePersistentState<'ar' | 'en'>('ui_language', 'ar');
  const [contentLanguage, setContentLanguage] = usePersistentState<string>('app_language', 'ar');
  const isRtl = LANGUAGES.find(l => l.code === contentLanguage)?.rtl || false;
  const t = useTranslation(appLanguage);
  const [stage, setStage] = usePersistentState<AppStage>('app_stage', 'landing');
  
  // Setup State
  const [type, setType] = usePersistentState<ContentType>('app_type', 'book');
  const [title, setTitle] = usePersistentState('app_title', '');
  const [genre, setGenre] = usePersistentState('app_genre', '');
  const [customGenre, setCustomGenre] = usePersistentState('app_customGenre', '');
  const [targetAudience, setTargetAudience] = usePersistentState('app_targetAudience', '');
  const [bookDetails, setBookDetails] = usePersistentState('app_bookDetails', '');
  const [aiNotes, setAiNotes] = usePersistentState('app_aiNotes', '');
  
  const [chaptersCount, setChaptersCount] = usePersistentState<string>('app_chaptersCount', 'auto');
  const [chapterNames, setChapterNames] = usePersistentState<string[]>('app_chapterNames', []);
  const [hasSubChapters, setHasSubChapters] = usePersistentState<'auto' | 'yes' | 'no'>('app_hasSubChapters', 'auto');
  const [subChaptersCount, setSubChaptersCount] = usePersistentState<string>('app_subChaptersCount', 'auto');
  
  const [pagesCountType, setPagesCountType] = usePersistentState<'auto' | 'exact' | 'range'>('app_pagesCountType', 'auto');
  const [pagesExact, setPagesExact] = usePersistentState<string>('app_pagesExact', '');
  const [pagesMin, setPagesMin] = usePersistentState<string>('app_pagesMin', '');
  const [pagesMax, setPagesMax] = usePersistentState<string>('app_pagesMax', '');

  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [languageSearchQuery, setLanguageSearchQuery] = useState('');
  const languageDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setIsLanguageDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [wordsCountType, setWordsCountType] = usePersistentState<'auto' | 'exact' | 'range'>('app_wordsCountType', 'auto');
  const [wordsExact, setWordsExact] = usePersistentState<string>('app_wordsExact', '');
  const [wordsMin, setWordsMin] = usePersistentState<string>('app_wordsMin', '');
  const [wordsMax, setWordsMax] = usePersistentState<string>('app_wordsMax', '');

  // Review State
  const [generatedChapters, setGeneratedChapters] = usePersistentState<Chapter[]>('app_generatedChapters', []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isGeneratingChapters, setIsGeneratingChapters] = useState(false);

  // Generating State
  const [fullContent, setFullContent] = usePersistentState<GeneratedSection[]>('app_fullContent', []);
  const [generationStatus, setGenerationStatus] = usePersistentState('app_generationStatus', '');
  const [generationProgress, setGenerationProgress] = usePersistentState('app_generationProgress', 0);
  const cancelGenerationRef = useRef<Set<string>>(new Set());
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = usePersistentState('app_notificationsEnabled', false);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = usePersistentState<boolean>('app_darkMode', false);

  // Editing State
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editInstruction, setEditInstruction] = useState('');

  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  // Profile State
  const [savedWorks, setSavedWorks] = useState<SavedWork[]>([]);
  const [currentWorkId, setCurrentWorkId] = usePersistentState<string | null>('app_currentWorkId', null);
  const currentWorkIdRef = useRef<string | null>(currentWorkId);
  useEffect(() => { currentWorkIdRef.current = currentWorkId; }, [currentWorkId]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileTab, setProfileTab] = useState<'settings' | 'works'>('settings');
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [workToDelete, setWorkToDelete] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSession = async (session: any) => {
    if (session?.user) {
      setIsLoggedIn(true);
      setAuthEmail(session.user.email || '');
      
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single();
        
      setAuthUsername(profile?.username || session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User');
      
      // Fetch works
      const { data: works } = await supabase
        .from('works')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false });
        
      if (works) {
        setSavedWorks(works as SavedWork[]);
      }
    } else {
      setIsLoggedIn(false);
      setAuthUsername('');
      setAuthEmail('');
      setSavedWorks([]);
    }
    setIsAuthReady(true);
  };

  const saveCurrentWork = async (contentToSave: GeneratedSection[], status: 'generating' | 'completed' | 'error' = 'completed', progress: number = 100) => {
    const newWork: SavedWork = {
      id: currentWorkId || Date.now().toString(),
      title: title || (t('untitled') as string),
      type,
      genre: genre === 'custom' ? customGenre : genre,
      date: new Date().toISOString(),
      fullContent: contentToSave,
      generatedChapters,
      wordsExact,
      wordsMin,
      wordsMax,
      wordsCountType,
      pagesExact,
      pagesMin,
      pagesMax,
      pagesCountType,
      status,
      progress
    };
    
    if (!currentWorkId) {
      setCurrentWorkId(newWork.id);
    }

    if (isLoggedIn) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const workToSave = { ...newWork, user_id: session.user.id };
        const { error } = await supabase.from('works').upsert(workToSave);
        if (error) {
          console.error("Error saving work to Supabase:", error);
        } else {
          setSavedWorks(prev => {
            const exists = prev.find(w => w.id === newWork.id);
            if (exists) return prev.map(w => w.id === newWork.id ? newWork : w);
            return [newWork, ...prev];
          });
        }
      }
    } else {
      // Fallback to local state if not logged in
      setSavedWorks(prev => {
        if (currentWorkId) {
          return prev.map(w => w.id === currentWorkId ? newWork : w);
        }
        return [newWork, ...prev];
      });
    }
  };

  useEffect(() => {
    document.documentElement.dir = appLanguage === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = appLanguage;
  }, [appLanguage]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // If the page was reloaded during generation, revert to review stage so user can resume
    if (stage === 'generating') {
      setStage('review');
    }
  }, []);

  const genres = type === 'book' ? t('bookGenres') as string[] : t('novelGenres') as string[];

  const handleAddChapterName = () => {
    setChapterNames([...chapterNames, '']);
  };

  const handleUpdateChapterName = (index: number, value: string) => {
    const newNames = [...chapterNames];
    newNames[index] = value;
    setChapterNames(newNames);
  };

  const handleRemoveChapterName = (index: number) => {
    const newNames = [...chapterNames];
    newNames.splice(index, 1);
    setChapterNames(newNames);
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingChapters(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let estimatedTotalWords = 0;
      if (wordsCountType === 'exact' && wordsExact) {
        estimatedTotalWords = parseInt(wordsExact);
      } else if (wordsCountType === 'range' && wordsMin && wordsMax) {
        estimatedTotalWords = Math.floor((parseInt(wordsMin) + parseInt(wordsMax)) / 2);
      } else if (pagesCountType === 'exact' && pagesExact) {
        estimatedTotalWords = parseInt(pagesExact) * 250;
      } else if (pagesCountType === 'range' && pagesMin && pagesMax) {
        estimatedTotalWords = Math.floor((parseInt(pagesMin) + parseInt(pagesMax)) / 2) * 250;
      } else {
        estimatedTotalWords = 5000;
      }

      const isContinuousContent = chaptersCount === 'auto' && chapterNames.length === 0;
      const numberOfParts = isContinuousContent ? Math.max(1, Math.ceil(estimatedTotalWords / 800)) : 0;

      const prompt = appLanguage === 'ar' ? `
        أنت كاتب ومؤلف محترف. قم بإنشاء خطة فصول مفصلة ل${type === 'book' ? 'كتاب' : 'رواية'}.
        العنوان: ${title || 'تلقائي (اقترح عنواناً مناسباً في سياق الفصول)'}
        التصنيف: ${genre === 'auto' || !genre ? 'تلقائي (استنتج التصنيف من التفاصيل)' : (genre === 'أخرى' || genre === 'Other' ? customGenre : genre)}
        اللغة المطلوبة للكتابة: ${LANGUAGES.find(l => l.code === contentLanguage)?.name || 'العربية'}
        الجمهور المستهدف: ${targetAudience || 'عام'}
        معلومات وتفاصيل ومواضيع العمل: ${bookDetails || 'غير محدد'}
        عدد الفصول المطلوب: ${chaptersCount}
        أسماء الفصول المقترحة مسبقاً (إن وجدت): ${chapterNames.join('، ')}
        هل يحتوي على فصول فرعية: ${hasSubChapters === 'yes' ? (subChaptersCount === 'auto' ? 'نعم، يرجى تقسيم الفصول الرئيسية إلى فصول فرعية بعدد تراه مناسباً' : `نعم، يرجى تقسيم كل فصل رئيسي إلى ${subChaptersCount} فصول فرعية`) : hasSubChapters === 'no' ? 'لا، فصول رئيسية فقط' : 'حسب ما تراه مناسباً للمحتوى'}
        ملاحظات إضافية من المستخدم: ${aiNotes}
        
        ${isContinuousContent ? `
        قواعد هامة جداً (محتوى مستمر بدون فصول):
        بناءً على طلب المستخدم، **لا تقم بإنشاء فصول رئيسية أبداً**. المحتوى سيكون عبارة عن سرد واحد مستمر.
        العمل المطلوب يبلغ طوله تقريباً ${estimatedTotalWords} كلمة.
        للوصول إلى هذا الطول، يجب عليك تقسيم العمل إلى **${numberOfParts} أجزاء متتالية** (الجزء الأول، الجزء الثاني، إلخ).
        - اجعل هذه الأجزاء هي العناصر الرئيسية في القائمة المرجعة (بدلاً من الفصول).
        ${hasSubChapters === 'yes' ? '- يمكنك تقسيم هذه الأجزاء إلى فصول فرعية (subChapters) إذا لزم الأمر.' : '- لا تضع فصولاً فرعية (subChapters) داخل هذه الأجزاء.'}
        - يجب أن يكون كل جزء استكمالاً مباشراً للجزء الذي يسبقه، وكأنه عمل واحد طويل مقسم تقنياً فقط لتسهيل الكتابة.
        ` : `
        قواعد هامة لتقسيم ${type === 'book' ? 'الكتاب' : 'الرواية'}:
        1. الفصول الرئيسية: قم بإنشاء فصل رئيسي جديد فقط عندما يكون هناك انتقال كبير في الزمن، أو تغيير في المكان، أو حدث محوري جديد (أو فكرة رئيسية جديدة في حالة الكتاب).
        2. الفصول الفرعية (الأجزاء): قسّم كل فصل رئيسي إلى عدة أجزاء (مثلاً 4 أجزاء، أو حسب الحاجة 2، 6، 8) لضمان الطول الكافي. هذه الأجزاء الفرعية يجب أن تكون مشاهد/أجزاء متصلة تماماً ببعضها البعض داخل نفس الفصل الرئيسي، وليست أجزاء منفصلة. السرد بين الأجزاء الفرعية للفصل الواحد يجب أن يكون مستمراً وكأنه نص واحد.
        `}
        
        قم بإرجاع قائمة بالفصول مع وصف موجز لكل فصل يوضح ما سيتم تغطيته فيه. إذا كان هناك فصول فرعية، قم بتضمينها تحت كل فصل رئيسي مع وصفها أيضاً.
        
        ${isContinuousContent ? `
        هام جداً وإلزامي:
        - قم بتسمية العناصر "الجزء الأول"، "الجزء الثاني"، وهكذا حتى الجزء الأخير.
        - تأكد من أن العدد الإجمالي للأجزاء هو بالضبط ${numberOfParts}.
        - يجب أن يكون الجزء الأخير (الجزء ${numberOfParts}) هو نهاية العمل ويحتوي على الخاتمة والختام المنطقي للأحداث/الأفكار.
        - لا تكتب "المقدمة" أو "الخاتمة" كعناوين، بل التزم بتسمية الأجزاء فقط.
        ` : chaptersCount === '1' ? `
        هام جداً وإلزامي:
        - قم بإنشاء فصل واحد فقط يغطي الموضوع بالكامل.
        ` : chaptersCount === '2' ? `
        هام جداً وإلزامي:
        - الفصل الأول (id: 1) يجب أن يكون عنوانه "المقدمة" حصراً، ويجب أن يمهد للموضوع.
        - الفصل الثاني والأخير (id: 2) يجب أن يكون عنوانه "الخاتمة" حصراً، ويجب أن يلخص المحتوى وينهي الكتاب/الرواية تماماً.
        ` : `
        هام جداً وإلزامي:
        - الفصل الأول (id: 1) يجب أن يكون عنوانه "المقدمة" حصراً، ويجب أن يمهد للموضوع.
        - الفصل الأخير يجب أن يكون عنوانه "الخاتمة" حصراً، ويجب أن يلخص المحتوى وينهي الكتاب/الرواية تماماً.
        `}
      ` : `
        You are a professional writer and author. Create a detailed chapter plan for a ${type === 'book' ? 'book' : 'novel'}.
        Title: ${title || 'Auto (suggest a suitable title in the context of the chapters)'}
        Genre: ${genre === 'auto' || !genre ? 'Auto (infer genre from details)' : (genre === 'أخرى' || genre === 'Other' ? customGenre : genre)}
        Target Language for Writing: ${LANGUAGES.find(l => l.code === contentLanguage)?.nameEn || 'English'}
        Target Audience: ${targetAudience || 'General'}
        Book/Novel Information & Details: ${bookDetails || 'Unspecified'}
        Requested Number of Chapters: ${chaptersCount}
        Previously suggested chapter names (if any): ${chapterNames.join(', ')}
        Contains sub-chapters: ${hasSubChapters === 'yes' ? (subChaptersCount === 'auto' ? 'Yes, please divide main chapters into sub-chapters as you see fit' : `Yes, please divide each main chapter into ${subChaptersCount} sub-chapters`) : hasSubChapters === 'no' ? 'No, main chapters only' : 'As you see fit for the content'}
        Additional notes from user: ${aiNotes}
        
        ${isContinuousContent ? `
        Very Important Rules (Continuous Content without Chapters):
        Based on the user's request, **do NOT create main chapters**. The content will be one continuous narrative/flow.
        The requested work is approximately ${estimatedTotalWords} words long.
        To reach this length, you MUST divide the work into exactly **${numberOfParts} sequential parts** (Part 1, Part 2, etc.).
        - Make these parts the main items in the returned list (instead of chapters).
        ${hasSubChapters === 'yes' ? '- You may divide these parts into sub-chapters if necessary.' : '- Do NOT include sub-chapters inside these parts.'}
        - Each part must be a direct continuation of the previous one, as if it's one long work technically divided just for writing purposes.
        ` : `
        Important rules for dividing the ${type === 'book' ? 'book' : 'novel'}:
        1. Main Chapters: Create a new main chapter ONLY when there is a significant shift in time, a change in location, or a major new event (or a major new idea in the case of a book).
        2. Sub-chapters (Parts): Divide each main chapter into several parts (e.g., 4 parts, or as needed like 2, 6, 8) to ensure sufficient length. These sub-chapters MUST be completely continuous scenes/parts within the same main chapter, not separate episodic stories. The narrative between sub-chapters of the same chapter must flow seamlessly as one uninterrupted text.
        `}

        Return a list of chapters with a brief description for each chapter explaining what will be covered. If there are sub-chapters, include them under each main chapter with their descriptions as well.
        
        ${isContinuousContent ? `
        VERY IMPORTANT AND MANDATORY:
        - Name the items "Part 1", "Part 2", etc., up to the last part.
        - Ensure the total number of parts is exactly ${numberOfParts}.
        - The last part (Part ${numberOfParts}) MUST be the end of the work and contain the conclusion and logical wrap-up of the events/ideas.
        - Do not use "Introduction" or "Conclusion" as titles, just stick to naming the parts.
        ` : chaptersCount === '1' ? `
        VERY IMPORTANT AND MANDATORY:
        - Create exactly one chapter that covers the entire topic.
        ` : chaptersCount === '2' ? `
        VERY IMPORTANT AND MANDATORY:
        - The first chapter (id: 1) MUST be titled "Introduction" exclusively, and must set the stage.
        - The second and last chapter (id: 2) MUST be titled "Conclusion" exclusively, and must summarize the content and end the book/novel completely.
        ` : `
        VERY IMPORTANT AND MANDATORY:
        - The first chapter (id: 1) MUST be titled "Introduction" exclusively, and must set the stage.
        - The last chapter MUST be titled "Conclusion" exclusively, and must summarize the content and end the book/novel completely.
        `}
      `;

      const generateChaptersWithRetry = async (prompt: string, maxRetries = 5) => {
        const models = ['gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-3-flash-preview'];
        let modelIndex = 0;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const currentModel = models[modelIndex];
          try {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Request timed out')), 60000); // 60 seconds timeout
            });
            
            const response = await Promise.race([
              ai.models.generateContent({
                model: currentModel,
                contents: prompt,
                config: {
                  systemInstruction: getAdultSystemInstruction(contentLanguage),
                  safetySettings: safetySettings,
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.INTEGER },
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        subChapters: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              id: { type: Type.INTEGER },
                              title: { type: Type.STRING },
                              description: { type: Type.STRING }
                            },
                            required: ["id", "title", "description"]
                          }
                        }
                      },
                      required: ["id", "title", "description"]
                    }
                  }
                }
              }),
              timeoutPromise
            ]) as any;
            return response;
          } catch (error: any) {
            const isTimeout = error?.message === 'Request timed out';
            const isRateLimit = error?.status === 429 || 
                                error?.message?.includes('429') || 
                                error?.message?.includes('quota') ||
                                error?.message?.includes('RESOURCE_EXHAUSTED');
            
            const isNotFound = error?.status === 404 || error?.message?.includes('404');
            
            if (isRateLimit || isNotFound || isTimeout) {
              if (modelIndex < models.length - 1) {
                // Switch to next fallback model
                modelIndex++;
                console.log(`Switching to fallback model: ${models[modelIndex]} due to ${isNotFound ? '404' : isTimeout ? 'timeout' : 'quota limit'}.`);
                // Don't count this as a retry attempt for the same model
                attempt--; 
                continue; 
              } else if (attempt < maxRetries - 1) {
                const waitTime = Math.pow(2, attempt) * 3000;
                await new Promise(resolve => setTimeout(resolve, waitTime));
              } else {
                throw error;
              }
            } else {
              throw error;
            }
          }
        }
        throw new Error("Max retries reached");
      };

      const response = await generateChaptersWithRetry(prompt);

      const data = JSON.parse(response.text || '[]');
      setGeneratedChapters(data);
      setFullContent([]);
      
      if (isContinuousContent) {
        // For continuous novels, skip the review stage and go straight to generation
        // We need to use a timeout to let the state update before calling handleGenerateContent
        setTimeout(() => {
          handleGenerateContent(false, data);
        }, 100);
      } else {
        setStage('review');
      }
    } catch (error: any) {
      console.error("Error generating chapters:", error);
    } finally {
      setIsGeneratingChapters(false);
    }
  };

  const handleStartNewWork = () => {
    setStage('setup');
    setCurrentWorkId(null);
    setFullContent([]);
    setGeneratedChapters([]);
    setChapterNames([]);
    setTitle('');
    setGenre('');
    setCustomGenre('');
    setTargetAudience('');
    setAiNotes('');
    setWordsExact('');
    setWordsMin('');
    setWordsMax('');
    setPagesExact('');
    setPagesMin('');
    setPagesMax('');
    setWordsCountType('auto');
    setPagesCountType('auto');
    setChaptersCount('auto');
  };

  const handleGenerateContent = async (resume = false, chaptersToUse = generatedChapters) => {
    setStage('generating');
    
    let workId = currentWorkIdRef.current;
    if (!workId) {
      workId = Date.now().toString();
      setCurrentWorkId(workId);
    }
    
    cancelGenerationRef.current.delete(workId);

    const initialContent = resume ? fullContent : [];
    if (!resume) {
      setFullContent([]);
      setGenerationProgress(0);
    }

    let workToGenerate: SavedWork = {
      id: workId,
      title: title || (t('untitled') as string),
      type,
      genre: genre === 'custom' ? customGenre : genre,
      date: new Date().toISOString(),
      fullContent: initialContent,
      generatedChapters: chaptersToUse,
      wordsExact, wordsMin, wordsMax, wordsCountType,
      pagesExact, pagesMin, pagesMax, pagesCountType,
      status: 'generating',
      progress: 0
    };

    setSavedWorks(prev => {
      const exists = prev.find(w => w.id === workId);
      if (exists) return prev.map(w => w.id === workId ? workToGenerate : w);
      return [workToGenerate, ...prev];
    });

    if (isLoggedIn) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('works').upsert({ ...workToGenerate, user_id: session.user.id });
      }
    }
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Helper function with retry logic for rate limits (429) and fallback model
      const generateWithRetry = async (prompt: string, maxRetries = 5) => {
        const models = ['gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-3-flash-preview'];
        let modelIndex = 0;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const currentModel = models[modelIndex];
          try {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Request timed out')), 90000); // 90 seconds timeout
            });
            
            const response = await Promise.race([
              ai.models.generateContent({
                model: currentModel,
                contents: prompt,
                config: {
                  systemInstruction: getAdultSystemInstruction(contentLanguage),
                  safetySettings: safetySettings,
                }
              }),
              timeoutPromise
            ]) as any;
            return response;
          } catch (error: any) {
            const isTimeout = error?.message === 'Request timed out';
            const isRateLimit = error?.status === 429 || 
                                error?.message?.includes('429') || 
                                error?.message?.includes('quota') ||
                                error?.message?.includes('RESOURCE_EXHAUSTED');
            
            const isNotFound = error?.status === 404 || error?.message?.includes('404');
            
            if (isRateLimit || isNotFound || isTimeout) {
              if (modelIndex < models.length - 1) {
                // Switch to next fallback model
                modelIndex++;
                attempt--;
                continue;
              } else if (attempt < maxRetries - 1) {
                const waitTime = Math.pow(2, attempt) * 5000; // 5s, 10s, 20s
                await delay(waitTime);
              } else {
                throw error;
              }
            } else {
              // If it's not a rate limit or not found error, but we have fallback models, try them
              if (modelIndex < models.length - 1) {
                modelIndex++;
                attempt--;
                continue;
              }
              throw error;
            }
          }
        }
        throw new Error("Max retries reached");
      };

      // 1. Calculate Target Words
      let totalTargetWords = 0;
      if (wordsCountType === 'exact' && wordsExact) {
        totalTargetWords = parseInt(wordsExact);
      } else if (wordsCountType === 'range' && wordsMin && wordsMax) {
        totalTargetWords = Math.floor((parseInt(wordsMin) + parseInt(wordsMax)) / 2);
      } else if (pagesCountType === 'exact' && pagesExact) {
        totalTargetWords = parseInt(pagesExact) * 250; // Average 250 words per page in Arabic
      } else if (pagesCountType === 'range' && pagesMin && pagesMax) {
        totalTargetWords = Math.floor((parseInt(pagesMin) + parseInt(pagesMax)) / 2) * 250;
      } else {
        totalTargetWords = chaptersToUse.length * 1500; // Default fallback
      }
      
      const wordsPerChapter = Math.max(400, Math.floor(totalTargetWords / chaptersToUse.length));
      
      const isContinuousContent = chaptersCount === 'auto' && chapterNames.length === 0;

      const baseContext = appLanguage === 'ar' ? `
        أنت مؤلف محترف تقوم بكتابة ${type === 'book' ? 'كتاب' : 'رواية'}.
        معلومات العمل:
        - العنوان: ${title || 'غير محدد'}
        - التصنيف: ${genre === 'auto' || !genre ? 'غير محدد' : (genre === 'أخرى' || genre === 'Other' ? customGenre : genre)}
        - معلومات وتفاصيل العمل: ${bookDetails || 'غير محدد'}
        - اللغة المطلوبة للكتابة: ${LANGUAGES.find(l => l.code === contentLanguage)?.name || 'العربية'}
        - الجمهور المستهدف: ${targetAudience || 'عام'}
        - تعليمات وأوامر خاصة من المستخدم (يجب الالتزام بها بدقة): ${aiNotes || 'لا يوجد'}
      ` : `
        You are a professional author writing a ${type === 'book' ? 'book' : 'novel'}.
        Work Information:
        - Title: ${title || 'Unspecified'}
        - Genre: ${genre === 'auto' || !genre ? 'Unspecified' : (genre === 'أخرى' || genre === 'Other' ? customGenre : genre)}
        - Book/Novel Information & Details: ${bookDetails || 'Unspecified'}
        - Target Language for Writing: ${LANGUAGES.find(l => l.code === contentLanguage)?.nameEn || 'English'}
        - Target Audience: ${targetAudience || 'General'}
        - Special instructions and commands from the user (must be strictly adhered to): ${aiNotes || 'None'}
      `;

      // Calculate total steps for the progress bar
      let totalSteps = 0;
      chaptersToUse.forEach(ch => {
        if (ch.subChapters && ch.subChapters.length > 0) {
          totalSteps += ch.subChapters.length;
        } else {
          totalSteps += 1;
        }
      });

      let currentStep = 0;
      
      // If resuming, calculate currentStep based on already generated chapters
      if (resume) {
        for (let i = 0; i < fullContent.length; i++) {
          const ch = chaptersToUse[i];
          if (ch && ch.subChapters && ch.subChapters.length > 0) {
            currentStep += ch.subChapters.length;
          } else {
            currentStep += 1;
          }
        }
      }

      const startIndex = resume ? fullContent.length : 0;

      for (let i = startIndex; i < chaptersToUse.length; i++) {
        if (cancelGenerationRef.current.has(workId)) break;
        const chapter = chaptersToUse[i];
        let chapterContent = '';
        
        if (chapter.subChapters && chapter.subChapters.length > 0) {
          // Generate sub-chapters individually to force long-form content
          const wordsPerSubChapter = Math.floor(wordsPerChapter / chapter.subChapters.length);
          
          for (let j = 0; j < chapter.subChapters.length; j++) {
            if (cancelGenerationRef.current.has(workId)) break;
            const sub = chapter.subChapters[j];
            setGenerationStatus(t('writingChapter').toString().replace('{chapterNum}', (i + 1).toString()).replace('{chapterTitle}', chapter.title).replace('{partNum}', (j + 1).toString()).replace('{totalParts}', chapter.subChapters.length.toString()));
            setGenerationProgress(Math.round((currentStep / totalSteps) * 100));
            
            const prompt = appLanguage === 'ar' ? `
              ${baseContext}
              
              أنت الآن تقوم بكتابة جزء محدد من الفصل "${chapter.title}".
              ${i === 0 ? (isContinuousContent ? '\nملاحظة هامة: هذا هو الجزء الأول من العمل. ابدأ مباشرة واجذب القارئ.' : '\nملاحظة هامة وإلزامية: هذا هو الفصل الأول، وهو "المقدمة". لا تدخل في صلب الموضوع مباشرة بل مهد له بشكل جذاب.') : ''}
              ${i === chaptersToUse.length - 1 ? (isContinuousContent ? '\nملاحظة هامة: هذا هو الجزء الأخير من العمل. قم بإنهاء المحتوى والأحداث/الأفكار بشكل كامل ومقنع هنا.' : '\nملاحظة هامة وإلزامية: هذا هو الفصل الأخير، وهو "الخاتمة". يجب أن تنهي الكتاب/الرواية بشكل قاطع ونهائي هنا. لخص أهم النقاط ولا تفتح أي مواضيع جديدة ولا تلمح لأي أجزاء قادمة.') : ''}
              
              المطلوب الآن:
              اكتب المحتوى الكامل والمفصل للفصل الفرعي التالي:
              - عنوان الفصل الفرعي: ${sub.title}
              - وصف الفصل الفرعي: ${sub.description}
              
              تعليمات السرد المستمر:
              يجب أن يكون السرد متصلاً ومترابطاً تماماً. لا تجعل نهاية هذا الجزء تبدو وكأنها نهاية فصل أو نهاية قصة/كتاب (إلا إذا كان هذا هو الجزء الأخير). لا تضع ملخصاً أو خاتمة لهذا الجزء. اجعل الأحداث/الأفكار تتدفق بسلاسة بحيث عندما يُقرأ هذا الجزء مع الجزء الذي يليه، يبدوان كنص واحد متصل لم ينقطع. الانتقال بين الأجزاء يجب أن يكون طبيعياً جداً، وكأنك تقرأ صفحة وتنتقل للصفحة التي تليها.

              تعليمات صارمة جداً بخصوص الطول والتفصيل:
              - **يجب أن يكون طول هذا الجزء حوالي ${wordsPerSubChapter} كلمة.**
              - لا تقم بالاختصار أو التلخيص أبداً. توسع في الشرح، أضف أمثلة، تفاصيل، حوارات (إذا كانت رواية)، وشروحات عميقة جداً.
              - ابدأ المحتوى مباشرة بكتابة عنوان الفصل الفرعي بتنسيق (## ${sub.title}) ثم اكتب المحتوى تحته.
              - لا تكتب مقدمات أو استنتاجات عامة، ادخل في صلب الموضوع مباشرة.
            ` : `
              ${baseContext}
              
              You are now writing a specific part of the chapter "${chapter.title}".
              ${i === 0 ? (isContinuousContent ? '\nIMPORTANT NOTE: This is the first part of the work. Start directly and hook the reader.' : '\nIMPORTANT AND MANDATORY NOTE: This is the first chapter, the "Introduction". Do not jump straight into the main topic, but set the stage engagingly.') : ''}
              ${i === chaptersToUse.length - 1 ? (isContinuousContent ? '\nIMPORTANT NOTE: This is the final part of the work. Conclude the content and events/ideas completely and satisfyingly here.' : '\nVERY IMPORTANT AND MANDATORY NOTE: This is the last chapter, the "Conclusion". You must completely and definitively finish the book/novel here. Summarize the main points, do not open any new topics, and do not hint at any future parts.') : ''}
              
              Required now:
              Write the full and detailed content for the following sub-chapter:
              - Sub-chapter title: ${sub.title}
              - Sub-chapter description: ${sub.description}
              
              Continuous Narrative Instructions:
              The narrative must be completely continuous and cohesive. Do not make the end of this part feel like the end of a chapter or story/book (unless it's the final part). Do not summarize or wrap up this part. Let the events/ideas flow seamlessly so that when this part is read with the next, they read as one uninterrupted text. Transitions must be completely natural, like turning a page in a single book.

              Very strict instructions regarding length and detail:
              - **The length of this part MUST be approximately ${wordsPerSubChapter} words.**
              - Never abbreviate or summarize. Expand on explanations, add examples, details, dialogues (if it's a novel), and very deep explanations.
              - Start the content directly by writing the sub-chapter title in format (## ${sub.title}) then write the content below it.
              - Do not write general introductions or conclusions, get straight to the point.
            `;
            
            const response = await generateWithRetry(prompt);
            
            chapterContent += response.text + '\n\n';
            currentStep++;
            
            // Add a mandatory delay between successful requests to avoid hitting the 15 RPM limit
            if (currentStep < totalSteps) {
              await delay(4000); 
            }
          }
        } else {
          // Generate whole chapter if no sub-chapters exist
          const statusKey = isContinuousContent ? 'writingPartSimple' : 'writingChapterSimple';
          setGenerationStatus(t(statusKey as any).toString().replace('{chapterNum}', (i + 1).toString()).replace('{totalChapters}', chaptersToUse.length.toString()).replace('{chapterTitle}', chapter.title));
          setGenerationProgress(Math.round((currentStep / totalSteps) * 100));
          
          const prompt = appLanguage === 'ar' ? `
            ${baseContext}
            ${i === 0 ? (isContinuousContent ? '\nملاحظة هامة: هذا هو الجزء الأول من العمل. ابدأ مباشرة واجذب القارئ.' : '\nملاحظة هامة وإلزامية: هذا هو الفصل الأول، وهو "المقدمة". لا تدخل في صلب الموضوع مباشرة بل مهد له بشكل جذاب.') : ''}
            ${i === chaptersToUse.length - 1 ? (isContinuousContent ? '\nملاحظة هامة: هذا هو الجزء الأخير من العمل. قم بإنهاء المحتوى والأحداث/الأفكار بشكل كامل ومقنع هنا.' : '\nملاحظة هامة وإلزامية: هذا هو الفصل الأخير، وهو "الخاتمة". يجب أن تنهي الكتاب/الرواية بشكل قاطع ونهائي هنا. لخص أهم النقاط ولا تفتح أي مواضيع جديدة ولا تلمح لأي أجزاء قادمة.') : ''}
            
            المطلوب الآن:
            اكتب المحتوى الكامل والمفصل لـ:
            - العنوان: ${chapter.title}
            - الوصف: ${chapter.description}
            
            ${isContinuousContent ? `
            تعليمات السرد المستمر:
            بما أن هذا محتوى مستمر، يجب أن يكون السرد متصلاً ومترابطاً تماماً مع الجزء السابق والتالي. لا تجعل نهاية هذا الجزء تبدو وكأنها نهاية قصة/كتاب (إلا إذا كان هذا هو الجزء الأخير). لا تضع ملخصاً أو خاتمة لهذا الجزء. اجعل الأحداث/الأفكار تتدفق بسلاسة بحيث عندما يُقرأ هذا الجزء مع الجزء الذي يليه، يبدوان كنص واحد متصل لم ينقطع.
            ` : ''}

            تعليمات صارمة جداً بخصوص الطول والتفصيل:
            - **يجب أن يكون طول هذا الفصل حوالي ${wordsPerChapter} كلمة.**
            - لا تقم بالاختصار أو التلخيص أبداً. توسع في الشرح، أضف أمثلة، تفاصيل، حوارات (إذا كانت رواية)، وشروحات عميقة جداً.
            - لا تقم بكتابة عنوان الفصل الرئيسي، ابدأ بكتابة محتوى الفصل مباشرة.
            - استخدم تنسيق Markdown للعناوين الفرعية (##) إذا لزم الأمر.
          ` : `
            ${baseContext}
            ${i === 0 ? (isContinuousContent ? '\nIMPORTANT NOTE: This is the first part of the work. Start directly and hook the reader.' : '\nIMPORTANT AND MANDATORY NOTE: This is the first chapter, the "Introduction". Do not jump straight into the main topic, but set the stage engagingly.') : ''}
            ${i === chaptersToUse.length - 1 ? (isContinuousContent ? '\nIMPORTANT NOTE: This is the final part of the work. Conclude the content and events/ideas completely and satisfyingly here.' : '\nVERY IMPORTANT AND MANDATORY NOTE: This is the last chapter, the "Conclusion". You must completely and definitively finish the book/novel here. Summarize the main points, do not open any new topics, and do not hint at any future parts.') : ''}
            
            Required now:
            Write the full and detailed content for:
            - Title: ${chapter.title}
            - Description: ${chapter.description}
            
            ${isContinuousContent ? `
            Continuous Narrative Instructions:
            Since this is continuous content, the narrative must be completely continuous and cohesive with the previous and next parts. Do not make the end of this part feel like the end of a story/book (unless it's the final part). Do not summarize or wrap up this part. Let the events/ideas flow seamlessly so that when this part is read with the next, they read as one uninterrupted text.
            ` : ''}

            Very strict instructions regarding length and detail:
            - **The length of this chapter MUST be approximately ${wordsPerChapter} words.**
            - Never abbreviate or summarize. Expand on explanations, add examples, details, dialogues (if it's a novel), and very deep explanations.
            - Do not write the main chapter title, start writing the chapter content directly.
            - Use Markdown formatting for sub-headings (##) if necessary.
          `;
          
          const response = await generateWithRetry(prompt);
          
          chapterContent += response.text + '\n\n';
          currentStep++;
          
          // Add a mandatory delay between successful requests
          if (currentStep < totalSteps) {
            await delay(4000); 
          }
        }
        
        const newSection = {
          title: chapter.title,
          content: chapterContent
        };
        
        workToGenerate = {
          ...workToGenerate,
          fullContent: [...workToGenerate.fullContent, newSection],
          progress: Math.round((currentStep / totalSteps) * 100)
        };

        setSavedWorks(prev => prev.map(w => w.id === workId ? workToGenerate : w));

        if (isLoggedIn) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await supabase.from('works').upsert({ ...workToGenerate, user_id: session.user.id });
          }
        }

        if (currentWorkIdRef.current === workId) {
          setFullContent(prev => [...prev, newSection]);
        }
      }
      
      if (cancelGenerationRef.current.has(workId)) {
        workToGenerate = { ...workToGenerate, status: 'error' };
        setSavedWorks(prev => prev.map(w => w.id === workId ? workToGenerate : w));
        if (isLoggedIn) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await supabase.from('works').upsert({ ...workToGenerate, user_id: session.user.id });
          }
        }
        if (currentWorkIdRef.current === workId) {
          setProfileTab('works');
          setStage('profile');
        }
        return;
      }

      workToGenerate = { ...workToGenerate, progress: 100, status: 'completed' };
      setSavedWorks(prev => prev.map(w => w.id === workId ? workToGenerate : w));
      if (isLoggedIn) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await supabase.from('works').upsert({ ...workToGenerate, user_id: session.user.id });
        }
      }

      if (currentWorkIdRef.current === workId) {
        setGenerationProgress(100);
        setGenerationStatus(t('writingComplete'));
        
        setTimeout(() => {
          setStage('complete');
        }, 1000);
      }
      
      if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(t('generationComplete') as string, {
          body: t('workReady') + ': ' + workToGenerate.title,
          icon: '/vite.svg'
        });
      }
      
    } catch (error: any) {
      console.error("Error generating full content:", error);
      workToGenerate = { ...workToGenerate, status: 'error' };
      setSavedWorks(prev => prev.map(w => w.id === workId ? workToGenerate : w));
      if (isLoggedIn) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await supabase.from('works').upsert({ ...workToGenerate, user_id: session.user.id });
        }
      }
      if (currentWorkIdRef.current === workId) {
        setProfileTab('works');
        setStage('profile');
      }
    }
  };

  const handleEditContent = async (instruction: string) => {
    if (!instruction.trim()) return;
    
    setStage('generating');
    setGenerationProgress(0);
    setIsEditingMode(false);
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const generateWithRetry = async (prompt: string, maxRetries = 5) => {
        const models = ['gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-3-flash-preview'];
        let modelIndex = 0;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const currentModel = models[modelIndex];
          try {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Request timed out')), 90000); // 90 seconds timeout
            });
            
            const response = await Promise.race([
              ai.models.generateContent({
                model: currentModel,
                contents: prompt,
                config: {
                  systemInstruction: getAdultSystemInstruction(contentLanguage),
                  safetySettings: safetySettings,
                }
              }),
              timeoutPromise
            ]) as any;
            return response;
          } catch (error: any) {
            const isTimeout = error?.message === 'Request timed out';
            const isRateLimit = error?.status === 429 || 
                                error?.message?.includes('429') || 
                                error?.message?.includes('quota') ||
                                error?.message?.includes('RESOURCE_EXHAUSTED');
            
            const isNotFound = error?.status === 404 || error?.message?.includes('404');
            
            if (isRateLimit || isNotFound || isTimeout) {
              if (modelIndex < models.length - 1) {
                modelIndex++;
                attempt--;
                continue;
              } else if (attempt < maxRetries - 1) {
                const waitTime = Math.pow(2, attempt) * 5000;
                await delay(waitTime);
              } else {
                throw error;
              }
            } else {
              if (modelIndex < models.length - 1) {
                modelIndex++;
                attempt--;
                continue;
              }
              throw error;
            }
          }
        }
        throw new Error("Max retries reached");
      };

      const editedContent = [];
      const totalSteps = fullContent.length;
      let currentStep = 0;

      for (let i = 0; i < fullContent.length; i++) {
        const section = fullContent[i];
        setGenerationStatus(t('editingChapter').toString().replace('{chapterTitle}', section.title));
        setGenerationProgress(Math.round((currentStep / totalSteps) * 100));
        
        const prompt = appLanguage === 'ar' ? `
          أنت محرر نصوص خبير.
          المطلوب منك هو تعديل النص التالي بناءً على هذه التعليمات من المستخدم:
          "${instruction}"
          
          عنوان النص: ${section.title}
          
          النص الأصلي:
          ${section.content}
          
          قم بإرجاع النص المعدل فقط بدون أي إضافات أو مقدمات. حافظ على تنسيق Markdown.
        ` : `
          You are an expert text editor.
          Your task is to edit the following text based on these instructions from the user:
          "${instruction}"
          
          Text Title: ${section.title}
          
          Original Text:
          ${section.content}
          
          Return ONLY the edited text without any additions or introductions. Keep the Markdown formatting.
        `;
        
        const response = await generateWithRetry(prompt);
        
        editedContent.push({
          title: section.title,
          content: response.text || section.content
        });
        
        currentStep++;
        
        if (currentStep < totalSteps) {
          await delay(4000); 
        }
      }
      
      setFullContent(editedContent);
      setGenerationProgress(100);
      setGenerationStatus(t('writingComplete'));
      
      setTimeout(() => {
        saveCurrentWork(editedContent);
        setStage('complete');
      }, 1000);
      
    } catch (error: any) {
      console.error("Error editing content:", error);
      setStage('complete');
    }
  };

  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  const handleDownloadWord = async (customTitle?: string) => {
    setIsDownloadingWord(true);
    try {
      const element = document.getElementById('printable-content');
      if (!element) {
        alert(t('noPrintableContent'));
        setIsDownloadingWord(false);
        return;
      }
      
      // Clone the element to modify it for Word export without affecting the UI
      const clone = element.cloneNode(true) as HTMLElement;
      
      // Force RTL/LTR on all block elements for Word compatibility
      const blockElements = clone.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, li, div');
      blockElements.forEach(el => {
        el.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
        el.setAttribute('align', isRtl ? 'right' : 'left');
        (el as HTMLElement).style.textAlign = isRtl ? 'right' : 'left';
        (el as HTMLElement).style.direction = isRtl ? 'rtl' : 'ltr';
      });

      const header = `
        <html xmlns:v="urn:schemas-microsoft-com:vml"
              xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:w="urn:schemas-microsoft-com:office:word"
              xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset='utf-8'>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
          <title>${customTitle || title || 'book'}</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            @page WordSection1 {
              size: 595.3pt 841.9pt; /* A4 size */
              margin: 72.0pt 72.0pt 72.0pt 72.0pt; /* 1 inch margins */
              mso-header-margin: 35.4pt;
              mso-footer-margin: 35.4pt;
              mso-paper-source: 0;
            }
            div.WordSection1 {
              page: WordSection1;
            }
            body {
              font-family: 'Arial', sans-serif;
              mso-bidi-font-family: 'Arial';
              direction: ${isRtl ? 'rtl' : 'ltr'};
              text-align: ${isRtl ? 'right' : 'left'};
              line-height: 1.8;
              font-size: 14pt;
            }
            h1, h2, h3, h4, h5, h6 {
              direction: ${isRtl ? 'rtl' : 'ltr'};
              text-align: ${isRtl ? 'right' : 'left'};
              color: #1e293b;
              mso-bidi-font-family: 'Arial';
              page-break-after: avoid;
            }
            p, li {
              direction: ${isRtl ? 'rtl' : 'ltr'};
              text-align: justify;
              text-justify: inter-ideograph;
              margin-top: 0;
              margin-bottom: 14pt;
              mso-bidi-font-family: 'Arial';
            }
            ul, ol {
              direction: ${isRtl ? 'rtl' : 'ltr'};
              text-align: ${isRtl ? 'right' : 'left'};
              margin-${isRtl ? 'right' : 'left'}: 20pt;
            }
            .chapter-title {
              font-size: 24pt;
              font-weight: bold;
              margin-bottom: 24pt;
              text-align: center;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 12pt;
              page-break-before: always;
            }
            .content-body {
              font-size: 14pt;
            }
            .pdf-cover {
              text-align: center;
              page-break-after: always;
              margin-top: 150pt;
            }
            .pdf-cover h1 {
              font-size: 36pt;
              text-align: center;
              margin-bottom: 24pt;
            }
            .pdf-cover p {
              font-size: 18pt;
              text-align: center;
              color: #4b5563;
            }
          </style>
        </head>
        <body dir='${isRtl ? 'rtl' : 'ltr'}'>
          <div class="WordSection1">
      `;
      const footer = "</div></body></html>";
      const sourceHTML = header + clone.innerHTML + footer;
      
      const blob = new Blob(['\ufeff', sourceHTML], {
        type: 'application/msword'
      });
      
      const url = URL.createObjectURL(blob);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = url;
      fileDownload.download = `${customTitle || title || 'book'}.doc`;
      fileDownload.click();
      document.body.removeChild(fileDownload);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Word Error:", err);
      alert(t('wordError') + (err.message || err));
    } finally {
      setIsDownloadingWord(false);
    }
  };

  const handleDownloadPDF = async (customTitle?: string) => {
    setIsDownloadingPDF(true);
    try {
      await document.fonts.ready;
      
      const element = document.getElementById('printable-content');
      if (!element) {
        alert(t('noPrintableContent'));
        setIsDownloadingPDF(false);
        return;
      }

      const opt = {
        margin:       [20, 15, 20, 15] as [number, number, number, number], // Top, Right, Bottom, Left in mm
        filename:     `${customTitle || title || 'book'}.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          onclone: (clonedDoc: Document) => {
            // Find all style tags in head
            const styles = clonedDoc.querySelectorAll('head style');
            styles.forEach(style => {
              // Keep Google Fonts imports, remove everything else (like Tailwind which causes issues)
              if (style.innerHTML.includes('@import url') && style.innerHTML.includes('fonts.googleapis.com')) {
                const imports = style.innerHTML.match(/@import url\([^)]+\);/g);
                if (imports) {
                  style.innerHTML = imports.join('\n');
                } else {
                  style.remove();
                }
              } else {
                style.remove();
              }
            });
            
            // Also remove external stylesheets that might be Tailwind
            const links = clonedDoc.querySelectorAll('head link[rel="stylesheet"]');
            links.forEach(link => {
              const href = link.getAttribute('href') || '';
              if (!href.includes('fonts.googleapis.com')) {
                link.remove();
              }
            });
            
            // Explicitly add Tajawal font to ensure it's available
            const fontLink = clonedDoc.createElement('link');
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap';
            fontLink.rel = 'stylesheet';
            clonedDoc.head.appendChild(fontLink);
          }
        },
        jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak:    { mode: ['css', 'legacy'], avoid: ['p', 'h1', 'h2', 'h3', 'li', 'ul', 'ol'] }
      };

      // For very long content, html2canvas can hit browser height limits and render blank pages.
      // To fix this, we process the cover and each chapter separately and add them to the same PDF.
      const coverElement = document.getElementById('pdf-cover');
      if (!coverElement) {
        // Fallback to full element if cover not found
        await html2pdf().set(opt).from(element).save();
        return;
      }

      let worker: any = html2pdf().set(opt).from(coverElement).toPdf();

      for (let i = 0; i < fullContent.length; i++) {
        const chapterElement = document.getElementById(`pdf-chapter-${i}`);
        if (chapterElement) {
          worker = worker.get('pdf').then((pdf: any) => {
            pdf.addPage();
            return pdf;
          }).from(chapterElement).toContainer().toCanvas().toPdf();
        }
      }

      await worker.save();
    } catch (err: any) {
      console.error("PDF Error:", err);
      alert(t('pdfError') + (err.message || err));
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const renderSetupStage = () => {
    const isContinuousContent = chaptersCount === 'auto' && chapterNames.length === 0;
    
    return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto"
    >
      <form onSubmit={handleSetupSubmit} className="space-y-8 relative">
        {/* Decorative Background for Setup */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-indigo-500/5 dark:bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>

        {/* Type Selection */}
        <section className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/50 dark:border-slate-800/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-50"></div>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
              <Layers className="w-5 h-5 text-indigo-500" />
            </div>
            {t('contentType')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setType('book'); setGenre(''); }}
              className={`group relative overflow-hidden p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-4 ${
                type === 'book' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 shadow-md shadow-indigo-100 dark:shadow-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:-translate-y-1'
              }`}
            >
              <div className={`p-4 rounded-full transition-colors duration-300 ${type === 'book' ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30'}`}>
                <Book className={`w-10 h-10 ${type === 'book' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-indigo-500'}`} />
              </div>
              <span className="text-xl font-bold">{t('book')}</span>
              {type === 'book' && (
                <motion.div layoutId="activeType" className="absolute inset-0 border-2 border-indigo-500 rounded-2xl" />
              )}
            </button>
            
            <button
              type="button"
              onClick={() => { setType('novel'); setGenre(''); }}
              className={`group relative overflow-hidden p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-4 ${
                type === 'novel' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 shadow-md shadow-indigo-100 dark:shadow-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:-translate-y-1'
              }`}
            >
              <div className={`p-4 rounded-full transition-colors duration-300 ${type === 'novel' ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30'}`}>
                <BookOpen className={`w-10 h-10 ${type === 'novel' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-indigo-500'}`} />
              </div>
              <span className="text-xl font-bold">{t('novel')}</span>
              {type === 'novel' && (
                <motion.div layoutId="activeType" className="absolute inset-0 border-2 border-indigo-500 rounded-2xl" />
              )}
            </button>
          </div>
        </section>

        {/* Basic Info */}
        <section className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/50 dark:border-slate-800/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-50"></div>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/30">
              <PenTool className="w-5 h-5 text-violet-500" />
            </div>
            {t('basicInfo')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t('titleLabel')}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTitle('')}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${!title ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  {t('auto')}
                </button>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('titlePlaceholder')}
                  className="flex-1 w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t('genreLabel')}</label>
              <select
                value={genre || 'auto'}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white appearance-none"
              >
                <option value="auto">{t('autoGenre')}</option>
                {genres.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <AnimatePresence>
              {(genre === 'أخرى' || genre === 'Other') && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 md:col-span-2"
                >
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t('customGenreLabel')}</label>
                  <input
                    type="text"
                    value={customGenre}
                    onChange={(e) => setCustomGenre(e.target.value)}
                    placeholder={t('customGenrePlaceholder')}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2 relative" ref={languageDropdownRef}>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t('languageLabel')}</label>
              <button
                type="button"
                onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-900 transition-all text-slate-900 dark:text-white"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{LANGUAGES.find(l => l.code === contentLanguage)?.flag || '🌐'}</span>
                  <span className="font-medium">{appLanguage === 'ar' ? LANGUAGES.find(l => l.code === contentLanguage)?.name : LANGUAGES.find(l => l.code === contentLanguage)?.nameEn}</span>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isLanguageDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isLanguageDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden"
                  >
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder={t('searchLanguage')}
                          value={languageSearchQuery}
                          onChange={(e) => setLanguageSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                          dir={appLanguage === 'ar' ? 'rtl' : 'ltr'}
                        />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                      {LANGUAGES.filter(lang => 
                        lang.name.toLowerCase().includes(languageSearchQuery.toLowerCase()) || 
                        lang.nameEn.toLowerCase().includes(languageSearchQuery.toLowerCase())
                      ).map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            setContentLanguage(lang.code);
                            setIsLanguageDropdownOpen(false);
                            setLanguageSearchQuery('');
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${contentLanguage === lang.code ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{lang.flag}</span>
                            <span>{appLanguage === 'ar' ? lang.name : lang.nameEn}</span>
                          </div>
                          {contentLanguage === lang.code && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                      {LANGUAGES.filter(lang => 
                        lang.name.toLowerCase().includes(languageSearchQuery.toLowerCase()) || 
                        lang.nameEn.toLowerCase().includes(languageSearchQuery.toLowerCase())
                      ).length === 0 && (
                        <div className="text-center py-4 text-sm text-slate-500 dark:text-slate-400">
                          {t('noLanguagesFound')}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                {t('targetAudienceLabel')} <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">{t('targetAudienceOptional')}</span>
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder={t('targetAudiencePlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                {t('bookDetailsLabel')} <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">{t('optional')}</span>
              </label>
              <textarea
                value={bookDetails}
                onChange={(e) => setBookDetails(e.target.value)}
                placeholder={t('bookDetailsPlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 min-h-[100px] resize-y text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </section>

        {/* Structure & Length */}
        <section className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/50 dark:border-slate-800/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fuchsia-500 to-pink-500 opacity-50"></div>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <div className="p-2 rounded-lg bg-fuchsia-50 dark:bg-fuchsia-900/30">
              <FileText className="w-5 h-5 text-fuchsia-500" />
            </div>
            {t('structureAndLength')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Chapters */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t('chaptersCountLabel')}</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setChaptersCount('auto')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${chaptersCount === 'auto' ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                  >
                    {t('auto')}
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={chaptersCount === 'auto' ? '' : chaptersCount}
                    onChange={(e) => setChaptersCount(e.target.value || 'auto')}
                    placeholder={t('orEnterNumber')}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t('chapterNamesLabel')} <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">{t('chapterNamesOptional')}</span></label>
                  <button
                    type="button"
                    onClick={handleAddChapterName}
                    className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg"
                  >
                    <Plus className="w-3 h-3" /> {t('addChapter')}
                  </button>
                </div>
                
                <AnimatePresence>
                  {chapterNames.map((name, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="flex gap-2"
                    >
                      <div className="flex-1 relative">
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => handleUpdateChapterName(index, e.target.value)}
                          placeholder={t('chapterNamePlaceholder')}
                          className="w-full pr-12 pl-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveChapterName(index)}
                        className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {chapterNames.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">{t('autoNamingNote')}</p>
                )}
              </div>

              {type === 'book' && (
                <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t('hasSubChaptersLabel')}</label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setHasSubChapters('auto')}
                      className={`flex-1 py-2 px-2 rounded-lg text-sm font-bold transition-all ${hasSubChapters === 'auto' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      {t('auto')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasSubChapters('yes')}
                      className={`flex-1 py-2 px-2 rounded-lg text-sm font-bold transition-all ${hasSubChapters === 'yes' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      {t('yes')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasSubChapters('no')}
                      className={`flex-1 py-2 px-2 rounded-lg text-sm font-bold transition-all ${hasSubChapters === 'no' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      {t('no')}
                    </button>
                  </div>
                  
                  <AnimatePresence>
                    {hasSubChapters === 'yes' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2 pt-4 overflow-hidden"
                      >
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t('subChaptersCountLabel')}</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSubChaptersCount('auto')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${subChaptersCount === 'auto' ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                          >
                            {t('auto')}
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={subChaptersCount === 'auto' ? '' : subChaptersCount}
                            onChange={(e) => setSubChaptersCount(e.target.value || 'auto')}
                            placeholder={t('orEnterNumber')}
                            className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Length */}
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t('pagesCountLabel')}</label>
                
                <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-4">
                  <button
                    type="button"
                    onClick={() => setPagesCountType('auto')}
                    className={`py-2 px-2 rounded-lg text-sm font-bold transition-all ${pagesCountType === 'auto' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    {t('auto')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPagesCountType('exact')}
                    className={`py-2 px-2 rounded-lg text-sm font-bold transition-all ${pagesCountType === 'exact' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    {t('exactNumber')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPagesCountType('range')}
                    className={`py-2 px-2 rounded-lg text-sm font-bold transition-all ${pagesCountType === 'range' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    {t('range')}
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {pagesCountType === 'exact' && (
                    <motion.div
                      key="exact"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <input
                        type="number"
                        min="1"
                        value={pagesExact}
                        onChange={(e) => setPagesExact(e.target.value)}
                        placeholder={t('pagesExactPlaceholder')}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </motion.div>
                  )}
                  
                  {pagesCountType === 'range' && (
                    <motion.div
                      key="range"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="number"
                        min="1"
                        value={pagesMin}
                        onChange={(e) => setPagesMin(e.target.value)}
                        placeholder={t('from')}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-center text-slate-900 dark:text-white"
                      />
                      <span className="text-slate-400 dark:text-slate-500 font-bold">-</span>
                      <input
                        type="number"
                        min="1"
                        value={pagesMax}
                        onChange={(e) => setPagesMax(e.target.value)}
                        placeholder={t('to')}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-center text-slate-900 dark:text-white"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t('wordsCountLabel')}</label>
                
                <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-4">
                  <button
                    type="button"
                    onClick={() => setWordsCountType('auto')}
                    className={`py-2 px-2 rounded-lg text-sm font-bold transition-all ${wordsCountType === 'auto' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    {t('auto')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWordsCountType('exact')}
                    className={`py-2 px-2 rounded-lg text-sm font-bold transition-all ${wordsCountType === 'exact' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    {t('exactNumber')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWordsCountType('range')}
                    className={`py-2 px-2 rounded-lg text-sm font-bold transition-all ${wordsCountType === 'range' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    {t('range')}
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {wordsCountType === 'exact' && (
                    <motion.div
                      key="exact"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <input
                        type="number"
                        min="100"
                        value={wordsExact}
                        onChange={(e) => setWordsExact(e.target.value)}
                        placeholder={t('wordsExactPlaceholder')}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </motion.div>
                  )}
                  
                  {wordsCountType === 'range' && (
                    <motion.div
                      key="range"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="number"
                        min="100"
                        value={wordsMin}
                        onChange={(e) => setWordsMin(e.target.value)}
                        placeholder={t('from')}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-center text-slate-900 dark:text-white"
                      />
                      <span className="text-slate-400 dark:text-slate-500 font-bold">-</span>
                      <input
                        type="number"
                        min="100"
                        value={wordsMax}
                        onChange={(e) => setWordsMax(e.target.value)}
                        placeholder={t('to')}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-center text-slate-900 dark:text-white"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        {/* AI Notes */}
        <section className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/50 dark:border-slate-800/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-50"></div>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
            </div>
            {t('aiNotesLabel')} <span className="text-sm text-slate-400 dark:text-slate-500 font-normal">{t('aiNotesOptional')}</span>
          </h2>
          <div className="space-y-2">
            <textarea
              value={aiNotes}
              onChange={(e) => setAiNotes(e.target.value)}
              placeholder={t('aiNotesPlaceholder')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 min-h-[120px] resize-y text-slate-900 dark:text-white"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('aiNotesHelp')}</p>
          </div>
        </section>

        {/* Submit Button */}
        <div className="flex justify-center pt-4 pb-12">
          <button
            type="submit"
            disabled={isGeneratingChapters}
            className="group relative overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-indigo-400 disabled:to-violet-400 text-white font-bold text-lg px-12 py-4 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 hover:shadow-xl hover:shadow-indigo-300 dark:hover:shadow-indigo-900/40 transition-all duration-300 flex items-center gap-3 hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <span className="relative z-10">
              {isGeneratingChapters 
                ? (isContinuousContent ? t('generatingContentTitleAlt') : t('suggestingChapters')) 
                : (isContinuousContent ? t('generateFullContent') : t('suggestChapters'))}
            </span>
            {isGeneratingChapters ? (
              <Loader2 className="w-5 h-5 relative z-10 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5 relative z-10 group-hover:rotate-12 transition-transform" />
            )}
            {!isGeneratingChapters && <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />}
          </button>
        </div>
      </form>
    </motion.div>
    );
  };

  const renderReviewStage = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl mx-auto"
    >
      <button 
        onClick={() => setStage('setup')}
        className="mb-6 flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-semibold"
      >
        <ChevronRight className={`w-5 h-5 ${appLanguage === 'ar' ? '' : 'rotate-180'}`} />
        {t('backToSettings')}
      </button>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{t('reviewChaptersTitle')}</h1>
        <p className="text-slate-500 dark:text-slate-400">{t('reviewChaptersDesc')}</p>
      </header>

      <div className="space-y-4 mb-8">
        {generatedChapters.map((chapter, index) => (
          <div key={`c-${chapter.id}`} className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 group hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-colors">
            {editingId === `c-${chapter.id}` ? (
              <div className="space-y-3 mb-4">
                <input
                  type="text"
                  value={chapter.title}
                  onChange={(e) => {
                    const newChapters = [...generatedChapters];
                    newChapters[index].title = e.target.value;
                    setGeneratedChapters(newChapters);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <textarea
                  value={chapter.description}
                  onChange={(e) => {
                    const newChapters = [...generatedChapters];
                    newChapters[index].description = e.target.value;
                    setGeneratedChapters(newChapters);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-600 dark:text-slate-300 min-h-[80px] bg-slate-50 dark:bg-slate-800"
                />
                <button 
                  onClick={() => setEditingId(null)}
                  className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors"
                >
                  {t('saveChanges')}
                </button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{chapter.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{chapter.description}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingId(`c-${chapter.id}`)}
                  className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Sub Chapters */}
            {chapter.subChapters && chapter.subChapters.length > 0 && (
              <div className={`mt-4 ${appLanguage === 'ar' ? 'pr-4 md:pr-12 border-r-2' : 'pl-4 md:pl-12 border-l-2'} space-y-3 border-indigo-100 dark:border-indigo-900/30`}>
                {chapter.subChapters.map((sub, subIndex) => (
                  <div key={`s-${chapter.id}-${sub.id}`} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 group/sub hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-colors">
                    {editingId === `s-${chapter.id}-${sub.id}` ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={sub.title}
                          onChange={(e) => {
                            const newChapters = [...generatedChapters];
                            newChapters[index].subChapters![subIndex].title = e.target.value;
                            setGeneratedChapters(newChapters);
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                        <textarea
                          value={sub.description}
                          onChange={(e) => {
                            const newChapters = [...generatedChapters];
                            newChapters[index].subChapters![subIndex].description = e.target.value;
                            setGeneratedChapters(newChapters);
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-600 dark:text-slate-300 text-sm min-h-[60px] bg-white dark:bg-slate-800"
                        />
                        <button 
                          onClick={() => setEditingId(null)}
                          className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors"
                        >
                          {t('saveChanges')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0 text-xs mt-0.5">
                            {index + 1}.{subIndex + 1}
                          </div>
                          <div>
                            <h4 className="text-md font-bold text-slate-700 dark:text-slate-200 mb-1">{sub.title}</h4>
                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{sub.description}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setEditingId(`s-${chapter.id}-${sub.id}`)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-colors opacity-0 group-hover/sub:opacity-100"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-center pb-12 gap-4">
        {fullContent.length > 0 && fullContent.length < generatedChapters.length && (
          <button
            onClick={() => handleGenerateContent(true)}
            className="group relative overflow-hidden bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-3"
          >
            <span className="relative z-10">{t('resumeWriting')} ({fullContent.length}/{generatedChapters.length})</span>
            <Play className="w-5 h-5 relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>
        )}
        <button
          onClick={() => handleGenerateContent(false)}
          className="group relative overflow-hidden bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-3"
        >
          <span className="relative z-10">{fullContent.length > 0 ? t('rewriteFromStart') : t('generateFullContent')}</span>
          <CheckCircle2 className="w-5 h-5 relative z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </button>
      </div>
    </motion.div>
  );

  const renderGeneratingStage = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto mt-20 text-center"
    >
      <div className="relative w-24 h-24 mx-auto mb-8">
        <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-indigo-600 dark:border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
        <Sparkles className="w-8 h-8 text-indigo-600 dark:text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('generatingContentTitleAlt')}</h2>
      <p className="text-slate-500 dark:text-slate-400 mb-8">{t('generatingContentDesc')}</p>
      
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
        <div className="flex justify-between text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
          <span>{generationStatus}</span>
          <span className="text-indigo-600 dark:text-indigo-400">{generationProgress}%</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
          <motion.div 
            className="bg-indigo-600 dark:bg-indigo-500 h-3 rounded-full" 
            initial={{ width: 0 }}
            animate={{ width: `${generationProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl text-sm mb-6 text-right">
        <Info className="w-5 h-5 inline-block ml-2 mb-1" />
        {t('backgroundGenerationInfo')}
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => {
            if ('Notification' in window) {
              Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                  setNotificationsEnabled(true);
                }
              });
            }
          }}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-colors ${notificationsEnabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
        >
          <Bell className="w-5 h-5" />
          {notificationsEnabled ? t('notificationsEnabled') : t('enableNotifications')}
        </button>

        <button
          onClick={() => setShowCancelConfirm(true)}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
        >
          <XCircle className="w-5 h-5" />
          {t('cancelGeneration')}
        </button>
      </div>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-slate-200 dark:border-slate-800"
          >
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('cancelConfirmTitle')}</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">{t('cancelConfirmDesc')}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  if (currentWorkId) {
                    cancelGenerationRef.current.add(currentWorkId);
                  }
                  setShowCancelConfirm(false);
                }}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
              >
                {t('yesCancel')}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors"
              >
                {t('noKeepGenerating')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );

  const renderCompleteStage = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto mt-10 text-center"
    >
      <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
        {t('generationCompleteTitle').toString().replace('{type}', type === 'book' ? t('book').toString() : t('novel').toString())}
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-10 text-lg">{t('generationCompleteDesc')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button 
          onClick={() => handleDownloadWord()}
          disabled={isDownloadingWord || isDownloadingPDF}
          className="flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-slate-100 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            {isDownloadingWord ? <Loader2 className="w-8 h-8 animate-spin" /> : <FileText className="w-8 h-8" />}
          </div>
          <div className="font-bold text-lg text-slate-800 dark:text-slate-100">
            {isDownloadingWord ? t('downloading') : t('downloadWordBtn')}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{t('downloadWordDesc')}</div>
        </button>

        <button 
          onClick={() => handleDownloadPDF()}
          disabled={isDownloadingWord || isDownloadingPDF}
          className="flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-slate-100 dark:border-slate-800 hover:border-red-500 dark:hover:border-red-500 hover:shadow-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            {isDownloadingPDF ? <Loader2 className="w-8 h-8 animate-spin" /> : <FileDown className="w-8 h-8" />}
          </div>
          <div className="font-bold text-lg text-slate-800 dark:text-slate-100">
            {isDownloadingPDF ? t('downloading') : t('downloadPDFBtn')}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{t('downloadPDFDesc')}</div>
        </button>
      </div>

      {!isEditingMode ? (
        <button 
          onClick={() => setIsEditingMode(true)}
          className="mt-8 flex items-center justify-center gap-2 mx-auto bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-lg px-8 py-4 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <Edit3 className="w-5 h-5" />
          {t('editContentBtn')}
        </button>
      ) : (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-8 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 text-left"
        >
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            {t('editContentBtn')}
          </label>
          <textarea
            value={editInstruction}
            onChange={(e) => setEditInstruction(e.target.value)}
            placeholder={t('editInstructionPlaceholder') as string}
            className="w-full h-32 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-0 transition-colors resize-none mb-4"
          />
          <div className="flex gap-3 justify-end">
            <button 
              onClick={() => setIsEditingMode(false)}
              className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('cancelEdit')}
            </button>
            <button 
              onClick={() => handleEditContent(editInstruction)}
              disabled={!editInstruction.trim()}
              className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {t('applyEdit')}
            </button>
          </div>
        </motion.div>
      )}

      <button 
        onClick={handleStartNewWork}
        className="mt-12 text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
      >
        {t('startNewProject')}
      </button>
    </motion.div>
  );

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoadingAuth(true);

    try {
      if (authMode === 'signup') {
        // Check if username exists
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', authUsername)
          .maybeSingle();
          
        if (existingUser) {
          setAuthError(t('usernameExists') as string);
          setIsLoadingAuth(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: { username: authUsername }
          }
        });
        if (error) throw error;
        
        if (data.user && !data.session) {
          setAuthError(t('accountCreatedCheckEmail') as string);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
      }
      setStage('landing');
    } catch (error: any) {
      console.error("Auth error:", error);
      setAuthError(error.message || 'Authentication failed');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError('');
    setIsLoadingAuth(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Google auth error:", error);
      setAuthError(error.message || 'Google authentication failed');
      setIsLoadingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setShowProfileMenu(false);
      setStage('landing');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage({ type: '', text: '' });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    try {
      // Check if username exists and belongs to someone else
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', authUsername)
        .neq('id', session.user.id)
        .maybeSingle();
        
      if (existingUser) {
        setProfileMessage({ type: 'error', text: t('usernameExists') as string });
        return;
      }

      const updateData: any = { data: { username: authUsername } };
      if (authPassword) {
        updateData.password = authPassword;
      }

      const { error: updateError } = await supabase.auth.updateUser(updateData);
      if (updateError) throw updateError;
      
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: session.user.id,
        username: authUsername,
        email: session.user.email
      });
      if (profileError) throw profileError;
      
      setAuthPassword(''); // Clear password field after successful update
      setProfileMessage({ type: 'success', text: t('changesSaved') as string });
    } catch (error: any) {
      console.error("Profile update error:", error);
      setProfileMessage({ type: 'error', text: error.message || 'Update failed' });
    }
  };

  const handleDeleteAccount = async () => {
    setShowDeleteAccountConfirm(true);
  };

  const confirmDeleteAccount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('works').delete().eq('user_id', session.user.id);
        await supabase.from('profiles').delete().eq('id', session.user.id);
        await supabase.auth.signOut();
        setStage('landing');
        setShowDeleteAccountConfirm(false);
        // Note: Full auth deletion requires server-side setup in Supabase
      }
    } catch (error: any) {
      console.error("Delete account error:", error);
      setProfileMessage({ type: 'error', text: t('failedToDelete') as string });
      setShowDeleteAccountConfirm(false);
    }
  };

  const handleDeleteWork = (workId: string) => {
    setWorkToDelete(workId);
  };

  const confirmDeleteWork = async () => {
    if (!workToDelete) return;
    try {
      if (isLoggedIn) {
        const { error } = await supabase.from('works').delete().eq('id', workToDelete);
        if (error) throw error;
      }
      
      cancelGenerationRef.current.add(workToDelete);
      setSavedWorks(prev => prev.filter(w => w.id !== workToDelete));
      
      if (currentWorkId === workToDelete) {
        handleStartNewWork();
      }
      
      setWorkToDelete(null);
      setProfileMessage({ type: 'success', text: t('workDeleted') as string });
    } catch (error: any) {
      console.error("Delete work error:", error);
      setProfileMessage({ type: 'error', text: t('failedToDelete') as string });
      setWorkToDelete(null);
    }
  };

  const renderAuthStage = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-md mx-auto mt-12 mb-24"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-indigo-100/50 dark:shadow-indigo-900/10 border border-slate-200 dark:border-slate-800 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg mb-6">
            <BookOpen className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
            {authMode === 'login' ? t('login') : t('signup')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            {t('appName')}
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleAuthSubmit}>
          {authError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
              {authError}
            </div>
          )}
          {authMode === 'signup' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('username')}</label>
              <input
                type="text"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white"
                placeholder={t('username') as string}
                required
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              {authMode === 'login' ? t('usernameOrEmail') : t('email')}
            </label>
            <input
              type={authMode === 'login' ? 'text' : 'email'}
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white"
              placeholder={authMode === 'login' ? t('usernameOrEmail') as string : t('email') as string}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('password')}</label>
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoadingAuth}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoadingAuth && <Loader2 className="w-5 h-5 animate-spin" />}
            {authMode === 'login' ? t('login') : t('signup')}
          </button>
        </form>

        <div className="mt-6 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white dark:bg-slate-900 text-slate-500">{t('or')}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={isLoadingAuth}
          className="mt-6 w-full py-3.5 px-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {t('continueWithGoogle')}
        </button>

        <div className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
          {authMode === 'login' ? t('dontHaveAccount') : t('alreadyHaveAccount')}{' '}
          <button
            onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
          >
            {authMode === 'login' ? t('signup') : t('login')}
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderProfileStage = () => {
    const loadWork = (work: SavedWork) => {
      setTitle(work.title);
      setType(work.type);
      setGenre(work.genre);
      setFullContent(work.fullContent);
      setGeneratedChapters(work.generatedChapters);
      setCurrentWorkId(work.id);
      
      // Restore generation parameters
      setWordsExact(work.wordsExact || '');
      setWordsMin(work.wordsMin || '');
      setWordsMax(work.wordsMax || '');
      setWordsCountType(work.wordsCountType as any || 'auto');
      setPagesExact(work.pagesExact || '');
      setPagesMin(work.pagesMin || '');
      setPagesMax(work.pagesMax || '');
      setPagesCountType(work.pagesCountType as any || 'auto');

      if (work.status === 'generating') {
        setGenerationProgress(work.progress || 0);
        setGenerationStatus(t('inProgress') as string);
        setStage('generating');
      } else if (work.status === 'error') {
        setStage('review');
      } else {
        setStage('complete');
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="max-w-6xl mx-auto mt-8 mb-24 flex flex-col md:flex-row gap-8"
      >
        {/* Sidebar */}
        <div className="w-full md:w-64 flex flex-col gap-2">
          <button
            onClick={() => setProfileTab('settings')}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl font-bold transition-all ${
              profileTab === 'settings' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Settings className="w-5 h-5" />
            {t('accountSettings')}
          </button>
          <button
            onClick={() => setProfileTab('works')}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl font-bold transition-all ${
              profileTab === 'works' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Layers className="w-5 h-5" />
            {t('myWorks')}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800">
          {profileTab === 'settings' ? (
            <div className="max-w-xl">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <User className="w-6 h-6 text-indigo-500" />
                {t('accountSettings')}
              </h2>
              
              {profileMessage.text && (
                <div className={`mb-6 p-4 rounded-xl text-sm font-bold ${
                  profileMessage.type === 'success' 
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' 
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                }`}>
                  {profileMessage.text}
                </div>
              )}
              
              <form className="space-y-5" onSubmit={handleUpdateProfile}>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('username')}</label>
                  <input
                    type="text"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('email')}</label>
                  <input
                    type="email"
                    value={authEmail}
                    disabled
                    className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none transition-all dark:text-slate-400 text-slate-500 cursor-not-allowed opacity-70"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('password')}</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white"
                    placeholder="••••••••"
                  />
                </div>
                
                <div className="pt-4 flex flex-col sm:flex-row gap-4">
                  <button
                    type="submit"
                    className="flex-1 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
                  >
                    {t('saveChanges')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="py-3.5 px-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('deleteAccount')}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <Book className="w-6 h-6 text-indigo-500" />
                {t('myWorks')}
              </h2>
              
              {savedWorks.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mb-4">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">{t('noWorksYet')}</p>
                  <button
                    onClick={handleStartNewWork}
                    className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold transition-all inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {t('startCreating')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedWorks.map((work) => (
                    <div 
                      key={work.id}
                      onClick={() => loadWork(work)}
                      className="group p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-indigo-500 dark:hover:border-indigo-500 cursor-pointer transition-all hover:shadow-md"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400">
                          {work.type === 'book' ? <BookOpen className="w-5 h-5" /> : <PenTool className="w-5 h-5" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                            {new Date(work.date).toLocaleDateString(appLanguage === 'ar' ? 'ar-SA' : 'en-US')}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWork(work.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {work.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
                        <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded-md text-xs font-medium">
                          {work.type === 'book' ? t('book') : t('novel')}
                        </span>
                        <span className="truncate">{work.genre}</span>
                      </div>
                      {work.status === 'generating' && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                            <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {t('inProgress')}</span>
                            <span>{work.progress || 0}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-indigo-600 dark:bg-indigo-500 h-1.5 rounded-full" style={{ width: `${work.progress || 0}%` }} />
                          </div>
                        </div>
                      )}
                      {work.status === 'error' && (
                        <div className="mt-3 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> {t('errorOccurredResume')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete Account Modal */}
        {showDeleteAccountConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{t('deleteAccount')}</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">{t('confirmDeleteAccount')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteAccountConfirm(false)}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={confirmDeleteAccount}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all"
                >
                  {t('delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Work Modal */}
        {workToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{t('delete')}</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">{t('confirmDeleteWork')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setWorkToDelete(null)}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={confirmDeleteWork}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all"
                >
                  {t('delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    );
  };

  const renderLandingStage = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full"
    >
      {/* Hero Section */}
      <section className="relative pt-32 pb-40 overflow-hidden bg-white dark:bg-slate-950">
        {/* Modern Mesh Gradient Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]"></div>
        
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-400/30 dark:bg-purple-900/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-70 animate-blob" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-indigo-400/30 dark:bg-indigo-900/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-96 h-96 bg-pink-400/30 dark:bg-pink-900/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-70 animate-blob animation-delay-4000" />

        <div className="max-w-5xl mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5, type: "spring" }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 font-bold text-sm mb-8 shadow-sm hover:shadow-md transition-shadow cursor-default"
          >
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>{t('appName')} 2.0 Is Here</span>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-6xl md:text-8xl font-black text-slate-900 dark:text-white mb-8 leading-[1.1] tracking-tight"
          >
            {String(t('heroTitle')).split(' ').map((word, i) => (
              <span key={i} className={i === 1 || i === 2 ? "text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400" : ""}>
                {word}{' '}
              </span>
            ))}
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            {t('heroSubtitle')}
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <button
              onClick={handleStartNewWork}
              className="group relative overflow-hidden bg-indigo-600 dark:bg-indigo-500 text-white font-bold text-lg px-10 py-4 rounded-full shadow-[0_0_40px_8px_rgba(79,70,229,0.3)] hover:shadow-[0_0_60px_12px_rgba(79,70,229,0.4)] hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 w-full sm:w-auto justify-center border border-indigo-500/50"
            >
              <span className="relative z-10">{t('getStarted')}</span>
              <ChevronRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
            <button
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-10 py-4 rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-md text-slate-700 dark:text-slate-200 font-bold text-lg border border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg transition-all duration-300 w-full sm:w-auto hover:-translate-y-1"
            >
              {t('learnMore')}
            </button>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 relative overflow-hidden bg-slate-900 dark:bg-slate-950">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 to-purple-700/90 dark:from-indigo-900/80 dark:to-purple-950/80 z-0"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay z-0"></div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-10"></div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-10"></div>
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-white/90 mb-2">
              {t('statsTitle')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col items-center text-center p-8 rounded-[2rem] bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors group"
            >
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:scale-110 group-hover:bg-indigo-500/50 transition-all duration-300 shadow-inner">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 mb-2">{t('stat1Value')}</div>
              <div className="text-indigo-200 font-medium text-lg tracking-wide">{t('stat1Label')}</div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center text-center p-8 rounded-[2rem] bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors group"
            >
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:scale-110 group-hover:bg-purple-500/50 transition-all duration-300 shadow-inner">
                <Globe className="w-8 h-8" />
              </div>
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 mb-2">{t('stat2Value')}</div>
              <div className="text-indigo-200 font-medium text-lg tracking-wide">{t('stat2Label')}</div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center text-center p-8 rounded-[2rem] bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors group"
            >
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:scale-110 group-hover:bg-pink-500/50 transition-all duration-300 shadow-inner">
                <Star className="w-8 h-8" />
              </div>
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 mb-2">{t('stat3Value')}</div>
              <div className="text-indigo-200 font-medium text-lg tracking-wide">{t('stat3Label')}</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative bg-white dark:bg-slate-950 overflow-hidden">
        {/* Dotted Pattern Background */}
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-50"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white dark:via-slate-950/50 dark:to-slate-950 pointer-events-none"></div>
        
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              {t('featuresTitle')}
            </h2>
            <div className="w-24 h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500 mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              whileHover={{ y: -10 }}
              className="p-8 rounded-[2rem] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-500"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-150"></div>
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/60 dark:to-blue-800/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 shadow-inner relative z-10 group-hover:scale-110 transition-transform duration-300">
                <Layout className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 relative z-10">{t('feature1Title')}</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg relative z-10">{t('feature1Desc')}</p>
            </motion.div>
            
            <motion.div
              whileHover={{ y: -10 }}
              className="p-8 rounded-[2rem] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all duration-500"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-150"></div>
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/60 dark:to-emerald-800/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6 shadow-inner relative z-10 group-hover:scale-110 transition-transform duration-300">
                <Globe className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 relative z-10">{t('feature2Title')}</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg relative z-10">{t('feature2Desc')}</p>
            </motion.div>
            
            <motion.div
              whileHover={{ y: -10 }}
              className="p-8 rounded-[2rem] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all duration-500"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-150"></div>
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/60 dark:to-purple-800/60 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mb-6 shadow-inner relative z-10 group-hover:scale-110 transition-transform duration-300">
                <FileDown className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 relative z-10">{t('feature3Title')}</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg relative z-10">{t('feature3Desc')}</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 relative overflow-hidden bg-slate-50 dark:bg-slate-900 border-t border-slate-200/50 dark:border-slate-800/50">
        {/* Soft glowing center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              {t('howItWorksTitle')}
            </h2>
            <div className="w-24 h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500 mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-1 bg-gradient-to-r from-indigo-200 via-violet-200 to-purple-200 dark:from-indigo-900 dark:via-violet-900 dark:to-purple-900 z-0 rounded-full opacity-50" />
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative z-10 flex flex-col items-center text-center group"
            >
              <div className="w-24 h-24 bg-white dark:bg-slate-900 border-4 border-indigo-100 dark:border-indigo-900/50 rounded-full flex items-center justify-center mb-8 shadow-xl group-hover:border-indigo-500 group-hover:shadow-indigo-500/20 transition-all duration-500 relative group-hover:scale-110">
                <div className="absolute inset-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-inner">1</div>
              </div>
              <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 w-full">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{t('step1Title')}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">{t('step1Desc')}</p>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="relative z-10 flex flex-col items-center text-center group"
            >
              <div className="w-24 h-24 bg-white dark:bg-slate-900 border-4 border-violet-100 dark:border-violet-900/50 rounded-full flex items-center justify-center mb-8 shadow-xl group-hover:border-violet-500 group-hover:shadow-violet-500/20 transition-all duration-500 relative group-hover:scale-110">
                <div className="absolute inset-2 bg-gradient-to-br from-violet-500 to-violet-600 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-inner">2</div>
              </div>
              <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 w-full">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{t('step2Title')}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">{t('step2Desc')}</p>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="relative z-10 flex flex-col items-center text-center group"
            >
              <div className="w-24 h-24 bg-white dark:bg-slate-900 border-4 border-purple-100 dark:border-purple-900/50 rounded-full flex items-center justify-center mb-8 shadow-xl group-hover:border-purple-500 group-hover:shadow-purple-500/20 transition-all duration-500 relative group-hover:scale-110">
                <div className="absolute inset-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-inner">3</div>
              </div>
              <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 w-full">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{t('step3Title')}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">{t('step3Desc')}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 relative overflow-hidden bg-white dark:bg-slate-950">
        {/* Diagonal lines pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }}></div>
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-slate-50 dark:from-slate-900 to-transparent"></div>
        
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <HelpCircle className="w-8 h-8" />
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              {t('faqTitle')}
            </h2>
          </div>
          
          <div className="space-y-4">
            {[1, 2, 3].map((num) => (
              <details key={num} className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700/50 transition-all duration-300 overflow-hidden [&_summary::-webkit-details-marker]:hidden open:bg-indigo-50/50 dark:open:bg-indigo-900/10">
                <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-lg text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  {t(`faq${num}Q` as any)}
                  <span className="transition-transform duration-300 group-open:rotate-180 bg-slate-100 dark:bg-slate-800 p-2 rounded-full group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    <ChevronDown className="w-5 h-5" />
                  </span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 dark:text-slate-400 text-lg leading-relaxed border-t border-slate-100 dark:border-slate-800/50 pt-4 mt-2">
                  {t(`faq${num}A` as any)}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </motion.div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans flex flex-col transition-colors duration-300" dir={appLanguage === 'ar' ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-50 w-full backdrop-blur-2xl bg-white/60 dark:bg-slate-950/60 border-b border-slate-200/50 dark:border-slate-800/50 shadow-[0_4px_30px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
        <div className="absolute inset-x-0 -bottom-[1px] h-[1px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setStage('landing')}>
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 group-hover:scale-105 transition-all duration-300">
              <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <BookOpen className="w-5 h-5 relative z-10" />
            </div>
            <span className="font-black text-2xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 tracking-tight group-hover:opacity-80 transition-opacity">{t('appName')}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="relative p-2.5 rounded-full bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all hover:shadow-sm hover:-translate-y-0.5"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setAppLanguage(appLanguage === 'ar' ? 'en' : 'ar')}
              className="px-4 py-2 rounded-full bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-bold text-sm hover:shadow-sm hover:-translate-y-0.5"
            >
              {appLanguage === 'ar' ? 'English' : 'العربية'}
            </button>
            <div className="h-8 w-px bg-slate-200/80 dark:bg-slate-800/80 hidden sm:block mx-1"></div>

            {stage !== 'setup' && stage !== 'generating' && stage !== 'auth' && (
              <button
                onClick={handleStartNewWork}
                className="hidden sm:flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-md shadow-indigo-200 dark:shadow-indigo-900/20 hover:shadow-lg hover:shadow-indigo-300 dark:hover:shadow-indigo-900/40 transition-all hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4" />
                {t('startCreating')}
              </button>
            )}
            
            {!isLoggedIn ? (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={() => { setAuthMode('login'); setStage('auth'); }}
                  className="px-5 py-2.5 rounded-full text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all hover:-translate-y-0.5"
                >
                  {t('login')}
                </button>
                <button
                  onClick={() => { setAuthMode('signup'); setStage('auth'); }}
                  className="px-5 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:bg-slate-800 dark:hover:bg-slate-100 shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
                >
                  {t('signup')}
                </button>
              </div>
            ) : (
              <div className="relative">
                <div 
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-md cursor-pointer hover:opacity-90 transition-opacity" 
                  onClick={() => setShowProfileMenu(!showProfileMenu)} 
                  title={authUsername || 'User'}
                >
                  {authUsername ? authUsername.charAt(0).toUpperCase() : 'U'}
                </div>
                
                <AnimatePresence>
                  {showProfileMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className={`absolute ${appLanguage === 'ar' ? 'left-0' : 'right-0'} mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50`}
                    >
                      <button
                        onClick={() => { setStage('profile'); setProfileTab('settings'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                      >
                        <User className="w-4 h-4" />
                        {t('myProfile')}
                      </button>
                      <button
                        onClick={() => { setStage('profile'); setProfileTab('works'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                      >
                        <Book className="w-4 h-4" />
                        {t('myWorks')}
                      </button>
                      <div className="h-px bg-slate-200 dark:bg-slate-800 my-1 mx-2"></div>
                      <button
                        onClick={handleLogout}
                        className="w-full text-start px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3"
                      >
                        <LogOut className="w-4 h-4" />
                        {t('logout')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow w-full">
        <AnimatePresence mode="wait">
          {stage === 'landing' && <motion.div key="landing">{renderLandingStage()}</motion.div>}
          {stage === 'auth' && <motion.div key="auth" className="p-4 md:p-8">{renderAuthStage()}</motion.div>}
          {stage === 'profile' && <motion.div key="profile" className="p-4 md:p-8">{renderProfileStage()}</motion.div>}
          {stage === 'setup' && <motion.div key="setup" className="p-4 md:p-8">{renderSetupStage()}</motion.div>}
          {stage === 'review' && <motion.div key="review" className="p-4 md:p-8">{renderReviewStage()}</motion.div>}
          {stage === 'generating' && <motion.div key="generating" className="p-4 md:p-8">{renderGeneratingStage()}</motion.div>}
          {stage === 'complete' && <motion.div key="complete" className="p-4 md:p-8">{renderCompleteStage()}</motion.div>}
        </AnimatePresence>
      </main>

      <footer className="relative bg-white/80 dark:bg-slate-950/80 border-t border-slate-200/50 dark:border-slate-800/50 pt-16 pb-8 overflow-hidden backdrop-blur-xl">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/10 dark:bg-violet-500/5 rounded-full blur-3xl -z-10"></div>
        
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-6 group cursor-pointer" onClick={() => setStage('landing')}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="font-black text-2xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 tracking-tight">{t('appName')}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-8">
              {t('footerDesc')}
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 transition-all hover:-translate-y-1">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 transition-all hover:-translate-y-1">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-6 text-lg">{t('footerLinks')}</h4>
            <ul className="space-y-3 text-slate-500 dark:text-slate-400">
              <li>
                <button onClick={() => setStage('landing')} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  {t('footerHome')}
                </button>
              </li>
              <li>
                <button onClick={handleStartNewWork} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  {t('footerCreate')}
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-6 text-lg">{t('footerLegal')}</h4>
            <ul className="space-y-3 text-slate-500 dark:text-slate-400">
              <li>
                <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  {t('footerPrivacy')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  {t('footerTerms')}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-16 pt-8 border-t border-slate-200/50 dark:border-slate-800/50 text-center flex flex-col items-center justify-center gap-3 relative z-10">
          <p className="text-slate-500 dark:text-slate-400 text-sm">© {new Date().getFullYear()} {t('appName')}. {t('footerRights')}</p>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-slate-400 dark:text-slate-500">by</span>
            <span className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">Master.Dev</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="px-2 py-1 rounded-md bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">SharkSite</span>
          </div>
        </div>
      </footer>

      {/* Hidden container for generating PDFs and Word Docs */}
      <div className="absolute w-0 h-0 overflow-hidden opacity-0 pointer-events-none">
        <div id="printable-content" dir={isRtl ? 'rtl' : 'ltr'} style={{ width: '800px', backgroundColor: 'white', color: 'black', margin: '0 auto' }}>
          <style>{`
            .pdf-section {
              font-family: 'Tajawal', Arial, sans-serif;
              color: #111827;
              line-height: 1.8;
              font-size: 16px;
              text-align: ${isRtl ? 'right' : 'left'};
              background-color: white;
              padding: 40px;
              width: 100%;
              margin: 0 auto;
              box-sizing: border-box;
            }
            .pdf-section p, .markdown-body p {
              margin-bottom: 16px;
              page-break-inside: avoid;
              break-inside: avoid;
              white-space: normal;
              word-wrap: break-word;
            }
            .pdf-section h1, .pdf-section h2, .pdf-section h3, .markdown-body h1, .markdown-body h2, .markdown-body h3 {
              page-break-after: avoid;
              break-after: avoid;
              page-break-inside: avoid;
              break-inside: avoid;
              color: #000;
              margin-top: 24px;
              margin-bottom: 16px;
              line-height: 1.4;
              font-weight: bold;
            }
            .pdf-section ul, .pdf-section ol, .markdown-body ul, .markdown-body ol {
              page-break-inside: avoid;
              break-inside: avoid;
              margin-bottom: 16px;
              padding-inline-start: 40px;
            }
            .pdf-section li, .markdown-body li {
              margin-bottom: 8px;
            }
            .pdf-cover {
              padding-top: 300px;
              text-align: center;
              page-break-after: always;
            }
            .pdf-cover h1 {
              font-size: 48px;
              margin-bottom: 24px;
              text-align: center;
            }
            .pdf-cover p {
              font-size: 24px;
              color: #4b5563;
              text-indent: 0;
              text-align: center;
            }
            .pdf-chapter {
              padding-top: 20px;
              page-break-after: always;
            }
            .pdf-chapter-title {
              font-size: 32px !important;
              text-align: center !important;
              margin-bottom: 40px !important;
              padding-bottom: 20px !important;
              border-bottom: 2px solid #e5e7eb;
            }
          `}</style>

          {/* Cover Page */}
          <div id="pdf-cover" className="pdf-section pdf-cover">
            <h1>{title || t('untitled')}</h1>
            {genre && <p>{genre === 'أخرى' || genre === 'Other' ? customGenre : genre}</p>}
          </div>

          {/* Chapters Content */}
          {fullContent.map((section, index) => (
            <div key={index} id={`pdf-chapter-${index}`} className="pdf-section pdf-chapter">
              <h2 className="pdf-chapter-title">{section.title}</h2>
              <div 
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: marked.parse(section.content) as string }} 
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
