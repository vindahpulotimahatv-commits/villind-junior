(function (root) {
  var CATEGORY_LABEL = { U11: 'U-11', U15: 'U-15' };
  var STATUS_LABEL = { UPCOMING: 'AKAN DATANG', LIVE: 'LIVE', 'HALF TIME': 'HALF TIME', 'FULL TIME': 'FULL TIME', POSTPONED: 'DITUNDA', CANCELLED: 'DIBATALKAN' };

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
  // Klasemen: poin, selisih gol, gol memasukkan, lalu nama. Hanya pertandingan FULL TIME.
  function standings(matches, cat) {
    var t = {};
    function row(n) { return t[n] || (t[n] = { team: n, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }); }
    matches.filter(function (m) { return m.category === cat; }).forEach(function (m) {
      var a = row(m.team_a), b = row(m.team_b);
      if (m.status !== 'FULL TIME') return;
      a.p++; b.p++; a.gf += m.score_a; a.ga += m.score_b; b.gf += m.score_b; b.ga += m.score_a;
      if (m.score_a > m.score_b) { a.w++; b.l++; a.pts += 3; }
      else if (m.score_a < m.score_b) { b.w++; a.l++; b.pts += 3; }
      else { a.d++; b.d++; a.pts++; b.pts++; }
    });
    return Object.keys(t).map(function (k) { t[k].gd = t[k].gf - t[k].ga; return t[k]; })
      .sort(function (x, y) { return y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.localeCompare(y.team); });
  }

  var api = { CATEGORY_LABEL: CATEGORY_LABEL, STATUS_LABEL: STATUS_LABEL, esc: esc, elapsed: elapsed, fmtClock: fmtClock,
    fmtDate: fmtDate, fmtTime: fmtTime, dayKey: dayKey, youtubeEmbed: youtubeEmbed, standings: standings };

  if (typeof window !== 'undefined') {
    var c = window.VJT_CONFIG || {};
    api.configured = !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY && c.SUPABASE_URL.indexOf('ISI_') !== 0);
    api.sb = (api.configured && window.supabase) ? window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY) : null;
  }
  root.VJT = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
