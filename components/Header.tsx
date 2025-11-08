
import React from 'react';
import { MushroomIcon } from './icons/MushroomIcon.tsx';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex items-center justify-center">
        <MushroomIcon className="h-10 w-10 text-emerald-600 mr-3" />
        <h1 className="text-3xl font-bold text-emerald-800">
          Identificador de Hongos IA
        </h1>
      </div>
    </header>
  );
};

export default Header;