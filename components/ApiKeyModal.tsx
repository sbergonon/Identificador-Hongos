import React from 'react';

// FIX: This component is deprecated as API keys are now managed via environment variables.
// It is stubbed out to resolve the import error for `useApiKey` which no longer exists.
interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  React.useEffect(() => {
    if (isOpen) {
      console.warn(
        'ApiKeyModal is deprecated and should not be used. API key is set via environment variables.'
      );
      // Automatically close if opened to prevent user interaction
      onClose();
    }
  }, [isOpen, onClose]);

  return null;
};
