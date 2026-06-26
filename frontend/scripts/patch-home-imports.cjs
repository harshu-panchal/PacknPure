const fs = require('fs');
const path = require('path');

const homePath = path.join(__dirname, '../src/modules/customer/pages/Home.jsx');
let lines = fs.readFileSync(homePath, 'utf8').split(/\r?\n/);

const importBlock = `import {
  ALL_CATEGORY,
  CATEGORY_METADATA,
  DEFAULT_CATEGORY_THEME,
  ICON_COMPONENTS,
  MARQUEE_MESSAGES,
  STATIC_BESTSELLER_CATEGORIES,
} from '../constants/homeCategoryMetadata';`;

// Remove lines 66-393 (0-indexed 66..392) — static metadata block
lines.splice(66, 393 - 66, importBlock);

fs.writeFileSync(homePath, lines.join('\n'));
console.log('Patched Home.jsx, new line count:', lines.length);
