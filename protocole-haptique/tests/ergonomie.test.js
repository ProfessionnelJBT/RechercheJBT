#!/usr/bin/env node
'use strict';

/*
 * Suite de tests de bout en bout : ergonomie, minuteur, plusieurs fenetres, echec d'ecriture,
 * accessibilite, gabarit et charte (contrat D1 a D8 du lot de corrections v3).
 * Ecrite uniquement a partir du contrat (LOT.md, sections D1 a D8) et de MODE_OPERATOIRE.md (parties B et C) :
 * le code de grille-haptique.html n'a pas ete lu, les attendus viennent du contrat.
 *
 * Usage : node protocole-haptique/tests/ergonomie.test.js
 * Variables d'environnement facultatives : GRILLE_HTML (autre fichier HTML a tester),
 * GRILLE_FILTRE (expression reguliere : ne lance que les controles dont le nom correspond).
 * Sortie : une ligne "OK  nom" ou "ECHEC  nom : raison" par controle, "IGNORE  nom : raison" si un
 * comportement ne peut pas etre emule par le navigateur de test (non compte dans le total), puis "n/N reussis".
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
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ergonomie-test-'));
const TMP_DATA = path.join(TMP, 'data');
fs.mkdirSync(TMP_DATA);

process.on('unhandledRejection', () => {});

/* ------------------------------------------------------------------ */
/* Donnees du contrat                                                  */
/* ------------------------------------------------------------------ */

const T0 = ['T0.1', 'T0.2', 'T0.3', 'T0.4', 'T0.5'];
const T1 = ['V1.1', 'V1.2', 'V1.3', 'V1.4', 'V2.1', 'V2.2', 'V2.3', 'V2.4', 'V3.1', 'V3.2', 'V3.3', 'V4.1', 'V4.2', 'V4.3'];
const ITEMS = T0.concat(T1);
const ETAPES = ['session', 't0', 't1', 't2', 'physio', 'synthese'];
const CLE_MINUTEUR = 'grilleHaptique.v1.minuteur';
const CLE_SESSIONS = 'grilleHaptique.v1.sessions';
const TXT_ECHEC = 'Enregistrement automatique indisponible sur ce navigateur : exportez la session avant de fermer';
const TXT_AUTRE = 'Une autre fenêtre a modifié les sessions : données fusionnées.';

/* ------------------------------------------------------------------ */
/* Outils generiques                                                   */
/* ------------------------------------------------------------------ */

class Ignore extends Error {}
function ignorer(msg) { throw new Ignore(msg); }
function fail(msg) { throw new Error(msg); }
function assert(cond, msg) { if (!cond) fail(msg); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function canon(x) {
  if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
  if (x && typeof x === 'object') {
    return '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
  }
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
function nz(s) { return String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim().normalize('NFC'); }
function secondes(v) { const m = /^(\d+):(\d{2})$/.exec(String(v || '').trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; }

const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');
function raison(e) {
  const lignes = String((e && e.message) || e).replace(ANSI, '').split('\n').map((l) => l.trim()).filter(Boolean);
  let r = lignes[0] || 'erreur inconnue';
  const loc = lignes.find((l) => /waiting for|locator\(|selector/.test(l) && l !== lignes[0]);
  if (loc) r += ' | ' + loc;
  return r.length > 420 ? r.slice(0, 417) + '...' : r;
}

/* attend que fn() renvoie une valeur vraie (sondage cote Node, sans horloge de la page) */
async function attendre(label, fn, ms) {
  const fin = Date.now() + (ms || 2500);
  for (;;) {
    let v = null;
    try { v = await fn(); } catch (e) { v = null; }
    if (v) return v;
    if (Date.now() > fin) fail('delai depasse : ' + label);
    await sleep(40);
  }
}

/* ------------------------------------------------------------------ */
/* Script injecte avant l'application (espions, echec de stockage)    */
/* ------------------------------------------------------------------ */

function SCRIPT_INITIAL(cfg) {
  window.__ecritures = [];
  window.__echec = !!cfg.echec;
  window.__ann = [];
  window.__annLast = null;
  window.__wl = [];
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage) {
      if (window.__echec) throw new DOMException('quota depasse', 'QuotaExceededError');
      window.__ecritures.push(String(k));
    }
    return orig.call(this, k, v);
  };
  /* historique de tout ce qui est ecrit dans #annonce */
  const pousser = (t) => { if (t) window.__ann.push(String(t)); };
  new MutationObserver((recs) => {
    const a = document.getElementById('annonce');
    if (!a) return;
    recs.forEach((r) => {
      if (r.type === 'characterData' && a.contains(r.target)) pousser(r.target.data);
      if (r.type === 'childList') {
        if (a.contains(r.target)) {
          r.addedNodes.forEach((n) => pousser(n.textContent));
          if (!r.addedNodes.length) pousser(a.textContent);
        } else {
          r.addedNodes.forEach((n) => { if (n.nodeType === 1 && (n === a || n.contains(a))) pousser(a.textContent); });
        }
      }
    });
  }).observe(document, { subtree: true, childList: true, characterData: true });
  if (cfg.wakeLock === 'absent') {
    try { delete Navigator.prototype.wakeLock; } catch (e) { /* ignore */ }
  } else if (cfg.wakeLock === 'espion') {
    const wl = {
      request: (type) => {
        window.__wl.push('request');
        const s = new EventTarget();
        s.type = type || 'screen'; s.released = false;
        s.release = () => { window.__wl.push('release'); s.released = true; s.dispatchEvent(new Event('release')); return Promise.resolve(); };
        return Promise.resolve(s);
      },
    };
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, get: () => wl });
  }
}

const SCRIPT_BLOQUER_STORAGE = () => { window.addEventListener('storage', (e) => e.stopImmediatePropagation(), true); };

/* ------------------------------------------------------------------ */
/* Application sous test                                               */
/* ------------------------------------------------------------------ */

let apiAbsente = false;
const etapeDe = (code) => (/^T0/.test(code) ? 't0' : 't1');
const sel = (code, val) => '[data-item="' + code + '"] button[data-rate][data-val="' + val + '"]';

function outils(page, A) {
  const O = { page };
  page.on('console', (m) => { if (m.type() === 'error') A.errors.push('console.error : ' + m.text()); });
  page.on('pageerror', (e) => { A.errors.push('pageerror : ' + e.message); A.erreursPage.push('pageerror : ' + e.message); });
  page.on('request', (r) => A.requests.push(r.url()));
  page.on('dialog', async (d) => { A.dialogs.push(d.message()); try { await d.accept(); } catch (e) { /* ignore */ } });

  O.attendreAPI = async () => {
    const fin = Date.now() + (apiAbsente ? 300 : 3000);
    while (Date.now() < fin) {
      try { if (await page.evaluate(() => !!(window.GrilleHaptique && typeof window.GrilleHaptique.etat === 'function'))) return; } catch (e) { /* navigation */ }
      await sleep(50);
    }
    apiAbsente = true;
  };
  O.st = () => page.evaluate(() => window.GrilleHaptique.etat());
  O.cot = async (code) => (await O.st()).cotations[code];
  O.go = (k) => page.evaluate((x) => window.GrilleHaptique.allerA(x), k);
  O.recharger = async () => { await page.reload(); await O.attendreAPI(); };
  O.clic = async (s) => {
    const l = page.locator(s).first();
    try { await l.click({ timeout: 1000 }); } catch (e) { await l.evaluate((el) => el.click(), null, { timeout: 1000 }); }
  };
  O.visible = (s) => page.locator(s).first().isVisible();
  O.texte = async (s) => (await page.locator(s).first().textContent()).trim();
  O.corps = () => page.evaluate(() => document.body.innerText);
  O.etapesCourantes = () => page.$$eval('button[data-step][aria-current="step"]', (b) => b.map((x) => x.getAttribute('data-step')));
  O.sessionsStockees = () => page.evaluate(() => JSON.parse(localStorage.getItem('grilleHaptique.v1.sessions') || '[]'));
  O.sessionsBrut = () => page.evaluate(() => localStorage.getItem('grilleHaptique.v1.sessions'));
  O.clesStockage = () => page.evaluate(() => ({ l: Object.keys(localStorage).sort(), s: Object.keys(sessionStorage).sort() }));
  O.ecritures = () => page.evaluate(() => window.__ecritures.slice());
  O.defocus = () => page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  O.coter = async (code, val) => { await O.go(etapeDe(code)); await O.clic(sel(code, val)); };
  O.focusBtn = (code, val) => page.evaluate((s) => {
    const b = document.querySelector(s);
    if (!b) throw new Error('bouton introuvable : ' + s);
    b.focus();
    return document.activeElement === b;
  }, sel(code, val));
  O.actif = () => page.evaluate(() => {
    const a = document.activeElement; const it = a && a.closest ? a.closest('[data-item]') : null;
    return { tag: a ? a.tagName : null, id: a ? a.id : null, item: it ? it.getAttribute('data-item') : null,
      val: a && a.getAttribute ? a.getAttribute('data-val') : null, tabindex: a && a.getAttribute ? a.getAttribute('tabindex') : null };
  });
  /* evenement clavier synthetique (keydown) sur l'element actif ou un selecteur ; renvoie defaultPrevented */
  O.touche = (init, s) => page.evaluate((a) => {
    const el = a.s ? document.querySelector(a.s) : document.activeElement;
    const ev = new KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, a.init));
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  }, { init, s });
  O.annonces = () => page.evaluate(() => window.__ann.slice());
  O.razAnnonces = () => page.evaluate(() => { window.__ann = []; });
  O.annonceTexte = () => page.evaluate(() => { const a = document.getElementById('annonce'); return a ? a.textContent : null; });
  O.etats = () => page.evaluate(() => [...document.querySelectorAll('[data-item]')].map((it) => [it.getAttribute('data-item'), it.getAttribute('data-etat')]));
  O.tabs = () => page.evaluate(() => [...document.querySelectorAll('[data-item]')].map((it) => ({
    code: it.getAttribute('data-item'),
    b: [...it.querySelectorAll('button[data-rate]')].map((b) => [b.getAttribute('data-val'), b.getAttribute('tabindex')]),
  })));
  O.minuteur = () => page.evaluate(() => {
    const m = document.getElementById('minuteur'); const v = document.getElementById('minuteur-valeur'); const s = document.getElementById('minuteur-phase');
    return { etat: m ? m.getAttribute('data-etat') : null, valeur: v ? v.textContent.trim() : null, phase: s ? s.value : null, role: m ? m.getAttribute('role') : null };
  });
  O.telecharger = async (s) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 3000 }), O.clic(s)]);
    return { name: dl.suggestedFilename(), texte: fs.readFileSync(await dl.path(), 'utf8') };
  };
  return O;
}

async function ouvrir(browser, opt) {
  opt = opt || {};
  const co = { viewport: opt.viewport || { width: 1280, height: 900 }, acceptDownloads: true, colorScheme: opt.colorScheme || 'light', locale: 'fr-FR' };
  if (opt.hasTouch) co.hasTouch = true;
  if (opt.isMobile) co.isMobile = true;
  const ctx = await browser.newContext(co);
  ctx.setDefaultTimeout(1500);
  ctx.setDefaultNavigationTimeout(8000);
  await ctx.addInitScript(SCRIPT_INITIAL, { echec: !!opt.echec, wakeLock: opt.wakeLock || null });
  const A = { ctx, errors: [], erreursPage: [], requests: [], dialogs: [] };
  const page = await ctx.newPage();
  Object.assign(A, outils(page, A));
  A.ouvrirAutre = async (o2) => {
    o2 = o2 || {};
    const p = await ctx.newPage();
    const B = outils(p, A);
    if (o2.bloquerStorage) await p.addInitScript(SCRIPT_BLOQUER_STORAGE);
    await p.goto(URL_APP);
    await B.attendreAPI();
    return B;
  };
  if (opt.clock) await page.clock.install();
  await page.goto(URL_APP);
  await A.attendreAPI();
  return A;
}

/* ------------------------------------------------------------------ */
/* Harnais                                                             */
/* ------------------------------------------------------------------ */

const checks = [];
function check(name, fn, opts) { checks.push({ name, fn, opts: opts || {} }); }
function statique(name, fn) { checks.push({ name, fn, opts: { page: false } }); }
const MOBILE = { viewport: { width: 390, height: 844 } };
const CLOCK = { clock: true };

/* ================================================================== */
/* D1. Clavier                                                         */
/* ================================================================== */

/* pose une valeur par evenement synthetique et renvoie la cotation lue ensuite */
async function frappe(A, code, init) {
  await A.go(etapeDe(code));
  assert(await A.focusBtn(code, '0'), 'le bouton 0 de ' + code + ' ne prend pas le focus');
  await A.touche(init);
  await sleep(60);
  return A.cot(code);
}

check('D1 clavier : cotation par ev.code malgre une disposition AZERTY (key & e " a, code Digit0 a Digit3)', async (A) => {
  const cas = [
    { key: 'à', code: 'Digit0', val: 0 }, { key: '&', code: 'Digit1', val: 1 },
    { key: 'é', code: 'Digit2', val: 2 }, { key: '"', code: 'Digit3', val: 3 },
  ];
  for (let i = 0; i < cas.length; i++) {
    const c = cas[i];
    eq(await frappe(A, T1[i], { key: c.key, code: c.code }), c.val, 'key=' + JSON.stringify(c.key) + ' code=' + c.code + ' sur ' + T1[i]);
  }
  /* QWERTY ordinaire */
  eq(await frappe(A, 'V2.1', { key: '2', code: 'Digit2' }), 2, 'key=2 code=Digit2');
});

check('D1 clavier : pave numerique (Numpad0 a Numpad3) et ev.key 0 a 3 sans code exploitable', async (A) => {
  for (let i = 0; i < 4; i++) {
    eq(await frappe(A, T0[i], { key: String(i), code: 'Numpad' + i }), i, 'Numpad' + i + ' sur ' + T0[i]);
  }
  eq(await frappe(A, 'T0.5', { key: '2', code: '' }), 2, 'key=2 sans code');
  eq(await frappe(A, 'V1.1', { key: '3', code: 'KeyW' }), 3, 'key=3 avec un code quelconque');
});

check('D1 clavier : seuls Digit0-3 / Numpad0-3 comptent (Digit4, Digit5, Numpad4, autres touches sans effet)', async (A) => {
  eq(await frappe(A, 'V1.1', { key: '\'', code: 'Digit4' }), null, 'Digit4 (key apostrophe)');
  eq(await frappe(A, 'V1.2', { key: '(', code: 'Digit5' }), null, 'Digit5');
  eq(await frappe(A, 'V1.3', { key: '4', code: 'Numpad4' }), null, 'Numpad4');
  eq(await frappe(A, 'V1.4', { key: 'x', code: 'KeyX' }), null, 'touche x');
  const st = await A.st();
  eq(ITEMS.filter((c) => st.cotations[c] !== null), [], 'items cotes par erreur');
});

check('D1 clavier : n et N posent NA', async (A) => {
  eq(await frappe(A, 'T0.1', { key: 'n', code: 'KeyN' }), 'NA', 'n');
  eq(await frappe(A, 'T0.2', { key: 'N', code: 'KeyN', shiftKey: true }), 'NA', 'N');
  eq(await frappe(A, 'V3.2', { key: 'n', code: 'KeyN' }), 'NA', 'n en T1');
});

check('D1 clavier : rien dans un textarea ni un champ de saisie, rien hors d\'un item', async (A) => {
  await A.go('t0');
  await A.page.focus('textarea[data-obs="T0.1"]');
  await A.page.keyboard.type('n2 31&');
  eq(await A.page.inputValue('textarea[data-obs="T0.1"]'), 'n2 31&', 'texte saisi dans le textarea');
  await A.touche({ key: '&', code: 'Digit1' });
  await A.touche({ key: 'n', code: 'KeyN' });
  await A.go('session');
  await A.page.focus('#f-code');
  await A.page.keyboard.type('n12');
  eq(await A.page.inputValue('#f-code'), 'n12', 'code sujet');
  await A.go('t0');
  await A.page.focus('#btn-suivant');
  await A.touche({ key: '2', code: 'Digit2' });
  const st = await A.st();
  eq(ITEMS.filter((c) => st.cotations[c] !== null), [], 'items cotes par erreur');
});

async function verifierRoving(A, label) {
  const st = await A.st();
  const tabs = await A.tabs();
  eq(tabs.length, ITEMS.length, label + ' : nombre de [data-item]');
  tabs.forEach((t) => {
    const v = st.cotations[t.code];
    const attendu = v === null || v === undefined ? t.b[0][0] : String(v);
    assert(t.b.length === 5, label + ' : ' + t.code + ' a ' + t.b.length + ' boutons de cotation');
    const zeros = t.b.filter((b) => b[1] === '0').map((b) => b[0]);
    const autres = t.b.filter((b) => b[1] !== '0' && b[1] !== '-1');
    eq(zeros, [attendu], label + ' : bouton a tabindex="0" de ' + t.code);
    eq(autres, [], label + ' : boutons de ' + t.code + ' sans tabindex 0 ni -1');
  });
}

check('D1 roving tabindex : un seul tabindex="0" par item (le bouton choisi, sinon le premier), mis a jour apres cotation', async (A) => {
  await verifierRoving(A, 'etat initial');
  await A.coter('T0.1', '2'); await verifierRoving(A, 'T0.1=2');
  await A.coter('V1.2', '3'); await verifierRoving(A, 'V1.2=3');
  await A.coter('T0.2', 'NA'); await verifierRoving(A, 'T0.2=NA');
  await A.coter('T0.1', '0'); await verifierRoving(A, 'T0.1 remplace par 0');
  await A.go('t1');
  await A.focusBtn('V2.1', '0');
  await A.touche({ key: '&', code: 'Digit1' });
  await sleep(60);
  await verifierRoving(A, 'V2.1 cote au clavier');
  await A.coter('T0.1', '0'); await verifierRoving(A, 'T0.1 efface par second clic');
  await A.recharger();
  await verifierRoving(A, 'apres rechargement');
});

check('D1 fleches haut/bas : focus sur le bouton tabindex="0" de l\'item voisin, sans coter, sans effet aux extremites', async (A) => {
  await A.coter('V1.3', '2');
  await A.go('t1');
  assert(await A.focusBtn('V1.2', '0'), 'focus sur V1.2');
  await A.page.keyboard.press('ArrowDown');
  const b = await attendre('focus sur V1.3', async () => { const x = await A.actif(); return x.item === 'V1.3' && x; });
  eq([b.val, b.tabindex], ['2', '0'], 'bouton atteint en descendant (le bouton choisi de V1.3)');
  await A.page.keyboard.press('ArrowUp');
  const h = await attendre('focus sur V1.2', async () => { const x = await A.actif(); return x.item === 'V1.2' && x; });
  eq([h.val, h.tabindex], ['0', '0'], 'bouton atteint en montant (premier bouton de V1.2)');
  const st = await A.st();
  eq(ITEMS.filter((c) => st.cotations[c] !== null), ['V1.3'], 'items cotes (seul V1.3, pose au depart)');
  /* extremites */
  await A.go('t0');
  await A.focusBtn('T0.1', '0');
  await A.page.keyboard.press('ArrowUp');
  await sleep(80);
  const e1 = await A.actif();
  eq([e1.item, e1.val], ['T0.1', '0'], 'fleche haut sur le premier item');
  await A.go('t1');
  await A.focusBtn('V4.3', '0');
  await A.page.keyboard.press('ArrowDown');
  await sleep(80);
  const e2 = await A.actif();
  eq([e2.item, e2.val], ['V4.3', '0'], 'fleche bas sur le dernier item');
  const st2 = await A.st();
  eq(ITEMS.filter((c) => st2.cotations[c] !== null), ['V1.3'], 'items cotes apres les extremites');
});

check('D1 fleches gauche/droite : focus sur le bouton de valeur voisin, sans coter', async (A) => {
  await A.go('t1');
  assert(await A.focusBtn('V1.1', '1'), 'focus sur V1.1 / 1');
  const suite = ['2', '3', 'NA'];
  for (const v of suite) {
    await A.page.keyboard.press('ArrowRight');
    const x = await attendre('focus sur la valeur ' + v, async () => { const a = await A.actif(); return a.item === 'V1.1' && a.val === v && a; });
    assert(x, 'fleche droite vers ' + v);
  }
  for (const v of ['3', '2', '1', '0']) {
    await A.page.keyboard.press('ArrowLeft');
    await attendre('focus sur la valeur ' + v, async () => { const a = await A.actif(); return a.item === 'V1.1' && a.val === v; });
  }
  const st = await A.st();
  eq(ITEMS.filter((c) => st.cotations[c] !== null), [], 'items cotes par les fleches');
  const pressed = await A.page.$$eval('[data-item="V1.1"] button[aria-pressed="true"]', (b) => b.length);
  eq(pressed, 0, 'boutons aria-pressed="true" dans V1.1');
  await verifierRoving(A, 'apres navigation horizontale');
});

check('D1 Backspace et Delete effacent la cotation de l\'item (null), mais pas dans un textarea', async (A) => {
  await A.coter('V1.1', '2');
  await A.focusBtn('V1.1', '2');
  await A.page.keyboard.press('Backspace');
  eq(await attendre('V1.1 effacee', async () => (await A.cot('V1.1')) === null), true, 'V1.1 apres Backspace');
  await A.coter('T0.1', 'NA');
  await A.focusBtn('T0.1', 'NA');
  await A.page.keyboard.press('Delete');
  await attendre('T0.1 effacee', async () => (await A.cot('T0.1')) === null);
  await A.coter('T0.2', '3');
  await A.page.focus('textarea[data-obs="T0.2"]');
  await A.page.keyboard.type('abc');
  await A.page.keyboard.press('Backspace');
  eq(await A.page.inputValue('textarea[data-obs="T0.2"]'), 'ab', 'textarea apres Backspace');
  eq(await A.cot('T0.2'), 3, 'T0.2 inchangee par Backspace dans le textarea');
  const aria = await A.page.$$eval('[data-item="V1.1"] button[aria-pressed="true"]', (b) => b.length);
  eq(aria, 0, 'aria-pressed restant sur V1.1');
});

check('D1 data-etat : vide / cote (0 a 3, y compris 0) / na, mis a jour a chaque changement et apres rechargement', async (A) => {
  const attendu = async (label) => {
    const st = await A.st();
    const e = await A.etats();
    eq(e.length, ITEMS.length, label + ' : nombre d\'items');
    e.forEach(([code, etat]) => {
      const v = st.cotations[code];
      const exp = v === null || v === undefined ? 'vide' : (v === 'NA' ? 'na' : 'cote');
      assert(etat === exp, label + ' : ' + code + ' data-etat=' + JSON.stringify(etat) + ', attendu ' + exp);
    });
  };
  await attendu('initial');
  await A.coter('T0.1', '0'); await attendu('T0.1=0');
  await A.coter('T0.2', 'NA'); await attendu('T0.2=NA');
  await A.coter('V1.1', '3'); await attendu('V1.1=3');
  await A.coter('V1.1', '2'); await attendu('V1.1 remplace');
  await A.coter('V1.1', '2'); await attendu('V1.1 efface');
  await A.recharger(); await attendu('apres rechargement');
});

check('D1 #btn-prochain-non-cote : focus sur le premier item non cote de l\'etape, sans rien ecrire, message quand tout est cote', async (A) => {
  await A.go('t0');
  assert(await A.visible('#btn-prochain-non-cote'), 'bouton invisible en t0');
  await A.coter('T0.1', '1'); await A.coter('T0.3', 'NA');
  const avant = { brut: await A.sessionsBrut(), st: await A.st() };
  await A.clic('#btn-prochain-non-cote');
  const x = await attendre('focus sur T0.2', async () => { const a = await A.actif(); return a.item === 'T0.2' && a; });
  eq([x.tag, x.tabindex], ['BUTTON', '0'], 'element focalise');
  eq(await A.sessionsBrut(), avant.brut, 'localStorage apres le clic');
  eq(await A.st(), avant.st, 'session apres le clic');
  await A.coter('T0.2', '3'); await A.coter('T0.4', '0'); await A.coter('T0.5', 'NA');
  await A.razAnnonces();
  await A.clic('#btn-prochain-non-cote');
  await attendre('message tout cote', async () => (await A.annonces()).some((t) => /Tous les items de cette étape sont cotés/.test(nz(t))));
  /* T1 : portee limitee a l'etape (les items T0 sont cotes, pas ceux de T1) */
  await A.go('t1');
  assert(await A.visible('#btn-prochain-non-cote'), 'bouton invisible en t1');
  await A.clic('#btn-prochain-non-cote');
  const y = await attendre('focus sur V1.1', async () => { const a = await A.actif(); return a.item === 'V1.1' && a; });
  eq(y.tabindex, '0', 'tabindex du bouton focalise en t1');
  for (const c of T1) { if (c !== 'V3.2') await A.coter(c, '1'); }
  await A.clic('#btn-prochain-non-cote');
  await attendre('focus sur V3.2', async () => (await A.actif()).item === 'V3.2');
  await A.coter('V3.2', '0');
  await A.razAnnonces();
  await A.clic('#btn-prochain-non-cote');
  await attendre('message tout cote en t1', async () => (await A.annonces()).some((t) => /Tous les items de cette étape sont cotés/.test(nz(t))));
  const st = await A.st();
  eq(st.cotations['V3.2'], 0, 'V3.2 (cotee 0) inchangee');
});

check('D1 focus : apres chaque changement d\'etape le h2 de l\'etape a le focus (tabindex -1) et la page remonte', async (A) => {
  const verifier = async (cle, label) => {
    const x = await attendre(label + ' : focus sur le h2', async () => A.page.evaluate((k) => {
      const a = document.activeElement;
      if (!a || a.tagName !== 'H2') return null;
      const s = a.closest('section[data-panel]');
      return { tabindex: a.getAttribute('tabindex'), panel: s ? s.getAttribute('data-panel') : null, cache: s ? s.hidden : null, k };
    }, cle));
    eq([x.tabindex, x.panel, x.cache], ['-1', cle, false], label + ' : h2 focalise');
    await attendre(label + ' : page en haut', async () => (await A.page.evaluate(() => window.scrollY)) < 2);
  };
  const bas = () => A.page.evaluate(() => window.scrollTo({ top: 100000, behavior: 'instant' }));
  await A.go('t1'); await verifier('t1', 'allerA(t1)');
  await bas(); await A.clic('button[data-step="t2"]'); await verifier('t2', 'bouton d\'etape t2');
  await bas(); await A.go('t1');
  await bas(); await A.clic('#btn-suivant'); await verifier('t2', '#btn-suivant');
  await bas(); await A.clic('#btn-precedent'); await verifier('t1', '#btn-precedent');
  await bas(); await A.clic('button[data-step="synthese"]'); await verifier('synthese', 'bouton d\'etape synthese');
  await A.go('session'); await verifier('session', 'allerA(session)');
});

/* ================================================================== */
/* D2. Annuler                                                         */
/* ================================================================== */

check('D2 annuler : Ctrl+Z (focus sur un bouton) et Cmd+Z (focus nulle part) restaurent l\'etat d\'avant la derniere modification', async (A) => {
  await A.coter('T0.1', '2');
  await A.page.keyboard.press('Control+z');
  await attendre('T0.1 annulee', async () => (await A.cot('T0.1')) === null);
  eq(await A.page.$$eval('[data-item="T0.1"] button[aria-pressed="true"]', (b) => b.length), 0, 'aria-pressed apres annulation');
  await A.coter('T0.1', '2');
  await A.coter('T0.1', '3');
  await A.defocus();
  await A.page.keyboard.press('Meta+z');
  await attendre('remplacement annule (Cmd+Z)', async () => (await A.cot('T0.1')) === 2);
  await A.page.keyboard.press('Control+z');
  await attendre('premiere cotation annulee', async () => (await A.cot('T0.1')) === null);
  await A.page.keyboard.press('Control+z');
  await sleep(80);
  eq(await A.cot('T0.1'), null, 'T0.1 apres un Ctrl+Z de trop');
});

check('D2 annuler : Ctrl+Z dans un textarea ne restaure rien', async (A) => {
  await A.coter('T0.2', '1');
  await A.page.focus('textarea[data-obs="T0.2"]');
  await A.page.keyboard.type('note');
  await A.page.keyboard.press('Control+z');
  await sleep(100);
  eq(await A.cot('T0.2'), 1, 'T0.2 apres Ctrl+Z dans le textarea');
});

check('D2 annuler : la pile garde 20 modifications (22 faites, 20 annulees, la 21e annulation est sans effet)', async (A) => {
  const seq = ITEMS.map((c) => [c, '1']).concat([['T0.1', '2'], ['T0.2', '2'], ['T0.3', '2']]);
  for (const [c, v] of seq) await A.coter(c, v);
  const lire = async () => { const st = await A.st(); const o = {}; ITEMS.forEach((c) => { if (st.cotations[c] !== null) o[c] = st.cotations[c]; }); return o; };
  assert((await A.cot('T0.3')) === 2, 'les 22 modifications n\'ont pas toutes ete faites');
  for (let i = 0; i < 20; i++) await A.page.keyboard.press('Control+z');
  await attendre('etat apres 20 annulations', async () => canon(await lire()) === canon({ 'T0.1': 1, 'T0.2': 1 }));
  await A.page.keyboard.press('Control+z');
  await sleep(120);
  eq(await lire(), { 'T0.1': 1, 'T0.2': 1 }, 'etat apres la 21e annulation (pile limitee a 20)');
});

check('D2 annuler : Ctrl+Z restaure aussi une case de rupture et un choix T2, dans l\'ordre inverse', async (A) => {
  await A.coter('T0.1', '1');
  await A.go('t1'); await A.clic('input[type="checkbox"][data-rupture="surprise"]');
  await A.go('t2'); await A.clic('input[name="t2-tonus"][value="1"]');
  let st = await A.st();
  eq([st.rupture.surprise, st.t2.tonus.evolution], [true, 1], 'etat avant annulation');
  await A.defocus();
  await A.page.keyboard.press('Control+z');
  await attendre('T2 annule', async () => (await A.st()).t2.tonus.evolution === null);
  st = await A.st();
  eq([st.rupture.surprise, st.cotations['T0.1']], [true, 1], 'rupture et T0.1 apres la 1re annulation');
  await A.page.keyboard.press('Control+z');
  await attendre('rupture annulee', async () => (await A.st()).rupture.surprise === false);
  await A.page.keyboard.press('Control+z');
  await attendre('T0.1 annulee', async () => (await A.cot('T0.1')) === null);
});

check('D2 toast : #btn-annuler apres un effacement ou un remplacement (pas apres une premiere cotation), 6 s, clic = Ctrl+Z', async (A) => {
  const bouton = () => A.page.locator('#toast #btn-annuler').first().isVisible();
  await A.coter('T0.1', '2');
  await sleep(250);
  eq(await bouton(), false, '#btn-annuler visible apres une premiere cotation');
  await A.coter('T0.1', '3');
  await attendre('#btn-annuler apres un remplacement', bouton);
  await A.page.clock.fastForward(5000);
  eq(await bouton(), true, '#btn-annuler encore visible apres 5 s');
  await A.page.clock.fastForward(1600);
  await attendre('toast disparu apres 6 s', async () => !(await bouton()));
  /* effacement par second clic puis annulation par le bouton */
  await A.coter('T0.1', '3');
  await attendre('#btn-annuler apres un effacement', bouton);
  eq(await A.cot('T0.1'), null, 'T0.1 apres le second clic');
  await A.clic('#toast #btn-annuler');
  await attendre('effacement annule', async () => (await A.cot('T0.1')) === 3);
  /* remplacement annule par le bouton */
  await A.coter('T0.1', '1');
  await attendre('#btn-annuler apres un second remplacement', bouton);
  await A.clic('#toast #btn-annuler');
  await attendre('remplacement annule', async () => (await A.cot('T0.1')) === 3);
  /* effacement au clavier */
  await A.focusBtn('T0.1', '3');
  await A.page.keyboard.press('Backspace');
  await attendre('#btn-annuler apres Backspace', bouton);
  await A.clic('#toast #btn-annuler');
  await attendre('Backspace annule', async () => (await A.cot('T0.1')) === 3);
}, CLOCK);

check('D2 tactile : re-toucher le bouton choisi dans les 400 ms ne l\'efface pas (pointer:coarse)', async (A) => {
  const coarse = await A.page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  if (!coarse) ignorer('pointer:coarse non emule par Chromium avec hasTouch/isMobile : comportement tactile non verifiable');
  await A.go('t0');
  const pos = (s) => A.page.evaluate((q) => {
    const b = document.querySelector(q);
    if (!b) throw new Error('bouton introuvable : ' + q);
    b.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = b.getBoundingClientRect(); const x = r.left + r.width / 2; const y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, ok: top === b || b.contains(top) };
  }, s);
  const tap = (p) => A.page.touchscreen.tap(p.x, p.y);
  const p2 = await pos(sel('T0.1', '2'));
  assert(p2.ok, 'bouton 2 de T0.1 masque au point de contact');
  await tap(p2); await tap(p2);
  await sleep(120);
  eq(await A.cot('T0.1'), 2, 'T0.1 apres deux touches rapprochees');
  await sleep(600);
  await tap(p2);
  await attendre('re-touche apres 400 ms', async () => (await A.cot('T0.1')) === null);
  /* changer de valeur reste possible tout de suite */
  const p1 = await pos(sel('T0.2', '1')); const p3 = await pos(sel('T0.2', '3'));
  assert(p1.ok && p3.ok, 'boutons de T0.2 masques');
  await tap(p1);
  const p1b = await pos(sel('T0.2', '1')); const p3b = await pos(sel('T0.2', '3'));
  await tap(p3b);
  await attendre('changement de valeur immediat', async () => (await A.cot('T0.2')) === 3);
  eq([p1b.ok, p3b.ok], [true, true], 'boutons visibles');
}, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

/* ================================================================== */
/* D3. Minuteur de phase                                               */
/* ================================================================== */

const PHASES = [['t0', '10:00'], ['rupture', '02:00'], ['t2', '10:00'], ['libre', '00:00']];

function attendreSec(A, min, max, label) {
  return attendre(label + ' (entre ' + min + ' et ' + max + ' s)', async () => {
    const m = await A.minuteur(); const s = secondes(m.valeur);
    return s >= min && s <= max && m;
  }, 3500);
}
const attendreEtat = (A, etat) => attendre('data-etat="' + etat + '"', async () => (await A.minuteur()).etat === etat, 3000);

check('D3 minuteur : #minuteur role=timer, select de phases et valeur initiale par phase (10:00, 02:00, 10:00, 00:00)', async (A) => {
  const m0 = await A.minuteur();
  eq([m0.role, m0.etat], ['timer', 'arret'], 'role et data-etat initiaux');
  eq(await A.page.$eval('#minuteur-phase', (e) => e.tagName), 'SELECT', '#minuteur-phase');
  eq(await A.page.$$eval('#minuteur-phase option', (o) => o.map((x) => x.value).sort()), ['libre', 'rupture', 't0', 't2'], 'valeurs du select');
  for (const [ph, v] of PHASES) {
    await A.page.selectOption('#minuteur-phase', ph);
    await attendre('valeur ' + v + ' pour la phase ' + ph, async () => (await A.minuteur()).valeur === v);
    eq((await A.minuteur()).etat, 'arret', 'data-etat apres le choix de ' + ph);
  }
});

check('D3 minuteur : demarrer, decompte reel, pause, reprise, remise a zero (data-etat arret/marche/pause)', async (A) => {
  await A.page.selectOption('#minuteur-phase', 't0');
  await A.clic('#btn-minuteur-demarrer');
  await attendreEtat(A, 'marche');
  await A.page.clock.fastForward(3000);
  await attendreSec(A, 594, 597, 'decompte apres 3 s');
  await A.clic('#btn-minuteur-pause');
  await attendreEtat(A, 'pause');
  const v1 = (await A.minuteur()).valeur;
  await A.page.clock.fastForward(5000);
  await sleep(400);
  eq((await A.minuteur()).valeur, v1, 'valeur figee pendant la pause');
  await A.clic('#btn-minuteur-demarrer');
  await attendreEtat(A, 'marche');
  await A.page.clock.fastForward(4000);
  const s1 = secondes(v1);
  await attendreSec(A, s1 - 7, s1 - 3, 'reprise apres la pause');
  await A.clic('#btn-minuteur-raz');
  await attendreEtat(A, 'arret');
  eq((await A.minuteur()).valeur, '10:00', 'valeur apres remise a zero');
  eq((await A.minuteur()).phase, 't0', 'phase conservee apres remise a zero');
  await A.clic('#btn-minuteur-demarrer'); await attendreEtat(A, 'marche');
  await A.clic('#btn-minuteur-pause'); await attendreEtat(A, 'pause');
  await A.clic('#btn-minuteur-raz'); await attendreEtat(A, 'arret');
  eq((await A.minuteur()).valeur, '10:00', 'valeur apres remise a zero depuis la pause');
}, CLOCK);

check('D3 minuteur : phase libre = chronometre qui monte depuis 00:00', async (A) => {
  await A.page.selectOption('#minuteur-phase', 'libre');
  await A.clic('#btn-minuteur-demarrer');
  await attendreEtat(A, 'marche');
  await A.page.clock.fastForward(65000);
  await attendreSec(A, 65, 69, 'chronometre apres 65 s');
  await sleep(300);
  eq((await A.minuteur()).etat, 'marche', 'un chronometre ne se termine pas');
  await A.clic('#btn-minuteur-raz');
  await attendre('chronometre remis a 00:00', async () => (await A.minuteur()).valeur === '00:00');
}, CLOCK);

check('D3 minuteur : fin du compte a rebours (termine, 00:00, "Phase terminee" dans #annonce, ni navigation ni cotation)', async (A) => {
  await A.go('t1');
  await A.page.selectOption('#minuteur-phase', 'rupture');
  await A.razAnnonces();
  await A.clic('#btn-minuteur-demarrer');
  await attendreEtat(A, 'marche');
  await A.page.clock.fastForward(125000);
  await attendreEtat(A, 'termine');
  eq((await A.minuteur()).valeur, '00:00', 'valeur a la fin');
  await attendre('"Phase terminée" annonce', async () => (await A.annonces()).some((t) => /Phase terminée/.test(nz(t))));
  await A.page.clock.fastForward(20000);
  await sleep(300);
  const m = await A.minuteur();
  eq([m.etat, m.valeur], ['termine', '00:00'], 'etat stable apres la fin');
  eq(await A.etapesCourantes(), ['t1'], 'etape courante (aucune navigation automatique)');
  const st = await A.st();
  eq(ITEMS.filter((c) => st.cotations[c] !== null), [], 'cotations ecrites par le minuteur');
  await A.clic('#btn-minuteur-raz');
  await attendreEtat(A, 'arret');
  eq((await A.minuteur()).valeur, '02:00', 'valeur apres remise a zero de la phase rupture');
}, CLOCK);

check('D3 minuteur : fiabilite, saut d\'horloge (page endormie) et retour d\'onglet recalculent depuis l\'horodatage absolu', async (A) => {
  await A.page.selectOption('#minuteur-phase', 't0');
  await A.clic('#btn-minuteur-demarrer');
  await attendreEtat(A, 'marche');
  await A.page.clock.fastForward(120000);
  await attendreSec(A, 474, 481, 'valeur apres un saut de 2 minutes');
  await A.page.clock.fastForward(60000);
  await A.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await attendreSec(A, 414, 421, 'valeur apres un second saut et visibilitychange');
  eq((await A.minuteur()).etat, 'marche', 'data-etat');
}, CLOCK);

check('D3 minuteur : rechargement en marche (horodatage absolu dans sessionStorage, aucune nouvelle cle localStorage)', async (A) => {
  await A.go('t0');
  await A.page.selectOption('#minuteur-phase', 't0');
  const avant = await A.clesStockage();
  const t = Date.now();
  await A.clic('#btn-minuteur-demarrer');
  await attendreEtat(A, 'marche');
  const apres = await A.clesStockage();
  eq(apres.l, avant.l, 'cles localStorage apres le demarrage');
  assert(apres.s.indexOf(CLE_MINUTEUR) >= 0, 'cle sessionStorage ' + CLE_MINUTEUR + ' absente (cles : ' + apres.s.join(', ') + ')');
  const brut = await A.page.evaluate((k) => sessionStorage.getItem(k), CLE_MINUTEUR);
  const nombres = (String(brut).match(/\d{13}/g) || []).map(Number);
  assert(nombres.some((n) => Math.abs(n - t) < 4000), 'aucun horodatage absolu (Date.now) de debut dans ' + String(brut).slice(0, 120));
  await sleep(2300);
  await A.recharger();
  const m = await attendre('minuteur en marche apres rechargement', async () => { const x = await A.minuteur(); return x.etat === 'marche' && x; });
  const s = await attendre('affichage recalcule apres rechargement', async () => { const x = secondes((await A.minuteur()).valeur); return x <= 598 && x >= 560 && x; });
  assert(s < 600 && m, 'valeur non recalculee');
  const k2 = await A.clesStockage();
  eq(k2.l, avant.l, 'cles localStorage apres rechargement');
});

check('D3 minuteur : phase proposee par etape (t0, libre, t2) seulement si le minuteur n\'est pas en marche ; le choix reste manuel', async (A) => {
  const phase = async (attendue, label) => attendre(label, async () => (await A.minuteur()).phase === attendue, 2000);
  await A.go('t0'); await phase('t0', 'phase proposee a l\'entree de t0');
  await A.go('t1'); await phase('libre', 'phase proposee a l\'entree de t1');
  await A.go('t2'); await phase('t2', 'phase proposee a l\'entree de t2');
  await A.go('t1'); await phase('libre', 'phase proposee au retour en t1');
  /* choix manuel conserve */
  await A.page.selectOption('#minuteur-phase', 'rupture');
  await sleep(300);
  eq((await A.minuteur()).phase, 'rupture', 'choix manuel conserve dans la meme etape');
  /* en marche : pas de changement de phase a l'entree d'une etape */
  await A.clic('#btn-minuteur-demarrer');
  await attendreEtat(A, 'marche');
  await A.go('t2'); await sleep(400);
  let m = await A.minuteur();
  eq([m.phase, m.etat], ['rupture', 'marche'], 'phase et etat apres changement d\'etape en marche');
  await A.go('t0'); await sleep(300);
  eq((await A.minuteur()).phase, 'rupture', 'phase apres retour en t0 en marche');
  await A.clic('#btn-minuteur-raz');
  await attendreEtat(A, 'arret');
  await A.go('t1'); await phase('libre', 'phase proposee apres la remise a zero');
  m = await A.minuteur();
  eq(m.etat, 'arret', 'etat');
});

check('D3 minuteur : ne modifie jamais la session (aucune ecriture localStorage, aucune cotation, aucune navigation)', async (A) => {
  await A.go('t2');
  const avant = { brut: await A.sessionsBrut(), cles: await A.clesStockage(), st: await A.st() };
  await A.page.evaluate(() => { window.__ecritures = []; });
  await A.page.selectOption('#minuteur-phase', 'rupture');
  await A.clic('#btn-minuteur-demarrer'); await attendreEtat(A, 'marche');
  await A.page.clock.fastForward(60000);
  await A.clic('#btn-minuteur-pause'); await attendreEtat(A, 'pause');
  await A.clic('#btn-minuteur-demarrer'); await attendreEtat(A, 'marche');
  await A.page.clock.fastForward(70000);
  await attendreEtat(A, 'termine');
  await A.clic('#btn-minuteur-raz'); await attendreEtat(A, 'arret');
  await A.page.selectOption('#minuteur-phase', 'libre');
  await A.clic('#btn-minuteur-demarrer'); await attendreEtat(A, 'marche');
  await A.page.clock.fastForward(30000);
  await A.clic('#btn-minuteur-raz'); await attendreEtat(A, 'arret');
  await sleep(200);
  eq(await A.ecritures(), [], 'ecritures localStorage pendant les operations du minuteur');
  eq(await A.sessionsBrut(), avant.brut, 'sessions stockees');
  eq((await A.clesStockage()).l, avant.cles.l, 'cles localStorage');
  eq(await A.st(), avant.st, 'session courante');
  eq(await A.etapesCourantes(), ['t2'], 'etape courante');
}, CLOCK);

check('D3 minuteur : boutons demarrer/pause/raz de 44 px de haut au moins', async (A) => {
  const mesure = () => A.page.evaluate(() => ['#btn-minuteur-demarrer', '#btn-minuteur-pause', '#btn-minuteur-raz'].map((s) => {
    const e = document.querySelector(s); if (!e) return [s, null];
    const r = e.getBoundingClientRect(); return [s, { h: Math.round(r.height * 10) / 10, w: Math.round(r.width * 10) / 10 }];
  }));
  const verifier = (liste, label) => liste.forEach(([s, r]) => {
    assert(r !== null, s + ' introuvable');
    assert(r.h === 0 || r.h >= 43.5, label + ' : ' + s + ' fait ' + r.h + ' px de haut');
  });
  let l = await mesure(); verifier(l, 'a l\'arret');
  assert(l[0][1].h >= 43.5, '#btn-minuteur-demarrer invisible a l\'arret');
  await A.clic('#btn-minuteur-demarrer'); await attendreEtat(A, 'marche');
  l = await mesure(); verifier(l, 'en marche');
  assert(l[1][1].h >= 43.5, '#btn-minuteur-pause invisible en marche');
  await A.clic('#btn-minuteur-pause'); await attendreEtat(A, 'pause');
  l = await mesure(); verifier(l, 'en pause');
});

check('D3 minuteur : absence de navigator.wakeLock sans effet (API supprimee, puis demarrage, pause, fin)', async (A) => {
  eq(await A.page.evaluate(() => 'wakeLock' in navigator), false, 'wakeLock supprime du navigateur de test');
  await A.page.selectOption('#minuteur-phase', 'rupture');
  await A.clic('#btn-minuteur-demarrer'); await attendreEtat(A, 'marche');
  await A.page.clock.fastForward(3000);
  await attendreSec(A, 114, 118, 'decompte sans wakeLock');
  await A.clic('#btn-minuteur-pause'); await attendreEtat(A, 'pause');
  await A.clic('#btn-minuteur-demarrer'); await attendreEtat(A, 'marche');
  await A.page.clock.fastForward(130000);
  await attendreEtat(A, 'termine');
}, { clock: true, wakeLock: 'absent' });

check('D3 minuteur : wakeLock demande au demarrage, relache a la pause et a la fin', async (A) => {
  const wl = () => A.page.evaluate(() => window.__wl.slice());
  await A.page.selectOption('#minuteur-phase', 'rupture');
  await A.clic('#btn-minuteur-demarrer'); await attendreEtat(A, 'marche');
  await attendre('wakeLock.request au demarrage', async () => (await wl()).filter((x) => x === 'request').length === 1);
  await A.clic('#btn-minuteur-pause'); await attendreEtat(A, 'pause');
  await attendre('wakeLock relache a la pause', async () => (await wl()).filter((x) => x === 'release').length === 1);
  await A.clic('#btn-minuteur-demarrer'); await attendreEtat(A, 'marche');
  await attendre('wakeLock redemande a la reprise', async () => (await wl()).filter((x) => x === 'request').length === 2);
  await A.page.clock.fastForward(130000);
  await attendreEtat(A, 'termine');
  await attendre('wakeLock relache a la fin', async () => (await wl()).filter((x) => x === 'release').length === 2);
}, { clock: true, wakeLock: 'espion' });

/* ================================================================== */
/* D4. Plusieurs fenetres (meme localStorage)                          */
/* ================================================================== */

let compteurFichier = 0;
async function importer(A, sessions, ids) {
  compteurFichier += 1;
  const f = path.join(TMP_DATA, 'import-' + compteurFichier + '.json');
  fs.writeFileSync(f, JSON.stringify({ schema: 'grille-haptique/1', exporte_le: '2026-11-12T10:00:00.000Z', sessions }));
  await A.page.setInputFiles('#in-import', f);
  await attendre('import de ' + ids.join(', '), async () => { const l = (await A.sessionsStockees()).map((s) => s.id); return ids.every((i) => l.indexOf(i) >= 0); }, 3000);
}
async function sessionPersistee(A) {
  await A.go('session');
  await A.page.fill('#f-code', 'TAB1');
  await attendre('session enregistree', async () => (await A.sessionsStockees()).some((s) => s.identification && s.identification.code_sujet === 'TAB1'));
}

check('D4 fenetres : scenario A/B (T0.1=2 dans A, T0.2=3 dans B apres evenement) -> les deux apres rechargement de A, bandeau affiche dans l\'autre fenetre', async (A) => {
  await sessionPersistee(A);
  const B = await A.ouvrirAutre();
  const idA = (await A.st()).id;
  eq((await B.st()).id, idA, 'session courante de la 2e fenetre (meme session attendue)');
  await B.go('t0');
  await A.coter('T0.1', '2');
  await sleep(250);
  eq(await A.visible('#bandeau-autre-onglet'), false, 'bandeau dans la fenetre qui a ecrit');
  await attendre('#bandeau-autre-onglet dans B', () => B.visible('#bandeau-autre-onglet'), 3500);
  assert(nz(await B.texte('#bandeau-autre-onglet')).indexOf(nz(TXT_AUTRE)) >= 0, 'texte du bandeau : ' + nz(await B.texte('#bandeau-autre-onglet')));
  await attendre('B redessine T0.1', async () => (await B.page.$$eval('[data-item="T0.1"] button[aria-pressed="true"]', (b) => b.map((x) => x.getAttribute('data-val')))).join() === '2');
  eq((await B.st()).cotations['T0.1'], 2, 'T0.1 dans B sans rechargement');
  await B.coter('T0.2', '3');
  await attendre('#bandeau-autre-onglet dans A', () => A.visible('#bandeau-autre-onglet'), 3500);
  await A.recharger();
  const st = await A.st();
  eq([st.cotations['T0.1'], st.cotations['T0.2']], [2, 3], 'T0.1 et T0.2 apres rechargement de A');
  eq((await A.sessionsStockees()).filter((s) => s.id === idA).length, 1, 'nombre d\'exemplaires de la session');
});

check('D4 fenetres : #bandeau-autre-onglet est masquable', async (A) => {
  await sessionPersistee(A);
  const B = await A.ouvrirAutre();
  await A.coter('T0.1', '2');
  await attendre('#bandeau-autre-onglet dans B', () => B.visible('#bandeau-autre-onglet'), 3500);
  const ctrl = '#bandeau-autre-onglet button, #bandeau-autre-onglet [role="button"], #bandeau-autre-onglet a, #bandeau-autre-onglet input[type="button"]';
  const nb = await B.page.locator(ctrl).count();
  await B.clic(nb > 0 ? ctrl : '#bandeau-autre-onglet');
  await attendre('bandeau non masquable : il reste visible apres un clic (' + (nb > 0 ? 'sur son controle' : 'aucun controle, clic sur le bandeau') + ')',
    async () => !(await B.visible('#bandeau-autre-onglet')));
});

check('D4 fenetres : une session inconnue de la fenetre est conservee a l\'ecriture suivante (relecture avant ecriture)', async (A) => {
  await sessionPersistee(A);
  await A.page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem('grilleHaptique.v1.sessions'));
    l.push({ schema: 'grille-haptique/1', id: 'ext-x', cree_le: '2026-01-01T08:00:00.000Z', modifie_le: '2026-01-01T09:00:00.000Z',
      identification: { code_sujet: 'EXT', session_no: 1, date: '2026-01-01' }, cotations: { 'T0.1': 1 } });
    localStorage.setItem('grilleHaptique.v1.sessions', JSON.stringify(l));
  });
  await A.coter('T0.1', '2');
  const id = (await A.st()).id;
  await attendre('ecriture de T0.1', async () => (await A.sessionsStockees()).some((s) => s.id === id && s.cotations['T0.1'] === 2));
  const l = await A.sessionsStockees();
  const ext = l.find((s) => s.id === 'ext-x');
  assert(ext, 'session inconnue ext-x perdue (sessions stockees : ' + l.map((s) => s.id).join(', ') + ')');
  eq(ext.cotations['T0.1'], 1, 'contenu de ext-x');
});

check('D4 fenetres : fusion par id, la plus recente modifie_le l\'emporte (dans les deux sens)', async (A) => {
  await sessionPersistee(A);
  const mk = (id, diag) => ({ id, cree_le: '2026-05-01T08:00:00.000Z', modifie_le: '2026-05-01T09:00:00.000Z',
    identification: { code_sujet: 'FUS', session_no: 1, date: '2026-05-01', diagnostic: diag } });
  await importer(A, [mk('tab-y', 'memoire'), mk('tab-z', 'memoire')], ['tab-y', 'tab-z']);
  await A.page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem('grilleHaptique.v1.sessions'));
    l.forEach((s) => {
      if (s.id === 'tab-y') { s.modifie_le = '2099-01-01T00:00:00.000Z'; s.identification.diagnostic = 'autre fenetre'; }
      if (s.id === 'tab-z') { s.modifie_le = '2000-01-01T00:00:00.000Z'; s.identification.diagnostic = 'ancienne'; }
    });
    localStorage.setItem('grilleHaptique.v1.sessions', JSON.stringify(l));
  });
  await A.coter('T0.1', '2');
  const id = (await A.st()).id;
  await attendre('ecriture de T0.1', async () => (await A.sessionsStockees()).some((s) => s.id === id && s.cotations['T0.1'] === 2));
  const l = await A.sessionsStockees();
  const diag = (i) => { const s = l.find((x) => x.id === i); return s ? s.identification.diagnostic : '(absente)'; };
  eq(diag('tab-y'), 'autre fenetre', 'version stockee plus recente (2099) conservee');
  eq(diag('tab-z'), 'memoire', 'version de la fenetre plus recente que la version stockee (2000)');
});

/* ================================================================== */
/* D5. Echec d'ecriture                                                */
/* ================================================================== */

const beforeunloadEmpeche = (A) => A.page.evaluate(() => {
  const ev = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(ev);
  return ev.defaultPrevented;
});
const REGEX_ENREG = /Enregistré à \d{1,2}:\d{2}/;

check('D5 echec d\'ecriture : bandeau (texte B7), sauvegarde immediate JSON, beforeunload ; retour a la normale a la saisie suivante', async (A) => {
  eq(await beforeunloadEmpeche(A), false, 'beforeunload avant tout echec');
  eq(await A.visible('#btn-sauvegarder-maintenant'), false, '#btn-sauvegarder-maintenant avant tout echec');
  await A.coter('T0.1', '2');
  await attendre('Enregistre a hh:mm', async () => REGEX_ENREG.test(nz(await A.texte('#etat-enregistrement'))));
  assert(nz(await A.corps()).indexOf(nz(TXT_ECHEC)) < 0, 'bandeau d\'echec affiche sans echec');
  await A.page.evaluate(() => { window.__echec = true; });
  await A.coter('T0.2', '3');
  await attendre('bandeau d\'echec (texte B7)', async () => nz(await A.corps()).indexOf(nz(TXT_ECHEC)) >= 0);
  await attendre('#btn-sauvegarder-maintenant visible', () => A.visible('#btn-sauvegarder-maintenant'));
  eq(await beforeunloadEmpeche(A), true, 'beforeunload empeche pendant l\'echec');
  const dl = await A.telecharger('#btn-sauvegarder-maintenant');
  assert(/\.json$/i.test(dl.name), 'nom du fichier telecharge : ' + dl.name);
  const j = JSON.parse(dl.texte);
  const st = await A.st();
  eq([j.id, j.cotations['T0.1'], j.cotations['T0.2']], [st.id, 2, 3], 'session exportee (id, T0.1, T0.2)');
  await A.go('synthese');
  const ex = JSON.parse((await A.telecharger('#btn-export-json-synthese')).texte);
  eq([j.id, j.cotations, j.identification], [ex.id, ex.cotations, ex.identification], 'identique a #btn-export-json');
  /* retour a la normale */
  await A.page.evaluate(() => { window.__echec = false; });
  await A.coter('T0.3', '1');
  await attendre('bandeau disparu', async () => nz(await A.corps()).indexOf(nz(TXT_ECHEC)) < 0);
  await attendre('Enregistre a hh:mm apres reprise', async () => REGEX_ENREG.test(nz(await A.texte('#etat-enregistrement'))));
  eq(await A.visible('#btn-sauvegarder-maintenant'), false, '#btn-sauvegarder-maintenant apres reprise');
  eq(await beforeunloadEmpeche(A), false, 'beforeunload apres reprise');
  const stocke = (await A.sessionsStockees()).find((s) => s.id === st.id);
  eq([stocke.cotations['T0.1'], stocke.cotations['T0.2'], stocke.cotations['T0.3']], [2, 3, 1], 'session stockee apres la reprise');
  /* le drapeau d'echec n'est pas definitif : un nouvel echec reaffiche tout */
  await A.page.evaluate(() => { window.__echec = true; });
  await A.coter('T0.4', '1');
  await attendre('bandeau a nouveau', async () => nz(await A.corps()).indexOf(nz(TXT_ECHEC)) >= 0);
  eq(await beforeunloadEmpeche(A), true, 'beforeunload au second echec');
}, { tolererConsole: true });

check('D5 echec d\'ecriture : stockage en echec des le chargement, reprise a la saisie suivante', async (A) => {
  await A.coter('T0.1', '1');
  await attendre('bandeau d\'echec (texte B7)', async () => nz(await A.corps()).indexOf(nz(TXT_ECHEC)) >= 0);
  await attendre('#btn-sauvegarder-maintenant visible', () => A.visible('#btn-sauvegarder-maintenant'));
  eq(await beforeunloadEmpeche(A), true, 'beforeunload pendant l\'echec');
  await A.page.evaluate(() => { window.__echec = false; });
  await A.coter('T0.2', '2');
  await attendre('bandeau disparu', async () => nz(await A.corps()).indexOf(nz(TXT_ECHEC)) < 0);
  await attendre('Enregistre a hh:mm', async () => REGEX_ENREG.test(nz(await A.texte('#etat-enregistrement'))));
  eq(await beforeunloadEmpeche(A), false, 'beforeunload apres reprise');
  const id = (await A.st()).id;
  const s = (await A.sessionsStockees()).find((x) => x.id === id);
  assert(s, 'session courante absente du stockage apres la reprise');
  eq([s.cotations['T0.1'], s.cotations['T0.2']], [1, 2], 'cotations stockees (la saisie en echec est reprise)');
}, { echec: true, tolererConsole: true });

/* ================================================================== */
/* D6. Affichage et accessibilite                                      */
/* ================================================================== */

check('D6 T1 : aucun element de score dans section[data-panel="t1"] meme apres des cotations', async (A) => {
  for (const c of ['V1.1', 'V1.2', 'V1.3', 'V2.1', 'V3.1']) await A.coter(c, '3');
  const r = await A.page.evaluate(() => {
    const s = document.querySelector('section[data-panel="t1"]');
    if (!s) return { absent: true };
    return {
      ids: [...s.querySelectorAll('[id^="score-"]')].map((e) => e.id),
      manquants: s.querySelectorAll('[data-manquants]').length,
      dataScore: s.querySelectorAll('[data-score]').length,
      texte: /Indice global|incomplet\s*:/i.test(s.textContent),
    };
  });
  assert(!r.absent, 'section[data-panel="t1"] introuvable');
  eq([r.ids, r.manquants, r.dataScore, r.texte], [[], 0, 0, false], 'elements de score dans t1 (ids, data-manquants, data-score, texte)');
});

check('D6 Synthese : #score-axe1..4 et #score-total toujours presents et corrects (inchanges)', async (A) => {
  for (const [c, v] of [['V1.1', '3'], ['V1.2', '2'], ['V1.3', '1'], ['V1.4', '1'], ['V2.1', '2']]) await A.coter(c, v);
  await A.go('synthese');
  const lire = (id) => A.page.evaluate((i) => {
    const e = document.querySelector('section[data-panel="synthese"] #' + i);
    return e ? { t: e.textContent.trim(), m: e.getAttribute('data-manquants') } : null;
  }, id);
  eq(await lire('score-axe1'), { t: '5', m: '0' }, '#score-axe1');
  eq(await lire('score-axe2'), { t: '2', m: '3' }, '#score-axe2');
  eq(await lire('score-axe3'), { t: '-', m: '3' }, '#score-axe3');
  eq(await lire('score-axe4'), { t: '-', m: '3' }, '#score-axe4');
  eq(await lire('score-total'), { t: '7', m: '9' }, '#score-total');
});

check('D6 #annonce : region aria-live="polite" masquee visuellement mais presente dans l\'arbre', async (A) => {
  const r = await A.page.evaluate(() => {
    const e = document.getElementById('annonce');
    if (!e) return null;
    const cs = getComputedStyle(e); const b = e.getBoundingClientRect();
    return { live: e.getAttribute('aria-live'), display: cs.display, visibility: cs.visibility, hidden: e.hidden || !!e.closest('[hidden]'),
      w: b.width, h: b.height, x: b.x, y: b.y, clip: cs.clip, clipPath: cs.clipPath, vw: innerWidth, vh: innerHeight };
  });
  assert(r, '#annonce introuvable');
  eq(r.live, 'polite', 'aria-live');
  assert(r.display !== 'none' && r.visibility !== 'hidden' && !r.hidden, '#annonce retire de l\'arbre d\'accessibilite (display/visibility/hidden)');
  const minuscule = r.w <= 2 && r.h <= 2;
  const horsEcran = r.x + r.w <= 1 || r.y + r.h <= 1 || r.x >= r.vw || r.y >= r.vh;
  const rogne = (r.clip && r.clip !== 'auto') || (r.clipPath && r.clipPath !== 'none');
  assert(minuscule || horsEcran || rogne, '#annonce visible a l\'ecran (' + Math.round(r.w) + 'x' + Math.round(r.h) + ')');
});

check('D6 #annonce : "V1.2 coté 3" a la cotation, "V1.2 effacé" a l\'effacement', async (A) => {
  await A.go('t1');
  await A.razAnnonces();
  await A.clic(sel('V1.2', '3'));
  await attendre('annonce de la cotation', async () => (await A.annonces()).some((t) => nz(t).indexOf('V1.2 coté 3') >= 0));
  await A.razAnnonces();
  await A.clic(sel('V1.2', '3'));
  await attendre('annonce de l\'effacement', async () => (await A.annonces()).some((t) => nz(t).indexOf('V1.2 effacé') >= 0));
  eq(await A.cot('V1.2'), null, 'V1.2 effacee');
  /* au clavier aussi */
  await A.razAnnonces();
  await A.focusBtn('V1.3', '0');
  await A.touche({ key: 'é', code: 'Digit2' });
  await attendre('annonce de la cotation au clavier', async () => (await A.annonces()).some((t) => nz(t).indexOf('V1.3 coté 2') >= 0));
});

check('D6 #annonce : "T1 : 9 sur 14" quand le neuvieme item de T1 est renseigne (NA compte)', async (A) => {
  await A.go('t1');
  for (const c of T1.slice(0, 8)) await A.coter(c, c === 'V1.4' ? 'NA' : '1');
  await A.razAnnonces();
  await A.coter('V3.1', '2');
  await attendre('annonce de la progression', async () => (await A.annonces()).some((t) => /T1 : 9 sur 14/.test(nz(t))), 3000);
});

/* ================================================================== */
/* D7. En-tete et gabarit                                              */
/* ================================================================== */

function MESURE_ENTETE() {
  const ids = ['resume-session', 'minuteur', 'etat-enregistrement', 'btn-participants', 'btn-sessions'];
  const els = ids.map((i) => document.getElementById(i));
  const manque = ids.filter((i, k) => !els[k]);
  if (manque.length) return { manque };
  let lca = els[0];
  while (lca && !els.every((e) => lca.contains(e))) lca = lca.parentElement;
  if (!lca || lca === document.body || lca === document.documentElement) return { sansConteneur: true };
  let fixe = null;
  for (let n = lca; n && n !== document.documentElement; n = n.parentElement) {
    const p = getComputedStyle(n).position;
    if (p === 'fixed' || p === 'sticky') { fixe = n; break; }
  }
  const r = lca.getBoundingClientRect();
  return {
    h: r.height, fixe: !!fixe, haut: fixe ? fixe.getBoundingClientRect().top : null,
    visibles: els.map((e, k) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.left >= -1 && b.right <= innerWidth + 1 ? null : ids[k]; }).filter(Boolean),
  };
}

function OBSTACLES() {
  const out = [];
  const ajouter = (el, nom) => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const p = getComputedStyle(n).position;
      if (p === 'fixed' || p === 'sticky') { const r = n.getBoundingClientRect(); out.push({ nom, top: r.top, bottom: r.bottom }); return; }
    }
  };
  const e = document.getElementById('minuteur') || document.getElementById('resume-session');
  if (e) ajouter(e, 'entete');
  const b = document.querySelector('button[data-step]');
  if (b) ajouter(b, 'barre');
  return { obs: out, vh: innerHeight };
}

function MESURE_FOCUS() {
  const a = document.activeElement;
  if (!a || !a.closest || !a.closest('[data-item]')) return { pasItem: true, tag: a ? a.tagName : null };
  const r = a.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom };
}

async function stabiliser(A) {
  let prec = null;
  const fin = Date.now() + 1500;
  while (Date.now() < fin) {
    const y = await A.page.evaluate(() => window.scrollY);
    if (y === prec) return;
    prec = y; await sleep(90);
  }
}

async function mesurerFocus(A, label) {
  await stabiliser(A);
  const m = await A.page.evaluate(MESURE_FOCUS);
  assert(!m.pasItem, label + ' : le focus n\'est pas sur un controle d\'item (' + m.tag + ')');
  const o = await A.page.evaluate(OBSTACLES);
  let hautMin = 0; let basMax = o.vh;
  o.obs.forEach((x) => {
    if (x.top <= 1 && x.bottom > 0) hautMin = Math.max(hautMin, x.bottom);
    if (x.bottom >= o.vh - 1 && x.top < o.vh) basMax = Math.min(basMax, x.top);
  });
  const r1 = (n) => Math.round(n);
  assert(m.top >= hautMin - 0.5, label + ' : controle masque par une barre fixe du haut (haut du controle ' + r1(m.top) + ' px, bas de la barre ' + r1(hautMin) + ' px)');
  assert(m.bottom <= basMax + 0.5, label + ' : controle masque par une barre fixe du bas (bas du controle ' + r1(m.bottom) + ' px, haut de la barre ' + r1(basMax) + ' px)');
}

async function verifierFocusItems(A) {
  await A.go('t1');
  const defiler = (y) => A.page.evaluate((t) => window.scrollTo({ top: t, behavior: 'instant' }), y);
  /* (a) focus depuis un defilement lointain, en alternant haut et bas de page */
  for (let i = 0; i < T1.length; i++) {
    await A.defocus(); await defiler(i % 2 ? 1000000 : 0); await stabiliser(A);
    await A.focusBtn(T1[i], '0');
    await mesurerFocus(A, 'focus() de ' + T1[i] + ' depuis ' + (i % 2 ? 'le bas' : 'le haut'));
  }
  /* (b) le controle a moitie sous la barre du haut, puis a moitie sous la barre du bas */
  for (const code of ['V1.4', 'V2.3', 'V3.2', 'V4.3']) {
    for (const cote of ['haut', 'bas']) {
      const o = await A.page.evaluate(OBSTACLES);
      let hb = 0; let bb = o.vh;
      o.obs.forEach((x) => { if (x.top <= 1) hb = Math.max(hb, x.bottom); if (x.bottom >= o.vh - 1) bb = Math.min(bb, x.top); });
      const y = await A.page.evaluate((a) => {
        const b = document.querySelector(a.s); const r = b.getBoundingClientRect();
        return a.cote === 'haut' ? r.top + scrollY - (a.hb - 8) : r.bottom + scrollY - (a.bb + 8);
      }, { s: sel(code, '0'), cote, hb, bb });
      await A.defocus(); await defiler(Math.max(0, y)); await stabiliser(A);
      await A.focusBtn(code, '0');
      await mesurerFocus(A, 'focus() de ' + code + ' a moitie sous la barre du ' + cote);
    }
  }
  /* (c) parcours aux fleches */
  await defiler(0); await stabiliser(A);
  await A.focusBtn('V1.1', '0');
  for (let i = 1; i < T1.length; i++) {
    await A.page.keyboard.press('ArrowDown');
    await attendre('focus sur ' + T1[i], async () => (await A.actif()).item === T1[i]);
    await mesurerFocus(A, 'fleche bas vers ' + T1[i]);
  }
  for (let i = T1.length - 2; i >= 0; i--) {
    await A.page.keyboard.press('ArrowUp');
    await attendre('focus sur ' + T1[i], async () => (await A.actif()).item === T1[i]);
    await mesurerFocus(A, 'fleche haut vers ' + T1[i]);
  }
  /* (d) bouton "prochain non cote" */
  for (const c of T1.slice(0, 9)) await A.coter(c, '1');
  await defiler(0); await stabiliser(A);
  await A.clic('#btn-prochain-non-cote');
  await attendre('focus sur V3.2', async () => (await A.actif()).item === 'V3.2');
  await mesurerFocus(A, '#btn-prochain-non-cote vers V3.2');
}

check('D7 en-tete fixe sur une ligne : hauteur <= 72 px a 1280 x 800, tous ses elements visibles', async (A) => {
  const m = await A.page.evaluate(MESURE_ENTETE);
  assert(!m.manque, 'elements d\'en-tete introuvables : ' + (m.manque || []).join(', '));
  assert(!m.sansConteneur, 'les elements d\'en-tete n\'ont pas de conteneur commun (en-tete)');
  assert(m.fixe, 'en-tete ni fixed ni sticky');
  assert(m.h <= 72, 'hauteur de l\'en-tete ' + Math.round(m.h) + ' px (max 72)');
  eq(m.visibles, [], 'elements d\'en-tete invisibles ou hors de l\'ecran');
  await A.go('t1');
  await A.page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
  await stabiliser(A);
  const m2 = await A.page.evaluate(MESURE_ENTETE);
  assert(Math.abs(m2.haut) <= 1, 'en-tete decolle du haut apres defilement (top = ' + m2.haut + ')');
}, { viewport: { width: 1280, height: 800 } });

check('D7 en-tete fixe : hauteur <= 104 px a 390 x 844, tous ses elements visibles', async (A) => {
  const m = await A.page.evaluate(MESURE_ENTETE);
  assert(!m.manque, 'elements d\'en-tete introuvables : ' + (m.manque || []).join(', '));
  assert(!m.sansConteneur, 'les elements d\'en-tete n\'ont pas de conteneur commun (en-tete)');
  assert(m.fixe, 'en-tete ni fixed ni sticky');
  assert(m.h <= 104, 'hauteur de l\'en-tete ' + Math.round(m.h) + ' px (max 104)');
  eq(m.visibles, [], 'elements d\'en-tete invisibles ou hors de l\'ecran');
  await A.go('t1');
  await A.page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
  await stabiliser(A);
  const m2 = await A.page.evaluate(MESURE_ENTETE);
  assert(Math.abs(m2.haut) <= 1, 'en-tete decolle du haut apres defilement (top = ' + m2.haut + ')');
}, MOBILE);

check('D7 sous 720 px la barre button[data-step] est fixee en bas de l\'ecran (390, 360 et 719 px de large)', async (A) => {
  for (const [w, h] of [[390, 844], [360, 740], [719, 800]]) {
    await A.page.setViewportSize({ width: w, height: h });
    await A.go('t1'); await sleep(120);
    const r = await A.page.evaluate(() => {
      const bs = [...document.querySelectorAll('button[data-step]')];
      if (!bs.length) return { aucun: true };
      const fixe = (b) => { for (let n = b; n && n !== document.documentElement; n = n.parentElement) { if (getComputedStyle(n).position === 'fixed') return n; } return null; };
      const f = fixe(bs[0]);
      const rects = bs.map((b) => b.getBoundingClientRect());
      return { n: bs.length, fixe: !!f, commun: !!f && bs.every((b) => f.contains(b)), bas: f ? f.getBoundingClientRect().bottom : null,
        vh: innerHeight, dedans: rects.every((r) => r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1) };
    });
    assert(!r.aucun, 'aucun button[data-step]');
    const L = w + ' px : ';
    eq(r.n, 6, L + 'nombre de boutons d\'etape');
    assert(r.fixe && r.commun, L + 'barre d\'etapes non fixee (position: fixed)');
    assert(Math.abs(r.bas - r.vh) <= 2, L + 'barre d\'etapes fixee mais pas au bas de l\'ecran (bas ' + Math.round(r.bas) + ' px pour ' + r.vh + ' px de haut)');
    assert(r.dedans, L + 'boutons d\'etape hors de l\'ecran');
  }
});

check('D7 sous 720 px : le bas de page n\'est pas cache par la barre fixe (#btn-suivant atteignable), le haut non plus', async (A) => {
  await A.go('t1');
  await A.page.evaluate(() => window.scrollTo({ top: 1000000, behavior: 'instant' }));
  await stabiliser(A);
  const r = await A.page.evaluate(() => {
    const e = document.getElementById('btn-suivant').getBoundingClientRect();
    const b = document.querySelector('button[data-step]');
    let f = null;
    for (let n = b; n && n !== document.documentElement; n = n.parentElement) { if (getComputedStyle(n).position === 'fixed') { f = n; break; } }
    return { bas: e.bottom, hautBarre: f ? f.getBoundingClientRect().top : innerHeight };
  });
  assert(r.bas <= r.hautBarre + 1, '#btn-suivant (bas ' + Math.round(r.bas) + ' px) sous la barre fixe (haut ' + Math.round(r.hautBarre) + ' px) en fin de page');
}, MOBILE);

check('D7 focus : un item auquel on donne le focus n\'est jamais masque par une barre fixe (390 x 844)', async (A) => { await verifierFocusItems(A); }, Object.assign({ delai: 90000 }, MOBILE));

check('D7 focus : un item auquel on donne le focus n\'est jamais masque par l\'en-tete fixe (1280 x 800)', async (A) => { await verifierFocusItems(A); }, { viewport: { width: 1280, height: 800 }, delai: 90000 });

for (const w of [360, 390, 1280]) {
  check('D7 pas de defilement horizontal de la page a ' + w + ' px, dans les six etapes', async (A) => {
    for (const e of ETAPES) {
      await A.go(e); await sleep(80);
      const r = await A.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
      assert(r.sw <= r.cw && r.bw <= r.cw, 'etape ' + e + ' : largeur de contenu ' + Math.max(r.sw, r.bw) + ' px pour une fenetre de ' + r.cw + ' px');
    }
  }, { viewport: { width: w, height: w === 1280 ? 800 : 780 } });
}

for (const [w, h] of [[1280, 800], [390, 844]]) {
  check('D7 boutons d\'en-tete et de navigation de 44 px de haut au moins a ' + w + ' px', async (A) => {
    await A.go('t1');
    const l = await A.page.evaluate(() => {
      const sels = ['#btn-participants', '#btn-sessions', 'button[data-step]', '#btn-suivant', '#btn-precedent'];
      const out = [];
      sels.forEach((s) => document.querySelectorAll(s).forEach((e, i) => { const r = e.getBoundingClientRect(); out.push({ s: s + (i ? '#' + i : ''), h: r.height, w: r.width, dedans: r.left >= -1 && r.right <= innerWidth + 1 }); }));
      return { out, n: sels.map((s) => document.querySelectorAll(s).length) };
    });
    eq(l.n, [1, 1, 6, 1, 1], 'nombre de boutons par selecteur');
    const petits = l.out.filter((x) => x.h < 43.5 || x.w < 20).map((x) => x.s + ' (' + Math.round(x.h) + ' px de haut)');
    eq(petits, [], 'boutons de moins de 44 px');
    eq(l.out.filter((x) => !x.dedans).map((x) => x.s), [], 'boutons hors de la fenetre');
  }, { viewport: { width: w, height: h } });
}

check('D7 boutons de cotation de 44 px de haut au moins a 390 px (cibles tactiles, B1)', async (A) => {
  await A.go('t1');
  const petits = await A.page.evaluate(() => [...document.querySelectorAll('section[data-panel="t1"] button[data-rate]')]
    .map((b) => [b.closest('[data-item]').getAttribute('data-item') + '/' + b.getAttribute('data-val'), b.getBoundingClientRect().height])
    .filter(([, h]) => h < 43.5).map(([n, h]) => n + ' (' + Math.round(h) + ' px)'));
  eq(petits, [], 'boutons de cotation de moins de 44 px');
  eq(await A.page.$$eval('section[data-panel="t1"] button[data-rate]', (b) => b.length), 70, 'nombre de boutons de cotation en T1');
}, MOBILE);

/* ================================================================== */
/* D8. Charte                                                          */
/* ================================================================== */

statique('D8 charte : poids du fichier inferieur a 358 400 octets', async () => {
  const n = fs.statSync(HTML).size;
  assert(n < 358400, 'poids ' + n + ' octets (limite 358 400, depassement de ' + (n - 358399) + ' octets)');
});

statique('D8 charte : aucune URL http:// ou https:// hors http://www.w3.org/, aucune ressource externe', async () => {
  const h = fs.readFileSync(HTML, 'utf8');
  const sans = h.split('http://www.w3.org/').join('');
  const trouves = [];
  sans.split('\n').forEach((l, i) => { const m = l.match(/https?:\/\/[^\s"'<>)]{0,60}/g); if (m) m.forEach((x) => trouves.push('ligne ' + (i + 1) + ' : ' + x)); });
  eq(trouves.slice(0, 5), [], 'URL absolues (' + trouves.length + ')');
  const ext = [];
  (h.match(/<(script|link|img|iframe|source|audio|video)\b[^>]*>/gi) || []).forEach((t) => {
    const m = t.match(/\s(?:src|href)\s*=\s*["']?([^"'\s>]+)/i);
    if (m && !/^(data:|#|about:blank)/i.test(m[1])) ext.push(t.slice(0, 80));
  });
  eq(ext, [], 'balises referencant une ressource externe');
});

statique('D8 charte : quatre @font-face, tous en data:font/woff2;base64', async () => {
  const h = fs.readFileSync(HTML, 'utf8');
  const blocs = h.match(/@font-face\s*\{[^}]*\}/g) || [];
  eq(blocs.length, 4, 'nombre de blocs @font-face');
  eq((h.match(/@font-face/g) || []).length, 4, 'occurrences de @font-face');
  const sansDonnees = blocs.filter((b) => !/url\(\s*["']?data:font\/woff2;base64,[A-Za-z0-9+/=]{200,}/.test(b)).map((b) => b.slice(0, 70));
  eq(sansDonnees, [], '@font-face sans data:font/woff2;base64');
  eq((h.match(/data:font\/woff2;base64,/g) || []).length, 4, 'occurrences de data:font/woff2;base64');
});

statique('D8 charte : aucun caractere invisible (U+00A0, U+200B a U+200F, U+202F, U+2060, U+FEFF) ni non-caractere U+FFFE / U+FFFF litteral', async () => {
  const h = fs.readFileSync(HTML, 'utf8');
  const plages = [[0xA0, 0xA0], [0x200B, 0x200F], [0x202F, 0x202F], [0x2060, 0x2060], [0xFEFF, 0xFEFF], [0xFFFE, 0xFFFF]];
  const re = { test: (c) => plages.some((p) => c.charCodeAt(0) >= p[0] && c.charCodeAt(0) <= p[1]) };
  const hits = [];
  h.split('\n').forEach((l, i) => {
    for (let k = 0; k < l.length; k++) {
      if (re.test(l[k])) hits.push('ligne ' + (i + 1) + ' col ' + (k + 1) + ' U+' + l.charCodeAt(k).toString(16).toUpperCase().padStart(4, '0'));
    }
  });
  eq(hits.slice(0, 8), [], 'caracteres invisibles (' + hits.length + ' au total)');
});

check('D8 charte : :root --marine = #2f2c62', async (A) => {
  const v = await A.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--marine').trim().toLowerCase());
  eq(v, '#2f2c62', '--marine');
});

check('D8 charte : IBM Plex Sans 15 px sur body (repli system-ui), polices incorporees chargees, titres d\'etape en Newsreader', async (A) => {
  await A.go('t1');
  const r = await A.page.evaluate(async () => {
    const faces = [...document.fonts];
    await Promise.all(faces.map((f) => f.load().catch(() => null)));
    const h2 = document.querySelector('section[data-panel="t1"] h2');
    return {
      body: getComputedStyle(document.body).fontFamily, taille: getComputedStyle(document.body).fontSize,
      faces: faces.map((f) => [f.family.replace(/["']/g, ''), String(f.weight)]).sort((a, b) => (a.join() < b.join() ? -1 : 1)),
      statuts: faces.map((f) => f.status),
      h2: h2 ? getComputedStyle(h2).fontFamily : null,
      verifie: document.fonts.check('15px "IBM Plex Sans"'),
    };
  });
  assert(/IBM Plex Sans/i.test(r.body), 'font-family de body : ' + r.body);
  assert(/system-ui/i.test(r.body), 'repli system-ui absent de body : ' + r.body);
  eq(r.taille, '15px', 'taille de police de body');
  eq(r.faces.map((f) => f[0]).sort(), ['IBM Plex Mono', 'IBM Plex Mono', 'IBM Plex Sans', 'Newsreader'], 'familles declarees');
  eq(r.faces.filter((f) => f[0] === 'IBM Plex Mono').map((f) => f[1]).sort(), ['500', '600'], 'graisses de IBM Plex Mono');
  eq(r.statuts, r.statuts.map(() => 'loaded'), 'statut des polices apres chargement');
  assert(r.verifie, 'document.fonts.check(IBM Plex Sans)');
  assert(r.h2 && /Newsreader/i.test(r.h2), 'titre d\'etape (h2) en Newsreader : ' + r.h2);
});

function JETONS(noms) {
  if (!noms) {
    const s = new Set();
    const visiter = (rules) => {
      for (const r of rules) {
        if (r.cssRules) visiter(r.cssRules);
        if (r.style) for (let i = 0; i < r.style.length; i++) { if (r.style[i].indexOf('--') === 0) s.add(r.style[i]); }
      }
    };
    for (const ss of document.styleSheets) { try { visiter(ss.cssRules); } catch (e) { /* feuille illisible */ } }
    return [...s].sort();
  }
  const cs = getComputedStyle(document.documentElement);
  const o = {};
  noms.forEach((n) => { o[n] = cs.getPropertyValue(n).trim().toLowerCase(); });
  return o;
}
function LUMINANCE_PAGE() {
  const lum = (c) => {
    const m = c.match(/[\d.]+/g).map(Number);
    if (m.length === 4 && m[3] === 0) return 1;
    const f = m.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  const cs = getComputedStyle(document.body);
  return { fond: lum(cs.backgroundColor), texte: lum(cs.color), fondCss: cs.backgroundColor };
}

check('D8 charte : en media print les jetons de couleur sont clairs meme en theme sombre emule (y compris --bil-*)', async (A) => {
  const noms = await A.page.evaluate(JETONS, null);
  assert(noms.indexOf('--marine') >= 0, 'jeton --marine non defini dans les feuilles de style');
  assert(noms.filter((n) => /^--bil-/.test(n)).length >= 10, 'jetons --bil-* (' + noms.filter((n) => /^--bil-/.test(n)).length + ') introuvables');
  const lire = async (media, scheme) => {
    await A.page.emulateMedia({ media, colorScheme: scheme });
    return A.page.evaluate(JETONS, noms);
  };
  const L = await lire('screen', 'light');
  const D = await lire('screen', 'dark');
  const PD = await lire('print', 'dark');
  const lumPD = await A.page.evaluate(LUMINANCE_PAGE);
  const PL = await lire('print', 'light');
  const couleur = (v) => /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\(.*|color\(.*)$/.test(v);
  const jetonsCouleur = noms.filter((n) => couleur(L[n]) || couleur(D[n]) || couleur(PL[n]) || couleur(PD[n]));
  assert(jetonsCouleur.length >= 20, 'trop peu de jetons de couleur (' + jetonsCouleur.length + ')');
  const sombres = jetonsCouleur.filter((n) => L[n] !== D[n]);
  assert(sombres.length > 0, 'aucun jeton ne change en theme sombre : theme sombre non defini, controle vide');
  const ecarts = jetonsCouleur.filter((n) => PD[n] !== PL[n]).map((n) => n + ' (sombre+print ' + PD[n] + ', clair+print ' + PL[n] + ')');
  eq(ecarts.slice(0, 6), [], 'jetons de couleur differents entre print sombre et print clair (' + ecarts.length + ' au total)');
  assert(lumPD.fond > 0.85, 'fond de body en print sombre pas clair : ' + lumPD.fondCss);
  assert(lumPD.texte < 0.35, 'texte de body en print sombre pas fonce (luminance ' + lumPD.texte.toFixed(2) + ')');
  await A.page.emulateMedia({ media: 'screen', colorScheme: 'light' });
});

/* ================================================================== */
/* Parcours complet de ces fonctions : aucune erreur console, aucune requete reseau */
/* ================================================================== */

check('Parcours complet : clavier, annuler, minuteur, deux fenetres, echec d\'ecriture, impression, mobile (aucune erreur console ni requete reseau)', async (A) => {
  await sessionPersistee(A);
  const B = await A.ouvrirAutre();
  await A.go('t0');
  for (const [k, c] of [['à', 'Digit0'], ['&', 'Digit1'], ['é', 'Digit2']]) {
    await A.focusBtn('T0.1', '0'); await A.touche({ key: k, code: c });
  }
  await A.focusBtn('T0.2', '0'); await A.touche({ key: 'n', code: 'KeyN' });
  await A.page.keyboard.press('ArrowDown'); await A.page.keyboard.press('ArrowRight'); await A.page.keyboard.press('ArrowLeft'); await A.page.keyboard.press('ArrowUp');
  await A.focusBtn('T0.2', 'NA'); await A.page.keyboard.press('Backspace');
  await A.page.keyboard.press('Control+z');
  await A.clic('#btn-prochain-non-cote');
  await A.coter('T0.3', '3'); await A.coter('T0.3', '1');
  await A.clic('#toast #btn-annuler').catch(() => {});
  await attendre('B informee', () => B.visible('#bandeau-autre-onglet'), 3500);
  await B.coter('T0.4', '2');
  for (const e of ETAPES) await A.go(e);
  await A.clic('#btn-suivant'); await A.clic('#btn-precedent');
  await A.page.selectOption('#minuteur-phase', 'rupture');
  await A.clic('#btn-minuteur-demarrer'); await attendreEtat(A, 'marche');
  await sleep(1100);
  await A.clic('#btn-minuteur-pause'); await attendreEtat(A, 'pause');
  await A.clic('#btn-minuteur-raz'); await attendreEtat(A, 'arret');
  await A.page.evaluate(() => { window.__echec = true; });
  await A.coter('T0.5', '2');
  await attendre('bandeau d\'echec', async () => nz(await A.corps()).indexOf(nz(TXT_ECHEC)) >= 0);
  await A.page.evaluate(() => { window.__echec = false; });
  await A.coter('T0.5', '3');
  await attendre('reprise', async () => nz(await A.corps()).indexOf(nz(TXT_ECHEC)) < 0);
  await A.page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  await A.page.emulateMedia({ media: 'screen', colorScheme: 'light' });
  await A.page.setViewportSize({ width: 390, height: 844 });
  for (const e of ETAPES) { await A.go(e); await sleep(40); }
  await A.page.setViewportSize({ width: 1280, height: 800 });
  await A.recharger();
  eq((await A.st()).cotations['T0.5'], 3, 'T0.5 apres rechargement');
});

/* @@SUITE@@ */

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
          const erreurs = c.opts.tolererConsole ? A.erreursPage : A.errors;
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
  console.log('\n' + reussis + '/' + total + ' reussis' + (ignores ? ' (' + ignores + ' ignores : comportement non emulable)' : ''));
  process.exit(reussis === total ? 0 : 1);
}

main().catch((e) => { console.error('Erreur fatale : ' + (e && e.stack || e)); process.exit(3); });
