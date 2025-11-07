export interface ToxicityInfo {
  descripcion: string;
  nivelToxicidad: 'Edible' | 'Inedible' | 'Caution' | 'Poisonous' | 'Lethal';
  compuestosToxicos: string[];
  sintomas: string;
  primerosAuxilios: string;
}

export interface Recipe {
  nombre: string;
  ingredientes: string[];
  instrucciones: string;
}

export interface SimilarMushroom {
  nombreComun: string;
  nombreCientifico: string;
  diferenciaClave: string;
  esToxico: boolean;
}

export interface MushroomInfo {
  nombreComun: string;
  nombreCientifico: string;
  sinonimos: string[];
  descripcionGeneral: string;
  habitat: string;
  temporada: string;
  distribucionGeografica: string;
  usosCulinarios: string[];
  toxicidad: ToxicityInfo;
  recetas: Recipe[];
  hongosSimilares: SimilarMushroom[];
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  imageSrc: string;
  type: 'mushroom';
  mushroomInfo: MushroomInfo;
  sources: GroundingSource[];
  mapaDistribucionSrc?: string;
  imageGenerationFailed?: boolean;
}

export interface ComparisonInfo {
  resumenComparativo: string;
  usosCulinarios: {
    similitudes: string[];
    diferencias: string[];
  };
  toxicidad: {
    comparacion: string;
    nivelHongoA: ToxicityInfo['nivelToxicidad'];
    nivelHongoB: ToxicityInfo['nivelToxicidad'];
  };
  diferenciasMorfologicas: {
    habitat: string;
    apariencia: string;
  };
}
