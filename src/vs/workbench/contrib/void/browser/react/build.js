/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { execSync } from 'child_process';
import { spawn } from 'cross-spawn'
// Added lines below
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function doesPathExist(filePath) {
	try {
		const stats = fs.statSync(filePath);

		return stats.isFile();
	} catch (err) {
		if (err.code === 'ENOENT') {
			return false;
		}
		throw err;
	}
}

/*

This function finds `globalDesiredPath` given `localDesiredPath` and `currentPath`

Diagram:

...basePath/
└── void/
	├── ...currentPath/ (defined globally)
	└── ...localDesiredPath/ (defined locally)

*/
function findDesiredPathFromLocalPath(localDesiredPath, currentPath) {

	// walk upwards until currentPath + localDesiredPath exists
	while (!doesPathExist(path.join(currentPath, localDesiredPath))) {
		const parentDir = path.dirname(currentPath);

		if (parentDir === currentPath) {
			return undefined;
		}

		currentPath = parentDir;
	}

	// return the `globallyDesiredPath`
	const globalDesiredPath = path.join(currentPath, localDesiredPath)
	return globalDesiredPath;
}

// hack to refresh styles automatically
function saveStylesFile() {
	setTimeout(() => {
		try {
			const pathToCssFile = findDesiredPathFromLocalPath('./src/vs/workbench/contrib/void/browser/react/src2/styles.css', __dirname);

			if (pathToCssFile === undefined) {
				console.error('[scope-tailwind] Error finding styles.css');
				return;
			}

			// Or re-write with the same content:
			const content = fs.readFileSync(pathToCssFile, 'utf8');
			fs.writeFileSync(pathToCssFile, content, 'utf8');
			console.log('[scope-tailwind] Force-saved styles.css');
		} catch (err) {
			console.error('[scope-tailwind] Error saving styles.css:', err);
		}
	}, 6000);
}

const args = process.argv.slice(2);
const isWatch = args.includes('--watch') || args.includes('-w');

if (isWatch) {
	// this just builds it if it doesn't exist instead of waiting for the watcher to trigger
	// Check if src2/ exists; if not, do an initial scope-tailwind build
	if (!fs.existsSync('src2')) {
		try {
			console.log('🔨 Running initial scope-tailwind build to create src2 folder...');
			execSync(
				'npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-"',
				{ stdio: 'inherit' }
			);
			console.log('✅ src2/ created successfully.');
		} catch (err) {
			console.error('❌ Error running initial scope-tailwind build:', err);
			process.exit(1);
		}
	}

	// Watch mode
	const scopeTailwindWatcher = spawn('npx', [
		'nodemon',
		'--watch', 'src',
		'--ext', 'ts,tsx,css',
		'--exec',
		'npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-"'
	]);

	const tsupWatcher = spawn('npx', [
		'tsup',
		'--watch'
	]);

	scopeTailwindWatcher.stdout.on('data', (data) => {
		console.log(`[scope-tailwind] ${data}`);
		// If the output mentions "styles.css", trigger the save:
		if (data.toString().includes('styles.css')) {
			saveStylesFile();
		}
	});

	scopeTailwindWatcher.stderr.on('data', (data) => {
		console.error(`[scope-tailwind] ${data}`);
	});

	// Handle tsup watcher output
	tsupWatcher.stdout.on('data', (data) => {
		console.log(`[tsup] ${data}`);
	});

	tsupWatcher.stderr.on('data', (data) => {
		console.error(`[tsup] ${data}`);
	});

	// Handle process termination
	process.on('SIGINT', () => {
		scopeTailwindWatcher.kill();
		tsupWatcher.kill();
		process.exit();
	});

	console.log('🔄 Watchers started! Press Ctrl+C to stop both watchers.');
} else {
	// Build mode
	console.log('📦 Building...');

	// Ensure src/styles.css exists
	const srcStylesPath = path.join(__dirname, 'src', 'styles.css');
	if (!fs.existsSync(srcStylesPath)) {
		console.log('⚠️  src/styles.css not found, creating empty file...');
		fs.writeFileSync(srcStylesPath, '/* Empty styles file */\n', 'utf8');
	}

	// Run scope-tailwind once - with error handling
	try {
		execSync('npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-"', { stdio: 'inherit' });
		console.log('✅ scope-tailwind completed');
	} catch (error) {
		console.error('⚠️  scope-tailwind failed, but continuing build...');
		console.error(error.message);
		// Ensure src2 directory exists even if scope-tailwind failed
		const src2Dir = path.join(__dirname, 'src2');
		if (!fs.existsSync(src2Dir)) {
			fs.mkdirSync(src2Dir, { recursive: true });
		}
		// Copy src to src2 if it doesn't exist
		const srcDir = path.join(__dirname, 'src');
		if (fs.existsSync(srcDir) && !fs.existsSync(path.join(src2Dir, 'styles.css'))) {
			if (fs.existsSync(srcStylesPath)) {
				fs.copyFileSync(srcStylesPath, path.join(src2Dir, 'styles.css'));
			}
		}
	}

	// Run tsup once
	try {
		execSync('npx tsup', { stdio: 'inherit' });
		console.log('✅ tsup completed');
	} catch (error) {
		console.error('❌ tsup failed:');
		console.error(error.message);
		process.exit(1);
	}

	// Copy bundles to out/ directory where Electron loads them
	const reactOutDir = path.join(__dirname, 'out');
	// Find the void root directory (go up from react/ to void/)
	// react/ -> browser/ -> void/ -> contrib/ -> workbench/ -> vs/ -> src/ -> void/
	// __dirname is: .../void/src/vs/workbench/contrib/void/browser/react
	// We need: .../void/out/vs/workbench/contrib/void/browser/react/out
	// Go up 8 levels: react -> browser -> void -> contrib -> workbench -> vs -> src -> void
	let voidRoot = path.resolve(__dirname, '../../../../../../..');
	const globalOutDir = path.join(voidRoot, 'out', 'vs', 'workbench', 'contrib', 'void', 'browser', 'react', 'out');
	
	if (path.basename(voidRoot) === 'void') {
		console.log(`📋 Copying bundles to ${globalOutDir}...`);
		
		// Copy all bundles from react/out to global out/
		const bundles = ['sidebar-tsx', 'shared-browser-tsx', 'void-settings-tsx', 'void-onboarding', 'void-tooltip', 'void-editor-widgets-tsx', 'quick-edit-tsx', 'diff'];
		
		for (const bundle of bundles) {
			const srcFile = path.join(reactOutDir, bundle, 'index.js');
			const destDir = path.join(globalOutDir, bundle);
			const destFile = path.join(destDir, 'index.js');
			
			if (fs.existsSync(srcFile)) {
				if (!fs.existsSync(destDir)) {
					fs.mkdirSync(destDir, { recursive: true });
				}
				fs.copyFileSync(srcFile, destFile);
				console.log(`  ✓ Copied ${bundle}/index.js`);
			}
		}
		console.log('✅ Bundles copied to out/');
	} else {
		console.warn(`⚠️  Could not find global out/ directory at ${globalOutDir}, skipping copy`);
	}

	console.log('✅ Build complete!');
}
