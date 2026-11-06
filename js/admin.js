(function () {
  var V = window.VJT, sb = V.sb, esc = V.esc;
  var $ = function (id) { return document.getElementById(id); };
  var matches = [], cur = null, user = null, tick = null;

  var toastTimer = null;
  function toast(t, ok) {
    var el = document.getElementById('vjt-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'vjt-toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99999;max-width:92vw;width:460px;padding:14px 16px;border-radius:12px;font-weight:800;font-size:.95rem;line-height:1.35;box-shadow:0 10px 30px #000a;text-align:center;pointer-events:none';
      document.body.appendChild(el);
    }
    clearTimeout(toastTimer);
    if (!t) { el.style.display = 'none'; return; }
    el.textContent = t;
    el.style.background = ok ? '#14532d' : '#8d1d1a';
    el.style.color = '#fff';
    el.style.display = 'block';
    toastTimer = setTimeout(function () { el.style.display = 'none'; }, ok ? 2500 : 8000);
  }
  function msg(t, ok) { $('msg').innerHTML = t ? '<div class="msg ' + (ok ? 'ok' : 'err') + '">' + esc(t) + '</div>' : ''; toast(t, ok); if (t && ok) setTimeout(function () { $('msg').innerHTML = ''; }, 3000); }
  function fail(e) {
    var m = e && e.message ? e.message : String(e);
    var hint = /check constraint|match_events_type_check|period/i.test(m) ? ' PENYEBAB: database belum diperbarui. Jalankan file supabase/update-pelanggaran-kartu.sql di Supabase SQL Editor.' : ' Coba lagi. Jika terus gagal, keluar lalu masuk kembali.';
    msg('Gagal: ' + m + '.' + hint);
  }
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

  function boot() { reload(); loadSettings(); loadNewsAdmin(); V.loadTeamLogos().then(function () { buildTeamList(); showTeam(); }); sb.channel('vjt-admin').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, function () { reload(true); }).subscribe(); }
  function reload(keep) {
    sb.from('matches').select('*').order('kickoff').then(function (r) {
      if (r.error) return fail(r.error);
      matches = r.data;
      var prev = $('sel').value;
      $('sel').innerHTML = '<option value="">- pilih -</option>' + matches.map(function (m) {
        return '<option value="' + m.id + '">' + V.fmtDate(m.kickoff).replace(/^\w+, /, '') + ' ' + V.fmtTime(m.kickoff).replace(' WIB', '') + ' | ' + V.CATEGORY_LABEL[m.category] + (V.matchGroup(m) ? ' Grup ' + V.matchGroup(m) : '') + ' | ' + esc(m.team_a) + ' vs ' + esc(m.team_b) + ' | ' + m.status + '</option>';
      }).join('');
      if (keep || prev) $('sel').value = prev;
      buildTeamList();
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
    loadHist(); loadStats(); drawStatsState(); fillPlayerList();
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
    if (!cur) return msg('Pilih pertandingan terlebih dahulu.');
    if (cur.status !== 'LIVE' && cur.status !== 'HALF TIME') return msg('Pertandingan harus berstatus LIVE atau HALF TIME. Tekan "Mulai" dulu.');
    var matchId = cur.id;
    var min = $('mn').value !== '' ? parseInt($('mn').value, 10) : Math.floor(V.elapsed(cur, Date.now()) / 60) + 1;
    addEvent({ type: type, team: team, player: $('pl').value || null, minute: min, period: cur.period || null, note: label }, matchId).then(function (r) {
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

  var histAll = false, histRows = [];
  function drawHist() {
    var box = $('hist');
    if (!histRows.length) { box.innerHTML = '<div class="empty">Belum ada riwayat</div>'; return; }
    var rows = histAll ? histRows : histRows.slice(0, 5);
    box.innerHTML = rows.map(function (e) {
      var t = new Date(e.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
      return '<div class="ev" style="padding:6px 9px;font-size:.82rem">' + t + ' - ' + esc(e.note || e.type) + (e.player ? ' (' + esc(e.player) + ')' : '') + ((e.type === 'card' || e.type === 'foul') && e.team ? ' - ' + esc(e.team === 'A' ? cur.team_a : cur.team_b) : '') + (e.minute != null ? ' menit ' + e.minute : '') + '</div>';
    }).join('') + (histRows.length > 5 ? '<button type="button" id="hist-more" class="btn dark" style="width:100%;min-height:38px;margin-top:4px">' + (histAll ? 'Sembunyikan (tampilkan 5 terbaru)' : 'Lihat semua (' + histRows.length + ')') + '</button>' : '');
    var mb = $('hist-more'); if (mb) mb.onclick = function () { histAll = !histAll; drawHist(); };
  }
  function loadHist() {
    var id = cur.id;
    sb.from('match_events').select('*').eq('match_id', id).order('created_at', { ascending: false }).limit(30).then(function (r) {
      if (!cur || cur.id !== id) return;
      histRows = r.data || []; drawHist();
    });
  }
  function addEvent(o, matchId) { o.match_id = matchId || (cur && cur.id); o.created_by = user && user.email; return sb.from('match_events').insert(o).then(function (r) { return r; }); }
  function update(patch, evNote) {
    patch.updated_at = new Date().toISOString();
    return sb.from('matches').update(patch).eq('id', cur.id).select().then(function (r) {
      if (r.error) throw r.error;
      Object.assign(cur, r.data[0]);
      if (evNote) addEvent({ type: 'status', note: evNote });
      log('match:' + cur.id, evNote || JSON.stringify(patch));
      reload(true); msg('Tersimpan', true); return true;
    }).catch(function (e) { fail(e); return false; });
  }

  function doGoal(team, player, minVal) {
    var matchId = cur.id;
    var min = minVal !== '' && minVal != null ? parseInt(minVal, 10) : Math.floor(V.elapsed(cur, Date.now()) / 60) + 1;
    var teamName = team === 'A' ? cur.team_a : cur.team_b;
    var patch = team === 'A' ? { score_a: cur.score_a + 1 } : { score_b: cur.score_b + 1 };
    update(patch).then(function (ok) {
      if (ok === false) return;
      addEvent({ type: 'goal', team: team, player: player || null, minute: min, note: 'Gol ' + teamName }, matchId).then(function (r) {
        if (r.error) return fail(r.error);
        $('pl').value = ''; $('mn').value = '';
        msg(player ? 'Gol ' + player + ' (' + teamName + ') tersimpan.' : 'Gol tersimpan (tanpa nama pencetak gol).', true);
        loadHist();
      });
    });
  }
  function goal(team) {
    if (!cur) return msg('Pilih pertandingan terlebih dahulu.');
    if (cur.status !== 'LIVE') return msg('Pertandingan harus berstatus LIVE untuk menambah gol. Tekan "Mulai" dulu.');
    if (document.getElementById('vjt-gm')) return;
    var teamName = team === 'A' ? cur.team_a : cur.team_b, category = cur.category, known = [];
    var ov = document.createElement('div'); ov.id = 'vjt-gm';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99998;background:#000c;display:flex;align-items:center;justify-content:center;padding:14px';
    var inp = 'width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid #405a78;background:#07172b;color:#fff;font-size:1rem;margin-top:4px';
    var bt = 'border:0;border-radius:8px;padding:13px;font-weight:900;font-size:1rem;cursor:pointer;';
    ov.innerHTML = '<div style="background:#102744;border:2px solid #e0c47c;border-radius:14px;padding:18px;width:100%;max-width:460px;max-height:92vh;overflow:auto;color:#fff">' +
      '<div style="font-size:.75rem;letter-spacing:.08em;color:#e0c47c;font-weight:900">GOL UNTUK</div>' +
      '<div style="font-size:1.4rem;font-weight:900;margin-bottom:10px">' + esc(teamName) + '</div>' +
      '<div id="gm-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px"></div>' +
      '<label style="font-weight:800;font-size:.85rem">Nama pencetak gol</label>' +
      '<input id="gm-name" autocomplete="off" placeholder="Ketik nama, atau tekan nama di atas" style="' + inp + '">' +
      '<label style="font-weight:800;font-size:.85rem;display:block;margin-top:10px">Nomor punggung (boleh kosong)</label>' +
      '<input id="gm-no" inputmode="numeric" placeholder="Contoh: 10" style="' + inp + '">' +
      '<div id="gm-err" style="color:#ffb4b4;font-weight:800;margin-top:8px;min-height:1em"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">' +
      '<button type="button" id="gm-ok" style="' + bt + 'background:#1b805c;color:#fff;grid-column:1/-1">Simpan gol</button>' +
      '<button type="button" id="gm-skip" style="' + bt + 'background:#e0c47c;color:#101a2a">Tanpa nama</button>' +
      '<button type="button" id="gm-cancel" style="' + bt + 'background:#85263a;color:#fff">Batal</button></div></div>';
    document.body.appendChild(ov);
    var g = function (id) { return document.getElementById(id); };
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    g('gm-name').value = $('pl').value || '';
    setTimeout(function () { g('gm-name').focus(); }, 50);
    sb.from('team_players').select('no,name').eq('category', category).eq('team', teamName).then(function (r) {
      if (r.error) return;
      known = (r.data || []).slice().sort(function (x, y) { var a = parseInt(x.no, 10), b = parseInt(y.no, 10); if (isNaN(a)) a = 999; if (isNaN(b)) b = 999; return a - b || x.name.localeCompare(y.name, 'id'); });
      g('gm-chips').innerHTML = known.length ? known.map(function (p, i) { return '<button type="button" data-i="' + i + '" style="border:1px solid #6c5d3e;background:#0a1a2e;color:#fff;border-radius:22px;padding:5px 12px 5px 5px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:7px">' + (V.playerPhoto(teamName, p.name) ? '<img src="' + V.playerPhoto(teamName, p.name) + '" alt="" style="width:30px;height:30px;border-radius:50%;object-fit:cover;pointer-events:none">' : '') + (p.no ? '#' + esc(p.no) + ' ' : '') + esc(p.name) + '</button>'; }).join('') : '<span style="color:#aebbd0;font-size:.85rem">Belum ada daftar pemain tim ini. Ketik nama baru di bawah, otomatis tersimpan.</span>';
    });
    g('gm-chips').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]'); if (!b) return;
      var p = known[parseInt(b.getAttribute('data-i'), 10)]; g('gm-name').value = p.name; g('gm-no').value = p.no || '';
    });
    g('gm-cancel').onclick = close;
    g('gm-skip').onclick = function () { close(); doGoal(team, null, $('mn').value); };
    function save() {
      var name = g('gm-name').value.replace(/\s+/g, ' ').trim(), no = g('gm-no').value.trim();
      if (!name) { g('gm-err').textContent = 'Nama pencetak gol belum diisi. Atau tekan "Tanpa nama".'; return; }
      g('gm-ok').disabled = true; g('gm-skip').disabled = true;
      var hit = known.filter(function (p) { return p.name.toLowerCase() === name.toLowerCase(); })[0];
      var finish = function () { close(); doGoal(team, name, $('mn').value); };
      if (hit) { name = hit.name; return finish(); }
      sb.from('team_players').insert({ team: teamName, category: category, no: no || null, name: name }).then(function (r) {
        if (r.error) toast('Gol tetap disimpan, tetapi nama belum masuk daftar pemain: ' + r.error.message, false); else fillPlayerList();
        finish();
      });
    }
    g('gm-ok').onclick = save;
    g('gm-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); });
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

  /* ---------- tim: logo dan pemain ---------- */
  var teamNames = [], teamSel = '', players = [], teamsReady = true;
  function tmMsg(t, ok) { $('tm-msg').innerHTML = t ? '<div class="msg ' + (ok ? 'ok' : 'err') + '">' + esc(t) + '</div>' : ''; if (t && ok) setTimeout(function () { $('tm-msg').innerHTML = ''; }, 3000); }
  function tmFail(e) {
    var t = (e && e.message) ? e.message : String(e);
    if (/relation|does not exist|schema cache|bucket|not found/i.test(t)) return tmMsg('Fitur ini belum aktif di database. Jalankan dulu file supabase/update-tim-pemain.sql di Supabase (SQL Editor), lalu muat ulang halaman ini.');
    tmMsg('Gagal: ' + t);
  }
  function buildTeamList() {
    var names = [];
    Object.keys(V.GROUPS).forEach(function (c) { Object.keys(V.GROUPS[c]).forEach(function (g) { V.GROUPS[c][g].forEach(function (n) { if (names.indexOf(n) < 0) names.push(n); }); }); });
    matches.forEach(function (m) { [m.team_a, m.team_b].forEach(function (n) { if (n && names.indexOf(n) < 0) names.push(n); }); });
    names.sort(function (a, b) { return a.localeCompare(b, 'id', { numeric: true }); });
    if (names.join('|') === teamNames.join('|') && $('tm-sel').options.length) return;
    teamNames = names;
    var keep = $('tm-sel').value;
    $('tm-sel').innerHTML = '<option value="">- pilih tim -</option>' + names.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
    if (keep) $('tm-sel').value = keep;
  }
  function showTeam() {
    teamSel = $('tm-sel').value;
    $('tm-box').classList.toggle('hide', !teamSel);
    if (!teamSel) return;
    $('tm-name').textContent = teamSel;
    var u = V.teamLogo(teamSel);
    $('tm-logo').style.visibility = u ? 'visible' : 'hidden';
    if (u) $('tm-logo').src = u;
    $('tm-logo-note').textContent = V.logoOverrides[V.nameKey(teamSel)] ? 'Logo hasil unggahan panitia.' : (u ? 'Logo bawaan.' : 'Belum ada logo.');
    $('tm-file').value = '';
    loadPlayers();
  }
  $('tm-sel').onchange = showTeam;
  $('tm-cat').onchange = loadPlayers;

  function slug(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tim'; }
  function shrink(file, max) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Gambar gagal diproses')); }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('File itu bukan gambar yang bisa dibaca. Pilih file PNG atau JPG.')); };
      img.src = url;
    });
  }
  $('tm-up').onclick = function () {
    var f = $('tm-file').files[0], name = teamSel;
    if (!name) return;
    if (!f) return tmMsg('Pilih gambar logo dulu.');
    tmMsg('Mengunggah logo...', true);
    shrink(f, 400).then(function (blob) {
      var path = 'team-' + slug(name) + '-' + Date.now() + '.png';
      return sb.storage.from('logos').upload(path, blob, { contentType: 'image/png', cacheControl: '31536000' }).then(function (r) {
        if (r.error) throw r.error;
        var url = sb.storage.from('logos').getPublicUrl(path).data.publicUrl;
        return sb.from('team_logos').upsert({ name: name, url: url, updated_at: new Date().toISOString() }).then(function (d) {
          if (d.error) throw d.error;
          V.logoOverrides[V.nameKey(name)] = url; log('team:logo', name); showTeam(); tmMsg('Logo ' + name + ' tersimpan', true);
        });
      });
    }).catch(tmFail);
  };
  $('tm-reset').onclick = function () {
    var name = teamSel;
    if (!name) return;
    if (!V.logoOverrides[V.nameKey(name)]) return tmMsg('Tim ini sudah memakai logo bawaan.');
    if (!confirm('Kembalikan ' + name + ' ke logo bawaan?')) return;
    sb.from('team_logos').delete().eq('name', name).then(function (r) {
      if (r.error) return tmFail(r.error);
      delete V.logoOverrides[V.nameKey(name)]; log('team:logo-reset', name); showTeam(); tmMsg('Logo dikembalikan ke bawaan', true);
    });
  };

  function sortPlayers(a) {
    return a.slice().sort(function (x, y) {
      var nx = parseInt(x.no, 10), ny = parseInt(y.no, 10);
      if (isNaN(nx) && isNaN(ny)) return x.name.localeCompare(y.name, 'id');
      if (isNaN(nx)) return 1; if (isNaN(ny)) return -1;
      return nx - ny || x.name.localeCompare(y.name, 'id');
    });
  }
  function drawPlayers() {
    $('tm-players').innerHTML = players.length ? sortPlayers(players).map(function (p) {
      return '<div class="prow"><span class="pn' + (p.no ? '' : ' none') + '">' + (p.no ? esc(p.no) : '-') + '</span>' + (V.playerPhoto($('tm-sel').value, p.name) ? '<img class="pface" src="' + V.playerPhoto($('tm-sel').value, p.name) + '" alt="">' : '') + '<span class="pt">' + esc(p.name) + '</span>' +
        '<button type="button" data-ed="' + esc(p.id) + '">Ubah</button><button type="button" class="del" data-del="' + esc(p.id) + '">Hapus</button></div>';
    }).join('') : '<div class="empty">Belum ada pemain untuk tim dan kategori ini</div>';
  }
  function loadPlayers() {
    var team = $('tm-sel').value, cat = $('tm-cat').value;
    if (!team) return;
    sb.from('team_players').select('*').eq('team', team).eq('category', cat).then(function (r) {
      if (r.error) { players = []; drawPlayers(); return tmFail(r.error); }
      players = r.data || []; drawPlayers();
    });
  }
  // "7 Raka", "10. Dimas", "#9 Fajar", "Budi" -> {no, name}
  function parsePlayers(text) {
    return String(text || '').split(/\r?\n/).map(function (l) { return l.replace(/^[\s\-*\u2022]+/, '').trim(); }).filter(Boolean).map(function (l) {
      var m = l.match(/^#?(\d{1,3})\s*[.\-):,]?\s+(.+)$/);
      if (m) return { no: m[1], name: m[2].trim() };
      if (/^#?\d{1,3}$/.test(l)) return { no: l.replace('#', ''), name: '#' + l.replace('#', '') };
      return { no: null, name: l };
    });
  }
  $('tm-add').onclick = function () {
    var team = $('tm-sel').value, cat = $('tm-cat').value;
    if (!team) return;
    var list = parsePlayers($('tm-bulk').value);
    if (!list.length) return tmMsg('Tempel nama pemain dulu (satu baris satu pemain).');
    var have = {}; players.forEach(function (p) { have[p.name.toLowerCase()] = 1; });
    var rows = [];
    list.forEach(function (p) { var k = p.name.toLowerCase(); if (have[k]) return; have[k] = 1; rows.push({ team: team, category: cat, no: p.no, name: p.name }); });
    if (!rows.length) return tmMsg('Semua nama itu sudah ada di daftar.');
    sb.from('team_players').insert(rows).then(function (r) {
      if (r.error) return tmFail(r.error);
      log('team:players', team + ' ' + cat + ' +' + rows.length); $('tm-bulk').value = ''; loadPlayers(); fillPlayerList();
      tmMsg(rows.length + ' pemain ditambahkan' + (list.length > rows.length ? ' (' + (list.length - rows.length) + ' nama sama dilewati)' : ''), true);
    });
  };
  $('tm-clear').onclick = function () {
    var team = $('tm-sel').value, cat = $('tm-cat').value;
    if (!team || !players.length) return tmMsg('Belum ada pemain untuk dihapus.');
    if (!confirm('Hapus SEMUA ' + players.length + ' pemain ' + team + ' (' + V.CATEGORY_LABEL[cat] + ')?')) return;
    sb.from('team_players').delete().eq('team', team).eq('category', cat).then(function (r) {
      if (r.error) return tmFail(r.error);
      log('team:players-clear', team + ' ' + cat); loadPlayers(); fillPlayerList(); tmMsg('Daftar pemain dikosongkan', true);
    });
  };
  $('tm-players').addEventListener('click', function (e) {
    var d = e.target.getAttribute('data-del'), ed = e.target.getAttribute('data-ed');
    var p = players.filter(function (x) { return x.id === (d || ed); })[0];
    if (!p) return;
    if (d) {
      if (!confirm('Hapus pemain ' + p.name + '?')) return;
      sb.from('team_players').delete().eq('id', p.id).then(function (r) { if (r.error) return tmFail(r.error); loadPlayers(); fillPlayerList(); });
    } else {
      var nm = prompt('Nama pemain:', p.name); if (nm === null) return; nm = nm.trim(); if (!nm) return tmMsg('Nama tidak boleh kosong.');
      var no = prompt('Nomor punggung (boleh kosong):', p.no || ''); if (no === null) return; no = no.trim();
      sb.from('team_players').update({ name: nm, no: no || null }).eq('id', p.id).then(function (r) { if (r.error) return tmFail(r.error); loadPlayers(); fillPlayerList(); });
    }
  });

  // Saran nama pemain di kolom "Pemain dan menit" (hanya pemain dari dua tim pertandingan yang dipilih).
  function fillPlayerList() {
    var dl = $('pl-list'); dl.innerHTML = '';
    if (!cur) return;
    var id = cur.id;
    sb.from('team_players').select('team,no,name').eq('category', cur.category).in('team', [cur.team_a, cur.team_b]).then(function (r) {
      if (r.error || !cur || cur.id !== id) return;
      dl.innerHTML = sortPlayers(r.data || []).map(function (p) {
        return '<option value="' + esc(p.name) + '" label="' + (p.no ? '#' + esc(p.no) + ' - ' : '') + esc(p.team) + '"></option>';
      }).join('');
    });
  }

  /* ---------- berita turnamen: memerlukan supabase/news.sql ---------- */
  function newsMessage(text, ok) { var el=$('news-admin-msg'); if(el){el.textContent=text;el.style.color=ok?'#80d8ad':'#f0a2aa';} }
  function loadNewsAdmin() {
    var box=$('news-admin-list'); if(!box)return;
    sb.from('news').select('*').order('created_at',{ascending:false}).limit(30).then(function(r){
      if(r.error){box.innerHTML='<div class="empty">Modul berita belum aktif. Jalankan file supabase/news.sql satu kali.</div>';return;}
      var rows=r.data||[];box.innerHTML=rows.length?rows.map(function(n){return '<div class="admin-news-row"><div><b>'+esc(n.title)+'</b><small>'+(n.published?'PUBLISHED':'DRAFT')+' · '+esc(n.category||'UPDATE')+'</small></div><div class="admin-news-actions"><button type="button" data-news-toggle="'+n.id+'" data-pub="'+(n.published?'0':'1')+'">'+(n.published?'Tarik':'Publikasikan')+'</button><button type="button" class="danger" data-news-del="'+n.id+'">Hapus</button></div></div>';}).join(''):'<div class="empty">Belum ada berita.</div>';
    });
  }
  function saveNews(published) {
    var title=$('news-title').value.trim(), body=$('news-body').value.trim();
    if(!title||!body)return newsMessage('Judul dan isi berita wajib diisi.');
    var row={title:title,category:$('news-category').value,excerpt:$('news-excerpt').value.trim()||null,body:body,image_url:$('news-image').value.trim()||null,published:published,author:user.email};
    sb.from('news').insert(row).then(function(r){if(r.error){newsMessage('Gagal menyimpan: '+r.error.message);return;}log('news:create',title);$('news-title').value='';$('news-excerpt').value='';$('news-body').value='';$('news-image').value='';newsMessage(published?'Berita berhasil dipublikasikan.':'Draft berhasil disimpan.',true);loadNewsAdmin();});
  }
  if($('news-publish'))$('news-publish').onclick=function(){saveNews(true);};
  if($('news-draft'))$('news-draft').onclick=function(){saveNews(false);};
  if($('news-admin-list'))$('news-admin-list').addEventListener('click',function(e){
    var id=e.target.getAttribute('data-news-toggle'),del=e.target.getAttribute('data-news-del');
    if(id){var pub=e.target.getAttribute('data-pub')==='1';sb.from('news').update({published:pub}).eq('id',id).then(function(r){if(r.error)return newsMessage('Gagal memperbarui: '+r.error.message);loadNewsAdmin();newsMessage(pub?'Berita dipublikasikan.':'Berita ditarik dari publik.',true);});}
    if(del){if(!confirm('Hapus berita ini?'))return;sb.from('news').delete().eq('id',del).then(function(r){if(r.error)return newsMessage('Gagal menghapus: '+r.error.message);loadNewsAdmin();newsMessage('Berita dihapus.',true);});}
  });
})();
