import { GoogleGenAI, GroundingChunk, Modality } from "@google/genai";
import { MushroomInfo, GroundingSource, Recipe, SimilarMushroom, ComparisonInfo, ToxicityInfo, ImageQuality } from '../types.ts';

// --- API CLIENT HELPER ---
// We initialize the client on demand to ensure we always get the latest API key from the environment.
const getAiClient = () => {
    let apiKey: string | undefined;

    // 1. Try Vite standard (import.meta.env)
    // Most modern React builds on Render use Vite. Variables must start with VITE_
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            apiKey = import.meta.env.VITE_API_KEY || import.meta.env.API_KEY;
        }
    } catch (e) {
        // Ignore errors accessing import.meta
    }

    // 2. Try process.env (Standard Node/Webpack/CRA)
    // CRA requires REACT_APP_ prefix. Older builds might use plain API_KEY.
    if (!apiKey) {
        try {
            if (typeof process !== 'undefined' && process.env) {
                apiKey = process.env.REACT_APP_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY;
            }
        } catch (e) {
             // Ignore errors accessing process
        }
    }

    if (!apiKey) {
        console.error("API Key check failed: No valid API key found in environment variables (VITE_API_KEY, REACT_APP_API_KEY, or API_KEY).");
        throw new Error("SERVICE_CONFIG_ERROR_API_KEY_MISSING");
    }

    // Initialize client with trimmed key to prevent "API Key not valid" errors due to whitespace
    return new GoogleGenAI({ apiKey: apiKey.trim() });
};


type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Expert';

// --- PROMPTS ---

const getMushroomJsonPrompt = (context: string, language: 'es' | 'en', difficulty: DifficultyLevel) => {
  const isEs = language === 'es';

  let difficultyInstruction = '';
  if (isEs) {
      switch (difficulty) {
          case 'Beginner':
              difficultyInstruction = 'Explica todo en términos sencillos y fáciles de entender. Evita la jerga demasiado técnica. Céntrate mucho en la seguridad, la comestibilidad y los parecidos peligrosos más comunes. Haz que la "diferenciaClave" para "hongosSimilares" sea extremadamente clara para un novato.';
              break;
          case 'Expert':
              difficultyInstruction = 'Proporciona descripciones técnicas y morfológicas muy detalladas, incluyendo características microscópicas como detalles de esporas si es posible. Menciona variaciones sutiles y parecidos menos comunes. El lenguaje puede ser técnico y científico.';
              break;
          case 'Intermediate':
          default:
              difficultyInstruction = 'Proporciona un nivel de detalle equilibrado, adecuado para un aficionado con algunos conocimientos.';
              break;
      }
  } else {
      switch (difficulty) {
          case 'Beginner':
              difficultyInstruction = 'Explain everything in simple, easy-to-understand terms. Avoid overly technical jargon. Focus heavily on safety, edibility, and the most common, dangerous lookalikes. Make the "diferenciaClave" for "hongosSimilares" extremely clear for a novice.';
              break;
          case 'Expert':
              difficultyInstruction = 'Provide highly detailed technical and morphological descriptions, including microscopic features like spore details if possible. Mention subtle variations and less common lookalikes. The language can be technical and scientific.';
              break;
          case 'Intermediate':
          default:
              difficultyInstruction = 'Provide a balanced level of detail suitable for an enthusiast with some knowledge.';
              break;
      }
  }

  return isEs ? 
  `Eres una experta micóloga y bióloga. ${difficultyInstruction} ${context}. Después de identificarlo, proporciona la siguiente información en un objeto JSON con las claves EXACTAS: "nombreComun", "nombreCientifico", "sinonimos", "descripcionGeneral", "habitat", "temporada", "distribucionGeografica", "usosCulinarios", "toxicidad", "recetas", y "hongosSimilares".

- Para "descripcionGeneral", incluye detalles morfológicos clave (sombrero, láminas, pie, esporas).
- Para "habitat", describe dónde crece (tipo de bosque, suelo, árboles específicos).
- Para "temporada", indica la estación o meses en que aparece.
- Para "toxicidad", proporciona un objeto con las claves "descripcion" (explicando la comestibilidad), "nivelToxicidad" (uno de: 'Edible', 'Inedible', 'Caution', 'Poisonous', 'Lethal'), "compuestosToxicos" (lista de strings), "sintomas" (descripción de los síntomas de intoxicación), y "primerosAuxilios".
- Para "recetas", si es comestible, genera una lista de 1-2 recetas. Cada receta es un objeto con "nombre", "ingredientes", "instrucciones". Si no es comestible, devuelve [].
- Para "hongosSimilares", proporciona una lista de 1 a 3 hongos con los que se confunde comúnmente. Para cada uno, incluye "nombreComun", "nombreCientifico", "diferenciaClave" y un booleano "esToxico". Esta sección es CRÍTICA para la seguridad.

Si no puedes identificar el hongo, responde con un JSON: {"error": "No se pudo identificar el hongo."}.
La respuesta DEBE ser únicamente el objeto JSON. No omitas ninguna clave. Para listas vacías, usa [].`
  : 
  `You are an expert mycologist and biologist. ${difficultyInstruction} ${context}. After identifying it, provide the following information in a JSON object with the EXACT keys: "nombreComun", "nombreCientifico", "sinonimos", "descripcionGeneral", "habitat", "temporada", "distribucionGeografica", "usosCulinarios", "toxicidad", "recetas", and "hongosSimilares".

- For "descripcionGeneral", include key morphological details (cap, gills, stem, spores).
- For "habitat", describe where it grows (type of forest, soil, specific trees).
- For "temporada", indicate the season or months it appears.
- For "toxicidad", provide an object with keys "descripcion" (explaining edibility), "nivelToxicidad" (one of: 'Edible', 'Inedible', 'Caution', 'Poisonous', 'Lethal'), "compuestosToxicos" (list of strings), "sintomas" (description of poisoning symptoms), and "primerosAuxilios".
- For "recetas", if edible, generate a list of 1-2 recipes. Each recipe is an object with "nombre", "ingredientes", "instrucciones". If not edible, return [].
- For "hongosSimilares", provide a list of 1-3 commonly confused mushrooms. For each, include "nombreComun", "nombreCientifico", "diferenciaClave", and a boolean "esToxico". This section is CRITICAL for safety.

If you cannot identify the mushroom, respond with JSON: {"error": "Could not identify the mushroom."}.
The response MUST be only the JSON object. Do not omit any keys. For empty lists, use [].`;
};

const getCompareMushroomPrompt = (mushroomA: MushroomInfo, mushroomB: MushroomInfo, language: 'es' | 'en') => {
    const isEs = language === 'es';
    return isEs ? 
    `Eres un micólogo comparativo experto. Compara el Hongo A y el Hongo B y genera un análisis en un JSON con las claves EXACTAS: "resumenComparativo", "usosCulinarios", "toxicidad", y "diferenciasMorfologicas".

- "usosCulinarios": Objeto con "similitudes" y "diferencias".
- "toxicidad": Objeto con "comparacion", "nivelHongoA", y "nivelHongoB".
- "diferenciasMorfologicas": Objeto con "habitat" y "apariencia".

Hongo A: ${mushroomA.nombreComun} (${mushroomA.nombreCientifico})
Hongo B: ${mushroomB.nombreComun} (${mushroomB.nombreCientifico})

La respuesta DEBE ser únicamente el objeto JSON.`
    :
    `You are an expert comparative mycologist. Compare Mushroom A and Mushroom B and generate an analysis in a JSON with the EXACT keys: "resumenComparativo", "usosCulinarios", "toxicidad", and "diferenciasMorfologicas".

- "usosCulinarios": Object with "similitudes" and "diferencias".
- "toxicidad": Object with "comparacion", "nivelHongoA", and "nivelHongoB".
- "diferenciasMorfologicas": Object with "habitat" and "apariencia".

Mushroom A: ${mushroomA.nombreComun} (${mushroomA.nombreCientifico})
Mushroom B: ${mushroomB.nombreComun} (${mushroomB.nombreCientifico})

The response MUST be only the JSON object.`;
};


// --- UTILITY FUNCTIONS ---

const getJsonFromResponse = (text: string) => {
    try {
        return JSON.parse(text);
    } catch (e) {
        const match = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
            try { return JSON.parse(match[1]); } catch (parseError) { throw new Error("INVALID_RESPONSE"); }
        }
        throw new Error("INVALID_RESPONSE");
    }
};

const handleApiError = (error: unknown) => {
    console.error("API call error:", error);
    if (error instanceof Error) {
        const message = error.message;
        // Propagate our specific error message for a better UI experience.
        if (message.includes('SERVICE_CONFIG_ERROR_API_KEY_MISSING')) {
            throw error;
        }
        // Generalize other API key errors. The API typically returns "API key not valid"
        if (message.toLowerCase().includes('api key not valid')) {
            console.error("DETECTED INVALID API KEY. Please check your Render configuration for extra spaces or typos.");
            throw new Error("SERVICE_CONFIG_ERROR");
        }
        if (message.includes('429') || message.includes('resource has been exhausted')) {
            throw new Error("API_QUOTA");
        }
        if (message.includes('failed to fetch')) { // For browser-specific network errors
            throw new Error("NETWORK_ERROR");
        }
        throw error; // Rethrow other errors to be handled generically
    }
    throw new Error("UNEXPECTED_ERROR");
};

const isQuotaError = (error: unknown): boolean => {
    if (error instanceof Error) {
        const message = error.message;
        return message.includes('429') || message.toLowerCase().includes('resource has been exhausted');
    }
    return false;
};


// --- SANITIZER FUNCTIONS ---

/**
 * Formats data into a readable string, preventing "[object Object]".
 * If the data is an object, it's converted to a formatted JSON string.
 * @param data - The raw data from the API.
 * @param fallback - The fallback string to use if data is empty.
 * @returns A formatted, human-readable string.
 */
const formatTextualData = (data: any, fallback: string): string => {
    if (data === null || data === undefined || data === '') return fallback;
    if (typeof data === 'string') return data;

    if (typeof data === 'object') {
        try {
            // Pretty-print JSON for readability in the UI.
            return JSON.stringify(data, null, 2);
        } catch (e) {
            return `Could not format data: ${fallback}`;
        }
    }
    return String(data);
};

function sanitizeMushroomInfo(data: any): MushroomInfo | null {
    if (!data || typeof data !== 'object' || data.error) return null;

    const toxData = data.toxicidad && typeof data.toxicidad === 'object' ? data.toxicidad : {};
    const sanitizedToxicity: ToxicityInfo = {
        descripcion: formatTextualData(toxData.descripcion, 'No information available.'),
        nivelToxicidad: ['Edible', 'Inedible', 'Caution', 'Poisonous', 'Lethal'].includes(toxData.nivelToxicidad) ? toxData.nivelToxicidad : 'Caution',
        compuestosToxicos: Array.isArray(toxData.compuestosToxicos) ? toxData.compuestosToxicos.filter((c: any) => typeof c === 'string') : [],
        sintomas: formatTextualData(toxData.sintomas, 'Symptoms not specified.'),
        primerosAuxilios: formatTextualData(toxData.primerosAuxilios, 'In case of ingestion, seek immediate medical attention.'),
    };

    const sanitized: MushroomInfo = {
        nombreComun: formatTextualData(data.nombreComun, 'Name not available'),
        nombreCientifico: formatTextualData(data.nombreCientifico, 'Scientific name not available'),
        sinonimos: Array.isArray(data.sinonimos) ? data.sinonimos.filter((s: any) => typeof s === 'string') : [],
        descripcionGeneral: formatTextualData(data.descripcionGeneral, 'No description available.'),
        habitat: formatTextualData(data.habitat, 'Habitat not available.'),
        temporada: formatTextualData(data.temporada, 'Season not available.'),
        distribucionGeografica: formatTextualData(data.distribucionGeografica, 'Geographic distribution not available.'),
        usosCulinarios: Array.isArray(data.usosCulinarios) ? data.usosCulinarios.filter((u: any) => typeof u === 'string') : [],
        toxicidad: sanitizedToxicity,
        recetas: Array.isArray(data.recetas) ? data.recetas.map((r: any): Recipe | null => {
            if (!r || typeof r !== 'object') return null;
            return {
                nombre: formatTextualData(r.nombre, 'Unnamed Recipe'),
                ingredientes: Array.isArray(r.ingredientes) ? r.ingredientes.filter((i: any) => typeof i === 'string') : [],
                instrucciones: formatTextualData(r.instrucciones, 'No instructions.'),
            };
        }).filter((r): r is Recipe => r !== null) : [],
        hongosSimilares: Array.isArray(data.hongosSimilares) ? data.hongosSimilares.map((h: any): SimilarMushroom | null => {
            if (!h || typeof h !== 'object' || !h.nombreComun || !h.diferenciaClave) return null;
            return {
                nombreComun: formatTextualData(h.nombreComun, 'Unknown Mushroom'),
                nombreCientifico: formatTextualData(h.nombreCientifico, 'N/A'),
                diferenciaClave: formatTextualData(h.diferenciaClave, 'No key difference provided.'),
                esToxico: typeof h.esToxico === 'boolean' ? h.esToxico : true,
            };
        }).filter((h): h is SimilarMushroom => h !== null) : [],
    };

    if (sanitized.nombreComun === 'Name not available') return null;
    return sanitized;
}

function sanitizeComparisonInfo(data: any): ComparisonInfo | null {
    if (!data || typeof data !== 'object' || data.error) return null;
    const getStringArray = (val: any): string[] => Array.isArray(val) ? val.filter(item => typeof item === 'string') : [];
    const getToxicityLevel = (val: any): ToxicityInfo['nivelToxicidad'] => {
        const levels: ToxicityInfo['nivelToxicidad'][] = ['Edible', 'Inedible', 'Caution', 'Poisonous', 'Lethal'];
        return levels.includes(val) ? val : 'Caution';
    };

    return {
        resumenComparativo: formatTextualData(data.resumenComparativo, 'N/A'),
        usosCulinarios: { similitudes: getStringArray(data.usosCulinarios?.similitudes), diferencias: getStringArray(data.usosCulinarios?.diferencias) },
        toxicidad: { 
            comparacion: formatTextualData(data.toxicidad?.comparacion, 'N/A'), 
            nivelHongoA: getToxicityLevel(data.toxicidad?.nivelHongoA), 
            nivelHongoB: getToxicityLevel(data.toxicidad?.nivelHongoB) 
        },
        diferenciasMorfologicas: { 
            habitat: formatTextualData(data.diferenciasMorfologicas?.habitat, 'N/A'), 
            apariencia: formatTextualData(data.diferenciasMorfologicas?.apariencia, 'N/A') 
        },
    };
}


// --- CORE API FUNCTIONS ---

const getMushroomInfo = async (parts: any[], useGrounding: boolean, language: 'es' | 'en', difficulty: DifficultyLevel): Promise<{ mushroomInfo: MushroomInfo; sources: GroundingSource[] }> => {
  const ai = getAiClient();
  const textPart = { text: getMushroomJsonPrompt(parts.find(p => p.text).text, language, difficulty) };
  const imagePart = parts.find(p => p.inlineData);
  const finalParts = imagePart ? [imagePart, textPart] : [textPart];

  const config: any = {};
  if (useGrounding) {
    config.tools = [{ googleSearch: {} }];
  } else {
   config.responseMimeType = 'application/json';
  }

  // FALLBACK STRATEGY:
  // 1. Try with the powerful model (Gemini 3 Pro)
  // 2. If it hits a quota error (429), fallback to the faster, lighter model (Gemini 2.5 Flash)
  
  try {
    // Attempt 1: Gemini 3 Pro
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts: finalParts },
      config: config,
    });
    
    const data = getJsonFromResponse(response.text);
    if (!data) throw new Error("INVALID_RESPONSE");
    if (data.error) throw new Error("IDENTIFY_FAILED");

    const sanitizedData = sanitizeMushroomInfo(data);
    if (!sanitizedData) throw new Error("IDENTIFY_FAILED");
    
    const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: GroundingChunk) => ({
            uri: chunk.web?.uri || '',
            title: chunk.web?.title || 'Untitled Source'
        })).filter(source => source.uri) || [];

    return { mushroomInfo: sanitizedData, sources };

  } catch (error) {
    // Check if it is a quota error
    if (isQuotaError(error)) {
        console.warn("Gemini 3 Pro quota exceeded. Falling back to Gemini 2.5 Flash.");
        try {
             // Attempt 2: Gemini 2.5 Flash
             const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: finalParts },
                config: config,
              });

              const data = getJsonFromResponse(response.text);
              if (!data) throw new Error("INVALID_RESPONSE");
              if (data.error) throw new Error("IDENTIFY_FAILED");
          
              const sanitizedData = sanitizeMushroomInfo(data);
              if (!sanitizedData) throw new Error("IDENTIFY_FAILED");
              
              const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: GroundingChunk) => ({
                      uri: chunk.web?.uri || '',
                      title: chunk.web?.title || 'Untitled Source'
                  })).filter(source => source.uri) || [];
          
              return { mushroomInfo: sanitizedData, sources };

        } catch (fallbackError) {
             // If fallback also fails, then handle as a real error
             handleApiError(fallbackError);
             throw new Error("UNEXPECTED_ERROR");
        }
    } else {
        // If it was not a quota error (e.g. network), handle immediately
        handleApiError(error);
        throw new Error("UNEXPECTED_ERROR");
    }
  }
};

async function generateDistributionMap(mushroomInfo: MushroomInfo, language: 'es' | 'en', imageQuality: ImageQuality): Promise<{ data: string | null; isQuotaError: boolean; }> {
    if (!mushroomInfo.distribucionGeografica || mushroomInfo.distribucionGeografica.includes('no disponible') || mushroomInfo.distribucionGeografica.includes('not available')) {
        return { data: null, isQuotaError: false };
    }
    try {
        const ai = getAiClient();

        const highQualityPromptEs = `Tarea: Generar un mapa de distribución geográfica. Sujeto: El hongo *${mushroomInfo.nombreCientifico}*. Datos de origen para la distribución: "${mushroomInfo.distribucionGeografica}". Requisitos: Estilo de mapa de atlas, limpio y profesional. Resalta claramente las regiones geográficas mencionadas en los datos de origen. Incluye etiquetas para continentes y océanos. El mapa debe ser visualmente claro y priorizar la precisión informativa sobre el estilo artístico.`;
        const standardQualityPromptEs = `Tarea: Generar un mapa de distribución geográfica claro y legible del hongo *${mushroomInfo.nombreCientifico}*, basado en esta descripción: "${mushroomInfo.distribucionGeografica}".`;
        
        const highQualityPromptEn = `Task: Generate a geographic distribution map. Subject: The mushroom *${mushroomInfo.nombreCientifico}*. Source data for distribution: "${mushroomInfo.distribucionGeografica}". Requirements: Clean, professional atlas map style. Clearly highlight the geographic regions mentioned in the source data. Include labels for continents and oceans. The map must be visually clear and prioritize informational accuracy over artistic style.`;
        const standardQualityPromptEn = `Task: Generate a clear and legible geographic distribution map for the mushroom *${mushroomInfo.nombreCientifico}*, based on this description: "${mushroomInfo.distribucionGeografica}".`;

        const prompt_text = language === 'es'
            ? (imageQuality === 'High' ? highQualityPromptEs : standardQualityPromptEs)
            : (imageQuality === 'High' ? highQualityPromptEn : standardQualityPromptEn);
        
        const imageSize = imageQuality === 'High' ? '2K' : '1K';

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [{ text: prompt_text }] },
            config: {
                responseModalities: [Modality.IMAGE],
                imageConfig: {
                     imageSize: imageSize,
                     aspectRatio: '1:1'
                }
            },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                return { data: `data:image/jpeg;base64,${base64ImageBytes}`, isQuotaError: false };
            }
        }
        return { data: null, isQuotaError: false };

    } catch (error) {
        console.warn("Error generating distribution map:", error);
        let message = '';
        if (error instanceof Error) {
            message = error.message;
        } else if (typeof error === 'object' && error !== null) {
            message = (error as any).message || JSON.stringify(error);
        } else {
            message = String(error);
        }
        const isQuotaError = message.includes('429') || message.toLowerCase().includes('resource has been exhausted');
        return { data: null, isQuotaError: isQuotaError };
    }
}

async function generateMushroomImage(mushroomInfo: MushroomInfo, language: 'es' | 'en', imageQuality: ImageQuality): Promise<{ data: string | null; isQuotaError: boolean; }> {
    try {
        const ai = getAiClient();

        const highQualityPromptEs = `Una fotografía de calidad de estudio, ultradetallada, 8k y fotorrealista del hongo *${mushroomInfo.nombreCientifico}* (${mushroomInfo.nombreComun}). La imagen debe ser micológicamente precisa, mostrando los detalles morfológicos correctos de la especie, sobre un fondo de estudio blanco y neutro.`;
        const standardQualityPromptEs = `Una fotografía clara y micológicamente precisa del hongo *${mushroomInfo.nombreCientifico}* (${mushroomInfo.nombreComun}) sobre un fondo neutro.`;

        const highQualityPromptEn = `An ultra-detailed, 8k, photorealistic studio quality photograph of the mushroom *${mushroomInfo.nombreCientifico}* (${mushroomInfo.nombreComun}). The image must be mycologically accurate, showing the correct morphological details of the species, on a neutral white studio background.`;
        const standardQualityPromptEn = `A clear, mycologically accurate photograph of the mushroom *${mushroomInfo.nombreCientifico}* (${mushroomInfo.nombreComun}) on a neutral background.`;

        const prompt_text = language === 'es'
            ? (imageQuality === 'High' ? highQualityPromptEs : standardQualityPromptEs)
            : (imageQuality === 'High' ? highQualityPromptEn : standardQualityPromptEn);

        const imageSize = imageQuality === 'High' ? '2K' : '1K';

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [{ text: prompt_text }] },
            config: {
                responseModalities: [Modality.IMAGE],
                imageConfig: {
                    imageSize: imageSize,
                    aspectRatio: '1:1'
                }
            },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                return { data: `data:image/jpeg;base64,${base64ImageBytes}`, isQuotaError: false };
            }
        }
        return { data: null, isQuotaError: false };
        
    } catch (error) {
        console.warn("Graceful: Could not generate mushroom image. Falling back to placeholder.", error);
        let message = '';
        if (error instanceof Error) {
            message = error.message;
        } else if (typeof error === 'object' && error !== null) {
            message = (error as any).message || JSON.stringify(error);
        } else {
            message = String(error);
        }
        const isQuotaError = message.includes('429') || message.toLowerCase().includes('resource has been exhausted');
        return { data: null, isQuotaError: isQuotaError };
    }
}


export const identifyMushroomFromImage = async (
  base64Image: string,
  mimeType: string,
  location: { latitude: number; longitude: number } | null,
  language: 'es' | 'en',
  difficulty: DifficultyLevel,
  imageQuality: ImageQuality
): Promise<{ mushroomInfo: MushroomInfo; sources: GroundingSource[], mapaDistribucionSrc: string | null; mapGenerationFailed: boolean; }> => {
  const imagePart = { inlineData: { data: base64Image, mimeType } };
  let context: string = language === 'es' ? "Identifica el hongo en la siguiente imagen" : "Identify the mushroom in the following image";
  if (location) {
      context += language === 'es' 
          ? ` y considera que fue encontrado cerca de la latitud ${location.latitude} y longitud ${location.longitude}.`
          : ` and consider it was found near latitude ${location.latitude} and longitude ${location.longitude}.`;
  }
  const textPart = { text: context };
  const { mushroomInfo, sources } = await getMushroomInfo([imagePart, textPart], true, language, difficulty);
  const { data: mapaDistribucionSrc, isQuotaError } = await generateDistributionMap(mushroomInfo, language, imageQuality);
  
  if (isQuotaError) {
      // Don't block the user, just proceed without the map.
      console.warn("Map generation failed due to quota. Proceeding without it.");
      return { mushroomInfo, sources, mapaDistribucionSrc: null, mapGenerationFailed: true };
  }

  return { mushroomInfo, sources, mapaDistribucionSrc, mapGenerationFailed: mapaDistribucionSrc === null };
};

export const identifyMushroomFromText = async (
  mushroomName: string,
  language: 'es' | 'en',
  difficulty: DifficultyLevel,
  imageQuality: ImageQuality
): Promise<{ mushroomInfo: MushroomInfo; sources: GroundingSource[]; imageSrc: string | null; mapaDistribucionSrc: string | null; mainImageGenerationFailed: boolean; mapGenerationFailed: boolean; }> => {
    const context = language === 'es' ? `Busca información sobre el hongo llamado "${mushroomName}"` : `Find information about the mushroom named "${mushroomName}"`;
    const textPart = { text: context };
    const { mushroomInfo, sources } = await getMushroomInfo([textPart], false, language, difficulty);

    const { data: imageSrc, isQuotaError: mainImageQuotaError } = await generateMushroomImage(mushroomInfo, language, imageQuality);
    const { data: mapaDistribucionSrc, isQuotaError: mapQuotaError } = await generateDistributionMap(mushroomInfo, language, imageQuality);
    
    // Gracefully handle quota errors instead of throwing.
    // The UI will show placeholders for failed images.
    if (mainImageQuotaError || mapQuotaError) {
        console.warn("Image generation failed due to quota. Proceeding with text-only results.");
    }

    return { 
        mushroomInfo, 
        sources, 
        imageSrc, 
        mapaDistribucionSrc, 
        mainImageGenerationFailed: imageSrc === null,
        mapGenerationFailed: mapaDistribucionSrc === null,
    };
};


export const compareMushrooms = async (
    mushroomA: MushroomInfo,
    mushroomB: MushroomInfo,
    language: 'es' | 'en'
): Promise<ComparisonInfo> => {
    try {
        const ai = getAiClient();

        const textPart = { text: getCompareMushroomPrompt(mushroomA, mushroomB, language) };

        // Fallback for Comparison logic as well
        try {
             // Attempt 1: Pro
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { parts: [textPart] },
                config: { responseMimeType: 'application/json' },
            });
             const data = getJsonFromResponse(response.text);
            if (!data) throw new Error("INVALID_RESPONSE");
            if (data.error) throw new Error("IDENTIFY_FAILED");
            
            const sanitizedData = sanitizeComparisonInfo(data);
            if (!sanitizedData) throw new Error("INVALID_RESPONSE");
            return sanitizedData;
        } catch (error) {
             if (isQuotaError(error)) {
                console.warn("Gemini 3 Pro quota exceeded during comparison. Falling back to Flash.");
                // Attempt 2: Flash
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [textPart] },
                    config: { responseMimeType: 'application/json' },
                });
                const data = getJsonFromResponse(response.text);
                if (!data) throw new Error("INVALID_RESPONSE");
                if (data.error) throw new Error("IDENTIFY_FAILED");
                
                const sanitizedData = sanitizeComparisonInfo(data);
                if (!sanitizedData) throw new Error("INVALID_RESPONSE");
                return sanitizedData;
             }
             throw error;
        }

    } catch (error) {
        handleApiError(error);
        throw new Error("UNEXPECTED_ERROR");
    }
};