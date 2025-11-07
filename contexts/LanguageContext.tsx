import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';

const esTranslations = {
  "appName": "Identificador de Hongos IA",
  "identifyMushroom": "Identificar Hongo",
  "searchByNamePlaceholder": "Buscar hongo por nombre...",
  "takePhoto": "Tomar Foto",
  "uploadFile": "Subir Archivo",
  "warningDisclaimer": "Advertencia: La identificación de hongos es difícil y peligrosa. Esta app es una herramienta educativa, no un sustituto de un experto. Nunca consumas un hongo basándote únicamente en esta identificación. Un error puede ser mortal.",
  "analyzing": "Analizando...",
  "loadingMessage": "Esto puede tardar un momento.",
  "errorTitle": "Error",
  "tryAgain": "Intentar de Nuevo",
  "history": "Historial",
  "myCollection": "Mi Colección",
  "culinaryUses": "Usos Culinarios",
  "toxicity": "Comestibilidad y Toxicidad",
  "sources": "Fuentes",
  "save": "Guardar",
  "saved": "Guardado",
  "compare": "Comparar",
  "anotherQuery": "Realizar otra consulta",
  "manageApiKey": "Gestionar Clave de API",
  "apiKeyModalTitle": "Parece que has alcanzado el límite de consultas o la clave de API no es válida. Puedes introducir tu propia clave de API de Gemini para continuar.",
  "yourApiKeyLabel": "Tu Clave de API de Gemini",
  "apiKeyPlaceholder": "Introduce tu clave aquí",
  "saveAndRetry": "Guardar y Reintentar",
  "clearKey": "Borrar Clave",
  "getYourApiKey": "Puedes obtener tu clave de API en {link}. Tu clave se guarda de forma segura solo en tu navegador.",
  "apiKeyError": "Por favor, configura tu clave de API para continuar.",
  "unexpectedError": "Ocurrió un error inesperado.",
  "alsoKnownAs": "También conocido como",
  "habitat": "Hábitat",
  "season": "Temporada",
  "distributionMap": "Mapa de Distribución Geográfica",
  "similarMushrooms": "Hongos Similares (¡Peligro de Confusión!)",
  "recipes": "Recetas",
  "share": "Compartir",
  "copied": "Copiado",
  "keyDifference": "Diferencia Clave",
  "importantDisclaimerSimilar": "Importante: La confusión entre especies de hongos puede tener consecuencias fatales. Verifica siempre múltiples fuentes y consulta a un micólogo experto antes de considerar el consumo.",
  "ingredients": "Ingredientes",
  "instructions": "Instrucciones",
  "identifyMushroomTitle": "Identifica un hongo por su nombre o fotografía.",
  "orSeparator": "O",
  "readyToAnalyze": "¿Listo para ser analizado?",
  "changePhoto": "Cambiar Foto",
  "analyze": "Analizar",
  "textSearchLoading": "Buscando información...",
  "textSearchLoadingSub": "La generación de imágenes puede tardar un poco más.",
  "close": "Cerrar",
  "historyModalTitle": "Historial de Búsquedas",
  "noHistory": "No hay búsquedas en tu historial.",
  "clearHistory": "Borrar Historial",
  "clearHistoryConfirm": "¿Estás seguro? Esta acción borrará todo tu historial.",
  "collectionModalTitle": "Mi Colección de Hongos",
  "filterByName": "Filtrar por nombre...",
  "sortBy": "Ordenar por",
  "sortDateDesc": "Más recientes",
  "sortDateAsc": "Más antiguos",
  "sortNameAsc": "Nombre (A-Z)",
  "sortNameDesc": "Nombre (Z-A)",
  "noCollection": "Tu colección está vacía. ¡Guarda hongos para empezar!",
  "exportToJson": "Exportar a JSON",
  "removeFromCollection": "Eliminar de la colección",
  "comparatorTitle": "Comparador de Hongos",
  "selectMushroomB": "Seleccionar Hongo B",
  "generateComparison": "Generar Comparación",
  "backToMainSearch": "Volver a la Búsqueda Principal",
  "generatingComparison": "Generando comparación...",
  "comparativeAnalysis": "Análisis Comparativo",
  "similarities": "Similitudes",
  "differences": "Diferencias",
  "appManual": "Manual de la App",
  "imageGenerationFailedWarning": "No se pudo generar una imagen representativa. Esto puede ocurrir si la clave de API no tiene permisos para el modelo de generación de imágenes.",
  "toxicityLevel": "Nivel de Comestibilidad",
  "toxicCompounds": "Compuestos Tóxicos",
  "symptoms": "Síntomas de Intoxicación",
  "firstAid": "Primeros Auxilios",
  "toxicityLevel_Edible": "Comestible",
  "toxicityLevel_Inedible": "No Comestible",
  "toxicityLevel_Caution": "Con Precaución",
  "toxicityLevel_Poisonous": "Venenoso",
  "toxicityLevel_Lethal": "Mortal",
  "exportToPdf": "Exportar a PDF",
  "exporting": "Exportando...",
  "savedToCollection": "¡Guardado en tu colección!",
  "sharing": "Compartiendo...",
  "checkOutMushroom": "Echa un vistazo a este hongo:",
  "identifiedWith": "identificado con",
  "morphologicalDifferences": "Diferencias Morfológicas",
  "appearance": "Apariencia",
  "addToDiary": "Añadir al Diario de Campo",
  "editDiary": "Editar Diario",
  "fieldDiaryTitle": "Diario de Campo",
  "fieldDiaryNotesLabel": "Notas Personales",
  "fieldDiaryNotesPlaceholder": "Describe el entorno, olor, textura, etc.",
  "fieldDiaryDateLabel": "Fecha del Hallazgo",
  "fieldDiaryLocationLabel": "Ubicación",
  "fieldDiaryLocationButton": "Obtener Ubicación Actual",
  "fieldDiaryLocationGetting": "Obteniendo...",
  "fieldDiaryLocationSet": "Ubicación guardada",
  "fieldDiaryLocationError": "Error al obtener",
  "fieldDiaryPhotosLabel": "Tus Fotos",
  "fieldDiaryPhotosButton": "Subir Fotos",
  "fieldDiarySaveButton": "Guardar en Diario",
  "fieldDiaryUpdateButton": "Actualizar Diario",
  "fieldDiaryCancelButton": "Cancelar",
  "myFieldDiarySectionTitle": "Mi Diario de Campo",
  "switchToDarkMode": "Cambiar a modo oscuro",
  "switchToLightMode": "Cambiar a modo claro"
};

const enTranslations = {
  "appName": "AI Mushroom Identifier",
  "identifyMushroom": "Identify Mushroom",
  "searchByNamePlaceholder": "Search mushroom by name...",
  "takePhoto": "Take Photo",
  "uploadFile": "Upload File",
  "warningDisclaimer": "Warning: Mushroom identification is difficult and dangerous. This app is an educational tool, not a substitute for an expert. Never consume a mushroom based solely on this identification. A mistake can be fatal.",
  "analyzing": "Analyzing...",
  "loadingMessage": "This may take a moment.",
  "errorTitle": "Error",
  "tryAgain": "Try Again",
  "history": "History",
  "myCollection": "My Collection",
  "culinaryUses": "Culinary Uses",
  "toxicity": "Edibility & Toxicity",
  "sources": "Sources",
  "save": "Save",
  "saved": "Saved",
  "compare": "Compare",
  "anotherQuery": "Make another query",
  "manageApiKey": "Manage API Key",
  "apiKeyModalTitle": "It seems you've reached the query limit or the API key is invalid. You can enter your own Gemini API key to continue.",
  "yourApiKeyLabel": "Your Gemini API Key",
  "apiKeyPlaceholder": "Enter your key here",
  "saveAndRetry": "Save and Retry",
  "clearKey": "Clear Key",
  "getYourApiKey": "You can get your API key from {link}. Your key is stored securely in your browser only.",
  "apiKeyError": "Please set up your API key to continue.",
  "unexpectedError": "An unexpected error occurred.",
  "alsoKnownAs": "Also known as",
  "habitat": "Habitat",
  "season": "Season",
  "distributionMap": "Geographic Distribution Map",
  "similarMushrooms": "Similar Mushrooms (Danger of Confusion!)",
  "recipes": "Recipes",
  "share": "Share",
  "copied": "Copied",
  "keyDifference": "Key Difference",
  "importantDisclaimerSimilar": "Important: Confusion between mushroom species can have fatal consequences. Always verify with multiple sources and consult an expert mycologist before considering consumption.",
  "ingredients": "Ingredients",
  "instructions": "Instructions",
  "identifyMushroomTitle": "Identify a mushroom by its name or a photograph.",
  "orSeparator": "OR",
  "readyToAnalyze": "Ready to be analyzed?",
  "changePhoto": "Change Photo",
  "analyze": "Analyze",
  "textSearchLoading": "Searching for information...",
  "textSearchLoadingSub": "Image generation may take a little longer.",
  "close": "Close",
  "historyModalTitle": "Search History",
  "noHistory": "There are no searches in your history.",
  "clearHistory": "Clear History",
  "clearHistoryConfirm": "Are you sure? This action will delete your entire history.",
  "collectionModalTitle": "My Mushroom Collection",
  "filterByName": "Filter by name...",
  "sortBy": "Sort by",
  "sortDateDesc": "Most recent",
  "sortDateAsc": "Oldest",
  "sortNameAsc": "Name (A-Z)",
  "sortNameDesc": "Name (Z-A)",
  "noCollection": "Your collection is empty. Save mushrooms to get started!",
  "exportToJson": "Export to JSON",
  "removeFromCollection": "Remove from collection",
  "comparatorTitle": "Mushroom Comparator",
  "selectMushroomB": "Select Mushroom B",
  "generateComparison": "Generate Comparison",
  "backToMainSearch": "Back to Main Search",
  "generatingComparison": "Generating comparison...",
  "comparativeAnalysis": "Comparative Analysis",
  "similarities": "Similarities",
  "differences": "Differences",
  "appManual": "App Manual",
  "imageGenerationFailedWarning": "Could not generate a representative image. This can happen if the API key does not have permissions for the image generation model.",
  "toxicityLevel": "Edibility Level",
  "toxicCompounds": "Toxic Compounds",
  "symptoms": "Poisoning Symptoms",
  "firstAid": "First Aid",
  "toxicityLevel_Edible": "Edible",
  "toxicityLevel_Inedible": "Inedible",
  "toxicityLevel_Caution": "Caution",
  "toxicityLevel_Poisonous": "Poisonous",
  "toxicityLevel_Lethal": "Lethal",
  "exportToPdf": "Export to PDF",
  "exporting": "Exporting...",
  "savedToCollection": "Saved to your collection!",
  "sharing": "Sharing...",
  "checkOutMushroom": "Check out this mushroom:",
  "identifiedWith": "identified with",
  "morphologicalDifferences": "Morphological Differences",
  "appearance": "Appearance",
  "addToDiary": "Add to Field Diary",
  "editDiary": "Edit Diary",
  "fieldDiaryTitle": "Field Diary",
  "fieldDiaryNotesLabel": "Personal Notes",
  "fieldDiaryNotesPlaceholder": "Describe the environment, smell, texture, etc.",
  "fieldDiaryDateLabel": "Date of Finding",
  "fieldDiaryLocationLabel": "Location",
  "fieldDiaryLocationButton": "Get Current Location",
  "fieldDiaryLocationGetting": "Getting...",
  "fieldDiaryLocationSet": "Location Saved",
  "fieldDiaryLocationError": "Failed to get",
  "fieldDiaryPhotosLabel": "Your Photos",
  "fieldDiaryPhotosButton": "Upload Photos",
  "fieldDiarySaveButton": "Save to Diary",
  "fieldDiaryUpdateButton": "Update Diary",
  "fieldDiaryCancelButton": "Cancel",
  "myFieldDiarySectionTitle": "My Field Diary",
  "switchToDarkMode": "Switch to dark mode",
  "switchToLightMode": "Switch to light mode"
};

type Language = 'es' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations = { es: esTranslations, en: enTranslations };

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('es');

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback((key: string, replacements?: { [key: string]: string | number }): string => {
    const translationSet = translations[language];
    if (!translationSet) {
      return key; // Fallback to key if translations are somehow missing
    }
    let translation = (translationSet as any)[key] || key;
    if (replacements) {
      Object.entries(replacements).forEach(([rKey, value]) => {
        translation = translation.replace(`{${rKey}}`, String(value));
      });
    }
    return translation;
  }, [language]);

  const value = { language, setLanguage, t };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};