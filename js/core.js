(function (root) {
  var CATEGORY_LABEL = { U11: 'U-11', U15: 'U-15' };
  var STATUS_LABEL = { UPCOMING: 'AKAN DATANG', LIVE: 'LIVE', 'HALF TIME': 'HALF TIME', 'FULL TIME': 'FULL TIME', POSTPONED: 'DITUNDA', CANCELLED: 'DIBATALKAN' };

  // HASIL DRAWING (resmi). Ubah di sini jika drawing berubah.
  var GROUPS = {
    U11: { A: ['RT 005/021', 'RT 009/021', 'RT 008/021', 'Villind A', 'RT 011/021'],
           B: ['Villind B', 'RT 003/021', 'RT 004/021', 'RT 012/021', 'Villipo RW.14'] },
    U15: { A: ['RT 009/021', 'RT 006/021', 'RT 004/021', 'RT 011/021'],
           B: ['RT 012/021', 'RT 007/021', 'RT 008/021', 'RT 013/021'] }
  };
  function groupOf(cat, team) {
    var g = GROUPS[cat] || {};
    return Object.keys(g).filter(function (k) { return g[k].indexOf(team) > -1; })[0] || null;
  }
  // Grup sebuah pertandingan (hanya babak grup, dan hanya jika kedua tim satu grup).
  function matchGroup(m) {
    if (m.phase !== 'Babak Grup') return null;
    var a = groupOf(m.category, m.team_a), b = groupOf(m.category, m.team_b);
    return a && a === b ? a : null;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function elapsed(m, now) {
    var base = m.clock_base || 0;
    if (m.status === 'LIVE' && m.clock_started_at) {
      base += Math.max(0, Math.floor((now - new Date(m.clock_started_at).getTime()) / 1000));
    }
    return base;
  }
  function fmtClock(s) {
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' });
  }
  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).replace('.', ':') + ' WIB';
  }
  function dayKey(iso) {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  }
  function youtubeEmbed(input) {
    if (!input) return null;
    var s = String(input).trim(), id = null, m;
    if (/^[\w-]{11}$/.test(s)) id = s;
    else if ((m = s.match(/[?&]v=([\w-]{11})/))) id = m[1];
    else if ((m = s.match(/(?:youtu\.be\/|\/live\/|\/embed\/)([\w-]{11})/))) id = m[1];
    return id ? 'https://www.youtube.com/embed/' + id : null;
  }
  // Klasemen per grup: poin, selisih gol, gol memasukkan, lalu urutan drawing.
  // Hanya pertandingan Babak Grup berstatus FULL TIME yang dihitung.
  function standings(matches, cat, grp) {
    var order = (GROUPS[cat] && GROUPS[cat][grp]) || [];
    var t = {};
    order.forEach(function (n) { t[n] = { team: n, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }; });
    matches.forEach(function (m) {
      if (m.category !== cat || m.status !== 'FULL TIME' || matchGroup(m) !== grp) return;
      var a = t[m.team_a], b = t[m.team_b];
      a.p++; b.p++; a.gf += m.score_a; a.ga += m.score_b; b.gf += m.score_b; b.ga += m.score_a;
      if (m.score_a > m.score_b) { a.w++; b.l++; a.pts += 3; }
      else if (m.score_a < m.score_b) { b.w++; a.l++; b.pts += 3; }
      else { a.d++; b.d++; a.pts++; b.pts++; }
    });
    return order.map(function (k, i) { t[k].gd = t[k].gf - t[k].ga; t[k].ord = i; return t[k]; })
      .sort(function (x, y) { return y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.ord - y.ord; });
  }

  var api = { GROUPS: GROUPS, groupOf: groupOf, matchGroup: matchGroup, CATEGORY_LABEL: CATEGORY_LABEL, STATUS_LABEL: STATUS_LABEL, esc: esc, elapsed: elapsed, fmtClock: fmtClock,
    fmtDate: fmtDate, fmtTime: fmtTime, dayKey: dayKey, youtubeEmbed: youtubeEmbed, standings: standings };

  if (typeof window !== 'undefined') {
    var c = window.VJT_CONFIG || {};
    api.configured = !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY && c.SUPABASE_URL.indexOf('ISI_') !== 0);
    api.sb = (api.configured && window.supabase) ? window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY) : null;
  }
  root.VJT = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
