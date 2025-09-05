#!/usr/bin/env node
/**
 * Pre-publish verification script for MCP NextGen Financial Intelligence
 * Validates package readiness before NPM publication
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🔍 Pre-publish verification starting...\n');

// Track all checks
const checks = [];
let allPassed = true;

function runCheck(name, checkFn) {
    try {
        console.log(`⏳ ${name}...`);
        checkFn();
        console.log(`✅ ${name} - PASSED\n`);
        checks.push({ name, status: 'PASSED' });
    } catch (error) {
        console.error(`❌ ${name} - FAILED`);
        console.error(`   Error: ${error.message}\n`);
        checks.push({ name, status: 'FAILED', error: error.message });
        allPassed = false;
    }
}

// Check 1: Verify package.json integrity
runCheck('Package.json validation', () => {
    const packagePath = join(projectRoot, 'package.json');
    if (!existsSync(packagePath)) {
        throw new Error('package.json not found');
    }
    
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
    
    // Verify essential fields
    const requiredFields = ['name', 'version', 'description', 'main', 'license'];
    for (const field of requiredFields) {
        if (!pkg[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }
    
    // Verify version format
    if (!/^\d+\.\d+\.\d+/.test(pkg.version)) {
        throw new Error(`Invalid version format: ${pkg.version}`);
    }
    
    console.log(`   Package: ${pkg.name}@${pkg.version}`);
});

// Check 2: Build verification
runCheck('Build verification', () => {
    // Check if build directory exists
    const buildPath = join(projectRoot, 'build');
    if (!existsSync(buildPath)) {
        throw new Error('Build directory not found. Run "npm run build"');
    }
    
    // Check main entry points exist
    const mainFile = join(projectRoot, 'build/index.js');
    if (!existsSync(mainFile)) {
        throw new Error('Main entry point build/index.js not found');
    }
    
    // Verify executable permissions
    try {
        execSync('test -x build/index.js', { cwd: projectRoot });
        execSync('test -x build/http-server.js', { cwd: projectRoot });
    } catch {
        throw new Error('Build files missing executable permissions');
    }
    
    console.log('   Build artifacts verified and executable');
});

// Check 3: TypeScript compilation
runCheck('TypeScript compilation', () => {
    try {
        const output = execSync('npm run build', { 
            cwd: projectRoot, 
            encoding: 'utf8',
            stdio: 'pipe'
        });
        console.log('   TypeScript compilation successful');
    } catch (error) {
        throw new Error(`TypeScript compilation failed: ${error.message}`);
    }
});

// Check 4: Package content simulation
runCheck('Package content verification', () => {
    try {
        const output = execSync('npm pack --dry-run', { 
            cwd: projectRoot, 
            encoding: 'utf8',
            stdio: 'pipe'
        });
        
        // Extract package size from output
        const sizeMatch = output.match(/package size:\s+([0-9.]+\s+[kMG]?B)/);
        if (sizeMatch) {
            console.log(`   Package size: ${sizeMatch[1]}`);
        }
        
        // Check file count
        const fileMatch = output.match(/total files:\s+(\d+)/);
        if (fileMatch) {
            console.log(`   Total files: ${fileMatch[1]}`);
        }
        
    } catch (error) {
        throw new Error(`Package simulation failed: ${error.message}`);
    }
});

// Check 5: Essential files verification
runCheck('Essential files verification', () => {
    const essentialFiles = [
        'README.md',
        'CHANGELOG.md',
        'LICENSE',
        '.env.example',
        '.npmignore'
    ];
    
    for (const file of essentialFiles) {
        if (!existsSync(join(projectRoot, file))) {
            throw new Error(`Essential file missing: ${file}`);
        }
    }
    
    console.log(`   All ${essentialFiles.length} essential files present`);
});

// Check 6: Security validation
runCheck('Security validation', () => {
    const packagePath = join(projectRoot, 'package.json');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
    
    // Check for sensitive patterns in package.json
    const sensitivePatterns = [
        /sk-[a-zA-Z0-9]{20,}/, // OpenAI API keys
        /mongodb:\/\/.*:.*@/, // MongoDB credentials
        /@.*\.local/, // Local development URLs
    ];
    
    const pkgString = JSON.stringify(pkg, null, 2);
    for (const pattern of sensitivePatterns) {
        if (pattern.test(pkgString)) {
            throw new Error('Sensitive data detected in package.json');
        }
    }
    
    console.log('   No sensitive data detected in package metadata');
});

// Check 7: NPM authentication
runCheck('NPM authentication', () => {
    try {
        const whoami = execSync('npm whoami', { 
            encoding: 'utf8',
            stdio: 'pipe'
        }).trim();
        console.log(`   Logged in as: ${whoami}`);
    } catch (error) {
        throw new Error('Not logged into NPM. Run "npm login"');
    }
});

// Final results
console.log('📊 Pre-publish verification results:\n');
checks.forEach(check => {
    const status = check.status === 'PASSED' ? '✅' : '❌';
    console.log(`${status} ${check.name}`);
    if (check.error) {
        console.log(`   ${check.error}`);
    }
});

console.log(`\n🎯 Overall result: ${allPassed ? '✅ READY FOR PUBLICATION' : '❌ ISSUES NEED FIXING'}`);

if (allPassed) {
    console.log('\n🚀 Your package is ready for NPM publication!');
    console.log('   Run: npm publish');
} else {
    console.log('\n🛠️  Please fix the issues above before publishing.');
    process.exit(1);
}