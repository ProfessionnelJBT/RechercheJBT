#!/usr/bin/env node
'use strict';

/*
 * Suite de tests de bout en bout de la grille haptique.
 * Ecrite uniquement a partir de protocole-haptique/MODE_OPERATOIRE.md (partie B).
 *
 * Usage : node protocole-haptique/tests/grille.test.js
 * Variables d'environnement facultatives : GRILLE_HTML (autre fichier HTML a tester),
 * GRILLE_FILTRE (expression reguliere : ne lance que les controles dont le nom correspond).
 * Codes de sortie : 0 tout passe, 1 au moins un echec, 2 fichier HTML absent,
 * 3 Playwright ou Chromium inutilisable.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const HTML = process.env.GRILLE_HTML
  ? path.resolve(process.env.GRILLE_HTML)
  : path.resolve(__dirname, '..', 'grille-haptique.html');

if (!fs.existsSync(HTML)) {
  console.error('Fichier HTML introuvable : ' + HTML);
  console.error('Rien a tester. Construire protocole-haptique/grille-haptique.html ou definir GRILLE_HTML.');
  process.exit(2);
}

const URL_APP = pathToFileURL(HTML).href;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'grille-test-'));

process.on('unhandledRejection', () => {});

/* ------------------------------------------------------------------ */
/* Donnees du contrat                                                  */
/* ------------------------------------------------------------------ */

const STEPS = ['session', 't0', 't1', 't2', 'physio', 'synthese'];
const T0 = ['T0.1', 'T0.2', 'T0.3', 'T0.4', 'T0.5'];
const AXES = {
  axe1: ['V1.1', 'V1.2', 'V1.3', 'V1.4'],
  axe2: ['V2.1', 'V2.2', 'V2.3', 'V2.4'],
  axe3: ['V3.1', 'V3.2', 'V3.3'],
  axe4: ['V4.1', 'V4.2', 'V4.3'],
};
const T1 = [].concat(AXES.axe1, AXES.axe2, AXES.axe3, AXES.axe4);
const ITEMS = T0.concat(T1);
const OBS_PHASES = ['T0', 'AXE1', 'AXE2', 'AXE3', 'AXE4'];
const RUPT = ['surprise', 'recherche', 'reprise', 'indifference'];
const T2K = ['tonus', 'posture', 'emotion', 'relation'];
const PHYS = ['fc', 'vfc', 'ced', 'spo2'];
const TEMPS = ['t0', 't1', 'rupture', 't2'];
const VALS = ['0', '1', '2', '3', 'NA'];
const SCORE_KEYS = ['axe1', 'axe2', 'axe3', 'axe4', 'total'];

function colonnesCSV() {
  const c = ['id', 'cree_le', 'modifie_le', 'code_sujet', 'session_no', 'date', 'age', 'sexe',
    'heure_debut', 'heure_fin', 'diagnostic', 'observateur', 'co_evaluateur', 'installation',
    'installation_autre', 'condition'];
  T0.forEach((x) => c.push(x));
  ['V1.1', 'V1.2', 'V1.3', 'V1.4', 'V2.1', 'V2.2', 'V2.3', 'V2.4', 'V3.1', 'V3.2', 'V3.3',
    'v31_duree_sec', 'V4.1', 'V4.2', 'V4.3'].forEach((x) => c.push(x));
  RUPT.forEach((k) => c.push('rupture_' + k));
  T2K.forEach((k) => c.push('t2_' + k));
  PHYS.forEach((m) => TEMPS.forEach((t) => c.push(m + '_' + t)));
  ['axe1', 'axe2', 'axe3', 'axe4', 'total'].forEach((k) => c.push('score_' + k));
  ['axe1', 'axe2', 'axe3', 'axe4', 'total'].forEach((k) => c.push('manquants_' + k));
  OBS_PHASES.forEach((k) => c.push('obs_' + k));
  c.push('rupture_commentaire');
  T2K.forEach((k) => c.push('t2_' + k + '_details'));
  c.push('evenements', 'conclusion');
  ITEMS.forEach((k) => c.push('obs_' + k));
  return c;
}

/* ------------------------------------------------------------------ */
/* Outils generiques                                                   */
/* ------------------------------------------------------------------ */

function fail(msg) { throw new Error(msg); }
function assert(cond, msg) { if (!cond) fail(msg); }

function canon(x) {
  if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
  if (x && typeof x === 'object') {
    return '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
  }
  return x === undefined ? 'undefined' : JSON.stringify(x);
}
function eq(actual, expected, label) {
  if (canon(actual) !== canon(expected)) {
    fail(label + ' : attendu ' + canon(expected) + ', obtenu ' + canon(actual));
  }
}

function merge(a, b) {
  if (b === undefined) return a;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const o = Object.assign({}, a);
    Object.keys(b).forEach((k) => { o[k] = merge(a[k], b[k]); });
    return o;
  }
  return b;
}

function pad(n) { return (n < 10 ? '0' : '') + n; }
function aujourdhuiLocal() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function aujourdhuiUTC() { return new Date().toISOString().slice(0, 10); }
function datesAcceptables() { return [aujourdhuiLocal(), aujourdhuiUTC()]; }

let compteurId = 0;
function blank(over) {
  const cotations = {}; ITEMS.forEach((c) => { cotations[c] = null; });
  const observations = {}; OBS_PHASES.concat(ITEMS).forEach((c) => { observations[c] = ''; });
  const t2 = {}; T2K.forEach((k) => { t2[k] = { evolution: null, details: '' }; });
  const physio = {}; PHYS.forEach((m) => { physio[m] = {}; TEMPS.forEach((t) => { physio[m][t] = null; }); });
  compteurId += 1;
  const s = {
    schema: 'grille-haptique/1',
    id: 'fixture-' + compteurId,
    cree_le: '2026-11-12T09:30:00.000Z',
    modifie_le: '2026-11-12T10:05:00.000Z',
    identification: {
      code_sujet: '', session_no: 1, date: '2026-11-12', age: null, sexe: null,
      heure_debut: '', heure_fin: '', diagnostic: '', observateur: '', co_evaluateur: '',
      installation: null, installation_autre: '', condition: null,
    },
    cotations,
    observations,
    v31_duree_sec: null,
    rupture: { surprise: false, recherche: false, reprise: false, indifference: false, commentaire: '' },
    t2,
    physio,
    synthese: { evenements: '', conclusion: '' },
    scores: {
      axe1: null, axe2: null, axe3: null, axe4: null, total: null,
      manquants: { axe1: 4, axe2: 4, axe3: 3, axe4: 3, total: 14 },
    },
  };
  return merge(s, over);
}

function valideSchema(s) {
  const p = [];
  const isNumNull = (v) => v === null || (typeof v === 'number' && isFinite(v));
  if (!s || typeof s !== 'object') return ['pas un objet'];
  if (s.schema !== 'grille-haptique/1') p.push('schema=' + s.schema);
  if (typeof s.id !== 'string' || !s.id) p.push('id absent');
  ['cree_le', 'modifie_le'].forEach((k) => {
    if (typeof s[k] !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(s[k]) || isNaN(Date.parse(s[k]))) p.push(k + ' pas ISO : ' + s[k]);
  });
  const idn = s.identification || {};
  ['code_sujet', 'session_no', 'date', 'age', 'sexe', 'heure_debut', 'heure_fin', 'diagnostic', 'observateur',
    'co_evaluateur', 'installation', 'installation_autre', 'condition'].forEach((k) => {
    if (!(k in idn)) p.push('identification.' + k + ' absent');
  });
  ['code_sujet', 'diagnostic', 'observateur', 'co_evaluateur', 'installation_autre'].forEach((k) => {
    if (typeof idn[k] !== 'string') p.push('identification.' + k + ' pas une chaine');
  });
  if (!isNumNull(idn.session_no)) p.push('session_no pas nombre|null');
  if (!isNumNull(idn.age)) p.push('age pas nombre|null');
  if (![null, '', 'F', 'M'].includes(idn.sexe)) p.push('sexe=' + idn.sexe);
  if (![null, '', 'corset', 'fauteuil', 'matelas', 'autre'].includes(idn.installation)) p.push('installation=' + idn.installation);
  if (![null, '', 'A', 'B', 'C'].includes(idn.condition)) p.push('condition=' + idn.condition);
  const cot = s.cotations || {};
  eq(Object.keys(cot).sort(), ITEMS.slice().sort(), 'cles de cotations');
  ITEMS.forEach((c) => { if (![0, 1, 2, 3, 'NA', null].includes(cot[c])) p.push('cotations.' + c + '=' + canon(cot[c])); });
  if (!s.observations || typeof s.observations !== 'object') p.push('observations absent');
  else Object.keys(s.observations).forEach((k) => { if (typeof s.observations[k] !== 'string') p.push('observations.' + k + ' pas une chaine'); });
  if (!isNumNull(s.v31_duree_sec)) p.push('v31_duree_sec pas nombre|null');
  const r = s.rupture || {};
  RUPT.forEach((k) => { if (typeof r[k] !== 'boolean') p.push('rupture.' + k + ' pas booleen'); });
  if (typeof r.commentaire !== 'string') p.push('rupture.commentaire pas une chaine');
  T2K.forEach((k) => {
    const t = (s.t2 || {})[k];
    if (!t) { p.push('t2.' + k + ' absent'); return; }
    if (![-1, 0, 1, null].includes(t.evolution)) p.push('t2.' + k + '.evolution=' + canon(t.evolution));
    if (typeof t.details !== 'string') p.push('t2.' + k + '.details pas une chaine');
  });
  PHYS.forEach((m) => TEMPS.forEach((t) => {
    const v = ((s.physio || {})[m] || {})[t];
    if (v === undefined || !isNumNull(v)) p.push('physio.' + m + '.' + t + '=' + canon(v));
  }));
  const sy = s.synthese || {};
  if (typeof sy.evenements !== 'string' || typeof sy.conclusion !== 'string') p.push('synthese incomplete');
  const sc = s.scores || {};
  SCORE_KEYS.forEach((k) => { if (sc[k] === undefined || !isNumNull(sc[k])) p.push('scores.' + k + '=' + canon(sc[k])); });
  SCORE_KEYS.forEach((k) => { if (typeof (sc.manquants || {})[k] !== 'number') p.push('scores.manquants.' + k + ' absent'); });
  return p;
}

function parseCSV(texte) {
  let t = texte.charCodeAt(0) === 0xFEFF ? texte.slice(1) : texte;
  const records = []; const quoted = [];
  let rec = []; let q = []; let f = ''; let fq = false; let inQ = false; let badNL = 0; let started = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    started = true;
    if (inQ) {
      if (ch === '"') {
        if (t[i + 1] === '"') { f += '"'; i++; } else inQ = false;
      } else f += ch;
      continue;
    }
    if (ch === '"' && f === '' && !fq) { inQ = true; fq = true; continue; }
    if (ch === ';') { rec.push(f); q.push(fq); f = ''; fq = false; continue; }
    if (ch === '\r' && t[i + 1] === '\n') {
      rec.push(f); q.push(fq); records.push(rec); quoted.push(q);
      rec = []; q = []; f = ''; fq = false; i++; started = false; continue;
    }
    if (ch === '\n' || ch === '\r') {
      badNL++;
      rec.push(f); q.push(fq); records.push(rec); quoted.push(q);
      rec = []; q = []; f = ''; fq = false; started = false; continue;
    }
    f += ch;
  }
  if (started || f !== '' || rec.length) { rec.push(f); q.push(fq); records.push(rec); quoted.push(q); }
  return { records, quoted, badNL, unclosed: inQ };
}

function raison(e) {
  const lignes = String((e && e.message) || e).split('\n').map((l) => l.trim()).filter(Boolean);
  let r = lignes[0] || 'erreur inconnue';
  const loc = lignes.find((l) => /waiting for|locator\(|selector/.test(l) && l !== lignes[0]);
  if (loc) r += ' | ' + loc;
  return r.length > 420 ? r.slice(0, 417) + '...' : r;
}

/* ------------------------------------------------------------------ */
/* Application sous test                                               */
/* ------------------------------------------------------------------ */

let apiAbsente = false;

async function ouvrir(browser, opt) {
  opt = opt || {};
  const ctx = await browser.newContext({
    viewport: opt.viewport || { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  ctx.setDefaultTimeout(2500);
  ctx.setDefaultNavigationTimeout(8000);
  const page = await ctx.newPage();
  const A = { ctx, page, errors: [], requests: [], dialogs: [], modeDialogue: 'accept' };
  page.on('console', (m) => { if (m.type() === 'error') A.errors.push('console.error : ' + m.text()); });
  page.on('pageerror', (e) => A.errors.push('pageerror : ' + e.message));
  page.on('request', (r) => A.requests.push(r.url()));
  page.on('dialog', async (d) => {
    A.dialogs.push(d.message());
    try { if (A.modeDialogue === 'dismiss') await d.dismiss(); else await d.accept(); } catch (e) { /* ignore */ }
  });

  A.attendreAPI = async () => {
    try {
      await page.waitForFunction(() => window.GrilleHaptique && typeof window.GrilleHaptique.etat === 'function',
        null, { timeout: apiAbsente ? 300 : 3000 });
    } catch (e) { apiAbsente = true; }
  };
  A.st = () => page.evaluate(() => window.GrilleHaptique.etat());
  A.sessions = () => page.evaluate(() => window.GrilleHaptique.sessions());
  A.go = (k) => page.evaluate((x) => window.GrilleHaptique.allerA(x), k);
  A.clic = async (sel) => {
    const l = page.locator(sel).first();
    try { await l.click({ timeout: 1000 }); } catch (e) { await l.evaluate((el) => el.click(), null, { timeout: 1000 }); }
  };
  A.rate = async (code, val) => {
    await A.go(code.indexOf('T0') === 0 ? 't0' : 't1');
    await page.click('button[data-rate="' + code + '"][data-val="' + val + '"]');
  };
  A.rateMany = async (map) => { for (const k of Object.keys(map)) await A.rate(k, map[k]); };
  A.panneauxVisibles = () => page.$$eval('section[data-panel]', (els) => els
    .filter((e) => !e.hidden && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0)
    .map((e) => e.getAttribute('data-panel')));
  A.etapesCourantes = () => page.$$eval('button[data-step][aria-current="step"]', (b) => b.map((x) => x.getAttribute('data-step')));
  A.scoresDOM = async () => {
    await A.go('synthese');
    return page.evaluate((keys) => {
      const o = {};
      keys.forEach((k) => {
        const e = document.getElementById('score-' + k);
        o[k] = e ? { txt: e.textContent.trim(), man: e.getAttribute('data-manquants') } : null;
      });
      return o;
    }, SCORE_KEYS);
  };
  A.texteStep = (k) => page.evaluate((x) => {
    const s = document.querySelector('section[data-panel="' + x + '"]');
    return s ? s.innerText : null;
  }, k);
  A.panneau = async () => {
    const p = page.locator('#panneau-sessions');
    if (!(await p.isVisible())) await page.click('#btn-sessions');
    await p.waitFor({ state: 'visible' });
  };
  A.telecharger = async (sel) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 3000 }), page.click(sel)]);
    const p = await dl.path();
    const buf = fs.readFileSync(p);
    return { name: dl.suggestedFilename(), buf, text: buf.toString('utf8') };
  };
  A.importer = async (contenu) => {
    compteurId += 1;
    const f = path.join(TMP, 'import-' + compteurId + '.json');
    fs.writeFileSync(f, typeof contenu === 'string' ? contenu : JSON.stringify(contenu));
    await A.panneau();
    await page.setInputFiles('#in-import', f);
  };
  A.recharger = async () => { await page.reload(); await A.attendreAPI(); };
  A.corps = () => page.evaluate(() => document.body.innerText);

  await page.goto(URL_APP);
  await A.attendreAPI();
  return A;
}

async function remplirUI(A) {
  const p = A.page;
  await A.go('session');
  await p.fill('#f-code', 'S01');
  await p.fill('#f-session', '3');
  await p.fill('#f-date', '2026-11-12');
  await p.fill('#f-age', '14');
  await A.clic('input[name="sexe"][value="F"]');
  await p.fill('#f-debut', '09:30');
  await p.fill('#f-fin', '10:15');
  await p.fill('#f-diagnostic', 'Diag test');
  await p.fill('#f-observateur', 'OBS1');
  await p.fill('#f-coeval', 'OBS2');
  await A.clic('input[name="installation"][value="corset"]');
  await A.clic('input[name="condition"][value="B"]');
  await A.rateMany({ 'T0.1': 2, 'T0.2': 'NA', 'V1.1': 3, 'V1.2': 2, 'V1.3': 1, 'V1.4': 2, 'V2.1': 1 });
  await A.go('t0'); await p.fill('textarea[data-obs="T0"]', 'obs T0');
  await A.go('t1');
  await p.fill('textarea[data-obs="V1.1"]', 'obs v11');
  await p.fill('textarea[data-obs="AXE1"]', 'axe un');
  await p.fill('#f-v31-duree', '45');
  await A.clic('input[data-rupture="surprise"]');
  await p.fill('#f-rupture-commentaire', 'rupt');
  await A.go('t2');
  await A.clic('input[name="t2-tonus"][value="1"]');
  await p.fill('textarea[data-t2="tonus"]', 'det');
  await A.go('physio');
  await p.fill('input[data-physio="fc"][data-temps="t0"]', '72,5');
  await A.go('synthese');
  await p.fill('#f-evenements', 'ev');
  await p.fill('#f-conclusion', 'concl');
}

/* ------------------------------------------------------------------ */
/* Harnais                                                             */
/* ------------------------------------------------------------------ */

const checks = [];
function check(name, fn, opts) { checks.push({ name, fn, opts: opts || {} }); }
function statique(name, fn) { checks.push({ name, fn, opts: { page: false } }); }

const XSS = '<img src=x onerror="window.__xss=1">';

/* ================================================================== */
/* 1. Hors ligne                                                       */
/* ================================================================== */

check('Hors ligne : aucune requete reseau ni erreur sur un parcours complet', async (A) => {
  const p = A.page;
  for (const k of STEPS) { await p.click('button[data-step="' + k + '"]'); }
  await A.rateMany({ 'T0.1': 1, 'V1.1': 2, 'V2.1': 'NA' });
  await A.go('session');
  await p.fill('#f-code', 'HORS1');
  await A.clic('input[name="condition"][value="A"]');
  await A.go('physio');
  await p.fill('input[data-physio="fc"][data-temps="t0"]', '70');
  await A.go('t2');
  await A.clic('input[name="t2-tonus"][value="0"]');
  await A.go('synthese');
  await A.panneau();
  await p.waitForTimeout(300);
  const externes = A.requests.filter((u) => !/^(file:|data:|blob:|about:)/.test(u));
  assert(externes.length === 0, 'requetes non file:// : ' + externes.slice(0, 3).join(', '));
  assert(A.errors.length === 0, 'erreurs : ' + A.errors.slice(0, 3).join(' || '));
  assert(A.requests.length > 0 && A.requests[0].indexOf('file:') === 0, 'la page n\'a pas ete chargee en file://');
});

/* ================================================================== */
/* 2. Structure                                                        */
/* ================================================================== */

check('Structure : six boutons d\'etape, aria-current, une seule section visible', async (A) => {
  const keys = await A.page.$$eval('button[data-step]', (b) => b.map((x) => x.getAttribute('data-step')));
  eq(keys.slice().sort(), STEPS.slice().sort(), 'boutons button[data-step]');
  const sections = await A.page.$$eval('section[data-panel]', (b) => b.map((x) => x.getAttribute('data-panel')));
  eq(sections.slice().sort(), STEPS.slice().sort(), 'sections section[data-panel]');
  eq(await A.etapesCourantes(), ['session'], 'etape courante au chargement');
  eq(await A.panneauxVisibles(), ['session'], 'panneau visible au chargement');
  for (const k of STEPS) {
    await A.go(k);
    eq(await A.etapesCourantes(), [k], 'aria-current apres allerA(' + k + ')');
    eq(await A.panneauxVisibles(), [k], 'panneaux visibles apres allerA(' + k + ')');
    const nonCaches = await A.page.$$eval('section[data-panel]', (s, kk) => s
      .filter((e) => e.getAttribute('data-panel') !== kk && !e.hasAttribute('hidden')).map((e) => e.getAttribute('data-panel')), k);
    eq(nonCaches, [], 'sections sans attribut hidden hors etape ' + k);
  }
  assert(await A.page.locator('#btn-suivant').count() === 1, '#btn-suivant absent');
  assert(await A.page.locator('#btn-precedent').count() === 1, '#btn-precedent absent');
  assert(await A.page.locator('#etat-enregistrement').count() === 1, '#etat-enregistrement absent');
  const t = await A.page.evaluate(() => typeof window.GrilleHaptique.allerA);
  eq(t, 'function', 'typeof GrilleHaptique.allerA');
  const api = await A.page.evaluate(() => ['etat', 'sessions', 'calculerScores', 'versCSV', 'allerA']
    .filter((k) => typeof window.GrilleHaptique[k] !== 'function'));
  eq(api, [], 'fonctions manquantes dans GrilleHaptique');
});

check('Structure : 19 items [data-item] avec 5 boutons de cotation chacun', async (A) => {
  const rap = await A.page.evaluate((args) => {
    const pb = [];
    const items = [...document.querySelectorAll('[data-item]')].map((e) => e.getAttribute('data-item'));
    if (items.length !== args.items.length) pb.push(items.length + ' elements [data-item] au lieu de ' + args.items.length);
    args.items.forEach((c) => {
      const els = document.querySelectorAll('[data-item="' + c + '"]');
      if (els.length !== 1) { pb.push(c + ' : ' + els.length + ' conteneur(s)'); return; }
      const el = els[0];
      const bt = [...el.querySelectorAll('button[data-val]')];
      const vals = bt.map((b) => b.getAttribute('data-val'));
      if (vals.join(',') !== args.vals.join(',')) pb.push(c + ' : valeurs de boutons ' + vals.join(','));
      bt.forEach((b) => { if (b.getAttribute('data-rate') !== c) pb.push(c + ' : data-rate=' + b.getAttribute('data-rate')); });
      const g = el.querySelector('[role="group"]');
      if (!g) pb.push(c + ' : pas de role=group');
      else if (!(g.getAttribute('aria-label') || g.getAttribute('aria-labelledby'))) pb.push(c + ' : groupe sans libelle');
      if (!el.querySelector('textarea[data-obs="' + c + '"]')) pb.push(c + ' : textarea[data-obs] absent');
      if (document.querySelectorAll('button[data-rate="' + c + '"]').length !== 5) pb.push(c + ' : boutons data-rate != 5');
    });
    return pb;
  }, { items: ITEMS, vals: VALS });
  eq(rap, [], 'problemes');
  const inv = await A.page.evaluate(() => (document.querySelector('[data-item="V1.4"]') || { textContent: '' }).textContent);
  assert(/Score invers/i.test(inv), 'V1.4 sans etiquette « Score inversé »');
});

check('Structure : V3.1 duree, rupture, T2 et mesures physiologiques', async (A) => {
  const rap = await A.page.evaluate((a) => {
    const pb = [];
    const n = (s) => document.querySelectorAll(s).length;
    if (n('#f-v31-duree') !== 1) pb.push('#f-v31-duree');
    if (n('#f-rupture-commentaire') !== 1) pb.push('#f-rupture-commentaire');
    a.rupt.forEach((k) => { if (n('input[type="checkbox"][data-rupture="' + k + '"]') !== 1) pb.push('rupture ' + k); });
    if (n('input[type="checkbox"][data-rupture]') !== 4) pb.push('nombre de cases de rupture = ' + n('input[type="checkbox"][data-rupture]'));
    let radios = 0;
    a.t2k.forEach((k) => {
      [-1, 0, 1].forEach((v) => {
        const c = n('input[type="radio"][name="t2-' + k + '"][value="' + v + '"]');
        radios += c;
        if (c !== 1) pb.push('radio t2-' + k + '=' + v + ' (' + c + ')');
      });
      if (n('textarea[data-t2="' + k + '"]') !== 1) pb.push('textarea data-t2=' + k);
    });
    if (radios !== 12) pb.push('radios T2 = ' + radios);
    let phys = 0;
    a.phys.forEach((m) => a.temps.forEach((t) => {
      const els = document.querySelectorAll('input[data-physio="' + m + '"][data-temps="' + t + '"]');
      phys += els.length;
      if (els.length !== 1) pb.push('physio ' + m + '/' + t + ' (' + els.length + ')');
      else if (els[0].getAttribute('inputmode') !== 'decimal') pb.push('inputmode manquant ' + m + '/' + t);
    }));
    if (phys !== 16) pb.push('champs physio = ' + phys);
    ['T0', 'AXE1', 'AXE2', 'AXE3', 'AXE4'].forEach((k) => { if (n('textarea[data-obs="' + k + '"]') !== 1) pb.push('textarea data-obs=' + k); });
    return pb;
  }, { rupt: RUPT, t2k: T2K, phys: PHYS, temps: TEMPS });
  eq(rap, [], 'problemes');
});

check('Structure : champs de l\'etape Session et boutons Maintenant', async (A) => {
  const rap = await A.page.evaluate(() => {
    const pb = [];
    const n = (s) => document.querySelectorAll(s).length;
    ['#f-code', '#f-session', '#f-date', '#f-age', '#f-debut', '#f-fin', '#f-diagnostic', '#f-observateur',
      '#f-coeval', '#f-installation-autre', '#btn-debut-maintenant', '#btn-fin-maintenant', '#f-evenements', '#f-conclusion',
    ].forEach((s) => { if (n(s) !== 1) pb.push(s + ' (' + n(s) + ')'); });
    [['sexe', ['F', 'M']], ['installation', ['corset', 'fauteuil', 'matelas', 'autre']], ['condition', ['A', 'B', 'C']]]
      .forEach((x) => x[1].forEach((v) => { if (n('input[type="radio"][name="' + x[0] + '"][value="' + v + '"]') !== 1) pb.push(x[0] + '=' + v); }));
    const t = (s, ty) => { const e = document.querySelector(s); return e && e.getAttribute('type') === ty; };
    if (!t('#f-date', 'date')) pb.push('#f-date pas type=date');
    if (!t('#f-debut', 'time')) pb.push('#f-debut pas type=time');
    if (!t('#f-fin', 'time')) pb.push('#f-fin pas type=time');
    return pb;
  });
  eq(rap, [], 'problemes');
});

check('Structure : actions du panneau Sessions et variantes -synthese', async (A) => {
  const ids = ['btn-sessions', 'panneau-sessions', 'btn-nouvelle', 'btn-export-json', 'btn-export-csv', 'btn-export-tout',
    'btn-import-json', 'in-import', 'btn-imprimer', 'btn-effacer-tout',
    'btn-export-json-synthese', 'btn-export-csv-synthese', 'btn-imprimer-synthese'];
  const rap = await A.page.evaluate((l) => l.filter((i) => document.querySelectorAll('[id="' + i + '"]').length !== 1), ids);
  eq(rap, [], 'identifiants absents ou en double');
  const ty = await A.page.evaluate(() => document.getElementById('in-import').getAttribute('type'));
  eq(ty, 'file', 'type de #in-import');
});

check('Structure : rappel de l\'echelle (5 ancres) en tete de T0 et T1', async (A) => {
  for (const k of ['t0', 't1']) {
    const txt = await A.page.evaluate((x) => document.querySelector('section[data-panel="' + x + '"]').textContent, k);
    ['Absence', 'Faible', 'Mod', 'Majeur', 'Non applicable'].forEach((m) => assert(txt.indexOf(m) >= 0, k + ' : ancre « ' + m + ' » absente'));
  }
});

check('Structure : libelles de l\'etape Session (conditions, installations, aide)', async (A) => {
  const txt = (await A.page.evaluate(() => document.querySelector('section[data-panel="session"]').textContent)).replace(/’/g, '\'');
  ['Corset-si', 'Fauteuil roulant confort', 'Matelas positionnement', 'Sol', 'Gilet actif', 'Multisensorielle', 'Snoezelen',
    'Sans stimulation', 'Code d\'anonymat, jamais de nom ni d\'initiales', 'code ou fonction']
    .forEach((m) => assert(txt.indexOf(m) >= 0, '« ' + m + ' » absent de l\'etape Session'));
  assert(/T.moin/.test(txt), 'Cond. A (Témoin) absent');
});

check('Accessibilite : champs de saisie associes a un libelle', async (A) => {
  const rap = await A.page.evaluate(() => {
    const pb = [];
    document.querySelectorAll('input, textarea, select').forEach((e) => {
      const t = e.getAttribute('type');
      if (t === 'file' || t === 'hidden') return;
      const ok = (e.labels && e.labels.length > 0) || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title');
      if (!ok) pb.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '[' + [...e.attributes].filter((a) => /^(name|data-)/.test(a.name)).map((a) => a.name + '=' + a.value).join(',') + ']'));
    });
    return pb.slice(0, 8);
  });
  eq(rap, [], 'champs sans libelle');
});

/* ================================================================== */
/* Premier lancement, navigation, compteurs                            */
/* ================================================================== */

check('Premier lancement : une session vide, etape Session, date du jour', async (A) => {
  const ss = await A.sessions();
  eq(ss.length, 1, 'nombre de sessions');
  const s = await A.st();
  const pb = valideSchema(s);
  eq(pb, [], 'schema de la session initiale');
  ITEMS.forEach((c) => eq(s.cotations[c], null, 'cotation ' + c));
  assert(!s.identification.code_sujet, 'code sujet non vide au depart');
  const v = await A.page.inputValue('#f-date');
  assert(datesAcceptables().includes(v), '#f-date = ' + v + ', attendu ' + datesAcceptables().join(' ou '));
  eq(s.identification.date, v, 'date dans l\'etat');
  eq(await A.panneauxVisibles(), ['session'], 'etape affichee');
});

check('Navigation : clics sur les etapes, Suivant/Precedent, retour en haut de page', async (A) => {
  const p = A.page;
  await p.setViewportSize({ width: 1280, height: 500 });
  for (const k of STEPS) {
    await p.click('button[data-step="' + k + '"]');
    eq(await A.etapesCourantes(), [k], 'aria-current apres clic sur ' + k);
    eq(await A.panneauxVisibles(), [k], 'panneau apres clic sur ' + k);
  }
  await A.go('session');
  for (let i = 1; i < STEPS.length; i++) {
    await p.click('#btn-suivant');
    eq(await A.panneauxVisibles(), [STEPS[i]], 'apres Suivant (' + i + ')');
  }
  for (let i = STEPS.length - 2; i >= 3; i--) {
    await p.click('#btn-precedent');
    eq(await A.panneauxVisibles(), [STEPS[i]], 'apres Precedent');
  }
  await A.go('t1');
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const y = await p.evaluate(() => window.scrollY);
  assert(y > 100, 'la page T1 n\'a pas defile (scrollY=' + y + ')');
  await p.click('#btn-suivant');
  await p.waitForFunction(() => window.scrollY <= 2, null, { timeout: 2000 }).catch(() => fail('pas de retour en haut apres changement d\'etape'));
});

check('Compteurs d\'avancement T0, T1, T2 dans la barre d\'etapes (NA compte comme renseigne)', async (A) => {
  await A.rateMany({ 'T0.1': 1, 'T0.2': 'NA' });
  await A.rateMany({ 'V1.1': 0, 'V1.2': 1, 'V1.3': 2, 'V1.4': 3, 'V2.1': 0, 'V2.2': 1, 'V2.3': 2, 'V3.1': 3, 'V4.1': 'NA' });
  await A.go('t2');
  await A.clic('input[name="t2-tonus"][value="-1"]');
  const txt = async (k) => (await A.page.locator('button[data-step="' + k + '"]').textContent()).replace(/\s+/g, ' ');
  assert(/T0\s*2\s*\/\s*5/.test(await txt('t0')), 'compteur T0 : ' + await txt('t0'));
  assert(/T1\s*9\s*\/\s*14/.test(await txt('t1')), 'compteur T1 : ' + await txt('t1'));
  assert(/T2\s*1\s*\/\s*4/.test(await txt('t2')), 'compteur T2 : ' + await txt('t2'));
});

/* ================================================================== */
/* 3. Cotation                                                         */
/* ================================================================== */

check('Cotation : clic = aria-pressed + valeur dans etat(), second clic = effacement', async (A) => {
  const sel = (v) => 'button[data-rate="T0.1"][data-val="' + v + '"]';
  await A.rate('T0.1', 2);
  eq(await A.page.getAttribute(sel(2), 'aria-pressed'), 'true', 'aria-pressed apres clic');
  eq((await A.st()).cotations['T0.1'], 2, 'valeur numerique 2');
  await A.page.click(sel(2));
  assert((await A.page.getAttribute(sel(2), 'aria-pressed')) !== 'true', 'aria-pressed toujours true apres second clic');
  eq((await A.st()).cotations['T0.1'], null, 'valeur apres second clic');
});

check('Cotation : changer de valeur deplace aria-pressed ; 0 est une valeur, pas un effacement', async (A) => {
  await A.rate('V2.2', 0);
  eq((await A.st()).cotations['V2.2'], 0, 'valeur 0');
  await A.rate('V2.2', 3);
  const pr = await A.page.$$eval('button[data-rate="V2.2"]', (b) => b.filter((x) => x.getAttribute('aria-pressed') === 'true').map((x) => x.getAttribute('data-val')));
  eq(pr, ['3'], 'boutons presses');
  eq((await A.st()).cotations['V2.2'], 3, 'valeur 3');
  for (const v of [1, 2]) { await A.rate('V2.2', v); eq((await A.st()).cotations['V2.2'], v, 'valeur ' + v); }
});

check('Cotation : NA stocke "NA", efface par second clic', async (A) => {
  await A.rate('T0.3', 'NA');
  eq((await A.st()).cotations['T0.3'], 'NA', 'valeur NA');
  eq(await A.page.getAttribute('button[data-rate="T0.3"][data-val="NA"]', 'aria-pressed'), 'true', 'aria-pressed NA');
  await A.page.click('button[data-rate="T0.3"][data-val="NA"]');
  eq((await A.st()).cotations['T0.3'], null, 'NA efface');
});

check('Cotation : raccourcis clavier 0/1/2/3/N et passage a l\'item suivant', async (A) => {
  const p = A.page;
  await A.go('t1');
  const itemFocus = () => p.evaluate(() => { const e = document.activeElement; const it = e && e.closest ? e.closest('[data-item]') : null; return it ? it.getAttribute('data-item') : null; });
  const attendre = (code) => p.waitForFunction((c) => { const e = document.activeElement; const it = e && e.closest ? e.closest('[data-item]') : null; return !!it && it.getAttribute('data-item') === c; }, code, { timeout: 1500 })
    .catch(async () => fail('focus attendu dans ' + code + ', obtenu ' + await itemFocus()));
  await p.locator('button[data-rate="V1.1"][data-val="0"]').focus();
  await p.keyboard.press('3');
  eq((await A.st()).cotations['V1.1'], 3, 'touche 3 sur V1.1');
  await attendre('V1.2');
  await p.keyboard.press('0');
  eq((await A.st()).cotations['V1.2'], 0, 'touche 0 sur V1.2');
  await attendre('V1.3');
  await p.keyboard.press('1');
  eq((await A.st()).cotations['V1.3'], 1, 'touche 1 sur V1.3');
  await attendre('V1.4');
  await p.keyboard.press('N');
  eq((await A.st()).cotations['V1.4'], 'NA', 'touche N sur V1.4');
  await attendre('V2.1');
  await p.keyboard.press('2');
  eq((await A.st()).cotations['V2.1'], 2, 'touche 2 sur V2.1');
  await attendre('V2.2');
  await p.keyboard.press('n');
  eq((await A.st()).cotations['V2.2'], 'NA', 'touche n (minuscule) sur V2.2');
  eq(await p.getAttribute('button[data-rate="V1.1"][data-val="3"]', 'aria-pressed'), 'true', 'aria-pressed apres clavier');
});

check('Cotation : taper dans une zone d\'observation ne cote pas l\'item', async (A) => {
  const p = A.page;
  await A.go('t1');
  await p.click('textarea[data-obs="V1.1"]');
  await p.keyboard.type('N 0 1 2 3 n');
  eq(await p.inputValue('textarea[data-obs="V1.1"]'), 'N 0 1 2 3 n', 'texte saisi');
  const s = await A.st();
  T1.forEach((c) => eq(s.cotations[c], null, 'cotation ' + c));
});

/* ================================================================== */
/* 4. Scores                                                           */
/* ================================================================== */

async function verifierScores(A, exp, man) {
  const dom = await A.scoresDOM();
  const e = (await A.st()).scores;
  SCORE_KEYS.forEach((k) => {
    assert(dom[k], '#score-' + k + ' absent');
    const attendu = exp[k];
    const txt = dom[k].txt.replace(/−/g, '-');
    if (attendu === null) eq(txt, '-', '#score-' + k + ' texte');
    else eq(txt, String(attendu), '#score-' + k + ' texte');
    eq(e[k], attendu, 'etat().scores.' + k);
    eq(dom[k].man, String(man[k]), '#score-' + k + ' data-manquants');
    eq(e.manquants[k], man[k], 'etat().scores.manquants.' + k);
  });
}
const nul = { axe1: null, axe2: null, axe3: null, axe4: null, total: null };

check('Scores : score inverse (V1.1=3, V1.2=2, V1.3=1, V1.4=2 -> axe1 = 4)', async (A) => {
  await A.rateMany({ 'V1.1': 3, 'V1.2': 2, 'V1.3': 1, 'V1.4': 2 });
  await verifierScores(A, Object.assign({}, nul, { axe1: 4, total: 4 }), { axe1: 0, axe2: 4, axe3: 3, axe4: 3, total: 10 });
});

check('Scores : NA ignore (V1.4=NA -> axe1 = 6, manquants 1)', async (A) => {
  await A.rateMany({ 'V1.1': 3, 'V1.2': 2, 'V1.3': 1, 'V1.4': 'NA' });
  await verifierScores(A, Object.assign({}, nul, { axe1: 6, total: 6 }), { axe1: 1, axe2: 4, axe3: 3, axe4: 3, total: 11 });
});

check('Scores : axe 1 negatif (seul V1.4=3 -> -3)', async (A) => {
  await A.rate('V1.4', 3);
  await verifierScores(A, Object.assign({}, nul, { axe1: -3, total: -3 }), { axe1: 3, axe2: 4, axe3: 3, axe4: 3, total: 13 });
});

check('Scores : axe entierement manquant -> "-" et null, total null', async (A) => {
  await verifierScores(A, nul, { axe1: 4, axe2: 4, axe3: 3, axe4: 3, total: 14 });
});

check('Scores : un item coté 0 n\'est pas manquant (axe2 = 0, total = 0)', async (A) => {
  await A.rate('V2.1', 0);
  await verifierScores(A, Object.assign({}, nul, { axe2: 0, total: 0 }), { axe1: 4, axe2: 3, axe3: 3, axe4: 3, total: 13 });
});

check('Scores : tout coté a 3 sauf V1.4=0 -> 9, 12, 9, 9, total 39, manquants 0', async (A) => {
  const m = {}; T1.forEach((c) => { m[c] = 3; }); m['V1.4'] = 0;
  await A.rateMany(m);
  await verifierScores(A, { axe1: 9, axe2: 12, axe3: 9, axe4: 9, total: 39 }, { axe1: 0, axe2: 0, axe3: 0, axe4: 0, total: 0 });
});

check('Scores : les items T0 ne changent aucun score', async (A) => {
  const m = {}; T0.forEach((c) => { m[c] = 3; }); await A.rateMany(m);
  await verifierScores(A, nul, { axe1: 4, axe2: 4, axe3: 3, axe4: 3, total: 14 });
  await A.rateMany({ 'V1.1': 1, 'V2.1': 2 });
  await verifierScores(A, { axe1: 1, axe2: 2, axe3: null, axe4: null, total: 3 }, { axe1: 3, axe2: 3, axe3: 3, axe4: 3, total: 12 });
});

check('Scores : mention visible « incomplet : n item(s) non coté(s) ou NA »', async (A) => {
  const m = {}; T1.forEach((c) => { m[c] = 3; }); await A.rateMany(m);
  await A.go('synthese');
  let t = await A.texteStep('synthese');
  assert(!/incomplet/i.test(t), 'mention « incomplet » presente alors que tout est coté');
  await A.rate('V1.4', 'NA');
  await A.go('synthese');
  t = await A.texteStep('synthese');
  assert(/incomplet\s*:\s*1\s*item\(s\)\s*non\s*cot/i.test(t), 'mention « incomplet : 1 item(s) non coté(s) ou NA » absente');
});

check('Scores : calculerScores ne modifie pas son argument et suit les regles', async (A) => {
  const r = await A.page.evaluate(() => {
    const G = window.GrilleHaptique;
    const s = JSON.parse(JSON.stringify(G.etat()));
    s.cotations['V1.1'] = 3; s.cotations['V1.2'] = 2; s.cotations['V1.3'] = 1; s.cotations['V1.4'] = 'NA'; s.cotations['V2.1'] = 0;
    s.scores = { sentinelle: true };
    const avant = JSON.stringify(s);
    const out = G.calculerScores(s);
    return { avant, apres: JSON.stringify(s), out, etatApres: JSON.stringify(G.etat().cotations) };
  });
  eq(r.apres, r.avant, 'argument modifie par calculerScores');
  eq(r.out.axe1, 6, 'axe1'); eq(r.out.axe2, 0, 'axe2'); eq(r.out.axe3, null, 'axe3'); eq(r.out.axe4, null, 'axe4'); eq(r.out.total, 6, 'total');
  eq(r.out.manquants, { axe1: 1, axe2: 3, axe3: 3, axe4: 3, total: 10 }, 'manquants');
  assert(!('sentinelle' in r.out), 'calculerScores renvoie l\'ancien objet scores');
  assert(!/"V1.1":3/.test(r.etatApres), 'calculerScores a modifie la session courante');
});

/* ================================================================== */
/* 5. Champs                                                           */
/* ================================================================== */

check('Champs : code sujet filtre sur [A-Za-z0-9_-]', async (A) => {
  await A.page.click('#f-code');
  await A.page.keyboard.type('ab c!_é-9');
  eq(await A.page.inputValue('#f-code'), 'abc_-9', 'valeur du champ');
  eq((await A.st()).identification.code_sujet, 'abc_-9', 'etat().identification.code_sujet');
});

check('Champs : code sujet limite a 12 caracteres', async (A) => {
  await A.page.click('#f-code');
  await A.page.keyboard.type('ABCDEFGHIJKLMNOPQRST');
  eq(await A.page.inputValue('#f-code'), 'ABCDEFGHIJKL', 'valeur du champ');
  eq((await A.st()).identification.code_sujet, 'ABCDEFGHIJKL', 'etat');
});

check('Champs : numero de session, date, age (entiers) dans l\'etat', async (A) => {
  const p = A.page;
  await p.fill('#f-session', '3');
  await p.fill('#f-date', '2026-11-12');
  await p.fill('#f-age', '14');
  let id = (await A.st()).identification;
  eq(id.session_no, 3, 'session_no'); eq(id.date, '2026-11-12', 'date'); eq(id.age, 14, 'age');
  await p.fill('#f-age', '150');
  let age = (await A.st()).identification.age;
  assert(age === null || (age >= 0 && age <= 120), 'age 150 accepte tel quel : ' + age);
  await p.fill('#f-age', '');
  eq((await A.st()).identification.age, null, 'age vide');
  await p.fill('#f-session', '0');
  const sn = (await A.st()).identification.session_no;
  assert(sn === null || sn >= 1, 'session 0 accepte tel quel : ' + sn);
});

check('Champs : sexe et condition (radios obligatoires non bloquantes)', async (A) => {
  await A.clic('input[name="sexe"][value="M"]');
  await A.clic('input[name="condition"][value="C"]');
  let id = (await A.st()).identification;
  eq(id.sexe, 'M', 'sexe'); eq(id.condition, 'C', 'condition');
  await A.clic('input[name="sexe"][value="F"]');
  await A.clic('input[name="condition"][value="A"]');
  id = (await A.st()).identification;
  eq(id.sexe, 'F', 'sexe F'); eq(id.condition, 'A', 'condition A');
  await A.go('synthese');
  eq(await A.panneauxVisibles(), ['synthese'], 'navigation libre malgre champs obligatoires vides');
});

check('Champs : boutons « Maintenant » remplissent l\'heure de debut et de fin', async (A) => {
  const proche = async (sel) => {
    const v = await A.page.inputValue(sel);
    assert(/^\d{2}:\d{2}$/.test(v), sel + ' = « ' + v + ' »');
    const d = await A.page.evaluate((x) => { const n = new Date(); const m = x.split(':'); return Math.abs(n.getHours() * 60 + n.getMinutes() - (+m[0] * 60 + +m[1])); }, v);
    assert(d <= 2 || d >= 1438, sel + ' = ' + v + ' loin de l\'heure courante');
    return v;
  };
  await A.page.click('#btn-debut-maintenant');
  const d = await proche('#f-debut');
  await A.page.click('#btn-fin-maintenant');
  const f = await proche('#f-fin');
  const id = (await A.st()).identification;
  eq(id.heure_debut, d, 'heure_debut dans l\'etat'); eq(id.heure_fin, f, 'heure_fin dans l\'etat');
});

check('Champs : diagnostic, observateur, co-evaluateur', async (A) => {
  await A.page.fill('#f-diagnostic', 'Polyhandicap, etiologie inconnue');
  await A.page.fill('#f-observateur', 'Psychomot');
  await A.page.fill('#f-coeval', 'Coeval 2');
  const id = (await A.st()).identification;
  eq(id.diagnostic, 'Polyhandicap, etiologie inconnue', 'diagnostic');
  eq(id.observateur, 'Psychomot', 'observateur'); eq(id.co_evaluateur, 'Coeval 2', 'co_evaluateur');
});

check('Champs : installation, precision « autre » visible seulement si autre', async (A) => {
  const autre = A.page.locator('#f-installation-autre');
  assert(!(await autre.isVisible()), '#f-installation-autre visible sans choix');
  for (const v of ['corset', 'fauteuil', 'matelas']) {
    await A.clic('input[name="installation"][value="' + v + '"]');
    eq((await A.st()).identification.installation, v, 'installation ' + v);
    assert(!(await autre.isVisible()), '#f-installation-autre visible avec ' + v);
  }
  await A.clic('input[name="installation"][value="autre"]');
  await autre.waitFor({ state: 'visible' });
  await autre.fill('Coussin sur mesure');
  const id = (await A.st()).identification;
  eq(id.installation, 'autre', 'installation autre'); eq(id.installation_autre, 'Coussin sur mesure', 'installation_autre');
  await A.clic('input[name="installation"][value="corset"]');
  assert(!(await autre.isVisible()), '#f-installation-autre encore visible apres retour a corset');
});

check('Champs : epreuve de rupture (cases multiples + commentaire)', async (A) => {
  await A.go('t1');
  await A.clic('input[data-rupture="surprise"]');
  await A.clic('input[data-rupture="reprise"]');
  await A.page.fill('#f-rupture-commentaire', 'Delai 5 s; reapparition des signes');
  let r = (await A.st()).rupture;
  eq(r, { surprise: true, recherche: false, reprise: true, indifference: false, commentaire: 'Delai 5 s; reapparition des signes' }, 'rupture');
  await A.clic('input[data-rupture="surprise"]');
  r = (await A.st()).rupture;
  eq(r.surprise, false, 'surprise decochee');
  eq(await A.page.isChecked('input[data-rupture="reprise"]'), true, 'reprise toujours cochee');
});

check('Champs : V3.1 duree max continue (secondes)', async (A) => {
  await A.go('t1');
  await A.page.fill('#f-v31-duree', '45');
  eq((await A.st()).v31_duree_sec, 45, 'v31_duree_sec');
  await A.page.fill('#f-v31-duree', '');
  eq((await A.st()).v31_duree_sec, null, 'v31_duree_sec vide');
});

check('Champs : T2 (-1, 0, +1, re-clic efface) et details', async (A) => {
  await A.go('t2');
  await A.clic('input[name="t2-tonus"][value="1"]');
  await A.clic('input[name="t2-posture"][value="-1"]');
  await A.clic('input[name="t2-emotion"][value="0"]');
  let t2 = (await A.st()).t2;
  eq(t2.tonus.evolution, 1, 'tonus'); eq(t2.posture.evolution, -1, 'posture'); eq(t2.emotion.evolution, 0, 'emotion');
  eq(t2.relation.evolution, null, 'relation non renseignee');
  await A.clic('input[name="t2-tonus"][value="1"]');
  t2 = (await A.st()).t2;
  eq(t2.tonus.evolution, null, 're-clic sur le choix actif');
  eq(await A.page.isChecked('input[name="t2-tonus"][value="1"]'), false, 'radio encore coche');
  await A.clic('input[name="t2-tonus"][value="-1"]');
  await A.clic('input[name="t2-tonus"][value="0"]');
  eq((await A.st()).t2.tonus.evolution, 0, 'changement de choix');
  await A.page.fill('textarea[data-t2="relation"]', 'Regard accrocheur');
  eq((await A.st()).t2.relation.details, 'Regard accrocheur', 'details');
});

check('Champs : mesures physiologiques, virgule decimale (72,5 -> 72.5)', async (A) => {
  await A.go('physio');
  const f = (m, t, v) => A.page.fill('input[data-physio="' + m + '"][data-temps="' + t + '"]', v);
  await f('fc', 't0', '72,5');
  await f('vfc', 't1', '41.25');
  await f('ced', 'rupture', '0,8');
  await f('spo2', 't2', '98');
  await f('fc', 't1', '80');
  await f('fc', 't1', '');
  const ph = (await A.st()).physio;
  eq(ph.fc.t0, 72.5, 'fc.t0'); eq(ph.vfc.t1, 41.25, 'vfc.t1'); eq(ph.ced.rupture, 0.8, 'ced.rupture');
  eq(ph.spo2.t2, 98, 'spo2.t2'); eq(ph.fc.t1, null, 'fc.t1 vide'); eq(ph.vfc.t0, null, 'vfc.t0 non saisi');
});

check('Champs : observations, evenements et conclusion', async (A) => {
  await A.go('t0'); await A.page.fill('textarea[data-obs="T0"]', 'Obs T0'); await A.page.fill('textarea[data-obs="T0.3"]', 'Sueurs');
  await A.go('t1'); await A.page.fill('textarea[data-obs="AXE2"]', 'Obs axe 2'); await A.page.fill('textarea[data-obs="V4.3"]', 'Sourire');
  await A.go('synthese'); await A.page.fill('#f-evenements', 'Bruit parasite'); await A.page.fill('#f-conclusion', 'Bonne tolerance');
  const s = await A.st();
  eq(s.observations['T0'], 'Obs T0', 'observations.T0'); eq(s.observations['T0.3'], 'Sueurs', 'observations.T0.3');
  eq(s.observations['AXE2'], 'Obs axe 2', 'observations.AXE2'); eq(s.observations['V4.3'], 'Sourire', 'observations.V4.3');
  eq(s.synthese, { evenements: 'Bruit parasite', conclusion: 'Bonne tolerance' }, 'synthese');
});

check('Champs : tout se retrouve dans etat() selon le schema grille-haptique/1', async (A) => {
  await remplirUI(A);
  const s = await A.st();
  eq(valideSchema(s), [], 'schema');
  eq(s.identification, {
    code_sujet: 'S01', session_no: 3, date: '2026-11-12', age: 14, sexe: 'F', heure_debut: '09:30', heure_fin: '10:15',
    diagnostic: 'Diag test', observateur: 'OBS1', co_evaluateur: 'OBS2', installation: 'corset', installation_autre: '', condition: 'B',
  }, 'identification');
  eq([s.cotations['T0.1'], s.cotations['T0.2'], s.cotations['V1.1'], s.cotations['V1.4'], s.cotations['V2.1'], s.cotations['V3.1']], [2, 'NA', 3, 2, 1, null], 'cotations');
  eq(s.observations['T0'], 'obs T0', 'obs T0'); eq(s.observations['V1.1'], 'obs v11', 'obs V1.1'); eq(s.observations['AXE1'], 'axe un', 'obs AXE1');
  eq(s.v31_duree_sec, 45, 'v31'); eq(s.rupture.surprise, true, 'rupture'); eq(s.rupture.commentaire, 'rupt', 'rupture commentaire');
  eq(s.t2.tonus, { evolution: 1, details: 'det' }, 't2.tonus'); eq(s.physio.fc.t0, 72.5, 'physio');
  eq(s.synthese, { evenements: 'ev', conclusion: 'concl' }, 'synthese');
  eq(s.scores.axe1, 4, 'score axe1'); eq(s.scores.axe2, 1, 'score axe2'); eq(s.scores.total, 5, 'score total');
  assert(Date.parse(s.modifie_le) >= Date.parse(s.cree_le), 'modifie_le anterieur a cree_le');
});

check('Synthese : liste « À compléter » (items non cotes, pas les NA)', async (A) => {
  await A.go('synthese');
  let t = await A.texteStep('synthese');
  assert(/compl/i.test(t), 'pas de rubrique « À compléter »');
  assert(/T0\.1(?!\d)/.test(t) && /V4\.3(?!\d)/.test(t), 'items non cotes absents de la liste');
  assert(/code/i.test(t) && /condition/i.test(t), 'champs obligatoires vides absents de la liste');
  await A.rate('T0.1', 2); await A.rate('T0.2', 'NA');
  await A.go('synthese');
  t = await A.texteStep('synthese');
  assert(!/T0\.1(?!\d)/.test(t), 'T0.1 (coté) encore dans la liste');
  assert(!/T0\.2(?!\d)/.test(t), 'T0.2 (NA) dans la liste alors que NA ne doit pas y figurer');
  assert(/T0\.3(?!\d)/.test(t), 'T0.3 (non coté) disparu de la liste');
});

/* ================================================================== */
/* 6. Persistance                                                      */
/* ================================================================== */

check('Persistance : apres rechargement, session, cotations et etape affichee restaurees', async (A) => {
  const p = A.page;
  await remplirUI(A);
  await A.go('t2');
  const avant = await A.st();
  await A.recharger();
  const apres = await A.st();
  eq(apres, avant, 'session apres rechargement');
  eq((await A.sessions()).length, 1, 'nombre de sessions');
  eq(await A.etapesCourantes(), ['t2'], 'etape courante restauree');
  eq(await A.panneauxVisibles(), ['t2'], 'panneau restaure');
  await A.go('session');
  eq(await p.inputValue('#f-code'), 'S01', 'champ #f-code');
  eq(await p.isChecked('input[name="condition"][value="B"]'), true, 'condition B cochee');
  await A.go('t1');
  eq(await p.getAttribute('button[data-rate="V1.1"][data-val="3"]', 'aria-pressed'), 'true', 'aria-pressed V1.1 restaure');
  await A.go('physio');
  const v = await p.inputValue('input[data-physio="fc"][data-temps="t0"]');
  eq(parseFloat(v.replace(',', '.')), 72.5, 'mesure affichee');
});

check('Persistance : cles localStorage grilleHaptique.v1.sessions et .courante', async (A) => {
  await A.page.fill('#f-code', 'LS1');
  const ls = await A.page.evaluate(() => ({ s: localStorage.getItem('grilleHaptique.v1.sessions'), c: localStorage.getItem('grilleHaptique.v1.courante') }));
  assert(ls.s !== null, 'cle grilleHaptique.v1.sessions absente');
  assert(ls.c !== null, 'cle grilleHaptique.v1.courante absente');
  const arr = JSON.parse(ls.s);
  assert(Array.isArray(arr) && arr.length === 1, 'sessions n\'est pas un tableau d\'un element');
  const e = await A.st();
  eq(ls.c.replace(/^"|"$/g, ''), e.id, 'courante = id de la session');
  eq(arr[0].id, e.id, 'id dans le tableau');
  eq(arr[0].identification.code_sujet, 'LS1', 'code enregistre');
  eq(arr[0].schema, 'grille-haptique/1', 'schema enregistre');
});

check('Persistance : #etat-enregistrement affiche « Enregistre a hh:mm » apres saisie', async (A) => {
  await A.page.fill('#f-code', 'LS2');
  const t = await A.page.locator('#etat-enregistrement').textContent();
  assert(/Enregistr.{1,2}\s+.*\d{1,2}\s*[:h]\s*\d{2}/.test(t), 'texte : « ' + t.trim() + ' »');
});

/* ================================================================== */
/* 7. Sessions                                                         */
/* ================================================================== */

check('Sessions : « Nouvelle session » cree une session vide sans perdre la premiere', async (A) => {
  await A.page.fill('#f-code', 'AAA');
  await A.rate('V1.1', 2);
  await A.panneau();
  const t = await A.page.locator('#panneau-sessions').innerText();
  assert(t.indexOf('AAA') >= 0, 'code AAA absent du panneau Sessions');
  await A.page.click('#btn-nouvelle');
  const ss = await A.sessions();
  eq(ss.length, 2, 'nombre de sessions');
  const cur = await A.st();
  assert(!cur.identification.code_sujet, 'la nouvelle session n\'est pas vide : ' + cur.identification.code_sujet);
  eq(cur.cotations['V1.1'], null, 'cotation de la nouvelle session');
  const ancienne = ss.find((s) => s.identification.code_sujet === 'AAA');
  assert(ancienne, 'la premiere session a disparu');
  eq(ancienne.cotations['V1.1'], 2, 'cotation de la premiere session');
  assert(ancienne.id !== cur.id, 'meme id pour les deux sessions');
  const ls = await A.page.evaluate(() => JSON.parse(localStorage.getItem('grilleHaptique.v1.sessions')).length);
  eq(ls, 2, 'sessions dans localStorage');
});

check('Sessions : liste triee par date decroissante', async (A) => {
  const vieille = blank({ id: 'tri-1', cree_le: '2026-01-01T08:00:00.000Z', modifie_le: '2026-01-01T09:00:00.000Z', identification: { code_sujet: 'VIEILLE1', session_no: 1, date: '2026-01-01' } });
  const recente = blank({ id: 'tri-2', cree_le: '2026-06-01T08:00:00.000Z', modifie_le: '2026-06-01T09:00:00.000Z', identification: { code_sujet: 'RECENTE1', session_no: 2, date: '2026-06-01' } });
  await A.importer({ schema: 'grille-haptique/1', exporte_le: '2026-11-12T10:00:00.000Z', sessions: [vieille, recente] });
  await A.page.waitForFunction(() => window.GrilleHaptique.sessions().length >= 3);
  await A.panneau();
  const t = await A.page.locator('#panneau-sessions').innerText();
  const i = t.indexOf('RECENTE1'); const j = t.indexOf('VIEILLE1');
  assert(i >= 0 && j >= 0, 'codes importes absents du panneau');
  assert(i < j, 'la session la plus recente n\'est pas listee en premier');
});

check('Sessions : « Effacer les donnees » avec confirmation acceptee vide tout', async (A) => {
  await A.page.fill('#f-code', 'AAA');
  await A.panneau();
  await A.page.click('#btn-nouvelle');
  eq((await A.sessions()).length, 2, 'avant effacement');
  await A.panneau();
  A.modeDialogue = 'accept';
  await A.page.click('#btn-effacer-tout');
  await A.page.waitForTimeout(300);
  assert(A.dialogs.length >= 1, 'aucune confirmation (window.confirm) demandee');
  const ss = await A.sessions();
  assert(ss.length <= 1, 'sessions restantes : ' + ss.length);
  assert(!ss.some((s) => s.identification.code_sujet === 'AAA'), 'la session AAA existe encore');
  const raw = await A.page.evaluate(() => (localStorage.getItem('grilleHaptique.v1.sessions') || ''));
  assert(raw.indexOf('AAA') < 0, 'AAA encore dans localStorage');
});

check('Sessions : « Effacer les donnees » avec confirmation refusee ne supprime rien', async (A) => {
  await A.page.fill('#f-code', 'AAA');
  await A.panneau();
  await A.page.click('#btn-nouvelle');
  await A.panneau();
  A.modeDialogue = 'dismiss';
  await A.page.click('#btn-effacer-tout');
  await A.page.waitForTimeout(300);
  assert(A.dialogs.length >= 1, 'aucune confirmation demandee');
  const ss = await A.sessions();
  eq(ss.length, 2, 'sessions apres refus');
  assert(ss.some((s) => s.identification.code_sujet === 'AAA'), 'AAA perdue malgre le refus');
});

/* ================================================================== */
/* 8. Exports                                                          */
/* ================================================================== */

check('Export JSON : nom de fichier et contenu conformes au schema grille-haptique/1', async (A) => {
  await remplirUI(A);
  await A.panneau();
  const d = await A.telecharger('#btn-export-json');
  eq(d.name, 'grille-haptique_S01_S3_2026-11-12.json', 'nom du fichier');
  let j;
  try { j = JSON.parse(d.text); } catch (e) { fail('JSON illisible : ' + e.message); }
  eq(valideSchema(j), [], 'schema du fichier');
  eq(j, await A.st(), 'fichier different de etat()');
});

check('Export JSON : parties vides remplacees par x dans le nom', async (A) => {
  await A.page.fill('#f-session', '');
  await A.page.fill('#f-date', '');
  await A.panneau();
  const d = await A.telecharger('#btn-export-json');
  eq(d.name, 'grille-haptique_x_Sx_x.json', 'nom du fichier');
});

check('Export JSON : sauvegarde complete (toutes les sessions)', async (A) => {
  await A.page.fill('#f-code', 'SAV1');
  await A.panneau();
  await A.page.click('#btn-nouvelle');
  await A.panneau();
  const d = await A.telecharger('#btn-export-tout');
  const m = /^grille-haptique_sauvegarde_(\d{4}-\d{2}-\d{2})\.json$/.exec(d.name);
  assert(m, 'nom du fichier : ' + d.name);
  assert(datesAcceptables().includes(m[1]), 'date du nom ' + m[1] + ' != ' + datesAcceptables().join(' ou '));
  const j = JSON.parse(d.text);
  eq(j.schema, 'grille-haptique/1', 'schema');
  assert(typeof j.exporte_le === 'string' && !isNaN(Date.parse(j.exporte_le)), 'exporte_le : ' + j.exporte_le);
  assert(Array.isArray(j.sessions) && j.sessions.length === 2, 'sessions : ' + (j.sessions && j.sessions.length));
  eq(j.sessions, await A.sessions(), 'sessions du fichier');
});

check('Export CSV : bouton, nom du fichier, BOM, en-tete exact, contenu = versCSV', async (A) => {
  await remplirUI(A);
  await A.panneau();
  const d = await A.telecharger('#btn-export-csv');
  const m = /^grille-haptique_sessions_(\d{4}-\d{2}-\d{2})\.csv$/.exec(d.name);
  assert(m, 'nom du fichier : ' + d.name);
  assert(datesAcceptables().includes(m[1]), 'date du nom ' + m[1]);
  eq([d.buf[0], d.buf[1], d.buf[2]], [0xEF, 0xBB, 0xBF], 'octets de BOM UTF-8');
  const csv = parseCSV(d.text);
  eq(csv.badNL, 0, 'fins de ligne autres que CRLF');
  eq(csv.records[0].join(';'), colonnesCSV().join(';'), 'en-tete');
  assert(csv.records.length >= 2, 'pas de ligne de donnees');
  const h = csv.records[0]; const r = csv.records[1];
  const c = (n) => r[h.indexOf(n)];
  eq(c('code_sujet'), 'S01', 'code_sujet'); eq(c('V1.4'), '2', 'V1.4'); eq(c('T0.2'), 'NA', 'T0.2'); eq(c('fc_t0'), '72,5', 'fc_t0');
  eq(c('rupture_surprise'), '1', 'rupture_surprise'); eq(c('rupture_reprise'), '0', 'rupture_reprise'); eq(c('score_axe1'), '4', 'score_axe1');
  const ref = await A.page.evaluate(() => window.GrilleHaptique.versCSV(window.GrilleHaptique.sessions()));
  eq(d.text, ref, 'fichier different de versCSV(sessions())');
});

check('Export : variantes -synthese declenchent les telechargements JSON et CSV', async (A) => {
  await A.page.fill('#f-code', 'SYN');
  await A.go('synthese');
  const j = await A.telecharger('#btn-export-json-synthese');
  assert(/^grille-haptique_SYN_S[0-9x]+_[0-9x-]+\.json$/.test(j.name), 'nom JSON : ' + j.name);
  eq(JSON.parse(j.text).schema, 'grille-haptique/1', 'schema du JSON');
  const c = await A.telecharger('#btn-export-csv-synthese');
  assert(/^grille-haptique_sessions_\d{4}-\d{2}-\d{2}\.csv$/.test(c.name), 'nom CSV : ' + c.name);
});

function fixtureCSV() {
  return [
    blank({
      id: 'abc-1', cree_le: '2026-11-12T09:30:00.000Z', modifie_le: '2026-11-12T10:05:00.000Z',
      identification: {
        code_sujet: 'S01', session_no: 3, date: '2026-11-12', age: 14, sexe: 'F', heure_debut: '09:30', heure_fin: '10:15',
        diagnostic: 'a;b', observateur: 'dit "oui"', co_evaluateur: 'ligne1\nligne2', installation: 'autre',
        installation_autre: '=SOMME(A1)', condition: 'B',
      },
      cotations: { 'T0.1': 2, 'T0.2': 'NA', 'V1.1': 3, 'V1.2': 2, 'V1.3': 1, 'V1.4': 2, 'V2.1': 1, 'V3.1': 2, 'V4.1': 0 },
      observations: { T0: '+1 test', AXE1: '-x', AXE2: '@home', AXE3: '=1+1', 'V1.1': 'RAS' },
      v31_duree_sec: 45,
      rupture: { surprise: true, recherche: false, reprise: true, indifference: false, commentaire: '@ici' },
      t2: { tonus: { evolution: 1, details: '-reste' }, posture: { evolution: -1 }, emotion: { evolution: 0 } },
      physio: { fc: { t0: 72.5 }, vfc: { t1: 41.25 }, ced: { rupture: 0.8 }, spo2: { t2: 98 } },
      synthese: { evenements: 'x;y', conclusion: 'fin' },
      scores: { axe1: 4, axe2: 1, axe3: 2, axe4: 0, total: 7, manquants: { axe1: 0, axe2: 3, axe3: 2, axe4: 2, total: 7 } },
    }),
    blank({ id: 'abc-2' }),
  ];
}
async function csvFixture(A) {
  const raw = await A.page.evaluate((s) => window.GrilleHaptique.versCSV(s), fixtureCSV());
  return { raw, csv: parseCSV(raw) };
}

check('CSV versCSV : BOM, separateur ;, fins de ligne CRLF, en-tete exact, largeur constante', async (A) => {
  const { raw, csv } = await csvFixture(A);
  eq(raw.charCodeAt(0), 0xFEFF, 'premier caractere (BOM)');
  eq(csv.unclosed, false, 'guillemet non ferme');
  eq(csv.badNL, 0, 'fins de ligne autres que CRLF');
  assert(raw.indexOf('\r\n') > 0, 'aucun CRLF');
  const cols = colonnesCSV();
  eq(csv.records[0], cols, 'en-tete');
  assert(!/;\r\n/.test(raw.split('\r\n')[0] + '\r\n'), 'en-tete termine par ;');
  eq(csv.records.length >= 3 ? csv.records.slice(1, 3).map((r) => r.length) : csv.records.map((r) => r.length), [cols.length, cols.length], 'nombre de champs par ligne');
  eq(csv.records[1][0], 'abc-1', 'ordre des sessions (1)'); eq(csv.records[2][0], 'abc-2', 'ordre des sessions (2)');
});

check('CSV versCSV : valeurs (virgule decimale, NA, vide, 1/0, zero)', async (A) => {
  const { raw, csv } = await csvFixture(A);
  const h = csv.records[0]; const r = csv.records[1]; const b = csv.records[2];
  const c = (n) => r[h.indexOf(n)];
  const expect = {
    id: 'abc-1', cree_le: '2026-11-12T09:30:00.000Z', modifie_le: '2026-11-12T10:05:00.000Z', code_sujet: 'S01', session_no: '3',
    date: '2026-11-12', age: '14', sexe: 'F', heure_debut: '09:30', heure_fin: '10:15', installation: 'autre', condition: 'B',
    'T0.1': '2', 'T0.2': 'NA', 'T0.3': '', 'V1.1': '3', 'V1.2': '2', 'V1.3': '1', 'V1.4': '2', 'V2.1': '1', 'V2.2': '', 'V3.1': '2', 'V4.1': '0', 'V4.2': '',
    v31_duree_sec: '45',
    rupture_surprise: '1', rupture_recherche: '0', rupture_reprise: '1', rupture_indifference: '0',
    t2_tonus: '1', t2_posture: '-1', t2_emotion: '0', t2_relation: '',
    fc_t0: '72,5', fc_t1: '', vfc_t1: '41,25', ced_rupture: '0,8', spo2_t2: '98', spo2_t0: '',
    score_axe1: '4', score_axe2: '1', score_axe3: '2', score_axe4: '0', score_total: '7',
    manquants_axe1: '0', manquants_axe2: '3', manquants_axe3: '2', manquants_axe4: '2', manquants_total: '7',
    evenements: 'x;y', conclusion: 'fin', 'obs_V1.1': 'RAS',
  };
  const pb = [];
  Object.keys(expect).forEach((k) => { if (c(k) !== expect[k]) pb.push(k + ' = « ' + c(k) + ' » (attendu « ' + expect[k] + ' »)'); });
  eq(pb, [], 'cellules');
  assert(raw.indexOf(';S01;3;2026-11-12;14;F;09:30;10:15;') >= 0, 'sequence code..heure_fin non brute (champs simples quotes ?)');
  const pointDec = h.filter((n, i) => /^(fc|vfc|ced|spo2)_/.test(n) && /\./.test(r[i]));
  eq(pointDec, [], 'colonnes physio avec point decimal');
  const vide = ['T0.1', 't2_tonus', 'fc_t0', 'V4.1', 'v31_duree_sec'].filter((n) => b[h.indexOf(n)] !== '');
  eq(vide, [], 'cellules non vides pour une session vierge');
  eq(RUPT.map((k) => b[h.indexOf('rupture_' + k)]), ['0', '0', '0', '0'], 'rupture d\'une session vierge');
});

check('CSV versCSV : guillemets doubles, champ entre guillemets si ; " ou saut de ligne', async (A) => {
  const { raw, csv } = await csvFixture(A);
  const h = csv.records[0]; const r = csv.records[1]; const q = csv.quoted[1];
  const c = (n) => r[h.indexOf(n)];
  const qq = (n) => q[h.indexOf(n)];
  eq(c('diagnostic'), 'a;b', 'diagnostic relu'); assert(qq('diagnostic'), 'diagnostic avec ; non entre guillemets');
  assert(raw.indexOf('"a;b"') >= 0, 'sequence "a;b" absente');
  eq(c('observateur'), 'dit "oui"', 'observateur relu'); assert(qq('observateur'), 'observateur avec " non entre guillemets');
  assert(raw.indexOf('"dit ""oui"""') >= 0, 'guillemets non doubles : sequence "dit ""oui""" absente');
  eq(c('co_evaluateur').replace(/\r\n/g, '\n'), 'ligne1\nligne2', 'co_evaluateur relu'); assert(qq('co_evaluateur'), 'saut de ligne non entre guillemets');
  eq(c('evenements'), 'x;y', 'evenements relu'); assert(qq('evenements'), 'evenements avec ; non entre guillemets');
  const inutiles = h.filter((n, i) => q[i] && !/[;"\r\n]/.test(r[i]));
  eq(inutiles, [], 'champs entre guillemets sans raison');
});

check('CSV versCSV : apostrophe devant un texte libre commencant par = + - @', async (A) => {
  const { csv } = await csvFixture(A);
  const h = csv.records[0]; const r = csv.records[1];
  const c = (n) => r[h.indexOf(n)];
  eq(c('installation_autre'), '\'=SOMME(A1)', 'installation_autre (=)');
  eq(c('obs_T0'), '\'+1 test', 'obs_T0 (+)');
  eq(c('obs_AXE1'), '\'-x', 'obs_AXE1 (-)');
  eq(c('obs_AXE2'), '\'@home', 'obs_AXE2 (@)');
  eq(c('obs_AXE3'), '\'=1+1', 'obs_AXE3 (=)');
  eq(c('rupture_commentaire'), '\'@ici', 'rupture_commentaire (@)');
  eq(c('t2_tonus_details'), '\'-reste', 't2_tonus_details (-)');
  eq(c('t2_posture'), '-1', 'valeur numerique -1 sans apostrophe');
  eq(c('obs_V1.1'), 'RAS', 'texte normal inchange');
  eq(c('date'), '2026-11-12', 'date inchangee');
});

/* ================================================================== */
/* 9. Import                                                           */
/* ================================================================== */

check('Import : une session seule', async (A) => {
  const s = blank({ id: 'imp-1', identification: { code_sujet: 'IMP1', session_no: 5, condition: 'C' }, cotations: { 'V1.1': 3, 'T0.1': 'NA' }, physio: { fc: { t0: 66.5 } } });
  await A.importer(s);
  await A.page.waitForFunction(() => window.GrilleHaptique.sessions().some((x) => x.id === 'imp-1'));
  const ss = await A.sessions();
  eq(ss.length, 2, 'nombre de sessions (session vide initiale + importee)');
  const i = ss.find((x) => x.id === 'imp-1');
  eq(i.identification.code_sujet, 'IMP1', 'code'); eq(i.cotations['V1.1'], 3, 'V1.1'); eq(i.cotations['T0.1'], 'NA', 'T0.1'); eq(i.physio.fc.t0, 66.5, 'fc.t0');
  const ls = await A.page.evaluate(() => JSON.parse(localStorage.getItem('grilleHaptique.v1.sessions')).map((x) => x.id));
  assert(ls.includes('imp-1'), 'session importee absente de localStorage');
  await A.panneau();
  assert((await A.page.locator('#panneau-sessions').innerText()).indexOf('IMP1') >= 0, 'IMP1 absent du panneau');
});

check('Import : sauvegarde complete (plusieurs sessions)', async (A) => {
  const a = blank({ id: 'bk-1', identification: { code_sujet: 'BK1' } });
  const b = blank({ id: 'bk-2', identification: { code_sujet: 'BK2' }, cotations: { 'V2.1': 1 } });
  await A.importer({ schema: 'grille-haptique/1', exporte_le: '2026-11-12T10:00:00.000Z', sessions: [a, b] });
  await A.page.waitForFunction(() => window.GrilleHaptique.sessions().length >= 3);
  const ss = await A.sessions();
  eq(ss.length, 3, 'nombre de sessions');
  eq(ss.filter((x) => /^bk-/.test(x.id)).map((x) => x.identification.code_sujet).sort(), ['BK1', 'BK2'], 'sessions importees');
});

check('Import : fusion par id, la plus recente modifie_le l\'emporte', async (A) => {
  const mk = (code, modif) => blank({ id: 'm1', modifie_le: modif, identification: { code_sujet: code } });
  const code = () => A.page.evaluate(() => { const s = window.GrilleHaptique.sessions().find((x) => x.id === 'm1'); return s ? s.identification.code_sujet : null; });
  await A.importer(mk('MILIEU', '2026-03-01T10:00:00.000Z'));
  await A.page.waitForFunction(() => window.GrilleHaptique.sessions().some((x) => x.id === 'm1'));
  eq(await code(), 'MILIEU', 'premiere importation');
  await A.importer(mk('RECENT', '2026-06-01T10:00:00.000Z'));
  await A.page.waitForFunction(() => window.GrilleHaptique.sessions().find((x) => x.id === 'm1').identification.code_sujet === 'RECENT')
    .catch(() => fail('la version plus recente n\'a pas remplace l\'ancienne (code = ' + 'obtenu apres delai)'));
  await A.importer(mk('ANCIEN', '2026-01-01T10:00:00.000Z'));
  await A.page.waitForTimeout(600);
  eq(await code(), 'RECENT', 'une version plus ancienne ne doit pas ecraser');
  eq((await A.sessions()).filter((x) => x.id === 'm1').length, 1, 'doublons de l\'id m1');
  eq((await A.sessions()).length, 2, 'nombre de sessions');
});

check('Import : fichier invalide (illisible, mauvais schema, sessions non tableau) ne modifie rien', async (A) => {
  await A.page.fill('#f-code', 'KEEP');
  const snap = async () => canon([await A.sessions(), await A.page.evaluate(() => localStorage.getItem('grilleHaptique.v1.sessions'))]);
  const avant = await snap();
  const invalides = {
    'pas du json {': 'texte illisible',
    '{"schema":"autre/9","id":"x","sessions":[{"id":"z"}]}': 'mauvais schema',
    '{"schema":"grille-haptique/1","exporte_le":"2026-01-01T00:00:00.000Z","sessions":"non"}': 'sessions non tableau',
    '[1,2,3]': 'tableau JSON',
  };
  for (const contenu of Object.keys(invalides)) {
    await A.importer(contenu);
    await A.page.waitForTimeout(500);
    eq(await snap(), avant, 'donnees modifiees par un fichier invalide (' + invalides[contenu] + ')');
  }
});

check('Import : fichier invalide affiche un message d\'erreur', async (A) => {
  const motif = /erreur|invalide|impossible|illisible|non valide|incorrect|n'est pas/i;
  await A.panneau();
  const avant = await A.corps();
  const nbDialogues = A.dialogs.length;
  await A.importer('pas du json {');
  await A.page.waitForTimeout(600);
  const apres = await A.corps();
  const nouveaux = A.dialogs.slice(nbDialogues).join(' ');
  const visible = apres !== avant && motif.test(apres) && !motif.test(avant);
  assert(visible || motif.test(nouveaux), 'aucun message d\'erreur visible ni alerte (texte inchange)');
});

/* ================================================================== */
/* 10. Securite                                                        */
/* ================================================================== */

check('Securite : HTML saisi (diagnostic, observations, conclusion) jamais interprete', async (A) => {
  const p = A.page;
  const xss = async (quand) => {
    await p.waitForTimeout(250);
    const r = await p.evaluate(() => ({ x: window.__xss, imgs: document.querySelectorAll('img').length, bad: document.querySelectorAll('[onerror]').length }));
    assert(r.x === undefined, 'window.__xss execute (' + quand + ')');
    assert(r.imgs === 0 && r.bad === 0, 'balise HTML injectee (' + quand + ') : img=' + r.imgs + ', onerror=' + r.bad);
  };
  await A.go('session');
  await p.fill('#f-diagnostic', XSS); await p.fill('#f-observateur', XSS); await p.fill('#f-coeval', XSS);
  await A.clic('input[name="installation"][value="autre"]'); await p.fill('#f-installation-autre', XSS);
  await A.go('t0'); await p.fill('textarea[data-obs="T0"]', XSS); await p.fill('textarea[data-obs="T0.1"]', XSS);
  await A.go('t1'); await p.fill('textarea[data-obs="V1.1"]', XSS); await p.fill('textarea[data-obs="AXE1"]', XSS); await p.fill('#f-rupture-commentaire', XSS);
  await A.go('t2'); await p.fill('textarea[data-t2="tonus"]', XSS);
  await A.go('synthese'); await p.fill('#f-evenements', XSS); await p.fill('#f-conclusion', XSS);
  eq((await A.st()).identification.diagnostic, XSS, 'diagnostic conserve tel quel');
  await xss('apres saisie');
  await A.panneau(); await xss('panneau Sessions');
  await A.go('synthese'); await xss('synthese');
  for (const k of STEPS) { await A.go(k); }
  await A.recharger();
  await xss('apres rechargement');
  for (const k of STEPS) { await A.go(k); }
  await xss('apres parcours des etapes');
  await A.panneau(); await xss('panneau apres rechargement');
  await A.go('session');
  eq(await p.inputValue('#f-diagnostic'), XSS, 'valeur restituee par value');
});

check('Securite : session importee dont les champs contiennent du HTML', async (A) => {
  const p = A.page;
  const obs = {}; OBS_PHASES.concat(ITEMS).forEach((k) => { obs[k] = XSS; });
  const t2 = {}; T2K.forEach((k) => { t2[k] = { details: XSS }; });
  const s = blank({
    id: 'xss-1',
    identification: { code_sujet: XSS, diagnostic: XSS, observateur: XSS, co_evaluateur: XSS, installation: 'autre', installation_autre: XSS, condition: 'A' },
    observations: obs, rupture: { commentaire: XSS }, t2, synthese: { evenements: XSS, conclusion: XSS },
  });
  const xss = async (quand) => {
    await p.waitForTimeout(250);
    const r = await p.evaluate(() => ({ x: window.__xss, imgs: document.querySelectorAll('img').length, bad: document.querySelectorAll('[onerror]').length }));
    assert(r.x === undefined, 'window.__xss execute (' + quand + ')');
    assert(r.imgs === 0 && r.bad === 0, 'balise HTML injectee (' + quand + ')');
  };
  await A.importer(s);
  await p.waitForFunction(() => window.GrilleHaptique.sessions().some((x) => x.id === 'xss-1'));
  await xss('apres import');
  await A.panneau(); await xss('panneau Sessions');
  // Ouverture de la session importee : les selecteurs « Ouvrir » ne font pas partie du contrat, essai au mieux.
  const ouvrir = p.locator('#panneau-sessions').getByRole('button', { name: /ouvrir/i });
  const n = await ouvrir.count();
  for (let i = 0; i < n; i++) {
    try { if (!(await p.locator('#panneau-sessions').isVisible())) await p.click('#btn-sessions'); await ouvrir.nth(i).click({ timeout: 1000 }); } catch (e) { /* ignore */ }
    for (const k of STEPS) { await A.go(k); }
    await xss('apres ouverture d\'une session (' + (i + 1) + '/' + n + ')');
  }
  await A.recharger();
  for (const k of STEPS) { await A.go(k); }
  await xss('apres rechargement');
});

/* ================================================================== */
/* 11. Adaptatif                                                       */
/* ================================================================== */

const MOBILE = { viewport: { width: 360, height: 740 } };

check('Adaptatif 360 px : aucun defilement horizontal sur les six etapes', async (A) => {
  const pb = [];
  for (const k of STEPS) {
    await A.go(k);
    await A.page.waitForTimeout(80);
    const m = await A.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    if (m.sw > m.iw) pb.push(k + ' : scrollWidth ' + m.sw + ' > ' + m.iw);
  }
  await A.panneau();
  const m = await A.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  if (m.sw > m.iw) pb.push('panneau Sessions : scrollWidth ' + m.sw + ' > ' + m.iw);
  eq(pb, [], 'debordements');
}, MOBILE);

check('Adaptatif 360 px : pas de debordement avec des textes longs et sans espaces', async (A) => {
  const p = A.page;
  const long = 'W'.repeat(300);
  await A.go('session'); await p.fill('#f-diagnostic', long); await p.fill('#f-observateur', long);
  await A.go('t1'); await p.fill('textarea[data-obs="V1.1"]', long); await p.fill('#f-rupture-commentaire', long);
  await A.go('physio'); await p.fill('input[data-physio="fc"][data-temps="t0"]', '1234567890123456789012345');
  await A.go('synthese'); await p.fill('#f-conclusion', long); await p.fill('#f-evenements', long);
  await A.panneau();
  const pb = [];
  for (const k of STEPS) {
    await A.go(k);
    await p.waitForTimeout(80);
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    if (m.sw > m.iw) pb.push(k + ' : ' + m.sw + ' > ' + m.iw);
  }
  eq(pb, [], 'debordements');
}, MOBILE);

check('Adaptatif 360 px : boutons de cotation d\'au moins 44 px de haut', async (A) => {
  const attendu = { t0: 25, t1: 70 };
  for (const k of ['t0', 't1']) {
    await A.go(k);
    const r = await A.page.evaluate(() => {
      const b = [...document.querySelectorAll('button[data-rate]')].filter((x) => x.getClientRects().length > 0);
      return { n: b.length, min: Math.min.apply(null, b.map((x) => x.getBoundingClientRect().height)) };
    });
    eq(r.n, attendu[k], 'boutons de cotation visibles sur ' + k);
    assert(r.min >= 43.9, 'hauteur minimale ' + r.min.toFixed(1) + ' px sur ' + k);
  }
}, MOBILE);

check('Adaptatif 360 px : boutons d\'etape et de navigation d\'au moins 44 px de haut', async (A) => {
  const r = await A.page.evaluate(() => {
    const h = (s) => [...document.querySelectorAll(s)].filter((x) => x.getClientRects().length > 0).map((x) => x.getBoundingClientRect().height);
    return { steps: h('button[data-step]'), nav: h('#btn-suivant, #btn-precedent') };
  });
  assert(r.steps.length === 6, 'boutons d\'etape visibles : ' + r.steps.length);
  assert(r.nav.length >= 1, 'boutons Precedent/Suivant invisibles');
  assert(Math.min.apply(null, r.steps) >= 43.9, 'bouton d\'etape de ' + Math.min.apply(null, r.steps).toFixed(1) + ' px');
  assert(Math.min.apply(null, r.nav) >= 43.9, 'bouton de navigation de ' + Math.min.apply(null, r.nav).toFixed(1) + ' px');
}, MOBILE);

/* ================================================================== */
/* 12. Poids et hygiene du fichier                                     */
/* ================================================================== */

statique('Fichier : moins de 350 Ko (358 400 octets)', async () => {
  const n = fs.statSync(HTML).size;
  assert(n < 358400, 'taille ' + n + ' octets (limite 358400)');
});

statique('Fichier : aucune URL http:// ou https:// hors espace de noms SVG', async () => {
  const txt = fs.readFileSync(HTML, 'utf8').split('http://www.w3.org/').join('');
  const lignes = txt.split('\n'); const hits = [];
  lignes.forEach((l, i) => { if (/https?:\/\//i.test(l)) hits.push((i + 1) + ': ' + l.trim().slice(0, 80)); });
  eq(hits, [], 'occurrences');
});

statique('Fichier : aucun caractere invisible ou espace exotique (U+00A0, U+200B-200F, U+202F, U+2060, U+FEFF)', async () => {
  const txt = fs.readFileSync(HTML, 'utf8');
  const hits = []; let ligne = 1; let col = 0;
  for (const ch of txt) {
    col++;
    const cp = ch.codePointAt(0);
    if (cp === 0x0A) { ligne++; col = 0; continue; }
    if (cp === 0xA0 || (cp >= 0x200B && cp <= 0x200F) || cp === 0x202F || cp === 0x2060 || cp === 0xFEFF) {
      hits.push('U+' + cp.toString(16).toUpperCase().padStart(4, '0') + ' ligne ' + ligne + ' col ' + col);
      if (hits.length >= 5) break;
    }
  }
  eq(hits, [], 'caracteres interdits');
});

statique('Fichier : en-tete (lang=fr, viewport), couleurs de la charte, themes, impression, polices IBM Plex avec repli systeme', async () => {
  const h = fs.readFileSync(HTML, 'utf8');
  assert(/<html[^>]*\blang=["']fr["']/i.test(h), '<html lang="fr"> absent');
  const vp = h.match(/<meta[^>]*name=["']viewport["'][^>]*>/i);
  assert(vp && /width=device-width,\s*initial-scale=1(?![.\d])/.test(vp[0]), 'meta viewport non conforme');
  ['#2F2C62', '#0E6B62', '#0A4A44', '#D5E6E3', '#EEF1F0', '#41B3A4'].forEach((c) => assert(h.toUpperCase().indexOf(c) >= 0, 'couleur ' + c + ' absente'));
  assert(/prefers-color-scheme/.test(h), 'prefers-color-scheme absent');
  assert(/prefers-reduced-motion/.test(h), 'prefers-reduced-motion absent');
  assert(/@media\s+print/.test(h), '@media print absent');
  assert(/--sans:\s*"IBM Plex Sans",\s*system-ui/.test(h), 'pile --sans : IBM Plex Sans puis repli system-ui absente');
  assert(/--serif:\s*"Newsreader"/.test(h) && /--mono:\s*"IBM Plex Mono"/.test(h), 'piles --serif (Newsreader) ou --mono (IBM Plex Mono) absentes');
});

statique('Fichier : ni ressource externe ni API reseau (script/link src, @import, fetch, XMLHttpRequest...), quatre @font-face en data:font/woff2', async () => {
  const h = fs.readFileSync(HTML, 'utf8');
  const motifs = [
    [/<script[^>]+\bsrc\s*=/i, '<script src>'], [/<link[^>]+\bhref\s*=\s*(?!["']?data:)/i, '<link href>'], [/@import/i, '@import'],
    [/\bfetch\s*\(/, 'fetch('], [/XMLHttpRequest/, 'XMLHttpRequest'], [/sendBeacon/, 'sendBeacon'], [/\bWebSocket\b/, 'WebSocket'],
    [/\bEventSource\b/, 'EventSource'], [/\bimportScripts\b/, 'importScripts'],
  ];
  const hits = motifs.filter((m) => m[0].test(h)).map((m) => m[1]);
  eq(hits, [], 'motifs interdits');
  const faces = h.match(/@font-face\{[^}]*\}/g) || [];
  eq(faces.length, 4, 'nombre de @font-face');
  faces.forEach((f) => assert(/src:url\(data:font\/woff2;base64,[A-Za-z0-9+\/=]+\) format\('woff2'\)/.test(f), '@font-face sans police incorporee en data:font/woff2'));
  eq(Array.from(new Set(faces.map((f) => (f.match(/font-family:'([^']+)'/) || [])[1]))).sort(), ['IBM Plex Mono', 'IBM Plex Sans', 'Newsreader'], 'familles incorporees');
  eq(h.match(/url\((?!data:|#)/g) || [], [], 'url() autres que data: ou #');
});

statique('Fichier : pas de banniere ni de commentaire d\'attribution', async () => {
  const lignes = fs.readFileSync(HTML, 'utf8').split('\n'); const hits = [];
  lignes.forEach((l, i) => { if (/claude|anthropic|generated (with|by)|co-authored|généré (par|avec)/i.test(l)) hits.push((i + 1) + ': ' + l.trim().slice(0, 80)); });
  eq(hits, [], 'mentions');
});

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

function avecDelai(p, ms) {
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('delai global de ' + ms + ' ms depasse')), ms); })])
    .finally(() => clearTimeout(t));
}

async function main() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) {
    console.error('Playwright introuvable : ' + e.message); process.exit(3);
  }
  let browser;
  try { browser = await chromium.launch(); } catch (e) {
    console.error('Chromium ne demarre pas : ' + e.message); process.exit(3);
  }
  const arret = async () => { try { await browser.close(); } catch (e) { /* ignore */ } process.exit(130); };
  process.on('SIGINT', arret); process.on('SIGTERM', arret);

  let reussis = 0;
  try {
    const filtre = process.env.GRILLE_FILTRE ? new RegExp(process.env.GRILLE_FILTRE, 'i') : null;
    const aLancer = filtre ? checks.filter((c) => filtre.test(c.name)) : checks;
    for (const c of aLancer) {
      let A = null;
      try {
        if (c.opts.page === false) await c.fn(null);
        else {
          A = await avecDelai(ouvrir(browser, c.opts), 20000);
          await avecDelai(c.fn(A), 30000);
        }
        reussis++;
        console.log('OK  ' + c.name);
      } catch (e) {
        console.log('ECHEC  ' + c.name + ' : ' + raison(e));
      } finally {
        if (A) { try { await avecDelai(A.ctx.close(), 5000); } catch (e) { /* ignore */ } }
      }
    }
  } finally {
    try { await browser.close(); } catch (e) { /* ignore */ }
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
  const total = process.env.GRILLE_FILTRE ? checks.filter((c) => new RegExp(process.env.GRILLE_FILTRE, 'i').test(c.name)).length : checks.length;
  console.log('\n' + reussis + '/' + total + ' reussis');
  process.exit(reussis === total ? 0 : 1);
}

main().catch((e) => { console.error('Erreur fatale : ' + (e && e.stack || e)); process.exit(3); });
