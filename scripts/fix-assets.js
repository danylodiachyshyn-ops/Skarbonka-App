/**
 * Quick script to generate placeholder assets for Expo
 * Run: node scripts/fix-assets.js
 */

const fs = require('fs');
const path = require('path');

// Brand color: #1F96D3 (deep blue)
const BRAND_COLOR = '#1F96D3';

// Create a simple SVG and convert to PNG using sips (macOS)
const assetsDir = path.join(__dirname, '../assets');

// For now, just create valid 1x1 PNGs that won't cause CRC errors
// User should replace with proper images later
const createPlaceholderPNG = (filename, size = 1024) => {
  const filepath = path.join(assetsDir, filename);
  
  // Use sips to create a solid color image
  const { execSync } = require('child_process');
  
  try {
    // Create a temporary colored image
    const tempFile = path.join(assetsDir, 'temp.png');
    
    // Create using sips with a color
    execSync(`sips -z ${size} ${size} --setProperty format png /System/Library/CoreServices/DefaultDesktop.heic --out "${tempFile}" 2>/dev/null`, { stdio: 'ignore' });
    
    // If that worked, copy it
    if (fs.existsSync(tempFile)) {
      fs.copyFileSync(tempFile, filepath);
      fs.unlinkSync(tempFile);
      console.log(`✓ Created ${filename} (${size}x${size})`);
      return true;
    }
  } catch (e) {
    // Fallback: create minimal valid PNG
    console.warn(`Could not create ${filename} with sips, using fallback`);
  }
  
  // Minimal valid PNG (1x1 transparent) - won't cause CRC error
  const minimalPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x06, 0x00, 0x00, 0x00, // bit depth, color type, etc.
    0x1F, 0x15, 0xC4, 0x89, // CRC
    0x00, 0x00, 0x00, 0x0A, // IDAT chunk length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // compressed data
    0x0D, 0x0A, 0x2D, 0xB4, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
  
  fs.writeFileSync(filepath, minimalPNG);
  console.log(`✓ Created minimal ${filename}`);
  return true;
};

console.log('Fixing asset files...\n');

createPlaceholderPNG('icon.png', 1024);
createPlaceholderPNG('adaptive-icon.png', 1024);
createPlaceholderPNG('splash.png', 1284); // Will be scaled
createPlaceholderPNG('favicon.png', 512);

console.log('\n✓ Assets fixed!');
console.log('⚠️  Note: These are minimal placeholders. Replace with proper images:');
console.log('   - icon.png: 1024x1024 (app icon)');
console.log('   - splash.png: 1284x2778 (splash screen)');
console.log('   - adaptive-icon.png: 1024x1024 (Android)');
