const fs = require('fs');
let code = fs.readFileSync('src/components/ImageEditor.tsx', 'utf8');

code = code.replace('                  </div>\n      </nav>', '        </div>\n      </nav>');

fs.writeFileSync('src/components/ImageEditor.tsx', code);
