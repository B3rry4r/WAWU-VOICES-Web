/* @ds-bundle: {"format":4,"namespace":"Voices","components":[{"name":"Button"},{"name":"IconButton"},{"name":"Badge"},{"name":"NewsTag"},{"name":"VerifyMark"},{"name":"Avatar"},{"name":"Tabs"},{"name":"TopicChip"},{"name":"StageBar"},{"name":"TopBar"},{"name":"BottomNav"},{"name":"SideNav"},{"name":"AppShell"},{"name":"QuestionHero"},{"name":"TopicOfWeek"},{"name":"TopicTile"},{"name":"TrendingList"},{"name":"VoicePlayer"},{"name":"AnswerCard"},{"name":"ReactionTray"},{"name":"ProposalCard"},{"name":"Composer"},{"name":"FreePosts"},{"name":"Recorder"},{"name":"Poll"},{"name":"ResultComment"},{"name":"LiveThread"},{"name":"WeeklyReportCard"},{"name":"AdSlot"},{"name":"SponsoredSurvey"},{"name":"ShareCard"},{"name":"ProfileHeader"},{"name":"UnitsChip"},{"name":"BuyUnitsSheet"},{"name":"NotificationRow"},{"name":"Banner"},{"name":"Toast"},{"name":"EmptyState"},{"name":"Skeleton"},{"name":"Sheet"},{"name":"Dialog"},{"name":"TextField"},{"name":"SearchField"},{"name":"Icon"},{"name":"Logo"}]} */
/* VOICES components. One classic script: reads window.React and window.ReactDOM, assigns window.Voices. Icons: Lucide 0.460.0 (ISC). */
(function () {
  'use strict';
  var React = window.React;
  var h = React.createElement;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef, Fragment = React.Fragment;

  var ICONS = {"house":[["path",{"d":"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"}],["path",{"d":"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"}]],"compass":[["path",{"d":"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"}],["circle",{"cx":"12","cy":"12","r":"10"}]],"mic":[["path",{"d":"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}],["path",{"d":"M19 10v2a7 7 0 0 1-14 0v-2"}],["line",{"x1":"12","x2":"12","y1":"19","y2":"22"}]],"user":[["path",{"d":"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"}],["circle",{"cx":"12","cy":"7","r":"4"}]],"bell":[["path",{"d":"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"}],["path",{"d":"M10.3 21a1.94 1.94 0 0 0 3.4 0"}]],"globe":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"}],["path",{"d":"M2 12h20"}]],"search":[["circle",{"cx":"11","cy":"11","r":"8"}],["path",{"d":"m21 21-4.3-4.3"}]],"play":[["polygon",{"points":"6 3 20 12 6 21 6 3"}]],"pause":[["rect",{"x":"14","y":"4","width":"4","height":"16","rx":"1"}],["rect",{"x":"6","y":"4","width":"4","height":"16","rx":"1"}]],"heart":[["path",{"d":"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"}]],"smile-plus":[["path",{"d":"M22 11v1a10 10 0 1 1-9-10"}],["path",{"d":"M8 14s1.5 2 4 2 4-2 4-2"}],["line",{"x1":"9","x2":"9.01","y1":"9","y2":"9"}],["line",{"x1":"15","x2":"15.01","y1":"9","y2":"9"}],["path",{"d":"M16 5h6"}],["path",{"d":"M19 2v6"}]],"message-circle":[["path",{"d":"M7.9 20A9 9 0 1 0 4 16.1L2 22Z"}]],"share-2":[["circle",{"cx":"18","cy":"5","r":"3"}],["circle",{"cx":"6","cy":"12","r":"3"}],["circle",{"cx":"18","cy":"19","r":"3"}],["line",{"x1":"8.59","x2":"15.42","y1":"13.51","y2":"17.49"}],["line",{"x1":"15.41","x2":"8.59","y1":"6.51","y2":"10.49"}]],"flag":[["path",{"d":"M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"}],["line",{"x1":"4","x2":"4","y1":"22","y2":"15"}]],"ellipsis":[["circle",{"cx":"12","cy":"12","r":"1"}],["circle",{"cx":"19","cy":"12","r":"1"}],["circle",{"cx":"5","cy":"12","r":"1"}]],"x":[["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],"check":[["path",{"d":"M20 6 9 17l-5-5"}]],"chevron-right":[["path",{"d":"m9 18 6-6-6-6"}]],"chevron-left":[["path",{"d":"m15 18-6-6 6-6"}]],"chevron-down":[["path",{"d":"m6 9 6 6 6-6"}]],"arrow-left":[["path",{"d":"m12 19-7-7 7-7"}],["path",{"d":"M19 12H5"}]],"arrow-up":[["path",{"d":"m5 12 7-7 7 7"}],["path",{"d":"M12 19V5"}]],"rotate-ccw":[["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{"d":"M3 3v5h5"}]],"trash-2":[["path",{"d":"M3 6h18"}],["path",{"d":"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"}],["path",{"d":"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"}],["line",{"x1":"10","x2":"10","y1":"11","y2":"17"}],["line",{"x1":"14","x2":"14","y1":"11","y2":"17"}]],"square":[["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}]],"shield-check":[["path",{"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"}],["path",{"d":"m9 12 2 2 4-4"}]],"shield-alert":[["path",{"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"}],["path",{"d":"M12 8v4"}],["path",{"d":"M12 16h.01"}]],"messages-square":[["path",{"d":"M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"}],["path",{"d":"M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"}]],"badge-check":[["path",{"d":"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"}],["path",{"d":"m9 12 2 2 4-4"}]],"circle-dashed":[["path",{"d":"M10.1 2.182a10 10 0 0 1 3.8 0"}],["path",{"d":"M13.9 21.818a10 10 0 0 1-3.8 0"}],["path",{"d":"M17.609 3.721a10 10 0 0 1 2.69 2.7"}],["path",{"d":"M2.182 13.9a10 10 0 0 1 0-3.8"}],["path",{"d":"M20.279 17.609a10 10 0 0 1-2.7 2.69"}],["path",{"d":"M21.818 10.1a10 10 0 0 1 0 3.8"}],["path",{"d":"M3.721 6.391a10 10 0 0 1 2.7-2.69"}],["path",{"d":"M6.391 20.279a10 10 0 0 1-2.69-2.7"}]],"wifi-off":[["path",{"d":"M12 20h.01"}],["path",{"d":"M8.5 16.429a5 5 0 0 1 7 0"}],["path",{"d":"M5 12.859a10 10 0 0 1 5.17-2.69"}],["path",{"d":"M19 12.859a10 10 0 0 0-2.007-1.523"}],["path",{"d":"M2 8.82a15 15 0 0 1 4.177-2.643"}],["path",{"d":"M22 8.82a15 15 0 0 0-11.288-3.764"}],["path",{"d":"m2 2 20 20"}]],"triangle-alert":[["path",{"d":"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"}],["path",{"d":"M12 9v4"}],["path",{"d":"M12 17h.01"}]],"info":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 16v-4"}],["path",{"d":"M12 8h.01"}]],"circle-check":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m9 12 2 2 4-4"}]],"circle-x":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m15 9-6 6"}],["path",{"d":"m9 9 6 6"}]],"coins":[["circle",{"cx":"8","cy":"8","r":"6"}],["path",{"d":"M18.09 10.37A6 6 0 1 1 10.34 18"}],["path",{"d":"M7 6h1v4"}],["path",{"d":"m16.71 13.88.7.71-2.82 2.82"}]],"wallet":[["path",{"d":"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"}],["path",{"d":"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"}]],"chart-column":[["path",{"d":"M3 3v16a2 2 0 0 0 2 2h16"}],["path",{"d":"M18 17V9"}],["path",{"d":"M13 17V5"}],["path",{"d":"M8 17v-3"}]],"user-check":[["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["circle",{"cx":"9","cy":"7","r":"4"}],["polyline",{"points":"16 11 18 13 22 9"}]],"plus":[["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]],"minus":[["path",{"d":"M5 12h14"}]],"clock":[["circle",{"cx":"12","cy":"12","r":"10"}],["polyline",{"points":"12 6 12 12 16 14"}]],"lock":[["rect",{"width":"18","height":"11","x":"3","y":"11","rx":"2","ry":"2"}],["path",{"d":"M7 11V7a5 5 0 0 1 10 0v4"}]],"settings":[["path",{"d":"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"}],["circle",{"cx":"12","cy":"12","r":"3"}]],"copy":[["rect",{"width":"14","height":"14","x":"8","y":"8","rx":"2","ry":"2"}],["path",{"d":"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]],"link":[["path",{"d":"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"}],["path",{"d":"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"}]],"megaphone":[["path",{"d":"m3 11 18-5v12L3 14v-3z"}],["path",{"d":"M11.6 16.8a3 3 0 1 1-5.8-1.6"}]],"clipboard-list":[["rect",{"width":"8","height":"4","x":"8","y":"2","rx":"1","ry":"1"}],["path",{"d":"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"}],["path",{"d":"M12 11h4"}],["path",{"d":"M12 16h4"}],["path",{"d":"M8 11h.01"}],["path",{"d":"M8 16h.01"}]],"trending-up":[["polyline",{"points":"22 7 13.5 15.5 8.5 10.5 2 17"}],["polyline",{"points":"16 7 22 7 22 13"}]],"radio":[["path",{"d":"M4.9 19.1C1 15.2 1 8.8 4.9 4.9"}],["path",{"d":"M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"}],["circle",{"cx":"12","cy":"12","r":"2"}],["path",{"d":"M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"}],["path",{"d":"M19.1 4.9C23 8.8 23 15.1 19.1 19"}]],"eye":[["path",{"d":"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"}],["circle",{"cx":"12","cy":"12","r":"3"}]],"headphones":[["path",{"d":"M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"}]],"lightbulb":[["path",{"d":"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"}],["path",{"d":"M9 18h6"}],["path",{"d":"M10 22h4"}]],"vote":[["path",{"d":"m9 12 2 2 4-4"}],["path",{"d":"M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z"}],["path",{"d":"M22 19H2"}]],"message-square":[["path",{"d":"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"}]],"map-pin":[["path",{"d":"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"}],["circle",{"cx":"12","cy":"10","r":"3"}]],"send":[["path",{"d":"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"}],["path",{"d":"m21.854 2.147-10.94 10.939"}]],"captions":[["rect",{"width":"18","height":"14","x":"3","y":"5","rx":"2","ry":"2"}],["path",{"d":"M7 15h4M15 15h2M7 11h2M13 11h4"}]],"refresh-cw":[["path",{"d":"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"}],["path",{"d":"M21 3v5h-5"}],["path",{"d":"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"}],["path",{"d":"M8 16H3v5"}]],"volume-2":[["path",{"d":"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"}],["path",{"d":"M16 9a5 5 0 0 1 0 6"}],["path",{"d":"M19.364 18.364a9 9 0 0 0 0-12.728"}]],"bookmark":[["path",{"d":"m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"}]],"file-down":[["path",{"d":"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4"}],["path",{"d":"M12 18v-6"}],["path",{"d":"m9 15 3 3 3-3"}]],"mic-off":[["line",{"x1":"2","x2":"22","y1":"2","y2":"22"}],["path",{"d":"M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"}],["path",{"d":"M5 10v2a7 7 0 0 0 12 5"}],["path",{"d":"M15 9.34V5a3 3 0 0 0-5.68-1.33"}],["path",{"d":"M9 9v3a3 3 0 0 0 5.12 2.12"}],["line",{"x1":"12","x2":"12","y1":"19","y2":"22"}]],"sun":[["circle",{"cx":"12","cy":"12","r":"4"}],["path",{"d":"M12 2v2"}],["path",{"d":"M12 20v2"}],["path",{"d":"m4.93 4.93 1.41 1.41"}],["path",{"d":"m17.66 17.66 1.41 1.41"}],["path",{"d":"M2 12h2"}],["path",{"d":"M20 12h2"}],["path",{"d":"m6.34 17.66-1.41 1.41"}],["path",{"d":"m19.07 4.93-1.41 1.41"}]],"moon":[["path",{"d":"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"}]]};
  var ASSETS = {"wordmark": "/_blob/207ba8f4040f40092e590ed250951dea", "wordmarkWhite": "/_blob/ae1392c579040b3b35277dc62e347410", "mark": "/_blob/c29fffedaf6e5d1ca82acb08cca622ae", "markWhite": "/_blob/8e3517e5f4c802861cc828716d8df7c2"};

  /* ---------- helpers ---------- */
  function cx() { var a = []; for (var i = 0; i < arguments.length; i++) if (arguments[i]) a.push(arguments[i]); return a.join(' '); }
  var DOM_KEYS = ['id', 'title', 'href', 'target', 'rel', 'onClick', 'onKeyDown', 'onFocus', 'onBlur', 'tabIndex', 'role', 'style', 'name', 'value', 'form', 'type'];
  function domProps(p) {
    var o = {};
    for (var k in p) if (DOM_KEYS.indexOf(k) >= 0 || k.indexOf('aria-') === 0 || k.indexOf('data-') === 0) o[k] = p[k];
    return o;
  }
  function fmt(n) { return typeof n === 'number' ? n.toLocaleString('en-NG') : n; }
  function short(n) {
    if (typeof n !== 'number') return n;
    if (n >= 1e6) return (Math.round(n / 1e5) / 10) + 'M';
    if (n >= 1e4) return (Math.round(n / 100) / 10) + 'K';
    return fmt(n);
  }
  function clock(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function initials(name) {
    var parts = String(name || '').replace(/^@/, '').split(/[\s._-]+/).filter(Boolean);
    return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  function hashTone(s) { var t = ['sun', 'mint', 'sky', 'coral']; var x = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return t[x % t.length]; }
  /* a speech-like waveform: deterministic for a seed */
  function waveBars(seed, n) {
    var out = [], x = (seed || 7) * 9973;
    for (var i = 0; i < n; i++) {
      x = (x * 1103515245 + 12345) % 2147483648;
      var r = x / 2147483648;
      var env = 0.45 + 0.55 * Math.sin(Math.PI * (i + 0.5) / n);
      var syll = 0.55 + 0.45 * Math.abs(Math.sin(i * 0.9 + seed));
      out.push(Math.max(0.12, Math.min(1, env * syll * (0.55 + r * 0.6))));
    }
    return out;
  }
  function useTicker(active, stepMs, cb) {
    var ref = useRef(cb); ref.current = cb;
    useEffect(function () {
      if (!active) return undefined;
      var id = setInterval(function () { ref.current(); }, stepMs);
      return function () { clearInterval(id); };
    }, [active, stepMs]);
  }

  /* ---------- Icon + Logo ---------- */
  function Icon(p) {
    var node = ICONS[p.name];
    if (!node) return null;
    var s = p.size || 22;
    return h('svg', {
      className: cx('vx-icon', p.className), width: s, height: s, viewBox: '0 0 24 24',
      fill: p.fill ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2,
      strokeLinecap: 'round', strokeLinejoin: 'round', focusable: 'false',
      'aria-hidden': p.label ? undefined : 'true', role: p.label ? 'img' : undefined, 'aria-label': p.label, style: p.style
    }, node.map(function (c, i) { var a = {}; for (var k in c[1]) a[k] = c[1][k]; a.key = i; return h(c[0], a); }));
  }
  Icon.names = Object.keys(ICONS);

  function Logo(p) {
    var variant = p.variant || 'wordmark';
    var tone = p.tone || 'green';
    var src = variant === 'mark' ? (tone === 'white' ? ASSETS.markWhite : ASSETS.mark) : (tone === 'white' ? ASSETS.wordmarkWhite : ASSETS.wordmark);
    return h('img', { src: p.src || src, alt: p.alt === undefined ? 'VOICES' : p.alt, className: cx('vx-logo', p.className), style: { height: p.height || 32, width: 'auto', display: 'block' } });
  }

  /* ---------- Actions ---------- */
  function Button(p) {
    var v = p.variant || 'primary', s = p.size || 'm';
    var Tag = p.href ? 'a' : 'button';
    var props = domProps(p);
    props.className = cx('vx-btn', 'vx-btn--' + v, s !== 'm' && 'vx-btn--' + s, p.block && 'vx-btn--block', p.loading && 'is-loading', p.className);
    if (!p.href) { props.type = p.type || 'button'; props.disabled = !!(p.disabled || p.loading); }
    if (p.loading) props['aria-busy'] = 'true';
    var icSize = s === 's' ? 18 : 22;
    return h(Tag, props,
      p.loading ? h('span', { className: 'vx-spin', 'aria-hidden': 'true' }) : (p.icon ? h(Icon, { name: p.icon, size: icSize }) : null),
      h('span', { className: 'vx-btn__label' }, p.children),
      p.iconEnd ? h(Icon, { name: p.iconEnd, size: 18 }) : null);
  }

  function IconButton(p) {
    var props = domProps(p);
    props.type = 'button';
    props.className = cx('vx-iconbtn', p.variant && 'vx-iconbtn--' + p.variant, p.size === 's' && 'vx-iconbtn--s', p.className);
    props['aria-label'] = p.label + (p.count ? ', ' + p.count + ' new' : p.dot ? ', new' : '');
    if (p.pressed !== undefined) props['aria-pressed'] = p.pressed ? 'true' : 'false';
    return h('button', props,
      h(Icon, { name: p.icon, size: p.iconSize || 22 }),
      p.count ? h('span', { className: 'vx-iconbtn__count', 'aria-hidden': 'true' }, p.count > 99 ? '99+' : p.count) : (p.dot ? h('span', { className: 'vx-iconbtn__dot', 'aria-hidden': 'true' }) : null));
  }

  /* ---------- Labels ---------- */
  function Badge(p) {
    var tone = p.tone || 'neutral';
    var label = p.children || ({ ad: 'Ad', sponsored: 'Sponsored', proposed: 'Proposed', promoted: 'Promoted', live: 'Live', you: 'Your vote', leading: 'Leading' })[tone];
    var cls = tone === 'leading' ? 'sun' : tone;
    return h('span', { className: cx('vx-badge', 'vx-badge--' + cls, p.className) }, p.icon ? h(Icon, { name: p.icon, size: 14, strokeWidth: 2.5 }) : null, label);
  }

  var NEWS = {
    verified: { label: 'Verified News', icon: 'shield-check', note: "Confirmed by WAWU's editors against a named source. The source is linked." },
    unverified: { label: 'Unverified News', icon: 'shield-alert', note: 'A news claim WAWU has not confirmed. Treat it with care.' },
    gossip: { label: 'Gossip', icon: 'messages-square', note: 'Talk, rumour or opinion. Not presented as fact.' }
  };
  function NewsTag(p) {
    var k = NEWS[p.kind] ? p.kind : 'unverified';
    var t = NEWS[k];
    var tag = h('span', { className: cx('vx-tag', 'vx-tag--' + k, p.size === 'm' && 'vx-tag--m', p.className), title: t.note },
      h(Icon, { name: t.icon, size: p.size === 'm' ? 16 : 14, strokeWidth: 2.5 }), t.label);
    if (!p.withNote) return tag;
    return h('div', { className: 'vx-tagnote' }, tag, h('p', null, t.note,
      k === 'verified' && p.source ? h(Fragment, null, ' ', h('a', { className: 'vx-link', href: p.source.href || '#', style: { minHeight: 0, display: 'inline' } }, 'Source: ' + p.source.name)) : null));
  }
  NewsTag.notes = NEWS;

  function VerifyMark(p) {
    var ok = p.status === 'verified';
    return h('span', { className: cx('vx-mark', ok ? 'vx-mark--verified' : 'vx-mark--unverified', p.pill && 'vx-mark--pill', p.className) },
      h(Icon, { name: ok ? 'badge-check' : 'circle-dashed', size: 16, strokeWidth: 2.5 }),
      ok ? 'Verified' : 'Not verified',
      p.detail ? h('span', { className: 'vx-mark__detail' }, '· ' + p.detail) : null);
  }

  /* ---------- Identity ---------- */
  function Avatar(p) {
    var size = p.size || 'm';
    var tone = p.tone || hashTone(p.name);
    return h('span', { className: cx('vx-avatar', size !== 'm' && 'vx-avatar--' + size, !p.src && tone !== 'mint' && 'vx-avatar--' + tone, p.playing && 'is-playing', p.className), role: 'img', 'aria-label': p.name || 'Avatar' },
      p.src ? h('img', { src: p.src, alt: '' }) : h('span', { 'aria-hidden': 'true' }, initials(p.name)));
  }
  function AvatarStack(p) {
    return h('span', { className: 'vx-avstack', 'aria-hidden': 'true' }, (p.names || []).slice(0, 3).map(function (n, i) { return h(Avatar, { key: i, name: n, size: 's' }); }));
  }

  /* ---------- Navigation ---------- */
  function Tabs(p) {
    var items = p.items || [];
    var st = useState(p.defaultValue || (items[0] && items[0].id)); var val = p.value !== undefined ? p.value : st[0];
    function pick(id) { st[1](id); if (p.onChange) p.onChange(id); }
    function key(e, i) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
      var n = items[(i + d + items.length) % items.length]; pick(n.id);
      var btns = e.currentTarget.parentNode.querySelectorAll('[role="tab"]'); btns[(i + d + items.length) % items.length].focus();
    }
    return h('div', { className: cx(p.variant === 'segmented' ? 'vx-seg' : 'vx-tabs', p.block && 'vx-seg--block', p.className), role: 'tablist', 'aria-label': p.label },
      items.map(function (it, i) {
        var on = it.id === val;
        return h('button', { key: it.id, type: 'button', role: 'tab', className: 'vx-tab', 'aria-selected': on ? 'true' : 'false', tabIndex: on ? 0 : -1, onClick: function () { pick(it.id); }, onKeyDown: function (e) { key(e, i); } },
          it.icon ? h(Icon, { name: it.icon, size: 18 }) : null, it.label, it.count !== undefined ? h('span', { className: 'vx-tab__count' }, fmt(it.count)) : null);
      }));
  }

  function TopicChip(p) {
    var st = useState(!!p.defaultSelected); var on = p.selected !== undefined ? p.selected : st[0];
    return h('button', { type: 'button', className: cx('vx-chip', p.className), 'aria-pressed': on ? 'true' : 'false', 'aria-disabled': p.disabled ? 'true' : undefined,
      onClick: function () { if (p.disabled) return; st[1](!on); if (p.onClick) p.onClick(!on); } },
      p.icon ? h(Icon, { name: p.icon, size: 16, strokeWidth: 2.25 }) : null,
      p.label,
      p.count !== undefined ? h('span', { className: 'vx-chip__count' }, short(p.count)) : null,
      p.newCount ? h('span', { className: 'vx-chip__new', 'aria-label': p.newCount + ' new' }, p.newCount) : null);
  }

  var STAGES = [
    { id: 'speak', label: 'Speak', icon: 'mic' },
    { id: 'discuss', label: 'Discuss', icon: 'message-square' },
    { id: 'vote', label: 'Vote', icon: 'vote' },
    { id: 'next', label: 'What Next?', icon: 'lightbulb' }
  ];
  function StageBar(p) {
    var st = useState(p.current || 'discuss'); var cur = p.value !== undefined ? p.value : st[0];
    var visited = p.visited || [];
    var counts = p.counts || {};
    return h('nav', { className: cx('vx-stage', p.className), 'aria-label': 'Conversation stages' },
      STAGES.map(function (s) {
        var on = s.id === cur;
        return h('button', { key: s.id, type: 'button', className: cx('vx-stage__step', visited.indexOf(s.id) >= 0 && 'is-visited'), 'aria-current': on ? 'step' : undefined,
          onClick: function () { st[1](s.id); if (p.onChange) p.onChange(s.id); } },
          h('span', { className: 'vx-stage__dot' }, h(Icon, { name: s.icon, size: 20 })),
          s.label,
          counts[s.id] !== undefined ? h('span', { className: 'vx-stage__n' }, counts[s.id]) : null);
      }));
  }

  function TopBar(p) {
    return h('header', { className: cx('vx-topbar', p.className) },
      h('img', { className: 'vx-topbar__logo', src: ASSETS.wordmark, alt: 'VOICES home' }),
      h('button', { type: 'button', className: 'vx-country', 'aria-label': 'Country: ' + (p.country || 'Nigeria') + '. Change country', onClick: p.onCountry },
        h(Icon, { name: 'globe', size: 18 }), p.country || 'Nigeria', h(Icon, { name: 'chevron-down', size: 16 })),
      h(IconButton, { icon: 'bell', label: 'Notifications', dot: p.unread !== false && !p.count, count: p.count, onClick: p.onBell }));
  }

  var NAV = [
    { id: 'home', label: 'Home', icon: 'house' },
    { id: 'discover', label: 'Discover', icon: 'compass' },
    { id: 'speak', label: 'Speak', icon: 'mic' },
    { id: 'profile', label: 'Profile', icon: 'user' }
  ];
  function BottomNav(p) {
    var st = useState(p.active || 'home'); var act = p.value !== undefined ? p.value : st[0];
    function go(id) { st[1](id); if (p.onChange) p.onChange(id); }
    return h('nav', { className: cx('vx-bottombar', p.className), 'aria-label': 'Main' },
      NAV.map(function (n) {
        var cur = n.id === act ? 'page' : undefined;
        if (n.id === 'speak') return h('button', { key: n.id, type: 'button', className: 'vx-speak', 'aria-current': cur, onClick: function () { go(n.id); } },
          h('span', { className: 'vx-speak__btn' }, h(Icon, { name: 'mic', size: 28, strokeWidth: 2.25 })), 'Speak');
        return h('button', { key: n.id, type: 'button', className: 'vx-navitem', 'aria-current': cur, onClick: function () { go(n.id); } },
          h('span', { className: 'vx-navitem__ic' }, h(Icon, { name: n.icon, size: 22, strokeWidth: cur ? 2.4 : 2 })), n.label);
      }));
  }

  var SIDE = [
    { id: 'home', label: 'Home', icon: 'house' },
    { id: 'discover', label: 'Discover', icon: 'compass' },
    { id: 'report', label: 'Weekly report', icon: 'chart-column' },
    { id: 'profile', label: 'Profile', icon: 'user' }
  ];
  function SideNav(p) {
    var st = useState(p.active || 'home'); var act = p.value !== undefined ? p.value : st[0];
    var rail = p.collapsed;
    return h('nav', { className: cx('vx-sidenav', rail && 'vx-sidenav--rail', p.className), 'aria-label': 'Main' },
      h('img', { className: 'vx-sidenav__logo', src: rail ? ASSETS.mark : ASSETS.wordmark, alt: 'VOICES home' }),
      SIDE.map(function (n) {
        var cur = n.id === act ? 'page' : undefined;
        return h('button', { key: n.id, type: 'button', className: 'vx-navitem', 'aria-current': cur, onClick: function () { st[1](n.id); if (p.onChange) p.onChange(n.id); } },
          h('span', { className: 'vx-navitem__ic' }, h(Icon, { name: n.icon, size: 22, strokeWidth: cur ? 2.4 : 2 })), n.label);
      }),
      h(Button, { className: 'vx-sidenav__speak', size: 'l', icon: 'mic', onClick: p.onSpeak, 'aria-label': 'Speak' }, 'Speak'),
      !rail && p.units !== undefined ? h('div', { className: 'vx-sidenav__foot' }, h(UnitsChip, { units: p.units, freeLeft: p.freeLeft })) : null);
  }

  function AppShell(p) {
    var layout = p.layout || 'desktop';
    if (layout === 'phone') {
      return h('div', { className: cx('vx-shell', 'vx-shell--phone', p.className) },
        h(TopBar, { country: p.country }),
        h('main', { className: 'vx-shell__main' }, p.children),
        h(BottomNav, { active: p.active || 'home' }));
    }
    var bar = h('div', { className: 'vx-shell__deskbar' },
      h(SearchField, { placeholder: 'Search questions, voices and handles', style: { flex: 1 } }),
      h('button', { type: 'button', className: 'vx-country', 'aria-label': 'Country: Nigeria. Change country' }, h(Icon, { name: 'globe', size: 18 }), p.country || 'Nigeria', h(Icon, { name: 'chevron-down', size: 16 })),
      h(IconButton, { icon: 'bell', label: 'Notifications', dot: true }));
    if (layout === 'tablet') {
      return h('div', { className: cx('vx-shell', 'vx-shell--tablet', p.className) },
        h(SideNav, { collapsed: true, active: p.active || 'home' }),
        h('main', { className: 'vx-shell__main' }, bar, p.children, p.rail));
    }
    return h('div', { className: cx('vx-shell', 'vx-shell--desktop', p.className) },
      h(SideNav, { active: p.active || 'home', units: p.units === undefined ? '12.5' : p.units, freeLeft: p.freeLeft }),
      h('main', { className: 'vx-shell__main' }, bar, p.children),
      h('aside', { className: 'vx-shell__rail', 'aria-label': 'This week' }, p.rail));
  }

  /* ---------- Home and discovery ---------- */
  function QuestionHero(p) {
    return h('section', { className: cx('vx-hero', p.className), 'aria-labelledby': 'vx-hero-q' },
      h('div', { className: 'vx-hero__card' },
        h('img', { className: 'vx-hero__motif', src: ASSETS.markWhite, alt: '', 'aria-hidden': 'true' }),
        h('span', { className: 'vx-hero__sticker' }, p.eyebrow || "Today's question"),
        h('h2', { className: 'vx-hero__q', id: 'vx-hero-q' }, p.question),
        h('div', { className: 'vx-hero__meta' },
          p.avatars ? h(AvatarStack, { names: p.avatars }) : null,
          h('span', { className: 'vx-num' }, short(p.voices) + ' voices so far'),
          p.closesIn ? h(Fragment, null, h('span', { className: 'vx-dot', 'aria-hidden': 'true' }), h('span', null, 'Closes in ' + p.closesIn)) : null),
        h('div', { className: 'vx-hero__cta' },
          h(Button, { variant: 'dark', size: 'l', icon: 'mic', className: 'vx-hero__speak', onClick: p.onSpeak }, p.speakLabel || 'Speak'),
          h('div', { className: 'vx-hero__quick' },
            h(Button, { size: 's', icon: 'headphones', onClick: p.onListen }, 'Listen'),
            h(Button, { size: 's', icon: 'message-square', onClick: p.onDiscuss }, 'Discuss'),
            h(Button, { size: 's', icon: 'vote', onClick: p.onVote }, 'Vote')))));
  }

  function TopicOfWeek(p) {
    if (p.variant === 'rail') {
      return h('section', { className: 'vx-totw vx-totw--rail', 'aria-label': 'Topic of the week' },
        h('span', { className: 'vx-eyebrow vx-totw__eye' }, 'Topic of the week'),
        h('span', { className: 'vx-totw__title' }, p.title),
        p.meta ? h('span', { className: 'vx-totw__meta' }, p.meta) : null,
        h(Button, { block: true, onClick: p.onClick }, 'Join the conversation'));
    }
    return h(p.href ? 'a' : 'button', { className: 'vx-totw', type: p.href ? undefined : 'button', href: p.href, onClick: p.onClick },
      h('span', { className: 'vx-totw__ic' }, h(Icon, { name: p.icon || 'globe', size: 24 })),
      h('span', { className: 'vx-totw__txt' },
        h('span', { className: 'vx-eyebrow vx-totw__eye' }, p.eyebrow || 'Topic of the week'),
        h('span', { className: 'vx-totw__title' }, p.title),
        p.meta ? h('span', { className: 'vx-totw__meta' }, p.meta) : null),
      h(Icon, { name: 'chevron-right', size: 22, className: 'vx-totw__chev' }));
  }

  function TopicTile(p) {
    var bars = waveBars(String(p.question || '').length, 7);
    return h(p.href ? 'a' : 'button', { className: cx('vx-tile', 'vx-tile--' + (p.tone || 'mint'), p.className), type: p.href ? undefined : 'button', href: p.href, onClick: p.onClick },
      p.category ? h('span', { className: 'vx-eyebrow vx-tile__cat' }, p.category) : null,
      h('span', { className: 'vx-tile__q' }, p.question),
      p.tag ? h(NewsTag, { kind: p.tag }) : null,
      h('span', { className: 'vx-tile__foot' },
        h('span', { className: 'vx-tile__wave', 'aria-hidden': 'true' }, bars.map(function (b, i) { return h('i', { key: i, style: { height: Math.round(4 + b * 10) } }); })),
        short(p.voices) + ' voices'));
  }

  function TrendingList(p) {
    return h('section', { className: cx('vx-card vx-trend', p.className), 'aria-labelledby': 'vx-trend-h' },
      h('h3', { className: 'vx-eyebrow vx-trend__head', id: 'vx-trend-h' }, h(Icon, { name: 'trending-up', size: 16, strokeWidth: 2.5 }), p.title || 'Trending'),
      h('ol', null, (p.items || []).map(function (it, i) {
        return h('li', { key: i }, h('a', { className: 'vx-trend__row vx-focus', href: it.href || '#' },
          h('span', { className: 'vx-trend__n', 'aria-hidden': 'true' }, i + 1),
          h('span', null, h('p', { className: 'vx-trend__q' }, it.question), h('span', { className: 'vx-trend__meta' }, short(it.voices) + ' voices' + (it.category ? ' · ' + it.category : '')))));
      })));
  }

  /* ---------- Conversation ---------- */
  function VoicePlayer(p) {
    var dur = p.duration || 10;
    var bars = useRef(waveBars(p.seed || dur * 3, p.bars || 34)).current;
    var ps = useState(!!p.playing); var playing = ps[0];
    var pr = useState(p.progress || 0); var prog = pr[0];
    var sp = useState(1); var speed = sp[0];
    useTicker(playing, 100, function () {
      pr[1](function (v) { var n = v + (0.1 * speed) / dur; if (n >= 1) { ps[1](false); if (p.onPlayingChange) p.onPlayingChange(false); return 0; } return n; });
    });
    function toggle() { var n = !playing; ps[1](n); if (p.onPlayingChange) p.onPlayingChange(n); }
    function seek(e) { var r = e.currentTarget.getBoundingClientRect(); pr[1](Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); }
    function keys(e) { if (e.key === 'ArrowRight') pr[1](Math.min(1, prog + 1 / dur)); if (e.key === 'ArrowLeft') pr[1](Math.max(0, prog - 1 / dur)); }
    var cut = Math.round(prog * bars.length);
    var left = playing || prog > 0 ? dur * (1 - prog) : dur;
    return h('div', { className: cx('vx-player', p.tone && 'vx-player--' + p.tone, p.className) },
      h('button', { type: 'button', className: 'vx-player__play', onClick: toggle, 'aria-label': (playing ? 'Pause' : 'Play') + ' voice, ' + dur + ' seconds' },
        h(Icon, { name: playing ? 'pause' : 'play', size: 22, fill: true, strokeWidth: 1.5 })),
      h('div', { className: 'vx-player__track', role: 'slider', tabIndex: 0, 'aria-label': 'Position', 'aria-valuemin': 0, 'aria-valuemax': dur, 'aria-valuenow': Math.round(prog * dur), 'aria-valuetext': clock(prog * dur) + ' of ' + clock(dur), onClick: seek, onKeyDown: keys },
        bars.map(function (b, i) { return h('i', { key: i, className: i < cut ? 'on' : '', style: { height: Math.round(6 + b * 30) } }); })),
      h('span', { className: 'vx-player__time' }, clock(left)),
      p.speed !== false ? h('button', { type: 'button', className: 'vx-player__speed', 'aria-label': 'Playback speed ' + speed + 'x', onClick: function () { sp[1](speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1); } }, speed + 'x') : null);
  }

  var REACTIONS = [
    { e: '🔥', name: 'Powerful' }, { e: '💀', name: 'Wild' }, { e: '❤️', name: 'Relatable' }, { e: '😂', name: 'Funny' }, { e: '😮', name: 'Surprising' },
    { e: '😢', name: 'Sad' }, { e: '👏', name: 'Well said' }, { e: '🤔', name: 'Thought-provoking' }, { e: '💯', name: 'Exactly' }, { e: '👎', name: 'Disagree' }
  ];
  function ReactionTray(p) {
    var st = useState(p.defaultValue || null); var val = p.value !== undefined ? p.value : st[0];
    function pick(name) { var n = name === val ? null : name; st[1](n); if (p.onChange) p.onChange(n); }
    return h('div', { className: cx('vx-react', p.className), role: 'radiogroup', 'aria-label': 'React to this voice. One reaction each.' },
      REACTIONS.map(function (r) {
        var on = r.name === val;
        return h('button', { key: r.name, type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', className: 'vx-react__btn', onClick: function () { pick(r.name); } },
          h('span', { 'aria-hidden': 'true' }, r.e), h('span', null, r.name));
      }),
      h('div', { className: 'vx-react__foot' },
        h('span', null, val ? 'Tap again to remove. Changing is free.' : 'One reaction each. Changing is free.'),
        p.freeLeft !== undefined ? h('span', { className: 'vx-num' }, p.freeLeft + ' free today') : null));
  }
  ReactionTray.reactions = REACTIONS;

  function AnswerCard(p) {
    var a = p.author || {};
    var lk = useState(!!p.liked); var liked = lk[0];
    var rc = useState(p.reaction || null); var reaction = rc[0];
    var tr = useState(!!p.trayOpen); var tray = tr[0];
    var uf = useState(!!p.unfolded); var open = uf[0];
    var pl = useState(false);
    var r = REACTIONS.filter(function (x) { return x.name === reaction; })[0];
    var likes = (p.likes || 0) + (liked && !p.liked ? 1 : 0) - (!liked && p.liked ? 1 : 0);
    return h('article', { className: cx('vx-answer', p.sponsor && 'vx-answer--sponsored', p.className), 'aria-label': (p.sponsor ? 'Sponsored voice from ' + p.sponsor : 'Voice from ' + (a.handle || a.name)) },
      h('div', { className: 'vx-answer__head' },
        h(Avatar, { name: a.name || a.handle, src: a.avatar, playing: pl[0] }),
        h('div', { className: 'vx-answer__who' },
          h('span', { className: 'vx-answer__name' }, a.handle || a.name, p.sponsor ? h(Icon, { name: 'badge-check', size: 16, label: 'Verified brand' }) : null),
          h('span', { className: 'vx-answer__time' }, p.time + (p.place ? ' · ' + p.place : ''))),
        p.sponsor ? h(Badge, { tone: 'sponsored' }) : null,
        h(IconButton, { icon: 'ellipsis', label: 'More: report, block, copy link', variant: 'ghost', size: 's' })),
      (p.label || p.tag) ? h('div', { className: 'vx-answer__labels' }, p.tag ? h(NewsTag, { kind: p.tag }) : null, p.label ? h(Badge, { tone: 'rank', icon: 'trending-up' }, p.label) : null) : null,
      p.voice ? h(VoicePlayer, { duration: p.voice.duration, seed: p.voice.seed, onPlayingChange: pl[1] }) : null,
      p.text ? h('p', { className: 'vx-answer__text' }, p.text) : null,
      p.voice && p.voice.transcript ? h('div', { className: 'vx-answer__tx' },
        h('button', { type: 'button', className: 'vx-link', 'aria-expanded': open ? 'true' : 'false', onClick: function () { uf[1](!open); } },
          h(Icon, { name: 'captions', size: 18 }), open ? 'Hide transcript' : 'Read transcript'),
        h('div', { className: cx('vx-answer__unfold', open && 'is-open') }, h('div', null, h('p', { className: 'vx-answer__transcript' }, h('b', null, 'Transcript'), p.voice.transcript)))) : null,
      p.reactions ? h('div', { className: 'vx-answer__sum' }, h('span', { className: 'e', 'aria-hidden': 'true' }, p.reactions.top.join(' ')), fmt(p.reactions.total) + ' reactions') : null,
      h('div', { className: 'vx-answer__actions' },
        tray ? h('div', { className: 'vx-answer__tray' }, h(ReactionTray, { value: reaction, freeLeft: p.freeReactions, onChange: function (v) { rc[1](v); tr[1](false); } })) : null,
        h('button', { type: 'button', className: 'vx-act', 'aria-pressed': liked ? 'true' : 'false', 'aria-label': 'Like, ' + likes + ' likes', onClick: function () { lk[1](!liked); } },
          h(Icon, { name: 'heart', size: 20, fill: liked }), short(likes)),
        h('button', { type: 'button', className: cx('vx-act', r && 'vx-act--reacted'), 'aria-expanded': tray ? 'true' : 'false', 'aria-label': r ? 'Your reaction: ' + r.name + '. Change' : 'React', onClick: function () { tr[1](!tray); } },
          r ? h('span', { className: 'vx-act__emoji', 'aria-hidden': 'true' }, r.e) : h(Icon, { name: 'smile-plus', size: 20 }), r ? r.name : 'React'),
        h('button', { type: 'button', className: 'vx-act', 'aria-label': 'Reply, ' + (p.replies || 0) + ' replies' }, h(Icon, { name: 'message-circle', size: 20 }), short(p.replies || 0)),
        h('button', { type: 'button', className: 'vx-act vx-act--end', 'aria-label': 'Share' }, h(Icon, { name: 'share-2', size: 20 }), p.compact ? null : 'Share')),
      p.sponsor && p.cta ? h(Button, { variant: 'secondary', size: 's', iconEnd: 'chevron-right', href: p.cta.href || '#' }, p.cta.label) : null);
  }

  function ProposalCard(p) {
    var su = useState(null); var mine = su[0];
    return h('article', { className: cx('vx-prop', p.className) },
      h('div', { className: 'vx-answer__head' },
        h(Avatar, { name: p.author, size: 's' }),
        h('div', { className: 'vx-answer__who' }, h('span', { className: 'vx-answer__name' }, p.author), h('span', { className: 'vx-answer__time' }, p.time)),
        h(Badge, { tone: 'proposed', icon: 'lightbulb' })),
      h('p', { className: 'vx-prop__text' }, p.text),
      p.grouped ? h('span', { className: 'vx-prop__group' }, h(Icon, { name: 'messages-square', size: 16 }), p.grouped + ' similar proposals grouped here') : null,
      h('div', { className: 'vx-prop__acts' },
        h(TopicChip, { icon: 'check', label: 'Support', count: (p.supports || 0) + (mine === 'support' ? 1 : 0), selected: mine === 'support', onClick: function () { su[1](mine === 'support' ? null : 'support'); } }),
        h(TopicChip, { icon: 'circle-x', label: 'Challenge', count: (p.challenges || 0) + (mine === 'challenge' ? 1 : 0), selected: mine === 'challenge', onClick: function () { su[1](mine === 'challenge' ? null : 'challenge'); } }),
        h(TopicChip, { icon: 'plus', label: 'Improve it', selected: false })));
  }

  /* ---------- Speak ---------- */
  function FreePosts(p) {
    var total = p.total || 10, left = Math.max(0, p.left === undefined ? total : p.left);
    var tone = left === 0 ? 'none' : left === 1 ? 'last' : '';
    var text = left === 0 ? 'Free posts used' : left === 1 ? 'Last free post' : left + ' free posts left';
    var dots = []; for (var i = 0; i < total; i++) dots.push(h('i', { key: i, className: i < total - left ? 'used' : '' }));
    return h('span', { className: cx('vx-free', tone && 'vx-free--' + tone, p.pill && 'vx-free--pill', p.className), 'aria-label': text + ' of ' + total },
      h('span', { className: 'vx-free__dots', 'aria-hidden': 'true' }, dots), h('span', { 'aria-hidden': 'true' }, text));
  }

  function Composer(p) {
    var max = p.maxLength || 500;
    var tx = useState(p.defaultValue || ''); var text = tx[0];
    var it = useState(p.intent || null);
    var tg = useState(p.newsTag || null);
    var n = text.length;
    var free = p.freeLeft === undefined ? 7 : p.freeLeft;
    return h('section', { className: cx('vx-compose', p.className), 'aria-label': p.replyTo ? 'Reply' : 'Your answer' },
      h('label', { className: 'vx-compose__label', htmlFor: 'vx-compose-ta' }, p.replyTo ? 'Reply to ' + p.replyTo : (p.label || 'Your answer'),
        p.onVoice !== false ? h(Button, { variant: 'ghost', size: 's', icon: 'mic', onClick: p.onVoice }, 'Use voice') : null),
      p.replyTo ? h('div', { className: 'vx-intent', role: 'group', 'aria-label': 'How are you replying?' },
        [['agree', 'I agree', 'check'], ['disagree', 'I disagree', 'circle-x'], ['experience', 'My experience', 'user']].map(function (o) {
          return h(TopicChip, { key: o[0], icon: o[2], label: o[1], selected: it[0] === o[0], onClick: function () { it[1](it[0] === o[0] ? null : o[0]); } });
        })) : null,
      h('div', { className: 'vx-compose__area' },
        h('textarea', { id: 'vx-compose-ta', className: 'vx-compose__ta', placeholder: p.placeholder || 'Say it in your own words', value: text, maxLength: max, rows: 4,
          'aria-describedby': 'vx-compose-count', onChange: function (e) { tx[1](e.target.value); } }),
        h('span', { id: 'vx-compose-count', className: cx('vx-compose__count', n >= max ? 'is-over' : n >= max * 0.9 && 'is-near') }, fmt(n) + ' / ' + fmt(max))),
      p.showTags ? h('div', { className: 'vx-tagpick', role: 'group', 'aria-label': 'Is this news?' },
        h('span', { className: 'vx-caption' }, 'Is this news? Pick a tag so readers know.'),
        h('div', { className: 'vx-tagpick__row' },
          h(TopicChip, { className: 'is-none', label: 'Not news', selected: tg[0] === 'none', onClick: function () { tg[1]('none'); } }),
          h(TopicChip, { className: 'is-unverified', icon: 'shield-alert', label: 'Unverified News', selected: tg[0] === 'unverified', onClick: function () { tg[1]('unverified'); } }),
          h(TopicChip, { className: 'is-gossip', icon: 'messages-square', label: 'Gossip', selected: tg[0] === 'gossip', onClick: function () { tg[1]('gossip'); } }),
          h(TopicChip, { icon: 'lock', label: 'Verified News', disabled: true, 'aria-label': 'Verified News, editors only' }))) : null,
      free > 0 ? null : h('div', { className: 'vx-compose__cost' }, h(Icon, { name: 'coins', size: 18 }), h('span', null, 'This post uses ', h('b', null, p.cost || '0.5 unit (₦6.90)'), '. Balance: ' + (p.balance || '12.5 units') + '.')),
      h('div', { className: 'vx-compose__foot' },
        free > 0 ? h(FreePosts, { left: free }) : h('span', { className: 'vx-caption', style: { marginRight: 'auto' } }, 'Free posts used'),
        h(Button, { icon: 'send', disabled: n === 0, onClick: p.onSend }, free > 0 ? 'Post' : 'Post for ' + (p.costShort || '0.5 unit'))));
  }

  function Recorder(p) {
    var limit = p.limit || 10;
    var ss = useState(p.state || 'idle'); var state = ss[0];
    var el = useState(p.state === 'preview' ? (p.recorded || 8) : p.state === 'recording' ? (p.elapsed || 3.4) : 0); var t = el[0];
    var lv = useState(waveBars(5, 28));
    useTicker(state === 'recording', 100, function () {
      el[1](function (v) { var n = v + 0.1; if (n >= limit) { ss[1]('preview'); return limit; } return n; });
      lv[1](waveBars(Math.floor(Math.random() * 999) + 1, 28));
    });
    var R = 98, C = 2 * Math.PI * R;
    var frac = state === 'idle' ? 0 : Math.min(1, t / limit);
    var left = Math.max(0, limit - t);
    var free = p.freeLeft === undefined ? 7 : p.freeLeft;
    var hint;
    if (state === 'idle') hint = h('p', { className: 'vx-rec__hint' }, 'Tap to record. You have ', h('b', null, limit + ' seconds'), free > 0 ? ' on a free post.' : ' for 1 unit (₦13.80).');
    else if (state === 'recording') hint = h('p', { className: 'vx-rec__hint', 'aria-live': 'polite' }, h('b', null, Math.ceil(left) + ' seconds left'), '. It stops by itself at ' + limit + '.');
    else hint = h('p', { className: 'vx-rec__hint' }, 'Listen back. Nothing posts until you tap Send.');
    return h('section', { className: cx('vx-rec', p.className), 'aria-label': 'Voice recorder' },
      h('div', { className: 'vx-rec__top' },
        state === 'recording' ? h('span', { className: 'vx-rec__dot' }, 'Recording') : h(FreePosts, { left: free, pill: true }),
        p.onClose ? h(IconButton, { icon: 'x', label: 'Close recorder', variant: 'dark', size: 's', onClick: p.onClose }) : null),
      h('p', { className: 'vx-rec__q' }, p.question),
      state !== 'preview' ? h('div', { className: 'vx-rec__stage' },
        h('svg', { className: 'vx-rec__ring', viewBox: '0 0 208 208', 'aria-hidden': 'true' },
          h('circle', { className: 'bg', cx: 104, cy: 104, r: R }),
          h('circle', { className: 'fg', cx: 104, cy: 104, r: R, strokeDasharray: C, strokeDashoffset: C * (1 - frac) })),
        h('button', { type: 'button', className: cx('vx-rec__btn', state === 'recording' && 'is-recording'), 'aria-label': state === 'recording' ? 'Stop recording' : 'Start recording',
          onClick: function () { if (state === 'recording') ss[1]('preview'); else { el[1](0); ss[1]('recording'); } } },
          h(Icon, { name: state === 'recording' ? 'square' : 'mic', size: state === 'recording' ? 34 : 44, fill: state === 'recording', strokeWidth: 2 }))) : null,
      state === 'preview' ? h('div', { className: 'vx-rec__player' }, h(VoicePlayer, { duration: Math.round(t) || 8, tone: 'forest', seed: 11 })) : null,
      state === 'preview' ? null : h('span', { className: 'vx-rec__timer', 'aria-hidden': state === 'recording' ? 'true' : undefined }, state === 'recording' ? clock(Math.ceil(left)) : clock(limit)),
      state === 'recording' ? h('div', { className: 'vx-rec__live', 'aria-hidden': 'true' }, lv[0].map(function (b, i) { return h('i', { key: i, style: { height: Math.round(6 + b * 38) } }); })) : null,
      hint,
      state === 'preview' ? h('div', { className: 'vx-rec__actions' },
        h(Button, { variant: 'onforest', icon: 'rotate-ccw', onClick: function () { el[1](0); ss[1]('idle'); } }, 'Re-record'),
        h(Button, { variant: 'onforest', icon: 'trash-2', onClick: function () { el[1](0); ss[1]('idle'); } }, 'Delete'),
        h(Button, { size: 'l', icon: 'send', onClick: p.onSend }, free > 0 ? 'Send' : 'Send for 1 unit')) : null,
      state === 'idle' && p.passes !== false ? h('div', { className: 'vx-rec__more' },
        h('p', null, 'Need more time?'),
        h('div', { className: 'vx-rec__pass' },
          (p.passes || [{ name: 'Voice 30', detail: '10.5 units · ₦145' }, { name: 'Voice 60', detail: '14.5 units · ₦200' }]).map(function (ps) {
            return h(Button, { key: ps.name, variant: 'onforest' }, ps.name, h('small', null, ps.detail));
          }))) : null);
  }

  /* ---------- Polls and results ---------- */
  function Poll(p) {
    var opts = p.options || [];
    var total = p.total || opts.reduce(function (s, o) { return s + (o.votes || 0); }, 0);
    var st = useState(p.state || 'vote'); var state = st[0];
    var sel = useState(p.selected || null); var chosen = sel[0];
    var grow = useState(p.state === 'results' ? false : true);
    useEffect(function () { if (state === 'results') { var id = setTimeout(function () { grow[1](true); }, 40); return function () { clearTimeout(id); }; } return undefined; }, [state]);
    var lead = opts.reduce(function (m, o) { return (o.votes || 0) > (m.votes || 0) ? o : m; }, opts[0] || {});
    var chosenOpt = opts.filter(function (o) { return o.id === chosen; })[0];
    var head = h('div', { className: 'vx-poll__head' },
      p.sponsor ? h(Badge, { tone: 'sponsored' }, 'Sponsored poll') : h(Badge, { tone: 'green', icon: 'vote' }, 'Open poll'),
      state === 'results' && p.live !== false ? h(Badge, { tone: 'live' }) : null,
      p.closesIn ? h('span', { className: 'vx-poll__time' }, h(Icon, { name: 'clock', size: 16 }), 'Closes in ' + p.closesIn) : null);
    var body;
    if (state === 'vote') {
      body = h(Fragment, null,
        h('div', { className: 'vx-poll__opts', role: 'radiogroup', 'aria-label': p.question },
          opts.map(function (o) {
            var on = o.id === chosen;
            return h('button', { key: o.id, type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', className: 'vx-opt', onClick: function () { sel[1](o.id); } },
              h('span', { className: 'vx-opt__radio' }, on ? h(Icon, { name: 'check', size: 14, strokeWidth: 3.5 }) : null), o.label);
          })),
        h(Button, { block: true, size: 'l', disabled: !chosen, onClick: function () { st[1]('confirm'); } }, 'Vote'),
        h('p', { className: 'vx-poll__fine' }, p.costNote || 'One vote per account. Voting is free today: 3 of 3 votes left.'));
    } else if (state === 'confirm') {
      body = h(Fragment, null,
        h('div', { className: 'vx-poll__confirm', role: 'group', 'aria-label': 'Confirm your vote' },
          h('p', { className: 'vx-eyebrow', style: { color: 'var(--ink-2)' } }, 'Your vote'),
          h('p', { className: 'vx-poll__choice' }, chosenOpt ? chosenOpt.label : ''),
          h('p', { className: 'vx-poll__fine' }, 'One vote per account. You cannot change it after you confirm.'),
          h('p', { className: 'vx-poll__fine' }, h(Icon, { name: 'coins', size: 14, style: { display: 'inline', verticalAlign: '-2px', marginRight: 4 } }), p.cost || 'Free: 2 of 3 free votes left today.')),
        h('div', { className: 'vx-poll__actions' },
          h(Button, { variant: 'secondary', onClick: function () { st[1]('vote'); } }, 'Back'),
          h(Button, { icon: 'check', onClick: function () { grow[1](false); st[1]('results'); } }, 'Confirm vote')));
    } else {
      body = h(Fragment, null,
        h('ul', { className: 'vx-res' }, opts.map(function (o) {
          var pct = total ? Math.round((o.votes || 0) * 100 / total) : 0;
          var isLead = o.id === lead.id;
          return h('li', { key: o.id, className: cx('vx-res__row', isLead && 'is-lead') },
            h('span', { className: 'vx-res__label' }, o.label, o.id === chosen ? h(Badge, { tone: 'you' }) : null, isLead ? h(Badge, { tone: 'leading' }) : null),
            h('span', { className: 'vx-res__pct' }, pct + '%'),
            h('span', { className: 'vx-res__bar', role: 'img', 'aria-label': pct + ' percent' }, h('i', { style: { width: (grow[0] ? pct : 0) + '%' } })),
            h('span', { className: 'vx-res__votes' }, fmt(o.votes || 0) + ' votes'));
        })),
        h('div', { className: 'vx-poll__foot' },
          h('span', { className: 'vx-poll__total' }, fmt(total) + ' votes', p.closesIn ? h('span', { className: 'vx-caption' }, '· ' + p.closesIn + ' left') : null),
          h('span', { className: 'vx-caption' }, 'Open poll: one vote per account. It shows what voters here think, not the whole country.'),
          p.sponsor ? h('span', { className: 'vx-poll__presented' }, 'Results presented by ' + p.sponsor) : null,
          p.onExplain !== false ? h('button', { type: 'button', className: 'vx-link', onClick: p.onExplain }, h(Icon, { name: 'mic', size: 18 }), 'Explain your vote') : null));
    }
    return h('section', { className: cx('vx-poll', p.sponsor && 'vx-poll--sponsored', p.className), 'aria-label': 'Poll' }, head, h('h3', { className: 'vx-poll__q' }, p.question), body);
  }

  function ResultComment(p) {
    var a = p.author || {};
    var ok = p.status === 'verified';
    return h('article', { className: cx('vx-result', ok && 'vx-result--verified', p.isNew && 'is-new', p.className) },
      h('div', { className: 'vx-answer__head' },
        h(Avatar, { name: a.name || a.handle, size: 's' }),
        h('div', { className: 'vx-answer__who' }, h('span', { className: 'vx-answer__name' }, a.handle || a.name), h('span', { className: 'vx-answer__time' }, p.time)),
        h(VerifyMark, { status: p.status, pill: true })),
      h('div', { className: 'vx-result__place' }, h(Icon, { name: 'map-pin', size: 18 }), p.place),
      h('dl', { className: 'vx-result__figs' }, (p.figures || []).map(function (f, i) {
        return h('div', { key: i, className: 'vx-result__fig' }, h('dt', null, f.label), h('dd', null, f.prefix ? h('small', { className: 'pre' }, f.prefix) : null, f.value, f.unit ? h('small', null, f.unit) : null));
      })),
      p.note ? h('p', { className: 'vx-result__note' }, p.note) : null,
      h('div', { className: 'vx-result__foot' },
        h('span', { className: 'vx-caption' }, ok ? (p.checked || 'Checked by the WAWU team') : (p.checked || 'Not checked yet. Treat with care.')),
        h('span', null,
          h(IconButton, { icon: 'message-circle', label: 'Reply', variant: 'ghost', size: 's' }),
          h(IconButton, { icon: 'flag', label: 'Report wrong numbers', variant: 'ghost', size: 's' }))));
  }

  function LiveThread(p) {
    var items = p.items || [];
    var fl = useState(p.filter || 'all'); var filter = fl[0];
    var nw = useState(p.newCount || 0);
    var ex = useState([]);
    var all = ex[0].concat(items);
    var shown = all.filter(function (c) { return filter === 'all' || c.status === 'verified'; });
    var verifiedCount = all.filter(function (c) { return c.status === 'verified'; }).length;
    return h('section', { className: cx('vx-thread', p.className), 'aria-label': p.title || 'Live results' },
      h('div', { className: 'vx-thread__head' },
        h('div', { className: 'vx-thread__title' }, h('h3', null, p.title || 'Live results'), h(Badge, { tone: 'live' })),
        h('p', { className: 'vx-thread__explain' }, p.explain || 'People post the numbers they see. Verified means the WAWU team checked them. WAWU does not publish its own count.')),
      h('div', { className: 'vx-thread__bar' },
        h(Tabs, { variant: 'segmented', label: 'Show', value: filter, onChange: fl[1], items: [{ id: 'all', label: 'All', count: (p.total || all.length) }, { id: 'verified', label: 'Verified only', icon: 'badge-check', count: (p.verifiedTotal || verifiedCount) }] }),
        nw[0] > 0 ? h('button', { type: 'button', className: 'vx-newpill', 'aria-live': 'polite', onClick: function () {
          var add = (p.incoming || []).slice(0, nw[0]).map(function (c) { var o = {}; for (var k in c) o[k] = c[k]; o.isNew = true; return o; });
          ex[1](add.concat(ex[0])); nw[1](0);
        } }, h(Icon, { name: 'arrow-up', size: 18, strokeWidth: 2.5 }), nw[0] + (nw[0] === 1 ? ' new result' : ' new results')) : null),
      h('div', { className: 'vx-thread__list' }, shown.length ? shown.map(function (c, i) { return h(ResultComment, Object.assign({ key: (c.id || i) + (c.isNew ? 'n' : '') }, c)); }) :
        h(EmptyState, { icon: 'badge-check', title: 'Nothing verified yet', body: 'The WAWU team checks numbers as they come in. Switch to All to see every post.' })));
  }

  function WeeklyReportCard(p) {
    var mood = p.mood || [];
    return h('article', { className: cx('vx-report', p.className), 'aria-label': 'Weekly report' },
      h('div', { className: 'vx-report__in' },
        h('div', { className: 'vx-report__head' },
          h('span', { className: 'vx-eyebrow vx-report__week' }, p.week),
          h('h3', { className: 'vx-report__title' }, p.title || 'What Nigerians said this week'),
          h('span', { className: 'vx-report__label' }, h(Icon, { name: 'user-check', size: 16, strokeWidth: 2.5 }), 'AI-assisted · Human-reviewed')),
        h('div', { className: 'vx-mood' },
          h('span', { className: 'vx-eyebrow vx-mood__eye' }, 'The mood'),
          h('p', { className: 'vx-mood__line' }, p.moodLine),
          h('ul', { className: 'vx-mood__rows' }, mood.map(function (m) {
            var d = m.delta || 0;
            return h('li', { key: m.label, className: 'vx-mood__row' }, h('span', null, m.label),
              h('span', { className: 'vx-mood__bar', 'aria-hidden': 'true' }, h('i', { style: { width: m.pct + '%' } })),
              h('span', { className: 'vx-mood__pct' }, m.pct + '%'),
              h('span', { className: 'vx-mood__delta', 'aria-label': (d > 0 ? 'up ' : d < 0 ? 'down ' : 'no change ') + Math.abs(d) + ' points on last week' }, (d > 0 ? '↑' : d < 0 ? '↓' : '') + (d ? Math.abs(d) : '0')));
          }))),
        h('div', { className: 'vx-report__sec' },
          h('h4', { className: 'vx-eyebrow' }, 'Main arguments'),
          h('ol', { className: 'vx-themes' }, (p.themes || []).map(function (t, i) { return h('li', { key: i }, t.text, h('span', null, short(t.voices) + ' voices')); })),
          p.poll ? h('div', { className: 'vx-report__poll' }, h('b', null, p.poll.pct + '%'), h('p', null, p.poll.text)) : null),
        h('div', { className: 'vx-report__foot' },
          h('p', { className: 'vx-report__based' }, 'Based on ' + fmt(p.voices) + ' voices and ' + fmt(p.votes) + ' votes. ' + (p.updated || '') + ' People are split on some points; this is a summary, not a consensus.'),
          h('div', { className: 'vx-report__btns' },
            h(Button, { variant: 'secondary', icon: 'share-2', size: 's' }, 'Share'),
            h(Button, { variant: 'secondary', icon: 'file-down', size: 's' }, 'Download PDF')))));
  }

  /* ---------- Sponsored ---------- */
  function AdSlot(p) {
    var v = p.variant || 'card';
    var brandMark = h('span', { className: 'vx-ad__logo', 'aria-hidden': 'true' }, initials(p.brand));
    if (v === 'banner') {
      return h('aside', { className: 'vx-ad vx-ad--banner', 'aria-label': 'Ad from ' + p.brand },
        brandMark,
        h('div', { className: 'vx-ad__txt' }, h('span', { className: 'vx-ad__brand' }, h(Badge, { tone: 'ad' }), p.brand), h('p', { className: 'vx-ad__head' }, p.headline)),
        h(Button, { variant: 'secondary', size: 's', href: p.href || '#' }, p.cta || 'Open'));
    }
    return h('aside', { className: cx('vx-ad', v === 'audio' && 'vx-ad--audio', p.className), 'aria-label': 'Ad from ' + p.brand },
      h('div', { className: 'vx-ad__top' }, h('span', { className: 'vx-ad__brand' }, brandMark, p.brand), h(Badge, { tone: 'ad' })),
      h('p', { className: 'vx-ad__head' }, p.headline),
      p.body ? h('p', { className: 'vx-ad__body' }, p.body) : null,
      v === 'audio' ? h(VoicePlayer, { duration: p.duration || 15, seed: 21, tone: 'surface' }) : null,
      h('div', { className: 'vx-ad__top' },
        h(Button, { variant: 'secondary', size: 's', iconEnd: 'chevron-right', href: p.href || '#' }, p.cta || 'Learn more'),
        h('button', { type: 'button', className: 'vx-ad__why' }, 'Why this ad?')));
  }

  function SponsoredSurvey(p) {
    var sel = useState(null);
    return h('section', { className: cx('vx-poll vx-poll--sponsored vx-survey', p.className), 'aria-label': 'Sponsored Survey from ' + p.brand },
      h('div', { className: 'vx-poll__head' }, h(Badge, { tone: 'sponsored', icon: 'clipboard-list' }, 'Sponsored Survey'), h('span', { className: 'vx-ad__brand' }, 'by ' + p.brand)),
      h('h3', { className: 'vx-poll__q' }, p.question),
      p.options ? h('div', { className: 'vx-poll__opts', role: 'radiogroup', 'aria-label': p.question }, p.options.map(function (o, i) {
        var on = sel[0] === i;
        return h('button', { key: i, type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', className: 'vx-opt', onClick: function () { sel[1](i); } },
          h('span', { className: 'vx-opt__radio' }, on ? h(Icon, { name: 'check', size: 14, strokeWidth: 3.5 }) : null), o);
      })) : null,
      h('div', { className: 'vx-poll__actions' },
        h(Button, { disabled: p.options ? sel[0] === null : false }, p.options ? 'Send answer' : 'Answer by voice'),
        p.voiceToo ? h(Button, { variant: 'secondary', icon: 'mic' }, 'Say why') : null),
      h('p', { className: 'vx-survey__privacy' }, h(Icon, { name: 'lock', size: 16 }), (p.brand + ' sees totals only, never your name or number. ') + (p.questions ? p.questions + ' questions · about ' + p.minutes + ' min' : '')));
  }

  /* ---------- Sharing ---------- */
  function ShareCard(p) {
    var kind = p.kind || 'question';
    var wrap = useRef(null);
    var sc = useState(p.scale || 1);
    useEffect(function () {
      if (p.scale) return undefined;
      function fit() { if (wrap.current) sc[1](Math.min(1, wrap.current.clientWidth / 1200)); }
      fit(); window.addEventListener('resize', fit); return function () { window.removeEventListener('resize', fit); };
    }, [p.scale]);
    var s = sc[0];
    var top = h('div', { className: 'vx-share__top' },
      h('img', { className: 'vx-share__logo', src: ASSETS.wordmark, alt: 'VOICES' }),
      p.tag ? h(NewsTag, { kind: p.tag }) : null,
      h('span', { className: 'vx-share__topic' }, (p.country || 'Nigeria') + ' · ' + p.topic));
    var mid;
    if (kind === 'voice') mid = h(Fragment, null, h('p', { className: 'vx-share__q', style: { fontSize: 36, lineHeight: '42px', color: 'var(--on-forest-2)' } }, p.question), h('p', { className: 'vx-share__quote' }, '“' + p.quote + '”'));
    else if (kind === 'poll' || kind === 'weekly') mid = h(Fragment, null, h('p', { className: 'vx-share__q' }, p.question),
      h('div', { className: 'vx-share__poll' }, (p.poll || []).map(function (r, i) {
        return h('div', { key: i }, h('div', { className: 'vx-share__pollrow' }, h('span', null, r.label), h('span', null, r.pct + '%' + (i === 0 && kind === 'poll' && p.open ? ' so far' : ''))), h('div', { className: 'vx-share__pollbar' }, h('i', { style: { width: r.pct + '%', background: i === 0 ? 'var(--sun)' : 'var(--on-forest-2)' } })));
      })));
    else mid = h(Fragment, null, h('p', { className: 'vx-share__q' }, p.question),
      h('div', { className: 'vx-share__args' }, (p.args || []).map(function (a, i) { return h('div', { key: i, className: 'vx-share__arg' }, a.text, h('small', null, short(a.voices) + ' voices')); })));
    return h('div', { className: cx('vx-sharewrap', p.className), ref: wrap, style: { height: 630 * s } },
      h('div', { className: 'vx-share', 'data-theme': 'light', role: 'img', 'aria-label': 'Share card: ' + p.question, style: { transform: 'scale(' + s + ')' } },
        h('img', { className: 'vx-share__motif', src: ASSETS.markWhite, alt: '', 'aria-hidden': 'true' }),
        top, mid,
        h('div', { className: 'vx-share__foot' },
          h('span', { className: 'vx-share__based' }, h('b', null, p.summary || 'People are split so far.'), h('br'), 'Based on ' + short(p.voices) + ' voices · updated ' + (p.updated || 'just now'), h('br'), p.link || 'wawuafrica.com/voices'),
          h('span', { className: 'vx-share__cta' }, h(Icon, { name: 'mic', size: 32, strokeWidth: 2.5 }), 'Add your voice'))));
  }

  /* ---------- Profile and units ---------- */
  function UnitsChip(p) {
    var u = parseFloat(p.units);
    var state = p.state || (u === 0 ? 'empty' : u < 2 ? 'low' : '');
    return h('button', { type: 'button', className: cx('vx-units', state && 'vx-units--' + state, p.className), onClick: p.onClick,
      'aria-label': state === 'empty' ? 'No Voice Units. Get units' : p.units + ' Voice Units. Open wallet' },
      h('span', { className: 'vx-units__coin', 'aria-hidden': 'true' }, h(Icon, { name: 'coins', size: 18, strokeWidth: 2.25 })),
      state === 'empty' ? 'Get Voice Units' : h(Fragment, null, p.units + ' units', state === 'low' ? h('small', null, 'Low') : (p.freeLeft > 0 ? h('small', null, '· ' + p.freeLeft + ' free') : null)));
  }

  function ProfileHeader(p) {
    var pl = useState(false);
    var bars = waveBars(9, 18);
    return h('section', { className: cx('vx-prof', p.className), 'aria-label': 'Profile' },
      h('div', { className: 'vx-prof__in' },
        h('div', { className: 'vx-prof__top' },
          h(Avatar, { name: p.name, src: p.avatar, size: 'l', playing: pl[0] }),
          h('div', { className: 'vx-prof__id' },
            h('h2', { className: 'vx-prof__handle' }, p.handle),
            h('span', { className: 'vx-prof__meta' }, [p.place, p.joined].filter(Boolean).join(' · ')))),
        h('button', { type: 'button', className: cx('vx-vcard', pl[0] && 'is-playing'), 'aria-pressed': pl[0] ? 'true' : 'false', onClick: function () { pl[1](!pl[0]); } },
          h('span', { className: 'vx-vcard__play' }, h(Icon, { name: pl[0] ? 'pause' : 'play', size: 22, fill: true, strokeWidth: 1.5 })),
          h('span', { className: 'vx-vcard__txt' }, h('b', null, pl[0] ? 'Playing Voice Card' : 'Play Voice Card'), h('span', null, 'Voice bio · ' + clock(p.voiceCard || 8))),
          h('span', { className: 'vx-vcard__wave', 'aria-hidden': 'true' }, bars.map(function (b, i) { return h('i', { key: i, style: { height: Math.round(6 + b * 22), animationDelay: (i * 60) + 'ms' } }); }))),
        h('div', { className: 'vx-prof__stats' }, (p.stats || []).map(function (s) { return h('div', { key: s.label, className: 'vx-stat' }, h('b', null, short(s.value)), h('span', null, s.label)); })),
        h('div', { className: 'vx-prof__row' },
          p.units !== undefined ? h(UnitsChip, { units: p.units, freeLeft: p.freeLeft }) : null,
          p.referral ? h('span', { className: 'vx-refcode' }, p.referral, h(IconButton, { icon: 'copy', label: 'Copy referral code', variant: 'ghost', size: 's' })) : null,
          p.own ? h(Button, { variant: 'secondary', size: 's', icon: 'settings' }, 'Edit profile') : null)));
  }

  var TIERS = [
    { id: 'spark', name: 'Spark', price: 138, units: 10, bonus: 0 },
    { id: 'chat', name: 'Chat', price: 345, units: 26, bonus: 1 },
    { id: 'buzz', name: 'Buzz', price: 690, units: 55, bonus: 5 },
    { id: 'loud', name: 'Loud', price: 1380, units: 115, bonus: 15 },
    { id: 'mega', name: 'Mega', price: 3450, units: 310, bonus: 60 },
    { id: 'boss', name: 'Boss', price: 6900, units: 650, bonus: 150 }
  ];
  function naira(n) { return '₦' + fmt(n); }
  function BuyUnitsSheet(p) {
    var tiers = p.tiers || TIERS;
    var st = useState(p.selected || 'buzz'); var sel = st[0];
    var m = useState('card');
    var t = tiers.filter(function (x) { return x.id === sel; })[0] || tiers[0];
    var content = h(Fragment, null,
      p.paywall ? h('div', { className: 'vx-paywall', role: 'status' }, h(Icon, { name: 'triangle-alert', size: 20 }),
        h('span', null, 'You have used your 10 free posts. Get Voice Units from ₦138. Your draft is saved and posts when your units arrive.')) : null,
      h('div', { className: 'vx-tiers', role: 'radiogroup', 'aria-label': 'Unit packs' }, tiers.map(function (x) {
        var on = x.id === sel;
        return h('button', { key: x.id, type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', className: 'vx-tier', onClick: function () { st[1](x.id); } },
          h('span', { className: 'vx-tier__name' }, x.name),
          h('span', { className: 'vx-tier__units' }, fmt(x.units), h('small', null, 'units')),
          h('span', { className: 'vx-tier__price' }, naira(x.price)),
          h('span', { className: 'vx-tier__per' }, '₦' + (x.price / x.units).toFixed(2) + ' a unit'),
          x.bonus ? h('span', { className: 'vx-tier__bonus' }, h(Badge, { tone: 'sun' }, '+' + x.bonus + ' bonus')) : null,
          on ? h('span', { className: 'vx-tier__check', 'aria-hidden': 'true' }, h(Icon, { name: 'check', size: 14, strokeWidth: 3.5 })) : null);
      })),
      h('div', { className: 'vx-field' }, h('span', { className: 'vx-field__label' }, 'Pay with'),
        h(Tabs, { variant: 'segmented', block: true, label: 'Payment method', value: m[0], onChange: m[1], items: [{ id: 'card', label: 'Card' }, { id: 'transfer', label: 'Transfer' }, { id: 'ussd', label: 'USSD' }] })),
      p.offer ? h('div', { className: 'vx-offer' }, h(Badge, { tone: 'sponsored' }, 'Offer'), h('span', null, p.offer)) : null);
    var foot = h('div', { className: 'vx-sheet__foot' },
      h(Button, { size: 'l', block: true, icon: 'lock' }, 'Pay ' + naira(t.price) + ' for ' + fmt(t.units) + ' units'),
      h('p', { className: 'vx-sheet__fine' }, 'You see the full price before you pay. Units cannot be cashed out or sent to others. Reading, listening, liking and sharing stay free.'));
    return h(Sheet, { title: 'Get Voice Units', subtitle: p.balance ? 'Balance: ' + p.balance : undefined, variant: p.variant, inline: p.inline, footer: foot, onClose: p.onClose }, content);
  }
  BuyUnitsSheet.tiers = TIERS;

  var NOTE_IC = { reply: 'message-circle', reaction: 'smile-plus', poll: 'chart-column', daily: 'mic', tag: 'shield-alert', units: 'coins', verified: 'badge-check' };
  function NotificationRow(p) {
    var type = p.type || 'reply';
    return h('a', { className: cx('vx-note vx-focus', p.unread && 'is-unread', p.className), href: p.href || '#' },
      p.actor ? h('span', { style: { position: 'relative', display: 'block', flex: 'none', height: 40 } }, h(Avatar, { name: p.actor }), p.emoji ? h('span', { className: 'vx-note__emoji', style: { position: 'absolute', right: -4, bottom: -4, fontSize: 16 }, 'aria-hidden': 'true' }, p.emoji) : null)
        : h('span', { className: cx('vx-note__ic', 'vx-note__ic--' + type) }, h(Icon, { name: NOTE_IC[type] || 'bell', size: 20 })),
      h('span', { className: 'vx-note__txt' }, p.children, h('span', { className: 'vx-note__time' }, p.time + (p.unread ? ' · New' : ''))));
  }

  /* ---------- Feedback ---------- */
  var BANNER_IC = { info: 'info', offline: 'wifi-off', warning: 'triangle-alert', danger: 'circle-x', success: 'circle-check' };
  function Banner(p) {
    var tone = p.tone || 'info';
    return h('div', { className: cx('vx-banner', 'vx-banner--' + tone, p.className), role: tone === 'danger' ? 'alert' : 'status' },
      h(Icon, { name: p.icon || BANNER_IC[tone], size: 22, className: 'vx-banner__ic' }),
      h('div', { className: 'vx-banner__txt' }, p.title ? h('b', null, p.title) : null, p.children),
      p.action ? h(Button, { variant: 'secondary', size: 's', icon: p.actionIcon, onClick: p.onAction }, p.action) : null,
      p.onClose ? h(IconButton, { icon: 'x', label: 'Dismiss', variant: 'ghost', size: 's', onClick: p.onClose }) : null);
  }

  function Toast(p) {
    var tone = p.tone || 'success';
    var ic = p.icon || (tone === 'danger' ? 'circle-x' : tone === 'info' ? 'info' : 'check');
    return h('div', { className: cx('vx-toast', 'vx-toast--' + tone, p.className), role: 'status', 'aria-live': 'polite' },
      h('span', { className: 'vx-toast__ic' }, h(Icon, { name: ic, size: 16, strokeWidth: 3 })),
      h('span', { className: 'vx-toast__msg' }, p.children),
      p.action ? h('button', { type: 'button', className: 'vx-toast__act', onClick: p.onAction }, p.action) : null);
  }

  function EmptyState(p) {
    return h('div', { className: cx('vx-empty', p.className) },
      h('span', { className: 'vx-empty__art', 'aria-hidden': 'true' }, h(Icon, { name: p.icon || 'mic', size: 40, strokeWidth: 2 })),
      h('h3', { className: 'vx-empty__title' }, p.title),
      p.body ? h('p', { className: 'vx-empty__body' }, p.body) : null,
      p.action ? h(Button, { icon: p.actionIcon, onClick: p.onAction }, p.action) : null);
  }

  function Skeleton(p) {
    var v = p.variant || 'answer';
    var label = h('span', { className: 'vx-sr' }, 'Loading');
    if (v === 'tile') return h('div', { className: 'vx-skel', 'aria-busy': 'true', style: { minHeight: 156 } }, label, h('i', { style: { width: '40%', height: 12 } }), h('i', { style: { width: '90%', height: 18 } }), h('i', { style: { width: '70%', height: 18 } }), h('i', { style: { width: '30%', height: 12, marginTop: 'auto' } }));
    if (v === 'line') return h('div', { 'aria-busy': 'true', className: 'vx-skel', style: { background: 'none', boxShadow: 'none', padding: 0 } }, label, h('i', { style: { width: p.width || '100%', height: 14 } }));
    return h('div', { className: 'vx-skel', 'aria-busy': 'true' }, label,
      h('div', { className: 'vx-skel__row' }, h('i', { className: 'c', style: { width: 40, height: 40 } }), h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 } }, h('i', { style: { width: '38%', height: 14 } }), h('i', { style: { width: '22%', height: 12 } }))),
      h('i', { className: 'p', style: { width: '100%', height: 60 } }),
      h('i', { style: { width: '85%', height: 14 } }),
      h('div', { className: 'vx-skel__row' }, h('i', { className: 'p', style: { width: 64, height: 32 } }), h('i', { className: 'p', style: { width: 80, height: 32 } }), h('i', { className: 'p', style: { width: 56, height: 32 } })));
  }

  /* ---------- Overlays ---------- */
  function Sheet(p) {
    var dialog = p.variant === 'dialog';
    useEffect(function () {
      if (!p.onClose) return undefined;
      function esc(e) { if (e.key === 'Escape') p.onClose(); }
      document.addEventListener('keydown', esc); return function () { document.removeEventListener('keydown', esc); };
    }, [p.onClose]);
    if (p.open === false) return null;
    return h('div', { className: cx('vx-overlay', dialog && 'vx-overlay--dialog', p.inline && 'vx-overlay--inline'), onClick: function (e) { if (e.target === e.currentTarget && p.onClose) p.onClose(); } },
      h('div', { className: cx('vx-sheet', p.className), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'vx-sheet-title' },
        h('span', { className: 'vx-sheet__grab', 'aria-hidden': 'true' }),
        h('div', { className: 'vx-sheet__head' },
          h('div', { style: { flex: 1 } }, h('h2', { className: 'vx-sheet__title', id: 'vx-sheet-title' }, p.title), p.subtitle ? h('p', { className: 'vx-sheet__sub' }, p.subtitle) : null),
          h(IconButton, { icon: 'x', label: 'Close', size: 's', onClick: p.onClose })),
        p.children, p.footer));
  }

  function Dialog(p) {
    return h(Sheet, { variant: 'dialog', inline: p.inline, title: p.title, onClose: p.onClose, open: p.open,
      footer: h('div', { className: 'vx-dialog__btns' },
        h(Button, { variant: 'secondary', onClick: p.onClose }, p.cancelLabel || 'Cancel'),
        h(Button, { variant: p.destructive ? 'destructive' : 'primary', icon: p.confirmIcon, onClick: p.onConfirm }, p.confirmLabel || 'Confirm')) },
      h('p', { className: 'vx-dialog__body' }, p.children));
  }

  /* ---------- Inputs ---------- */
  var fid = 0;
  function TextField(p) {
    var idRef = useRef(p.id || 'vx-f' + (++fid));
    var v = useState(p.defaultValue || ''); var val = p.value !== undefined ? p.value : v[0];
    var Tag = p.multiline ? 'textarea' : 'input';
    var hintId = idRef.current + '-h';
    return h('div', { className: cx('vx-field', p.error && 'is-error', p.disabled && 'is-disabled', p.className) },
      h('label', { className: 'vx-field__label', htmlFor: idRef.current }, p.label),
      h('div', { className: 'vx-field__box' },
        p.prefix ? h('span', { className: 'vx-field__prefix' }, p.prefixIcon ? h('span', { 'aria-hidden': 'true' }, p.prefixIcon) : null, p.prefix) : null,
        h(Tag, { id: idRef.current, className: 'vx-field__input', type: p.multiline ? undefined : (p.type || 'text'), inputMode: p.inputMode, autoComplete: p.autoComplete, placeholder: p.placeholder, value: val, disabled: p.disabled, maxLength: p.maxLength,
          'aria-invalid': p.error ? 'true' : undefined, 'aria-describedby': (p.hint || p.error || p.maxLength) ? hintId : undefined, onChange: function (e) { v[1](e.target.value); if (p.onChange) p.onChange(e.target.value); } })),
      (p.hint || p.error || p.maxLength) ? h('div', { className: 'vx-field__hint', id: hintId },
        h('span', { style: { display: 'inline-flex', gap: 6, alignItems: 'flex-start' } }, p.error ? h(Icon, { name: 'circle-x', size: 16, style: { marginTop: 1 } }) : null, p.error || p.hint || ''),
        p.maxLength ? h('span', { className: 'vx-num' }, String(val).length + ' / ' + p.maxLength) : null) : null);
  }

  function SearchField(p) {
    return h('label', { className: cx('vx-search', p.className), style: p.style },
      h(Icon, { name: 'search', size: 20 }),
      h('span', { className: 'vx-sr' }, p.label || 'Search'),
      h('input', { className: 'vx-search__input', type: 'search', placeholder: p.placeholder || 'Search', defaultValue: p.defaultValue }),
      p.shortcut ? h('kbd', null, p.shortcut) : null);
  }

  var api = {
    Icon: Icon, Logo: Logo, Button: Button, IconButton: IconButton, Badge: Badge, NewsTag: NewsTag, VerifyMark: VerifyMark, Avatar: Avatar,
    Tabs: Tabs, TopicChip: TopicChip, StageBar: StageBar, TopBar: TopBar, BottomNav: BottomNav, SideNav: SideNav, AppShell: AppShell,
    QuestionHero: QuestionHero, TopicOfWeek: TopicOfWeek, TopicTile: TopicTile, TrendingList: TrendingList,
    VoicePlayer: VoicePlayer, AnswerCard: AnswerCard, ReactionTray: ReactionTray, ProposalCard: ProposalCard,
    Composer: Composer, FreePosts: FreePosts, Recorder: Recorder,
    Poll: Poll, ResultComment: ResultComment, LiveThread: LiveThread, WeeklyReportCard: WeeklyReportCard,
    AdSlot: AdSlot, SponsoredSurvey: SponsoredSurvey, ShareCard: ShareCard,
    ProfileHeader: ProfileHeader, UnitsChip: UnitsChip, BuyUnitsSheet: BuyUnitsSheet, NotificationRow: NotificationRow,
    Banner: Banner, Toast: Toast, EmptyState: EmptyState, Skeleton: Skeleton, Sheet: Sheet, Dialog: Dialog,
    TextField: TextField, SearchField: SearchField,
    assets: ASSETS, reactions: REACTIONS, tiers: TIERS
  };
  window.Voices = window.Voices || {};
  for (var k in api) window.Voices[k] = api[k];
})();
