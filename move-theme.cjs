const fs = require('fs');
let code = fs.readFileSync('src/components/ImageEditor.tsx', 'utf8');

const regex = /(<div className="relative">\s*<svg[\s\S]*?<\/label>\s*<\/div>\s*<\/div>\s*)/;
const match = code.match(regex);

if (match) {
    const extracted = match[0];
    // Remove the block
    code = code.replace(extracted, '');
    
    // Insert it before `        </div>\n      </nav>`
    const target = '        </div>\n      </nav>';
    code = code.replace(target, extracted + target);
    
    fs.writeFileSync('src/components/ImageEditor.tsx', code);
    console.log("Moved correctly.");
} else {
    console.log("Not found.");
}
