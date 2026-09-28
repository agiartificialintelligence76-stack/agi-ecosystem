// Share pages (/share/…) only exist for link previews: send people on to the right part of the site.
// (A script file, because the site's security rules block inline scripts. Crawlers don't run it, so they see the preview.)
(function () {
  var go = document.documentElement.getAttribute('data-go') || '/';
  if (!/^\/(?!\/)/.test(go)) go = '/';                  // only ever our own pages
  location.replace(go);
})();
