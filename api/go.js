// API redirect for WhatsApp - bypasses PWA scope
// WhatsApp opens /api/ in browser (not PWA), then redirects to flash sale page

export default function handler(req, res) {
    const page = req.query.page || 'flash-sale';
    const baseUrl = 'https://azzahra-fashion-muslim.vercel.app';

    // Return HTML with JavaScript redirect + meta refresh fallback
    // This ensures the page opens in the browser, then navigates to flash sale
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta http-equiv="refresh" content="0;url=${baseUrl}/?page=${page}">
      <title>Azzahra Fashion Muslim</title>
      <style>
        body { 
          display: flex; align-items: center; justify-content: center; 
          min-height: 100vh; margin: 0; background: #0F172A; color: #EDD686;
          font-family: sans-serif;
        }
      </style>
    </head>
    <body>
      <p>Membuka Flash Sale...</p>
      <script>window.location.replace("${baseUrl}/?page=${page}");</script>
    </body>
    </html>
  `);
}
