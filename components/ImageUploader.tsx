
import React, { useState, useRef, useCallback } from 'react';
import { UploadIcon } from './icons/UploadIcon.tsx';

interface ImageUploaderProps {
  onImageUpload: (imageData: string | null) => void;
  isProcessing: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, isProcessing }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreviewUrl(result);
      onImageUpload(result);
    };
    reader.readAsDataURL(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };
  
  const handleRemoveImage = () => {
    setPreviewUrl(null);
    onImageUpload(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
        disabled={isProcessing}
      />
      
      {previewUrl ? (
        <div className="relative group w-full aspect-video rounded-lg overflow-hidden border-2 border-dashed border-gray-300">
            <img src={previewUrl} alt="Vista previa" className="w-full h-full object-contain" />
            {!isProcessing && (
                 <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center">
                    <button 
                        onClick={handleRemoveImage} 
                        className="px-4 py-2 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Cambiar Imagen
                    </button>
                 </div>
            )}
        </div>
      ) : (
        <div
            onClick={handleClick}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`cursor-pointer w-full aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 ${isDragging ? 'border-emerald-500 bg-emerald-100 scale-105' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
        >
            <UploadIcon className="h-12 w-12 text-gray-400 mb-2" />
            <p className="text-gray-600 font-semibold">Arrastra una imagen o haz clic para seleccionar</p>
            <p className="text-sm text-gray-500">JPG, PNG, WEBP</p>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;