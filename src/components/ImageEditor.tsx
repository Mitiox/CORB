import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import corbLogo from '../assets/images/Logo.png';

type Step = 'upload' | 'crop';

export default function ImageEditor() {
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

  const reset = () => {
    setStep('upload');
    setSourceImage('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setIsCroppingMode(false);
    setError('');
    setShowBgOptions(false);
  };

  return (
    <div className="w-screen h-screen bg-[#e0e5ec] text-slate-700 font-sans flex flex-col overflow-hidden select-none">
      
      {/* Top Navigation Bar */}
      <nav className="h-16 flex items-center justify-between px-6 neo-flat mb-1 rounded-b-xl mx-4 shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <img src={corbLogo} alt="Corb Logo" className="w-8 h-8 object-cover shrink-0" referrerPolicy="no-referrer" />
          <span className="font-semibold tracking-wider text-sm">CORB</span>
        </div>
          <div className="flex items-center gap-4 sm:gap-6">
          {step !== 'upload' && (
            <button 
              onClick={reset} 
              className="px-4 py-1.5 neo-convex text-slate-700 hover:!bg-black hover:!bg-none hover:text-white font-bold text-xs rounded transition-colors uppercase active:scale-95 active:neo-pressed border border-white/60"
            >
              Reset
            </button>
          )}
          {sourceImageHistory.length > 0 && (
            <button 
              onClick={undoCrop} 
              disabled={isLoading}
              className="px-4 py-1.5 neo-convex text-slate-700 hover:!bg-black hover:!bg-none hover:text-white font-bold text-xs rounded transition-colors uppercase disabled:opacity-50 disabled:hover:!bg-none disabled:hover:!bg-transparent disabled:hover:text-slate-700 active:scale-95 active:neo-pressed border border-white/60"
            >
              Undo Edit
            </button>
          )}
          {step === 'crop' && (
            <button 
              onClick={exportResult} 
              disabled={isLoading}
              className="px-4 py-1.5 neo-convex text-slate-700 hover:!bg-black hover:!bg-none hover:text-white font-bold text-xs rounded transition-colors uppercase disabled:opacity-50 disabled:hover:!bg-none disabled:hover:!bg-transparent disabled:hover:text-slate-700 active:scale-95 active:neo-pressed border border-white/60"
            >
              Export Result
            </button>
          )}
        </div>
      </nav>


      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-72 sm:w-80 neo-flat flex flex-col p-6 gap-4 overflow-y-auto shrink-0 z-10 mx-4 mb-4 mt-1 rounded-xl border border-slate-300">
          <section>
            <div className="space-y-3">
              <label 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="group relative flex flex-col items-center justify-center border-2 border-dashed border-slate-300 neo-flat rounded-lg p-3 py-3 text-center cursor-pointer hover:border-cyan-500 hover:neo-concave transition-all"
              >
                <div className="text-xs text-slate-500">Drop image here or click</div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
              
              <div className="relative flex gap-2">
                <input 
                  type="text" 
                  placeholder="Paste image URL..." 
                  className="w-full neo-pressed rounded px-3 py-2 text-xs focus:border-cyan-500 focus:outline-none placeholder-slate-600 text-slate-700"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <button 
                  onClick={handleUrlLoad}
                  disabled={isLoading || !urlInput}
                  className="neo-convex hover:neo-pressed text-slate-800 font-bold rounded px-3 py-2 text-xs transition-colors disabled:opacity-50 active:scale-95 active:neo-pressed border border-white/60"
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
                  className="w-full p-2 neo-convex text-cyan-600 rounded hover:neo-pressed transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50 text-center active:scale-95 active:neo-pressed border border-white/60"
                >
                  Crop
                </button>
                {isCroppingMode && (
                  <div className="pt-2 border-t border-slate-300/50">
                    <div className="text-[8px] text-slate-500 uppercase mb-2">Aspect Ratio</div>
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
                           className={`py-1 text-[10px] rounded transition-colors ${aspectRatio === ar.val ? 'neo-pressed text-cyan-600 font-bold' : 'neo-convex text-slate-600 hover:neo-pressed'}`}
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
                  className="w-full p-2 neo-convex text-emerald-600 rounded hover:neo-pressed transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50 text-center active:scale-95 active:neo-pressed border border-white/60"
                >
                  Remove Background
                </button>
                {showBgOptions && (
                  <div className="pt-2 border-t border-slate-300/50">
                    <div className="flex items-center justify-between">
                      <div className="text-[8px] text-slate-500 uppercase">Background</div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] flex items-center gap-1 cursor-pointer text-slate-600">
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
                <span className="text-slate-500 flex items-center justify-center w-4 h-4">
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
                        className="flex-1 neo-pressed rounded px-2 py-1 text-[10px] font-mono text-slate-800 text-center"
                     />
                     <button 
                        onClick={(e) => { 
                          if(pickedColor) {
                            navigator.clipboard.writeText(pickedColor); 
                            setCopiedState({ show: true, x: e.clientX, y: e.clientY });
                            setTimeout(() => setCopiedState(prev => ({ ...prev, show: false })), 2000);
                          }
                        }}
                        className="p-1.5 neo-convex hover:neo-pressed rounded text-slate-600 disabled:opacity-50 active:scale-95 active:neo-pressed border border-white/60"
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
                        : 'neo-convex text-slate-600 hover:neo-pressed hover:text-slate-800'
                    }`}
                  >
                    {isEyedropperActive ? 'Click Image to Pick Color' : 'Pick from Image'}
                  </button>
                </div>
              )}
            </div>

            <div className="mb-4 neo-flat p-2 rounded-xl mt-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Output Specs</h3>
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
                  <span className="text-[8px] text-slate-500 uppercase">W</span>
                  <input 
                    type="number" 
                    value={targetWidth} 
                    onChange={e => setTargetWidth(Number(e.target.value))}
                    className="w-12 bg-transparent text-[10px] font-mono text-slate-700 outline-none text-right"
                  />
                </div>
                <div className="flex items-center justify-between neo-pressed px-2 py-1 rounded">
                  <span className="text-[8px] text-slate-500 uppercase">H</span>
                  <input 
                    type="number" 
                    value={targetHeight} 
                    onChange={e => setTargetHeight(Number(e.target.value))}
                    className="w-12 bg-transparent text-[10px] font-mono text-slate-700 outline-none text-right"
                  />
                </div>
                <div className="flex items-center justify-between neo-pressed px-2 py-1 rounded col-span-2 mt-1">
                  <span className="text-[8px] text-slate-500 uppercase">Format</span>
                  <select 
                    value={exportFormat} 
                    onChange={e => setExportFormat(e.target.value as any)}
                    className="bg-transparent border-none px-1 text-[10px] font-mono text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="image/png" className="bg-[#e0e5ec] text-slate-700">PNG</option>
                    <option value="image/jpeg" className="bg-[#e0e5ec] text-slate-700">JPEG</option>
                    <option value="image/webp" className="bg-[#e0e5ec] text-slate-700">WEBP</option>
                  </select>
                </div>
                {exportFormat !== 'image/png' && (
                  <div className="flex items-center justify-between neo-pressed px-2 py-1 rounded col-span-2 mt-1 gap-2">
                    <span className="text-[8px] text-slate-500 uppercase shrink-0">Quality</span>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={exportQuality} 
                      onChange={e => setExportQuality(Number(e.target.value))}
                      className="flex-1 accent-cyan-500 h-1"
                    />
                    <span className="text-[8px] font-mono text-slate-600 w-6 text-right shrink-0">{exportQuality}%</span>
                  </div>
                )}
              </div>
            </div>

            {error ? (
               <div className="mt-4 text-[10px] text-red-400 font-serif">{error}</div>
            ) : isLoading ? (
               <div className="mt-4 text-[10px] text-slate-500 italic font-serif">
                 {loadingMsg}
               </div>
            ) : step === 'crop' && (
               <div className="mt-4 text-[10px] text-slate-500 italic font-serif">
                 Ready to export.
               </div>
            )}
          </section>
        </aside>

        {/* Viewer Area */}
        <div 
          className="flex-1 relative flex items-center justify-center bg-transparent overflow-hidden p-6"
          onWheel={(e) => {
            setZoom(z => Math.max(0.1, Math.min(z - e.deltaY * 0.001, 5)));
          }}
          onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          
          
          <div style={{ transform: `scale(${zoom})`, transition: 'transform 0.1s ease-out', transformOrigin: 'center center' }} className="flex items-center justify-center max-w-full max-h-full">
            {step === 'upload' && !sourceImage && (
               <div className="text-slate-500 font-mono text-xs uppercase tracking-widest opacity-50">
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
            <div className="absolute bottom-8 right-8 flex items-center gap-4 z-50">
              <button 
                onClick={() => { setIsCroppingMode(false); setCrop(undefined); }}
                className="neo-convex hover:neo-pressed text-slate-800 font-bold px-4 py-2 rounded text-xs uppercase tracking-widest shadow-lg transition-colors  backdrop-blur-md active:scale-95 active:neo-pressed border border-white/60"
              >
                Cancel
              </button>
              <button 
                onClick={applyCrop}
                className="neo-convex hover:neo-pressed text-emerald-600 font-bold font-bold px-6 py-2 rounded text-xs uppercase tracking-widest shadow-lg transition-colors shadow-emerald-500/20 active:scale-95 active:neo-pressed border border-white/60"
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
            <div className="absolute bottom-8 left-8 flex gap-1.5 z-50 neo-flat p-1.5 rounded ">
              <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="w-7 h-7 flex items-center justify-center text-slate-800 neo-convex hover:neo-pressed rounded transition-colors text-lg leading-none active:scale-95 active:neo-pressed border border-white/60">-</button>
              <div className="w-12 h-7 flex items-center justify-center text-xs font-mono text-slate-800 select-none neo-pressed rounded">{Math.round(zoom * 100)}%</div>
              <button onClick={() => setZoom(z => Math.min(5, z + 0.1))} className="w-7 h-7 flex items-center justify-center text-slate-800 neo-convex hover:neo-pressed rounded transition-colors text-lg leading-none active:scale-95 active:neo-pressed border border-white/60">+</button>
              <button onClick={() => setZoom(1)} className="px-2 h-7 flex items-center justify-center text-[10px] text-cyan-600 font-mono neo-convex hover:neo-pressed rounded transition-colors uppercase tracking-widest ml-1 active:scale-95 active:neo-pressed border border-white/60">Reset</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
