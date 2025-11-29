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
  "saved": "Quitar",
  "compare": "Comparar",
  "anotherQuery": "Realizar otra consulta",
  "unexpectedError": "Ocurrió un error inesperado. Si el problema persiste, intenta refrescar la página.",
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
  "imageGenerationFailedWarning": "No se pudo generar una imagen. Esto puede deberse a límites de cuota de la API, permisos o un problema temporal del servicio.",
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
  "exportToJpg": "Exportar a JPG",
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
  "switchToLightMode": "Cambiar a modo claro",
  "difficultyLevel": "Nivel de Dificultad",
  "difficulty_Beginner": "Principiante",
  "difficulty_Intermediate": "Intermedio",
  "difficulty_Expert": "Experto",
  "imageQuality": "Calidad de Imagen",
  "quality_Standard": "Estándar",
  "quality_High": "Alta",
  "error_network": "No se pudo conectar con el servicio de identificación. Por favor, comprueba tu conexión a internet e inténtalo de nuevo.",
  "error_invalidResponse": "El servicio de identificación devolvió una respuesta inesperada. Esto podría ser un problema temporal. Por favor, inténtalo de nuevo.",
  "error_imageUpload": "El archivo seleccionado no es una imagen. Por favor, elige un archivo de imagen válido (JPG, PNG, WEBP, etc.).",
  "error_api_quota": "El servicio está experimentando una alta demanda en este momento. Por favor, inténtalo de nuevo más tarde.",
  "error_service_config": "Error de configuración: La API Key proporcionada no es válida. Por favor, verifica en Render que no haya espacios extra al copiar la clave.",
  "error_service_config_api_key_missing": "Clave de API no encontrada. Asegúrate de que la variable de entorno 'API_KEY' está configurada correctamente en tu panel de control de Render.",
  "error_identify_failed": "No se pudo identificar el hongo. Inténtalo con una imagen más clara o un nombre más específico.",
  "toxic": "TÓXICO"
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
  "saved": "Unsave",
  "compare": "Compare",
  "anotherQuery": "Make another query",
  "unexpectedError": "An unexpected error occurred. If the problem persists, please try refreshing the page.",
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
  "imageGenerationFailedWarning": "Could not generate an image. This may be due to API quota limits, permissions, or a temporary service issue.",
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
  "exportToJpg": "Export to JPG",
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
  "switchToLightMode": "Switch to light mode",
  "difficultyLevel": "Difficulty Level",
  "difficulty_Beginner": "Beginner",
  "difficulty_Intermediate": "Intermediate",
  "difficulty_Expert": "Expert",
  "imageQuality": "Image Quality",
  "quality_Standard": "Standard",
  "quality_High": "High",
  "error_network": "Could not connect to the identification service. Please check your internet connection and try again.",
  "error_invalidResponse": "The identification service returned an unexpected response. This might be a temporary issue. Please try again.",
  "error_imageUpload": "The selected file is not an image. Please choose a valid image file (JPG, PNG, WEBP, etc.).",
  "error_api_quota": "The service is currently experiencing high demand. Please try again later.",
  "error_service_config": "Configuration Error: The provided API Key is invalid. Please check Render configuration for extra spaces.",
  "error_service_config_api_key_missing": "API Key not found. Please ensure the 'API_KEY' environment variable is correctly configured in your Render dashboard.",
  "error_identify_failed": "Could not identify the mushroom. Please try with a clearer image or a more specific name.",
  "toxic": "TOXIC"
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