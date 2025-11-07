
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MushroomInfo, GroundingSource, HistoryEntry, Recipe, ComparisonInfo } from './types';
import { identifyMushroomFromImage, identifyMushroomFromText, compareMushrooms } from './services/geminiService';
import { Icon } from './components/Icons';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ManualModal } from './components/ManualModal';
import { useApiKey } from './contexts/ApiKeyContext';
import { useLanguage } from './contexts/LanguageContext';

declare global {
  interface Window { jspdf: any; html2canvas: any; }
}

// Helper for haptic feedback on supported devices
const triggerHapticFeedback = (pattern: number | number[] = 50) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.log("Haptic feedback is not available or has been disabled by the user.");
    }
  }
};

type AppView = 'main' | 'comparator';

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve((reader.result as string).split(',')[1]);
  reader.onerror = (error) => reject(error);
});

const blobUrlToDataUrl = (blobUrl: string): Promise<string> => new Promise((resolve, reject) => {
  fetch(blobUrl).then(res => res.blob()).then(blob => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  }).catch(reject);
});

// Helper function to create a placeholder SVG image
const createPlaceholderImage = (text: string): string => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300" style="background-color:#e2e8f0;">
       <g transform="translate(150, 150) scale(4)">
        <path fill="#94a3b8" d="M20 11.15v-.15a8 8 0 1 0-16 0v.15 M12 12v6 M12 22h0 M10 18h4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/>
      </g>
      <text x="150" y="240" font-family="sans-serif" font-size="18" fill="#475569" text-anchor="middle" dominant-baseline="middle">${text}</text>
    </svg>
  `.trim();
  const base64Svg = btoa(svg.replace(/\n/g, ''));
  return `data:image/svg+xml;base64,${base64Svg}`;
};

// Creates a compressed thumbnail from a data URL to save storage space.
const createThumbnail = (dataUrl: string, maxSize = 400): Promise<string> => {
    return new Promise((resolve) => {
        if (!dataUrl || !dataUrl.startsWith('data:image')) {
            resolve(dataUrl);
            return;
        }

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Failed to get canvas context');
                resolve(dataUrl);
                return;
            }

            let { width, height } = img;
            if (width > height) {
                if (width > maxSize) { height *= maxSize / width; width = maxSize; }
            } else {
                if (height > maxSize) { width *= maxSize / height; height = maxSize; }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => {
            console.error("Failed to load image for thumbnail creation.");
            resolve(dataUrl);
        };
        img.src = dataUrl;
    });
};

// --- NOTIFICATION COMPONENT ---
const Notification: React.FC<{ message: string; onClose: () => void; }> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-down" role="alert" aria-live="assertive">
      <div className="flex items-center gap-3 bg-green-600 dark:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-full shadow-lg">
        <Icon name="bookmark" className="w-5 h-5" />
        <span>{message}</span>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const SearchInput: React.FC<{ onSearch: (query: string) => void; isLoading: boolean; placeholder?: string; }> = ({ onSearch, isLoading, placeholder }) => {
  const [query, setQuery] = useState('');
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (query.trim() && !isLoading) {
        triggerHapticFeedback();
        onSearch(query.trim()); 
    }
  };
  return (
    <form onSubmit={handleSubmit} className="w-full mb-6">
      <div className="relative">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} disabled={isLoading} placeholder={placeholder} className="w-full pl-4 pr-12 py-3 bg-white dark:bg-slate-700 border-green-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-emerald-500 transition-shadow dark:text-slate-200"/>
        <button type="submit" disabled={isLoading || !query.trim()} className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-green-600 dark:text-emerald-400 hover:text-green-800 dark:hover:text-emerald-300 disabled:text-gray-300 dark:disabled:text-slate-500 transition-colors">
          <Icon name="search" className="w-6 h-6" />
        </button>
      </div>
    </form>
  );
};

const MainInput: React.FC<{ onImageSelect: (file: File) => void; isLoading: boolean; onTextSearch: (query: string) => void; onError: (message: string) => void; }> = ({ onImageSelect, isLoading, onTextSearch, onError }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) { onError('The selected file is not an image. Please choose a JPG, PNG, WEBP, etc.'); if (event.target) event.target.value = ''; return; }
      onImageSelect(file);
    }
    if (event.target) event.target.value = '';
  };
  
  return (
    <div className="w-full max-w-md p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-green-200 dark:border-emerald-700 text-center">
      <div className="flex justify-center items-center gap-3 mb-4">
        <Icon name="mushroom" className="w-10 h-10 text-green-800 dark:text-emerald-200" />
        <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200">{t('appName')}</h2>
      </div>
      <p className="text-gray-600 dark:text-slate-400 mb-6">{t('identifyMushroomTitle')}</p>
      
      <SearchInput onSearch={onTextSearch} isLoading={isLoading} placeholder={t('searchByNamePlaceholder')} />
      
      <div className="relative flex items-center my-4">
        <div className="flex-grow border-t border-gray-300 dark:border-slate-600"></div>
        <span className="flex-shrink mx-4 text-gray-500 dark:text-slate-400 font-semibold text-sm">{t('orSeparator')}</span>
        <div className="flex-grow border-t border-gray-300 dark:border-slate-600"></div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileChange} className="hidden" disabled={isLoading} />
          <button onClick={() => { cameraInputRef.current?.click(); triggerHapticFeedback(); }} disabled={isLoading} className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 dark:bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 dark:hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-emerald-500 focus:ring-offset-2 transition-transform transform hover:scale-105">
          <Icon name="camera" className="w-5 h-5" />{t('takePhoto')}
          </button>
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" disabled={isLoading} />
          <button onClick={() => { fileInputRef.current?.click(); triggerHapticFeedback(); }} disabled={isLoading} className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-700 text-green-700 dark:text-emerald-300 font-semibold rounded-lg shadow-md border border-green-300 dark:border-slate-600 hover:bg-green-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-emerald-500 focus:ring-offset-2 transition-transform transform hover:scale-105">
          <Icon name="upload" className="w-5 h-5" />{t('uploadFile')}
          </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-6 max-w-sm mx-auto">{t('warningDisclaimer')}</p>
    </div>
  );
};

const Loader: React.FC<{ message: string, subMessage: string }> = ({ message, subMessage }) => (
    <div className="text-center p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg max-w-md">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 dark:border-emerald-500 mx-auto"></div>
        <p className="mt-6 text-lg font-semibold text-green-800 dark:text-emerald-200">{message}</p>
        <p className="mt-2 text-gray-600 dark:text-slate-400">{subMessage}</p>
    </div>
);

const ToxicityMeter: React.FC<{ level: MushroomInfo['toxicidad']['nivelToxicidad'] }> = ({ level }) => {
    const { t } = useLanguage();
    const levels = ['Edible', 'Caution', 'Inedible', 'Poisonous', 'Lethal'];
    const levelIndex = levels.indexOf(level);

    const config: Record<typeof levels[number], { textKey: string; color: string; barColor: string }> = {
      Edible: { textKey: 'toxicityLevel_Edible', color: 'bg-green-500', barColor: 'bg-green-200 dark:bg-green-800' },
      Caution: { textKey: 'toxicityLevel_Caution', color: 'bg-yellow-500', barColor: 'bg-yellow-200 dark:bg-yellow-800' },
      Inedible: { textKey: 'toxicityLevel_Inedible', color: 'bg-slate-500', barColor: 'bg-slate-200 dark:bg-slate-800' },
      Poisonous: { textKey: 'toxicityLevel_Poisonous', color: 'bg-red-500', barColor: 'bg-red-200 dark:bg-red-800' },
      Lethal: { textKey: 'toxicityLevel_Lethal', color: 'bg-purple-600', barColor: 'bg-purple-200 dark:bg-purple-800' },
    };
    
    const { textKey, color, barColor } = config[level] || config.Caution;
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">{t('toxicityLevel')}</span>
                <span className={`text-sm font-bold ${color.replace('bg-', 'text-')}`}>{t(textKey)}</span>
            </div>
            <div className={`w-full h-2.5 rounded-full flex overflow-hidden ${barColor}`}>
                {levels.map((l, i) => (
                    <div key={l} className={`w-1/5 h-full ${i <= levelIndex ? color : ''}`}></div>
                ))}
            </div>
        </div>
    );
};

interface ShareableCardProps {
  mushroomInfo: MushroomInfo;
  imageSrc: string;
  onRef: (node: HTMLDivElement | null) => void;
}

const ShareableCard: React.FC<ShareableCardProps> = ({ mushroomInfo, imageSrc, onRef }) => {
    const { t } = useLanguage();
    return (
        <div ref={onRef} className="w-[400px] bg-white dark:bg-slate-800 font-sans shadow-2xl rounded-lg overflow-hidden border border-green-200 dark:border-emerald-700">
            <img src={imageSrc} alt={mushroomInfo.nombreComun} className="w-full h-52 object-cover" />
            <div className="p-5">
                <h2 className="text-2xl font-extrabold text-green-800 dark:text-emerald-200">{mushroomInfo.nombreComun}</h2>
                <p className="text-md text-gray-500 dark:text-slate-400 italic mb-3">{mushroomInfo.nombreCientifico}</p>
                <div className="mb-4">
                  <ToxicityMeter level={mushroomInfo.toxicidad.nivelToxicidad} />
                </div>
                 <p className="text-sm text-gray-700 dark:text-slate-300 line-clamp-3">{mushroomInfo.descripcionGeneral}</p>
            </div>
            <div className="px-5 py-3 bg-green-50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-green-800 dark:text-emerald-400">
                <span className="font-bold">{t('appName')}</span>
                <Icon name="mushroom" className="w-4 h-4" />
            </div>
        </div>
    );
};

interface ResultCardProps { 
    result: HistoryEntry; 
    onReset: () => void; 
    isInCollection: boolean; 
    onToggleCollection: () => void; 
    onStartCompare?: () => void;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, onReset, isInCollection, onToggleCollection, onStartCompare }) => {
    const { mushroomInfo, sources, imageSrc, mapaDistribucionSrc, imageGenerationFailed } = result;
    const { t } = useLanguage();
    const resultCardRef = useRef<HTMLDivElement>(null);
    const shareableCardRef = useRef<HTMLDivElement | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [showShareableCard, setShowShareableCard] = useState(false);

    if (!mushroomInfo) return null;

    const [sharedRecipe, setSharedRecipe] = useState<string | null>(null);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({ [t('toxicity')]: true, [t('similarMushrooms')]: true });

    const toggleSection = (title: string) => setOpenSections(prev => ({...prev, [title]: !prev[title]}));

    const handleShareRecipe = async (recipe: Recipe) => {
        triggerHapticFeedback();
        const shareText = `${t('appName')} Recipe: ${recipe.nombre}\n\n${t('ingredients')}:\n- ${recipe.ingredientes.join('\n- ')}\n\n${t('instructions')}:\n${recipe.instrucciones}`;
        try {
            if (navigator.share) await navigator.share({ title: `Recipe: ${recipe.nombre}`, text: shareText, url: window.location.href });
            else { await navigator.clipboard.writeText(shareText); setSharedRecipe(recipe.nombre); setTimeout(() => setSharedRecipe(null), 2500); }
        } catch (err) {
            try { await navigator.clipboard.writeText(shareText); setSharedRecipe(recipe.nombre); setTimeout(() => setSharedRecipe(null), 2500); } catch (clipErr) { alert('Could not share or copy recipe.'); }
        }
    };
    
    const handleShareAsImage = async () => {
        if (!shareableCardRef.current) {
            setShowShareableCard(true);
            setTimeout(handleShareAsImage, 100);
            return;
        }
        setIsSharing(true);
        triggerHapticFeedback();

        try {
            const canvas = await window.html2canvas(shareableCardRef.current, { useCORS: true, backgroundColor: null });
            canvas.toBlob(async (blob) => {
                if (!blob) { alert('Could not generate image.'); setIsSharing(false); return; }
                const file = new File([blob], `${mushroomInfo.nombreComun}.png`, { type: 'image/png' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: mushroomInfo.nombreComun, text: `${t('checkOutMushroom')} ${mushroomInfo.nombreComun} - ${t('identifiedWith')} ${t('appName')}` });
                } else {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `${mushroomInfo.nombreComun.replace(/ /g, '_')}.png`;
                    link.click();
                }
            }, 'image/png');
        } catch (error) { console.error('Sharing failed:', error); alert('Could not share image.'); } finally { setIsSharing(false); setShowShareableCard(false); }
    };

    const handleExportPdf = async () => {
        if (!resultCardRef.current || !mushroomInfo) return;
        setIsExporting(true);
        triggerHapticFeedback();
        const buttonsToHide = resultCardRef.current.querySelectorAll('.hide-on-export');
        buttonsToHide.forEach(btn => ((btn as HTMLElement).style.visibility = 'hidden'));
        const originalOpenSections = { ...openSections };
        
        const allPossibleSections = [
            mapaDistribucionSrc ? t('distributionMap') : null,
            mushroomInfo.usosCulinarios?.length > 0 ? t('culinaryUses') : null,
            mushroomInfo.toxicidad ? t('toxicity') : null,
            mushroomInfo.hongosSimilares?.length > 0 ? t('similarMushrooms') : null,
            mushroomInfo.recetas?.length > 0 ? t('recipes') : null,
            sources.length > 0 ? t('sources') : null,
        ].filter(Boolean) as string[];

        const allOpenState = allPossibleSections.reduce((acc, title) => ({ ...acc, [title]: true }), {});
        setOpenSections(allOpenState);
        
        setTimeout(() => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
            doc.html(resultCardRef.current, {
                callback: (doc: any) => {
                    doc.save(`${mushroomInfo.nombreComun.replace(/ /g, '_')}.pdf`);
                    setIsExporting(false);
                    setOpenSections(originalOpenSections);
                    buttonsToHide.forEach(btn => ((btn as HTMLElement).style.visibility = 'visible'));
                },
                margin: [40, 40, 40, 40],
                autoPaging: 'text',
                html2canvas: { scale: 0.7, useCORS: true },
                width: 515,
                windowWidth: resultCardRef.current.offsetWidth,
            });
        }, 500);
    };

    const Section: React.FC<{ title: string; icon: string; children: React.ReactNode; }> = ({ title, icon, children }) => {
        const isOpen = openSections[title] ?? false;
        return (
            <div className="mb-2 border-b border-gray-200 dark:border-slate-700 last:border-b-0">
                <button className="w-full flex justify-between items-center py-4 focus:outline-none text-left" onClick={() => toggleSection(title)} aria-expanded={isOpen}>
                    <div className="flex items-center min-w-0 mr-4">
                        <Icon name={icon} className="w-7 h-7 text-green-700 dark:text-emerald-400 mr-3 flex-shrink-0" />
                        <h3 className="text-xl font-bold text-green-900 dark:text-emerald-200 break-words">{title}</h3>
                    </div>
                    <Icon name="chevron-down" className={`w-6 h-6 text-gray-500 dark:text-slate-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-screen' : 'max-h-0'}`}>
                    <div className="pl-10 pb-6 text-gray-700 dark:text-slate-300 text-base">{children}</div>
                </div>
            </div>
        );
    };

    const getToxicityBadge = (level: MushroomInfo['toxicidad']['nivelToxicidad']) => {
        const config: Record<typeof level, { textKey: string; color: string; }> = {
            Edible: { textKey: 'toxicityLevel_Edible', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
            Caution: { textKey: 'toxicityLevel_Caution', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
            Inedible: { textKey: 'toxicityLevel_Inedible', color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300' },
            Poisonous: { textKey: 'toxicityLevel_Poisonous', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
            Lethal: { textKey: 'toxicityLevel_Lethal', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
        };
        const { textKey, color } = config[level] || config.Caution;
        return <span className={`px-3 py-1 text-sm font-bold rounded-full ${color}`}>{t(textKey)}</span>;
    };
  
  return (
    <>
    {showShareableCard && (
        <div className="fixed top-0 left-[-9999px]" aria-hidden="true">
            <ShareableCard mushroomInfo={mushroomInfo} imageSrc={imageSrc} onRef={(node) => shareableCardRef.current = node} />
        </div>
    )}
    <div ref={resultCardRef} className="w-full max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden my-8 border border-green-200 dark:border-emerald-800">
        <div className="p-6 md:p-8">
            <div className="md:flex md:gap-8">
                <div className="md:w-1/3 mb-6 md:mb-0">
                    <img src={imageSrc} alt={mushroomInfo.nombreComun} className="rounded-xl shadow-lg w-full object-cover aspect-square"/>
                    {imageGenerationFailed && (<div className="mt-2 p-2 bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg text-center"><p className="text-xs text-amber-800 dark:text-amber-300">{t('imageGenerationFailedWarning')}</p></div>)}
                </div>
                <div className="md:w-2/3">
                    <div className="mb-4">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-green-800 dark:text-emerald-200 break-words">{mushroomInfo.nombreComun}</h2>
                        <p className="text-lg sm:text-xl text-gray-500 dark:text-slate-400 italic mt-1 break-words">{mushroomInfo.nombreCientifico}</p>
                        {mushroomInfo.sinonimos?.length > 0 && <p className="text-sm text-gray-600 dark:text-slate-300 mt-2 break-words"><strong>{t('alsoKnownAs')}:</strong> {mushroomInfo.sinonimos.join(', ')}</p>}
                    </div>
                    <div className="flex flex-wrap justify-start sm:justify-end gap-2">
                        <button onClick={handleShareAsImage} disabled={isSharing} className="hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 disabled:opacity-50">
                            {isSharing ? <span className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin"></span> : <Icon name="share-up" className="w-4 h-4" />}
                            {isSharing ? t('sharing') : t('share')}
                        </button>
                        {onStartCompare && (<button onClick={() => { onStartCompare(); triggerHapticFeedback(); }} className="hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"><Icon name="compare" className="w-4 h-4" />{t('compare')}</button>)}
                        <button onClick={onToggleCollection} className={`hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${ isInCollection ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 focus:ring-amber-500 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600' }`}><Icon name="bookmark" className="w-4 h-4" />{isInCollection ? t('saved') : t('save')}</button>
                        <button onClick={handleExportPdf} disabled={isExporting} className="hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 disabled:opacity-50">
                            {isExporting ? <span className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin"></span> : <Icon name="download" className="w-4 h-4" />}
                            {isExporting ? t('exporting') : t('exportToPdf')}
                        </button>
                    </div>
                    <div className="mt-4">
                      <ToxicityMeter level={mushroomInfo.toxicidad.nivelToxicidad} />
                    </div>
                    <p className="text-gray-700 dark:text-slate-300 leading-relaxed mt-4 break-words">{mushroomInfo.descripcionGeneral}</p>
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
                        <div className="p-4 bg-green-50 dark:bg-emerald-900/40 rounded-lg"><Icon name="globe" className="w-8 h-8 text-green-600 dark:text-emerald-500 mx-auto mb-2" /><h4 className="font-semibold text-sm text-green-800 dark:text-emerald-300">{t('habitat')}</h4><p className="text-sm text-gray-600 dark:text-slate-400 break-words">{mushroomInfo.habitat}</p></div>
                        <div className="p-4 bg-green-50 dark:bg-emerald-900/40 rounded-lg"><Icon name="sparkles" className="w-8 h-8 text-green-600 dark:text-emerald-500 mx-auto mb-2" /><h4 className="font-semibold text-sm text-green-800 dark:text-emerald-300">{t('season')}</h4><p className="text-sm text-gray-600 dark:text-slate-400 break-words">{mushroomInfo.temporada}</p></div>
                    </div>
                </div>
            </div>
            <div className="mt-8 border-t border-green-200 dark:border-emerald-800 pt-2">
              <Section title={t('toxicity')} icon="cross">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <h4 className="font-semibold text-gray-800 dark:text-slate-200">{t('toxicityLevel')}:</h4>
                        {getToxicityBadge(mushroomInfo.toxicidad.nivelToxicidad)}
                    </div>
                    <p className="bg-yellow-100 dark:bg-yellow-900/40 border-l-4 border-yellow-500 dark:border-yellow-600 text-yellow-800 dark:text-yellow-300 p-4 rounded-r-lg break-words">{mushroomInfo.toxicidad.descripcion}</p>
                    {mushroomInfo.toxicidad.compuestosToxicos.length > 0 && (<div><h4 className="font-semibold text-gray-800 dark:text-slate-200 mb-1">{t('toxicCompounds')}:</h4><ul className="list-disc pl-5 text-sm space-y-1">{mushroomInfo.toxicidad.compuestosToxicos.map((c, i) => <li key={i} className="break-words">{c}</li>)}</ul></div>)}
                    {mushroomInfo.toxicidad.sintomas && (<div><h4 className="font-semibold text-gray-800 dark:text-slate-200 mb-1">{t('symptoms')}:</h4><p className="text-sm">{mushroomInfo.toxicidad.sintomas}</p></div>)}
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg">
                        <h4 className="font-bold text-red-800 dark:text-red-200 flex items-center gap-2"><Icon name="cross" className="w-5 h-5" />{t('firstAid')}</h4>
                        <p className="mt-2 text-red-700 dark:text-red-300 text-sm break-words">{mushroomInfo.toxicidad.primerosAuxilios}</p>
                    </div>
                </div>
              </Section>
              {mushroomInfo.hongosSimilares?.length > 0 && (
                <Section title={t('similarMushrooms')} icon="cross">
                    <div className="space-y-4">{mushroomInfo.hongosSimilares.map((similar, i) => (
                        <div key={i} className={`p-4 border rounded-lg ${similar.esToxico ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/40' : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40'}`}>
                            <h4 className={`font-bold text-lg ${similar.esToxico ? 'text-red-900 dark:text-red-200' : 'text-amber-900 dark:text-amber-200'} break-words`}>{similar.nombreComun}</h4><p className={`text-sm ${similar.esToxico ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'} italic mb-2 break-words`}>{similar.nombreCientifico}</p>
                            <p className={`font-semibold ${similar.esToxico ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>{t('keyDifference')}:</p><p className={`${similar.esToxico ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'} break-words`}>{similar.diferenciaClave}</p>
                        </div>))}</div>
                    <p className="mt-4 text-sm text-gray-500 dark:text-slate-400"><strong>{t('importantDisclaimerSimilar')}</strong></p>
                </Section>
              )}
              {mapaDistribucionSrc && <Section title={t('distributionMap')} icon="map"><div className="space-y-4"><img src={mapaDistribucionSrc} alt={`Map of ${mushroomInfo.nombreComun}`} className="rounded-lg shadow-md w-full object-contain" /><p className="break-words">{mushroomInfo.distribucionGeografica}</p></div></Section>}
              {mushroomInfo.usosCulinarios?.length > 0 && <Section title={t('culinaryUses')} icon="utensils"><ul className="list-disc pl-5 space-y-1">{mushroomInfo.usosCulinarios.map((uso, i) => <li key={i} className="break-words">{uso}</li>)}</ul></Section>}
              {mushroomInfo.recetas?.length > 0 && (
              <Section title={t('recipes')} icon="pot">
                {mushroomInfo.recetas.map((recipe, i) => (
                  <div key={i} className="mb-6 p-4 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900/50">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-lg text-green-800 dark:text-emerald-300 break-words">{recipe.nombre}</h4>
                        <button onClick={() => handleShareRecipe(recipe)} className={`hide-on-export inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${ sharedRecipe === recipe.nombre ? 'bg-blue-100 text-blue-800 focus:ring-blue-500 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600' }`} disabled={sharedRecipe === recipe.nombre}><Icon name={sharedRecipe === recipe.nombre ? 'clipboard-check' : 'share-up'} className="w-3 h-3" />{sharedRecipe === recipe.nombre ? t('copied') : t('share')}</button>
                    </div>
                    <div className="mb-3"><h5 className="font-semibold text-gray-700 dark:text-slate-300">{t('ingredients')}:</h5><ul className="list-disc pl-5 text-gray-600 dark:text-slate-400">{recipe.ingredientes.map((ing, j) => <li key={j} className="break-words">{ing}</li>)}</ul></div>
                    <div className="mb-3"><h5 className="font-semibold text-gray-700 dark:text-slate-300">{t('instructions')}:</h5><p className="text-gray-600 dark:text-slate-400 break-words">{recipe.instrucciones}</p></div>
                  </div>
                ))}
              </Section>
              )}
              {sources.length > 0 && (<Section title={t('sources')} icon="link"><ul className="space-y-2">{sources.map((source, i) => (<li key={i}><a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-800 dark:hover:text-blue-300 transition-colors flex items-start gap-2"><span className="flex-shrink-0 pt-1"><Icon name="link" className="w-4 h-4" /></span><span className="truncate">{source.title}</span></a></li>))}</ul></Section>)}
            </div>
        </div>
        <div className="p-6 bg-gray-50 dark:bg-slate-900/50 text-center"><button onClick={() => { onReset(); triggerHapticFeedback(); }} className="hide-on-export px-8 py-3 bg-green-600 dark:bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 dark:hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-transform transform hover:scale-105">{t('anotherQuery')}</button></div>
    </div>
    </>
  );
};

const HistoryModal: React.FC<{ isOpen: boolean; onClose: () => void; history: HistoryEntry[]; onSelectItem: (item: HistoryEntry) => void; onClearHistory: () => void; }> = ({ isOpen, onClose, history, onSelectItem, onClearHistory }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center"><h2 className="text-2xl font-bold text-green-900 dark:text-emerald-200">{t('historyModalTitle')}</h2><button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
        <div className="overflow-y-auto p-2 flex-grow">
          {history.length > 0 ? (<ul>{history.map((item) => { const title = item.mushroomInfo?.nombreComun || '...'; return (<li key={item.id}><button onClick={() => { onSelectItem(item); triggerHapticFeedback(); }} className="w-full text-left p-4 flex items-center gap-4 rounded-lg hover:bg-green-50 dark:hover:bg-emerald-900/50 transition-colors"><img src={item.imageSrc} alt={title} className="w-16 h-16 object-cover rounded-md shadow-sm flex-shrink-0" /><div className="flex-grow"><p className="font-semibold text-green-800 dark:text-emerald-300 flex items-center gap-2"><Icon name="mushroom" className="w-4 h-4 text-gray-400 dark:text-slate-500" /> {title}</p><p className="text-sm text-gray-500 dark:text-slate-400">{new Date(item.timestamp).toLocaleString()}</p></div></button></li>);})}</ul>) : (<div className="text-center p-10"><Icon name="history" className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" /><p className="text-gray-500 dark:text-slate-400">{t('noHistory')}</p></div>)}
        </div>
        {history.length > 0 && (<div className="p-4 border-t border-gray-200 dark:border-slate-700 text-right"><button onClick={() => { triggerHapticFeedback(); if (window.confirm(t('clearHistoryConfirm'))) { onClearHistory();}}} className="px-4 py-2 bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-semibold rounded-lg hover:bg-red-100 dark:hover:bg-red-900/80 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">{t('clearHistory')}</button></div>)}
      </div>
    </div>
  );
};

const CollectionModal: React.FC<{ isOpen: boolean; onClose: () => void; collection: HistoryEntry[]; onSelectItem: (item: HistoryEntry) => void; onRemoveItem: (id: string) => void; onExport: () => void; sortOrder: string; onSortOrderChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; nameFilter: string; onNameFilterChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onStartCompare: (item: HistoryEntry) => void; }> = ({ isOpen, onClose, collection, onSelectItem, onRemoveItem, onExport, sortOrder, onSortOrderChange, nameFilter, onNameFilterChange, onStartCompare }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center flex-shrink-0"><h2 className="text-2xl font-bold text-green-900 dark:text-emerald-200">{t('collectionModalTitle')}</h2><button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex-shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Icon name="search" className="w-5 h-5 text-gray-400" /></span><input type="text" placeholder={t('filterByName')} value={nameFilter} onChange={onNameFilterChange} className="w-full pl-10 pr-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-green-500 dark:focus:ring-emerald-500 dark:text-slate-200"/></div>
                <div className="md:col-span-1"><select value={sortOrder} onChange={onSortOrderChange} className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-green-500 dark:focus:ring-emerald-500 dark:text-slate-200"><option value="date-desc">{t('sortDateDesc')}</option><option value="date-asc">{t('sortDateAsc')}</option><option value="name-asc">{t('sortNameAsc')}</option><option value="name-desc">{t('sortNameDesc')}</option></select></div>
            </div>
        </div>
        <div className="overflow-y-auto p-2 flex-grow">
          {collection.length > 0 ? (<ul>{collection.map((item) => { const title = item.mushroomInfo?.nombreComun || '...'; return (<li key={item.id} className="p-2 flex items-center gap-2 group"><button onClick={() => { onSelectItem(item); triggerHapticFeedback(); }} className="w-full text-left flex items-center gap-4 rounded-lg hover:bg-green-50 dark:hover:bg-emerald-900/50 transition-colors p-2 flex-grow"><img src={item.imageSrc} alt={title} className="w-16 h-16 object-cover rounded-md shadow-sm flex-shrink-0" /><div className="flex-grow"><p className="font-semibold text-green-800 dark:text-emerald-300 flex items-center gap-2"><Icon name="mushroom" className="w-4 h-4 text-gray-400 dark:text-slate-500" /> {title}</p><p className="text-sm text-gray-500 dark:text-slate-400">{new Date(item.timestamp).toLocaleDateString()}</p></div></button><button onClick={(e) => { e.stopPropagation(); onStartCompare(item); triggerHapticFeedback(); }} className="p-2 rounded-full text-gray-400 dark:text-slate-500 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0" aria-label={t('compare')}><Icon name="compare" className="w-5 h-5" /></button><button onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); triggerHapticFeedback(); }} className="p-2 rounded-full text-gray-400 dark:text-slate-500 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0" aria-label={t('removeFromCollection')}><Icon name="trash" className="w-5 h-5" /></button></li>);})}</ul>) : (<div className="text-center p-10"><Icon name="book" className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" /><p className="text-gray-500 dark:text-slate-400">{t('noCollection')}</p></div>)}
        </div>
        {collection.length > 0 && (<div className="p-4 border-t border-gray-200 dark:border-slate-700 text-right flex-shrink-0"><button onClick={() => { onExport(); triggerHapticFeedback(); }} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">{t('exportToJson')}</button></div>)}
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

function App() {
  const [view, setView] = useState<AppView>('main');
  const [image, setImage] = useState<{ file: File; src: string; mimeType: string; } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTextSearching, setIsTextSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<HistoryEntry | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [collection, setCollection] = useState<HistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [comparisonMushrooms, setComparisonMushrooms] = useState<{ mushroomA: HistoryEntry | null, mushroomB: HistoryEntry | null }>({ mushroomA: null, mushroomB: null });
  const [comparisonResult, setComparisonResult] = useState<ComparisonInfo | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  
  const { effectiveApiKey } = useApiKey();
  const { t, language, setLanguage } = useLanguage();

  const [collectionSortOrder, setCollectionSortOrder] = useState('date-desc');
  const [collectionNameFilter, setCollectionNameFilter] = useState('');

  useEffect(() => {
    try {
        const storedHistory = localStorage.getItem('mushroomHistory');
        if (storedHistory) setHistory(JSON.parse(storedHistory));
    } catch (e) {
        console.error("Failed to load/parse history from localStorage.", e);
    }
    try {
        const storedCollection = localStorage.getItem('mushroomCollection');
        if (storedCollection) setCollection(JSON.parse(storedCollection));
    } catch (e) {
        console.error("Failed to load/parse collection from localStorage.", e);
    }
  }, []);

  useEffect(() => {
    if (!effectiveApiKey) {
      setIsApiKeyModalOpen(true);
    }
  }, [effectiveApiKey]);

  const saveHistory = (newHistory: HistoryEntry[]) => { const sorted = newHistory.sort((a, b) => b.timestamp - a.timestamp); setHistory(sorted); localStorage.setItem('mushroomHistory', JSON.stringify(sorted)); };
  const saveCollection = (newCollection: HistoryEntry[]) => { setCollection(newCollection); localStorage.setItem('mushroomCollection', JSON.stringify(newCollection)); };
  
  const handleReset = useCallback(() => { 
    setImage(null); 
    setCurrentResult(null); 
    setError(null); 
    setIsLoading(false); 
    setIsTextSearching(false); 
    setView('main'); 
    setComparisonMushrooms({ mushroomA: null, mushroomB: null }); 
    setComparisonResult(null); 
  }, []);
  
  const handleImageSelect = useCallback((file: File) => { handleReset(); const src = URL.createObjectURL(file); setImage({ file, src, mimeType: file.type }); }, [handleReset]);
  
  const handleProcessResult = async (newEntry: HistoryEntry) => {
    triggerHapticFeedback([100, 30, 100]);
    try {
        const thumbImageSrc = await createThumbnail(newEntry.imageSrc);
        const thumbMapSrc = newEntry.mapaDistribucionSrc ? await createThumbnail(newEntry.mapaDistribucionSrc) : undefined;
        
        const finalEntry = { ...newEntry, imageSrc: thumbImageSrc, mapaDistribucionSrc: thumbMapSrc };

        setCurrentResult(finalEntry);
        saveHistory([finalEntry, ...history].slice(0, 30));
    } catch (error) {
        console.error("Error creating thumbnails for history:", error);
        setCurrentResult(newEntry);
        saveHistory([newEntry, ...history].slice(0, 30));
    }
  };

  const getLocation = (): Promise<{ latitude: number; longitude: number } | null> => new Promise((resolve) => { if (!navigator.geolocation) { resolve(null); } navigator.geolocation.getCurrentPosition( (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }), () => resolve(null), { timeout: 10000 } ); });
  
  const processImage = async () => {
    if (!image) return;
    setIsLoading(true); setIsTextSearching(false); setError(null); setCurrentResult(null);
    if (!effectiveApiKey) { setError(t('apiKeyError')); setIsApiKeyModalOpen(true); setIsLoading(false); return; }
    try {
        const base64Image = await fileToBase64(image.file);
        const imageSrcDataUrl = await blobUrlToDataUrl(image.src);
        const location = await getLocation();
        const { mushroomInfo, sources, mapaDistribucionSrc } = await identifyMushroomFromImage(effectiveApiKey, base64Image, image.mimeType, location, language);
        await handleProcessResult({ id: `${Date.now()}-${mushroomInfo.nombreCientifico}`, timestamp: Date.now(), imageSrc: imageSrcDataUrl, type: 'mushroom', mushroomInfo, sources, mapaDistribucionSrc: mapaDistribucionSrc ?? undefined });
        
    } catch (err: any) {
        const errorMessage = err.message || t('unexpectedError'); setError(errorMessage);
        if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('resource has been exhausted') || errorMessage.toLowerCase().includes('api key not valid')) { setIsApiKeyModalOpen(true); }
    } finally { setIsLoading(false); setImage(null); }
};

  const handleTextSearch = async (query: string) => {
    handleReset(); 
    setIsLoading(true); 
    setIsTextSearching(true);
    if (!effectiveApiKey) { setError(t('apiKeyError')); setIsApiKeyModalOpen(true); setIsLoading(false); return; }
    try {
        const { mushroomInfo, sources, imageSrc, mapaDistribucionSrc, imageGenerationFailed } = await identifyMushroomFromText(effectiveApiKey, query, language);
        const finalImageSrc = imageSrc || createPlaceholderImage(mushroomInfo.nombreComun);
        await handleProcessResult({ 
            id: `${Date.now()}-${mushroomInfo.nombreCientifico}`, 
            timestamp: Date.now(), 
            imageSrc: finalImageSrc, 
            type: 'mushroom', 
            mushroomInfo, 
            sources, 
            mapaDistribucionSrc: mapaDistribucionSrc ?? undefined,
            imageGenerationFailed: imageGenerationFailed
        });
    } catch (err: any) {
        const errorMessage = err.message || t('unexpectedError');
        setError(errorMessage);
        if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('resource has been exhausted') || errorMessage.toLowerCase().includes('api key not valid')) { setIsApiKeyModalOpen(true); }
    } finally { setIsLoading(false); setIsTextSearching(false); }
  };
  
  const handleViewHistoryItem = (item: HistoryEntry) => { setCurrentResult(item); setIsHistoryOpen(false); setIsCollectionOpen(false); setView('main'); };
  
  const handleToggleCollection = async () => {
      if (!currentResult) return;
      triggerHapticFeedback();
      const exists = collection.some(entry => entry.id === currentResult.id);
      if (exists) {
          saveCollection(collection.filter(entry => entry.id !== currentResult.id));
      } else {
           try {
              const [thumbImageSrc, thumbMapSrc] = await Promise.all([
                  createThumbnail(currentResult.imageSrc),
                  currentResult.mapaDistribucionSrc ? createThumbnail(currentResult.mapaDistribucionSrc) : Promise.resolve(undefined)
              ]);
              const finalEntry = { ...currentResult, imageSrc: thumbImageSrc, mapaDistribucionSrc: thumbMapSrc };
              saveCollection([finalEntry, ...collection]);
              setNotification(t('savedToCollection'));
          } catch (err: any) {
              console.error("Could not create thumbnail for collection:", err);
              saveCollection([currentResult, ...collection]);
              setNotification(t('savedToCollection'));
          }
      }
  };

  const handleRemoveFromCollection = (id: string) => saveCollection(collection.filter(entry => entry.id !== id));
  const handleCloseCollection = () => { setIsCollectionOpen(false); setCollectionNameFilter(''); setCollectionSortOrder('date-desc'); };
  const handleStartCompare = (mushroomEntry: HistoryEntry) => { setComparisonMushrooms({ mushroomA: mushroomEntry, mushroomB: null }); setComparisonResult(null); setCurrentResult(null); setError(null); setView('comparator'); setIsCollectionOpen(false); };
  
  const filteredAndSortedCollection = useMemo(() => {
    return [...collection]
      .filter(item => (item.mushroomInfo?.nombreComun || '').toLowerCase().includes(collectionNameFilter.toLowerCase()))
      .sort((a, b) => {
        const nameA = a.mushroomInfo?.nombreComun || ''; const nameB = b.mushroomInfo?.nombreComun || '';
        switch (collectionSortOrder) { case 'name-asc': return nameA.localeCompare(nameB); case 'name-desc': return nameB.localeCompare(nameA); case 'date-asc': return a.timestamp - b.timestamp; default: return b.timestamp - a.timestamp; }
      });
  }, [collection, collectionSortOrder, collectionNameFilter]);

  const handleExportCollection = useCallback(() => {
    if (filteredAndSortedCollection.length === 0) { alert("The collection is empty or there are no results for the applied filters."); return; }
    const exportData = filteredAndSortedCollection.map(entry => ({ 
        type: entry.type, 
        name: entry.mushroomInfo?.nombreComun, 
        scientificName: entry.mushroomInfo?.nombreCientifico, 
        savedDate: new Date(entry.timestamp).toISOString(), 
        summary: `Edibility: ${entry.mushroomInfo?.toxicidad.nivelToxicidad}. Habitat: ${entry.mushroomInfo?.habitat}`
    }));
    const jsonString = JSON.stringify(exportData, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `mushroom_collection_export_${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  }, [filteredAndSortedCollection]);

    const renderMainView = () => {
        if (isLoading) return <Loader message={t('analyzing')} subMessage={t(isTextSearching ? 'textSearchLoadingSub' : 'loadingMessage')} />;
        if (error) return (
        <div className="text-center p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg max-w-md w-full">
            <Icon name="cross" className="w-16 h-16 text-red-500 mx-auto mb-4" /><h3 className="text-xl font-bold text-red-800 dark:text-red-300 mb-2">{t('errorTitle')}</h3><p className="text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-900/50 p-3 rounded-lg">{error}</p>
            <button onClick={handleReset} className="mt-6 px-6 py-2 bg-red-600 dark:bg-red-700 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">{isApiKeyModalOpen ? t('close') : t('tryAgain')}</button>
        </div>
        );
        if (currentResult) {
            const isInCollection = collection.some(entry => entry.id === currentResult.id);
            return <ResultCard result={currentResult} onReset={handleReset} isInCollection={isInCollection} onToggleCollection={handleToggleCollection} onStartCompare={() => handleStartCompare(currentResult)} />;
        }
        if (image) return (
        <div className="text-center p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg max-w-md">
            <img src={image.src} alt="Selected Mushroom" className="max-h-64 w-auto mx-auto rounded-lg shadow-md mb-6" /><h3 className="text-xl font-bold text-green-900 dark:text-emerald-200 mb-6">{t('readyToAnalyze')}</h3>
            <div className="flex justify-center gap-4"><button onClick={() => { setImage(null); triggerHapticFeedback(); }} className="px-6 py-3 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 font-semibold rounded-lg shadow-md border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600">{t('changePhoto')}</button><button onClick={() => { processImage(); triggerHapticFeedback(); }} className="px-6 py-3 bg-green-600 dark:bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 dark:hover:bg-emerald-700">{t('analyze')}</button></div>
        </div>
        );
        
        return (
        <div className="flex flex-col items-center gap-4">
            <MainInput onImageSelect={handleImageSelect} isLoading={isLoading} onTextSearch={handleTextSearch} onError={setError} />
            <div className="flex flex-wrap justify-center items-center gap-4 mt-4">
                {history.length > 0 && <button onClick={() => { setIsHistoryOpen(true); triggerHapticFeedback(); }} className="inline-flex items-center justify-center gap-2 px-6 py-2 text-gray-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors bg-white/60 dark:bg-slate-800/60"><Icon name="history" className="w-5 h-5" />{t('history')}</button>}
                {collection.length > 0 && <button onClick={() => { setIsCollectionOpen(true); triggerHapticFeedback(); }} className="inline-flex items-center justify-center gap-2 px-6 py-2 text-gray-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors bg-white/60 dark:bg-slate-800/60"><Icon name="book" className="w-5 h-5" />{t('myCollection')}</button>}
                <button onClick={() => { setIsManualOpen(true); triggerHapticFeedback(); }} className="inline-flex items-center justify-center gap-2 px-6 py-2 text-gray-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors bg-white/60 dark:bg-slate-800/60">
                    <Icon name="help" className="w-5 h-5" />
                    {t('appManual')}
                </button>
            </div>
        </div>
        );
    };

    const renderComparatorView = () => {
        const { mushroomA, mushroomB } = comparisonMushrooms;
        if (!mushroomA || !mushroomA.mushroomInfo) return (<div>Error: source mushroom not selected.<button onClick={handleReset}>Go Back</button></div>);

        const handleComparisonSearch = async (query: string) => {
            setIsLoading(true); setError(null); setComparisonResult(null);
            try {
                const { mushroomInfo, sources, imageSrc, mapaDistribucionSrc } = await identifyMushroomFromText(effectiveApiKey, query, language);
                const finalImageSrc = imageSrc || createPlaceholderImage(mushroomInfo.nombreComun);
                setComparisonMushrooms(prev => ({ ...prev, mushroomB: { id: `${Date.now()}-${mushroomInfo.nombreCientifico}`, timestamp: Date.now(), imageSrc: finalImageSrc, type: 'mushroom', mushroomInfo, sources, mapaDistribucionSrc: mapaDistribucionSrc ?? undefined } }));
            } catch (err: any) { setError(err.message || 'Could not find the mushroom to compare.'); } finally { setIsLoading(false); }
        };

        const handleGenerateComparison = async () => {
            if (!comparisonMushrooms.mushroomA?.mushroomInfo || !comparisonMushrooms.mushroomB?.mushroomInfo) return;
            setIsLoading(true); setError(null); setComparisonResult(null);
            try {
                const result = await compareMushrooms(effectiveApiKey, comparisonMushrooms.mushroomA.mushroomInfo, comparisonMushrooms.mushroomB.mushroomInfo, language);
                setComparisonResult(result);
                triggerHapticFeedback([100, 30, 100]);
            } catch (err: any) { setError(err.message || 'Could not generate the comparison.'); } finally { setIsLoading(false); }
        }

        const getToxicityBadge = (level: string) => {
            const config: Record<string, { textKey: string; color: string }> = {
              Edible: { textKey: 'toxicityLevel_Edible', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
              Caution: { textKey: 'toxicityLevel_Caution', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
              Inedible: { textKey: 'toxicityLevel_Inedible', color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300' },
              Poisonous: { textKey: 'toxicityLevel_Poisonous', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
              Lethal: { textKey: 'toxicityLevel_Lethal', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
              'N/A': { textKey: 'N/A', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
            };
            const { textKey, color } = config[level as keyof typeof config] || config.Caution;
            return <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${color}`}>{textKey === 'N/A' ? 'N/A' : t(textKey)}</span>;
        };

        return (
            <div className="w-full max-w-5xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden my-8 border border-green-200 dark:border-emerald-800 p-6 sm:p-8">
                <h2 className="text-3xl font-bold text-center text-green-900 dark:text-emerald-200 mb-6">{t('comparatorTitle')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8 items-start">
                    <div className="text-center p-4 border border-gray-200 dark:border-slate-700 rounded-lg"><img src={mushroomA.imageSrc} alt={mushroomA.mushroomInfo.nombreComun} className="w-32 h-32 object-cover rounded-full mx-auto mb-4 shadow-lg" /><h3 className="font-bold text-xl text-green-800 dark:text-emerald-300">{mushroomA.mushroomInfo.nombreComun}</h3><p className="text-sm italic text-gray-500 dark:text-slate-400">{mushroomA.mushroomInfo.nombreCientifico}</p></div>
                    <div className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg">{comparisonMushrooms.mushroomB ? (<div className="text-center"><img src={comparisonMushrooms.mushroomB.imageSrc} alt={comparisonMushrooms.mushroomB.mushroomInfo?.nombreComun} className="w-32 h-32 object-cover rounded-full mx-auto mb-4 shadow-lg" /><h3 className="font-bold text-xl text-green-800 dark:text-emerald-300">{comparisonMushrooms.mushroomB.mushroomInfo?.nombreComun}</h3><p className="text-sm italic text-gray-500 dark:text-slate-400">{comparisonMushrooms.mushroomB.mushroomInfo?.nombreCientifico}</p></div>) : (<div className="text-center"><h3 className="font-bold text-xl mb-4 text-gray-700 dark:text-slate-300">{t('selectMushroomB')}</h3><SearchInput onSearch={handleComparisonSearch} isLoading={isLoading} /></div>)}</div>
                </div>
                <div className="text-center mb-8"><button onClick={() => { handleGenerateComparison(); triggerHapticFeedback(); }} disabled={!comparisonMushrooms.mushroomB || isLoading} className="px-8 py-4 bg-green-600 text-white font-bold text-lg rounded-lg shadow-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-transform transform hover:scale-105"><div className="flex items-center gap-3"><Icon name="compare" className="w-6 h-6" /><span>{isLoading && !comparisonResult ? t('generating') : t('generateComparison')}</span></div></button></div>
                {isLoading && !comparisonResult && <Loader message={t('generatingComparison')} subMessage="" />}
                {error && <p className="text-red-500 text-center p-4 bg-red-100 dark:bg-red-900/50 rounded-lg">{error}</p>}
                {comparisonResult && (
                    <div className="space-y-6 mt-8 border-t border-gray-200 dark:border-slate-700 pt-8">
                        <div>
                            <h3 className="text-2xl font-bold mb-4 text-center">{t('comparativeAnalysis')}</h3>
                            <p className="mb-6 bg-green-50 dark:bg-emerald-900/40 p-4 rounded-lg text-gray-700 dark:text-slate-300">{comparisonResult.resumenComparativo}</p>
                        </div>
                        
                        <div className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
                            <h4 className="font-bold text-lg mb-3 flex items-center gap-2"><Icon name="utensils" className="w-5 h-5 text-green-600 dark:text-emerald-500" />{t('culinaryUses')}</h4>
                            <div className="grid sm:grid-cols-2 gap-4 text-sm">
                                <div><h5 className="font-semibold mb-2">{t('similarities')}</h5><ul className="list-disc pl-5 space-y-1">{comparisonResult.usosCulinarios.similitudes.length > 0 ? comparisonResult.usosCulinarios.similitudes.map((s,i) => <li key={i}>{s}</li>) : <li>-</li>}</ul></div>
                                <div><h5 className="font-semibold mb-2">{t('differences')}</h5><ul className="list-disc pl-5 space-y-1">{comparisonResult.usosCulinarios.diferencias.length > 0 ? comparisonResult.usosCulinarios.diferencias.map((d,i) => <li key={i}>{d}</li>) : <li>-</li>}</ul></div>
                            </div>
                        </div>

                        <div className="p-4 border border-amber-300 dark:border-amber-700 rounded-lg bg-amber-50 dark:bg-amber-900/40">
                            <h4 className="font-bold text-lg mb-3 flex items-center gap-2 text-amber-900 dark:text-amber-200"><Icon name="cross" className="w-5 h-5" />{t('toxicity')}</h4>
                            <p className="mb-4 text-sm">{comparisonResult.toxicidad.comparacion}</p>
                            <div className="flex justify-around text-center text-sm font-semibold">
                                <div className="flex flex-col items-center gap-1"><span>{mushroomA.mushroomInfo.nombreComun}</span>{getToxicityBadge(comparisonResult.toxicidad.nivelHongoA)}</div>
                                <div className="flex flex-col items-center gap-1"><span>{mushroomB?.mushroomInfo?.nombreComun}</span>{getToxicityBadge(comparisonResult.toxicidad.nivelHongoB)}</div>
                            </div>
                        </div>

                        <div className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
                             <h4 className="font-bold text-lg mb-3 flex items-center gap-2"><Icon name="mushroom" className="w-5 h-5 text-green-600 dark:text-emerald-500" />{t('morphologicalDifferences')}</h4>
                             <div className="grid sm:grid-cols-2 gap-4 text-sm">
                                <div><h5 className="font-semibold mb-2">{t('habitat')}</h5><p>{comparisonResult.diferenciasMorfologicas.habitat}</p></div>
                                <div><h5 className="font-semibold mb-2">{t('appearance')}</h5><p>{comparisonResult.diferenciasMorfologicas.apariencia}</p></div>
                             </div>
                        </div>
                    </div>
                )}
                <div className="mt-8 text-center border-t border-gray-200 dark:border-slate-700 pt-6"><button onClick={() => { handleReset(); triggerHapticFeedback(); }} className="px-6 py-2 text-gray-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">{t('backToMainSearch')}</button></div>
            </div>
        );
    }
  
  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-emerald-100 via-green-100 to-lime-200 dark:from-slate-800 dark:via-emerald-950 dark:to-green-950 flex flex-col items-center justify-center p-4 overflow-y-auto relative">
      {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      <div className="absolute top-4 right-4 z-10">
        <div className="flex items-center bg-white/60 dark:bg-slate-800/60 rounded-full shadow-md">
          <button onClick={() => { setLanguage('es'); triggerHapticFeedback(); }} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${language === 'es' ? 'bg-green-600 text-white' : 'text-gray-700 dark:text-slate-300'}`}>ES</button>
          <button onClick={() => { setLanguage('en'); triggerHapticFeedback(); }} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${language === 'en' ? 'bg-green-600 text-white' : 'text-gray-700 dark:text-slate-300'}`}>EN</button>
        </div>
      </div>
      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={handleReset} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} onSelectItem={handleViewHistoryItem} onClearHistory={() => saveHistory([])} />
      <CollectionModal isOpen={isCollectionOpen} onClose={handleCloseCollection} collection={filteredAndSortedCollection} onSelectItem={handleViewHistoryItem} onRemoveItem={handleRemoveFromCollection} onExport={handleExportCollection} sortOrder={collectionSortOrder} onSortOrderChange={(e) => setCollectionSortOrder(e.target.value)} nameFilter={collectionNameFilter} onNameFilterChange={(e) => setCollectionNameFilter(e.target.value)} onStartCompare={handleStartCompare} />
      <ManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
      {view === 'main' ? renderMainView() : renderComparatorView()}
    </main>
  );
}

export default App;
