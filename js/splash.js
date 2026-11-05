// Splash pembuka: video + suara. Muncul sekali per kunjungan (per sesi browser).
(function () {
  var root = document.documentElement;
  var box = document.getElementById('splash');
  if (!box || root.classList.contains('no-splash')) return;
  var v = document.getElementById('splash-video');
  var start = document.getElementById('splash-start');
  var skip = document.getElementById('splash-skip');
  var done = false;
  root.classList.add('splash-on');

  function finish() {
    if (done) return; done = true;
    try { sessionStorage.setItem('vjt-splash', '1'); } catch (e) {}
    try { v.pause(); } catch (e) {}
    box.classList.add('out');
    root.classList.remove('splash-on');
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 700);
  }
  function play() {
    v.muted = false; v.volume = 1;
    var p = v.play();
    if (p && p.then) {
      p.then(function () { start.hidden = true; skip.hidden = false; })
       .catch(function () { start.hidden = false; skip.hidden = true; }); // browser blokir suara -> minta ketukan
    }
  }
  start.addEventListener('click', function () { start.hidden = true; play(); });
  skip.addEventListener('click', finish);
  v.addEventListener('ended', finish);
  v.addEventListener('error', finish);   // video gagal dimuat -> langsung masuk
  setTimeout(function () { if (!done && v.readyState === 0 && start.hidden) finish(); }, 8000); // jaringan terlalu lambat
  play();
})();
