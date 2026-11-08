/* Motion bootstrap.
   Adds the `js` class so the reveal layer can animate, and removes it again if
   story.js never initialises, so the page is never left blank.
   Kept in a file (not inline) so every page can run under script-src 'self'. */
(function () {
  var root = document.documentElement;
  root.className += ' js';
  setTimeout(function () {
    if (!window.__storyReady) {
      root.className = root.className.replace(/\bjs\b/, '');
    }
  }, 6000);
})();
