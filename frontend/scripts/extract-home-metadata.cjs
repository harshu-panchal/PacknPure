const fs = require('fs');
const path = require('path');

const homePath = path.join(__dirname, '../src/modules/customer/pages/Home.jsx');
const outPath = path.join(__dirname, '../src/modules/customer/constants/homeCategoryMetadata.js');

const lines = fs.readFileSync(homePath, 'utf8').split(/\r?\n/);
const block = lines.slice(66, 393).join('\n');

const header = `import { Sparkles } from 'lucide-react';
import HomeIcon from '@mui/icons-material/Home';
import DevicesIcon from '@mui/icons-material/Devices';
import LocalGroceryStoreIcon from '@mui/icons-material/LocalGroceryStore';
import KitchenIcon from '@mui/icons-material/Kitchen';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import PetsIcon from '@mui/icons-material/Pets';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';

`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header + block + '\n');
console.log('Wrote', outPath);
