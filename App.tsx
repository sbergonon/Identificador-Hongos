import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MushroomInfo, GroundingSource, HistoryEntry, Recipe, ComparisonInfo, ImageQuality } from './types.ts';
import { identifyMushroomFromImage, identifyMushroomFromText, compareMushrooms } from './services/geminiService.ts';
import { Icon } from './components/Icons.tsx';
import { ManualModal } from './components/ManualModal.tsx';
import { useLanguage } from './contexts/LanguageContext.tsx';
import { useTheme } from './contexts/ThemeContext.tsx';
import { imageToDataUrl, createPlaceholderImage, getFallbackMushroomIcon } from './utils.ts';

declare global {
  interface Window { 
      jspdf: any; 
      html2canvas: any; 
      // aistudio removed to avoid type conflicts
  }
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
type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Expert';

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

// Creates a compressed thumbnail from a data URL to save storage space.
const createThumbnail = (dataUrl: string, maxSize = 400): Promise<string> => {
    return new Promise((resolve) => {
        if (!dataUrl || !dataUrl.startsWith('data:image')) {
            resolve(dataUrl);
            return;
        }

        // Fix: Skip SVG images as they don't need resizing and can cause canvas tainting or load errors
        if (dataUrl.startsWith('data:image/svg+xml')) {
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
            console.error(`Failed to load image for thumbnail creation from source: ${dataUrl.substring(0, 100)}...`);
            // Fallback to the mushroom icon if the original image fails to load.
            resolve(getFallbackMushroomIcon());
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
      <div className="flex items-center gap-3 bg-amber-600 text-white font-semibold py-3 px-6 rounded-full shadow-lg">
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
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} disabled={isLoading} placeholder={placeholder} className="w-full pl-4 pr-12 py-3 bg-white dark:bg-slate-700 border-amber-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-shadow dark:text-slate-200"/>
        <button type="submit" disabled={isLoading || !query.trim()} className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 disabled:text-gray-300 dark:disabled:text-slate-500 transition-colors">
          <Icon name="search" className="w-6 h-6" />
        </button>
      </div>
    </form>
  );
};

interface MainInputProps {
    onImageSelect: (file: File) => void;
    isLoading: boolean;
    onTextSearch: (query: string) => void;
    onError: (errorCode: string) => void;
    difficultyLevel: DifficultyLevel;
    onDifficultyChange: (level: DifficultyLevel) => void;
    imageQuality: ImageQuality;
    onImageQualityChange: (quality: ImageQuality) => void;
}

const MainInput: React.FC<MainInputProps> = ({ onImageSelect, isLoading, onTextSearch, onError, difficultyLevel, onDifficultyChange, imageQuality, onImageQualityChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) { onError('IMAGE_UPLOAD_ERROR'); if (event.target) event.target.value = ''; return; }
      onImageSelect(file);
    }
    if (event.target) event.target.value = '';
  };
  
  return (
    <div className="w-full max-w-md p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-amber-200 dark:border-stone-700 text-center">
      <div className="flex justify-center items-center gap-3 mb-4">
        <Icon name="mushroom" className="w-10 h-10 text-amber-800 dark:text-amber-200" />
        <h2 className="text-3xl font-bold text-stone-900 dark:text-amber-200">{t('appName')}</h2>
      </div>
      <p className="text-gray-600 dark:text-slate-400 mb-6">{t('identifyMushroomTitle')}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-400 mb-2 text-center">{t('difficultyLevel')}</label>
            <div className="flex justify-center bg-gray-200 dark:bg-slate-700/50 rounded-lg p-1">
              {(['Beginner', 'Intermediate', 'Expert'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => onDifficultyChange(level)}
                  className={`w-1/3 px-3 py-1 text-sm font-semibold rounded-md transition-colors ${difficultyLevel === level ? 'bg-amber-600 text-white shadow' : 'text-gray-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-600/50'}`}
                >
                  {t(`difficulty_${level}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-400 mb-2 text-center">{t('imageQuality')}</label>
            <div className="flex justify-center bg-gray-200 dark:bg-slate-700/50 rounded-lg p-1">
              {(['Standard', 'High'] as const).map((quality) => (
                <button
                  key={quality}
                  onClick={() => onImageQualityChange(quality)}
                  className={`w-1/2 px-3 py-1 text-sm font-semibold rounded-md transition-colors ${imageQuality === quality ? 'bg-amber-600 text-white shadow' : 'text-gray-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-600/50'}`}
                >
                  {t(`quality_${quality}`)}
                </button>
              ))}
            </div>
          </div>
      </div>


      <SearchInput onSearch={onTextSearch} isLoading={isLoading} placeholder={t('searchByNamePlaceholder')} />
      
      <div className="relative flex items-center my-4">
        <div className="flex-grow border-t border-gray-300 dark:border-slate-600"></div>
        <span className="flex-shrink mx-4 text-gray-500 dark:text-slate-400 font-semibold text-sm">{t('orSeparator')}</span>
        <div className="flex-grow border-t border-gray-300 dark:border-slate-600"></div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileChange} className="hidden" disabled={isLoading} />
          <button onClick={() => { cameraInputRef.current?.click(); triggerHapticFeedback(); }} disabled={isLoading} className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white font-semibold rounded-lg shadow-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-transform transform hover:scale-105">
          <Icon name="camera" className="w-5 h-5" />{t('takePhoto')}
          </button>
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" disabled={isLoading} />
          <button onClick={() => { fileInputRef.current?.click(); triggerHapticFeedback(); }} disabled={isLoading} className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 font-semibold rounded-lg shadow-md border border-amber-300 dark:border-slate-600 hover:bg-amber-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-transform transform hover:scale-105">
          <Icon name="upload" className="w-5 h-5" />{t('uploadFile')}
          </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-6 max-w-sm mx-auto">{t('warningDisclaimer')}</p>
    </div>
  );
};

const Loader: React.FC<{ message: string, subMessage: string }> = ({ message, subMessage }) => (
    <div className="text-center p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg max-w-md">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-amber-600 dark:border-amber-500 mx-auto"></div>
        <p className="mt-6 text-lg font-semibold text-amber-800 dark:text-amber-200">{message}</p>
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
        <div ref={onRef} className="w-[400px] bg-white dark:bg-slate-800 font-sans shadow-2xl rounded-lg overflow-hidden border border-amber-200 dark:border-stone-700">
            <img src={imageSrc} alt={mushroomInfo.nombreComun} className="w-full h-52 object-cover" />
            <div className="p-5">
                <h2 className="text-2xl font-extrabold text-stone-800 dark:text-amber-200">{mushroomInfo.nombreComun}</h2>
                <p className="text-md text-gray-500 dark:text-slate-400 italic mb-3">{mushroomInfo.nombreCientifico}</p>
                <div className="mb-4">
                  <ToxicityMeter level={mushroomInfo.toxicidad.nivelToxicidad} />
                </div>
                 <p className="text-sm text-gray-700 dark:text-slate-300 line-clamp-3">{mushroomInfo.descripcionGeneral}</p>
            </div>
            <div className="px-5 py-3 bg-stone-50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-stone-800 dark:text-amber-400">
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
    onEditDiary: () => void;
    difficulty: DifficultyLevel;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, onReset, isInCollection, onToggleCollection, onStartCompare, onEditDiary, difficulty }) => {
    const { mushroomInfo, sources, imageSrc, mapaDistribucionSrc, personalNotes, findingDate, location, userPhotos } = result;
    const { t } = useLanguage();
    const { theme } = useTheme();
    const resultCardRef = useRef<HTMLDivElement>(null);
    const shareableCardRef = useRef<HTMLDivElement | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isExportingJpg, setIsExportingJpg] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [showShareableCard, setShowShareableCard] = useState(false);

    if (!mushroomInfo) return null;

    const [sharedRecipe, setSharedRecipe] = useState<string | null>(null);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({ [t('toxicity')]: true, [t('similarMushrooms')]: true, [t('myFieldDiarySectionTitle')]: true });

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
            canvas.toBlob(async (blob: Blob | null) => {
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
            mushroomInfo.distribucionGeografica ? t('distributionMap') : null,
            mushroomInfo.usosCulinarios?.length > 0 ? t('culinaryUses') : null,
            mushroomInfo.toxicidad ? t('toxicity') : null,
            mushroomInfo.hongosSimilares?.length > 0 ? t('similarMushrooms') : null,
            mushroomInfo.recetas?.length > 0 ? t('recipes') : null,
            sources.length > 0 ? t('sources') : null,
            isInCollection ? t('myFieldDiarySectionTitle') : null,
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

    const handleExportJpg = async () => {
        if (!resultCardRef.current || !mushroomInfo) return;
        setIsExportingJpg(true);
        triggerHapticFeedback();
        const buttonsToHide = resultCardRef.current.querySelectorAll('.hide-on-export');
        buttonsToHide.forEach(btn => ((btn as HTMLElement).style.visibility = 'hidden'));
        
        await new Promise(resolve => setTimeout(resolve, 100)); // Allow UI to update

        try {
            const canvas = await window.html2canvas(resultCardRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
            });

            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            link.download = `${mushroomInfo.nombreComun.replace(/ /g, '_')}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Failed to export as JPG:', error);
            alert('Failed to export image.');
        } finally {
            setIsExportingJpg(false);
            buttonsToHide.forEach(btn => ((btn as HTMLElement).style.visibility = 'visible'));
        }
    };

    const Section: React.FC<{ title: string; icon: string; children: React.ReactNode; }> = ({ title, icon, children }) => {
        const isOpen = openSections[title] ?? false;
        return (
            <div className="mb-2 border-b border-gray-200 dark:border-slate-700 last:border-b-0">
                <button className="w-full flex justify-between items-center py-4 focus:outline-none text-left" onClick={() => toggleSection(title)} aria-expanded={isOpen}>
                    <div className="flex items-center min-w-0 mr-4">
                        <Icon name={icon} className="w-7 h-7 text-amber-700 dark:text-amber-400 mr-3 flex-shrink-0" />
                        <h3 className="text-xl font-bold text-stone-900 dark:text-amber-200 break-words">{title}</h3>
                    </div>
                    <Icon name="chevron-down" className={`w-6 h-6 text-gray-500 dark:text-slate-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[9999px]' : 'max-h-0'}`}>
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
  
  const hasDiaryData = personalNotes || findingDate || location || (userPhotos && userPhotos.length > 0);

  return (
    <>
    {showShareableCard && (
        <div className="fixed top-0 left-[-9999px]" aria-hidden="true">
            <ShareableCard mushroomInfo={mushroomInfo} imageSrc={imageSrc} onRef={(node) => shareableCardRef.current = node} />
        </div>
    )}
    <div ref={resultCardRef} className="w-full max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden my-8 border border-amber-200 dark:border-stone-800">
        <div className="p-6 md:p-8">
            <div className="md:flex md:gap-8">
                <div className="md:w-1/3 mb-6 md:mb-0">
                    <img 
                        src={imageSrc} 
                        alt={mushroomInfo.nombreComun} 
                        className="rounded-xl shadow-lg w-full object-cover aspect-square"
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getFallbackMushroomIcon(); }}
                    />
                </div>
                <div className="md:w-2/3">
                    <div className="mb-4">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-800 dark:text-amber-200 break-words">{mushroomInfo.nombreComun}</h2>
                        <p className="text-lg sm:text-xl text-gray-500 dark:text-slate-400 italic mt-1 break-words">{mushroomInfo.nombreCientifico}</p>
                        {difficulty !== 'Beginner' && mushroomInfo.sinonimos?.length > 0 && <p className="text-sm text-gray-600 dark:text-slate-300 mt-2 break-words"><strong>{t('alsoKnownAs')}:</strong> {mushroomInfo.sinonimos.join(', ')}</p>}
                    </div>
                    <div className="flex flex-wrap justify-start sm:justify-end gap-2">
                        <button onClick={handleShareAsImage} disabled={isSharing} className="hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-amber-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 disabled:opacity-50">
                            {isSharing ? <span className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin"></span> : <Icon name="share-up" className="w-4 h-4" />}
                            {isSharing ? t('sharing') : t('share')}
                        </button>
                        {onStartCompare && (<button onClick={() => { onStartCompare(); triggerHapticFeedback(); }} className="hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 bg-amber-100 text-amber-800 hover:bg-amber-200 focus:ring-amber-500 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70"><Icon name="compare" className="w-4 h-4" />{t('compare')}</button>)}
                        <button onClick={() => { onToggleCollection(); triggerHapticFeedback(); }} className={`hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${ isInCollection ? 'bg-red-100 text-red-800 hover:bg-red-200 focus:ring-red-500 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900/70' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-amber-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600' }`}><Icon name="bookmark" className="w-4 h-4" />{isInCollection ? t('saved') : t('save')}</button>
                        {isInCollection && (<button onClick={() => { onEditDiary(); triggerHapticFeedback(); }} className="hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-blue-100 text-blue-800 hover:bg-blue-200 focus:ring-blue-500 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900/70"><Icon name="pencil" className="w-4 h-4" />{t('editDiary')}</button>)}
                        <button onClick={handleExportPdf} disabled={isExporting} className="hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-amber-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 disabled:opacity-50">
                            {isExporting ? <span className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin"></span> : <Icon name="download" className="w-4 h-4" />}
                            {isExporting ? t('exporting') : t('exportToPdf')}
                        </button>
                        <button onClick={handleExportJpg} disabled={isExportingJpg} className="hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-amber-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 disabled:opacity-50">
                            {isExportingJpg ? <span className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin"></span> : <Icon name="photo" className="w-4 h-4" />}
                            {isExportingJpg ? t('exporting') : t('exportToJpg')}
                        </button>
                    </div>
                    <div className="mt-4">
                      <ToxicityMeter level={mushroomInfo.toxicidad.nivelToxicidad} />
                    </div>
                    <p className="text-gray-700 dark:text-slate-300 leading-relaxed mt-4 break-words">{mushroomInfo.descripcionGeneral}</p>
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
                        <div className="p-4 bg-stone-50 dark:bg-stone-900/40 rounded-lg"><Icon name="globe" className="w-8 h-8 text-amber-600 dark:text-amber-500 mx-auto mb-2" /><h4 className="font-semibold text-sm text-stone-800 dark:text-amber-300">{t('habitat')}</h4><p className="text-sm text-gray-600 dark:text-slate-400 break-words">{mushroomInfo.habitat}</p></div>
                        <div className="p-4 bg-stone-50 dark:bg-stone-900/40 rounded-lg"><Icon name="sparkles" className="w-8 h-8 text-amber-600 dark:text-amber-500 mx-auto mb-2" /><h4 className="font-semibold text-sm text-stone-800 dark:text-amber-300">{t('season')}</h4><p className="text-sm text-gray-600 dark:text-slate-400 break-words">{mushroomInfo.temporada}</p></div>
                    </div>
                </div>
            </div>
            <div className="mt-8 border-t border-amber-200 dark:border-stone-800 pt-2">
              {isInCollection && hasDiaryData && (
                <Section title={t('myFieldDiarySectionTitle')} icon="book">
                    <div className="space-y-4">
                        {findingDate && (<div className="flex items-center gap-3"><Icon name="calendar" className="w-5 h-5 text-gray-500 dark:text-slate-400"/><p><strong>{t('fieldDiaryDateLabel')}:</strong> {new Date(findingDate).toLocaleDateString()}</p></div>)}
                        {location && (<div className="flex items-center gap-3"><Icon name="location-pin" className="w-5 h-5 text-gray-500 dark:text-slate-400"/> <p><strong>{t('fieldDiaryLocationLabel')}:</strong> <a href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</a></p> </div>)}
                        {personalNotes && (<div><h4 className="font-semibold mb-1">{t('fieldDiaryNotesLabel')}:</h4><p className="whitespace-pre-wrap bg-stone-50 dark:bg-stone-900/40 p-3 rounded-md">{personalNotes}</p></div>)}
                        {userPhotos && userPhotos.length > 0 && (<div><h4 className="font-semibold mb-2">{t('fieldDiaryPhotosLabel')}:</h4><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">{userPhotos.map((photo, i) => <img key={i} src={photo} alt={`${t('userPhoto')} ${i+1}`} className="w-full h-auto object-cover rounded-md shadow-sm" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = createPlaceholderImage('Photo Error'); }} />)}</div></div>)}
                    </div>
                </Section>
              )}
              <Section title={t('toxicity')} icon="cross">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <h4 className="font-semibold text-gray-800 dark:text-slate-200">{t('toxicityLevel')}:</h4>
                        {getToxicityBadge(mushroomInfo.toxicidad.nivelToxicidad)}
                    </div>
                    <p className="bg-yellow-100 dark:bg-yellow-900/40 border-l-4 border-yellow-500 dark:border-yellow-600 text-yellow-800 dark:text-yellow-300 p-4 rounded-r-lg break-words">{mushroomInfo.toxicidad.descripcion}</p>
                    {difficulty !== 'Beginner' && mushroomInfo.toxicidad.compuestosToxicos.length > 0 && (<div><h4 className="font-semibold text-gray-800 dark:text-slate-200 mb-1">{t('toxicCompounds')}:</h4><ul className="list-disc pl-5 text-sm space-y-1">{mushroomInfo.toxicidad.compuestosToxicos.map((c, i) => <li key={i} className="break-words">{c}</li>)}</ul></div>)}
                    {mushroomInfo.toxicidad.sintomas && (
                        <div>
                            <h4 className="font-semibold text-gray-800 dark:text-slate-200 mb-1">{t('symptoms')}:</h4>
                            <p className="whitespace-pre-wrap bg-stone-50 dark:bg-stone-900/40 p-3 rounded-md">{mushroomInfo.toxicidad.sintomas}</p>
                        </div>
                    )}
                    <div className="p-4 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg">
                        <h4 className="font-bold text-red-800 dark:text-red-200 flex items-center gap-2"><Icon name="cross" className="w-5 h-5" />{t('firstAid')}</h4>
                        <p className="mt-2 text-red-700 dark:text-red-300 text-sm break-words">{mushroomInfo.toxicidad.primerosAuxilios}</p>
                    </div>
                </div>
              </Section>
              {mushroomInfo.usosCulinarios?.length > 0 && <Section title={t('culinaryUses')} icon="utensils"><ul className="list-disc pl-5 space-y-1">{mushroomInfo.usosCulinarios.map((uso, i) => <li key={i} className="break-words">{uso}</li>)}</ul></Section>}
              {mushroomInfo.hongosSimilares?.length > 0 && (
                <Section title={t('similarMushrooms')} icon="cross">
                    <div className="space-y-4">{mushroomInfo.hongosSimilares.map((similar, i) => (
                        <div key={i} className={`p-4 border rounded-lg ${similar.esToxico ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/40' : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40'}`}>
                            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mb-1">
                                <h4 className={`font-bold text-lg ${similar.esToxico ? 'text-red-900 dark:text-red-200' : 'text-amber-900 dark:text-amber-200'} break-words`}>{similar.nombreComun}</h4>
                                {similar.esToxico && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                                        <Icon name="cross" className="w-3 h-3" />
                                        {t('toxic')}
                                    </span>
                                )}
                            </div>
                            <p className={`text-sm ${similar.esToxico ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'} italic mb-2 break-words`}>{similar.nombreCientifico}</p>
                            <p className={`${similar.esToxico ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'} break-words`}>
                                <span className="font-semibold">{t('keyDifference')}:</span> {similar.diferenciaClave}
                            </p>
                        </div>))}</div>
                    <p className="mt-4 text-sm text-gray-500 dark:text-slate-400"><strong>{t('importantDisclaimerSimilar')}</strong></p>
                </Section>
              )}
              {mushroomInfo.distribucionGeografica && (
                <Section title={t('distributionMap')} icon="map">
                    <div className="space-y-4">
                        {mapaDistribucionSrc && (
                            <img src={mapaDistribucionSrc} alt={`Map of ${mushroomInfo.nombreComun}`} className="rounded-lg shadow-md w-full object-contain" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = createPlaceholderImage('Map Error'); }} />
                        )}
                        <p className="break-words">{mushroomInfo.distribucionGeografica}</p>
                    </div>
                </Section>
              )}
              {mushroomInfo.recetas?.length > 0 && (
              <Section title={t('recipes')} icon="pot">
                {mushroomInfo.recetas.map((recipe, i) => (
                  <div key={i} className="mb-6 p-4 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900/50">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-lg text-stone-800 dark:text-amber-300 break-words">{recipe.nombre}</h4>
                        <button onClick={() => handleShareRecipe(recipe)} className={`hide-on-export inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${ sharedRecipe === recipe.nombre ? 'bg-blue-100 text-blue-800 focus:ring-blue-500 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 focus:ring-amber-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600' }`} disabled={sharedRecipe === recipe.nombre}><Icon name={sharedRecipe === recipe.nombre ? 'clipboard-check' : 'share-up'} className="w-3 h-3" />{sharedRecipe === recipe.nombre ? t('copied') : t('share')}</button>
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
        <div className="p-6 bg-gray-50 dark:bg-slate-900/50 text-center"><button onClick={() => { onReset(); triggerHapticFeedback(); }} className="hide-on-export px-8 py-3 bg-amber-600 text-white font-semibold rounded-lg shadow-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-transform transform hover:scale-105">{t('anotherQuery')}</button></div>
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
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center"><h2 className="text-2xl font-bold text-stone-900 dark:text-amber-200">{t('historyModalTitle')}</h2><button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
        <div className="overflow-y-auto p-2 flex-grow">
          {history.length > 0 ? (<ul>{history.map((item) => { const title = item.mushroomInfo?.nombreComun || '...'; return (<li key={item.id}><button onClick={() => { onSelectItem(item); triggerHapticFeedback(); }} className="w-full text-left p-4 flex items-center gap-4 rounded-lg hover:bg-amber-50 dark:hover:bg-stone-900/50 transition-colors"><img src={item.imageSrc} alt={title} className="w-16 h-16 object-cover rounded-md shadow-sm flex-shrink-0" /><div className="flex-grow"><p className="font-semibold text-stone-800 dark:text-amber-300 flex items-center gap-2"><Icon name="mushroom" className="w-4 h-4 text-gray-400 dark:text-slate-500" /> {title}</p><p className="text-sm text-gray-500 dark:text-slate-400">{new Date(item.timestamp).toLocaleString()}</p></div></button></li>);})}</ul>) : (<div className="text-center p-10"><Icon name="history" className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" /><p className="text-gray-500 dark:text-slate-400">{t('noHistory')}</p></div>)}
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
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center flex-shrink-0"><h2 className="text-2xl font-bold text-stone-900 dark:text-amber-200">{t('collectionModalTitle')}</h2><button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex-shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Icon name="search" className="w-5 h-5 text-gray-400" /></span><input type="text" placeholder={t('filterByName')} value={nameFilter} onChange={onNameFilterChange} className="w-full pl-10 pr-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 dark:text-slate-200"/></div>
                <div className="md:col-span-1"><select value={sortOrder} onChange={onSortOrderChange} className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 dark:text-slate-200"><option value="date-desc">{t('sortDateDesc')}</option><option value="date-asc">{t('sortDateAsc')}</option><option value="name-asc">{t('sortNameAsc')}</option><option value="name-desc">{t('sortNameDesc')}</option></select></div>
            </div>
        </div>
        <div className="overflow-y-auto p-2 flex-grow">
          {collection.length > 0 ? (<ul>{collection.map((item) => { const title = item.mushroomInfo?.nombreComun || '...'; return (<li key={item.id} className="p-2 flex items-center gap-2 group"><button onClick={() => { onSelectItem(item); triggerHapticFeedback(); }} className="w-full text-left flex items-center gap-4 rounded-lg hover:bg-amber-50 dark:hover:bg-stone-900/50 transition-colors p-2 flex-grow"><img src={item.imageSrc} alt={title} className="w-16 h-16 object-cover rounded-md shadow-sm flex-shrink-0" /><div className="flex-grow"><p className="font-semibold text-stone-800 dark:text-amber-300 flex items-center gap-2"><Icon name="mushroom" className="w-4 h-4 text-gray-400 dark:text-slate-500" /> {title}</p><p className="text-sm text-gray-500 dark:text-slate-400">{new Date(item.timestamp).toLocaleDateString()}</p></div></button><button onClick={(e) => { e.stopPropagation(); onStartCompare(item); triggerHapticFeedback(); }} className="p-2 rounded-full text-gray-400 dark:text-slate-500 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0" aria-label={t('compare')}><Icon name="compare" className="w-5 h-5" /></button><button onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); triggerHapticFeedback(); }} className="p-2 rounded-full text-gray-400 dark:text-slate-500 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0" aria-label={t('removeFromCollection')}><Icon name="trash" className="w-5 h-5" /></button></li>);})}</ul>) : (<div className="text-center p-10"><Icon name="book" className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" /><p className="text-gray-500 dark:text-slate-400">{t('noCollection')}</p></div>)}
        </div>
        {collection.length > 0 && (<div className="p-4 border-t border-gray-200 dark:border-slate-700 text-right flex-shrink-0"><button onClick={() => { onExport(); triggerHapticFeedback(); }} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">{t('exportToJson')}</button></div>)}
      </div>
    </div>
  );
};

// --- FIELD DIARY MODAL ---
interface FieldDiaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (diaryData: Partial<HistoryEntry>) => void;
    entry: HistoryEntry | null;
}

const FieldDiaryModal: React.FC<FieldDiaryModalProps> = ({ isOpen, onClose, onSave, entry }) => {
    const { t } = useLanguage();
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState('');
    const [location, setLocation] = useState<HistoryEntry['location'] | null>(null);
    const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [photos, setPhotos] = useState<string[]>([]);
    const photoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (entry) {
            setNotes(entry.personalNotes || '');
            setDate(entry.findingDate || new Date().toISOString().split('T')[0]);
            setLocation(entry.location || null);
            setLocationStatus(entry.location ? 'success' : 'idle');
            setPhotos(entry.userPhotos || []);
        }
    }, [entry]);

    if (!isOpen || !entry) return null;

    const handleGetLocation = () => {
        setLocationStatus('loading');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
                setLocationStatus('success');
            },
            () => {
                setLocationStatus('error');
            }, { timeout: 10000, enableHighAccuracy: true }
        );
    };

    const handlePhotoSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;
        
        const newPhotosPromises = Array.from(files).map((file: File) => createThumbnail(URL.createObjectURL(file), 800));
        const newPhotosDataUrls = await Promise.all(newPhotosPromises);
        
        setPhotos(prev => [...prev, ...newPhotosDataUrls].slice(0, 10)); // Limit to 10 photos
    };

    const handleRemovePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        onSave({
            personalNotes: notes,
            findingDate: date,
            location: location || undefined,
            userPhotos: photos,
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-2xl font-bold text-stone-900 dark:text-amber-200 flex items-center gap-3"><Icon name="book" className="w-7 h-7" />{t('fieldDiaryTitle')}</h2>
                    <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <div className="overflow-y-auto p-6 space-y-6 flex-grow">
                    <div>
                        <label className="flex items-center gap-2 text-lg font-semibold text-gray-700 dark:text-slate-300 mb-2"><Icon name="pencil" className="w-5 h-5"/>{t('fieldDiaryNotesLabel')}</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('fieldDiaryNotesPlaceholder')} rows={4} className="w-full p-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 dark:text-slate-200"></textarea>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="flex items-center gap-2 text-lg font-semibold text-gray-700 dark:text-slate-300 mb-2"><Icon name="calendar" className="w-5 h-5"/>{t('fieldDiaryDateLabel')}</label>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 dark:text-slate-200"/>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-lg font-semibold text-gray-700 dark:text-slate-300 mb-2"><Icon name="location-pin" className="w-5 h-5"/>{t('fieldDiaryLocationLabel')}</label>
                            <button onClick={handleGetLocation} disabled={locationStatus === 'loading'} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-amber-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 disabled:opacity-50">
                                {locationStatus === 'loading' && <><span className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin"></span> {t('fieldDiaryLocationGetting')}</>}
                                {locationStatus === 'success' && <><Icon name="location-pin" className="w-4 h-4 text-green-500"/>{t('fieldDiaryLocationSet')}: {location?.latitude.toFixed(4)}, {location?.longitude.toFixed(4)}</>}
                                {locationStatus === 'error' && <><Icon name="cross" className="w-4 h-4 text-red-500"/>{t('fieldDiaryLocationError')}</>}
                                {locationStatus === 'idle' && <>{t('fieldDiaryLocationButton')}</>}
                            </button>
                        </div>
                    </div>
                     <div>
                        <label className="flex items-center gap-2 text-lg font-semibold text-gray-700 dark:text-slate-300 mb-2"><Icon name="photo" className="w-5 h-5"/>{t('fieldDiaryPhotosLabel')}</label>
                        <input type="file" accept="image/*" multiple ref={photoInputRef} onChange={handlePhotoSelection} className="hidden" />
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                           {photos.map((photo, index) => (
                               <div key={index} className="relative group aspect-square">
                                   <img src={photo} className="w-full h-full object-cover rounded-md" />
                                   <button onClick={() => handleRemovePhoto(index)} className="absolute top-0 right-0 m-1 p-0.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="trash" className="w-4 h-4"/></button>
                               </div>
                           ))}
                           {photos.length < 10 && (
                                <button onClick={() => photoInputRef.current?.click()} className="flex items-center justify-center w-full aspect-square border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700">
                                    <Icon name="upload" className="w-8 h-8 text-gray-400 dark:text-slate-500" />
                                </button>
                           )}
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-slate-700 text-right flex-shrink-0 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-100 dark:bg-slate-600 text-gray-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-slate-500">{t('fieldDiaryCancelButton')}</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg shadow-md hover:bg-amber-700">{t('fieldDiaryUpdateButton')}</button>
                </div>
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
  const [comparisonMushrooms, setComparisonMushrooms] = useState<{ mushroomA: HistoryEntry | null, mushroomB: HistoryEntry | null }>({ mushroomA: null, mushroomB: null });
  const [comparisonResult, setComparisonResult] = useState<ComparisonInfo | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isFieldDiaryOpen, setIsFieldDiaryOpen] = useState(false);
  const [editingDiaryEntry, setEditingDiaryEntry] = useState<HistoryEntry | null>(null);
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>('Intermediate');
  const [imageQuality, setImageQuality] = useState<ImageQuality>('Standard');

  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [collectionSortOrder, setCollectionSortOrder] = useState('date-desc');
  const [collectionNameFilter, setCollectionNameFilter] = useState('');
  
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    try {
        const storedHistory = localStorage.getItem('mushroomHistory');
        if (storedHistory) setHistory(JSON.parse(storedHistory));
        const storedCollection = localStorage.getItem('mushroomCollection');
        if (storedCollection) setCollection(JSON.parse(storedCollection));
        const storedQuality = localStorage.getItem('mushroomImageQuality');
        if (storedQuality === 'Standard' || storedQuality === 'High') setImageQuality(storedQuality);
    } catch (e) {
        console.error("Failed to load data from localStorage.", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('mushroomImageQuality', imageQuality);
  }, [imageQuality]);

  useEffect(() => {
      const checkApiKey = async () => {
          const win = window as any;
          // Robust check for AI Studio environment
          if (win.aistudio && typeof win.aistudio.hasSelectedApiKey === 'function') {
              try {
                  const hasKey = await win.aistudio.hasSelectedApiKey();
                  setHasApiKey(hasKey);
              } catch (e) {
                  // Fallback for unexpected AI Studio errors, 
                  // but assuming 'false' to allow safe retry in that environment.
                  console.warn("AI Studio API check failed:", e);
                  setHasApiKey(false);
              }
          } else {
              // Production / Render environment:
              // window.aistudio is undefined. We rely on process.env.API_KEY injected by the server/build.
              // We assume true here to skip the "Select Key" screen.
              setHasApiKey(true); 
          }
      };
      checkApiKey();
  }, []);

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

  const processError = useCallback((err: any) => {
    const errorCode = err?.message || 'UNEXPECTED_ERROR';
    let displayMessage = '';

    switch (errorCode) {
        case 'SERVICE_CONFIG_ERROR_API_KEY_MISSING':
            displayMessage = t('error_service_config_api_key_missing');
            break;
        case 'API_QUOTA':
            displayMessage = t('error_api_quota');
            break;
        case 'SERVICE_CONFIG_ERROR':
             displayMessage = t('error_service_config');
             break;
        case 'NETWORK_ERROR':
            displayMessage = t('error_network');
            break;
        case 'INVALID_RESPONSE':
            displayMessage = t('error_invalidResponse');
            break;
        case 'IDENTIFY_FAILED':
            displayMessage = t('error_identify_failed');
            break;
        case 'IMAGE_UPLOAD_ERROR':
            displayMessage = t('error_imageUpload');
            break;
        default:
            console.error("Unhandled error:", err);
            displayMessage = t('unexpectedError');
    }
    setError(displayMessage);
  }, [t]);
  
  const handleImageSelect = useCallback((file: File) => { handleReset(); const src = URL.createObjectURL(file); setImage({ file, src, mimeType: file.type }); }, [handleReset]);
  
  const handleProcessResult = async (newEntry: HistoryEntry) => {
    triggerHapticFeedback([100, 30, 100]);
    try {
        // Sanitize all images to prevent CORS issues
        const cleanImageSrc = await imageToDataUrl(newEntry.imageSrc);
        const cleanMapSrc = newEntry.mapaDistribucionSrc ? await imageToDataUrl(newEntry.mapaDistribucionSrc) : undefined;

        const thumbImageSrc = await createThumbnail(cleanImageSrc);
        const thumbMapSrc = cleanMapSrc ? await createThumbnail(cleanMapSrc) : undefined;
        
        const finalEntry = { ...newEntry, imageSrc: cleanImageSrc, mapaDistribucionSrc: cleanMapSrc, difficulty: difficultyLevel };
        const historyEntry = { ...newEntry, imageSrc: thumbImageSrc, mapaDistribucionSrc: thumbMapSrc, difficulty: difficultyLevel };
        
        setCurrentResult(finalEntry);
        saveHistory([historyEntry, ...history].slice(0, 30));

    } catch (error) {
        console.error("Error processing result images:", error);
        setCurrentResult(newEntry);
        saveHistory([newEntry, ...history].slice(0, 30));
    }
  };

  const getLocation = (): Promise<{ latitude: number; longitude: number } | null> => new Promise((resolve) => { if (!navigator.geolocation) { resolve(null); } navigator.geolocation.getCurrentPosition( (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }), () => resolve(null), { timeout: 10000 } ); });
  
  const processImage = async () => {
    if (!image) return;
    setIsLoading(true); setIsTextSearching(false); setError(null); setCurrentResult(null);
    try {
        const base64Image = await fileToBase64(image.file);
        const imageSrcDataUrl = await blobUrlToDataUrl(image.src);
        const location = await getLocation();
        const { mushroomInfo, sources, mapaDistribucionSrc, mapGenerationFailed } = await identifyMushroomFromImage(base64Image, image.mimeType, location, language, difficultyLevel, imageQuality);
        
        await handleProcessResult({ id: `${Date.now()}-${mushroomInfo.nombreCientifico}`, timestamp: Date.now(), imageSrc: imageSrcDataUrl, type: 'mushroom', mushroomInfo, sources, mapaDistribucionSrc: mapaDistribucionSrc ?? undefined, mapGenerationFailed });
        
    } catch (err: any) {
        processError(err);
    } finally { setIsLoading(false); setImage(null); }
};

  const handleTextSearch = async (query: string) => {
    handleReset(); 
    setIsLoading(true); 
    setIsTextSearching(true);
    try {
        const { mushroomInfo, sources, imageSrc, mapaDistribucionSrc, mainImageGenerationFailed, mapGenerationFailed } = await identifyMushroomFromText(query, language, difficultyLevel, imageQuality);
        
        // Use the fallback mushroom icon if image generation failed
        const finalImageSrc = imageSrc || getFallbackMushroomIcon();
        
        await handleProcessResult({ 
            id: `${Date.now()}-${mushroomInfo.nombreCientifico}`, 
            timestamp: Date.now(), 
            imageSrc: finalImageSrc, 
            type: 'mushroom', 
            mushroomInfo, 
            sources, 
            mapaDistribucionSrc: mapaDistribucionSrc ?? undefined,
            mainImageGenerationFailed,
            mapGenerationFailed
        });
    } catch (err: any) {
        processError(err);
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
              // Open diary modal right after saving for the first time
              setEditingDiaryEntry(finalEntry);
              setIsFieldDiaryOpen(true);

          } catch (err: any) {
              console.error("Could not create thumbnail for collection:", err);
              saveCollection([currentResult, ...collection]);
              setNotification(t('savedToCollection'));
              setEditingDiaryEntry(currentResult);
              setIsFieldDiaryOpen(true);
          }
      }
  };

    const handleEditDiary = () => {
        if (currentResult) {
            // Find the latest version from the collection state
            const collectionVersion = collection.find(c => c.id === currentResult.id);
            setEditingDiaryEntry(collectionVersion || currentResult);
            setIsFieldDiaryOpen(true);
        }
    };
    
    const handleSaveDiary = (diaryData: Partial<HistoryEntry>) => {
        if (!editingDiaryEntry) return;

        const updatedCollection = collection.map(entry => 
            entry.id === editingDiaryEntry.id
                ? { ...entry, ...diaryData }
                : entry
        );
        saveCollection(updatedCollection);

        // Also update currentResult if it's being displayed
        if (currentResult && currentResult.id === editingDiaryEntry.id) {
            setCurrentResult(prev => prev ? { ...prev, ...diaryData } : null);
        }
    };


  const handleRemoveFromCollection = (id: string) => saveCollection(collection.filter(entry => entry.id !== id));
  const handleCloseCollection = () => { setIsCollectionOpen(false); setCollectionNameFilter(''); setCollectionSortOrder('date-desc'); };
  const handleStartCompare = (mushroomEntry: HistoryEntry) => { setComparisonMushrooms({ mushroomA: mushroomEntry, mushroomB: null }); setComparisonResult(null); setCurrentResult(null); setError(null); setView('comparator'); setIsCollectionOpen(false); };
  
  const filteredAndSortedCollection = useMemo(() => {
    return [...collection]
      .filter(item => (item.mushroomInfo?.nombreComun || '').toLowerCase().includes(collectionNameFilter.toLowerCase()))
      .sort((a, b) => {
        const nameA = a.mushroomInfo?.nombreComun || ''; 
        const nameB = b.mushroomInfo?.nombreComun || '';
        switch (collectionSortOrder) { 
          case 'name-asc': return nameA.localeCompare(nameB); 
          case 'name-desc': return nameB.localeCompare(nameA); 
          case 'date-asc': return a.timestamp - b.timestamp; 
          default: return b.timestamp - a.timestamp; 
        }
      });
  }, [collection, collectionSortOrder, collectionNameFilter]);

  const handleExportCollection = useCallback(() => {
    if (filteredAndSortedCollection.length === 0) { alert("The collection is empty or there are no results for the applied filters."); return; }
    const exportData = filteredAndSortedCollection.map(entry => ({ 
        type: entry.type, 
        name: entry.mushroomInfo?.nombreComun, 
        scientificName: entry.mushroomInfo?.nombreCientifico, 
        savedDate: new Date(entry.timestamp).toISOString(), 
        summary: `Edibility: ${entry.mushroomInfo?.toxicidad.nivelToxicidad}. Habitat: ${entry.mushroomInfo?.habitat}`,
        diary: {
            notes: entry.personalNotes,
            date: entry.findingDate,
            location: entry.location,
            photosCount: entry.userPhotos?.length || 0
        }
    }));
    const jsonString = JSON.stringify(exportData, null, 2); 
    const blob: Blob = new Blob([jsonString], { type: 'application/json' }); 
    const url = URL.createObjectURL(blob); 
    const link = document.createElement('a'); 
    link.href = url; 
    link.download = `mushroom_collection_export_${new Date().toISOString().split('T')[0]}.json`; 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
    URL.revokeObjectURL(url);
  }, [filteredAndSortedCollection]);

    const renderMainView = () => {
        if (isLoading) return <Loader message={t('analyzing')} subMessage={t(isTextSearching ? 'textSearchLoadingSub' : 'loadingMessage')} />;
        if (error) return (
        <div className="text-center p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg max-w-md w-full">
            <Icon name="cross" className="w-16 h-16 text-red-500 mx-auto mb-4" /><h3 className="text-xl font-bold text-red-800 dark:text-red-300 mb-2">{t('errorTitle')}</h3><p className="text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-900/50 p-3 rounded-lg">{error}</p>
            <button onClick={handleReset} className="mt-6 px-6 py-2 bg-red-600 dark:bg-red-700 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">{t('tryAgain')}</button>
        </div>
        );
        if (currentResult) {
            const isInCollection = collection.some(entry => entry.id === currentResult.id);
            // Ensure the currentResult has the latest diary data from the collection
            const collectionVersion = collection.find(c => c.id === currentResult.id);
            const displayResult = collectionVersion || currentResult;
            return <ResultCard result={displayResult} onReset={handleReset} isInCollection={isInCollection} onToggleCollection={handleToggleCollection} onStartCompare={() => handleStartCompare(currentResult)} onEditDiary={handleEditDiary} difficulty={displayResult.difficulty || 'Intermediate'} />;
        }
        if (image) return (
        <div className="text-center p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg max-w-md">
            <img src={image.src} alt="Selected Mushroom" className="max-h-64 w-auto mx-auto rounded-lg shadow-md mb-6" /><h3 className="text-xl font-bold text-stone-900 dark:text-amber-200 mb-6">{t('readyToAnalyze')}</h3>
            <div className="flex justify-center gap-4"><button onClick={() => { setImage(null); triggerHapticFeedback(); }} className="px-6 py-3 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 font-semibold rounded-lg shadow-md border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600">{t('changePhoto')}</button><button onClick={() => { processImage(); triggerHapticFeedback(); }} className="px-6 py-3 bg-amber-600 text-white font-semibold rounded-lg shadow-md hover:bg-amber-700">{t('analyze')}</button></div>
        </div>
        );
        
        return (
        <div className="flex flex-col items-center gap-4">
            <MainInput 
              onImageSelect={handleImageSelect} 
              isLoading={isLoading} 
              onTextSearch={handleTextSearch} 
              onError={(errorCode) => processError(new Error(errorCode))}
              difficultyLevel={difficultyLevel}
              onDifficultyChange={setDifficultyLevel}
              imageQuality={imageQuality}
              onImageQualityChange={setImageQuality}
            />
            <div className="flex flex-wrap justify-center items-center gap-4 mt-4">
                {history.length > 0 && <button onClick={() => { setIsHistoryOpen(true); triggerHapticFeedback(); }} className="inline-flex items-center justify-center gap-2 px-6 py-2 text-gray-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors bg-white/60 dark:bg-slate-800/60"><Icon name="history" className="w-5 h-5" />{t('history')}</button>}
                {collection.length > 0 && <button onClick={() => { setIsCollectionOpen(true); triggerHapticFeedback(); }} className="inline-flex items-center justify-center gap-2 px-6 py-2 text-gray-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors bg-white/60 dark:bg-slate-800/60"><Icon name="book" className="w-5 h-5" />{t('myCollection')}</button>}
                <button onClick={() => { setIsManualOpen(true); triggerHapticFeedback(); }} className="inline-flex items-center justify-center gap-2 px-6 py-2 text-gray-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors bg-white/60 dark:bg-slate-800/60">
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
                const { mushroomInfo, sources, imageSrc, mapaDistribucionSrc } = await identifyMushroomFromText(query, language, 'Intermediate', 'Standard');
                const finalImageSrc = imageSrc || getFallbackMushroomIcon();
                setComparisonMushrooms(prev => ({ ...prev, mushroomB: { id: `${Date.now()}-${mushroomInfo.nombreCientifico}`, timestamp: Date.now(), imageSrc: finalImageSrc, type: 'mushroom', mushroomInfo, sources, mapaDistribucionSrc: mapaDistribucionSrc ?? undefined } }));
            } catch (err: any) { processError(err); } finally { setIsLoading(false); }
        };

        const handleGenerateComparison = async () => {
            if (!comparisonMushrooms.mushroomA?.mushroomInfo || !comparisonMushrooms.mushroomB?.mushroomInfo) return;
            setIsLoading(true); setError(null); setComparisonResult(null);
            try {
                const result = await compareMushrooms(comparisonMushrooms.mushroomA.mushroomInfo, comparisonMushrooms.mushroomB.mushroomInfo, language);
                setComparisonResult(result);
                triggerHapticFeedback([100, 30, 100]);
            } catch (err: any) { processError(err); } finally { setIsLoading(false); }
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
            <div className="w-full max-w-5xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden my-8 border border-amber-200 dark:border-stone-800 p-6 sm:p-8">
                <h2 className="text-3xl font-bold text-center text-stone-900 dark:text-amber-200 mb-6">{t('comparatorTitle')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8 items-start">
                    <div className="text-center p-4 border border-gray-200 dark:border-slate-700 rounded-lg"><img src={mushroomA.imageSrc} alt={mushroomA.mushroomInfo.nombreComun} className="w-32 h-32 object-cover rounded-full mx-auto mb-4 shadow-lg" /><h3 className="font-bold text-xl text-stone-800 dark:text-amber-300">{mushroomA.mushroomInfo.nombreComun}</h3><p className="text-sm italic text-gray-500 dark:text-slate-400">{mushroomA.mushroomInfo.nombreCientifico}</p></div>
                    <div className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg">{comparisonMushrooms.mushroomB ? (<div className="text-center"><img src={comparisonMushrooms.mushroomB.imageSrc} alt={comparisonMushrooms.mushroomB.mushroomInfo?.nombreComun} className="w-32 h-32 object-cover rounded-full mx-auto mb-4 shadow-lg" /><h3 className="font-bold text-xl text-stone-800 dark:text-amber-300">{comparisonMushrooms.mushroomB.mushroomInfo?.nombreComun}</h3><p className="text-sm italic text-gray-500 dark:text-slate-400">{comparisonMushrooms.mushroomB.mushroomInfo?.nombreCientifico}</p></div>) : (<div className="text-center"><h3 className="font-bold text-xl mb-4 text-gray-700 dark:text-slate-300">{t('selectMushroomB')}</h3><SearchInput onSearch={handleComparisonSearch} isLoading={isLoading} /></div>)}</div>
                </div>
                <div className="text-center mb-8"><button onClick={() => { handleGenerateComparison(); triggerHapticFeedback(); }} disabled={!comparisonMushrooms.mushroomB || isLoading} className="px-8 py-4 bg-amber-600 text-white font-bold text-lg rounded-lg shadow-lg hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-transform transform hover:scale-105"><div className="flex items-center gap-3"><Icon name="compare" className="w-6 h-6" /><span>{isLoading && !comparisonResult ? t('generating') : t('generateComparison')}</span></div></button></div>
                {isLoading && !comparisonResult && <Loader message={t('generatingComparison')} subMessage="" />}
                {error && <p className="text-red-500 text-center p-4 bg-red-100 dark:bg-red-900/50 rounded-lg">{error}</p>}
                {comparisonResult && (
                    <div className="space-y-6 mt-8 border-t border-gray-200 dark:border-slate-700 pt-8">
                        <div>
                            <h3 className="text-2xl font-bold mb-4 text-center">{t('comparativeAnalysis')}</h3>
                            <p className="mb-6 bg-stone-50 dark:bg-stone-900/40 p-4 rounded-lg text-gray-700 dark:text-slate-300">{comparisonResult.resumenComparativo}</p>
                        </div>
                        
                        <div className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
                            <h4 className="font-bold text-lg mb-3 flex items-center gap-2"><Icon name="utensils" className="w-5 h-5 text-amber-600 dark:text-amber-500" />{t('culinaryUses')}</h4>
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
                             <h4 className="font-bold text-lg mb-3 flex items-center gap-2"><Icon name="mushroom" className="w-5 h-5 text-amber-600 dark:text-amber-500" />{t('morphologicalDifferences')}</h4>
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
  
    if (!hasApiKey) {
        return (
            <main className="min-h-screen w-full bg-gradient-to-br from-stone-200 via-amber-100 to-orange-100 dark:from-slate-900 dark:via-stone-900 dark:to-amber-950 flex flex-col items-center justify-center p-4">
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl max-w-md text-center border border-amber-200 dark:border-stone-700">
                     <div className="flex justify-center items-center gap-3 mb-6">
                          <Icon name="mushroom" className="w-12 h-12 text-amber-800 dark:text-amber-200" />
                     </div>
                    <h2 className="text-2xl font-bold mb-4 text-stone-800 dark:text-amber-200">{t('appName')} - Gemini 3 Pro</h2>
                    <p className="mb-8 text-gray-600 dark:text-slate-400">
                        {language === 'es' 
                          ? "Para utilizar los modelos avanzados Gemini 3 Pro y la generación de imágenes en alta resolución, es necesario seleccionar una clave de API válida."
                          : "To use the advanced Gemini 3 Pro models and high-resolution image generation, you must select a valid API key."}
                    </p>
                    <button 
                      onClick={async () => {
                          const win = window as any;
                          if (win.aistudio) {
                              await win.aistudio.openSelectKey();
                              setHasApiKey(true);
                          }
                      }} 
                      className="w-full px-6 py-3 bg-amber-600 text-white font-semibold rounded-lg shadow-md hover:bg-amber-700 transition-transform transform hover:scale-105"
                    >
                        {language === 'es' ? "Seleccionar Clave API" : "Select API Key"}
                    </button>
                     <p className="mt-6 text-xs text-gray-500 dark:text-slate-500">
                        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-amber-600 dark:hover:text-amber-400">
                            {language === 'es' ? "Información de Facturación" : "Billing Information"}
                        </a>
                    </p>
                </div>
            </main>
        );
    }

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-stone-200 via-amber-100 to-orange-100 dark:from-slate-900 dark:via-stone-900 dark:to-amber-950 flex flex-col items-center justify-center p-4 overflow-y-auto relative">
      {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <div className="flex items-center bg-white/60 dark:bg-slate-800/60 rounded-full shadow-md">
          <button onClick={() => { setLanguage('es'); triggerHapticFeedback(); }} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${language === 'es' ? 'bg-amber-600 text-white' : 'text-gray-700 dark:text-slate-300'}`}>ES</button>
          <button onClick={() => { setLanguage('en'); triggerHapticFeedback(); }} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${language === 'en' ? 'bg-amber-600 text-white' : 'text-gray-700 dark:text-slate-300'}`}>EN</button>
        </div>
        <button
          onClick={() => { toggleTheme(); triggerHapticFeedback(); }}
          className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-full shadow-md text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          aria-label={theme === 'light' ? t('switchToDarkMode') : t('switchToLightMode')}
        >
          <Icon name={theme === 'light' ? 'moon' : 'sun'} className="w-5 h-5" />
        </button>
      </div>
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} onSelectItem={handleViewHistoryItem} onClearHistory={() => saveHistory([])} />
      <CollectionModal isOpen={isCollectionOpen} onClose={handleCloseCollection} collection={filteredAndSortedCollection} onSelectItem={handleViewHistoryItem} onRemoveItem={handleRemoveFromCollection} onExport={handleExportCollection} sortOrder={collectionSortOrder} onSortOrderChange={(e) => setCollectionSortOrder(e.target.value)} nameFilter={collectionNameFilter} onNameFilterChange={(e) => setCollectionNameFilter(e.target.value)} onStartCompare={handleStartCompare} />
      <ManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
      <FieldDiaryModal isOpen={isFieldDiaryOpen} onClose={() => setIsFieldDiaryOpen(false)} onSave={handleSaveDiary} entry={editingDiaryEntry} />

      {view === 'main' ? renderMainView() : renderComparatorView()}
    </main>
  );
}

export default App;