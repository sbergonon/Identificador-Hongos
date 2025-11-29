/**
 * Helper function to create a placeholder SVG image.
 * This is useful for providing a fallback when an image fails to load.
 * @param text The text to display on the placeholder.
 * @returns A data URL for the generated SVG placeholder image.
 */
export const createPlaceholderImage = (text: string): string => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300" style="background-color:#e2e8f0;">
       <g transform="translate(150, 150) scale(4)">
        <path fill="#94a3b8" d="M20 11.15v-.15a8 8 0 1 0-16 0v.15 M12 12v6 M12 22h0 M10 18h4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/>
      </g>
      <text x="150" y="240" font-family="sans-serif" font-size="18" fill="#475569" text-anchor="middle" dominant-baseline="middle">${text}</text>
    </svg>
  `.trim();
  const base64Svg = btoa(svg.replace(/\n/g, ''));
  return `data:image/svg+xml;base64,${base64Svg}`;
};

/**
 * Generates an aesthetic mushroom icon to use as a fallback when images fail to load
 * or cannot be generated.
 */
export const getFallbackMushroomIcon = (): string => {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="#fffbeb" rx="40" />
    <circle cx="200" cy="200" r="160" fill="#fde68a" opacity="0.3" />
    <path d="M200 110 C110 110 70 180 70 230 H330 C330 180 290 110 200 110 Z" fill="#d97706" />
    <path d="M160 230 V330 C160 350 170 360 200 360 C230 360 240 350 240 330 V230 H160 Z" fill="#b45309" />
    <ellipse cx="150" cy="170" rx="15" ry="10" fill="#fffbeb" opacity="0.5" />
    <ellipse cx="260" cy="150" rx="20" ry="14" fill="#fffbeb" opacity="0.5" />
    <ellipse cx="210" cy="190" rx="10" ry="8" fill="#fffbeb" opacity="0.5" />
    <ellipse cx="110" cy="210" rx="12" ry="9" fill="#fffbeb" opacity="0.5" />
    <ellipse cx="290" cy="200" rx="14" ry="10" fill="#fffbeb" opacity="0.5" />
  </svg>
  `.trim();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

/**
 * Converts an image from any source (URL, blob, data URL) to a clean data URL.
 * This is crucial for bypassing CORS issues when using libraries like html2canvas.
 * @param src The source URL of the image.
 * @returns A Promise that resolves to a data URL (image/png).
 */
export const imageToDataUrl = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!src) {
        // Resolve with an empty string or a default placeholder if needed.
        return resolve('');
    }

    // If the source is an SVG data URL (like our placeholders), loading it into an
    // Image object for canvas conversion can be unreliable. Since data URLs don't
    // have CORS issues, we can pass it through directly. html2canvas can handle it.
    if (src.startsWith('data:image/svg+xml')) {
        return resolve(src);
    }
    
    const img = new Image();
    // This is the key to handling CORS. It tells the browser to fetch the image
    // without sending cookies or other credentials, which is often required for
    // cross-origin resources to be used in a canvas.
    img.crossOrigin = 'anonymous'; 

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Failed to get canvas context.'));
      }
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      try {
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch (e) {
        // This can happen if the canvas is "tainted" by an image that couldn't be loaded with CORS.
        reject(new Error('Failed to convert canvas to data URL due to security restrictions.'));
      }
    };
    
    img.onerror = () => {
        // Cleaned up console.error to avoid logging the [object Object] event.
        console.error(`Failed to load image from src: ${src.substring(0, 50)}...`);
        // Fallback to the mushroom icon to avoid showing a broken image link in the UI.
        resolve(getFallbackMushroomIcon());
    };
    
    // If the src is already a data URL, it should load directly without network requests.
    // If it's a URL, this will trigger a network request.
    img.src = src;
  });
};