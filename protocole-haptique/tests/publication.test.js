#!/usr/bin/env node
'use strict';

/*
 * Controle de la preparation a la publication (MODE_OPERATOIRE.md, section Publication) :
 * balises de page publique, CSP stricte, surface minimale, et meme parcours sous file://
 * et sous http://127.0.0.1 (serveur Node local) sans erreur, sans requete exterieure
 * et sans violation de la politique de securite.
 *
 * Usage : node protocole-haptique/tests/publication.test.js
 * Variable facultative : GRILLE_HTML (autre fichier HTML a tester).
 * Codes de sortie : 0 tout passe, 1 au moins un echec, 2 fichier HTML absent,
 * 3 Playwright, Chromium ou serveur local inutilisable.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');

const HTML = process.env.GRILLE_HTML
  ? path.resolve(process.env.GRILLE_HTML)
  : path.resolve(__dirname, '..', 'grille-haptique.html');
if (!fs.existsSync(HTML)) { console.error('Fichier HTML introuvable : ' + HTML); process.exit(2); }
const SOURCE = fs.readFileSync(HTML, 'utf8');
const LIMITE = 358400;

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";

const checks = [];
const check = (name, fn, opts) => checks.push({ name, fn, opts: opts || {} });
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), m + ' : ' + JSON.stringify(a) + ' au lieu de ' + JSON.stringify(b));

/* ------------------------------------------------------------------ */
/* Controles statiques                                                 */
/* ------------------------------------------------------------------ */

check('Statique : CSP en premiere balise de <head>, avec connect-src \'none\'', () => {
  const head = SOURCE.slice(SOURCE.indexOf('<head>') + 6).trimStart();
  assert(head.startsWith('<meta http-equiv="Content-Security-Policy"'), 'la CSP n\'est pas la premiere balise de <head>');
  const m = head.match(/^<meta http-equiv="Content-Security-Policy" content="([^"]*)">/);
  assert(m, 'balise CSP illisible');
  eq(m[1], CSP, 'politique');
  assert(/connect-src 'none'/.test(m[1]), 'connect-src \'none\' absent');
});
check('Statique : balises de page publique (robots, referrer, color-scheme, description, theme-color, favicon data:, titre, noscript)', () => {
  const a = (re, m) => assert(re.test(SOURCE), m + ' absent');
  a(/<meta name="robots" content="noindex, nofollow, noarchive">/, 'robots');
  a(/<meta name="referrer" content="no-referrer">/, 'referrer');
  a(/<meta name="color-scheme" content="light dark">/, 'color-scheme');
  a(/<meta name="description" content="Grille d'observation clinique : saisie locale, aucune donnée transmise\.">/, 'description');
  a(/<meta name="theme-color" content="#F8F7F4"/i, 'theme-color #F8F7F4');
  a(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,/, 'favicon SVG en data:');
  a(/<title>Grille d'observation haptique<\/title>/, 'titre');
  a(/<noscript><p class="noscript">JavaScript est nécessaire pour utiliser cette grille\.<\/p><\/noscript>/, 'noscript');
});
check('Statique : aucune adresse http(s) hors http://www.w3.org/', () => {
  const hors = (SOURCE.match(/https?:\/\/[^\s"'<>)]*/g) || []).filter((u) => u.indexOf('http://www.w3.org/') !== 0);
  eq(hors, [], 'adresses trouvees');
});
check('Statique : poids inferieur a 358 400 octets', () => {
  const n = fs.statSync(HTML).size; assert(n < LIMITE, 'poids ' + n + ' octets (limite ' + LIMITE + ')');
});
check('Statique : surface publique minimale (aucun e-mail, chemin de machine, jeu de donnees ni code de participant)', () => {
  const s = SOURCE.replace(/url\(data:[^)]*\)/g, 'url(DATA)');
  const motifs = [[/[\w.+-]+@[\w-]+\.[a-z]{2,}/i, 'adresse e-mail'], [/\/home\/|\/Users\/|\/root\/|\/tmp\/|\b[A-Z]:\\\\/, 'chemin de machine'],
    [/code_sujet["']?\s*:\s*["'][^"']+["']/, 'code de participant en dur'], [/"schema"\s*:\s*"grille-haptique\/1"\s*,\s*"(exporte_le|sessions)"/, 'jeu de donnees exporte'],
    [/localStorage\.setItem\([^)]*JSON\.stringify\(\[\{/, 'sessions pre-remplies']];
  const hits = motifs.filter(([re]) => re.test(s)).map((x) => x[1]);
  eq(hits, [], 'elements interdits');
});

/* ------------------------------------------------------------------ */
/* Serveur local                                                       */
/* ------------------------------------------------------------------ */

function servir() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      if (req.url.split('?')[0] === '/' || req.url.split('?')[0] === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(SOURCE); } else { res.writeHead(404); res.end(); }
    });
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

/* faux dossier minimal en memoire, installe avant le chargement */
function installerFauxDossier() {
  const noeud = (type, nom) => ({ type, nom, enfants: new Map(), contenu: '' });
  const racine = noeud('dir', 'Dossier-Test');
  const poignee = (n) => {
    const h = { kind: n.type === 'dir' ? 'directory' : 'file', name: n.nom, queryPermission: async () => 'granted', requestPermission: async () => 'granted' };
    if (n.type === 'dir') {
      const creer = (type) => async (nom, o) => { let e = n.enfants.get(nom); if (!e) { if (!(o && o.create)) throw new DOMException('absent', 'NotFoundError'); e = noeud(type, nom); n.enfants.set(nom, e); } return poignee(e); };
      h.getDirectoryHandle = creer('dir'); h.getFileHandle = creer('file');
      h.removeEntry = async (nom) => { n.enfants.delete(nom); };
      h.values = () => { const l = [...n.enfants.values()]; return (async function* () { for (const e of l) yield poignee(e); })(); };
    } else {
      h.getFile = async () => ({ text: async () => n.contenu });
      h.createWritable = async () => { let t = ''; return { write: async (d) => { t += d; }, close: async () => { n.contenu = t; } }; };
    }
    return h;
  };
  window.showDirectoryPicker = async () => poignee(racine);
  const fichiers = (n, out) => { n.enfants.forEach((e) => { if (e.type === 'file') out.push(e.nom); else fichiers(e, out); }); return out; };
  window.__fichiersDossier = () => fichiers(racine, []);
  window.__persistAppels = 0; window.__csp = []; window.__print = 0;
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
  const orig = navigator.storage && navigator.storage.persist && navigator.storage.persist.bind(navigator.storage);
  if (orig) navigator.storage.persist = () => { window.__persistAppels += 1; return orig(); };
  window.print = () => { window.__print += 1; };
}

/* ------------------------------------------------------------------ */
/* Parcours rejoue sous chaque origine                                 */
/* ------------------------------------------------------------------ */

async function ouvrir(browser, origine) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(installerFauxDossier);
  const page = await ctx.newPage();
  const trace = { erreurs: [], externes: [] };
  page.on('console', (m) => { if (m.type() === 'error') trace.erreurs.push(m.text()); });
  page.on('pageerror', (e) => trace.erreurs.push(String(e)));
  page.on('request', (r) => { const u = r.url(); if (!/^(data:|blob:)/.test(u) && u.indexOf(origine.prefixe) !== 0) trace.externes.push(u); });
  await page.goto(origine.url);
  await page.waitForFunction(() => window.GrilleHaptique && typeof window.GrilleHaptique.allerA === 'function');
  return { ctx, page, trace };
}

async function parcours(browser, origine) {
  const { ctx, page, trace } = await ouvrir(browser, origine);
  const api = (f, ...a) => page.evaluate(([f, a]) => window.GrilleHaptique[f](...a), [f, a]);
  const res = {};
  res.secure = await page.evaluate(() => window.isSecureContext);
  /* saisie : code fictif, condition, cotations */
  await page.fill('#f-code', 'FICT1');
  await page.click('input[name="condition"][value="A"]');
  await api('allerA', 't0');
  await page.click('button[data-rate="T0.1"][data-val="2"]');
  await page.click('button[data-rate="T0.2"][data-val="3"]');
  await api('allerA', 't1');
  await page.click('button[data-rate="V1.1"][data-val="1"]');
  /* persistance */
  await page.reload();
  await page.waitForFunction(() => window.GrilleHaptique && typeof window.GrilleHaptique.sessions === 'function');
  const s = (await api('sessions')).find((x) => x.identification.code_sujet === 'FICT1');
  res.persistance = !!s && s.cotations['T0.1'] === 2 && s.cotations['V1.1'] === 1;
  /* exports par telechargement de blob */
  await api('allerA', 'synthese');
  const telecharger = async (sel) => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click(sel)]); const f = await d.path(); return { nom: d.suggestedFilename(), taille: fs.statSync(f).size, debut: fs.readFileSync(f).slice(0, 4).toString('latin1') }; };
  res.json = await telecharger('#btn-export-json-synthese');
  res.csv = await telecharger('#btn-export-csv-synthese');
  await page.click('#btn-imprimer-synthese');
  res.impression = await page.evaluate(() => window.__print);
  /* vue Participants, fiche et bilan, export xlsx */
  await page.click('#btn-participants');
  res.xlsx = await telecharger('#btn-xlsx-tous');
  await page.click('#table-participants tbody tr button');
  res.bilan = await page.evaluate(() => document.querySelectorAll('#bilan svg').length);
  await page.click('#btn-retour-saisie');
  /* minuteur */
  await page.click('#btn-minuteur-demarrer');
  await page.waitForFunction(() => document.getElementById('minuteur').getAttribute('data-etat') === 'marche');
  await page.click('#btn-minuteur-pause');
  await page.waitForFunction(() => document.getElementById('minuteur').getAttribute('data-etat') === 'pause');
  /* faux dossier et persistance du stockage */
  await page.click('#btn-sessions');
  await page.click('#btn-dossier-sauvegarde');
  await page.waitForFunction(() => document.getElementById('etat-dossier').getAttribute('data-etat-dossier') === 'actif');
  await api('ecrireDossier');
  res.dossier = await page.evaluate(() => window.__fichiersDossier().length);
  res.persist = await page.evaluate(() => window.__persistAppels);
  res.polices = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].map((f) => f.status); });
  res.csp = await page.evaluate(() => window.__csp);
  res.trace = trace;
  await ctx.close();
  return res;
}

function verifierParcours(r, origine) {
  assert(r.persistance, origine.nom + ' : session non retrouvee apres rechargement');
  assert(/\.json$/i.test(r.json.nom) && r.json.taille > 100, origine.nom + ' : export JSON ' + JSON.stringify(r.json));
  assert(/\.csv$/i.test(r.csv.nom) && r.csv.taille > 50, origine.nom + ' : export CSV ' + JSON.stringify(r.csv));
  assert(/\.xlsx$/i.test(r.xlsx.nom) && r.xlsx.debut.indexOf('PK') === 0, origine.nom + ' : export xlsx ' + JSON.stringify(r.xlsx));
  assert(r.impression === 1, origine.nom + ' : impression non declenchee');
  assert(r.bilan > 0, origine.nom + ' : bilan SVG absent');
  assert(r.dossier > 0, origine.nom + ' : faux dossier sans ecriture');
  assert(r.persist >= 1, origine.nom + ' : navigator.storage.persist non appele');
  assert(r.polices.length === 1 && r.polices.every((s) => s === 'loaded'), origine.nom + ' : polices incorporees ' + JSON.stringify(r.polices));
  eq(r.csp, [], origine.nom + ' : violations de la politique de securite');
  eq(r.trace.erreurs, [], origine.nom + ' : erreurs console');
  eq(r.trace.externes, [], origine.nom + ' : requetes hors origine');
}

let ctxGlobal = null;
check('Parcours sous http://127.0.0.1 : saisie, rechargement, exports, Participants, minuteur, faux dossier, persist, aucune erreur ni violation', async () => {
  const r = await parcours(ctxGlobal.browser, { nom: 'http', url: ctxGlobal.urlHttp, prefixe: ctxGlobal.prefixe });
  assert(r.secure === true, 'window.isSecureContext faux sous http://127.0.0.1');
  verifierParcours(r, { nom: 'http' });
});
check('Parcours sous file:// : meme comportement, aucune erreur ni violation', async () => {
  const url = pathToFileURL(HTML).href;
  verifierParcours(await parcours(ctxGlobal.browser, { nom: 'file', url, prefixe: url }), { nom: 'file' });
});
check('CSP effective : fetch, XMLHttpRequest et image distante sont bloques et signales', async () => {
  const { ctx, page } = await ouvrir(ctxGlobal.browser, { url: ctxGlobal.urlHttp, prefixe: ctxGlobal.prefixe });
  const r = await page.evaluate(async (u) => {
    const sortie = {};
    try { await fetch(u); sortie.fetch = 'passe'; } catch (e) { sortie.fetch = 'bloque'; }
    try { sortie.xhr = await new Promise((ok) => { const x = new XMLHttpRequest(); x.onerror = () => ok('bloque'); x.onload = () => ok('passe'); x.open('GET', u); x.send(); }); } catch (e) { sortie.xhr = 'bloque'; }
    try { new WebSocket(u.replace('http', 'ws')); sortie.ws = 'cree'; } catch (e) { sortie.ws = 'bloque'; }
    await new Promise((ok) => { const i = new Image(); i.onerror = () => { sortie.img = 'bloque'; ok(); }; i.onload = () => { sortie.img = 'passe'; ok(); }; i.src = u + 'x.png'; });
    await new Promise((ok) => setTimeout(ok, 200));
    sortie.violations = window.__csp.length;
    return sortie;
  }, ctxGlobal.urlHttp);
  await ctx.close();
  assert(r.fetch === 'bloque' && r.xhr === 'bloque' && r.img === 'bloque', 'transmission possible : ' + JSON.stringify(r));
  assert(r.violations >= 3, 'violations signalees : ' + r.violations);
});

/* ------------------------------------------------------------------ */

async function main() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { console.error('Playwright introuvable : ' + e.message); process.exit(3); }
  let browser; let srv;
  try { browser = await chromium.launch(); } catch (e) { console.error('Chromium ne demarre pas : ' + e.message); process.exit(3); }
  try { srv = await servir(); } catch (e) { console.error('Serveur local inutilisable : ' + e.message); await browser.close(); process.exit(3); }
  const port = srv.address().port;
  ctxGlobal = { browser, urlHttp: 'http://127.0.0.1:' + port + '/', prefixe: 'http://127.0.0.1:' + port };
  let reussis = 0;
  try {
    for (const c of checks) {
      try { await Promise.race([Promise.resolve(c.fn()), new Promise((_, rej) => setTimeout(() => rej(new Error('delai de 60 s depasse')), 60000))]); reussis++; console.log('OK  ' + c.name); } catch (e) { console.log('ECHEC  ' + c.name + ' : ' + (e && e.message || e)); }
    }
  } finally { await browser.close(); srv.close(); }
  console.log('\n' + reussis + '/' + checks.length + ' reussis');
  process.exit(reussis === checks.length ? 0 : 1);
}
main().catch((e) => { console.error('Erreur fatale : ' + (e && e.stack || e)); process.exit(3); });
