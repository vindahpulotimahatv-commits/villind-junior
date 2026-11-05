/* Susunan pemain + lapangan beranimasi (halaman detail pertandingan) */
(function () {
  var V = window.VJT, esc = V.esc;
  var FORMS = {
    11: ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-1-4-1'],
    9: ['3-3-2', '3-2-3', '2-4-2', '4-3-1'],
    7: ['2-3-1', '3-2-1', '2-2-2', '3-1-2']
  };
  var NAMES = ['Raka', 'Dimas', 'Fajar', 'Bayu', 'Rizky', 'Arka', 'Naufal', 'Zidan', 'Alif', 'Kenzo', 'Farel', 'Dafa', 'Rafi', 'Gilang', 'Aldi', 'Reza', 'Haikal', 'Kevin', 'Bima', 'Satria'];
  var cache = {}, sel = {}, played = {}, timer = null;

  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function sizeFor(n) { return n >= 11 ? 11 : n >= 9 ? 9 : n >= 7 ? 7 : n; }
  function formsFor(n) {
    if (FORMS[n]) return FORMS[n];
    var m = n - 1; if (m <= 0) return ['GK']; if (m <= 2) return [String(m)];
    if (m <= 4) return [Math.ceil(m / 2) + '-' + Math.floor(m / 2)];
    var f = Math.max(1, Math.round(m * .25)), d = Math.max(1, Math.round(m * .4));
    return [d + '-' + (m - d - f) + '-' + f];
  }
  function sortPlayers(a) {
    return a.slice().sort(function (x, y) {
      var nx = parseInt(x.no, 10), ny = parseInt(y.no, 10);
      if (isNaN(nx)) nx = 999; if (isNaN(ny)) ny = 999;
      return nx - ny || String(x.name).localeCompare(String(y.name));
    });
  }
  function samplePlayers(team, cat) {
    var r = rng(hash(team + cat)), pool = NAMES.slice(), out = [], total = (cat === 'U15' ? 11 : 9) + 3;
    for (var i = 0; i < total; i++) out.push({ no: String(i + 1), name: pool.splice(Math.floor(r() * pool.length), 1)[0] });
    return out;
  }
  function loadTeam(team, cat) {
    var key = cat + '|' + team;
    if (cache[key]) return Promise.resolve(cache[key]);
    var done = function (list, sample) { cache[key] = { list: sortPlayers(list), sample: sample }; return cache[key]; };
    if (!V.sb) return Promise.resolve(done(samplePlayers(team, cat), true));
    return Promise.resolve(V.sb.from('team_players').select('no,name').eq('team', team).eq('category', cat)).then(function (r) {
      if (!r || r.error || !r.data || !r.data.length) return done(samplePlayers(team, cat), true);
      return done(r.data, false);
    }).catch(function () { return done(samplePlayers(team, cat), true); });
  }

  // Koordinat 0-100 (x kiri-kanan, y atas-bawah). A menyerang ke atas (bawah lapangan), B kebalikannya.
  function layout(n, form, side) {
    var lines = form.split('-').map(Number).filter(function (x) { return x > 0; });
    if (lines.reduce(function (a, b) { return a + b; }, 0) !== n - 1) lines = [n - 1].filter(function (x) { return x > 0; });
    var pts = [{ x: 50, y: 92, pos: 'GK' }], k = lines.length;
    lines.forEach(function (c, i) {
      var y = k === 1 ? 70 : 80 - i * (25 / (k - 1));
      var sp = c === 2 ? 34 : Math.min(24, 76 / Math.max(1, c - 1));
      var pos = i === 0 ? 'DF' : (i === k - 1 ? 'FW' : 'MF');
      if (k === 1) pos = 'MF';
      for (var j = 0; j < c; j++) pts.push({ x: c === 1 ? 50 : 50 + (j - (c - 1) / 2) * sp, y: y, pos: pos });
    });
    if (side === 'B') pts.forEach(function (p) { p.x = 100 - p.x; p.y = 100 - p.y; });
    return pts;
  }
  function short(nm) { var s = String(nm || '').trim().split(/\s+/)[0] || ''; return s.length > 9 ? s.slice(0, 8) + '.' : s; }

  function render(el, m) {
    if (!el) return;
    el.innerHTML = '<div class="lu"><div class="lu-top"><h3 class="disp">SUSUNAN PEMAIN</h3></div><div class="empty">Memuat susunan pemain...</div></div>';
    Promise.all([loadTeam(m.team_a, m.category), loadTeam(m.team_b, m.category)]).then(function (r) {
      if (!document.body.contains(el)) return;
      build(el, m, { A: r[0], B: r[1] });
    });
  }

  function build(el, m, data) {
    var rr = rng(hash(String(m.id))), T = {};
    ['A', 'B'].forEach(function (s) {
      var list = data[s].list, size = sizeFor(list.length), fs = formsFor(size);
      var pick = fs[Math.floor(rr() * fs.length)];
      var saved = sel[m.id] && sel[m.id][s];
      T[s] = { name: s === 'A' ? m.team_a : m.team_b, sample: data[s].sample, start: list.slice(0, size), bench: list.slice(size), forms: fs, form: fs.indexOf(saved) > -1 ? saved : pick, size: size };
    });
    var first = !played[m.id]; played[m.id] = 1;

    function bar(s) {
      var t = T[s];
      return '<div class="lu-bar ' + s.toLowerCase() + '">' + V.logoImg(t.name, 'xs') + '<b>' + esc(t.name) + '</b>' +
        (t.sample ? '<em class="lu-sample">CONTOH</em>' : '') + '<div class="lu-chips" data-t="' + s + '"></div></div>';
    }
    el.innerHTML = '<div class="lu">' +
      '<div class="lu-top"><h3 class="disp">SUSUNAN PEMAIN</h3><button class="lu-shuf" type="button">&#128256; ACAK FORMASI</button></div>' +
      bar('B') +
      '<div class="lu-pitch"><div class="lu-grass"></div><div class="lu-mk"><i class="bd"></i><i class="hw"></i><i class="cc"></i><i class="cd"></i>' +
      '<i class="pb t"></i><i class="gb t"></i><i class="pb b"></i><i class="gb b"></i><i class="gl t"></i><i class="gl b"></i></div>' +
      '<div class="lu-dots"></div><div class="lu-ball"></div></div>' +
      bar('A') +
      '<div class="lu-lists"><div class="lu-list" data-l="A"></div><div class="lu-list" data-l="B"></div></div>' +
      (T.A.sample || T.B.sample ? '<div class="lu-note">Data pemain belum diisi panitia, jadi yang tampil adalah susunan contoh. Susunan asli otomatis muncul setelah daftar pemain diisi dari panel panitia.</div>' : '') +
      '</div>';

    var dots = el.querySelector('.lu-dots'), ball = el.querySelector('.lu-ball'), els = { A: [], B: [] };
    ['A', 'B'].forEach(function (s) {
      T[s].start.forEach(function (p, i) {
        var d = document.createElement('div');
        d.className = 'lu-p ' + s.toLowerCase() + (i === 0 ? ' gk' : '') + (first ? ' pre' : '');
        d.style.left = '50%'; d.style.top = '50%';
        d.innerHTML = '<span class="c"><b>' + esc(p.no || '') + '</b></span><span class="nm">' + esc(short(p.name)) + '</span>';
        dots.appendChild(d); els[s].push(d);
      });
    });

    function place(delayBase) {
      ['A', 'B'].forEach(function (s) {
        var pts = layout(T[s].size, T[s].form, s);
        T[s].pts = pts;
        els[s].forEach(function (d, i) {
          var p = pts[i]; if (!p) return;
          d.style.transitionDelay = (delayBase + i * 45) + 'ms';
          d.style.left = p.x + '%'; d.style.top = p.y + '%';
        });
      });
    }
    function drawUi() {
      ['A', 'B'].forEach(function (s) {
        var t = T[s];
        el.querySelector('.lu-chips[data-t="' + s + '"]').innerHTML = t.forms.length > 1 ? t.forms.map(function (f) {
          return '<button type="button" class="lu-chip" data-t="' + s + '" data-f="' + f + '" aria-pressed="' + (f === t.form) + '">' + f + '</button>';
        }).join('') : '<span class="lu-chip on">' + t.form + '</span>';
        var pts = layout(t.size, t.form, s);
        var row = function (p, i, bench) {
          return '<div class="lu-row"><b>' + esc(p.no || '-') + '</b><span>' + esc(p.name) + '</span><i>' + (bench ? 'CAD' : pts[i].pos) + '</i></div>';
        };
        el.querySelector('.lu-list[data-l="' + s + '"]').innerHTML =
          '<div class="lu-lh">' + V.logoImg(t.name, 'xs') + '<b>' + esc(t.name) + '</b><small>' + t.form + '</small></div>' +
          t.start.map(function (p, i) { return row(p, i, false); }).join('') +
          (t.bench.length ? '<div class="lu-sub">CADANGAN</div>' + t.bench.map(function (p) { return row(p, 0, true); }).join('') : '');
      });
    }
    drawUi();

    // animasi masuk: pemain keluar dari titik tengah ke posisi formasi
    if (first) {
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        place(80);
        ['A', 'B'].forEach(function (s) { els[s].forEach(function (d, i) { setTimeout(function () { d.classList.remove('pre'); }, 80 + i * 45); }); });
      }); });
    } else { place(0); }

    // bola berpindah antar pemain
    if (timer) clearInterval(timer);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function toBall(d) { ball.style.left = d.style.left; ball.style.top = d.style.top; }
    ball.style.left = '50%'; ball.style.top = '50%';
    if (!reduce) {
      var turn = 'A';
      timer = setInterval(function () {
        if (!document.body.contains(el)) { clearInterval(timer); timer = null; return; }
        turn = Math.random() < .7 ? turn : (turn === 'A' ? 'B' : 'A');
        var arr = els[turn], d = arr[1 + Math.floor(Math.random() * Math.max(1, arr.length - 1))] || arr[0];
        if (!d) return;
        toBall(d); d.classList.add('hit'); setTimeout(function () { d.classList.remove('hit'); }, 800);
      }, 1500);
    }

    el.onclick = function (e) {
      var c = e.target.closest('.lu-chip[data-f]'), sh = e.target.closest('.lu-shuf');
      if (c) { T[c.dataset.t].form = c.dataset.f; }
      else if (sh) {
        ['A', 'B'].forEach(function (s) {
          var o = T[s].forms.filter(function (f) { return f !== T[s].form; });
          if (o.length) T[s].form = o[Math.floor(Math.random() * o.length)];
        });
      } else return;
      sel[m.id] = { A: T.A.form, B: T.B.form };
      drawUi(); place(0);
      setTimeout(function () { var d = els.A[0]; if (d) toBall(d); }, 400);
    };
  }

  V.renderLineup = render;
})();
