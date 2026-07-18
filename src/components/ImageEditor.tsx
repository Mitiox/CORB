import { flushSync } from 'react-dom';
import React, { useLayoutEffect, useState, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import corbLogo from '../assets/images/Logo.png';
import { Menu, X } from 'lucide-react';

type Step = 'upload' | 'crop';

export default function ImageEditor() {

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useLayoutEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    const isDark = !isDarkMode;
    if (!document.startViewTransition) {
      setIsDarkMode(isDark);
      return;
    }
    
    document.startViewTransition(() => {
      flushSync(() => {
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        setIsDarkMode(isDark);
      });
    });
  };

  const [step, setStep] = useState<Step>('upload');
  
  // Inputs
  const [urlInput, setUrlInput] = useState('');
  const [sourceImage, setSourceImage] = useState<string>('');
  const [sourceImageHistory, setSourceImageHistory] = useState<string[]>([]);
  const [sourceMimeType, setSourceMimeType] = useState<string>('image/jpeg');
  
  // Cropping
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  
  // Result
  const [targetWidth, setTargetWidth] = useState(400);
  const [targetHeight, setTargetHeight] = useState(400);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [isTransparent, setIsTransparent] = useState(true);
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');
  const [isCroppingMode, setIsCroppingMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const [pickedColor, setPickedColor] = useState<string>('');
  const [isColorPickerExpanded, setIsColorPickerExpanded] = useState(false);
  const [copiedState, setCopiedState] = useState<{show: boolean, x: number, y: number}>({ show: false, x: 0, y: 0 });
  const [showBgOptions, setShowBgOptions] = useState(false);
  
  // Aspect Ratio & Export
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(undefined);
  const [exportFormat, setExportFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [exportQuality, setExportQuality] = useState<number>(92);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSourceMimeType(file.type);
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setSourceImageHistory([]);
        setSourceImage(reader.result?.toString() || '');
        setStep('crop');
        setIsCroppingMode(false);
        setError('');
      });
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSourceMimeType(file.type);
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setSourceImageHistory([]);
        setSourceImage(reader.result?.toString() || '');
        setStep('crop');
        setIsCroppingMode(false);
        setError('');
      });
      reader.readAsDataURL(file);
    }
  };

  const undoCrop = () => {
    if (sourceImageHistory.length > 0) {
      const previousImage = sourceImageHistory[sourceImageHistory.length - 1];
      setSourceImage(previousImage);
      setSourceImageHistory(prev => prev.slice(0, -1));
    }
  };

  const handleUrlLoad = async () => {
    if (!urlInput) return;
    setIsLoading(true);
    setLoadingMsg('Fetching image...');
    setError('');
    try {
      const res = await fetch('/api/proxy-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load image');
      setSourceImage(data.dataUri);
      
      // Extract mime type from data uri
      const match = data.dataUri.match(/data:([^;]+);/);
      if (match) setSourceMimeType(match[1]);

      setStep('crop');
      setIsCroppingMode(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!crop) {
      setCrop({
        unit: '%',
        x: 10,
        y: 10,
        width: 80,
        height: 80
      });
    }
  };

  const handleImageClickForEyedropper = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isEyedropperActive || !imgRef.current) return;
    const img = imgRef.current;
    
    // We draw to a canvas to read the exact pixel color
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(img, 0, 0);
    
    // Map click coordinates to natural image size
    const rect = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    try {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const hex = "#" + ("000000" + ((pixel[0] << 16) | (pixel[1] << 8) | pixel[2]).toString(16)).slice(-6);
      setPickedColor(hex);
      setIsEyedropperActive(false);
    } catch (err) {
      console.error('Could not read pixel data', err);
    }
  };

  const getCroppedImg = async (image: HTMLImageElement, crop: Crop): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    let actualX, actualY, actualWidth, actualHeight;

    if (crop.unit === '%') {
      actualX = (crop.x / 100) * image.naturalWidth;
      actualY = (crop.y / 100) * image.naturalHeight;
      actualWidth = (crop.width / 100) * image.naturalWidth;
      actualHeight = (crop.height / 100) * image.naturalHeight;
    } else {
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      actualX = crop.x * scaleX;
      actualY = crop.y * scaleY;
      actualWidth = crop.width * scaleX;
      actualHeight = crop.height * scaleY;
    }

    canvas.width = actualWidth;
    canvas.height = actualHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No 2d context');
    }

    ctx.drawImage(
      image,
      actualX,
      actualY,
      actualWidth,
      actualHeight,
      0,
      0,
      actualWidth,
      actualHeight
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    });
  };

  const applyCrop = async () => {
    if (!imgRef.current || !crop || crop.width === 0 || crop.height === 0) {
      setError('Please select a valid crop area.');
      return;
    }
    try {
      const croppedBlob = await getCroppedImg(imgRef.current, crop);
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(croppedBlob);
      });
      const dataUri = await base64Promise;
      setSourceImageHistory(prev => [...prev, sourceImage]);
      setSourceImage(dataUri);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setIsCroppingMode(false);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to crop image');
    }
  };

  const removeBgOnly = async () => {
    if (!sourceImage) return;
    setIsLoading(true);
    setLoadingMsg('Removing background...');
    setError('');
    try {
      const base64Data = sourceImage.split(',')[1];
      const bgRes = await fetch('/api/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data })
      });
      const bgData = await bgRes.json();
      if (!bgRes.ok) throw new Error(bgData.error || 'Failed to remove background');
      setSourceImageHistory(prev => [...prev, sourceImage]);
      setSourceImage(bgData.dataUri);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setShowBgOptions(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to remove background');
    } finally {
      setIsLoading(false);
    }
  };

  const exportResult = async () => {
    if (!sourceImage) return;
    setIsLoading(true);
    setLoadingMsg('Exporting final image...');
    setError('');

    try {
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = targetWidth;
      finalCanvas.height = targetHeight;
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      if (!isTransparent) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      const tempImg = new Image();
      tempImg.src = sourceImage;
      await new Promise((resolve) => { tempImg.onload = resolve; });

      const scale = Math.min(targetWidth / tempImg.width, targetHeight / tempImg.height);
      const x = (targetWidth / 2) - (tempImg.width / 2) * scale;
      const y = (targetHeight / 2) - (tempImg.height / 2) * scale;

      ctx.drawImage(tempImg, x, y, tempImg.width * scale, tempImg.height * scale);
      
      const finalDataUrl = finalCanvas.toDataURL(exportFormat, exportQuality / 100);
      const extension = exportFormat.split('/')[1];
      
      const a = document.createElement('a');
      a.href = finalDataUrl;
      a.download = `Corbs_image.${extension}`;
      a.click();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to export image');
    } finally {
      setIsLoading(false);
    }
  };

  
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isCroppingMode || e.button === 1) {
      setIsPanning(true);
      setLastPanPos({ x: e.clientX, y: e.clientY });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (isPanning) {
      setPan(prev => ({
        x: prev.x + (e.clientX - lastPanPos.x),
        y: prev.y + (e.clientY - lastPanPos.y)
      }));
      setLastPanPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsPanning(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
  };

  const reset = () => {
    setStep('upload');
    setSourceImage('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setIsCroppingMode(false);
    setError('');
    setShowBgOptions(false);
    setPan({x:0, y:0});
    setZoom(1);
  };

  return (
    <div className="w-screen h-screen bg-page text-main font-sans flex flex-col overflow-hidden select-none">

      {/* Mobile Side Nav Bar */}
      <div className={`fixed inset-0 z-50 sm:hidden ${isMobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsMobileMenuOpen(false)}></div>
        <div className={`absolute left-0 top-0 bottom-0 w-56 bg-page border-r border-neo shadow-2xl p-6 flex flex-col gap-6 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex justify-between items-center">
            <span className="font-bold text-lg">Menu</span>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-main -mr-2">
              <X size={24} />
            </button>
          </div>
          <div className="flex flex-col gap-4">
            <button 
              onClick={() => { reset(); setIsMobileMenuOpen(false); }} 
              disabled={step === 'upload'}
              className="px-4 py-3 neo-convex text-main hover:!bg-black hover:!bg-none hover:text-white font-bold text-sm rounded transition-colors uppercase disabled:opacity-50 disabled:hover:!bg-none disabled:hover:!bg-transparent disabled:hover:text-main active:scale-95 active:neo-pressed border border-neo"
            >
              Reset
            </button>
            <button 
              onClick={() => { undoCrop(); setIsMobileMenuOpen(false); }} 
              disabled={isLoading || sourceImageHistory.length === 0}
              className="px-4 py-3 neo-convex text-main hover:!bg-black hover:!bg-none hover:text-white font-bold text-sm rounded transition-colors uppercase disabled:opacity-50 disabled:hover:!bg-none disabled:hover:!bg-transparent disabled:hover:text-main active:scale-95 active:neo-pressed border border-neo"
            >
              Undo Edit
            </button>
            <button 
              onClick={() => { exportResult(); setIsMobileMenuOpen(false); }} 
              disabled={isLoading || step !== 'crop'}
              className="px-4 py-3 neo-convex text-main hover:!bg-black hover:!bg-none hover:text-white font-bold text-sm rounded transition-colors uppercase disabled:opacity-50 disabled:hover:!bg-none disabled:hover:!bg-transparent disabled:hover:text-main active:scale-95 active:neo-pressed border border-neo"
            >
              Export Result
            </button>
          </div>
        </div>
      </div>

      
      {/* Top Navigation Bar */}
      <nav className="h-16 flex items-center justify-between px-6 neo-flat mb-1 rounded-b-xl mx-4 shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <button className="sm:hidden p-2 text-main -ml-2" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>
          <img src={corbLogo} alt="Corb Logo" className="w-8 h-8 object-cover shrink-0" referrerPolicy="no-referrer" />
          <span className="font-semibold tracking-wider text-sm">CORB</span>
        </div>
          <div className="hidden sm:flex items-center gap-4 sm:gap-6">

          
          {step !== 'upload' && (
            <button 
              onClick={reset} 
              className="px-4 py-1.5 neo-convex text-main hover:!bg-black hover:!bg-none hover:text-white font-bold text-xs rounded transition-colors uppercase active:scale-95 active:neo-pressed border border-neo"
            >
              Reset
            </button>
          )}
          {sourceImageHistory.length > 0 && (
            <button 
              onClick={undoCrop} 
              disabled={isLoading}
              className="px-4 py-1.5 neo-convex text-main hover:!bg-black hover:!bg-none hover:text-white font-bold text-xs rounded transition-colors uppercase disabled:opacity-50 disabled:hover:!bg-none disabled:hover:!bg-transparent disabled:hover:text-main active:scale-95 active:neo-pressed border border-neo"
            >
              Undo Edit
            </button>
          )}
          {step === 'crop' && (
            <button 
              onClick={exportResult} 
              disabled={isLoading}
              className="px-4 py-1.5 neo-convex text-main hover:!bg-black hover:!bg-none hover:text-white font-bold text-xs rounded transition-colors uppercase disabled:opacity-50 disabled:hover:!bg-none disabled:hover:!bg-transparent disabled:hover:text-main active:scale-95 active:neo-pressed border border-neo"
            >
              Export Result
            </button>
          )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative">
            <svg
              style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
              aria-hidden="true"
            >
              <defs>
                <filter id="sketchy" x="-10%" y="-10%" width="120%" height="120%">
                  <feTurbulence
                    type="turbulence"
                    baseFrequency="0.035 0.042"
                    numOctaves={4}
                    result="noise"
                    seed="42"
                  ></feTurbulence>
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="noise"
                    scale="4.5"
                    xChannelSelector="R"
                    yChannelSelector="G"
                  ></feDisplacementMap>
                </filter>
                <filter id="sketchy-sm" x="-18%" y="-18%" width="136%" height="136%">
                  <feTurbulence
                    type="turbulence"
                    baseFrequency="0.06"
                    numOctaves={3}
                    result="noise"
                    seed="7"
                  ></feTurbulence>
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="noise"
                    scale="2.5"
                    xChannelSelector="R"
                    yChannelSelector="G"
                  ></feDisplacementMap>
                </filter>
              </defs>
            </svg>

            
            <div className="flex items-center justify-center relative -mr-2">
              <label className="theme-switch">
                <input 
                  className="theme-switch__checkbox" 
                  type="checkbox" 
                  checked={isDarkMode}
                  onChange={toggleTheme}
                />
                <div className="theme-switch__container">
                  <div className="theme-switch__clouds"></div>
                  <div className="theme-switch__stars-container">
                    <svg fill="none" viewBox="0 0 144 55" xmlns="http://www.w3.org/2000/svg">
                      <path
                        fill="currentColor"
                        d="M135.831 3.00688C135.055 3.85027 134.111 4.29946 133 4.35447C134.111 4.40947 135.055 4.85867 135.831 5.71123C136.607 6.55462 136.996 7.56303 136.996 8.72727C136.996 7.95722 137.172 7.25134 137.525 6.59129C137.886 5.93124 138.372 5.39954 138.98 5.00535C139.598 4.60199 140.268 4.39114 141 4.35447C139.88 4.2903 138.936 3.85027 138.16 3.00688C137.384 2.16348 136.996 1.16425 136.996 0C136.996 1.16425 136.607 2.16348 135.831 3.00688ZM31 23.3545C32.1114 23.2995 33.0551 22.8503 33.8313 22.0069C34.6075 21.1635 34.9956 20.1642 34.9956 19C34.9956 20.1642 35.3837 21.1635 36.1599 22.0069C36.9361 22.8503 37.8798 23.2903 39 23.3545C38.2679 23.3911 37.5976 23.602 36.9802 24.0053C36.3716 24.3995 35.8864 24.9312 35.5248 25.5913C35.172 26.2513 34.9956 26.9572 34.9956 27.7273C34.9956 26.563 34.6075 25.5546 33.8313 24.7112C33.0551 23.8587 32.1114 23.4095 31 23.3545ZM0 36.3545C1.11136 36.2995 2.05513 35.8503 2.83131 35.0069C3.6075 34.1635 3.99559 33.1642 3.99559 32C3.99559 33.1642 4.38368 34.1635 5.15987 35.0069C5.93605 35.8503 6.87982 36.2903 8 36.3545C7.26792 36.3911 6.59757 36.602 5.98015 37.0053C5.37155 37.3995 4.88644 37.9312 4.52481 38.5913C4.172 39.2513 3.99559 39.9572 3.99559 40.7273C3.99559 39.563 3.6075 38.5546 2.83131 37.7112C2.05513 36.8587 1.11136 36.4095 0 36.3545ZM56.8313 24.0069C56.0551 24.8503 55.1114 25.2995 54 25.3545C55.1114 25.4095 56.0551 25.8587 56.8313 26.7112C57.6075 27.5546 57.9956 28.563 57.9956 29.7273C57.9956 28.9572 58.172 28.2513 58.5248 27.5913C58.8864 26.9312 59.3716 26.3995 59.9802 26.0053C60.5976 25.602 61.2679 25.3911 62 25.3545C60.8798 25.2903 59.9361 24.8503 59.1599 24.0069C58.3837 23.1635 57.9956 22.1642 57.9956 21C57.9956 22.1642 57.6075 23.1635 56.8313 24.0069ZM81 25.3545C82.1114 25.2995 83.0551 24.8503 83.8313 24.0069C84.6075 23.1635 84.9956 22.1642 84.9956 21C84.9956 22.1642 85.3837 23.1635 86.1599 24.0069C86.9361 24.8503 87.8798 25.2903 89 25.3545C88.2679 25.3911 87.5976 25.602 86.9802 26.0053C86.3716 26.3995 85.8864 26.9312 85.5248 27.5913C85.172 28.2513 84.9956 28.9572 84.9956 29.7273C84.9956 28.563 84.6075 27.5546 83.8313 26.7112C83.0551 25.8587 82.1114 25.4095 81 25.3545ZM136 36.3545C137.111 36.2995 138.055 35.8503 138.831 35.0069C139.607 34.1635 139.996 33.1642 139.996 32C139.996 33.1642 140.384 34.1635 141.16 35.0069C141.936 35.8503 142.88 36.2903 144 36.3545C143.268 36.3911 142.598 36.602 141.98 37.0053C141.372 37.3995 140.886 37.9312 140.525 38.5913C140.172 39.2513 139.996 39.9572 139.996 40.7273C139.996 39.563 139.607 38.5546 138.831 37.7112C138.055 36.8587 137.111 36.4095 136 36.3545ZM101.831 49.0069C101.055 49.8503 100.111 50.2995 99 50.3545C100.111 50.4095 101.055 50.8587 101.831 51.7112C102.607 52.5546 102.996 53.563 102.996 54.7273C102.996 53.9572 103.172 53.2513 103.525 52.5913C103.886 51.9312 104.372 51.3995 104.98 51.0053C105.598 50.602 106.268 50.3911 107 50.3545C105.88 50.2903 104.936 49.8503 104.16 49.0069C103.384 48.1635 102.996 47.1642 102.996 46C102.996 47.1642 102.607 48.1635 101.831 49.0069Z"
                        clipRule="evenodd"
                        fillRule="evenodd"
                      ></path>
                    </svg>
                  </div>
                  <div className="theme-switch__circle-container">
                    <div className="theme-switch__sun-moon-container">
                      <div className="theme-switch__moon">
                        <div className="theme-switch__spot"></div>
                        <div className="theme-switch__spot"></div>
                        <div className="theme-switch__spot"></div>
                      </div>
                    </div>
                  </div>
                  <div className="theme-switch__shooting-star"></div>
                  <div className="theme-switch__shooting-star-2"></div>
                  <div className="theme-switch__meteor"></div>
                  <div className="theme-switch__stars-cluster">
                    <div className="star"></div>
                    <div className="star"></div>
                    <div className="star"></div>
                    <div className="star"></div>
                    <div className="star"></div>
                  </div>
                  <div className="theme-switch__aurora"></div>
                  <div className="theme-switch__comets">
                    <div className="comet"></div>
                    <div className="comet"></div>
                  </div>
                </div>
              </label>
            </div>

          </div>

        </div>
      </nav>


      {/* Main Workspace */}
      <main className="flex-1 flex flex-col-reverse sm:flex-row overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-auto sm:w-80 h-1/3 sm:h-auto neo-flat flex flex-col p-6 gap-4 overflow-y-auto shrink-0 z-10 mx-4 mb-4 mt-1 rounded-xl border border-neo">
          <section>
            <div className="space-y-3">
              <label 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="group relative flex flex-col items-center justify-center border-2 border-dashed border-neo neo-flat rounded-lg p-3 py-3 text-center cursor-pointer hover:border-cyan-500 hover:neo-concave transition-all"
              >
                <div className="text-xs text-muted">Drop image here or click</div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
              
              <div className="relative flex gap-2">
                <input 
                  type="text" 
                  placeholder="Paste image URL..." 
                  className="w-full neo-pressed rounded px-3 py-2 text-xs focus:border-cyan-500 focus:outline-none placeholder:text-muted text-main"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <button 
                  onClick={handleUrlLoad}
                  disabled={isLoading || !urlInput}
                  className="neo-convex hover:neo-pressed text-main font-bold rounded px-3 py-2 text-xs transition-colors disabled:opacity-50 active:scale-95 active:neo-pressed border border-neo"
                >
                  Load
                </button>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <div className="space-y-4">
              <div className="neo-flat p-2 rounded-xl flex flex-col gap-2 ">
                <button
                  onClick={() => {
                    setIsCroppingMode(true);
                    if (aspectRatio && imgRef.current) {
                      const { naturalWidth: width, naturalHeight: height } = imgRef.current;
                      const newCrop = centerCrop(
                        makeAspectCrop({ unit: '%', width: 90 }, aspectRatio, width, height),
                        width,
                        height
                      );
                      setCrop(newCrop);
                    } else if (!crop) {
                      setCrop({ unit: '%', x: 10, y: 10, width: 80, height: 80 });
                    }
                  }}
                  disabled={isLoading || step !== 'crop' || isCroppingMode}
                  className="w-full p-2 neo-convex text-cyan-600 rounded hover:neo-pressed transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50 text-center active:scale-95 active:neo-pressed border border-neo"
                >
                  Crop
                </button>
                {isCroppingMode && (
                  <div className="pt-2 border-t border-neo">
                    <div className="text-[8px] text-muted uppercase mb-2">Aspect Ratio</div>
                    <div className="grid grid-cols-5 gap-1">
                       {[{ label: 'Free', val: undefined }, { label: '1:1', val: 1 }, { label: '16:9', val: 16/9 }, { label: '4:3', val: 4/3 }, { label: '3:2', val: 3/2 }].map(ar => (
                         <button
                           key={ar.label}
                           onClick={() => {
                             setAspectRatio(ar.val);
                             if (imgRef.current && isCroppingMode) {
                               const { naturalWidth: width, naturalHeight: height } = imgRef.current;
                               if (ar.val) {
                                 const newCrop = centerCrop(
                                   makeAspectCrop({ unit: '%', width: 90 }, ar.val, width, height),
                                   width,
                                   height
                                 );
                                 setCrop(newCrop);
                               }
                             }
                           }}
                           className={`py-1 text-[10px] rounded transition-colors ${aspectRatio === ar.val ? 'neo-pressed text-cyan-600 font-bold' : 'neo-convex text-muted hover:neo-pressed'}`}
                         >
                           {ar.label}
                         </button>
                       ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="neo-flat p-2 rounded-xl flex flex-col gap-2 ">
                <button
                  onClick={removeBgOnly}
                  disabled={isLoading || step !== 'crop'}
                  className="w-full p-2 neo-convex text-emerald-600 rounded hover:neo-pressed transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50 text-center active:scale-95 active:neo-pressed border border-neo"
                >
                  Remove Background
                </button>
                {showBgOptions && (
                  <div className="pt-2 border-t border-neo">
                    <div className="flex items-center justify-between">
                      <div className="text-[8px] text-muted uppercase">Background</div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] flex items-center gap-1 cursor-pointer text-muted">
                          <input type="checkbox" checked={isTransparent} onChange={(e) => setIsTransparent(e.target.checked)} className="accent-cyan-500" />
                          Transparent
                        </label>
                        {!isTransparent && (
                          <input 
                            type="color" 
                            value={bgColor} 
                            onChange={e => setBgColor(e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section>
            <div className="flex flex-col mb-4 neo-flat rounded  overflow-hidden">
              <button 
                onClick={() => setIsColorPickerExpanded(!isColorPickerExpanded)}
                className="flex items-center justify-between p-1.5 hover:neo-concave transition-colors w-full text-left rounded"
              >
                <span className="text-[10px] text-cyan-600 font-bold uppercase tracking-wider">Color Picker Tool</span>
                <span className="text-muted flex items-center justify-center w-4 h-4">
                  {isColorPickerExpanded ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  )}
                </span>
              </button>
              
              {isColorPickerExpanded && (
                <div className="p-2 pt-1.5 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                     <div className="w-6 h-6 rounded  shrink-0" style={{ backgroundColor: pickedColor || '#000000' }}></div>
                     <input 
                        type="text" 
                        readOnly 
                        value={pickedColor || 'Select...'} 
                        className="flex-1 neo-pressed rounded px-2 py-1 text-[10px] font-mono text-main text-center"
                     />
                     <button 
                        onClick={(e) => { 
                          if(pickedColor) {
                            navigator.clipboard.writeText(pickedColor); 
                            setCopiedState({ show: true, x: e.clientX, y: e.clientY });
                            setTimeout(() => setCopiedState(prev => ({ ...prev, show: false })), 2000);
                          }
                        }}
                        className="p-1.5 neo-convex hover:neo-pressed rounded text-muted disabled:opacity-50 active:scale-95 active:neo-pressed border border-neo"
                        title="Copy"
                        disabled={!pickedColor}
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                     </button>
                  </div>
                  <button
                    onClick={() => setIsEyedropperActive(!isEyedropperActive)}
                    disabled={isLoading || step !== 'crop'}
                    className={`w-full py-1.5 text-[10px] uppercase font-bold tracking-wider rounded border transition-colors ${
                      isEyedropperActive 
                        ? 'bg-cyan-500/20 text-cyan-600 border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]' 
                        : 'neo-convex text-muted hover:neo-pressed hover:text-main'
                    }`}
                  >
                    {isEyedropperActive ? 'Click Image to Pick Color' : 'Pick from Image'}
                  </button>
                </div>
              )}
            </div>

            <div className="mb-4 neo-flat p-2 rounded-xl mt-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold text-muted uppercase tracking-widest">Output Specs</h3>
                <button 
                  onClick={() => {
                    if (imgRef.current) {
                      setTargetWidth(imgRef.current.naturalWidth);
                      setTargetHeight(imgRef.current.naturalHeight);
                    }
                  }}
                  disabled={!sourceImage}
                  className="text-[8px] uppercase tracking-widest text-cyan-600 hover:text-cyan-600 font-bold bg-cyan-100 hover:bg-cyan-500/20 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                >
                  Match Image
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <div className="flex items-center justify-between neo-pressed px-2 py-1 rounded">
                  <span className="text-[8px] text-muted uppercase">W</span>
                  <input 
                    type="number" 
                    value={targetWidth} 
                    onChange={e => setTargetWidth(Number(e.target.value))}
                    className="w-12 bg-transparent text-[10px] font-mono text-main outline-none text-right"
                  />
                </div>
                <div className="flex items-center justify-between neo-pressed px-2 py-1 rounded">
                  <span className="text-[8px] text-muted uppercase">H</span>
                  <input 
                    type="number" 
                    value={targetHeight} 
                    onChange={e => setTargetHeight(Number(e.target.value))}
                    className="w-12 bg-transparent text-[10px] font-mono text-main outline-none text-right"
                  />
                </div>
                <div className="flex items-center justify-between neo-pressed px-2 py-1 rounded col-span-2 mt-1">
                  <span className="text-[8px] text-muted uppercase">Format</span>
                  <select 
                    value={exportFormat} 
                    onChange={e => setExportFormat(e.target.value as any)}
                    className="bg-transparent border-none px-1 text-[10px] font-mono text-main outline-none cursor-pointer"
                  >
                    <option value="image/png" className="bg-page text-main">PNG</option>
                    <option value="image/jpeg" className="bg-page text-main">JPEG</option>
                    <option value="image/webp" className="bg-page text-main">WEBP</option>
                  </select>
                </div>
                {exportFormat !== 'image/png' && (
                  <div className="flex items-center justify-between neo-pressed px-2 py-1 rounded col-span-2 mt-1 gap-2">
                    <span className="text-[8px] text-muted uppercase shrink-0">Quality</span>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={exportQuality} 
                      onChange={e => setExportQuality(Number(e.target.value))}
                      className="flex-1 accent-cyan-500 h-1"
                    />
                    <span className="text-[8px] font-mono text-muted w-6 text-right shrink-0">{exportQuality}%</span>
                  </div>
                )}
              </div>
            </div>

            {error ? (
               <div className="mt-4 text-[10px] text-red-400 font-serif">{error}</div>
            ) : isLoading ? (
               <div className="mt-4 text-[10px] text-muted italic font-serif">
                 {loadingMsg}
               </div>
            ) : step === 'crop' && (
               <div className="mt-4 text-[10px] text-muted italic font-serif">
                 Ready to export.
               </div>
            )}
          </section>
        </aside>

        {/* Viewer Area */}
        <div 
          className={`flex-1 relative flex items-center justify-center bg-transparent overflow-hidden p-6 touch-none ${isPanning ? "cursor-grabbing" : (!isCroppingMode && sourceImage ? "cursor-grab" : "")}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={(e) => {
            setZoom(z => Math.max(0.1, Math.min(z - e.deltaY * 0.001, 5)));
          }}
          
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          
          
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: isPanning ? 'none' : 'transform 0.1s ease-out', transformOrigin: 'center center' }} className="flex items-center justify-center max-w-full max-h-full">
            {step === 'upload' && !sourceImage && (
               <div className="text-muted font-mono text-xs uppercase tracking-widest opacity-50">
                  NO SOURCE LOADED
               </div>
            )}
            
            {step === 'crop' && sourceImage && (
               <div 
                 className="relative neo-flat shadow-2xl rounded-lg p-2 overflow-hidden group max-w-full max-h-full flex items-center justify-center"
                 style={{ 
                   backgroundColor: isTransparent ? 'transparent' : bgColor,
                   backgroundImage: isTransparent ? 'radial-gradient(#333 1px, transparent 1px)' : 'none',
                   backgroundSize: isTransparent ? '10px 10px' : 'auto'
                 }}
               >
                  {isCroppingMode ? (
                    <ReactCrop
                      crop={crop}
                      aspect={aspectRatio}
                      onChange={(pixelCrop, percentCrop) => {
                        setCrop(percentCrop);
                        setCompletedCrop(pixelCrop);
                      }}
                      onComplete={(c) => setCompletedCrop(c)}
                      className="max-h-full max-w-full"
                    >
                      <img 
                        ref={imgRef}
                        src={sourceImage} 
                        alt="Source" 
                        onLoad={onImageLoad}
                        onClick={handleImageClickForEyedropper}
                        className={`max-h-full max-w-full ${isEyedropperActive ? 'cursor-crosshair' : ''}`}
                        style={{ maxHeight: 'calc(100vh - 12rem)' }} // Account for header/footer padding
                      />
                    </ReactCrop>
                  ) : (
                    <img 
                      ref={imgRef}
                      src={sourceImage} 
                      alt="Source" 
                      onLoad={onImageLoad}
                      onClick={handleImageClickForEyedropper}
                      className={`max-h-full max-w-full ${isEyedropperActive ? 'cursor-crosshair' : ''}`}
                      style={{ maxHeight: 'calc(100vh - 12rem)' }} // Account for header/footer padding
                    />
                  )}
                  
                  {isLoading && (
                    <div className="absolute top-4 left-4 neo-flat px-3 py-1 rounded  text-[10px] text-cyan-600 uppercase tracking-widest font-mono z-10">
                      PROCESSING...
                    </div>
                  )}
               </div>
            )}
          </div>

          {isCroppingMode && (
            <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 flex items-center gap-2 sm:gap-4 z-50">
              <button 
                onClick={() => { setIsCroppingMode(false); setCrop(undefined); }}
                className="neo-convex hover:neo-pressed text-main font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded text-xs uppercase tracking-widest shadow-lg transition-colors backdrop-blur-md active:scale-95 active:neo-pressed border border-neo"
              >
                Cancel
              </button>
              <button 
                onClick={applyCrop}
                className="neo-convex hover:neo-pressed text-emerald-600 font-bold px-4 py-1.5 sm:px-6 sm:py-2 rounded text-xs uppercase tracking-widest shadow-lg transition-colors shadow-emerald-500/20 active:scale-95 active:neo-pressed border border-neo"
              >
                OK
              </button>
            </div>
          )}

          {isCroppingMode && completedCrop && imgRef.current && (
            <div 
              className="fixed z-[100] pointer-events-none neo-flat px-2 py-1 rounded  text-[10px] tracking-widest font-mono text-cyan-600 shadow-lg"
              style={{ left: mousePos.x + 16, top: mousePos.y + 16 }}
            >
              {Math.round(completedCrop.width * (imgRef.current.naturalWidth / imgRef.current.width))} × {Math.round(completedCrop.height * (imgRef.current.naturalHeight / imgRef.current.height))} px
            </div>
          )}

          {copiedState.show && (
            <div 
              className="fixed z-[100] pointer-events-none neo-flat px-2 py-1 rounded  text-[10px] tracking-widest font-mono text-cyan-600 shadow-lg"
              style={{ left: copiedState.x + 10, top: copiedState.y + 10 }}
            >
              COPIED
            </div>
          )}

          {/* Zoom Controls */}
          {sourceImage && (
            <div className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 flex gap-1 sm:gap-1.5 z-50 neo-flat p-1 sm:p-1.5 rounded">
              <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-main neo-convex hover:neo-pressed rounded transition-colors text-base sm:text-lg leading-none active:scale-95 active:neo-pressed border border-neo">-</button>
              <div className="w-10 sm:w-12 h-6 sm:h-7 flex items-center justify-center text-[10px] sm:text-xs font-mono text-main select-none neo-pressed rounded">{Math.round(zoom * 100)}%</div>
              <button onClick={() => setZoom(z => Math.min(5, z + 0.1))} className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-main neo-convex hover:neo-pressed rounded transition-colors text-base sm:text-lg leading-none active:scale-95 active:neo-pressed border border-neo">+</button>
              <button onClick={() => { setZoom(1); setPan({x: 0, y: 0}); }} className="px-1 sm:px-2 h-6 sm:h-7 flex items-center justify-center text-[9px] sm:text-[10px] text-cyan-600 font-mono neo-convex hover:neo-pressed rounded transition-colors uppercase tracking-widest ml-1 active:scale-95 active:neo-pressed border border-neo">Reset</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
