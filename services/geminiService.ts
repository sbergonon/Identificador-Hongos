
import { GoogleGenAI, GroundingChunk } from "@google/genai";
import { MushroomInfo, GroundingSource, Recipe, SimilarMushroom, ComparisonInfo, ToxicityInfo } from '../types';

const getAiClient = (apiKey: string): GoogleGenAI => {
  if (!apiKey) {
    throw new Error("No API key was provided to initialize the AI client.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- PROMPTS ---

const getMushroomJsonPrompt = (context: string, language: 'es' | 'en') => {
  const isEs = language === 'es';
  return isEs ? 
  `Eres una experta micóloga y bióloga. ${context}. Después de identificarlo, proporciona la siguiente información en un objeto JSON con las claves EXACTAS: "nombreComun", "nombreCientifico", "sinonimos", "descripcionGeneral", "habitat", "temporada", "distribucionGeografica", "usosCulinarios", "toxicidad", "recetas", y "hongosSimilares".

- Para "descripcionGeneral", incluye detalles morfológicos clave (sombrero, láminas, pie, esporas).
- Para "habitat", describe dónde crece (tipo de bosque, suelo, árboles específicos).
- Para "temporada", indica la estación o meses en que aparece.
- Para "toxicidad", proporciona un objeto con las claves "descripcion" (explicando la comestibilidad), "nivelToxicidad" (uno de: 'Edible', 'Inedible', 'Caution', 'Poisonous', 'Lethal'), "compuestosToxicos" (lista de strings), "sintomas" (descripción de los síntomas de intoxicación), y "primerosAuxilios".
- Para "recetas", si es comestible, genera una lista de 1-2 recetas. Cada receta es un objeto con "nombre", "ingredientes", "instrucciones". Si no es comestible, devuelve [].
- Para "hongosSimilares", proporciona una lista de 1 a 3 hongos con los que se confunde comúnmente. Para cada uno, incluye "nombreComun", "nombreCientifico", "diferenciaClave" y un booleano "esToxico". Esta sección es CRÍTICA para la seguridad.

Si no puedes identificar el hongo, responde con un JSON: {"error": "No se pudo identificar el hongo."}.
La respuesta DEBE ser únicamente el objeto JSON. No omitas ninguna clave. Para listas vacías, usa [].`
  : 
  `You are an expert mycologist and biologist. ${context}. After identifying it, provide the following information in a JSON object with the EXACT keys: "nombreComun", "nombreCientifico", "sinonimos", "descripcionGeneral", "habitat", "temporada", "distribucionGeografica", "usosCulinarios", "toxicidad", "recetas", and "hongosSimilares".

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
            try { return JSON.parse(match[1]); } catch (parseError) { throw new Error("Model response contained malformed JSON inside a code block."); }
        }
        throw new Error("Model response is not valid JSON. Please try again.");
    }
};

const handleApiError = (error: unknown) => {
    console.error("API call error:", error);
    if (error instanceof Error) {
        if (error.message.includes('429') || error.message.toLowerCase().includes('resource has been exhausted')) {
            throw new Error("The free query limit has been reached. Please enter your own API key to continue.");
        }
        throw error;
    }
    throw new Error("Could not get a response from the model. Please check your query or try again later.");
};


// --- SANITIZER FUNCTIONS ---
function sanitizeMushroomInfo(data: any): MushroomInfo | null {
    if (!data || typeof data !== 'object' || data.error) return null;

    const toxData = data.toxicidad && typeof data.toxicidad === 'object' ? data.toxicidad : {};
    const sanitizedToxicity: ToxicityInfo = {
        descripcion: String(toxData.descripcion || 'No information available.'),
        nivelToxicidad: ['Edible', 'Inedible', 'Caution', 'Poisonous', 'Lethal'].includes(toxData.nivelToxicidad) ? toxData.nivelToxicidad : 'Caution',
        compuestosToxicos: Array.isArray(toxData.compuestosToxicos) ? toxData.compuestosToxicos.filter((c: any) => typeof c === 'string') : [],
        sintomas: (() => {
            const symptoms = toxData.sintomas;
            if (!symptoms) return 'Symptoms not specified.';
            if (typeof symptoms === 'string') return symptoms;
            if (typeof symptoms === 'object' && !Array.isArray(symptoms)) {
                return Object.entries(symptoms)
                    .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
                    .join('\n');
            }
            return String(symptoms);
        })(),
        primerosAuxilios: String(toxData.primerosAuxilios || 'In case of ingestion, seek immediate medical attention.'),
    };

    const sanitized: MushroomInfo = {
        nombreComun: String(data.nombreComun || 'Name not available'),
        nombreCientifico: String(data.nombreCientifico || 'Scientific name not available'),
        sinonimos: Array.isArray(data.sinonimos) ? data.sinonimos.filter((s: any) => typeof s === 'string') : [],
        descripcionGeneral: String(data.descripcionGeneral || 'No description available.'),
        habitat: String(data.habitat || 'Habitat not available.'),
        temporada: String(data.temporada || 'Season not available.'),
        distribucionGeografica: String(data.distribucionGeografica || 'Geographic distribution not available.'),
        usosCulinarios: Array.isArray(data.usosCulinarios) ? data.usosCulinarios.filter((u: any) => typeof u === 'string') : [],
        toxicidad: sanitizedToxicity,
        recetas: Array.isArray(data.recetas) ? data.recetas.map((r: any): Recipe | null => {
            if (!r || typeof r !== 'object') return null;
            return {
                nombre: String(r.nombre || 'Unnamed Recipe'),
                ingredientes: Array.isArray(r.ingredientes) ? r.ingredientes.filter((i: any) => typeof i === 'string') : [],
                instrucciones: String(r.instrucciones || 'No instructions.'),
            };
        }).filter((r): r is Recipe => r !== null) : [],
        hongosSimilares: Array.isArray(data.hongosSimilares) ? data.hongosSimilares.map((h: any): SimilarMushroom | null => {
            if (!h || typeof h !== 'object' || !h.nombreComun || !h.diferenciaClave) return null;
            return {
                nombreComun: String(h.nombreComun),
                nombreCientifico: String(h.nombreCientifico || 'N/A'),
                diferenciaClave: String(h.diferenciaClave),
                esToxico: typeof h.esToxico === 'boolean' ? h.esToxico : true,
            };
        }).filter((h): h is SimilarMushroom => h !== null) : [],
    };

    if (sanitized.nombreComun === 'Name not available') return null;
    return sanitized;
}

function sanitizeComparisonInfo(data: any): ComparisonInfo | null {
    if (!data || typeof data !== 'object') return null;
    const getString = (val: any, defaultVal = 'N/A'): string => String(val || defaultVal);
    const getStringArray = (val: any): string[] => Array.isArray(val) ? val.filter(item => typeof item === 'string') : [];
    const getToxicityLevel = (val: any): ToxicityInfo['nivelToxicidad'] => {
        const levels: ToxicityInfo['nivelToxicidad'][] = ['Edible', 'Inedible', 'Caution', 'Poisonous', 'Lethal'];
        return levels.includes(val) ? val : 'Caution';
    };

    return {
        resumenComparativo: getString(data.resumenComparativo),
        usosCulinarios: { similitudes: getStringArray(data.usosCulinarios?.similitudes), diferencias: getStringArray(data.usosCulinarios?.diferencias) },
        toxicidad: { 
            comparacion: getString(data.toxicidad?.comparacion), 
            nivelHongoA: getToxicityLevel(data.toxicidad?.nivelHongoA), 
            nivelHongoB: getToxicityLevel(data.toxicidad?.nivelHongoB) 
        },
        diferenciasMorfologicas: { habitat: getString(data.diferenciasMorfologicas?.habitat), apariencia: getString(data.diferenciasMorfologicas?.apariencia) },
    };
}


// --- CORE API FUNCTIONS ---

const getMushroomInfo = async (apiKey: string, parts: any[], useGrounding: boolean, language: 'es' | 'en'): Promise<{ mushroomInfo: MushroomInfo; sources: GroundingSource[] }> => {
  try {
    const ai = getAiClient(apiKey);
    const textPart = { text: getMushroomJsonPrompt(parts.find(p => p.text).text, language) };
    const imagePart = parts.find(p => p.inlineData);
    const finalParts = imagePart ? [imagePart, textPart] : [textPart];

    const config: any = {};
    if (useGrounding) {
      config.tools = [{ googleSearch: {} }];
    } else {
     config.responseMimeType = 'application/json';
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: finalParts },
      config: config,
    });
    
    const data = getJsonFromResponse(response.text);
    if (!data) throw new Error("Could not extract structured information from the model's response.");
    if (data.error) throw new Error(data.error);

    const sanitizedData = sanitizeMushroomInfo(data);
    if (!sanitizedData) {
        throw new Error("The model's response was not in the expected format. The mushroom may not have been recognized.");
    }
    
    const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: GroundingChunk) => ({
            uri: chunk.web?.uri || '',
            title: chunk.web?.title || 'Untitled Source'
        })).filter(source => source.uri) || [];

    return { mushroomInfo: sanitizedData, sources };
  } catch (error) {
    handleApiError(error);
    throw new Error("Unhandled API error in getMushroomInfo");
  }
};

async function generateDistributionMap(apiKey: string, mushroomInfo: MushroomInfo, language: 'es' | 'en'): Promise<string | null> {
    if (!mushroomInfo.distribucionGeografica || mushroomInfo.distribucionGeografica.includes('no disponible') || mushroomInfo.distribucionGeografica.includes('not available')) return null;
    try {
        const ai = getAiClient(apiKey);
        const prompt_text = language === 'es' 
            ? `Tarea: Generar un mapa de distribución geográfica. Sujeto: El hongo *${mushroomInfo.nombreCientifico}*. Datos de origen para la distribución: "${mushroomInfo.distribucionGeografica}". Requisitos: Estilo de mapa de atlas, limpio y profesional. Resalta claramente las regiones geográficas mencionadas en los datos de origen. Incluye etiquetas para continentes y océanos. El mapa debe ser visualmente claro y priorizar la precisión informativa sobre el estilo artístico.`
            : `Task: Generate a geographic distribution map. Subject: The mushroom *${mushroomInfo.nombreCientifico}*. Source data for distribution: "${mushroomInfo.distribucionGeografica}". Requirements: Clean, professional atlas map style. Clearly highlight the geographic regions mentioned in the source data. Include labels for continents and oceans. The map must be visually clear and prioritize informational accuracy over artistic style.`;

        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt_text,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '16:9',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        return null;
    } catch (error) {
        console.error("Error generating distribution map:", error);
        return null;
    }
}

async function generateMushroomImage(apiKey: string, mushroomInfo: MushroomInfo, language: 'es' | 'en'): Promise<string | null> {
    try {
        const ai = getAiClient(apiKey);
        const prompt_text = language === 'es'
            ? `Una fotografía de estudio, fotorrealista y micológicamente precisa del hongo *${mushroomInfo.nombreCientifico}* (${mushroomInfo.nombreComun}). La imagen debe ser de alta calidad, mostrando los detalles morfológicos correctos de la especie, sobre un fondo blanco neutro.`
            : `A photorealistic, mycologically accurate, studio photograph of the mushroom *${mushroomInfo.nombreCientifico}* (${mushroomInfo.nombreComun}). The image must be high-quality, showing the correct morphological details of the species, on a neutral white background.`;

        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt_text,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
            },
        });
        
        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        return null;
    } catch (error) {
        console.error("Graceful Error: Could not generate mushroom image. Falling back to placeholder.", error);
        return null;
    }
}


export const identifyMushroomFromImage = async (
  apiKey: string,
  base64Image: string,
  mimeType: string,
  location: { latitude: number; longitude: number } | null,
  language: 'es' | 'en'
): Promise<{ mushroomInfo: MushroomInfo; sources: GroundingSource[], mapaDistribucionSrc: string | null }> => {
  const imagePart = { inlineData: { data: base64Image, mimeType } };
  let context: string = language === 'es' ? "Identifica el hongo en la siguiente imagen" : "Identify the mushroom in the following image";
  if (location) {
      context += language === 'es' 
          ? ` y considera que fue encontrado cerca de la latitud ${location.latitude} y longitud ${location.longitude}.`
          : ` and consider it was found near latitude ${location.latitude} and longitude ${location.longitude}.`;
  }
  const textPart = { text: context };
  const { mushroomInfo, sources } = await getMushroomInfo(apiKey, [imagePart, textPart], true, language);
  const mapaDistribucionSrc = await generateDistributionMap(apiKey, mushroomInfo, language);
  return { mushroomInfo, sources, mapaDistribucionSrc };
};

export const identifyMushroomFromText = async (
  apiKey: string,
  mushroomName: string,
  language: 'es' | 'en'
): Promise<{ mushroomInfo: MushroomInfo; sources: GroundingSource[]; imageSrc: string | null; mapaDistribucionSrc: string | null; imageGenerationFailed: boolean }> => {
    const context = language === 'es' ? `Busca información sobre el hongo llamado "${mushroomName}"` : `Find information about the mushroom named "${mushroomName}"`;
    const textPart = { text: context };
    const { mushroomInfo, sources } = await getMushroomInfo(apiKey, [textPart], false, language);

    const imageSrc = await generateMushroomImage(apiKey, mushroomInfo, language);
    const mapaDistribucionSrc = await generateDistributionMap(apiKey, mushroomInfo, language);
    const imageGenerationFailed = imageSrc === null;

    return { mushroomInfo, sources, imageSrc, mapaDistribucionSrc, imageGenerationFailed };
};


export const compareMushrooms = async (
    apiKey: string,
    mushroomA: MushroomInfo,
    mushroomB: MushroomInfo,
    language: 'es' | 'en'
): Promise<ComparisonInfo> => {
    try {
        const ai = getAiClient(apiKey);
        const textPart = { text: getCompareMushroomPrompt(mushroomA, mushroomB, language) };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart] },
            config: { responseMimeType: 'application/json' },
        });

        const data = getJsonFromResponse(response.text);
        if (!data) throw new Error("The model's response for the comparison is empty.");
        if (data.error) throw new Error(data.error);
        
        const sanitizedData = sanitizeComparisonInfo(data);
        if (!sanitizedData) {
            throw new Error("Could not process the comparison from the model.");
        }
        return sanitizedData;
    } catch (error) {
        handleApiError(error);
        throw new Error("Unhandled error in mushroom comparison");
    }
};
