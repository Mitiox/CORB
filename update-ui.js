const fs = require('fs');

let content = fs.readFileSync('src/components/ImageEditor.tsx', 'utf8');

// Replace main wrapper
content = content.replace('bg-[#050506] text-slate-200', 'bg-[#e0e5ec] text-slate-700');

// Replace Top Navigation Bar
content = content.replace('border-b border-white/10 flex items-center justify-between px-6 bg-[#0A0A0C]/80 backdrop-blur-md', 'flex items-center justify-between px-6 neo-flat mb-2 rounded-b-xl mx-4');

// Replace text colors in header
content = content.replace('text-emerald-400', 'text-emerald-600');
content = content.replace(/bg-white\/10 text-white/g, 'neo-flat text-slate-700 hover:neo-concave');
content = content.replace(/hover:bg-white hover:text-black/g, 'text-slate-900');
content = content.replace(/border border-emerald-500\/30/g, 'neo-pressed');
content = content.replace(/bg-emerald-500\/10/g, 'bg-transparent');

// Replace Sidebar
content = content.replace('border-r border-white/5 bg-[#08080A]', 'bg-transparent');
content = content.replace(/bg-white\/5 border border-white\/10/g, 'neo-pressed');
content = content.replace(/bg-white\/5 p-2 rounded/g, 'neo-flat p-2 rounded-xl');
content = content.replace(/border border-dashed border-white\/20/g, 'border-2 border-dashed border-slate-300 neo-flat');
content = content.replace(/hover:border-cyan-500\/50 hover:bg-cyan-500\/5/g, 'hover:border-cyan-500 hover:neo-concave');
content = content.replace(/bg-cyan-500\/10/g, 'bg-cyan-100');

// Input fields and smaller buttons
content = content.replace(/bg-black\/40 border border-white\/10/g, 'neo-pressed');
content = content.replace(/bg-black\/20/g, 'neo-pressed');
content = content.replace(/text-slate-200/g, 'text-slate-700');
content = content.replace(/text-slate-300/g, 'text-slate-600');
content = content.replace(/text-slate-400/g, 'text-slate-500');
content = content.replace(/text-white/g, 'text-slate-800');
content = content.replace(/text-cyan-400/g, 'text-cyan-600');
content = content.replace(/text-cyan-500/g, 'text-cyan-600');

// Dropdown / Select classes
content = content.replace(/bg-\[\#121215\]/g, 'neo-flat');

// Main view area
content = content.replace(/bg-\[radial-gradient\(circle_at_50%_50%,#1a1a2e,transparent_80%\)\]/g, 'bg-transparent');
content = content.replace(/border border-white\/10 shadow-2xl/g, 'neo-flat shadow-2xl rounded-lg p-2');
content = content.replace(/bg-black\/60 backdrop-blur-md/g, 'neo-flat');
content = content.replace(/bg-black\/80 backdrop-blur-md/g, 'neo-flat');
content = content.replace(/border border-white\/20/g, '');

// Bottom status bar
content = content.replace(/bg-\[\#050506\] border-t border-white\/5/g, 'neo-flat mt-2 rounded-t-xl mx-4');

// Colors
content = content.replace(/hover:bg-white\/10/g, 'hover:neo-concave');
content = content.replace(/hover:bg-white\/20/g, 'hover:neo-pressed');
content = content.replace(/bg-emerald-500 hover:bg-emerald-400 text-black/g, 'neo-flat text-emerald-600 font-bold hover:neo-concave');

fs.writeFileSync('src/components/ImageEditor.tsx', content);
