
import React from 'react';
// FIX: Use HistoryEntry and ToxicityInfo types which exist in the project.
import type { HistoryEntry, ToxicityInfo } from '../types';

interface ResultDisplayProps {
  // FIX: Use HistoryEntry instead of the non-existent IdentificationResult.
  result: HistoryEntry;
}

const getEdibilityClass = (edibility: ToxicityInfo['nivelToxicidad']) => {
  // FIX: Use a switch statement for clarity and to handle all edibility levels correctly.
  switch (edibility) {
    case 'Poisonous':
    case 'Lethal':
      return 'bg-red-100 text-red-800 border-red-500';
    case 'Edible':
      return 'bg-green-100 text-green-800 border-green-500';
    case 'Caution':
      return 'bg-yellow-100 text-yellow-800 border-yellow-500';
    case 'Inedible':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-500';
  }
};

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result }) => {
  // FIX: Destructure mushroomInfo and sources from result, and alias them to match the old structure.
  const { mushroomInfo: identification, sources: citations } = result;

  // Add a guard clause in case mushroomInfo is not available.
  if (!identification) {
    return null;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="border rounded-lg p-4 bg-white shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase">Nombre</h3>
        {/* FIX: Use property from mushroomInfo */}
        <p className="text-2xl font-bold text-emerald-900">{identification.nombreComun}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* FIX: Use property from mushroomInfo and pass to updated getEdibilityClass */}
        <div className={`border-l-4 p-4 rounded-r-lg ${getEdibilityClass(identification.toxicidad.nivelToxicidad)}`}>
          <h3 className="text-sm font-semibold uppercase opacity-80">Comestibilidad</h3>
          <p className="text-xl font-bold">{identification.toxicidad.nivelToxicidad}</p>
        </div>
        <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded-r-lg">
          <h3 className="text-sm font-semibold uppercase text-blue-800 opacity-80">Confianza de la IA</h3>
          {/* FIX: Confidence is not available in the current data structure. */}
          <p className="text-xl font-bold text-blue-900">N/A</p>
        </div>
      </div>
      
      <div className="border rounded-lg p-4 bg-white shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Descripción</h3>
        {/* FIX: Use property from mushroomInfo */}
        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{identification.descripcionGeneral}</p>
      </div>

      <div className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-lg">
        <h3 className="text-sm font-bold uppercase text-red-800 mb-2">Advertencia Importante</h3>
        {/* FIX: Use property from mushroomInfo */}
        <p className="text-red-900 font-medium">{identification.toxicidad.descripcion}</p>
      </div>

      {citations && citations.length > 0 && (
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Fuentes (Búsqueda de Google)</h3>
          <ul className="space-y-2">
            {citations.map((citation, index) => (
              <li key={index} className="flex items-start">
                <span className="text-emerald-600 mr-2">✓</span>
                <a 
                  // FIX: Use properties from GroundingSource type.
                  href={citation.uri} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-600 hover:underline break-all"
                >
                  {citation.title || citation.uri}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ResultDisplay;
