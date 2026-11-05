(function () {
  var V = window.VJT, sb = V.sb, esc = V.esc;
  var $ = function (id) { return document.getElementById(id); };
  var matches = [], cur = null, user = null, tick = null;

  function msg(t, ok) { $('msg').innerHTML = t ? '<div class="msg ' + (ok ? 'ok' : 'err') + '">' + esc(t) + '</div>' : ''; if (t && ok) setTimeout(function () { $('msg').innerHTML = ''; }, 3000); }
  function fail(e) { msg('Gagal: ' + (e && e.message ? e.message : e) + '. Coba lagi. Jika terus gagal, keluar lalu masuk kembali.'); }
  function log(action, detail) { sb.from('activity_logs').insert({ actor: user && user.email, action: action, detail: detail }).then(function () {}); }

  if (!sb) { $('nocfg').classList.remove('hide'); return; }

  function show(loggedIn) { $('login').classList.toggle('hide', loggedIn); $('app').classList.toggle('hide', !loggedIn); }
  sb.auth.getSession().then(function (r) { user = r.data.session && r.data.session.user; show(!!user); if (user) boot(); });
  $('login').addEventListener('submit', function (e) {
    e.preventDefault();
    sb.auth.signInWithPassword({ email: $('em').value.trim(), password: $('pw').value }).then(function (r) {
      if (r.error) {
        var t = (r.error.message || '').toLowerCase();
        if (t.indexOf('not confirmed') > -1) return msg('Email belum dikonfirmasi. Di Supabase: Authentication, Users, klik akun ini, lalu pilih Confirm email (atau buat ulang akun dengan Auto Confirm User dicentang).');
        if (t.indexOf('invalid login') > -1) return msg('Email belum terdaftar di Supabase, atau kata sandi salah. Cek di Supabase: Authentication, Users.');
        return msg('Gagal masuk: ' + r.error.message);
      }
      user = r.data.user; msg(''); show(true); boot();
    });
  });
  $('out').onclick = function () { sb.auth.signOut().then(function () { user = null; show(false); }); };

  function boot() { reload(); loadSettings(); sb.channel('vjt-admin').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, function () { reload(true); }).subscribe(); }
  function reload(keep) {
    sb.from('matches').select('*').order('kickoff').then(function (r) {
      if (r.error) return fail(r.error);
      matches = r.data;
      var prev = $('sel').value;
      $('sel').innerHTML = '<option value="">- pilih -</option>' + matches.map(function (m) {
        return '<option value="' + m.id + '">' + V.fmtDate(m.kickoff).replace(/^\w+, /, '') + ' ' + V.fmtTime(m.kickoff).replace(' WIB', '') + ' | ' + V.CATEGORY_LABEL[m.category] + (V.matchGroup(m) ? ' Grup ' + V.matchGroup(m) : '') + ' | ' + esc(m.team_a) + ' vs ' + esc(m.team_b) + ' | ' + m.status + '</option>';
      }).join('');
      if (keep || prev) $('sel').value = prev;
      pick();
    });
  }
  function pick() {
    cur = matches.filter(function (m) { return m.id === $('sel').value; })[0] || null;
    $('ctl').classList.toggle('hide', !cur);
    if (!cur) return;
    $('b-meta').textContent = V.CATEGORY_LABEL[cur.category] + ' - ' + (V.matchGroup(cur) ? 'Grup ' + V.matchGroup(cur) : cur.phase);
    $('b-a').textContent = cur.team_a; $('b-b').textContent = cur.team_b;
    $('ga').textContent = '+1 ' + cur.team_a; $('gb').textContent = '+1 ' + cur.team_b;
    $('b-score').textContent = cur.score_a + '-' + cur.score_b;
    $('b-status').textContent = V.STATUS_LABEL[cur.status] + (cur.period ? ' - Babak ' + cur.period : '');
    clearInterval(tick);
    var c = function () { $('b-clock').textContent = V.fmtClock(V.elapsed(cur, Date.now())); }; c(); tick = setInterval(c, 1000);
    $('fa').textContent = 'Pelanggaran ' + cur.team_a; $('fb').textContent = 'Pelanggaran ' + cur.team_b;
    $('ya').textContent = 'Kuning ' + cur.team_a; $('yb').textContent = 'Kuning ' + cur.team_b;
    $('ra').textContent = 'Merah ' + cur.team_a; $('rb').textContent = 'Merah ' + cur.team_b;
    loadHist(); loadStats(); drawStatsState();
  }
  $('sel').onchange = pick;

  /* ---------- pelanggaran, kartu, statistik ---------- */
  function statsOf(evs, period) {
    var s = { A: { foul: 0, foulP: 0, y: 0, r: 0 }, B: { foul: 0, foulP: 0, y: 0, r: 0 } };
    evs.forEach(function (e) {
      var t = s[e.team]; if (!t) return;
      if (e.type === 'foul') { t.foul++; if (!e.period || e.period === period) t.foulP++; }
      if (e.type === 'card') { if (/merah/i.test(e.note || '')) t.r++; else t.y++; }
    });
    return s;
  }
  function loadStats() {
    if (!cur) return;
    var id = cur.id;
    sb.from('match_events').select('type,team,period,note').eq('match_id', id).in('type', ['foul', 'card']).then(function (r) {
      if (!cur || cur.id !== id) return;
      var s = statsOf(r.data || [], cur.period || 1), p = cur.period || 1;
      function box(k) {
        var t = s[k];
        return '<div class="dbox"><b>' + esc(k === 'A' ? cur.team_a : cur.team_b) + '</b>' +
          '<div class="drow"><span>Pelanggaran babak ' + p + '</span><i class="' + (t.foulP >= 5 ? 'hot' : '') + '">' + t.foulP + '</i></div>' +
          '<div class="drow"><span>Pelanggaran total</span><i>' + t.foul + '</i></div>' +
          '<div class="drow"><span>Kartu kuning</span><i class="yc">' + t.y + '</i></div>' +
          '<div class="drow"><span>Kartu merah</span><i class="rc">' + t.r + '</i></div></div>';
      }
      $('disc').innerHTML = box('A') + box('B');
    });
  }
  function discipline(type, team, label) {
    if (cur.status !== 'LIVE' && !(type === 'card' && cur.status === 'HALF TIME')) return msg('Pertandingan harus berstatus LIVE. Tekan "Mulai" dulu.');
    var min = $('mn').value !== '' ? parseInt($('mn').value, 10) : Math.floor(V.elapsed(cur, Date.now()) / 60) + 1;
    addEvent({ type: type, team: team, player: $('pl').value || null, minute: min, period: cur.period || null, note: label }).then(function (r) {
      if (r.error) return fail(r.error);
      log('match:' + cur.id, label + ' ' + (team === 'A' ? cur.team_a : cur.team_b));
      $('pl').value = ''; $('mn').value = ''; msg(label + ' tersimpan', true); loadHist(); loadStats();
    });
  }
  $('fa').onclick = function () { discipline('foul', 'A', 'Pelanggaran'); };
  $('fb').onclick = function () { discipline('foul', 'B', 'Pelanggaran'); };
  $('ya').onclick = function () { discipline('card', 'A', 'Kartu Kuning'); };
  $('yb').onclick = function () { discipline('card', 'B', 'Kartu Kuning'); };
  $('ra').onclick = function () { discipline('card', 'A', 'Kartu Merah'); };
  $('rb').onclick = function () { discipline('card', 'B', 'Kartu Merah'); };
  $('undo-d').onclick = function () {
    sb.from('match_events').select('*').eq('match_id', cur.id).in('type', ['foul', 'card']).order('created_at', { ascending: false }).limit(1).then(function (r) {
      var g = r.data && r.data[0];
      if (!g) return msg('Tidak ada pelanggaran atau kartu untuk dibatalkan.');
      var who = g.team === 'A' ? cur.team_a : cur.team_b;
      if (!confirm('Batalkan ' + (g.note || g.type) + ' untuk ' + who + '?')) return;
      sb.from('match_events').delete().eq('id', g.id).then(function (d) {
        if (d.error) return fail(d.error);
        addEvent({ type: 'undo', team: g.team, note: (g.note || g.type) + ' dibatalkan: ' + who }).then(function () { loadHist(); loadStats(); });
      });
    });
  };

  /* ---------- statistik layar penuh ---------- */
  var setS = {};
  function saveSetting(rows, done) {
    sb.from('settings').upsert(rows).then(function (r) { if (r.error) return fail(r.error); rows.forEach(function (x) { setS[x.key] = x.value; }); drawStatsState(); if (done) done(); });
  }
  function drawStatsState() {
    var on = setS.stats_visible === '1', m = matches.filter(function (x) { return x.id === setS.stats_match; })[0];
    $('stats-state').textContent = on ? 'TAMPIL di layar: ' + (m ? m.team_a + ' vs ' + m.team_b : '(pertandingan terpilih)') : 'Disembunyikan';
    $('stats-state').style.color = on ? '#0a7a3e' : '#555';
  }
  $('stats-show').onclick = function () { saveSetting([{ key: 'stats_match', value: cur.id }, { key: 'stats_visible', value: '1' }], function () { msg('Statistik ditampilkan di layar', true); }); };
  $('stats-hide').onclick = function () { saveSetting([{ key: 'stats_visible', value: '0' }], function () { msg('Statistik disembunyikan', true); }); };

  function loadHist() {
    sb.from('match_events').select('*').eq('match_id', cur.id).order('created_at', { ascending: false }).limit(30).then(function (r) {
      $('hist').innerHTML = (r.data || []).length ? r.data.map(function (e) {
        var t = new Date(e.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' });
        return '<div class="ev">' + t + ' - ' + esc(e.note || e.type) + (e.player ? ' (' + esc(e.player) + ')' : '') + ((e.type === 'card' || e.type === 'foul') && e.team ? ' - ' + esc(e.team === 'A' ? cur.team_a : cur.team_b) : '') + (e.minute != null ? " menit " + e.minute : '') + ' <small>oleh ' + esc(e.created_by || '') + '</small></div>';
      }).join('') : '<div class="empty">Belum ada riwayat</div>';
    });
  }
  function addEvent(o) { o.match_id = cur.id; o.created_by = user.email; return sb.from('match_events').insert(o).then(function (r) { return r; }); }
  function update(patch, evNote) {
    patch.updated_at = new Date().toISOString();
    return sb.from('matches').update(patch).eq('id', cur.id).select().then(function (r) {
      if (r.error) throw r.error;
      Object.assign(cur, r.data[0]);
      if (evNote) addEvent({ type: 'status', note: evNote });
      log('match:' + cur.id, evNote || JSON.stringify(patch));
      reload(true); msg('Tersimpan', true);
    }).catch(function (e) { fail(e); return false; });
  }

  function goal(team) {
    if (cur.status !== 'LIVE') return msg('Pertandingan harus berstatus LIVE untuk menambah gol. Tekan "Mulai" dulu.');
    var min = $('mn').value !== '' ? parseInt($('mn').value, 10) : Math.floor(V.elapsed(cur, Date.now()) / 60) + 1;
    var patch = team === 'A' ? { score_a: cur.score_a + 1 } : { score_b: cur.score_b + 1 };
    update(patch).then(function (ok) {
      if (ok === false) return;
      addEvent({ type: 'goal', team: team, player: $('pl').value || null, minute: min, note: 'Gol ' + (team === 'A' ? cur.team_a : cur.team_b) });
      $('pl').value = ''; $('mn').value = '';
    });
  }
  $('ga').onclick = function () { goal('A'); };
  $('gb').onclick = function () { goal('B'); };
  $('undo').onclick = function () {
    sb.from('match_events').select('*').eq('match_id', cur.id).eq('type', 'goal').order('created_at', { ascending: false }).limit(1).then(function (r) {
      var g = r.data && r.data[0];
      if (!g) return msg('Tidak ada gol untuk dibatalkan.');
      if (!confirm('Batalkan gol terakhir (' + (g.note || '') + ')?')) return;
      var patch = g.team === 'A' ? { score_a: Math.max(0, cur.score_a - 1) } : { score_b: Math.max(0, cur.score_b - 1) };
      update(patch).then(function (ok) {
        if (ok === false) return;
        sb.from('match_events').delete().eq('id', g.id).then(function () {
          addEvent({ type: 'undo', team: g.team, note: 'Gol dibatalkan: ' + (g.note || '') }).then(loadHist);
        });
      });
    });
  };

  $('st-start').onclick = function () { if (cur.status === 'LIVE') return msg('Pertandingan sudah berjalan.'); update({ status: 'LIVE', period: 1, clock_base: 0, clock_started_at: new Date().toISOString() }, 'Pertandingan dimulai (Babak 1)'); };
  $('st-ht').onclick = function () { if (cur.status !== 'LIVE') return msg('Hanya bisa saat LIVE.'); update({ status: 'HALF TIME', clock_base: V.elapsed(cur, Date.now()), clock_started_at: null }, 'Half Time'); };
  $('st-2').onclick = function () { if (cur.status !== 'HALF TIME') return msg('Babak 2 dimulai setelah Half Time.'); update({ status: 'LIVE', period: 2, clock_started_at: new Date().toISOString() }, 'Babak 2 dimulai'); };
  $('st-ft').onclick = function () { if (cur.status !== 'LIVE' && cur.status !== 'HALF TIME') return msg('Pertandingan belum berjalan.'); if (!confirm('Akhiri pertandingan dengan skor ' + cur.score_a + '-' + cur.score_b + '?')) return; update({ status: 'FULL TIME', clock_base: V.elapsed(cur, Date.now()), clock_started_at: null }, 'Full Time ' + cur.score_a + '-' + cur.score_b); };
  $('st-pp').onclick = function () { if (confirm('Tunda pertandingan ini?')) update({ status: 'POSTPONED', clock_started_at: null }, 'Pertandingan ditunda'); };
  $('st-reset').onclick = function () { if (confirm('Kembalikan ke Akan Datang? Skor dan timer akan di-nol-kan.')) update({ status: 'UPCOMING', period: 0, score_a: 0, score_b: 0, clock_base: 0, clock_started_at: null }, 'Dikembalikan ke Akan Datang (skor di-reset)'); };

  $('n-add').onclick = function () {
    if (!$('n-a').value.trim() || !$('n-b').value.trim() || !$('n-t').value) return msg('Isi nama kedua tim dan tanggal jam.');
    sb.from('matches').insert({ category: $('n-cat').value, phase: $('n-ph').value, team_a: $('n-a').value.trim(), team_b: $('n-b').value.trim(), kickoff: $('n-t').value + ':00+07:00' }).then(function (r) {
      if (r.error) return fail(r.error);
      log('match:add', $('n-a').value + ' vs ' + $('n-b').value); ['n-a', 'n-b', 'n-t'].forEach(function (i) { $(i).value = ''; }); reload(true); msg('Pertandingan ditambahkan', true);
    });
  };

  function loadSettings() { sb.from('settings').select('*').then(function (r) { (r.data || []).forEach(function (s) { var m = { youtube_url: 's-yt', saweria_url: 's-sa', whatsapp: 's-wa' }[s.key]; if (m) $(m).value = s.value || ''; setS[s.key] = s.value; }); drawStatsState(); }); }
  $('s-save').onclick = function () {
    var rows = [{ key: 'youtube_url', value: $('s-yt').value.trim() }, { key: 'saweria_url', value: $('s-sa').value.trim() }, { key: 'whatsapp', value: $('s-wa').value.trim() }];
    sb.from('settings').upsert(rows).then(function (r) { if (r.error) return fail(r.error); log('settings', 'pengaturan diubah'); msg('Pengaturan tersimpan', true); });
  };
})();
