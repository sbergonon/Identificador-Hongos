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
        console.error(`Failed to load image from src: ${src.substring(0, 100)}...`);
        // Fallback to a placeholder image to avoid showing a broken image link in the UI.
        resolve(createPlaceholderImage('Image Failed to Load'));
    };
    
    // If the src is already a data URL, it should load directly without network requests.
    // If it's a URL, this will trigger a network request.
    img.src = src;
  });
};