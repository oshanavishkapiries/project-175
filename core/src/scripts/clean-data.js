/**
 * Clean Data Script
 * Removes all generated files from the data folder
 * Run with: npm run clean
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

// Folders to clean (remove all contents but keep the folder)
const foldersToClean = [
    'action-logs',
    'element-map',
    'simplified-html',
    'output',
    'temp',
    'token-reports'
];

// Folders to keep with their contents
const foldersToKeep = [
    'html-pages'  // Keep original HTML samples
];

function cleanFolder(folderPath) {
    if (!fs.existsSync(folderPath)) {
        return 0;
    }

    let count = 0;
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            count += cleanFolder(filePath);
            fs.rmdirSync(filePath);
        } else {
            fs.unlinkSync(filePath);
            count++;
        }
    }

    return count;
}

function main() {
    console.log('🧹 Cleaning data folder...\n');

    let totalCleaned = 0;

    for (const folder of foldersToClean) {
        const folderPath = path.join(dataDir, folder);

        if (fs.existsSync(folderPath)) {
            const count = cleanFolder(folderPath);
            console.log(`   ✅ ${folder}: ${count} files removed`);
            totalCleaned += count;
        } else {
            console.log(`   ⏭️  ${folder}: not found`);
        }
    }

    console.log(`\n📊 Total: ${totalCleaned} files removed`);
    console.log('✨ Data folder cleaned!\n');
}

main();
