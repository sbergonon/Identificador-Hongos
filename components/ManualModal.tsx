import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface ManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ManualContentEs: React.FC = () => (
  <>
    <h1 className="text-4xl font-extrabold text-green-800 dark:text-emerald-200 mb-4">Identificador de Hongos IA</h1>
    <p className="text-lg leading-relaxed mb-6">Esta aplicación es una herramienta moderna diseñada para entusiastas de la micología. Utiliza el poder de la IA de Gemini de Google para identificar hongos a partir de fotos, proporcionando información sobre su comestibilidad, hábitat y posibles confusiones peligrosas.</p>
    
    <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200 mt-8 mb-4 border-b border-gray-300 dark:border-slate-700 pb-2">Características Principales</h2>
    <ul className="list-disc list-inside space-y-3 mb-6 text-lg">
      <li><strong className="font-semibold">Identificación por Imagen y Texto</strong>: Identifica hongos al instante tomando una foto, subiendo una imagen o buscando por su nombre. La app considera la geolocalización para mejorar la precisión.</li>
      <li><strong className="font-semibold">Perfiles Detallados de Hongos</strong>: Obtén información completa para cada hongo, incluyendo:
        <ul className="list-['-_'] list-inside space-y-2 mt-2 pl-6">
          <li><strong>Datos Micológicos</strong>: Nombre científico, sinónimos, descripción morfológica, hábitat y temporada de aparición.</li>
          <li><strong>Comestibilidad y Toxicidad</strong>: Una evaluación clara del nivel de comestibilidad, síntomas en caso de intoxicación y primeros auxilios.</li>
          <li><strong>Usos Culinarios y Recetas</strong>: Para las especies comestibles, se ofrecen sugerencias de uso y recetas.</li>
          <li><strong>Seguridad Crítica</strong>: Comparaciones claras con hongos de apariencia similar, destacando las diferencias clave para evitar confusiones peligrosas.</li>
          <li><strong>Mapa de Distribución</strong>: Un mapa generado por IA que muestra las regiones donde se encuentra el hongo.</li>
        </ul>
      </li>
      <li><strong className="font-semibold">Comparador de Hongos</strong>: Una herramienta para analizar dos especies una al lado de la otra, contrastando su apariencia, hábitat y, lo más importante, su toxicidad.</li>
      <li><strong className="font-semibold">Colección Personal</strong>: Guarda tus hallazgos en una colección personal, que puedes filtrar, ordenar y exportar.</li>
      <li><strong className="font-semibold">Interfaz Bilingüe</strong>: Totalmente disponible en español e inglés.</li>
    </ul>

    <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200 mt-8 mb-4 border-b border-gray-300 dark:border-slate-700 pb-2">Cómo Usar</h2>
    <ol className="list-decimal list-inside space-y-3 mb-6 text-lg">
      <li><strong className="font-semibold">Proporciona la Entrada</strong>: Toma una foto, sube una imagen o escribe el nombre del hongo que deseas identificar.</li>
       <div className="mt-4 p-4 bg-green-50 dark:bg-emerald-900/40 border border-green-200 dark:border-emerald-800 rounded-lg text-base">
          <h4 className="font-semibold text-lg text-green-800 dark:text-emerald-300 mb-2">Consejos para la Mejor Foto de Identificación</h4>
          <ul className="list-disc list-inside space-y-1">
              <li><strong>Muestra todas las partes:</strong> Intenta que en la foto se vea el sombrero (por arriba y por abajo para ver las láminas o poros), el pie y la base.</li>
              <li><strong>Buena iluminación, sin sombras:</strong> La luz natural y difusa es ideal.</li>
              <li><strong>Fondo simple:</strong> Aísla el hongo de otros para evitar confusiones.</li>
              <li><strong>Enfoque perfecto:</strong> Una foto borrosa no servirá. Toca la pantalla de tu móvil para enfocar.</li>
          </ul>
      </div>
      <li><strong className="font-semibold">Analizar</strong>: La IA procesará tu solicitud y devolverá una ficha de información detallada.</li>
      <li><strong className="font-semibold">Explora y Verifica</strong>: Revisa cuidadosamente la información, especialmente la sección de toxicidad y los posibles parecidos con especies venenosas.</li>
      <li><strong className="font-semibold">Guarda y Compara</strong>: Guarda el hongo en tu colección o usa la herramienta de Comparar para analizarlo frente a otro.</li>
    </ol>
    
    <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200 mt-8 mb-4 border-b border-gray-300 dark:border-slate-700 pb-2">Descargo de Responsabilidad (¡MUY IMPORTANTE!)</h2>
    <div className="p-4 bg-red-100 dark:bg-red-900/40 border-l-4 border-red-500 dark:border-red-600 text-red-800 dark:text-red-300 rounded-r-lg">
        <p className="font-bold">Esta aplicación es únicamente para fines educativos e informativos. La identificación de hongos silvestres es extremadamente difícil y peligrosa. Un error puede ser mortal.</p>
        <p className="mt-2"><strong>NUNCA</strong> consumas un hongo basándote únicamente en la identificación de esta o cualquier otra aplicación. Consulta siempre a un experto micólogo cualificado y contrasta con varias guías de campo fiables. La identificación basada en IA puede no ser 100% precisa.</p>
    </div>
  </>
);

const ManualContentEn: React.FC = () => (
    <>
        <h1 className="text-4xl font-extrabold text-green-800 dark:text-emerald-200 mb-4">AI Mushroom Identifier</h1>
        <p className="text-lg leading-relaxed mb-6">This application is a modern tool designed for mycology enthusiasts. It uses the power of Google's Gemini AI to identify mushrooms from photos, providing information on their edibility, habitat, and dangerous lookalikes.</p>
        
        <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200 mt-8 mb-4 border-b border-gray-300 dark:border-slate-700 pb-2">Key Features</h2>
        <ul className="list-disc list-inside space-y-3 mb-6 text-lg">
            <li><strong className="font-semibold">Image and Text Identification</strong>: Instantly identify mushrooms by taking a photo, uploading an image, or searching by name. The app considers geolocation to improve accuracy.</li>
            <li><strong className="font-semibold">Detailed Mushroom Profiles</strong>: Get comprehensive information for each mushroom, including:
                <ul className="list-['-_'] list-inside space-y-2 mt-2 pl-6">
                    <li><strong>Mycological Data</strong>: Scientific name, synonyms, morphological description, habitat, and season.</li>
                    <li><strong>Edibility and Toxicity</strong>: A clear assessment of the edibility level, symptoms in case of poisoning, and first aid.</li>
                    <li><strong>Culinary Uses and Recipes</strong>: For edible species, usage suggestions and recipes are provided.</li>
                    <li><strong>Critical Safety</strong>: Clear comparisons with similar-looking mushrooms, highlighting key differences to avoid dangerous confusion.</li>
                    <li><strong>Distribution Map</strong>: An AI-generated map showing the regions where the mushroom is found.</li>
                </ul>
            </li>
            <li><strong className="font-semibold">Mushroom Comparator</strong>: A tool to analyze two species side-by-side, contrasting their appearance, habitat, and, most importantly, their toxicity.</li>
            <li><strong className="font-semibold">Personal Collection</strong>: Save your findings to a personal collection, which you can filter, sort, and export.</li>
            <li><strong className="font-semibold">Bilingual Interface</strong>: Fully available in Spanish and English.</li>
        </ul>

        <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200 mt-8 mb-4 border-b border-gray-300 dark:border-slate-700 pb-2">How to Use</h2>
        <ol className="list-decimal list-inside space-y-3 mb-6 text-lg">
            <li><strong className="font-semibold">Provide Input</strong>: Take a photo, upload an image, or type the name of the mushroom you want to identify.</li>
             <div className="mt-4 p-4 bg-green-50 dark:bg-emerald-900/40 border border-green-200 dark:border-emerald-800 rounded-lg text-base">
                <h4 className="font-semibold text-lg text-green-800 dark:text-emerald-300 mb-2">Tips for the Best Identification Photo</h4>
                <ul className="list-disc list-inside space-y-1">
                    <li><strong>Show all parts:</strong> Try to capture the cap (top and bottom to see gills or pores), the stem, and the base in the photo.</li>
                    <li><strong>Good lighting, no shadows:</strong> Natural, diffused light is ideal.</li>
                    <li><strong>Simple background:</strong> Isolate the mushroom from others to avoid confusion.</li>
                    <li><strong>Perfect focus:</strong> A blurry photo won't work. Tap your phone's screen to focus.</li>
                </ul>
            </div>
            <li><strong className="font-semibold">Analyze</strong>: The AI will process your request and return a detailed information card.</li>
            <li><strong className="font-semibold">Explore and Verify</strong>: Carefully review the information, especially the toxicity section and potential lookalikes.</li>
            <li><strong className="font-semibold">Save &amp; Compare</strong>: Save the mushroom to your collection or use the Compare tool to analyze it against another one.</li>
        </ol>
        
        <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200 mt-8 mb-4 border-b border-gray-300 dark:border-slate-700 pb-2">Disclaimer (VERY IMPORTANT!)</h2>
        <div className="p-4 bg-red-100 dark:bg-red-900/40 border-l-4 border-red-500 dark:border-red-600 text-red-800 dark:text-red-300 rounded-r-lg">
            <p className="font-bold">This application is for educational and informational purposes only. Wild mushroom identification is extremely difficult and dangerous. A mistake can be fatal.</p>
            <p className="mt-2"><strong>NEVER</strong> consume a mushroom based solely on the identification from this or any other app. Always consult a qualified expert mycologist and cross-reference with several reliable field guides. AI-based identification may not be 100% accurate.</p>
        </div>
    </>
);


export const ManualModal: React.FC<ManualModalProps> = ({ isOpen, onClose }) => {
    const { language, t } = useLanguage();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-2xl font-bold text-green-900 dark:text-emerald-200">{t('appManual')}</h2>
                    <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="overflow-y-auto p-4 sm:p-8 text-slate-800 dark:text-slate-200 font-sans">
                    {language === 'es' ? <ManualContentEs /> : <ManualContentEn />}
                </div>
            </div>
        </div>
    );
};
