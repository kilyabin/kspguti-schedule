#!/usr/bin/env node

/**
 * Post-build script for Next.js standalone mode
 * Copies public and .next/static files to .next/standalone directory
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const STANDALONE_DIR = path.join(ROOT_DIR, '.next', 'standalone');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const NEXT_STATIC_DIR = path.join(ROOT_DIR, '.next', 'static');
const STANDALONE_PUBLIC_DIR = path.join(STANDALONE_DIR, 'public');
const STANDALONE_NEXT_STATIC_DIR = path.join(STANDALONE_DIR, '.next', 'static');

// Helper function to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`Source directory does not exist: ${src}`);
    return false;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  return true;
}

// Helper function to remove directory recursively
function removeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('Post-build: Setting up standalone directory...');

// Check if standalone directory exists
if (!fs.existsSync(STANDALONE_DIR)) {
  console.error('Error: .next/standalone directory not found!');
  console.error('Make sure output: "standalone" is set in next.config.js');
  process.exit(1);
}

// Copy public directory
if (fs.existsSync(PUBLIC_DIR)) {
  console.log(`Copying ${PUBLIC_DIR} to ${STANDALONE_PUBLIC_DIR}...`);
  removeDir(STANDALONE_PUBLIC_DIR);
  if (copyDir(PUBLIC_DIR, STANDALONE_PUBLIC_DIR)) {
    console.log('✓ Public directory copied');
  } else {
    console.error('✗ Failed to copy public directory');
  }
} else {
  console.warn('Warning: public directory not found');
}

// Copy .next/static directory
if (fs.existsSync(NEXT_STATIC_DIR)) {
  console.log(`Copying ${NEXT_STATIC_DIR} to ${STANDALONE_NEXT_STATIC_DIR}...`);
  removeDir(STANDALONE_NEXT_STATIC_DIR);
  if (copyDir(NEXT_STATIC_DIR, STANDALONE_NEXT_STATIC_DIR)) {
    console.log('✓ .next/static directory copied');
  } else {
    console.error('✗ Failed to copy .next/static directory');
  }
} else {
  console.error('Error: .next/static directory not found!');
  process.exit(1);
}

console.log('Post-build: Done!');
