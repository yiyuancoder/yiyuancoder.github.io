const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Traverses subdirectories and processes the 'cocos-js' folder
 */
function processSubdirectories() {
    const rootDir = __dirname;
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });

    entries.forEach(entry => {
        if (entry.isDirectory() && entry.name !== '.git' && entry.name !== 'node_modules') {
            const subdirName = entry.name;
            const subdirPath = path.join(rootDir, subdirName);

            // 1. Process files
            processCocosJsFolder(subdirPath);

            // 2. Commit changes for this directory
            commitFolder(subdirName);
        }
    });

    execSync(`git push`);
}

/**
 * Commits changes in the specified folder if there are any
 */
function commitFolder(folderName) {
    try {
        const status = execSync(`git status --short "${folderName}"`).toString().trim();
        if (status) {
            console.log(`  Changes detected in ${folderName}, committing...`);
            execSync(`git add "${folderName}"`);
            execSync(`git commit -m "${folderName}"`);
        } else {
            // console.log(`  No changes to commit for ${folderName}.`);
        }
    } catch (err) {
        // Git commit returns non-zero if there's nothing to commit, though 'status' check should prevent this
        console.log(`  Skip commit for ${folderName} (or no changes detected by git).`);
    }
}

/**
 * Processes 'cocos-js' folder in a given subdirectory
 */
function processCocosJsFolder(subdirPath) {
    const cocosJsPath = path.join(subdirPath, 'cocos-js');
    if (!fs.existsSync(cocosJsPath)) return;

    console.log(`Checking: ${cocosJsPath}`);

    const files = fs.readdirSync(cocosJsPath);
    const filesToRename = files.filter(file => file.startsWith('_') && file.endsWith('.js'));

    if (filesToRename.length === 0) {
        // console.log(`  No files starting with '_' found.`);
        return;
    }

    const renameMap = [];

    // Rename files and prepare replacement map
    filesToRename.forEach(file => {
        const oldPath = path.join(cocosJsPath, file);
        const newName = file.substring(1);
        const newPath = path.join(cocosJsPath, newName);

        console.log(`  Renaming file: ${file} -> ${newName}`);
        try {
            fs.renameSync(oldPath, newPath);

            // Add filename to map
            renameMap.push({
                old: file,
                new: newName
            });

            // Also handle name without extension in case it's referenced as a module name
            const oldNoExt = file.replace(/\.js$/, '');
            const newNoExt = newName.replace(/\.js$/, '');
            if (oldNoExt !== file) {
                renameMap.push({
                    old: oldNoExt,
                    new: newNoExt
                });
            }
        } catch (err) {
            console.error(`  Failed to rename ${file}: ${err.message}`);
        }
    });

    // Sort mappings by length (longest first) to avoid partial replacement issues (e.g., replacement of '_a' before '_abc')
    renameMap.sort((a, b) => b.old.length - a.old.length);

    // Update references in ALL .js files in the cocos-js folder
    // Re-read files because some might have been renamed
    const allJsFiles = fs.readdirSync(cocosJsPath).filter(file => file.endsWith('.js'));

    allJsFiles.forEach(jsFile => {
        const filePath = path.join(cocosJsPath, jsFile);
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        renameMap.forEach(mapping => {
            if (content.includes(mapping.old)) {
                // Use a global replacement for all occurrences
                const escapedOld = mapping.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedOld, 'g');
                content = content.replace(regex, mapping.new);
                modified = true;
            }
        });

        if (modified) {
            console.log(`  Updated references in: ${jsFile}`);
            fs.writeFileSync(filePath, content, 'utf8');
        }
    });
}

console.log('Starting Cocos-JS underscore cleanup...');
processSubdirectories();
console.log('Cleanup finished!');