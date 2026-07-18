const fs = require('fs');
let code = fs.readFileSync('src/components/ImageEditor.tsx', 'utf8');

const regex = /(<div className="relative">\s*<svg[\s\S]*?<\/label>\s*<\/div>\s*<\/div>\s*)/;
const match = code.match(regex);
if (match) {
    console.log(match[0].slice(-100));
}
