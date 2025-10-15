// Force no-cache script for development
(function() {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    // Override fetch to prevent caching
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('/src/')) {
        const url = new URL(args[0], location.origin);
        url.searchParams.set('nocache', Date.now().toString());
        args[0] = url.toString();
      }
      return originalFetch.apply(this, args);
    };

    // Add reload button functionality
    window.addEventListener('keydown', function(e) {
      if (e.key === 'F5' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        console.log('🔄 Force reload without cache...');
        location.reload(true);
      }
    });

    console.log('🚫 No-cache mode activated for development');
  }
})();