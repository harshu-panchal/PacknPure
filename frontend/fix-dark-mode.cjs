const fs = require('fs');
const path = require('path');

const deliveryDir = path.join(__dirname, 'src', 'modules', 'delivery');

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Replace common color classes with dark mode variants
            const replacements = [
                { regex: /(?<!dark:)bg-white/g, replacement: 'bg-white dark:bg-gray-800' },
                { regex: /(?<!dark:)bg-gray-50(?!\/)/g, replacement: 'bg-gray-50 dark:bg-gray-900' },
                { regex: /(?<!dark:)text-gray-900/g, replacement: 'text-gray-900 dark:text-white' },
                { regex: /(?<!dark:)text-gray-800/g, replacement: 'text-gray-800 dark:text-gray-100' },
                { regex: /(?<!dark:)text-gray-600/g, replacement: 'text-gray-600 dark:text-gray-300' },
                { regex: /(?<!dark:)text-gray-500/g, replacement: 'text-gray-500 dark:text-gray-400' },
                { regex: /(?<!dark:)border-gray-100/g, replacement: 'border-gray-100 dark:border-gray-700' },
                { regex: /(?<!dark:)bg-gray-100(?!\/)/g, replacement: 'bg-gray-100 dark:bg-gray-700' },
            ];

            for (const { regex, replacement } of replacements) {
                if (regex.test(content)) {
                    content = content.replace(regex, replacement);
                    modified = true;
                }
            }

            // Cleanup any duplicate dark: classes that might have been created
            content = content.replace(/dark:bg-gray-800 dark:bg-gray-800/g, 'dark:bg-gray-800');
            content = content.replace(/dark:bg-gray-900 dark:bg-gray-900/g, 'dark:bg-gray-900');
            content = content.replace(/dark:text-white dark:text-white/g, 'dark:text-white');
            content = content.replace(/dark:text-gray-100 dark:text-gray-100/g, 'dark:text-gray-100');
            content = content.replace(/dark:text-gray-300 dark:text-gray-300/g, 'dark:text-gray-300');
            content = content.replace(/dark:text-gray-400 dark:text-gray-400/g, 'dark:text-gray-400');
            content = content.replace(/dark:border-gray-700 dark:border-gray-700/g, 'dark:border-gray-700');
            content = content.replace(/dark:bg-gray-700 dark:bg-gray-700/g, 'dark:bg-gray-700');

            // Also remove the `dark:text-gray-100` from DeliveryLayout since it ruins white cards that were missed
            if (fullPath.includes('DeliveryLayout.jsx')) {
                content = content.replace('text-gray-900 dark:text-gray-100', 'text-gray-900 dark:text-white');
            }

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Updated', fullPath);
            }
        }
    }
}

processDirectory(deliveryDir);
console.log('Done!');
