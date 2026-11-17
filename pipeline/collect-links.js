// Paste into the browser console on a past-paper listing page you have open (expand the series you want
// first). Copies every PDF link on the page to the clipboard, one per line, for pipeline/import_links.py.
// It only reads links already on your screen; it makes no requests of its own.
(() => {
  const urls = [...new Set([...document.querySelectorAll('a[href]')]
    .map((a) => a.href)
    .filter((h) => /\.pdf(\?|#|$)/i.test(h)))];
  copy(urls.join('\n'));
  console.log(`Copied ${urls.length} PDF links.`);
})();
