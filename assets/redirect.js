/* Legacy URL shim.
   Pages that were renamed keep their old address working, with query string and
   hash preserved. The target is named on the script tag:
     <script src="assets/redirect.js" data-to="species.html"></script> */
(function () {
  var me = document.currentScript;
  var to = (me && me.getAttribute('data-to')) || 'index.html';
  try {
    location.replace(to + location.search + location.hash);
  } catch (e) {
    location.href = to;
  }
})();
