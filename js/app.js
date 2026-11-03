(function () {
  var V = window.VJT, esc = V.esc;
  var state = { matches: [], settings: {}, events: {}, cat: 'ALL', demo: false };
  var OPENING = new Date('2026-11-06T20:00:00+07:00').getTime();
  var view = document.getElementById('view');

  /* ---------- data ---------- */
  function load() {
    if (!V.sb) { state.matches = window.VJT_SEED.slice(); state.demo = true; return Promise.resolve(); }
    return Promise.all([
      V.sb.from('matches').select('*').order('kickoff'),
      V.sb.from('settings').select('*')
    ]).then(function (r) {
      if (r[0].error) throw r[0].error;
      state.matches = r[0].data; state.demo = false;
      (r[1].data || []).forEach(function (s) { state.settings[s.key] = s.value; });
    }).catch(function () { state.matches = window.VJT_SEED.slice(); state.demo = true; state.err = true; });
  }
  function loadEvents(id) {
    if (!V.sb || String(id).indexOf('seed-') === 0) return Promise.resolve([]);
    return V.sb.from('match_events').select('*').eq('match_id', id).order('created_at').then(function (r) { return r.data || []; });
  }
  function byId(id) { return state.matches.filter(function (m) { return String(m.id) === String(id); })[0]; }
  function live() { return state.matches.filter(function (m) { return m.status === 'LIVE' || m.status === 'HALF TIME'; }); }

  /* ---------- komponen ---------- */
  function pill(m) {
    var c = m.status === 'LIVE' ? 'LIVE' : m.status === 'HALF TIME' ? 'HT' : m.status === 'FULL TIME' ? 'FT' : '';
    return '<span class="pill ' + c + '">' + (V.STATUS_LABEL[m.status] || m.status) + '</span>';
  }
  function phaseLabel(m) { var g = V.matchGroup(m); return g ? 'Grup ' + g : m.phase; }
  function card(m) {
    var started = m.status !== 'UPCOMING' && m.status !== 'POSTPONED' && m.status !== 'CANCELLED';
    var mid = started ? '<div class="score">' + m.score_a + ' - ' + m.score_b + '</div>' : '<div class="score when">' + V.fmtTime(m.kickoff).replace(' WIB', '') + '</div>';
    var clock = m.status === 'LIVE' ? ' <b data-clock="' + esc(m.id) + '">' + V.fmtClock(V.elapsed(m, Date.now())) + '</b>' : '';
    return '<a class="card" href="#/match/' + esc(m.id) + '"><div class="meta"><span><span class="chip alt" style="background:#e8eeec">' +
      (V.CATEGORY_LABEL[m.category] || m.category) + '</span> ' + esc(phaseLabel(m)) + clock + '</span>' + pill(m) + '</div>' +
      '<div class="row"><div class="t">' + esc(m.team_a) + '</div>' + mid + '<div class="t">' + esc(m.team_b) + '</div></div></a>';
  }
  function demoNote() {
    return state.demo ? '<div class="note">Skor langsung belum aktif. Yang tampil adalah jadwal resmi dari kalender panitia. Panitia perlu menyelesaikan pengaturan Supabase (lihat README).</div>' : '';
  }
  function list(arr, emptyMsg) {
    return arr.length ? arr.map(card).join('') : '<div class="empty">' + emptyMsg + '</div>';
  }

  /* ---------- halaman ---------- */
  function home() {
    var now = Date.now();
    var lv = live();
    var up = state.matches.filter(function (m) { return m.status === 'UPCOMING' && new Date(m.kickoff).getTime() > now - 3600e3; }).slice(0, 5);
    var done = state.matches.filter(function (m) { return m.status === 'FULL TIME'; }).slice(-5).reverse();
    var cd = now < OPENING ? '<div class="count" id="cd"></div>' : '';
    var sa = state.settings.saweria_url;
    view.innerHTML =
      '<div class="hero"><div class="wrap"><div class="tag">Villa Indah Pulo Timaha, 6 sampai 28 November 2026</div>' +
      '<h1>Villind<br><b>Cup II</b> 2026</h1><div class="cats"><span class="chip">U-11</span><span class="chip alt">U-15</span></div>' + cd +
      '<a class="btn" href="#/jadwal">Lihat jadwal</a> <a class="btn ghost" href="#/live">Tonton live</a></div></div>' +
      '<section><div class="wrap">' + demoNote() + '<h2>Sedang berlangsung</h2>' + list(lv, 'Belum ada pertandingan live') + '</div></section>' +
      '<section><div class="wrap"><h2>Pertandingan berikutnya <a href="#/jadwal">Semua jadwal</a></h2>' + list(up, 'Belum ada jadwal berikutnya') + '</div></section>' +
      '<section><div class="wrap"><h2>Hasil terbaru <a href="#/klasemen">Klasemen</a></h2>' + list(done, 'Belum ada pertandingan selesai') + '</div></section>' +
      (sa ? '<section><div class="wrap"><h2>Dukung turnamen</h2><a class="btn dark" href="' + esc(sa) + '" target="_blank" rel="noopener">Dukung lewat Saweria</a></div></section>' : '');
    tickCountdown();
  }
  function tickCountdown() {
    var el = document.getElementById('cd'); if (!el) return;
    var d = Math.max(0, OPENING - Date.now()), s = Math.floor(d / 1000);
    var p = [['Hari', Math.floor(s / 86400)], ['Jam', Math.floor(s % 86400 / 3600)], ['Menit', Math.floor(s % 3600 / 60)], ['Detik', s % 60]];
    el.innerHTML = p.map(function (x) { return '<div><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('');
  }
  function jadwal() {
    var arr = state.matches.filter(function (m) { return state.cat === 'ALL' || m.category === state.cat; });
    var html = '', last = '';
    arr.forEach(function (m) {
      var k = V.dayKey(m.kickoff);
      if (k !== last) { html += '<div class="day">' + V.fmtDate(m.kickoff) + '</div>'; last = k; }
      html += card(m);
    });
    view.innerHTML = '<section><div class="wrap">' + demoNote() + '<h2>Jadwal pertandingan</h2>' + tabs() +
      (html || '<div class="empty">Belum ada pertandingan</div>') +
      '<div class="note">Semi Final (27 November) dan Final (28 November) akan muncul setelah babak grup selesai.</div></div></section>';
  }
  function tabs() {
    return '<div class="tabs">' + ['ALL', 'U11', 'U15'].map(function (c) {
      return '<button data-cat="' + c + '" aria-pressed="' + (state.cat === c) + '">' + (c === 'ALL' ? 'Semua' : V.CATEGORY_LABEL[c]) + '</button>';
    }).join('') + '</div>';
  }
  function klasemen() {
    var cats = state.cat === 'ALL' ? ['U11', 'U15'] : [state.cat];
    var html = cats.map(function (c) {
      return ['A', 'B'].map(function (g) {
        var rows = V.standings(state.matches, c, g);
        return '<h3 class="disp" style="font-size:1.3rem;margin:14px 0 6px;color:var(--gold)">' + V.CATEGORY_LABEL[c] + ' - Grup ' + g + '</h3>' +
          '<table class="st"><thead><tr><th>#</th><th>Tim</th><th>Main</th><th>M</th><th>S</th><th>K</th><th>GM</th><th>GK</th><th>SG</th><th>Poin</th></tr></thead><tbody>' +
          rows.map(function (r, i) {
            return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.team) + '</td><td>' + r.p + '</td><td>' + r.w + '</td><td>' + r.d + '</td><td>' + r.l + '</td><td>' + r.gf + '</td><td>' + r.ga + '</td><td>' + r.gd + '</td><td>' + r.pts + '</td></tr>';
          }).join('') + '</tbody></table>';
      }).join('');
    }).join('');
    view.innerHTML = '<section><div class="wrap">' + demoNote() + '<h2>Klasemen</h2>' + tabs() + html +
      '<p style="margin-top:10px;font-size:.8rem;color:var(--mut)">Urutan: poin, selisih gol (SG), lalu gol memasukkan (GM). Hanya pertandingan Babak Grup berstatus Full Time yang dihitung. Menang 3 poin, seri 1 poin.</p></div></section>';
  }
  function livePage() {
    var lv = live(), yt = V.youtubeEmbed(state.settings.youtube_url);
    view.innerHTML = '<section><div class="wrap">' + demoNote() + '<h2>Live</h2>' +
      (lv.length ? lv.map(card).join('') : '<div class="empty">BELUM ADA PERTANDINGAN LIVE</div>') +
      '<h2 style="margin-top:18px">Siaran langsung</h2>' +
      (yt ? '<iframe class="yt" src="' + yt + '" title="Siaran langsung YouTube" allowfullscreen loading="lazy"></iframe>' : '<div class="empty">Siaran YouTube belum diatur oleh panitia</div>') + '</div></section>';
  }
  function matchPage(id) {
    var m = byId(id);
    if (!m) { view.innerHTML = '<section><div class="wrap"><div class="empty">Pertandingan tidak ditemukan</div></div></section>'; return; }
    var started = m.status !== 'UPCOMING';
    view.innerHTML = '<section><div class="wrap"><a href="#/jadwal" style="font-weight:700;color:var(--g2)">&larr; Kembali ke jadwal</a><div style="height:10px"></div>' +
      '<div class="board"><div>' + (V.CATEGORY_LABEL[m.category] || m.category) + ' &middot; ' + esc(phaseLabel(m)) + '</div>' +
      '<div class="grid"><div class="tm">' + esc(m.team_a) + '</div><div class="big">' + (started ? m.score_a + '-' + m.score_b : 'VS') + '</div><div class="tm">' + esc(m.team_b) + '</div></div>' +
      (m.status === 'LIVE' ? '<div class="clock" data-clock="' + esc(m.id) + '">' + V.fmtClock(V.elapsed(m, Date.now())) + '</div>' : '') +
      '<div>' + pill(m) + '</div><div style="margin-top:8px;font-size:.9rem;opacity:.85">' + V.fmtDate(m.kickoff) + ', ' + V.fmtTime(m.kickoff) + '</div></div>' +
      '<h3 class="disp" style="font-size:1.3rem;color:var(--g1);margin-bottom:8px">Kejadian pertandingan</h3><div id="evs"><div class="empty">Memuat...</div></div></div></section>';
    loadEvents(id).then(function (evs) {
      var el = document.getElementById('evs'); if (!el) return;
      var goals = evs.filter(function (e) { return e.type === 'goal' || e.type === 'card'; });
      // gol yang dibatalkan (undo) dihapus dari daftar oleh operator, jadi cukup tampilkan sisanya
      el.innerHTML = goals.length ? goals.map(function (e) {
        var t = e.team === 'A' ? m.team_a : m.team_b;
        var lbl = e.type === 'card' ? (e.note || 'Kartu') : 'Gol';
        return '<div class="ev"><b>' + (e.minute != null ? e.minute + "'" : '') + '</b> ' + lbl + ' - ' + esc(t) + (e.player ? ' (' + esc(e.player) + ')' : '') + '</div>';
      }).join('') : '<div class="empty">Belum ada kejadian tercatat</div>';
    });
  }
  function info() {
    var s = state.settings, yt = s.youtube_url, sa = s.saweria_url, wa = s.whatsapp;
    view.innerHTML = '<section><div class="wrap"><h2>Info</h2>' +
      '<div class="panel"><h3>Tentang</h3><p>Villind Cup II 2026 adalah turnamen sepak bola antar RT di Villa Indah Pulo Timaha untuk kategori U-11 dan U-15. Babak grup 6 sampai 21 November, Semi Final 27 November, Final 28 November 2026. Semua pertandingan mulai pukul 20.00 WIB.</p></div>' +
      '<div class="panel"><h3>Tautan</h3>' +
      (yt ? '<p><a class="btn dark" href="' + esc(yt) + '" target="_blank" rel="noopener">Buka YouTube</a></p><br>' : '') +
      (sa ? '<p><a class="btn" href="' + esc(sa) + '" target="_blank" rel="noopener">Dukung lewat Saweria</a></p><br>' : '') +
      (wa ? '<p><a class="btn dark" href="https://wa.me/' + esc(String(wa).replace(/\D/g, '')) + '" target="_blank" rel="noopener">Hubungi panitia (WhatsApp)</a></p>' : '') +
      (!yt && !sa && !wa ? '<p>Tautan akan muncul setelah panitia mengisinya.</p>' : '') + '</div>' +
      '<div class="panel"><h3>Panitia</h3><p><a href="admin.html">Masuk panitia</a></p></div></div></section>';
  }

  /* ---------- router ---------- */
  function route(keepScroll) {
    var h = (location.hash || '#/').slice(2), p = h.split('/');
    var name = p[0] || 'home';
    document.querySelectorAll('nav.bot a').forEach(function (a) { a.classList.toggle('on', a.dataset.r === (name === 'match' ? 'jadwal' : name)); });
    ({ home: home, jadwal: jadwal, klasemen: klasemen, live: livePage, info: info, match: function () { matchPage(p[1]); } }[name] || home)();
    if (!keepScroll) window.scrollTo(0, 0);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]');
    if (b) { state.cat = b.dataset.cat; route(true); }
  });
  window.addEventListener('hashchange', route);
  setInterval(function () {
    tickCountdown();
    document.querySelectorAll('[data-clock]').forEach(function (el) {
      var m = byId(el.dataset.clock); if (m) el.textContent = V.fmtClock(V.elapsed(m, Date.now()));
    });
  }, 1000);

  load().then(function () {
    var c = state.settings.whatsapp;
    if (c) document.getElementById('foot-contact').innerHTML = '<br>WhatsApp panitia: ' + esc(c);
    route();
    if (V.sb) {
      var refresh = function () { load().then(function () { route(true); }); };
      V.sb.channel('vjt-public').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'match_events' }, refresh).subscribe();
    }
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
