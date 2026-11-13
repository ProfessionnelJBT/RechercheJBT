#!/usr/bin/env node
'use strict';

/*
 * Suite de tests de bout en bout : ergonomie globale (contrat F, F0 a F5), poids et hygiene.
 * Ecrite uniquement a partir du contrat F ; le code de grille-haptique.html n'a pas ete lu.
 * Donnees : jeux fictifs uniquement, aucune donnee de sante reelle.
 *
 * Usage : node protocole-haptique/tests/ergonomie-globale.test.js
 * Variables d'environnement facultatives : GRILLE_HTML (autre fichier HTML a tester),
 * GRILLE_FILTRE (expression reguliere : ne lance que les controles dont le nom correspond).
 * Sortie : "OK  nom" ou "ECHEC  nom : raison" par controle, "IGNORE  nom : raison" pour un controle
 * non automatisable (non compte), puis "n/N reussis".
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
const T1 = ['V1.1', 'V1.2', 'V1.3', 'V1.4', 'V2.1', 'V2.2', 'V2.3', 'V2.4', 'V3.1', 'V3.2', 'V3.3', 'V4.1', 'V4.2', 'V4.3'];
const ITEMS = T0.concat(T1);
const OBS_PHASES = ['T0', 'AXE1', 'AXE2', 'AXE3', 'AXE4'];
const T2K = ['tonus', 'posture', 'emotion', 'relation'];
const PHYS = ['fc', 'vfc', 'ced', 'spo2'];
const TEMPS = ['t0', 't1', 'rupture', 't2'];
const XSS = '<img src=x onerror="window.__xss=1">';

/* ------------------------------------------------------------------ */
/* Outils generiques                                                   */
/* ------------------------------------------------------------------ */

class Ignore extends Error {}
function ignorer(msg) { throw new Ignore(msg); }
function fail(msg) { throw new Error(msg); }
function assert(cond, msg) { if (!cond) fail(msg); }
function dort(ms) { return new Promise((r) => setTimeout(r, ms)); }
function canon(x) {
  if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
  return x === undefined ? 'undefined' : JSON.stringify(x);
}
function eq(actual, expected, label) {
  if (canon(actual) !== canon(expected)) {
    let a = canon(actual); let e = canon(expected);
    if (a.length > 500) a = a.slice(0, 500) + '...';
    if (e.length > 500) e = e.slice(0, 500) + '...';
    fail(label + ' : attendu ' + e + ', obtenu ' + a);
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
function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
/* normalisation qui ne touche pas aux espaces insecables (hygiene) */
function normAscii(s) { return String(s).replace(/[ \t\r\n]+/g, ' ').replace(/^ | $/g, ''); }
function raison(e) {
  const lignes = String((e && e.message) || e).split('\n').map((l) => l.trim()).filter(Boolean);
  let r = lignes[0] || 'erreur inconnue';
  const loc = lignes.find((l) => /waiting for|locator\(|selector/.test(l) && l !== lignes[0]);
  if (loc) r += ' | ' + loc;
  return r.length > 600 ? r.slice(0, 597) + '...' : r;
}
function fr(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }
function pluriel(n, mot) { return n + ' ' + mot + (n > 1 ? 's' : ''); }

/* ------------------------------------------------------------------ */
/* Jeux de donnees fictifs                                             */
/* ------------------------------------------------------------------ */

let compteurId = 0;
function blank(over) {
  const cotations = {}; ITEMS.forEach((c) => { cotations[c] = null; });
  const observations = {}; OBS_PHASES.concat(ITEMS).forEach((c) => { observations[c] = ''; });
  const t2 = {}; T2K.forEach((k) => { t2[k] = { evolution: null, details: '' }; });
  const physio = {}; PHYS.forEach((m) => { physio[m] = {}; TEMPS.forEach((t) => { physio[m][t] = null; }); });
  compteurId += 1;
  const s = {
    schema: 'grille-haptique/1', id: 'fixture-' + compteurId, cree_le: '2026-11-12T09:30:00.000Z', modifie_le: '2026-11-12T10:05:00.000Z',
    identification: { code_sujet: '', session_no: 1, date: '2026-11-12', age: null, sexe: null, heure_debut: '', heure_fin: '',
      diagnostic: '', observateur: '', co_evaluateur: '', installation: null, installation_autre: '', condition: null },
    cotations, observations, v31_duree_sec: null,
    rupture: { surprise: false, recherche: false, reprise: false, indifference: false, commentaire: '' },
    t2, physio, synthese: { evenements: '', conclusion: '' },
    scores: { axe1: null, axe2: null, axe3: null, axe4: null, total: null, manquants: { axe1: 4, axe2: 4, axe3: 3, axe4: 3, total: 14 } },
  };
  return merge(s, over);
}
function calcScores(cot) {
  const v = (c) => (typeof cot[c] === 'number' ? cot[c] : null);
  const axe = (items, inverse) => {
    let s = 0; let n = 0; let man = 0;
    items.forEach((c) => { const x = v(c); if (x === null) man++; else { s += (c === inverse ? -x : x); n++; } });
    return { s: n ? s : null, man };
  };
  const a1 = axe(['V1.1', 'V1.2', 'V1.3', 'V1.4'], 'V1.4'); const a2 = axe(['V2.1', 'V2.2', 'V2.3', 'V2.4']);
  const a3 = axe(['V3.1', 'V3.2', 'V3.3']); const a4 = axe(['V4.1', 'V4.2', 'V4.3']);
  const vals = [a1.s, a2.s, a3.s, a4.s].filter((x) => x !== null);
  return {
    scores: { axe1: a1.s, axe2: a2.s, axe3: a3.s, axe4: a4.s, total: vals.length ? vals.reduce((x, y) => x + y, 0) : null },
    manquants: { axe1: a1.man, axe2: a2.man, axe3: a3.man, axe4: a4.man, total: a1.man + a2.man + a3.man + a4.man },
  };
}
/* session dont les scores sont coherents avec les cotations */
function sess(over) {
  const s = blank(over); const c = calcScores(s.cotations);
  s.scores = Object.assign({}, c.scores, { manquants: c.manquants });
  return s;
}
function sauvegarde(sessions) { return { schema: 'grille-haptique/1', exporte_le: '2026-11-12T10:00:00.000Z', sessions }; }
const stockage = (jeu, id) => ({ sessions: jeu, courante: id });
const tousCotes = (v) => { const o = {}; ITEMS.forEach((c, i) => { o[c] = typeof v === 'function' ? v(c, i) : v; }); return o; };
const T2_PLEIN = { tonus: { evolution: 1 }, posture: { evolution: 0 }, emotion: { evolution: -1 }, relation: { evolution: 1 } };

/* ------------------------------------------------------------------ */
/* Application sous test                                               */
/* ------------------------------------------------------------------ */

let apiAbsente = false;
let BROWSER = null;

async function ouvrir(browser, opt) {
  opt = opt || {};
  const ctxOpt = { viewport: opt.viewport || { width: 1280, height: 900 }, acceptDownloads: true, colorScheme: opt.colorScheme || 'light' };
  if (opt.tactile) { ctxOpt.hasTouch = true; ctxOpt.isMobile = true; }
  const ctx = await browser.newContext(ctxOpt);
  ctx.setDefaultTimeout(1500);
  ctx.setDefaultNavigationTimeout(8000);
  await ctx.addInitScript(() => { window.__xss = 0; });
  if (opt.storage) {
    await ctx.addInitScript((st) => {
      try {
        if (!localStorage.getItem('grilleHaptique.v1.sessions')) {
          localStorage.setItem('grilleHaptique.v1.sessions', JSON.stringify(st.sessions));
          localStorage.setItem('grilleHaptique.v1.courante', st.courante);
        }
      } catch (e) { /* ignore */ }
    }, opt.storage);
  }
  if (opt.local) {
    await ctx.addInitScript((kv) => { try { Object.keys(kv).forEach((k) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, kv[k]); }); } catch (e) { /* ignore */ } }, opt.local);
  }
  if (opt.dossier === false) {
    await ctx.addInitScript(() => { try { delete window.showDirectoryPicker; } catch (e) { /* ignore */ } });
  } else if (opt.dossier) await ctx.addInitScript(installerFauxDossier, opt.dossier === true ? {} : opt.dossier);
  if (opt.init) await ctx.addInitScript(opt.init, opt.initArg);
  const page = await ctx.newPage();
  const A = { ctx, page, errors: [], requests: [], dialogs: [], modeDialogue: 'accept' };
  page.on('console', (m) => { if (m.type() === 'error') A.errors.push('console.error : ' + m.text()); });
  page.on('pageerror', (e) => A.errors.push('pageerror : ' + e.message));
  page.on('request', (r) => A.requests.push(r.url()));
  page.on('dialog', async (d) => { A.dialogs.push(d.message()); try { if (A.modeDialogue === 'dismiss') await d.dismiss(); else await d.accept(); } catch (e) { /* ignore */ } });

  A.attendreAPI = async () => {
    try { await page.waitForFunction(() => window.GrilleHaptique && typeof window.GrilleHaptique.etat === 'function', null, { timeout: apiAbsente ? 300 : 3000 }); } catch (e) { apiAbsente = true; }
  };
  /* attente active en temps reel */
  A.attendre = async (fn, arg, ms, quoi) => {
    const fin = Date.now() + (ms || 1500); let v;
    for (;;) { v = await page.evaluate(fn, arg); if (v) return v; if (Date.now() > fin) fail('delai depasse : ' + (quoi || 'condition')); await dort(25); }
  };
  A.api = async (nom) => {
    const t = await page.evaluate((n) => (window.GrilleHaptique ? typeof window.GrilleHaptique[n] : 'absent'), nom);
    if (t !== 'function') fail('GrilleHaptique.' + nom + '() absente (' + t + ')');
  };
  A.st = () => page.evaluate(() => window.GrilleHaptique.etat());
  A.sessions = () => page.evaluate(() => window.GrilleHaptique.sessions());
  A.participants = () => page.evaluate(() => window.GrilleHaptique.participants());
  A.go = (k) => page.evaluate((x) => window.GrilleHaptique.allerA(x), k);
  A.existe = async (sel) => (await page.locator(sel).count()) > 0;
  A.visible = (sel) => page.locator(sel).first().isVisible();
  A.exige = async (sel, quoi) => { if (!(await page.locator(sel).count())) fail((quoi || sel) + ' absent (' + sel + ')'); };
  A.texte = async (sel) => { await A.exige(sel); return normAscii(await page.locator(sel).first().textContent()); };
  A.clic = async (sel) => {
    const l = page.locator(sel).first();
    try { await l.click({ timeout: 1000 }); } catch (e) { await l.evaluate((el) => el.click(), null, { timeout: 1000 }); }
  };
  A.panneau = async () => {
    const p = page.locator('#panneau-sessions');
    if (!(await p.isVisible())) await page.click('#btn-sessions');
    await p.waitFor({ state: 'visible' });
  };
  A.fermerPanneau = async () => {
    const p = page.locator('#panneau-sessions');
    if (!(await p.isVisible())) return;
    try { await page.keyboard.press('Escape'); await p.waitFor({ state: 'hidden', timeout: 600 }); return; } catch (e) { /* ignore */ }
    try { await p.getByRole('button', { name: /fermer/i }).first().click({ timeout: 800 }); await p.waitFor({ state: 'hidden', timeout: 600 }); } catch (e) { /* ignore */ }
  };
  A.ouvrirVue = async () => {
    if (!(await A.visible('#vue-participants'))) await page.click('#btn-participants');
    await page.locator('#vue-participants').waitFor({ state: 'visible' });
  };
  A.fiche = async (cle) => {
    const ok = await page.evaluate((c) => window.GrilleHaptique.ouvrirParticipants(c), cle);
    if (!ok) fail('ouvrirParticipants("' + cle + '") n\'a pas affiche de fiche');
  };
  A.importer = async (contenu, ids) => {
    const f = path.join(TMP, 'import-' + Math.random().toString(36).slice(2) + '.json');
    fs.writeFileSync(f, typeof contenu === 'string' ? contenu : JSON.stringify(contenu));
    await page.setInputFiles('#in-import', f);
    if (ids && ids.length) await page.waitForFunction((l) => { const s = window.GrilleHaptique.sessions().map((x) => x.id); return l.every((i) => s.indexOf(i) >= 0); }, ids, { timeout: 3000 });
    else await page.waitForTimeout(200);
  };
  A.stockees = () => page.evaluate(() => JSON.parse(localStorage.getItem('grilleHaptique.v1.sessions') || '[]'));
  A.cles = () => page.evaluate(() => Object.keys(localStorage).sort());
  /* recharge la page avec un autre jeu de sessions et une autre session courante */
  A.charger = async (jeu, id) => {
    await ctx.addInitScript((st) => { try { localStorage.setItem('grilleHaptique.v1.sessions', JSON.stringify(st.sessions)); localStorage.setItem('grilleHaptique.v1.courante', st.courante); } catch (e) { /* ignore */ } }, stockage(jeu, id));
    await page.reload(); await A.attendreAPI();
    const e = await A.st();
    assert(e && e.id === id, 'la session courante apres rechargement est "' + (e && e.id) + '" au lieu de "' + id + '"');
  };
  A.coter = (c, v) => page.evaluate((a) => { const b = document.querySelector('button[data-rate="' + a.c + '"][data-val="' + a.v + '"]'); if (!b) throw new Error('bouton de cotation ' + a.c + '/' + a.v + ' introuvable'); b.click(); }, { c, v });
  A.code = (v) => page.evaluate((x) => { const i = document.getElementById('f-code'); i.value = x; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  await page.goto(URL_APP);
  await A.attendreAPI();
  if (apiAbsente) fail('window.GrilleHaptique absente (l\'application n\'expose pas son interface de test)');
  return A;
}

/* ------------------------------------------------------------------ */
/* Harnais                                                             */
/* ------------------------------------------------------------------ */

const checks = [];
function check(name, fn, opts) { checks.push({ name, fn, opts: opts || {} }); }
function statique(name, fn) { checks.push({ name, fn, opts: { page: false } }); }

/* lecture du fichier HTML (statique) */
const LIRE_HTML = () => fs.readFileSync(HTML, 'utf8');

/* ------------------------------------------------------------------ */
/* Faux dossier en memoire (injecte avant le chargement de la page).   */
/* N'implemente que les API listees en E2 ; tout autre appel echoue.   */
/* Journalise aussi le contenu de chaque fichier ecrit (histo).        */
/* ------------------------------------------------------------------ */

function installerFauxDossier(cfg0) {
  const C = Object.assign({ nom: 'Dossier-Test', permission: 'granted' }, cfg0 || {});
  const J = []; const histo = []; const violations = []; let seq = 0;
  const log = (op, d) => { J.push(Object.assign({ n: ++seq, op }, d || {})); };
  const dom = (nom, msg) => new DOMException(msg || nom, nom);
  const verif = (op, o) => { if (!o || o.mode !== 'readwrite') violations.push(op + ' appele sans {mode:"readwrite"}'); };
  const noeud = (type, nom) => ({ type, nom, enfants: new Map(), contenu: '' });
  const racine = noeud('dir', C.nom);
  const chem = (c, n) => c.concat(n === undefined ? [] : [n]).join('/');
  function poignee(n, c) {
    const h = { kind: n.type === 'dir' ? 'directory' : 'file', name: n.nom };
    h.queryPermission = async (o) => { verif('queryPermission', o); log('queryPermission'); return C.permission; };
    h.requestPermission = async (o) => { verif('requestPermission', o); log('requestPermission'); return C.permission; };
    if (n.type === 'dir') {
      h.getDirectoryHandle = async (nom, o) => {
        log('getDirectoryHandle', { chemin: chem(c, nom), create: !!(o && o.create) });
        const e = n.enfants.get(nom);
        if (e) { if (e.type !== 'dir') throw dom('TypeMismatchError'); return poignee(e, c.concat(nom)); }
        if (o && o.create) { const d = noeud('dir', nom); n.enfants.set(nom, d); return poignee(d, c.concat(nom)); }
        throw dom('NotFoundError');
      };
      h.getFileHandle = async (nom, o) => {
        log('getFileHandle', { chemin: chem(c, nom), create: !!(o && o.create) });
        const e = n.enfants.get(nom);
        if (e) { if (e.type !== 'file') throw dom('TypeMismatchError'); return poignee(e, c.concat(nom)); }
        if (o && o.create) { const f = noeud('file', nom); n.enfants.set(nom, f); return poignee(f, c.concat(nom)); }
        throw dom('NotFoundError');
      };
      h.removeEntry = async (nom, o) => {
        log('removeEntry', { chemin: chem(c, nom) });
        const e = n.enfants.get(nom);
        if (!e) throw dom('NotFoundError');
        if (e.type === 'dir' && e.enfants.size && !(o && o.recursive)) throw dom('InvalidModificationError');
        n.enfants.delete(nom);
      };
      h.values = () => {
        log('values', { chemin: chem(c) });
        const liste = [...n.enfants.values()];
        return (async function* () { for (const e of liste) yield poignee(e, c.concat(e.nom)); })();
      };
    } else {
      h.getFile = async () => { log('getFile', { chemin: chem(c) }); return { text: async () => n.contenu }; };
      h.createWritable = async () => {
        log('createWritable', { chemin: chem(c) });
        let tampon = '';
        return {
          write: async (d) => { if (typeof d !== 'string') violations.push('write() appele avec autre chose qu\'une chaine'); tampon += d; },
          close: async () => { log('close', { chemin: chem(c) }); n.contenu = tampon; histo.push({ chemin: chem(c), contenu: tampon }); },
        };
      };
    }
    return h;
  }
  const hRacine = poignee(racine, []);
  window.showDirectoryPicker = async (o) => { log('showDirectoryPicker', { mode: o && o.mode }); verif('showDirectoryPicker', o); return hRacine; };
  const parcours = (n, c, out) => { n.enfants.forEach((e, nom) => { if (e.type === 'file') out[chem(c, nom)] = e.contenu; else parcours(e, c.concat(nom), out); }); return out; };
  window.__fd = {
    cfg: C, journal: J, histo, violations,
    arbre: () => parcours(racine, [], {}),
    poser: (chemin, contenu) => {
      const p = chemin.split('/'); let n = racine;
      p.slice(0, -1).forEach((d) => { let e = n.enfants.get(d); if (!e) { e = noeud('dir', d); n.enfants.set(d, e); } n = e; });
      const f = noeud('file', p[p.length - 1]); f.contenu = contenu; n.enfants.set(f.nom, f);
    },
    raz: () => { J.length = 0; histo.length = 0; },
  };
}

/* ================================================================== */
/* F0. Activation du dossier sans ecrasement                           */
/* ================================================================== */

const SAUV = 'grille-haptique_sauvegarde.json';
const jeuDossier = () => [
  sess({ id: 'd1', identification: { code_sujet: 'AA1', session_no: 1, date: '2026-03-02' } }),
  sess({ id: 'd2', identification: { code_sujet: 'AA1', session_no: 2, date: '2026-03-09' } }),
  sess({ id: 'd3', identification: { code_sujet: 'BB2', session_no: 1, date: '2026-03-03' } }),
  sess({ id: 'd4', identification: { code_sujet: '', session_no: 5, date: '2026-03-04' } }),
  sess({ id: 'd5', identification: { code_sujet: 'CC3', session_no: null, date: '' } }),
];
function nomFichier(s) {
  const i = s.identification; const x = (v) => (v === null || v === undefined || v === '' ? 'x' : String(v));
  const code = i.code_sujet;
  return (code === '' ? 'sans-code' : code) + '/grille-haptique_' + x(code) + '_S' + x(i.session_no) + '_' + x(i.date) + '_' + s.id + '.json';
}
const D2_LOCAL = jeuDossier()[1];
const D2_NEUF = sess(merge(D2_LOCAL, { modifie_le: '2026-11-12T11:30:00.000Z', identification: { observateur: 'DOSSIER' }, cotations: { 'V1.1': 3 } }));
const D2_ANCIEN = sess(merge(D2_LOCAL, { modifie_le: '2026-01-01T08:00:00.000Z', identification: { observateur: 'ANCIEN' } }));
const Z9 = sess({ id: 'z9', modifie_le: '2026-11-12T10:00:00.000Z', identification: { code_sujet: 'ZZ9', session_no: 1, date: '2026-03-20' } });
const OPT_D = (extra) => Object.assign({ storage: stockage(jeuDossier(), 'd2'), dossier: {} }, extra || {});
const msDe = (s) => Date.parse(s.modifie_le);
const jsonSur = (c) => { try { return JSON.parse(c); } catch (e) { return null; } };

async function stabiliser(A) {
  let n = -1;
  for (let i = 0; i < 40; i++) { const m = await A.page.evaluate(() => window.__fd.journal.length); if (m === n) return; n = m; await dort(120); }
}
async function attendreEtatDossier(A, etat) {
  try { await A.page.waitForFunction((x) => { const e = document.getElementById('etat-dossier'); return e && e.getAttribute('data-etat-dossier') === x; }, etat, { timeout: 2000 }); } catch (e) {
    fail('#etat-dossier[data-etat-dossier] devrait valoir "' + etat + '", valeur : ' + await A.page.evaluate(() => { const e = document.getElementById('etat-dossier'); return e ? e.getAttribute('data-etat-dossier') + ' / ' + e.textContent.trim() : 'absent'; }));
  }
}
/* pose les fichiers, choisit le dossier, attend la fin des ecritures */
async function activer(A, fichiers) {
  await A.page.evaluate((f) => { Object.keys(f || {}).forEach((k) => window.__fd.poser(k, f[k])); }, fichiers);
  const avant = await A.page.evaluate(() => window.__fd.arbre());
  const sessAvant = await A.sessions();
  await A.page.evaluate(() => {
    window.__retr = [];
    const f = () => {
      const t = ['etat-dossier', 'panneau-sessions'].map((i) => (document.getElementById(i) || {}).textContent || '').join(' ').replace(/\s+/g, ' ');
      const m = /(\d+) session(?:\(s\)|s)? retrouvée(?:\(s\)|s)? dans le dossier/.exec(t); if (m) window.__retr.push(m[0]);
    };
    new MutationObserver(f).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    window.__f = f;
  });
  await A.page.evaluate(() => window.__fd.raz());
  await A.panneau();
  await A.exige('#btn-dossier-sauvegarde');
  await A.page.click('#btn-dossier-sauvegarde');
  await attendreEtatDossier(A, 'actif');
  await A.attendre(() => window.__fd.journal.some((e) => e.op === 'createWritable'), null, 2500, 'ecriture dans le dossier apres activation');
  await stabiliser(A);
  await A.page.evaluate(() => window.__f());
  return {
    avant, sessAvant,
    apres: await A.page.evaluate(() => window.__fd.arbre()),
    histo: await A.page.evaluate(() => window.__fd.histo),
    journal: await A.page.evaluate(() => window.__fd.journal),
    msgs: await A.page.evaluate(() => window.__retr),
  };
}
/* toute version ecrite d'une session est au moins aussi recente que la plus recente connue (poste ou dossier) */
function verifierSansEcrasement(r, locales, lib) {
  const maxi = {};
  const noter = (s) => { if (s && s.id) maxi[s.id] = Math.max(maxi[s.id] || 0, msDe(s)); };
  locales.forEach(noter);
  Object.keys(r.avant).forEach((c) => { const j = jsonSur(r.avant[c]); if (!j) return; if (j.sessions) j.sessions.forEach(noter); else noter(j); });
  r.histo.forEach((w) => {
    const j = jsonSur(w.contenu);
    assert(j, lib + ' : ecriture non JSON dans ' + w.chemin);
    (j.sessions || [j]).forEach((s) => {
      if (!s.id || maxi[s.id] === undefined) return;
      assert(msDe(s) >= maxi[s.id], lib + ' : ' + w.chemin + ' a ete ecrit avec la session ' + s.id + ' modifiee le ' + s.modifie_le + ', plus ancienne que la version connue (' + new Date(maxi[s.id]).toISOString() + ')');
    });
  });
}
function verifierLecturesAvantEcritures(r, fichiers, lib) {
  const premiere = r.journal.findIndex((e) => e.op === 'createWritable');
  assert(premiere >= 0, lib + ' : aucune ecriture');
  Object.keys(fichiers).forEach((c) => {
    const lu = r.journal.findIndex((e, i) => e.op === 'getFile' && e.chemin === c && i < premiere);
    assert(lu >= 0, lib + ' : le fichier ' + c + ' n\'a pas ete lu avant la premiere ecriture (fusion avant ecriture)');
  });
}
const msgOk = (msgs, n) => msgs.some((m) => m.indexOf(n + ' session') === 0 && (m === n + ' session(s) retrouvée(s) dans le dossier' || m === (n > 1 ? n + ' sessions retrouvées dans le dossier' : n + ' session retrouvée dans le dossier')));
const parId = (ss, id) => ss.find((s) => s.id === id);

check('F0 activation avec un dossier pre-rempli (session plus recente + session inconnue) : fusion avant ecriture, la plus recente l\'emporte, session inconnue conservee', async (A) => {
  const fichiers = { [nomFichier(D2_NEUF)]: JSON.stringify(D2_NEUF), [nomFichier(Z9)]: JSON.stringify(Z9) };
  const r = await activer(A, fichiers);
  verifierLecturesAvantEcritures(r, fichiers, 'F0');
  const ss = await A.sessions();
  const d2 = parId(ss, 'd2'); assert(d2, 'session d2 absente');
  eq(d2.identification.observateur, 'DOSSIER', 'd2 apres activation : la version du dossier (plus recente) doit l\'emporter, observateur');
  assert(msDe(d2) >= msDe(D2_NEUF), 'modifie_le de d2 : ' + d2.modifie_le);
  eq(d2.cotations['V1.1'], 3, 'cotation V1.1 de d2 (version du dossier)');
  assert(parId(ss, 'z9'), 'la session inconnue z9 du dossier doit etre conservee dans l\'appli');
  ['d1', 'd3', 'd4', 'd5'].forEach((id) => assert(parId(ss, id), 'session ' + id + ' perdue'));
  const st = await A.st(); eq(st.id, 'd2', 'session courante'); eq(st.identification.observateur, 'DOSSIER', 'etat() de la session courante');
  const stock = await A.stockees();
  eq(parId(stock, 'd2').identification.observateur, 'DOSSIER', 'localStorage : d2'); assert(parId(stock, 'z9'), 'localStorage : z9 absente');
  const fd2 = jsonSur(r.apres[nomFichier(D2_NEUF)]); assert(fd2, 'fichier de d2 absent du dossier');
  assert(msDe(fd2) >= msDe(D2_NEUF) && fd2.identification.observateur === 'DOSSIER', 'fichier de d2 dans le dossier ecrase par une version plus ancienne : ' + fd2.modifie_le + ' / ' + fd2.identification.observateur);
  assert(r.apres[nomFichier(Z9)], 'fichier de z9 supprime ou absent');
  const sv = jsonSur(r.apres[SAUV]); assert(sv && sv.sessions, 'sauvegarde complete absente');
  eq(sv.sessions.map((s) => s.id).sort(), ['d1', 'd2', 'd3', 'd4', 'd5', 'z9'], 'sessions de la sauvegarde complete');
  eq(parId(sv.sessions, 'd2').identification.observateur, 'DOSSIER', 'd2 dans la sauvegarde complete');
  verifierSansEcrasement(r, jeuDossier(), 'F0');
}, OPT_D());

check('F0 aucune version plus ancienne n\'est jamais ecrite, y compris apres activation (modification d\'une autre session, ecrireDossier())', async (A) => {
  const fichiers = { [nomFichier(D2_NEUF)]: JSON.stringify(D2_NEUF), [nomFichier(Z9)]: JSON.stringify(Z9) };
  const r = await activer(A, fichiers);
  await A.page.evaluate(() => window.__fd.raz());
  await A.fermerPanneau(); await A.go('session');
  await A.page.fill('#f-diagnostic', 'modif apres activation');
  await A.page.evaluate(() => window.GrilleHaptique.ecrireDossier());
  await stabiliser(A);
  const histo = await A.page.evaluate(() => window.__fd.histo);
  const r2 = { avant: r.apres, histo };
  const ss = await A.sessions();
  verifierSansEcrasement(r2, ss.map((s) => (s.id === 'd2' ? D2_NEUF : s)), 'F0 apres activation');
  const apres = await A.page.evaluate(() => window.__fd.arbre());
  eq(jsonSur(apres[nomFichier(D2_NEUF)]).identification.diagnostic, 'modif apres activation', 'la modification de d2 doit etre ecrite dans son fichier');
}, OPT_D());

check('F0 message « n session(s) retrouvee(s) dans le dossier » (n > 0) : pluriel et singulier', async (A) => {
  const r = await activer(A, { [nomFichier(D2_NEUF)]: JSON.stringify(D2_NEUF), [nomFichier(Z9)]: JSON.stringify(Z9) });
  assert(msgOk(r.msgs, 2), 'message « 2 sessions retrouvées dans le dossier » absent de #etat-dossier et du panneau (vus : ' + JSON.stringify(r.msgs) + ')');
}, OPT_D());
check('F0 message au singulier : « 1 session retrouvee dans le dossier »', async (A) => {
  const r = await activer(A, { [nomFichier(Z9)]: JSON.stringify(Z9) });
  assert(msgOk(r.msgs, 1), 'message « 1 session retrouvée dans le dossier » absent (vus : ' + JSON.stringify(r.msgs) + ')');
}, OPT_D());

check('F0 sauvegarde complete deja presente (sans fichier de session), plus recente : fusion identique, aucun ecrasement', async (A) => {
  const fichiers = { [SAUV]: JSON.stringify(sauvegarde([D2_NEUF, Z9])) };
  const r = await activer(A, fichiers);
  verifierLecturesAvantEcritures(r, fichiers, 'F0 sauvegarde');
  const ss = await A.sessions();
  eq(parId(ss, 'd2').identification.observateur, 'DOSSIER', 'd2 (version de la sauvegarde du dossier)'); assert(parId(ss, 'z9'), 'z9 absente');
  const sv = jsonSur(r.apres[SAUV]);
  eq(parId(sv.sessions, 'd2').identification.observateur, 'DOSSIER', 'd2 dans la sauvegarde complete reecrite'); assert(parId(sv.sessions, 'z9'), 'z9 perdue de la sauvegarde complete');
  assert(msgOk(r.msgs, 2), 'message « 2 sessions retrouvées dans le dossier » absent (vus : ' + JSON.stringify(r.msgs) + ')');
  verifierSansEcrasement(r, jeuDossier(), 'F0 sauvegarde');
}, OPT_D());

check('F0 dossier plus ancien que le poste : le poste l\'emporte, le fichier du dossier est mis a jour, rien n\'est perdu', async (A) => {
  const r = await activer(A, { [nomFichier(D2_ANCIEN)]: JSON.stringify(D2_ANCIEN) });
  const ss = await A.sessions();
  eq(parId(ss, 'd2').identification.observateur, '', 'd2 du poste inchangee (observateur)');
  eq(parId(ss, 'd2').modifie_le, D2_LOCAL.modifie_le, 'modifie_le de d2');
  eq(jsonSur(r.apres[nomFichier(D2_LOCAL)]).modifie_le, D2_LOCAL.modifie_le, 'fichier de d2 dans le dossier : version du poste attendue');
  eq(Object.keys(r.apres).sort(), [SAUV].concat(jeuDossier().map(nomFichier)).sort(), 'fichiers du dossier');
  verifierSansEcrasement(r, jeuDossier(), 'F0 dossier ancien');
}, OPT_D());

check('F0 dossier vide : comportement inchange (sauvegarde complete + un fichier par session, aucun message « retrouvee », sessions du poste inchangees)', async (A) => {
  const r = await activer(A, {});
  eq(Object.keys(r.apres).sort(), [SAUV].concat(jeuDossier().map(nomFichier)).sort(), 'fichiers du dossier');
  const ss = await A.sessions();
  eq(ss.map((s) => [s.id, s.modifie_le]).sort(), jeuDossier().map((s) => [s.id, s.modifie_le]).sort(), 'sessions du poste (id, modifie_le)');
  jeuDossier().forEach((s) => eq(jsonSur(r.apres[nomFichier(s)]), parId(ss, s.id), 'contenu de ' + nomFichier(s)));
  eq(r.msgs, [], 'message « retrouvee(s) » alors que le dossier etait vide');
  eq((await A.page.evaluate(() => window.GrilleHaptique.dossier())).etat, 'actif', 'dossier().etat');
}, OPT_D());

check('F0 reactivation (nouveau choix du dossier) apres une modification exterieure plus recente : fusion avant ecriture, aucun ecrasement', async (A) => {
  await activer(A, {});
  const d1x = sess(merge(jeuDossier()[0], { modifie_le: '2026-12-01T00:00:00.000Z', identification: { observateur: 'EXT' } }));
  const z8 = sess({ id: 'z8', modifie_le: '2026-11-30T00:00:00.000Z', identification: { code_sujet: 'ZZ8', session_no: 1, date: '2026-03-21' } });
  const fichiers = { [nomFichier(d1x)]: JSON.stringify(d1x), [nomFichier(z8)]: JSON.stringify(z8) };
  const r = await activer(A, fichiers);
  verifierLecturesAvantEcritures(r, fichiers, 'F0 reactivation');
  const ss = await A.sessions();
  eq(parId(ss, 'd1').identification.observateur, 'EXT', 'd1 apres reactivation (version exterieure plus recente)'); assert(parId(ss, 'z8'), 'z8 absente apres reactivation');
  eq(jsonSur(r.apres[nomFichier(d1x)]).identification.observateur, 'EXT', 'fichier de d1 dans le dossier');
  verifierSansEcrasement(r, jeuDossier(), 'F0 reactivation');
}, OPT_D());

check('F0 reactivation apres a-reautoriser (handle reel memorise dans IndexedDB)', async () => {
  ignorer('non automatisable : un handle de dossier reel ne survit au rechargement que via IndexedDB et un faux dossier en memoire n\'est pas clonable ; a verifier a la main dans Chrome ou Edge (dossier pre-rempli avec une session plus recente, etat a-reautoriser, bouton « Reactiver », puis memes constats que l\'activation)');
});

/* ================================================================== */
/* F1. Retrouver un participant ou une session                         */
/* ================================================================== */

const mk = (id, code, no, date, mod, over) => sess(merge({ id, cree_le: mod, modifie_le: mod, identification: { code_sujet: code, session_no: no, date } }, over || {}));
const F1S = {
  cur: mk('cur', '', null, '2026-11-12', '2025-12-31T10:00:00.000Z'),
  s1: mk('s1', 'Alpha1', 1, '2026-03-02', '2026-03-02T10:00:00.000Z', { identification: { condition: 'A', observateur: 'Obs-A', co_evaluateur: 'Obs-B', diagnostic: 'Dx-A' } }),
  s2: mk('s2', 'Alpha1', 2, '2026-03-09', '2026-03-09T10:00:00.000Z', { identification: { condition: 'B', observateur: 'Obs-A', diagnostic: 'Dx-A' } }),
  s3: mk('s3', 'beta2', 1, '2026-04-01', '2026-06-01T10:00:00.000Z', { identification: { condition: 'C', sexe: 'F', age: 14, diagnostic: 'Dx-test', installation: 'corset', observateur: 'OBS1', co_evaluateur: 'OBS2' } }),
  s4: mk('s4', 'Gamma3', 1, '2026-02-01', '2026-02-01T10:00:00.000Z'),
  s10: mk('s10', 'Gamma3', 7, '2026-02-15', '2026-02-15T10:00:00.000Z', { identification: { condition: 'A' } }),
  s5: mk('s5', 'delta4', 1, '2026-05-01', '2026-05-01T08:00:00.000Z', { identification: { condition: 'B' } }),
  s7: mk('s7', 'epsil5', 1, '2026-05-02', '2026-05-01T08:00:00.000Z', { identification: { condition: 'A' } }),
  s8: mk('s8', 'ALPHA9', 1, '2026-04-10', '2026-04-10T10:00:00.000Z'),
  s9: mk('s9', 'alpha9', 2, '2026-04-17', '2026-04-17T10:00:00.000Z'),
  s6: mk('s6', '', 3, '2026-01-15', '2026-01-15T10:00:00.000Z'),
};
const JEU_F1 = ['s10', 's6', 's1', 's9', 'cur', 's4', 's7', 's2', 's5', 's8', 's3'].map((k) => F1S[k]);
const ALPHA = ['alpha1', 'alpha9', 'beta2', 'delta4', 'epsil5', 'gamma3', ''];
const RECENT = ['beta2', 'delta4', 'epsil5', 'alpha9', 'alpha1', 'gamma3', ''];
const OPT_F1 = (id) => ({ storage: stockage(JEU_F1, id || 'cur') });

const lignes = (A) => A.page.evaluate(() => [...document.querySelectorAll('#table-participants tr[data-participant]')].filter((tr) => tr.getClientRects().length > 0).map((tr) => tr.getAttribute('data-participant')));
const compte = async (A) => normAscii(await A.page.evaluate(() => { const e = document.getElementById('compte-participants'); return e ? e.textContent : '[absent]'; }));
const filtrer = async (A, q) => { await A.page.fill('#recherche-participant', q); await A.page.waitForTimeout(40); };
function verifCompte(txt, n, lib) {
  const m = /^(\d+) participants?\b/.exec(txt);
  assert(m, lib + ' : #compte-participants = "' + txt + '", attendu « n participant(s) »');
  eq(Number(m[1]), n, lib + ' : n de #compte-participants');
  if (n === 1) assert(/^1 participant\b(?!s)/.test(txt), lib + ' : singulier attendu « 1 participant », obtenu "' + txt + '"');
  if (n >= 2) assert(/^\d+ participants\b/.test(txt), lib + ' : pluriel attendu, obtenu "' + txt + '"');
}
const libelleDe = (A, sel) => A.page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const l = e.labels && e.labels[0] ? e.labels[0].textContent : ''; return { label: l.trim(), aria: e.getAttribute('aria-label') || '', type: e.getAttribute('type') }; }, sel);

check('F1 participants : #recherche-participant (input search « Rechercher un code »), #compte-participants, #aucun-resultat masque, #tri-participants (select), dans la vue Participants', async (A) => {
  await A.ouvrirVue();
  const r = await A.page.evaluate(() => {
    const v = document.getElementById('vue-participants'); const g = (i) => document.getElementById(i);
    return { dans: ['recherche-participant', 'compte-participants', 'aucun-resultat', 'tri-participants'].map((i) => !!g(i) && v.contains(g(i))),
      tags: [g('recherche-participant') && g('recherche-participant').tagName, g('tri-participants') && g('tri-participants').tagName], type: g('recherche-participant') && g('recherche-participant').getAttribute('type') };
  });
  eq(r.dans, [true, true, true, true], 'elements dans #vue-participants (recherche, compte, aucun-resultat, tri)');
  eq(r.tags, ['INPUT', 'SELECT'], 'balises'); eq(r.type, 'search', 'type de #recherche-participant');
  const l = await libelleDe(A, '#recherche-participant');
  assert(/Rechercher un code/.test(l.label + ' ' + l.aria), 'libelle de #recherche-participant : "' + l.label + '" / aria-label "' + l.aria + '"');
  const t = await libelleDe(A, '#tri-participants'); assert((t.label + t.aria).trim().length > 0, '#tri-participants sans libelle');
  eq(await A.visible('#aucun-resultat'), false, '#aucun-resultat visible sans recherche');
  verifCompte(await compte(A), 7, 'sans filtre');
  eq(await lignes(A), ALPHA, 'ordre par defaut (alphabetique, sans code en dernier)');
}, OPT_F1());

check('F1 participants : filtre en direct par sous-chaine, casse ignoree, sur le code affiche (AL, ta2, 3, gamma)', async (A) => {
  await A.ouvrirVue();
  for (const [q, attendu] of [['AL', ['alpha1', 'alpha9']], ['alp', ['alpha1', 'alpha9']], ['ta2', ['beta2']], ['3', ['gamma3']], ['GAMMA3', ['gamma3']], ['a', ['alpha1', 'alpha9', 'beta2', 'delta4', 'gamma3', '']], ['alpha9', ['alpha9']]]) {
    await filtrer(A, q);
    eq(await lignes(A), attendu, 'lignes visibles pour la recherche « ' + q + ' »');
    verifCompte(await compte(A), attendu.length, 'recherche « ' + q + ' »');
    eq(await A.visible('#aucun-resultat'), false, '#aucun-resultat visible avec des resultats (« ' + q + ' »)');
  }
}, OPT_F1());

check('F1 participants : « sans » trouve « (sans code) » ; « (sans code) » aussi', async (A) => {
  await A.ouvrirVue();
  for (const q of ['sans', 'SANS', '(sans code)']) { await filtrer(A, q); eq(await lignes(A), [''], 'lignes pour « ' + q + ' »'); verifCompte(await compte(A), 1, '« ' + q + ' »'); }
}, OPT_F1());

check('F1 participants : aucun resultat = #aucun-resultat visible « Aucun participant ne correspond », compte 0 ; effacer le champ retablit la liste', async (A) => {
  await A.ouvrirVue();
  await filtrer(A, 'zzz');
  eq(await lignes(A), [], 'lignes visibles'); eq(await A.visible('#aucun-resultat'), true, '#aucun-resultat visible');
  assert(/Aucun participant ne correspond/.test(await A.texte('#aucun-resultat')), '#aucun-resultat : "' + await A.texte('#aucun-resultat') + '"');
  assert(/^0 participants?\b/.test(await compte(A)), '#compte-participants : "' + await compte(A) + '"');
  await filtrer(A, '');
  eq(await lignes(A), ALPHA, 'liste apres effacement du champ'); eq(await A.visible('#aucun-resultat'), false, '#aucun-resultat apres effacement');
  verifCompte(await compte(A), 7, 'apres effacement');
  await filtrer(A, 'zzz'); await filtrer(A, 'beta'); eq(await lignes(A), ['beta2'], 'lignes apres une nouvelle recherche'); eq(await A.visible('#aucun-resultat'), false, '#aucun-resultat masque de nouveau');
}, OPT_F1());

check('F1 participants : le filtre est conserve de la fiche a la liste, et vide a la fermeture de la vue', async (A) => {
  await A.ouvrirVue(); await filtrer(A, 'alp');
  await A.page.click('button[data-ouvrir-participant="alpha1"]');
  await A.page.locator('#participant-detail').waitFor({ state: 'visible' });
  await A.page.click('#btn-retour-liste');
  await A.page.locator('#participants-liste').waitFor({ state: 'visible' });
  eq(await A.page.inputValue('#recherche-participant'), 'alp', 'valeur du champ apres retour de la fiche');
  eq(await lignes(A), ['alpha1', 'alpha9'], 'lignes apres retour de la fiche'); verifCompte(await compte(A), 2, 'apres retour de la fiche');
  await A.page.click('#btn-retour-saisie');
  await A.page.locator('#vue-participants').waitFor({ state: 'hidden' });
  await A.ouvrirVue();
  eq(await A.page.inputValue('#recherche-participant'), '', 'valeur du champ apres fermeture puis reouverture de la vue');
  eq(await lignes(A), ALPHA, 'lignes apres reouverture'); verifCompte(await compte(A), 7, 'apres reouverture');
  /* ouverture directe d'une fiche par l'API puis retour a la liste */
  await filtrer(A, 'gam'); await A.fiche('gamma3'); await A.page.click('#btn-retour-liste');
  eq(await A.page.inputValue('#recherche-participant'), 'gam', 'filtre apres fiche ouverte par ouvrirParticipants');
}, OPT_F1());

check('F1 tri : #tri-participants a deux valeurs, « code » par defaut (ordre alphabetique inchange, identique a participants())', async (A) => {
  await A.ouvrirVue();
  const o = await A.page.evaluate(() => { const s = document.getElementById('tri-participants'); return { v: s.value, opts: [...s.options].map((x) => x.value) }; });
  eq(o.v, 'code', 'valeur par defaut'); assert(o.opts.indexOf('code') >= 0 && o.opts.indexOf('recent') >= 0, 'options : ' + JSON.stringify(o.opts));
  eq(await lignes(A), (await A.participants()).map((p) => p.cle), 'ordre des lignes = ordre de participants() (C1.3)');
  eq(await lignes(A), ALPHA, 'ordre alphabetique');
  await A.page.click('#btn-retour-saisie'); await A.ouvrirVue();
  eq(await A.page.inputValue('#tri-participants'), 'code', 'tri apres fermeture et reouverture');
}, OPT_F1());

check('F1 tri « recent » : activite la plus recente d\'abord (plus grande modifie_le des sessions du participant), egalite par ordre alphabetique', async (A) => {
  await A.ouvrirVue();
  await A.page.selectOption('#tri-participants', 'recent'); await A.page.waitForTimeout(40);
  eq(await lignes(A), RECENT, 'ordre des lignes avec le tri recent');
  await A.page.selectOption('#tri-participants', 'code'); await A.page.waitForTimeout(40);
  eq(await lignes(A), ALPHA, 'retour au tri par code');
}, OPT_F1());

check('F1 tri « recent » combine avec la recherche (alp : alpha9 avant alpha1)', async (A) => {
  await A.ouvrirVue(); await A.page.selectOption('#tri-participants', 'recent'); await filtrer(A, 'alp');
  eq(await lignes(A), ['alpha9', 'alpha1'], 'lignes'); verifCompte(await compte(A), 2, 'recent + filtre');
  await filtrer(A, ''); eq(await lignes(A), RECENT, 'tri conserve apres effacement du filtre');
}, OPT_F1());

/* ---------------- etapeReprise (fonction pure) ---------------- */

const COT_T0 = { 'T0.1': 0, 'T0.2': 'NA', 'T0.3': 1, 'T0.4': 2, 'T0.5': 3 };
const COT_T1 = (sauf) => { const o = {}; T1.forEach((c, i) => { o[c] = c === sauf ? null : (i % 5 === 4 ? 'NA' : i % 4); }); return o; };
const ID_OK = { code_sujet: 'ER1', session_no: 1, date: '2026-05-01', condition: 'A' };
const T2_ZERO = { tonus: { evolution: 0 }, posture: { evolution: 0 }, emotion: { evolution: 0 }, relation: { evolution: 0 } };
const CAS_REPRISE = [
  ['session vierge (code et condition vides)', {}, 'session'],
  ['code renseigne, condition null, tout le reste coté', { identification: { condition: null, code_sujet: 'ER1' }, cotations: tousCotes(2), t2: T2_PLEIN }, 'session'],
  ['condition renseignee, code vide, tout le reste coté', { identification: { condition: 'B', code_sujet: '' }, cotations: tousCotes(2), t2: T2_PLEIN }, 'session'],
  ['condition chaine vide', { identification: { condition: '', code_sujet: 'ER1' }, cotations: tousCotes(2), t2: T2_PLEIN }, 'session'],
  ['code et condition, rien d\'autre', { identification: ID_OK }, 't0'],
  ['T0 : quatre items cotes, T0.5 null, T1 et T2 complets', { identification: ID_OK, cotations: Object.assign(tousCotes(1), { 'T0.5': null }), t2: T2_PLEIN }, 't0'],
  ['T0 complet (0 et NA compris), T1 vide', { identification: ID_OK, cotations: COT_T0 }, 't1'],
  ['T0 complet, T1 : V4.3 null', { identification: ID_OK, cotations: Object.assign({}, COT_T0, COT_T1('V4.3')) }, 't1'],
  ['T0 null mais T1 et T2 complets (priorite a t0)', { identification: ID_OK, cotations: Object.assign(tousCotes(2), { 'T0.3': null }), t2: T2_PLEIN }, 't0'],
  ['T0 et T1 tout NA, T2 vide', { identification: ID_OK, cotations: tousCotes('NA') }, 't2'],
  ['T0 et T1 complets, T2 : relation null (les autres a 0)', { identification: ID_OK, cotations: Object.assign({}, COT_T0, COT_T1()), t2: { tonus: { evolution: 0 }, posture: { evolution: 0 }, emotion: { evolution: 0 } } }, 't2'],
  ['tout complet, T2 a 0 partout (0 compte comme renseigne)', { identification: ID_OK, cotations: Object.assign({}, COT_T0, COT_T1()), t2: T2_ZERO }, 'synthese'],
  ['tout complet avec NA, sans physio ni synthese', { identification: ID_OK, cotations: tousCotes((c, i) => (i % 3 === 0 ? 'NA' : 3)), t2: T2_PLEIN }, 'synthese'],
];
check('F1 GrilleHaptique.etapeReprise(session) : session, t0, t1, t2, synthese selon le contrat (NA compte comme renseigne, 0 aussi), fonction pure', async (A) => {
  await A.api('etapeReprise');
  for (const [lib, over, attendu] of CAS_REPRISE) {
    const s = sess(merge({ id: 'er' }, over));
    const copie = JSON.parse(JSON.stringify(s));
    const r = await A.page.evaluate((x) => { const out = window.GrilleHaptique.etapeReprise(x); return { out, apres: x }; }, s);
    eq(r.out, attendu, 'etapeReprise pour : ' + lib);
    eq(r.apres, copie, 'la session passee ne doit pas etre modifiee (' + lib + ')');
  }
  const avant = await A.st();
  await A.page.evaluate(() => window.GrilleHaptique.etapeReprise({ identification: { code_sujet: '', condition: null }, cotations: {}, t2: {} }));
  eq(await A.st(), avant, 'etat() apres etapeReprise : aucun effet de bord');
}, OPT_F1());

/* ---------------- #recents ---------------- */

const SEG = (t) => normAscii(t).split(' | ');
async function boutonsRecents(A) {
  return A.page.evaluate(() => [...document.querySelectorAll('#recents button[data-ouvrir-recent], #recents-details button[data-ouvrir-recent]')].filter((b, i, a) => a.indexOf(b) === i).map((b) => ({ id: b.getAttribute('data-ouvrir-recent'), t: b.textContent.replace(/[ \t\r\n]+/g, ' ').trim(), vis: b.getClientRects().length > 0 })));
}
check('F1 #recents : en tete de l\'etape Session, details ouvert « Sessions recentes », au plus 5 autres sessions (hors courante) par modifie_le decroissant', async (A) => {
  await A.go('session');
  const g = await A.page.evaluate(() => {
    const d = document.getElementById('recents-details'); const r = document.getElementById('recents'); const code = document.getElementById('f-code');
    const sec = document.querySelector('section[data-panel="session"]');
    return { d: !!d, tag: d && d.tagName, open: d && d.open, resume: d && d.querySelector('summary') ? d.querySelector('summary').textContent.trim() : null, contient: !!(d && r && d.contains(r)),
      dans: !!(d && sec && sec.contains(d)), avantCode: !!(d && code && (d.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING)), visible: !!d && d.getClientRects().length > 0 };
  });
  assert(g.d, '#recents-details absent'); eq(g.tag, 'DETAILS', 'balise de #recents-details'); eq(g.open, true, 'details ouvert par defaut');
  eq(g.resume, 'Sessions récentes', 'resume'); eq(g.contient, true, '#recents dans #recents-details'); eq(g.dans, true, '#recents-details dans la section Session'); eq(g.avantCode, true, '#recents-details avant #f-code'); eq(g.visible, true, 'visible');
  const b = await boutonsRecents(A);
  eq(b.length, 5, 'nombre de boutons data-ouvrir-recent (sessions autres que la courante s3, maximum 5)');
  eq(b.map((x) => x.id).slice(0, 2).sort(), ['s5', 's7'], 'deux premieres (modifie_le egales)'); eq(b.map((x) => x.id).slice(2), ['s9', 's8', 's2'], 'ordre par modifie_le decroissant (s9, s8, s2)');
  assert(b.every((x) => x.id !== 's3'), 'la session courante ne doit pas figurer dans #recents');
  b.forEach((x) => assert(x.vis, 'bouton ' + x.id + ' non visible'));
  eq(await A.page.evaluate(() => document.querySelectorAll('#recents-details button[data-ouvrir-recent]').length), 5, 'doublons de boutons');
}, OPT_F1('s3'));

check('F1 #recents : texte « <code> | S<n> | <jj/mm/aaaa> | Cond. <A,B,C ou ?> | <etape de reprise lisible> », meme libelle pour une meme etape, libelles differents pour des etapes differentes', async (A) => {
  await A.go('session');
  const b = await boutonsRecents(A); const par = {}; b.forEach((x) => { par[x.id] = x; });
  const attendu = { s5: ['delta4', 'S1', '01/05/2026', 'Cond. B'], s7: ['epsil5', 'S1', '02/05/2026', 'Cond. A'], s9: ['alpha9', 'S2', '17/04/2026', 'Cond. ?'], s8: ['ALPHA9', 'S1', '10/04/2026', 'Cond. ?'], s2: ['Alpha1', 'S2', '09/03/2026', 'Cond. B'] };
  const etapes = {};
  Object.keys(attendu).forEach((id) => {
    assert(par[id], 'bouton de ' + id + ' absent'); const seg = SEG(par[id].t);
    eq(seg.length, 5, 'segments de « ' + par[id].t + ' » separes par « | »');
    eq(seg[0].toLowerCase(), attendu[id][0].toLowerCase(), 'code de ' + id); eq(seg.slice(1, 4), attendu[id].slice(1), 'S<n>, date, condition de ' + id);
    assert(seg[4].length > 0, 'etape de reprise vide pour ' + id); etapes[id] = seg[4];
  });
  eq([etapes.s5, etapes.s7, etapes.s2].filter((x, i, a) => x === a[0]).length, 3, 'meme etape de reprise (t0) = meme libelle');
  eq(etapes.s9, etapes.s8, 'meme etape de reprise (session) = meme libelle');
  assert(etapes.s9 !== etapes.s5, 'etapes differentes (session et t0) avec le meme libelle « ' + etapes.s5 + ' »');
}, OPT_F1('s3'));

check('F1 #recents : numero et date absents ou condition vide : « S? » et « Cond. ? » ; au plus les sessions existantes (2 autres sessions = 2 boutons)', async (A) => {
  const jeu = [mk('c0', 'ZC0', 1, '2026-07-01', '2026-07-01T10:00:00.000Z'), mk('a1', 'QQ1', null, '2026-06-01', '2026-06-02T10:00:00.000Z', { identification: { condition: 'C' } }), mk('a2', 'QQ2', 4, '2026-06-03', '2026-06-04T10:00:00.000Z')];
  await A.charger(jeu, 'c0'); await A.go('session');
  const b = await boutonsRecents(A); eq(b.map((x) => x.id), ['a2', 'a1'], 'boutons');
  eq(SEG(b[1].t).slice(0, 4), ['QQ1', 'S?', '01/06/2026', 'Cond. C'], 'session sans numero'); eq(SEG(b[0].t).slice(0, 4), ['QQ2', 'S4', '03/06/2026', 'Cond. ?'], 'session sans condition');
}, OPT_F1());

check('F1 #recents : #recents-details masque quand il n\'y a aucune autre session (une seule session, ou toutes les autres absentes)', async (A) => {
  await A.charger([mk('seule', 'ZS1', 1, '2026-07-01', '2026-07-01T10:00:00.000Z')], 'seule'); await A.go('session');
  eq(await A.visible('#recents-details'), false, '#recents-details visible avec une seule session');
  eq((await boutonsRecents(A)).filter((x) => x.vis).length, 0, 'boutons visibles');
  await A.charger(JEU_F1, 'cur'); await A.go('session');
  eq(await A.visible('#recents-details'), true, '#recents-details visible avec d\'autres sessions');
}, OPT_F1());

const JEU_RP = (() => {
  const base = { identification: { condition: 'A' } };
  const t2 = (o) => ({ t2: o });
  return [
    mk('cur', '', null, '2026-11-12', '2025-12-31T10:00:00.000Z'),
    mk('rp-s', 'RP1', 1, '2026-05-01', '2026-05-05T10:00:00.000Z', { cotations: tousCotes(2), t2: T2_PLEIN }),
    mk('rp-0', 'RP2', 1, '2026-05-02', '2026-05-04T10:00:00.000Z', base),
    mk('rp-1', 'RP3', 1, '2026-05-03', '2026-05-03T10:00:00.000Z', merge(base, { cotations: Object.assign({}, COT_T0, COT_T1('V4.3')) })),
    mk('rp-2', 'RP4', 1, '2026-05-04', '2026-05-02T10:00:00.000Z', merge(base, merge({ cotations: Object.assign({}, COT_T0, COT_T1()) }, t2({ tonus: { evolution: 1 }, posture: { evolution: 0 } })))),
    mk('rp-3', 'RP5', 1, '2026-05-05', '2026-05-01T10:00:00.000Z', merge(base, merge({ cotations: Object.assign({}, COT_T0, COT_T1()) }, t2(T2_ZERO)))),
  ];
})();
check('F1 #recents : un clic sur une session l\'ouvre sur son etape de reprise (session, t0, t1, t2, synthese)', async (A) => {
  const attendu = { 'rp-s': 'session', 'rp-0': 't0', 'rp-1': 't1', 'rp-2': 't2', 'rp-3': 'synthese' };
  for (const id of Object.keys(attendu)) {
    await A.charger(JEU_RP, 'cur'); await A.go('session');
    await A.page.click('[data-ouvrir-recent="' + id + '"]');
    await A.attendre((i) => window.GrilleHaptique.etat().id === i, id, 1500, 'session courante = ' + id);
    const panneaux = await A.page.evaluate(() => [...document.querySelectorAll('section[data-panel]')].filter((e) => !e.hidden && e.getClientRects().length > 0).map((e) => e.getAttribute('data-panel')));
    eq(panneaux, [attendu[id]], 'etape affichee apres ouverture de ' + id);
    eq(await A.page.evaluate(() => [...document.querySelectorAll('button[data-step][aria-current="step"]')].map((b) => b.getAttribute('data-step'))), [attendu[id]], 'etape courante (aria-current) pour ' + id);
    const s = await A.st(); eq(await A.page.evaluate((x) => window.GrilleHaptique.etapeReprise(x), s), attendu[id], 'etapeReprise de la session ouverte ' + id);
  }
}, { storage: stockage(JEU_RP, 'cur'), delai: 60000 });

/* ---------------- panneau Sessions ---------------- */

const idsPanneau = (A) => A.page.evaluate(() => [...document.querySelectorAll('#panneau-sessions [data-ouvrir]')].filter((b) => b.getClientRects().length > 0).map((b) => b.getAttribute('data-ouvrir')).sort());
const rechSession = async (A, q) => { await A.page.fill('#recherche-session', q); await A.page.waitForTimeout(40); };
check('F1 panneau Sessions : #recherche-session (input search libelle) filtre la liste par code, date jj/mm/aaaa et condition', async (A) => {
  await A.panneau();
  const l = await libelleDe(A, '#recherche-session'); assert(l, '#recherche-session absent'); eq(l.type, 'search', 'type'); assert((l.label + l.aria).trim().length > 0, '#recherche-session sans libelle');
  const tous = JEU_F1.map((s) => s.id).sort();
  eq(await idsPanneau(A), tous, 'toutes les sessions sans filtre');
  await rechSession(A, 'ALPHA'); eq(await idsPanneau(A), ['s1', 's2', 's8', 's9'], 'filtre code « ALPHA » (casse ignoree)');
  await rechSession(A, 'beta'); eq(await idsPanneau(A), ['s3'], 'filtre code « beta »');
  await rechSession(A, '09/03/2026'); eq(await idsPanneau(A), ['s2'], 'filtre date « 09/03/2026 »');
  await rechSession(A, '/04/2026'); eq(await idsPanneau(A), ['s3', 's8', 's9'], 'filtre date « /04/2026 » (dates du 01/04, 10/04 et 17/04)');
  await rechSession(A, 'c');
  const cond = await idsPanneau(A);
  assert(cond.indexOf('s3') >= 0, 'filtre « c » : s3 (condition C) manquante : ' + JSON.stringify(cond));
  cond.forEach((id) => { const s = F1S[id]; assert(s.identification.condition === 'C' || /c/i.test(s.identification.code_sujet + ' ' + fr(s.identification.date) + ' (sans code)'), 'filtre « c » : session ' + id + ' ne correspond a rien (code, date, condition)'); });
  await rechSession(A, ''); eq(await idsPanneau(A), tous, 'liste complete apres effacement');
}, OPT_F1());

check('F1 panneau Sessions : aucun resultat = #aucune-session visible « Aucune session ne correspond », masque sinon', async (A) => {
  await A.panneau();
  eq(await A.visible('#aucune-session'), false, '#aucune-session visible sans recherche');
  await rechSession(A, 'zzzz'); eq(await idsPanneau(A), [], 'sessions visibles'); eq(await A.visible('#aucune-session'), true, '#aucune-session visible');
  assert(/Aucune session ne correspond/.test(await A.texte('#aucune-session')), '#aucune-session : "' + await A.texte('#aucune-session') + '"');
  await rechSession(A, 'beta'); eq(await A.visible('#aucune-session'), false, '#aucune-session apres une recherche fructueuse');
  await rechSession(A, ''); eq((await idsPanneau(A)).length, JEU_F1.length, 'liste restauree');
}, OPT_F1());

/* ---------------- #btn-reprendre-dernier ---------------- */

const FIG_STABLES = (s) => ({ sexe: s.identification.sexe, age: s.identification.age, diagnostic: s.identification.diagnostic, installation: s.identification.installation, observateur: s.identification.observateur, co_evaluateur: s.identification.co_evaluateur });
check('F1 #btn-reprendre-dernier : visible seulement si la courante est vierge (rien hors date, aucune cotation) et qu\'une autre session existe ; en tete de l\'etape Session', async (A) => {
  await A.go('session');
  const pos = await A.page.evaluate(() => { const b = document.getElementById('btn-reprendre-dernier'); const c = document.getElementById('f-code'); const sec = document.querySelector('section[data-panel="session"]'); return !!b && sec.contains(b) && !!(b.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING); });
  assert(pos, '#btn-reprendre-dernier absent, hors de la section Session ou apres #f-code');
  eq(await A.visible('#btn-reprendre-dernier'), true, 'visible avec une courante vierge et d\'autres sessions');
  eq(await A.texte('#btn-reprendre-dernier'), 'Nouvelle session pour beta2', 'libelle (code de la session a modifie_le la plus recente)');
  await A.page.fill('#f-date', '2026-09-09'); eq(await A.visible('#btn-reprendre-dernier'), true, 'visible apres changement de la seule date');
  await A.page.fill('#f-diagnostic', 'x'); eq(await A.visible('#btn-reprendre-dernier'), false, 'masque apres une saisie (diagnostic)');
  await A.page.fill('#f-diagnostic', '');
  await A.charger(JEU_F1, 'cur'); await A.go('session'); await A.coter('T0.1', 1); await A.go('session');
  eq(await A.visible('#btn-reprendre-dernier'), false, 'masque avec une cotation');
  await A.charger(JEU_F1, 'cur'); await A.go('session'); await A.page.fill('#f-code', 'ZZ5'); eq(await A.visible('#btn-reprendre-dernier'), false, 'masque avec un code');
  await A.charger(JEU_F1, 'cur'); await A.go('session'); await A.page.click('input[name="condition"][value="B"]'); eq(await A.visible('#btn-reprendre-dernier'), false, 'masque avec une condition');
  await A.charger(JEU_F1, 's3'); await A.go('session'); eq(await A.visible('#btn-reprendre-dernier'), false, 'masque quand la courante n\'est pas vierge (s3)');
  await A.charger([F1S.cur], 'cur'); await A.go('session'); eq(await A.visible('#btn-reprendre-dernier'), false, 'masque quand aucune autre session n\'existe');
}, OPT_F1());

check('F1 #btn-reprendre-dernier : meme effet que « Nouvelle session pour ce participant » (code, numero suivant, champs stables, condition vide)', async (A) => {
  await A.go('session'); await A.page.click('#btn-reprendre-dernier');
  await A.attendre(() => window.GrilleHaptique.etat().identification.code_sujet === 'beta2', null, 1500, 'session courante pour beta2');
  const a = await A.st(); const n = (await A.sessions()).length;
  eq(a.identification.code_sujet, 'beta2', 'code'); eq(a.identification.session_no, 2, 'numero (dernier + 1)'); assert(a.identification.condition === null || a.identification.condition === '', 'condition vide : ' + JSON.stringify(a.identification.condition));
  eq(FIG_STABLES(a), FIG_STABLES(F1S.s3), 'champs stables repris de la derniere session'); eq(n, JEU_F1.length + 1, 'une nouvelle session creee');
  eq(a.cotations['T0.1'], null, 'cotations vierges'); eq(await A.visible('#btn-reprendre-dernier'), false, 'bouton masque ensuite (la courante n\'est plus vierge)');
  assert(a.id !== 'cur' && a.id !== 's3', 'nouvel id');
  const gabarit = (s) => { const o = JSON.parse(JSON.stringify(s)); delete o.id; delete o.cree_le; delete o.modifie_le; return o; };
  await A.charger(JEU_F1, 'cur'); await A.fiche('beta2'); await A.page.click('#btn-nouvelle-pour-participant');
  await A.attendre(() => window.GrilleHaptique.etat().identification.code_sujet === 'beta2', null, 1500, 'session courante pour beta2 (voie participant)');
  eq(gabarit(await A.st()), gabarit(a), 'resultat identique a « Nouvelle session pour ce participant »');
}, OPT_F1());

check('F1 existant : #btn-nouvelle cree toujours une nouvelle session, meme si la courante est vierge', async (A) => {
  const n = (await A.sessions()).length;
  await A.panneau(); await A.page.click('#btn-nouvelle');
  await A.attendre((k) => window.GrilleHaptique.sessions().length === k, n + 1, 1500, 'une session de plus');
  const a = await A.st(); assert(a.id !== 'cur', 'la courante doit etre la nouvelle session'); eq(a.identification.code_sujet, '', 'code de la nouvelle session');
}, OPT_F1());

/* ================================================================== */
/* F2. En-tete de session plus rapide                                  */
/* ================================================================== */

const optionsDe = (A, id) => A.page.evaluate((i) => { const d = document.getElementById(i); return d ? [...d.options].map((o) => o.value || o.textContent.trim()) : null; }, id);
check('F2 datalists : #liste-codes, #liste-observateurs, #liste-diagnostics (contenus) et liaisons (list=) de #f-code, #f-observateur, #f-coeval, #f-diagnostic', async (A) => {
  const liens = await A.page.evaluate(() => ['f-code', 'f-observateur', 'f-coeval', 'f-diagnostic'].map((i) => { const e = document.getElementById(i); return e ? e.getAttribute('list') : '[absent]'; }));
  eq(liens, ['liste-codes', 'liste-observateurs', 'liste-observateurs', 'liste-diagnostics'], 'attributs list');
  eq(await A.page.evaluate(() => ['liste-codes', 'liste-observateurs', 'liste-diagnostics'].map((i) => { const d = document.getElementById(i); return d ? d.tagName : null; })), ['DATALIST', 'DATALIST', 'DATALIST'], 'balises');
  const codes = await optionsDe(A, 'liste-codes');
  eq(codes.slice().sort(), (await A.participants()).filter((p) => p.cle !== '').map((p) => p.code).sort(), 'options de #liste-codes (codes affiches, sans doublon de casse, sans « sans code »)');
  eq(codes.map((c) => c.toLowerCase()).filter((c, i, a) => a.indexOf(c) === i).length, codes.length, 'doublons de casse');
  assert(codes.indexOf('alpha9') >= 0 && codes.indexOf('ALPHA9') < 0, 'graphie affichee attendue pour alpha9 : ' + JSON.stringify(codes));
  eq((await optionsDe(A, 'liste-observateurs')).slice().sort(), ['OBS1', 'OBS2', 'Obs-A', 'Obs-B'], 'options de #liste-observateurs (observateur et co_evaluateur, distincts non vides)');
  const dx = await optionsDe(A, 'liste-diagnostics');
  ['Dx-A', 'Dx-test'].forEach((d) => assert(dx.indexOf(d) >= 0, '#liste-diagnostics sans « ' + d + ' » : ' + JSON.stringify(dx)));
  assert(dx.every((d) => d.trim() !== '') && dx.filter((d, i) => dx.indexOf(d) !== i).length === 0, '#liste-diagnostics : options vides ou en double : ' + JSON.stringify(dx));
}, OPT_F1());

check('F2 datalists : mises a jour a chaque enregistrement (nouveau code, observateur, co-evaluateur, diagnostic)', async (A) => {
  await A.go('session');
  await A.page.fill('#f-code', 'Zeta7'); await A.page.fill('#f-observateur', 'Obs-Neuf'); await A.page.fill('#f-coeval', 'Coeval-Neuf'); await A.page.fill('#f-diagnostic', 'Dx-Neuf');
  await A.attendre(() => document.getElementById('liste-codes') && [...document.getElementById('liste-codes').options].some((o) => (o.value || o.textContent) === 'Zeta7'), null, 1500, '#liste-codes contient Zeta7');
  const o = await optionsDe(A, 'liste-observateurs'); assert(o.indexOf('Obs-Neuf') >= 0 && o.indexOf('Coeval-Neuf') >= 0, '#liste-observateurs : ' + JSON.stringify(o));
  assert((await optionsDe(A, 'liste-diagnostics')).indexOf('Dx-Neuf') >= 0, '#liste-diagnostics sans Dx-Neuf');
}, OPT_F1());

check('F2 numero propose : max(session_no des autres sessions) + 1 quand #f-session est vide, mention « Numero propose : n » dans #aide-participant, casse ignoree, jamais d\'ecrasement', async (A) => {
  await A.go('session');
  eq(await A.page.inputValue('#f-session'), '', 'precondition : #f-session vide');
  await A.page.fill('#f-code', 'Alpha1');
  await A.attendre(() => document.getElementById('f-session').value === '3', null, 1500, '#f-session = 3 (max 2 + 1)');
  eq((await A.st()).identification.session_no, 3, 'session_no enregistre');
  assert(/Numéro proposé : 3/.test(await A.texte('#aide-participant')), '#aide-participant : "' + await A.texte('#aide-participant') + '"');
  await A.charger(JEU_F1, 'cur'); await A.go('session');
  await A.page.fill('#f-code', 'GAMMA3');
  await A.attendre(() => document.getElementById('f-session').value === '8', null, 1500, '#f-session = 8 (numeros 1 et 7 : maximum, pas le nombre)');
  assert(/Numéro proposé : 8/.test(await A.texte('#aide-participant')), '#aide-participant : "' + await A.texte('#aide-participant') + '"');
  await A.charger(JEU_F1, 'cur'); await A.go('session');
  await A.page.fill('#f-session', '7'); await A.page.fill('#f-code', 'Alpha1'); await A.page.waitForTimeout(150);
  eq(await A.page.inputValue('#f-session'), '7', 'valeur non vide ecrasee'); eq((await A.st()).identification.session_no, 7, 'session_no ecrase');
  assert(!/Numéro proposé/.test(await A.texte('#aide-participant')), 'mention « Numero propose » alors que rien n\'a ete propose');
  await A.charger(JEU_F1, 'cur'); await A.go('session');
  await A.page.fill('#f-code', 'Inconnu9'); await A.page.waitForTimeout(150);
  eq(await A.page.inputValue('#f-session'), '', '#f-session rempli pour un code sans autre session');
  await A.page.locator('#f-code').fill(''); await A.page.locator('#f-code').pressSequentially('beta2');
  await A.attendre(() => document.getElementById('f-session').value === '2', null, 1500, '#f-session = 2 apres frappe au clavier');
}, OPT_F1());

check('F2 completude : button[data-step="session"] porte data-complet true/false (code et condition renseignes), avec coche', async (A) => {
  const lire = () => A.page.evaluate(() => { const b = document.querySelector('button[data-step="session"]'); const s = b.querySelector('svg'); const cs = s ? getComputedStyle(s) : null; return { c: b.getAttribute('data-complet'), svg: !!s, visible: !!s && s.getClientRects().length > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0 }; });
  await A.go('t0'); eq((await lire()).c, 'false', 'session vierge');
  await A.go('session'); await A.page.fill('#f-code', 'NV1'); eq((await lire()).c, 'false', 'code seul');
  await A.page.fill('#f-code', ''); await A.page.click('input[name="condition"][value="B"]'); eq((await lire()).c, 'false', 'condition seule');
  await A.page.fill('#f-code', 'NV1'); await A.go('t0'); const r = await lire();
  eq(r.c, 'true', 'code et condition'); eq(r.svg, true, 'coche SVG presente'); eq(r.visible, true, 'coche visible quand complet');
  await A.go('session'); await A.page.fill('#f-code', ''); await A.go('t0'); const r2 = await lire();
  eq(r2.c, 'false', 'code efface'); eq(r2.visible, false, 'coche visible alors que l\'etape est incomplete');
}, { storage: stockage([sess({ id: 'v', identification: { code_sujet: '', session_no: null, condition: null } })], 'v') });

const heureLocale = () => { const d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
const OPT_H = () => ({ storage: stockage([sess({ id: 'h', identification: { code_sujet: 'HH1', session_no: 1, condition: 'B' } })], 'h') });
async function demarrerMinuteur(A) {
  const avant = await A.page.evaluate(`(${heureLocale.toString()})()`);
  await A.clic('#btn-minuteur-demarrer');
  await A.page.waitForTimeout(120);
  const apres = await A.page.evaluate(`(${heureLocale.toString()})()`);
  return [avant, apres];
}
check('F2 heure de debut : au clic sur #btn-minuteur-demarrer a l\'etape t0 ou t1, #f-debut vide recoit hh:mm local et #annonce le dit ; rien d\'autre n\'est rempli', async (A) => {
  for (const etape of ['t0', 't1']) {
    await A.charger([sess({ id: 'h', identification: { code_sujet: 'HH1', session_no: 1, condition: 'B' } })], 'h');
    await A.go(etape); const avant = await A.st();
    const [h1, h2] = await demarrerMinuteur(A);
    const v = await A.page.inputValue('#f-debut');
    assert(/^\d\d:\d\d$/.test(v) && (v === h1 || v === h2), 'etape ' + etape + ' : #f-debut = "' + v + '", attendu ' + h1 + ' ou ' + h2);
    eq((await A.st()).identification.heure_debut, v, 'heure_debut enregistree');
    const an = normAscii(await A.page.evaluate(() => document.getElementById('annonce').textContent));
    assert(an.indexOf('Heure de début renseignée : ' + v) >= 0, '#annonce : "' + an + '"');
    const apres = await A.st();
    const net = (s) => { const o = JSON.parse(JSON.stringify(s)); delete o.modifie_le; o.identification.heure_debut = ''; return o; };
    eq(net(apres), net(avant), 'autres champs et cotations modifies automatiquement');
    eq(await A.page.inputValue('#f-fin'), '', '#f-fin rempli');
  }
}, OPT_H());
check('F2 heure de debut : jamais d\'ecrasement, et aucun remplissage depuis les autres etapes (session, t2, physio, synthese)', async (A) => {
  await A.go('session'); await A.page.fill('#f-debut', '08:15'); await A.go('t0');
  await demarrerMinuteur(A);
  eq(await A.page.inputValue('#f-debut'), '08:15', '#f-debut ecrase');
  assert(!/Heure de début renseignée/.test(await A.page.evaluate(() => document.getElementById('annonce').textContent)), '#annonce annonce un remplissage alors que rien n\'a ete ecrit');
  for (const etape of ['session', 't2', 'physio', 'synthese']) {
    await A.charger([sess({ id: 'h', identification: { code_sujet: 'HH1', session_no: 1, condition: 'B' } })], 'h');
    await A.go(etape); await demarrerMinuteur(A);
    eq((await A.st()).identification.heure_debut, '', 'heure_debut remplie depuis l\'etape ' + etape);
  }
}, OPT_H());

/* ================================================================== */
/* F3. Affichage Standard / Grand                                      */
/* ================================================================== */

const CLE_AFF = 'grilleHaptique.v1.affichage';
const affichage = (A) => A.page.evaluate(() => document.documentElement.dataset.affichage);
const valeurStockee = (A) => A.page.evaluate((k) => { const v = localStorage.getItem(k); return v === null ? null : v.replace(/^"|"$/g, ''); }, CLE_AFF);
const OPT_G = (extra) => Object.assign({ storage: stockage([F1S.s3, F1S.s1, sess({ id: 'plein', identification: { code_sujet: 'PL1', session_no: 1, date: '2026-07-07', condition: 'C' }, cotations: tousCotes((c, i) => (i % 5 === 4 ? 'NA' : i % 4)), t2: T2_PLEIN, physio: { fc: { t0: 80, t1: 90 } } })], 'plein') }, extra || {});
async function basculer(A) { await A.exige('#btn-affichage'); await A.page.click('#btn-affichage'); }
async function passerGrand(A) { if ((await affichage(A)) !== 'grand') await basculer(A); eq(await affichage(A), 'grand', 'data-affichage apres bascule'); }

check('F3 #btn-affichage : bouton d\'en-tete de 44 px au moins, aria-pressed absent ou false, libelle accessible « Affichage grand », defaut standard sans cle localStorage', async (A) => {
  await A.exige('#btn-affichage');
  const r = await A.page.evaluate(() => { const b = document.getElementById('btn-affichage'); const r = b.getBoundingClientRect(); return { h: r.height, dansHeader: !!b.closest('header'), p: b.getAttribute('aria-pressed'), nom: (b.getAttribute('aria-label') || '') + ' ' + b.textContent, aff: document.documentElement.dataset.affichage, cles: Object.keys(localStorage) }; });
  assert(r.h >= 43.5, 'hauteur ' + r.h); eq(r.dansHeader, true, 'dans header'); assert(r.p === null || r.p === 'false', 'aria-pressed = ' + r.p);
  assert(/Affichage grand/.test(r.nom), 'libelle accessible : "' + r.nom.trim() + '"'); eq(r.aff, 'standard', 'data-affichage par defaut');
  assert(r.cles.indexOf(CLE_AFF) < 0, 'cle ' + CLE_AFF + ' presente avant toute bascule : ' + JSON.stringify(r.cles));
  eq(await A.page.evaluate(() => window.GrilleHaptique.affichage()), 'standard', 'GrilleHaptique.affichage()');
}, OPT_G());
check('F3 defaut standard meme sur un appareil tactile emule (tablette, pointer:coarse), sans cle localStorage', async (A) => {
  eq(await affichage(A), 'standard', 'data-affichage'); eq(await valeurStockee(A), null, 'cle ' + CLE_AFF);
  eq(await A.page.evaluate(() => window.GrilleHaptique.affichage()), 'standard', 'GrilleHaptique.affichage()');
}, OPT_G({ tactile: true, viewport: { width: 820, height: 1180 } }));
check('F3 bascule : data-affichage, aria-pressed, cle localStorage seulement apres bascule, GrilleHaptique.affichage(), #annonce, retour a standard, persistance au rechargement', async (A) => {
  const avant = await A.cles();
  await basculer(A);
  eq(await affichage(A), 'grand', 'data-affichage'); eq(await A.page.getAttribute('#btn-affichage', 'aria-pressed'), 'true', 'aria-pressed');
  eq(await A.page.evaluate(() => window.GrilleHaptique.affichage()), 'grand', 'affichage()'); eq(await valeurStockee(A), 'grand', 'cle ' + CLE_AFF);
  eq((await A.cles()).filter((k) => avant.indexOf(k) < 0), [CLE_AFF], 'nouvelles cles localStorage');
  eq(normAscii(await A.page.evaluate(() => document.getElementById('annonce').textContent)), 'Affichage grand', '#annonce');
  await A.page.reload(); await A.attendreAPI();
  await A.attendre(() => document.documentElement.dataset.affichage === 'grand', null, 1000, 'data-affichage = grand apres rechargement (cle memorisee)');
  eq(await affichage(A), 'grand', 'data-affichage apres rechargement'); eq(await A.page.getAttribute('#btn-affichage', 'aria-pressed'), 'true', 'aria-pressed apres rechargement');
  await basculer(A);
  eq(await affichage(A), 'standard', 'retour a standard'); eq(await valeurStockee(A), 'standard', 'cle apres retour'); eq(await A.page.evaluate(() => window.GrilleHaptique.affichage()), 'standard', 'affichage()');
  eq(normAscii(await A.page.evaluate(() => document.getElementById('annonce').textContent)), 'Affichage standard', '#annonce');
  assert([null, 'false'].indexOf(await A.page.getAttribute('#btn-affichage', 'aria-pressed')) >= 0, 'aria-pressed en standard');
}, {});

/* mesures en Grand, executees dans la page ; renvoie la liste des ecarts */
const MESURES_GRAND = () => {
  const out = []; const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const fb = parseFloat(getComputedStyle(document.body).fontSize);
  if (fb < 17.99) out.push('texte de base ' + fb + ' px (< 18)');
  document.querySelectorAll('button[data-rate]').forEach((b) => {
    if (!vis(b)) return; const r = b.getBoundingClientRect(); const f = parseFloat(getComputedStyle(b).fontSize);
    if (r.height < 59.5) out.push('bouton de cotation ' + b.getAttribute('data-rate') + '/' + b.getAttribute('data-val') + ' haut de ' + r.height.toFixed(1) + ' px (< 60)');
    if (f < 1.4 * rem - 0.3) out.push('bouton de cotation ' + b.getAttribute('data-rate') + ' texte ' + f + ' px (< 1,4 rem = ' + (1.4 * rem) + ')');
  });
  document.querySelectorAll('[data-item]').forEach((it) => {
    if (!vis(it)) return;
    const code = it.getAttribute('data-item'); const cs = getComputedStyle(it);
    const cw = it.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const titre = [...it.querySelectorAll('*')].find((e) => !e.closest('button,textarea,.ancre') && vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length >= 10));
    const g = it.querySelector('[role="group"]'); const ta = it.querySelector('textarea[data-obs]');
    if (!titre || !g || !ta) { out.push(code + ' : titre, groupe ou observation introuvable'); return; }
    const rt = titre.getBoundingClientRect(); const rg = g.getBoundingClientRect(); const ro = ta.getBoundingClientRect();
    if (rg.top < rt.bottom - 1) out.push(code + ' : boutons de cotation non places sous le titre');
    if (ro.top < rg.bottom - 1) out.push(code + ' : observation non placee sous les boutons');
    if (rg.width < 0.9 * cw) out.push(code + ' : boutons de cotation pas en pleine largeur (' + rg.width.toFixed(0) + ' / ' + cw.toFixed(0) + ' px)');
    const bs = [...g.querySelectorAll('button')].map((b) => b.getBoundingClientRect()); const premiere = bs.filter((b) => Math.abs(b.top - bs[0].top) < 3);
    if (Math.max.apply(null, premiere.map((b) => b.right)) < rg.right - 10) out.push(code + ' : la rangee de boutons ne remplit pas la largeur');
  });
  document.querySelectorAll('button[data-step], #btn-precedent, #btn-suivant').forEach((b) => { if (vis(b) && b.getBoundingClientRect().height < 51.5) out.push((b.id || 'etape ' + b.getAttribute('data-step')) + ' haut de ' + b.getBoundingClientRect().height.toFixed(1) + ' px (< 52)'); });
  return out;
};
check('F3 Grand : texte >= 18 px, boutons de cotation >= 60 px et >= 1,4 rem, une colonne (titre, boutons pleine largeur, observation), boutons d\'etape et de navigation >= 52 px, a 360, 820 et 1280 px', async (A) => {
  await passerGrand(A);
  for (const w of [360, 820, 1280]) {
    await A.page.setViewportSize({ width: w, height: 900 });
    for (const e of ['t0', 't1', 'session']) {
      await A.go(e); await A.page.waitForTimeout(60);
      const r = await A.page.evaluate(MESURES_GRAND); assert(r.length === 0, 'Grand a ' + w + ' px, etape ' + e + ' : ' + r.slice(0, 4).join(' ; '));
    }
  }
}, OPT_G({ local: { [CLE_AFF]: 'grand' } }));

check('F3 Grand : aucun defilement horizontal de 360 a 1280 px (6 etapes, liste Participants, fiche, panneau Sessions)', async (A) => {
  await passerGrand(A);
  const defil = () => A.page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
  for (const w of [360, 390, 480, 600, 720, 820, 1024, 1280]) {
    await A.page.setViewportSize({ width: w, height: 900 });
    for (const e of STEPS) { await A.go(e); await A.page.waitForTimeout(30); const d = await defil(); assert(d <= 1, 'Grand a ' + w + ' px, etape ' + e + ' : debordement de ' + d + ' px'); }
    await A.ouvrirVue(); let d = await defil(); assert(d <= 1, 'Grand a ' + w + ' px, liste Participants : debordement de ' + d + ' px');
    await A.fiche('pl1'); d = await defil(); assert(d <= 1, 'Grand a ' + w + ' px, fiche participant : debordement de ' + d + ' px');
    await A.go('session'); await A.panneau(); d = await defil(); assert(d <= 1, 'Grand a ' + w + ' px, panneau Sessions : debordement de ' + d + ' px'); await A.fermerPanneau();
  }
}, OPT_G({ local: { [CLE_AFF]: 'grand' }, delai: 60000 }));

check('F3 Grand : le focus (Tab, Maj+Tab, « Prochain item non cote ») n\'est jamais sous une barre fixe ou collante', async (A) => {
  await A.page.evaluate(() => {
    window.__barres = [...document.body.querySelectorAll('*')].filter((e) => { const p = getComputedStyle(e).position; return (p === 'fixed' || p === 'sticky') && e.id !== 'toast' && e.getClientRects().length > 0 && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < window.innerHeight * 0.6; });
    window.__sous = () => { const a = document.activeElement; if (!a || a === document.body) return null; const r = a.getBoundingClientRect(); if (!r.width || !r.height) return null;
      for (const b of window.__barres) { if (b.contains(a) || a.contains(b) || b.getClientRects().length === 0) continue; const q = b.getBoundingClientRect(); const dx = Math.min(r.right, q.right) - Math.max(r.left, q.left); const dy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top); if (dx > 2 && dy > 2) return (a.id || a.tagName + (a.getAttribute('data-rate') || '')) + ' sous ' + (b.id || b.tagName + '.' + b.className); } return null; };
  });
  for (const [w, h] of [[360, 740], [820, 1180], [1280, 800]]) {
    await A.page.setViewportSize({ width: w, height: h });
    for (const e of ['t1', 'session']) {
      await A.go(e); await A.page.evaluate(() => { window.__barres = [...document.body.querySelectorAll('*')].filter((x) => { const p = getComputedStyle(x).position; return (p === 'fixed' || p === 'sticky') && x.id !== 'toast' && x.getClientRects().length > 0 && x.getBoundingClientRect().height > 0 && x.getBoundingClientRect().height < window.innerHeight * 0.6; }); });
      for (let i = 0; i < 60; i++) { await A.page.keyboard.press('Tab'); const s = await A.page.evaluate(() => window.__sous()); assert(!s, 'Grand ' + w + ' px, etape ' + e + ', Tab n°' + (i + 1) + ' : focus ' + s); }
      for (let i = 0; i < 25; i++) { await A.page.keyboard.press('Shift+Tab'); const s = await A.page.evaluate(() => window.__sous()); assert(!s, 'Grand ' + w + ' px, etape ' + e + ', Maj+Tab n°' + (i + 1) + ' : focus ' + s); }
    }
    await A.go('t1');
    if (await A.visible('#btn-prochain-non-cote')) { await A.clic('#btn-prochain-non-cote'); await A.page.waitForTimeout(80); const s = await A.page.evaluate(() => window.__sous()); assert(!s, 'Grand ' + w + ' px, « Prochain item non coté » : focus ' + s); }
  }
}, OPT_G({ local: { [CLE_AFF]: 'grand' }, delai: 90000 }));

const SIGNATURE = () => {
  const g = (s) => document.querySelector(s); const r = (s) => { const e = g(s); return e && e.getClientRects().length ? Math.round(e.getBoundingClientRect().height * 10) / 10 : null; };
  const f = (s) => { const e = g(s); return e ? getComputedStyle(e).fontSize : null; };
  return { corps: f('body'), entete: r('header'), barre: r('#barre-etapes'), cot: r('button[data-rate]'), cotTexte: f('button[data-rate]'), suivant: r('#btn-suivant'), h2: f('h2') };
};
check('F3 standard inchange : en-tete <= 72 px a 1280 px et <= 104 px a 390 px, texte 15 px, gabarits identiques apres un aller-retour Grand puis Standard', async (A) => {
  await A.go('t1'); const s0 = await A.page.evaluate(SIGNATURE);
  assert(s0.entete <= 72.01, 'en-tete standard a 1280 px : ' + s0.entete); eq(s0.corps, '15px', 'texte de base en standard');
  await A.page.setViewportSize({ width: 390, height: 800 }); await A.go('t1'); const m0 = await A.page.evaluate(SIGNATURE); assert(m0.entete <= 104.01, 'en-tete standard a 390 px : ' + m0.entete);
  await A.page.setViewportSize({ width: 1280, height: 900 });
  await basculer(A); await basculer(A); eq(await affichage(A), 'standard', 'retour standard');
  await A.go('t1'); eq(await A.page.evaluate(SIGNATURE), s0, 'gabarits a 1280 px apres aller-retour');
  await A.page.setViewportSize({ width: 390, height: 800 }); await A.go('t1'); eq(await A.page.evaluate(SIGNATURE), m0, 'gabarits a 390 px apres aller-retour');
}, OPT_G());
check('F3 Grand : en-tete fixe (sticky ou fixed) et minuteur agrandi ; aucune perte d\'information (texte de chaque etape identique a Standard)', async (A) => {
  const texte = async (e) => { await A.go(e); return A.page.evaluate((x) => document.querySelector('section[data-panel="' + x + '"]').innerText.replace(/[ \t\r\n]+/g, ' ').trim(), e); };
  const std = {}; for (const e of ['session', 't0', 't1', 't2', 'physio', 'synthese']) std[e] = await texte(e);
  const mS = await A.page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('minuteur-valeur')).fontSize));
  await basculer(A);
  for (const e of Object.keys(std)) eq(await texte(e), std[e], 'texte de l\'etape ' + e + ' en Grand');
  const mG = await A.page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('minuteur-valeur')).fontSize));
  assert(mG > mS, 'minuteur non agrandi : ' + mS + ' px en standard, ' + mG + ' px en Grand');
  eq(await A.page.evaluate(() => ['fixed', 'sticky'].indexOf(getComputedStyle(document.querySelector('header')).position) >= 0), true, 'en-tete fixe en Grand');
}, OPT_G());
check('F3 impression inchangee : le mode Grand est sans effet en media print', async (A) => {
  const sig = async () => { await A.page.emulateMedia({ media: 'print' }); const r = await A.page.evaluate(() => { const g = (s) => document.querySelector(s); const o = { h: document.documentElement.scrollHeight, corps: getComputedStyle(document.body).fontSize };
    ['[data-item]', 'button[data-rate]', 'h2', 'textarea', 'header'].forEach((s) => { const e = g(s); o[s] = e ? [getComputedStyle(e).fontSize, getComputedStyle(e).display, Math.round(e.getBoundingClientRect().height)] : null; }); return o; }); await A.page.emulateMedia({ media: 'screen' }); return r; };
  const mesure = async (e) => { await A.page.emulateMedia({ media: 'screen' }); await A.go(e); return sig(); };
  const visiter = async () => { await A.page.emulateMedia({ media: 'screen' }); for (const e of ['t1', 'synthese']) await A.go(e); };
  await visiter();
  const std = {}; for (const e of ['t1', 'synthese']) std[e] = await mesure(e);
  await A.page.emulateMedia({ media: 'screen' }); await basculer(A);
  await visiter();
  for (const e of ['t1', 'synthese']) {
    const g = await mesure(e), s0 = std[e];
    assert(Math.abs(g.h - s0.h) <= Math.ceil(s0.h * 0.01), 'hauteur imprimee de ' + e + ' en Grand : ' + g.h + ' contre ' + s0.h + ' en standard (ecart superieur a 1 %)');
    eq(Object.assign({}, g, { h: 0 }), Object.assign({}, s0, { h: 0 }), 'rendu imprime de ' + e + ' en Grand');
  }
}, OPT_G());

/* ================================================================== */
/* F4. Ancre d'echelle                                                 */
/* ================================================================== */

check('Clics souris consecutifs sur trois items a 390 px : les trois cotations sont enregistrees (pas de decalage de mise en page entre l\'appui et le relachement)', async (A) => {
  await A.page.setViewportSize({ width: 390, height: 844 });
  await A.go('t1');
  for (const [c, v] of [['V1.1', '3'], ['V1.2', '2'], ['V1.3', '1']]) await A.page.click('button[data-rate="' + c + '"][data-val="' + v + '"]');
  const e = await A.page.evaluate(() => GrilleHaptique.etat().cotations);
  eq([e['V1.1'], e['V1.2'], e['V1.3']], [3, 2, 1], 'cotations apres trois clics consecutifs');
}, OPT_F1());

const ANCRES = { 0: '0 : Absence / Non observé', 1: '1 : Faible / Transitoire (< 25 % du temps)', 2: '2 : Modéré / Intermittent (25 à 75 %)', 3: '3 : Majeur / Soutenu (> 75 %)', NA: 'NA : Non applicable / Non évaluable' };
const lireAncre = (A, code) => A.page.evaluate((c) => { const it = document.querySelector('[data-item="' + c + '"]'); const a = it.querySelectorAll('.ancre'); const e = a[0]; return { n: a.length, display: e ? getComputedStyle(e).display : null, rect: e ? e.getBoundingClientRect().height : 0, t: e ? e.textContent.replace(/[ \t\r\n]+/g, ' ').trim() : null, v: e ? e.getAttribute('data-ancre-valeur') : null }; }, code);
check('F4 .ancre : une par item, display:none sans focus dans l\'item, visible avec la definition du bouton focalise, data-ancre-valeur, suit les fleches, n\'ecrit rien', async (A) => {
  await A.go('t1');
  for (const c of ITEMS) { const r = await lireAncre(A, c); eq(r.n, 1, 'nombre de .ancre dans ' + c); eq(r.display, 'none', 'display de .ancre de ' + c + ' sans focus'); }
  const avant = await A.st();
  for (const v of ['0', '1', '2', '3', 'NA']) {
    await A.page.evaluate((x) => document.querySelector('button[data-rate="V1.2"][data-val="' + x + '"]').focus(), v);
    const r = await lireAncre(A, 'V1.2'); assert(r.display !== 'none' && r.rect > 0, '.ancre non visible avec le focus sur le bouton ' + v);
    eq(r.t, ANCRES[v], 'texte de l\'ancre (bouton ' + v + ' focalise)'); eq(r.v, v, 'data-ancre-valeur (bouton ' + v + ')');
    eq((await lireAncre(A, 'V1.1')).display, 'none', '.ancre d\'un autre item');
  }
  await A.page.evaluate(() => document.querySelector('button[data-rate="V1.2"][data-val="1"]').focus());
  await A.page.keyboard.press('ArrowRight'); const r = await lireAncre(A, 'V1.2');
  eq(r.v, '2', 'data-ancre-valeur apres Fleche droite'); eq(r.t, ANCRES[2], 'texte apres Fleche droite');
  await A.page.keyboard.press('ArrowDown');
  eq((await lireAncre(A, 'V1.2')).display, 'none', '.ancre de l\'item quitte'); assert((await lireAncre(A, 'V1.3')).display !== 'none', '.ancre de l\'item suivant visible');
  eq(await A.st(), avant, 'etat() modifie par la simple navigation (l\'ancre n\'ecrit rien)');
}, OPT_F1());
check('F4 .ancre : sans focus sur un bouton, definition de la valeur choisie ; aucune valeur : data-ancre-valeur absent', async (A) => {
  await A.go('t1');
  await A.coter('V2.1', 3);
  await A.page.evaluate(() => document.querySelector('[data-obs="V2.1"]').focus());
  let r = await lireAncre(A, 'V2.1'); assert(r.display !== 'none', '.ancre masquee alors que l\'item contient le focus'); eq(r.v, '3', 'data-ancre-valeur (valeur choisie)'); eq(r.t, ANCRES[3], 'texte (valeur choisie)');
  await A.page.evaluate(() => document.querySelector('[data-obs="V2.2"]').focus());
  r = await lireAncre(A, 'V2.2'); eq(r.v, null, 'data-ancre-valeur sans valeur choisie'); assert(Object.keys(ANCRES).every((k) => r.t !== ANCRES[k]), 'texte d\'ancre sans valeur : "' + r.t + '"');
  await A.page.evaluate(() => document.activeElement.blur()); eq((await lireAncre(A, 'V2.1')).display, 'none', '.ancre apres perte du focus');
  await A.go('t0'); await A.page.evaluate(() => document.querySelector('button[data-rate="T0.1"][data-val="NA"]').focus()); eq((await lireAncre(A, 'T0.1')).t, ANCRES.NA, 'ancre dans un item de T0 (NA)');
}, OPT_F1());

/* ================================================================== */
/* F5. Rappel de T0 a l'etape T2                                       */
/* ================================================================== */

const RAPPEL = (A) => A.page.evaluate(() => { const r = document.getElementById('rappel-t0'); if (!r) return null; const sec = document.querySelector('section[data-panel="t2"]'); const t2 = sec.querySelector('input[name^="t2-"]');
  return { dans: sec.contains(r), avant: !!(r.compareDocumentPosition(t2) & Node.DOCUMENT_POSITION_FOLLOWING), role: r.getAttribute('role'), aria: r.getAttribute('aria-label'), texte: r.textContent.replace(/[ \t\r\n]+/g, ' ').trim(),
    cellules: [...r.querySelectorAll('[data-rappel-t0]')].map((c) => ({ k: c.getAttribute('data-rappel-t0'), v: c.getAttribute('data-valeur') || '', fond: getComputedStyle(c).backgroundColor, tag: c.tagName })) }; });
check('F5 #rappel-t0 : en tete de l\'etape t2, 5 cellules T0.1 a T0.5, data-valeur, libelle, role img + aria-label, lecture seule', async (A) => {
  await A.go('t2'); const r = await RAPPEL(A); assert(r, '#rappel-t0 absent');
  eq(r.dans, true, 'dans section t2'); eq(r.avant, true, 'avant les choix T2'); eq(r.cellules.map((c) => c.k), T0, 'cellules'); eq(r.cellules.map((c) => c.v), ['0', 'NA', '', '3', '2'], 'data-valeur (T0.1 = 0, T0.2 = NA, T0.3 vide, T0.4 = 3, T0.5 = 2)');
  assert(/Rappel T0 \(ligne de base\)/.test(r.texte), 'libelle : "' + r.texte + '"'); eq(r.role, 'img', 'role'); assert(r.aria && r.aria.length >= 10 && /T0/.test(r.aria), 'aria-label : "' + r.aria + '"');
  assert(r.cellules.every((c) => !/^(BUTTON|INPUT|TEXTAREA|SELECT|A)$/.test(c.tag)), 'cellules interactives');
  eq(await A.page.evaluate(() => document.querySelectorAll('#rappel-t0 [tabindex]:not([tabindex="-1"]), #rappel-t0 button, #rappel-t0 input').length), 0, 'elements focalisables dans #rappel-t0');
}, { storage: stockage([sess({ id: 'r', identification: { code_sujet: 'RA1', condition: 'A' }, cotations: { 'T0.1': 0, 'T0.2': 'NA', 'T0.4': 3, 'T0.5': 2 } })], 'r') });
check('F5 #rappel-t0 : mis a jour en direct (cotation, effacement, annulation, changement de session) ; couleurs identiques a la bande d\'items du bilan visuel ; aria-label change', async (A) => {
  await A.go('t2'); const a0 = (await RAPPEL(A)).aria;
  await A.coter('T0.3', 1); await A.coter('T0.1', 3);
  await A.attendre(() => document.querySelector('[data-rappel-t0="T0.3"]').getAttribute('data-valeur') === '1' && document.querySelector('[data-rappel-t0="T0.1"]').getAttribute('data-valeur') === '3', null, 1200, 'mise a jour du rappel sans changer d\'etape');
  const r = await RAPPEL(A); assert(r.aria !== a0, 'aria-label inchange apres modification : "' + r.aria + '"');
  await A.coter('T0.3', 1); await A.attendre(() => (document.querySelector('[data-rappel-t0="T0.3"]').getAttribute('data-valeur') || '') === '', null, 1200, 'effacement de T0.3');
  await A.coter('T0.3', 2); await A.coter('T0.4', 'NA');
  await A.go('synthese');
  const bande = await A.page.evaluate(() => { const o = {}; document.querySelectorAll('#vis-bande-items [data-vis="cellule"]').forEach((c) => { const r = c.localName === 'rect' ? c : c.querySelector('rect') || c; o[c.getAttribute('data-code')] = getComputedStyle(r).fill; }); return o; });
  await A.go('t2'); const q = await RAPPEL(A);
  q.cellules.forEach((c) => { if (c.v === '' || c.v === 'NA') return; assert(c.fond === bande[c.k], 'couleur de ' + c.k + ' (valeur ' + c.v + ') : ' + c.fond + ' dans le rappel, ' + bande[c.k] + ' dans la bande d\'items'); });
  await A.charger([sess({ id: 'o', identification: { code_sujet: 'RB1', condition: 'B' }, cotations: { 'T0.5': 1 } })], 'o'); await A.go('t2');
  eq((await RAPPEL(A)).cellules.map((c) => c.v), ['', '', '', '', '1'], 'rappel d\'une autre session');
}, { storage: stockage([sess({ id: 'r', identification: { code_sujet: 'RA1', condition: 'A' }, cotations: { 'T0.1': 0, 'T0.2': 'NA', 'T0.4': 3, 'T0.5': 2 } })], 'r') });

/* ================================================================== */
/* Poids, hygiene, parcours                                            */
/* ================================================================== */

statique('Fichier : moins de 350 Ko (358 400 octets)', async () => { const n = fs.statSync(HTML).size; assert(n < 358400, 'taille ' + n + ' octets (limite 358400)'); });
statique('Fichier : aucune URL http:// ou https:// hors http://www.w3.org/', async () => {
  const hits = []; LIRE_HTML().split('http://www.w3.org/').join('').split('\n').forEach((l, i) => { if (/https?:\/\//i.test(l)) hits.push((i + 1) + ': ' + l.trim().slice(0, 80)); });
  eq(hits, [], 'occurrences');
});
statique('Fichier : aucun caractere invisible litteral (U+00A0, U+200B a U+200F, U+202F, U+2060, U+FEFF, U+FFFE, U+FFFF)', async () => {
  const hits = []; let ligne = 1;
  for (const ch of LIRE_HTML()) { const c = ch.codePointAt(0); if (c === 0x0A) { ligne++; continue; } if (c === 0xA0 || (c >= 0x200B && c <= 0x200F) || c === 0x202F || c === 0x2060 || c === 0xFEFF || c === 0xFFFE || c === 0xFFFF) { hits.push('U+' + c.toString(16).toUpperCase().padStart(4, '0') + ' ligne ' + ligne); if (hits.length >= 5) break; } }
  eq(hits, [], 'caracteres interdits');
});
check('Parcours complet F0 a F5 : aucune erreur console, aucune requete reseau', async (A) => {
  await A.go('session'); await A.page.fill('#f-code', 'Alpha1'); await A.page.fill('#recherche-session', '').catch(() => {});
  await A.ouvrirVue(); await A.page.fill('#recherche-participant', 'al'); await A.page.selectOption('#tri-participants', 'recent'); await A.page.click('#btn-retour-saisie');
  await A.go('t0'); await A.coter('T0.1', 2); await A.clic('#btn-minuteur-demarrer'); await A.go('t2'); await A.go('t1');
  await basculer(A); await A.go('synthese'); await A.panneau(); await A.page.fill('#recherche-session', 'beta'); await A.fermerPanneau(); await basculer(A);
  await A.page.evaluate(() => window.GrilleHaptique.etapeReprise(window.GrilleHaptique.etat()));
}, OPT_F1());

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
  BROWSER = browser;
  const nettoyer = () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* ignore */ } };
  const arret = async () => { try { await browser.close(); } catch (e) { /* ignore */ } nettoyer(); process.exit(130); };
  process.on('SIGINT', arret); process.on('SIGTERM', arret);

  let reussis = 0; let ignores = 0; let total = 0;
  try {
    const filtre = process.env.GRILLE_FILTRE ? new RegExp(process.env.GRILLE_FILTRE, 'i') : null;
    const aLancer = filtre ? checks.filter((c) => filtre.test(c.name)) : checks;
    for (const c of aLancer) {
      let A = null;
      try {
        if (c.opts.page === false) await avecDelai(Promise.resolve(c.fn(null)), c.opts.delai || 30000);
        else {
          A = await avecDelai(ouvrir(browser, c.opts), 20000);
          await avecDelai(c.fn(A), c.opts.delai || 40000);
          const externes = A.requests.filter((u) => !/^(file:|data:|blob:|about:)/.test(u));
          assert(externes.length === 0, 'requete reseau : ' + externes.slice(0, 3).join(', '));
          const erreurs = c.opts.tolererConsole ? A.errors.filter((x) => x.indexOf('pageerror') === 0) : A.errors;
          assert(erreurs.length === 0, 'erreurs : ' + erreurs.slice(0, 3).join(' || '));
        }
        reussis++; total++;
        console.log('OK  ' + c.name);
      } catch (e) {
        if (e instanceof Ignore) { ignores++; console.log('IGNORE  ' + c.name + ' : ' + e.message); } else {
          total++;
          console.log('ECHEC  ' + c.name + ' : ' + raison(e));
        }
      } finally {
        if (A) { try { await avecDelai(A.ctx.close(), 5000); } catch (e) { /* ignore */ } }
      }
    }
  } finally {
    try { await browser.close(); } catch (e) { /* ignore */ }
    nettoyer();
  }
  console.log('\n' + reussis + '/' + total + ' reussis' + (ignores ? ' (' + ignores + ' ignore(s), non compte(s))' : ''));
  process.exit(reussis === total ? 0 : 1);
}

main().catch((e) => { console.error('Erreur fatale : ' + (e && e.stack || e)); process.exit(3); });
