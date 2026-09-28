const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, '../client/public');

async function generate() {
  const svgPath = path.join(publicDir, 'favicon.svg');
  const svg = fs.readFileSync(svgPath);

  // 1. pwa-192x192.png (High quality rich notification icon)
  await sharp(svg)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  // 2. pwa-512x512.png
  await sharp(svg)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // 3. pwa-maskable-512x512.png
  await sharp(svg)
    .resize(380, 380, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 66, bottom: 66, left: 66, right: 66,
      background: '#09090b'
    })
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');

  // 4. apple-touch-icon.png
  await sharp(svg)
    .resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 20, bottom: 20, left: 20, right: 20,
      background: '#09090b'
    })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 5. Android status bar badges: 96x96 and 72x72
  // Android Status Bar requires a pure white silhouette on a 100% transparent background
  const badgeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 48 46">
  <path fill="#ffffff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
</svg>`;

  await sharp(Buffer.from(badgeSvg))
    .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'badge-96x96.png'));
  console.log('Generated badge-96x96.png');

  await sharp(Buffer.from(badgeSvg))
    .resize(72, 72, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'badge-72x72.png'));
  console.log('Generated badge-72x72.png');
}

generate().then(() => console.log('All icons generated successfully!')).catch(console.error);
