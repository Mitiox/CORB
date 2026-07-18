const fs = require('fs');
let code = fs.readFileSync('src/components/ImageEditor.tsx', 'utf8');

// Replace the `<div className="flex items-center gap-4 sm:gap-6">` that wraps the buttons and the theme toggle with a structured one.
const oldNavStart = '          <div className="flex items-center gap-4 sm:gap-6">';
const newNavStart = '          <div className="hidden sm:flex items-center gap-4 sm:gap-6">';

code = code.replace(oldNavStart, newNavStart);

// We need to find where the theme toggle div starts: `<div className="relative">`
const themeToggleStr = '<div className="relative">\n            <svg\n              style={{ position: \'absolute\'';
const newThemeToggle = '          </div>\n          <div className="flex items-center gap-2 sm:gap-4">\n            <button className="sm:hidden p-2 text-main" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24} /></button>\n            ' + themeToggleStr;
code = code.replace(themeToggleStr, newThemeToggle);

// Now we need to insert the mobile sidebar Drawer at the end of the return statement, right before `</div>` at the very end.
// Or we can just insert it at the very top of the main layout, under `<div className="w-screen...`
const mobileMenuContent = `
      {/* Mobile Side Nav Bar */}
      <div className={\`fixed inset-0 z-50 transition-transform duration-300 sm:hidden \${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}\`}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}></div>
        <div className="absolute right-0 top-0 bottom-0 w-64 bg-page border-l border-neo shadow-2xl p-6 flex flex-col gap-6 transform transition-transform">
          <div className="flex justify-between items-center">
            <span className="font-bold text-lg">Menu</span>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-main">
              <X size={24} />
            </button>
          </div>
          <div className="flex flex-col gap-4">
            {step !== 'upload' && (
              <button 
                onClick={() => { reset(); setIsMobileMenuOpen(false); }} 
                className="px-4 py-3 neo-convex text-main hover:!bg-black hover:!bg-none hover:text-white font-bold text-sm rounded transition-colors uppercase active:scale-95 active:neo-pressed border border-neo"
              >
                Reset
              </button>
            )}
            {sourceImageHistory.length > 0 && (
              <button 
                onClick={() => { undoCrop(); setIsMobileMenuOpen(false); }} 
                disabled={isLoading}
                className="px-4 py-3 neo-convex text-main hover:!bg-black hover:!bg-none hover:text-white font-bold text-sm rounded transition-colors uppercase disabled:opacity-50 disabled:hover:!bg-none disabled:hover:!bg-transparent disabled:hover:text-main active:scale-95 active:neo-pressed border border-neo"
              >
                Undo Edit
              </button>
            )}
            {step === 'crop' && (
              <button 
                onClick={() => { exportResult(); setIsMobileMenuOpen(false); }} 
                disabled={isLoading}
                className="px-4 py-3 neo-convex text-main hover:!bg-black hover:!bg-none hover:text-white font-bold text-sm rounded transition-colors uppercase disabled:opacity-50 disabled:hover:!bg-none disabled:hover:!bg-transparent disabled:hover:text-main active:scale-95 active:neo-pressed border border-neo"
              >
                Export Result
              </button>
            )}
          </div>
        </div>
      </div>
`;
const wrapperStart = '<div className="w-screen h-screen bg-page text-main font-sans flex flex-col overflow-hidden select-none">';
code = code.replace(wrapperStart, wrapperStart + '\n' + mobileMenuContent);

fs.writeFileSync('src/components/ImageEditor.tsx', code);
