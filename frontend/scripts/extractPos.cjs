const fs = require('fs');
const path = require('path');

const srcDir = 'd:\\packandpure\\frontend\\src\\modules\\admin';
const destDir = 'd:\\packandpure\\frontend\\src\\shared\\pos';

const map = [
    { src: path.join(srcDir, 'components', 'pos'), dest: path.join(destDir, 'components') },
    { src: path.join(srcDir, 'context'), dest: path.join(destDir, 'context'), filter: n => n.startsWith('Pos') },
    { src: path.join(srcDir, 'pages', 'pos'), dest: path.join(destDir, 'pages') },
    { src: path.join(srcDir, 'services'), dest: path.join(destDir, 'services'), filter: n => n === 'posApi.js' }
];

function copySync(src, dest, filter) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        if (filter && !filter(entry.name)) continue;
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copySync(srcPath, destPath, filter);
        } else {
            let content = fs.readFileSync(srcPath, 'utf-8');
            
            // Fix import paths
            // If we are in shared/pos/pages, and we used to import '../../components/pos/PaymentModal'
            // We now want '../components/PaymentModal'
            content = content.replace(/\.\.\/\.\.\/components\/pos\//g, '../components/');
            
            // If we imported '../../context/PosCartContext', now it is '../context/PosCartContext'
            content = content.replace(/\.\.\/\.\.\/context\//g, '../context/');
            
            // If we imported '../../services/posApi', now it is '../services/posApi'
            content = content.replace(/\.\.\/\.\.\/services\//g, '../services/');

            // Some components in admin/components/pos might import from '../../context/...'
            // In shared/pos/components, it becomes '../context/...'
            content = content.replace(/\.\.\/\.\.\/context\//g, '../context/');

            // PosSessionContext imports `../services/posApi`
            // in shared/pos/context, it becomes `../services/posApi` (no change needed)
            
            fs.writeFileSync(destPath, content);
            console.log(`Copied and updated: ${destPath}`);
        }
    }
}

map.forEach(m => copySync(m.src, m.dest, m.filter));
console.log('Shared POS module extraction complete.');
