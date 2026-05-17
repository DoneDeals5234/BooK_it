import { useState } from 'react';
import toast from 'react-hot-toast';

export const useAIImage = () => {
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [isGeneratingAIImage, setIsGeneratingAIImage] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);

  const enhanceImage = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Apply enhancement filters for "Crystal Clear" look using GPU acceleration
        ctx.filter = 'contrast(1.1) brightness(1.02) saturate(1.05)';
        ctx.drawImage(img, 0, 0);

        // Professional sharpening trick: Draw the image again slightly offset with low opacity
        ctx.globalAlpha = 0.1;
        ctx.drawImage(img, -0.5, -0.5);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';

        resolve(canvas.toDataURL('image/png', 0.98));
      };
      img.src = dataUrl;
    });
  };

  const processRemoveBackground = async (base64Image: string): Promise<string | null> => {
    if (!base64Image) return null;
    setIsRemovingBackground(true);
    setAiProgress(0);
    const toastId = toast.loading('Initializing AI Model...');
    try {
      const imglyModule = await import('@imgly/background-removal');
      const removeBg = imglyModule.removeBackground || imglyModule.default;
      
      const config = {
        publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/',
        model: 'small',
        output: { format: 'image/png', quality: 0.95 },
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const percentage = Math.round((current / total) * 100);
            if (percentage % 5 === 0 || percentage === 100) {
              setAiProgress(percentage);
            }
          }
        }
      };

      let blob: Blob;
      if (base64Image.startsWith('data:')) {
        const base64Data = base64Image.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        blob = new Blob([new Uint8Array(byteNumbers)], { type: base64Image.match(/data:([^;]+);/)?.[1] || 'image/jpeg' });
      } else {
        const response = await fetch(base64Image);
        blob = await response.blob();
      }

      const resultBlob = await removeBg(blob, config as any);
      const resultDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(resultBlob);
      });

      return await enhanceImage(resultDataUrl);
    } catch (error) {
      console.error('Error removing background:', error);
      toast.error('Failed to remove background');
      return null;
    } finally {
      setIsRemovingBackground(false);
      setAiProgress(0);
      toast.dismiss(toastId);
    }
  };

  const generateAIImage = async (title: string): Promise<string | null> => {
    if (!title) {
      toast.error('Please enter a title first');
      return null;
    }
    setIsGeneratingAIImage(true);
    setAiProgress(10);
    try {
      const prompt = encodeURIComponent(`${title} professional product photo studio lighting clean white background`.trim());
      const seed = Math.floor(Math.random() * 1000000);
      const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true&seed=${seed}`;
      
      return new Promise<string | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const timeoutId = setTimeout(() => { 
          setIsGeneratingAIImage(false); 
          setAiProgress(0);
          resolve(null); 
        }, 30000);

        img.onload = () => {
          clearTimeout(timeoutId);
          setAiProgress(80);
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 1024;
          canvas.height = img.naturalHeight || 1024;
          canvas.getContext('2d')?.drawImage(img, 0, 0);
          setAiProgress(100);
          setTimeout(() => {
            setIsGeneratingAIImage(false);
            setAiProgress(0);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          }, 500);
        };
        img.onerror = () => { 
          setIsGeneratingAIImage(false); 
          setAiProgress(0);
          resolve(null); 
        };
        img.src = imageUrl;
      });
    } catch (error) {
      setIsGeneratingAIImage(false);
      setAiProgress(0);
      return null;
    }
  };

  return {
    isRemovingBackground,
    isGeneratingAIImage,
    aiProgress,
    processRemoveBackground,
    generateAIImage,
    enhanceImage
  };
};
