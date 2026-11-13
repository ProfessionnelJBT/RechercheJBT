#!/usr/bin/env node
'use strict';

/*
 * Suite de tests de bout en bout : participants, bilans, impression PDF et export Excel.
 * Ecrite uniquement a partir de protocole-haptique/MODE_OPERATOIRE.md (partie C et renvois A, B9, B10).
 * Le code de grille-haptique.html n'a pas ete lu : les attendus viennent du document.
 *
 * Usage : node protocole-haptique/tests/participants.test.js
 * Variables d'environnement facultatives : GRILLE_HTML (autre fichier HTML a tester),
 * GRILLE_FILTRE (expression reguliere : ne lance que les controles dont le nom correspond).
 * Sortie : une ligne "OK  nom" ou "ECHEC  nom : raison" par controle, "IGNORE  nom : raison" si un outil
 * externe facultatif (python3/openpyxl, LibreOffice) manque (non compte dans le total), puis "n/N reussis".
 * Codes de sortie : 0 tout passe, 1 au moins un echec, 2 fichier HTML absent,
 * 3 Playwright ou Chromium inutilisable.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
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
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'participants-test-'));
const TMP_DATA = path.join(TMP, 'data');
const TMP_OUTILS = path.join(TMP, 'outils');
fs.mkdirSync(TMP_DATA); fs.mkdirSync(TMP_OUTILS);

process.on('unhandledRejection', () => {});

/* ------------------------------------------------------------------ */
/* Donnees du contrat                                                  */
/* ------------------------------------------------------------------ */

const STEPS = ['session', 't0', 't1', 't2', 'physio', 'synthese'];
const T0 = ['T0.1', 'T0.2', 'T0.3', 'T0.4', 'T0.5'];
const T1 = ['V1.1', 'V1.2', 'V1.3', 'V1.4', 'V2.1', 'V2.2', 'V2.3', 'V2.4', 'V3.1', 'V3.2', 'V3.3', 'V4.1', 'V4.2', 'V4.3'];
const ITEMS = T0.concat(T1);
const OBS_PHASES = ['T0', 'AXE1', 'AXE2', 'AXE3', 'AXE4'];
const RUPT = ['surprise', 'recherche', 'reprise', 'indifference'];
const T2K = ['tonus', 'posture', 'emotion', 'relation'];
const PHYS = ['fc', 'vfc', 'ced', 'spo2'];
const TEMPS = ['t0', 't1', 'rupture', 't2'];
const AXE_DE = {};
T1.forEach((c) => { AXE_DE[c] = Number(c.charAt(1)); });

const INTITULES = {
  'T0.1': 'Hypertonie & spasticité',
  'T0.2': 'Effondrement axial & hypotonie',
  'T0.3': 'Signes neurovégétatifs de stress',
  'T0.4': 'Vigilance & ouverture spontanée',
  'T0.5': 'Réceptivité au toucher thérapeutique',
  'V1.1': 'Détente neuromusculaire périphérique',
  'V1.2': 'Organisation & redressement de l\'axe médian',
  'V1.3': 'Modulation respiratoire',
  'V1.4': 'Intolérance sensorielle ou défense tactile',
  'V2.1': 'Investissement des appuis postérieurs',
  'V2.2': 'Gestes autocentrés & auto-contacts',
  'V2.3': 'Orientation attentionnelle vers l\'éprouvé corporel',
  'V2.4': 'Manifestation de causalité & recherche du stimulus',
  'V3.1': 'Maintien de la fixation visuelle',
  'V3.2': 'Inhibition motrice des décharges parasites',
  'V3.3': 'Stabilité de l\'état d\'éveil',
  'V4.1': 'Accrochage et maintien du regard',
  'V4.2': 'Ajustement tonique à la mobilisation',
  'V4.3': 'Synchronie émotionnelle et expressivité',
};
const T2_LIB = {
  tonus: ['Tonus de fond', '1. Tonus de fond'],
  posture: ['Posture et appuis', '2. Organisation posturale & appuis'],
  emotion: ['Émotion', '3. État émotionnel global'],
  relation: ['Relation', '4. Disponibilité relationnelle'],
};
const SCORES = [
  { cle: 'axe1', nom: 'Axe 1 - Régulation Tonique', min: -3, max: 9, grad: [-3, 0, 3, 6, 9], zero: true },
  { cle: 'axe2', nom: 'Axe 2 - Conscience Corporelle et Appuis', min: 0, max: 12, grad: [0, 3, 6, 9, 12], zero: false },
  { cle: 'axe3', nom: 'Axe 3 - Disponibilité Attentionnelle', min: 0, max: 9, grad: [0, 3, 6, 9], zero: false },
  { cle: 'axe4', nom: 'Axe 4 - Dialogue Tonico-Émotionnel', min: 0, max: 9, grad: [0, 3, 6, 9], zero: false },
  { cle: 'total', nom: 'Indice global d\'efficience clinique', min: -3, max: 39, grad: [0, 10, 20, 30, 39], zero: true },
];
const SCORE_KEYS = SCORES.map((s) => s.cle);
const FORMES = { A: 'cercle', B: 'carre', C: 'triangle', '': 'losange' };
const AVERTISSEMENT = 'Ces fichiers contiennent des données de santé pseudonymisées : à ranger et à transmettre comme telles.';
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NOMS_ZIP = ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
  'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'];

/* variables CSS C3.6 : [clair, sombre] */
const VARS = {
  '--bil-cond-a': ['#FFFFFF', '#17211F'], '--bil-cond-a-trait': ['#41524F', '#ABBBB7'], '--bil-cond-a-lettre': ['#14201F', '#E8EFED'],
  '--bil-cond-b': ['#2F2C62', '#A9A6EA'], '--bil-cond-c': ['#2F2C62', '#A9A6EA'], '--bil-cond-lettre': ['#FFFFFF', '#14123A'],
  '--bil-cond-x': ['#E9EEEC', '#22302D'], '--bil-cond-x-trait': ['#72837F', '#7E908C'], '--bil-cond-x-lettre': ['#14201F', '#E8EFED'],
  '--bil-cot-0': ['#DCE9E6', '#1C3A35'], '--bil-cot-txt-0': ['#14201F', '#E8EFED'],
  '--bil-cot-1': ['#A7CCC5', '#2C6058'], '--bil-cot-txt-1': ['#14201F', '#E8EFED'],
  '--bil-cot-2': ['#4D9A90', '#3F9184'], '--bil-cot-txt-2': ['#14201F', '#081816'],
  '--bil-cot-3': ['#0A5F57', '#6FC9BA'], '--bil-cot-txt-3': ['#FFFFFF', '#081816'],
  '--bil-cot-na': ['#E4E9E7', '#1F2B29'], '--bil-cot-na-trait': ['#9AA8A5', '#5A6B68'], '--bil-cot-txt-na': ['#41524F', '#ABBBB7'],
  '--bil-t2-neg': ['#F4E5C8', '#3A2C13'], '--bil-t2-neg-trait': ['#B3741B', '#D9A24D'], '--bil-t2-neg-txt': ['#14201F', '#E8EFED'],
  '--bil-t2-zero': ['#E4E9E7', '#1F2B29'], '--bil-t2-zero-txt': ['#14201F', '#E8EFED'],
  '--bil-t2-pos': ['#0E6B62', '#41B3A4'], '--bil-t2-pos-txt': ['#FFFFFF', '#081816'],
};
const PAIRES_CONTRASTE = [
  ['--bil-cond-a', '--bil-cond-a-lettre'], ['--bil-cond-b', '--bil-cond-lettre'], ['--bil-cond-c', '--bil-cond-lettre'],
  ['--bil-cond-x', '--bil-cond-x-lettre'], ['--bil-cot-0', '--bil-cot-txt-0'], ['--bil-cot-1', '--bil-cot-txt-1'],
  ['--bil-cot-2', '--bil-cot-txt-2'], ['--bil-cot-3', '--bil-cot-txt-3'], ['--bil-cot-na', '--bil-cot-txt-na'],
  ['--bil-t2-neg', '--bil-t2-neg-txt'], ['--bil-t2-zero', '--bil-t2-zero-txt'], ['--bil-t2-pos', '--bil-t2-pos-txt'],
];
/* traits (contour, hachures) : contraste d'au moins 3 avec le fond sur lequel ils sont poses */
const PAIRES_TRAITS = [
  ['--bil-cond-a-trait', '--bil-cond-a'], ['--bil-cond-x-trait', '--bil-cond-x'], ['--bil-t2-neg-trait', '--bil-t2-neg'],
];

/* ------------------------------------------------------------------ */
/* Outils generiques                                                   */
/* ------------------------------------------------------------------ */

class Ignore extends Error {}
function ignorer(msg) { throw new Ignore(msg); }
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
    let a = canon(actual); let e = canon(expected);
    if (a.length > 600) a = a.slice(0, 600) + '...';
    if (e.length > 600) e = e.slice(0, 600) + '...';
    fail(label + ' : attendu ' + e + ', obtenu ' + a);
  }
}
function proche(a, b, tol, label) {
  if (typeof a !== 'number' || isNaN(a) || Math.abs(a - b) > tol) fail(label + ' : attendu ' + b + ' (+/- ' + tol + '), obtenu ' + a);
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
function fr(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }
function court(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(2, 4) : '?'; }
function arrondi1(y) { return String(Math.round(y * 10) / 10); }
function pluriel(n, mot) { return n + ' ' + mot + (n > 1 ? 's' : ''); }
function lettres(n) { let s = ''; n += 1; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }

function raison(e) {
  const lignes = String((e && e.message) || e).split('\n').map((l) => l.trim()).filter(Boolean);
  let r = lignes[0] || 'erreur inconnue';
  const loc = lignes.find((l) => /waiting for|locator\(|selector/.test(l) && l !== lignes[0]);
  if (loc) r += ' | ' + loc;
  return r.length > 420 ? r.slice(0, 417) + '...' : r;
}

/* ------------------------------------------------------------------ */
/* Jeux de donnees                                                     */
/* ------------------------------------------------------------------ */

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
    cotations, observations, v31_duree_sec: null,
    rupture: { surprise: false, recherche: false, reprise: false, indifference: false, commentaire: '' },
    t2, physio, synthese: { evenements: '', conclusion: '' },
    scores: { axe1: null, axe2: null, axe3: null, axe4: null, total: null, manquants: { axe1: 4, axe2: 4, axe3: 3, axe4: 3, total: 14 } },
  };
  return merge(s, over);
}

/* jeu de reference de C7 (recopie du document) */
const REF = { schema: 'grille-haptique/1', sessions: [
  { id: 's01-b', cree_le: '2026-03-09T09:00:00.000Z', modifie_le: '2026-03-09T10:00:00.000Z',
    identification: { code_sujet: 'S01', session_no: 2, date: '2026-03-09', age: 14, sexe: 'F',
      diagnostic: 'Polyhandicap', observateur: 'OBS1', installation: 'corset', condition: 'B' },
    cotations: { 'T0.1': 2, 'T0.2': 'NA', 'V1.1': 2, 'V1.2': 2, 'V1.3': 2, 'V1.4': 0, 'V2.1': 2, 'V2.2': 2,
      'V2.3': 1, 'V2.4': 1, 'V3.1': 2, 'V3.2': 2, 'V3.3': 2, 'V4.1': 2, 'V4.2': 2, 'V4.3': 1 },
    t2: { tonus: { evolution: 1 }, posture: { evolution: 0 }, emotion: { evolution: 1 } } },
  { id: 's01-c', cree_le: '2026-03-16T09:00:00.000Z', modifie_le: '2026-03-16T10:00:00.000Z',
    identification: { code_sujet: 'S01', session_no: 3, date: '2026-03-16', age: 15, sexe: 'F',
      diagnostic: 'Polyhandicap', observateur: 'OBS2', installation: 'autre',
      installation_autre: 'coussin', condition: 'C' },
    cotations: { 'V1.1': 0, 'V1.2': 1, 'V1.3': 0, 'V1.4': 3, 'V3.1': 3, 'V3.2': 3, 'V3.3': 3,
      'V4.1': 3, 'V4.2': 3, 'V4.3': 3 },
    t2: { tonus: { evolution: -1 }, posture: { evolution: 1 }, emotion: { evolution: 0 }, relation: { evolution: 1 } } },
  { id: 's01-a', cree_le: '2026-03-02T09:00:00.000Z', modifie_le: '2026-03-02T10:00:00.000Z',
    identification: { code_sujet: 'S01', session_no: 1, date: '2026-03-02', age: 14, sexe: 'F',
      diagnostic: 'Polyhandicap', observateur: 'OBS1', installation: 'corset', condition: 'A' },
    cotations: { 'T0.1': 3, 'V1.1': 1, 'V1.2': 1, 'V1.3': 1, 'V1.4': 2, 'V2.1': 0, 'V2.2': 0, 'V2.3': 0,
      'V2.4': 0, 'V3.1': 1, 'V3.2': 0, 'V4.1': 1, 'V4.2': 'NA', 'V4.3': 0 } },
  { id: 'p7-x', identification: { code_sujet: 'P7', session_no: 2, date: '2026-04-06' } },
  { id: 'p7-z', identification: { code_sujet: 'P7', session_no: 7, date: '2026-04-13' } },
  { id: 'p7-y', identification: { code_sujet: 'P7', session_no: 1, date: '2026-04-06' } },
  { id: 'p6-late', cree_le: '2026-04-06T12:00:00.000Z', identification: { code_sujet: 'P6', session_no: 1, date: '2026-04-06' } },
  { id: 'p6-nodate', cree_le: '2026-04-01T08:00:00.000Z', identification: { code_sujet: 'P6', session_no: 1, date: '' } },
  { id: 'p6-early', cree_le: '2026-04-06T08:00:00.000Z', identification: { code_sujet: 'P6', session_no: 1, date: '2026-04-06' } },
  { id: 'p8-1', identification: { code_sujet: 'P8', session_no: 1, date: '2026-05-01', condition: 'B' }, cotations: { 'V3.1': 3 } },
  { id: 'p8-2', identification: { code_sujet: 'P8', session_no: 2, date: '2026-05-08', condition: 'A' } },
  { id: 'p8-3', identification: { code_sujet: 'P8', session_no: 3, date: '2026-05-15', condition: '' }, cotations: { 'V3.1': 2 } },
  { id: 'z9-1', identification: { code_sujet: 'Z9', date: '2026-06-01' } },
] };
const REF_IDS = REF.sessions.map((s) => s.id);

const CASSE = { id: 's01-d', modifie_le: '2026-04-01T10:00:00.000Z',
  identification: { code_sujet: 's01', session_no: 4, date: '2026-03-23', condition: 'A' } };

function jourPlus(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

/* n sessions d'un code, conditions A,B,C en cycle, V3.1 = i modulo 4 */
function jeuLong(code, n, prefixe) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    out.push({ id: prefixe + i, cree_le: '2026-02-01T08:00:00.000Z', modifie_le: '2026-02-01T09:00:00.000Z',
      identification: { code_sujet: code, session_no: i, date: jourPlus('2026-01-01', i - 1), condition: ['A', 'B', 'C'][(i - 1) % 3] },
      cotations: { 'V3.1': i % 4 } });
  }
  return out;
}
const BIG30 = jeuLong('BIG30', 30, 'big-');

function sauvegarde(sessions) { return { schema: 'grille-haptique/1', exporte_le: '2026-11-12T10:00:00.000Z', sessions }; }

/* generateur pseudo-aleatoire deterministe */
function prng(graine) {
  let x = graine >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}

/* ------------------------------------------------------------------ */
/* Modele independant (regles de C1 a C3, calcule dans le test)       */
/* ------------------------------------------------------------------ */

function norm(raw) {
  const idn = Object.assign({ code_sujet: '', session_no: null, date: '', condition: '' }, raw.identification || {});
  if (idn.session_no === undefined) idn.session_no = null;
  idn.condition = idn.condition || '';
  idn.date = idn.date || '';
  return { id: raw.id, cree_le: raw.cree_le || '', modifie_le: raw.modifie_le || '', identification: idn,
    cotations: raw.cotations || {}, t2: raw.t2 || {} };
}

function calcScores(cot) {
  const v = (c) => (typeof cot[c] === 'number' ? cot[c] : null);
  const axe = (items, inverse) => {
    let s = 0; let n = 0; let man = 0;
    items.forEach((c) => { const x = v(c); if (x === null) man++; else { s += (c === inverse ? -x : x); n++; } });
    return { s: n ? s : null, man };
  };
  const a1 = axe(['V1.1', 'V1.2', 'V1.3', 'V1.4'], 'V1.4');
  const a2 = axe(['V2.1', 'V2.2', 'V2.3', 'V2.4']);
  const a3 = axe(['V3.1', 'V3.2', 'V3.3']);
  const a4 = axe(['V4.1', 'V4.2', 'V4.3']);
  const vals = [a1.s, a2.s, a3.s, a4.s].filter((x) => x !== null);
  return {
    scores: { axe1: a1.s, axe2: a2.s, axe3: a3.s, axe4: a4.s, total: vals.length ? vals.reduce((x, y) => x + y, 0) : null },
    manquants: { axe1: a1.man, axe2: a2.man, axe3: a3.man, axe4: a4.man, total: a1.man + a2.man + a3.man + a4.man },
  };
}

function ordreSessions(liste) {
  const idx = new Map(liste.map((s, i) => [s, i]));
  const t = (s) => { const x = Date.parse(s.cree_le); return isNaN(x) ? Infinity : x; };
  return liste.slice().sort((a, b) => {
    const da = a.identification.date || ''; const db = b.identification.date || '';
    if (da !== db) { if (!da) return 1; if (!db) return -1; return da < db ? -1 : 1; }
    const na = a.identification.session_no; const nb = b.identification.session_no;
    if (na !== nb) { if (na == null) return 1; if (nb == null) return -1; return na < nb ? -1 : 1; }
    if (t(a) !== t(b)) return t(a) < t(b) ? -1 : 1;
    return idx.get(a) - idx.get(b);
  });
}

function modeleParticipants(liste) {
  const groupes = new Map();
  liste.forEach((s) => {
    const cle = (s.identification.code_sujet || '').toLowerCase();
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(s);
  });
  const cles = [...groupes.keys()].filter((k) => k !== '').sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (groupes.has('')) cles.push('');
  return cles.map((cle) => {
    const g = groupes.get(cle);
    let best = null;
    g.forEach((s) => { if (best === null || Date.parse(s.modifie_le) >= Date.parse(best.modifie_le)) best = s; });
    const code = best.identification.code_sujet;
    const ord = ordreSessions(g);
    const dates = ord.map((s) => s.identification.date).filter(Boolean).sort();
    return {
      code, cle, libelle: code || '(sans code)', nb_sessions: g.length,
      premiere_date: dates.length ? dates[0] : null, derniere_date: dates.length ? dates[dates.length - 1] : null,
      conditions: ['A', 'B', 'C'].filter((c) => g.some((s) => s.identification.condition === c)),
      sessions: ord.map((s) => s.id),
    };
  });
}

function modeleBilan(liste, code) {
  const P = modeleParticipants(liste);
  const cle = code === '(sans code)' ? '' : String(code).toLowerCase();
  const p = P.find((x) => x.cle === cle);
  if (!p) return null;
  const parId = new Map(liste.map((s) => [s.id, s]));
  const ord = p.sessions.map((id) => parId.get(id));
  const calc = ord.map((s) => calcScores(s.cotations));
  const segs = (valeurs) => {
    const out = []; let cur = [];
    valeurs.forEach((v, i) => { if (v !== null) cur.push(i + 1); else { if (cur.length >= 2) out.push(cur); cur = []; } });
    if (cur.length >= 2) out.push(cur);
    return out;
  };
  const cv = (s, c) => (s.cotations[c] === undefined ? null : s.cotations[c]);
  const t2v = (s, k) => ((s.t2[k] && s.t2[k].evolution !== undefined) ? s.t2[k].evolution : null);
  return {
    schema: 'grille-haptique-bilan/1', code: p.code, cle: p.cle, libelle: p.libelle, nb_sessions: p.nb_sessions,
    premiere_date: p.premiere_date, derniere_date: p.derniere_date, conditions: p.conditions,
    sessions: ord.map((s, i) => ({ rang: i + 1, id: s.id, session_no: s.identification.session_no == null ? null : s.identification.session_no,
      date: s.identification.date || '', condition: s.identification.condition || '', scores: calc[i].scores, manquants: calc[i].manquants })),
    scores: SCORES.map((sc) => {
      const vals = calc.map((c) => c.scores[sc.cle]);
      return { cle: sc.cle, nom: sc.nom, min: sc.min, max: sc.max, graduations: sc.grad,
        points: ord.map((s, i) => ({ rang: i + 1, session_id: s.id, session_no: s.identification.session_no == null ? null : s.identification.session_no,
          date: s.identification.date || '', condition: s.identification.condition || '', valeur: vals[i], manquants: calc[i].manquants[sc.cle] })),
        segments: segs(vals) };
    }),
    cotations_t0: T0.map((c) => ({ code: c, intitule: INTITULES[c], axe: null, inverse: false,
      cellules: ord.map((s, i) => ({ rang: i + 1, session_id: s.id, valeur: cv(s, c) })) })),
    cotations_t1: T1.map((c) => ({ code: c, intitule: INTITULES[c], axe: AXE_DE[c], inverse: c === 'V1.4',
      cellules: ord.map((s, i) => ({ rang: i + 1, session_id: s.id, valeur: cv(s, c) })) })),
    t2: T2K.map((k) => ({ cle: k, libelle: T2_LIB[k][0], libelle_complet: T2_LIB[k][1],
      cellules: ord.map((s, i) => ({ rang: i + 1, session_id: s.id, valeur: t2v(s, k) })) })),
  };
}

/* ordonnee attendue d'une valeur sur un graphique de score */
function yScore(sc, v) { return arrondi1(22 + (sc.max - v) * 140 / (sc.max - sc.min)); }

/* ------------------------------------------------------------------ */
/* Lecteur ZIP (stocke) et XML minimal, independants de l'application  */
/* ------------------------------------------------------------------ */

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = TABLE_CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* renvoie { problemes: [...], entrees: [{nom, data}] } ; ne jette que si l'enregistrement de fin est introuvable */
function zipLire(buf) {
  const p = [];
  const n = buf.length;
  if (n < 22) fail('archive trop courte : ' + n + ' octets');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const fin = n - 22;
  if (dv.getUint32(fin, true) !== 0x06054B50) fail('enregistrement de fin 0x06054B50 absent a longueur-22');
  const e = { d1: dv.getUint16(fin + 4, true), d2: dv.getUint16(fin + 6, true), n1: dv.getUint16(fin + 8, true),
    n2: dv.getUint16(fin + 10, true), taille: dv.getUint32(fin + 12, true), off: dv.getUint32(fin + 16, true), com: dv.getUint16(fin + 20, true) };
  if (e.d1 !== 0 || e.d2 !== 0) p.push('numeros de disque de fin non nuls');
  if (e.n1 !== 7 || e.n2 !== 7) p.push('entrees annoncees ' + e.n1 + '/' + e.n2 + ' au lieu de 7');
  if (e.com !== 0) p.push('commentaire de fin non vide');
  if (e.off + e.taille !== fin) p.push('repertoire central (' + e.off + '+' + e.taille + ') ne finit pas a l\'enregistrement de fin (' + fin + ')');
  const entrees = [];
  let pos = e.off; let attendu = 0;
  for (let i = 0; i < e.n2 && pos + 46 <= n; i++) {
    if (dv.getUint32(pos, true) !== 0x02014B50) { p.push('signature centrale invalide a l\'entree ' + (i + 1)); break; }
    const c = { vc: dv.getUint16(pos + 4, true), vr: dv.getUint16(pos + 6, true), fl: dv.getUint16(pos + 8, true), me: dv.getUint16(pos + 10, true),
      ti: dv.getUint16(pos + 12, true), da: dv.getUint16(pos + 14, true), crc: dv.getUint32(pos + 16, true), cs: dv.getUint32(pos + 20, true),
      us: dv.getUint32(pos + 24, true), nl: dv.getUint16(pos + 28, true), xl: dv.getUint16(pos + 30, true), cl: dv.getUint16(pos + 32, true),
      dk: dv.getUint16(pos + 34, true), ia: dv.getUint16(pos + 36, true), ea: dv.getUint32(pos + 38, true), lho: dv.getUint32(pos + 42, true) };
    const nom = Buffer.from(buf.subarray(pos + 46, pos + 46 + c.nl)).toString('latin1');
    pos += 46 + c.nl + c.xl + c.cl;
    const E = nom + ' : ';
    if (!/^[\x20-\x7E]+$/.test(nom)) p.push(E + 'nom non ASCII');
    if (c.vc !== 20) p.push(E + 'version creatrice ' + c.vc + ' (attendu 20)');
    if (c.vr !== 20) p.push(E + 'version requise (centrale) ' + c.vr);
    if (c.fl !== 0) p.push(E + 'drapeaux ' + c.fl + ' (attendu 0, pas de descripteur de donnees)');
    if (c.me !== 0) p.push(E + 'methode ' + c.me + ' (attendu 0, stocke)');
    if (c.ti !== 0) p.push(E + 'heure DOS ' + c.ti + ' (attendu 0)');
    if (c.da !== 0x0021) p.push(E + 'date DOS 0x' + c.da.toString(16) + ' (attendu 0x21)');
    if (c.xl !== 0 || c.cl !== 0) p.push(E + 'extra/commentaire non vides');
    if (c.dk !== 0 || c.ia !== 0 || c.ea !== 0) p.push(E + 'disque/attributs non nuls');
    if (c.cs !== c.us) p.push(E + 'taille compressee ' + c.cs + ' != taille reelle ' + c.us);
    if (c.lho !== attendu) p.push(E + 'decalage local ' + c.lho + ' au lieu de ' + attendu);
    if (c.lho + 30 > n || dv.getUint32(c.lho, true) !== 0x04034B50) { p.push(E + 'en-tete local invalide'); entrees.push({ nom, data: Buffer.alloc(0) }); continue; }
    const l = { vr: dv.getUint16(c.lho + 4, true), fl: dv.getUint16(c.lho + 6, true), me: dv.getUint16(c.lho + 8, true), ti: dv.getUint16(c.lho + 10, true),
      da: dv.getUint16(c.lho + 12, true), crc: dv.getUint32(c.lho + 14, true), cs: dv.getUint32(c.lho + 18, true), us: dv.getUint32(c.lho + 22, true),
      nl: dv.getUint16(c.lho + 26, true), xl: dv.getUint16(c.lho + 28, true) };
    const nomL = Buffer.from(buf.subarray(c.lho + 30, c.lho + 30 + l.nl)).toString('latin1');
    if (nomL !== nom) p.push(E + 'nom local different (' + nomL + ')');
    if (l.vr !== 20 || l.fl !== 0 || l.me !== 0 || l.ti !== 0 || l.da !== 0x0021 || l.xl !== 0) p.push(E + 'en-tete local non conforme (version/drapeaux/methode/heure/date/extra)');
    if (l.crc !== c.crc || l.cs !== c.cs || l.us !== c.us) p.push(E + 'en-tete local et repertoire central en desaccord');
    const ds = c.lho + 30 + l.nl + l.xl;
    const data = Buffer.from(buf.subarray(ds, ds + l.cs));
    if (data.length !== l.cs) p.push(E + 'donnees tronquees');
    const calc = crc32(data);
    if (calc !== c.crc) p.push(E + 'CRC-32 0x' + c.crc.toString(16) + ' != recalcule 0x' + calc.toString(16));
    attendu = ds + l.cs;
    entrees.push({ nom, data });
  }
  if (attendu !== e.off) p.push('les entrees locales ne sont pas contigues avec le repertoire central (fin des donnees ' + attendu + ', repertoire ' + e.off + ')');
  return { problemes: p, entrees };
}

function xmlParse(str) {
  let i = 0; const n = str.length;
  const err = (m) => { throw new Error('XML mal forme : ' + m + ' (position ' + i + ')'); };
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(str)) err('caractere de controle interdit');
  const decode = (t) => {
    const r = t.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (m, e) => {
      if (e === 'amp') return '&'; if (e === 'lt') return '<'; if (e === 'gt') return '>'; if (e === 'quot') return '"'; if (e === 'apos') return '\'';
      return String.fromCodePoint(e.charAt(1) === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    });
    if (/&/.test(t.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|amp|lt|gt|quot|apos);/g, ''))) err('& non echappe');
    return r;
  };
  if (str.startsWith('<?xml')) { const j = str.indexOf('?>'); if (j < 0) err('declaration non fermee'); i = j + 2; }
  const pile = []; let racine = null;
  const reNom = /<([A-Za-z_][\w:.-]*)/y; const reAtt = /\s+([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/y;
  while (i < n) {
    if (str[i] === '<') {
      if (str.startsWith('<!--', i)) { const j = str.indexOf('-->', i); if (j < 0) err('commentaire non ferme'); i = j + 3; continue; }
      if (str[i + 1] === '/') {
        const j = str.indexOf('>', i); if (j < 0) err('balise fermante');
        const nom = str.slice(i + 2, j).trim();
        const top = pile.pop();
        if (!top || top.nom !== nom) err('balise fermante </' + nom + '> inattendue');
        i = j + 1; continue;
      }
      reNom.lastIndex = i; const m = reNom.exec(str); if (!m) err('balise ouvrante illisible');
      const el = { nom: m[1], attrs: {}, enfants: [], texte: '' };
      i = reNom.lastIndex;
      for (;;) {
        reAtt.lastIndex = i; const a = reAtt.exec(str);
        if (!a) break;
        if (Object.prototype.hasOwnProperty.call(el.attrs, a[1])) err('attribut en double ' + a[1]);
        el.attrs[a[1]] = decode(a[2] !== undefined ? a[2] : a[3]); i = reAtt.lastIndex;
      }
      while (/\s/.test(str[i])) i++;
      let auto = false;
      if (str[i] === '/' && str[i + 1] === '>') { auto = true; i += 2; } else if (str[i] === '>') i += 1; else err('fin de balise attendue pres de <' + el.nom);
      if (pile.length) pile[pile.length - 1].enfants.push(el); else if (racine) err('deux racines'); else racine = el;
      if (!auto) pile.push(el);
    } else {
      const j = str.indexOf('<', i); const fin = j < 0 ? n : j;
      const t = str.slice(i, fin);
      if (pile.length) pile[pile.length - 1].texte += decode(t); else if (t.trim()) err('texte hors racine');
      i = fin;
    }
  }
  if (pile.length) err('balise non fermee <' + pile[pile.length - 1].nom + '>');
  if (!racine) err('pas de racine');
  return racine;
}
function xEnf(el, nom) { return el.enfants.filter((e) => e.nom === nom); }
function xUn(el, nom) { const r = xEnf(el, nom); if (r.length !== 1) fail('<' + el.nom + '> doit contenir exactement un <' + nom + '>, trouve ' + r.length); return r[0]; }

/* lecture d'une feuille : cellules par reference */
function lireFeuille(xml) {
  const racine = xmlParse(xml);
  const ordre = racine.enfants.map((e) => e.nom);
  const data = xUn(racine, 'sheetData');
  const cellules = new Map(); const lignes = [];
  xEnf(data, 'row').forEach((row) => {
    const refs = [];
    xEnf(row, 'c').forEach((c) => {
      const ref = c.attrs.r; const t = c.attrs.t;
      let valeur;
      if (t === 'inlineStr') {
        const is = xUn(c, 'is'); const tt = xUn(is, 't'); valeur = { k: 't', v: tt.texte };
      } else if (t === undefined) {
        const v = xUn(c, 'v'); valeur = { k: 'n', v: v.texte, brut: v.texte };
      } else valeur = { k: '?' + t, v: null };
      valeur.s = c.attrs.s; valeur.t = t; valeur.f = xEnf(c, 'f').length;
      cellules.set(ref, valeur); refs.push(ref);
    });
    lignes.push({ r: row.attrs.r, refs });
  });
  const cols = [];
  const ce = racine.enfants.filter((e) => e.nom === 'cols')[0];
  if (ce) xEnf(ce, 'col').forEach((c) => { for (let k = Number(c.attrs.min); k <= Number(c.attrs.max); k++) cols[k] = { width: Number(c.attrs.width), custom: c.attrs.customWidth }; });
  return { racine, ordre, cellules, lignes, cols, dimension: xUn(racine, 'dimension').attrs.ref };
}

/* grille attendue (Map ref -> {k, v}) a partir de lignes de valeurs (undefined = cellule absente) */
function grilleAttendue(entetes, lignes) {
  const m = new Map();
  entetes.forEach((h, j) => m.set(lettres(j) + '1', { k: 't', v: h }));
  lignes.forEach((l, i) => l.forEach((v, j) => {
    if (v === undefined || v === null || v === '') return;
    m.set(lettres(j) + (i + 2), typeof v === 'number' ? { k: 'n', v: String(v) } : { k: 't', v });
  }));
  return m;
}
function comparerFeuille(f, attendu, label) {
  const pb = [];
  attendu.forEach((a, ref) => {
    const c = f.cellules.get(ref);
    if (!c) { pb.push(ref + ' absente (attendu ' + a.k + ' ' + JSON.stringify(a.v) + ')'); return; }
    if (c.k !== a.k || c.v !== a.v) pb.push(ref + ' : ' + c.k + ' ' + JSON.stringify(c.v) + ' au lieu de ' + a.k + ' ' + JSON.stringify(a.v));
  });
  f.cellules.forEach((c, ref) => { if (!attendu.has(ref)) pb.push(ref + ' presente alors qu\'elle devrait etre absente : ' + c.k + ' ' + JSON.stringify(c.v)); });
  if (pb.length) fail(label + ' : ' + pb.length + ' ecart(s) : ' + pb.slice(0, 6).join(' ; '));
}

const NS = {
  M: 'http:' + '//schemas.openxmlformats.org/spreadsheetml/2006/main',
  R: 'http:' + '//schemas.openxmlformats.org/officeDocument/2006/relationships',
  PR: 'http:' + '//schemas.openxmlformats.org/package/2006/relationships',
  CT: 'http:' + '//schemas.openxmlformats.org/package/2006/content-types',
};
const ENT_SCORES = ['code_sujet', 'session_no', 'date', 'condition', 'axe1', 'axe2', 'axe3', 'axe4', 'total',
  'manquants_axe1', 'manquants_axe2', 'manquants_axe3', 'manquants_axe4', 'manquants_total'];
const ENT_COT = ['code_sujet', 'session_no', 'date', 'condition'].concat(T0, T1, T2K.map((k) => 't2_' + k));

/* lignes attendues des deux feuilles pour une liste de participants (modele) */
function lignesExcel(liste, participants) {
  const parId = new Map(liste.map((s) => [s.id, s]));
  const scores = []; const cots = [];
  participants.forEach((p) => {
    p.sessions.forEach((id) => {
      const s = parId.get(id); const c = calcScores(s.cotations); const idn = s.identification;
      const tete = [p.code === '' ? undefined : p.code, idn.session_no == null ? undefined : idn.session_no, idn.date || undefined, idn.condition || undefined];
      scores.push(tete.concat(SCORE_KEYS.map((k) => c.scores[k]), SCORE_KEYS.map((k) => c.manquants[k])));
      const cv = (code) => { const x = s.cotations[code]; return x === undefined ? null : x; };
      cots.push(tete.concat(T0.map(cv), T1.map(cv), T2K.map((k) => (s.t2[k] && s.t2[k].evolution != null ? s.t2[k].evolution : null))));
    });
  });
  return { scores, cots };
}

/* ------------------------------------------------------------------ */
/* Application sous test                                               */
/* ------------------------------------------------------------------ */

const LIRE_SVG = (nom) => {
  const svg = document.querySelector('svg[data-graphique="' + nom + '"]');
  if (!svg) return null;
  const attrs = (e) => { const o = {}; for (const a of e.attributes) o[a.name] = a.value; return o; };
  const nb = (v) => (v === null || v === '' || v === undefined ? null : Number(v));
  const bb = (e) => { try { const b = e.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height }; } catch (x) { return null; } };
  const SH = 'circle,rect,polygon,path,ellipse,polyline';
  const textes = (r) => [...r.querySelectorAll('text')].map((t) => ({ t: t.textContent, x: nb(t.getAttribute('x')), y: nb(t.getAttribute('y')), cls: t.getAttribute('class') || '', bbox: bb(t) }));
  const formes = (r) => [...r.querySelectorAll(SH)].map((s) => ({ tag: s.tagName.toLowerCase(), cls: s.getAttribute('class') || '', a: attrs(s), bbox: bb(s) }));
  const marqueurs = (r) => [...r.querySelectorAll('.m-A,.m-B,.m-C,.m-X')].map((e) => {
    const m = e.matches(SH) ? [e] : [...e.querySelectorAll(SH)];
    const bs = m.map(bb).filter(Boolean);
    let u = null;
    if (bs.length) {
      const x0 = Math.min(...bs.map((b) => b.x)); const y0 = Math.min(...bs.map((b) => b.y));
      const x1 = Math.max(...bs.map((b) => b.x + b.w)); const y1 = Math.max(...bs.map((b) => b.y + b.h));
      u = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    return { cls: e.getAttribute('class') || '', tag: m.length ? m[0].tagName.toLowerCase() : e.tagName.toLowerCase(), bbox: u, a: m.length ? attrs(m[0]) : {} };
  });
  const titre = (g) => { const t = [...g.children].find((c) => c.tagName.toLowerCase() === 'title'); return t ? t.textContent : null; };
  const ligne = (l) => ({ v: l.getAttribute('data-graduation'), x1: nb(l.getAttribute('x1')), x2: nb(l.getAttribute('x2')), y1: nb(l.getAttribute('y1')), y2: nb(l.getAttribute('y2')) });
  return {
    attrs: attrs(svg),
    colonnes: [...svg.querySelectorAll('g[data-colonne]')].map((g) => ({ a: attrs(g), textes: textes(g), marq: marqueurs(g) })),
    points: [...svg.querySelectorAll('g[data-point]')].map((g) => ({ a: attrs(g), titre: titre(g), textes: textes(g), formes: formes(g), marq: marqueurs(g) })),
    segments: [...svg.querySelectorAll('path[data-segment]')].map((p) => ({ a: attrs(p), d: p.getAttribute('d') })),
    grad: [...svg.querySelectorAll('line[data-graduation]')].map(ligne),
    zero: [...svg.querySelectorAll('line[data-ligne-zero]')].map(ligne),
    lignes: [...svg.querySelectorAll('g[data-ligne]')].map((g) => ({ a: attrs(g), textes: textes(g) })),
    cellules: [...svg.querySelectorAll('g[data-cellule]')].map((g) => ({
      a: attrs(g), titre: titre(g), textes: textes(g), marq: marqueurs(g),
      rects: [...g.querySelectorAll('rect')].map((r) => ({ cls: r.getAttribute('class') || '', fill: r.getAttribute('fill'), style: r.getAttribute('style'),
        x: nb(r.getAttribute('x')), y: nb(r.getAttribute('y')), w: nb(r.getAttribute('width')), h: nb(r.getAttribute('height')) })),
    })),
    patterns: [...svg.querySelectorAll('defs pattern')].map((p) => p.id),
    textesSvg: textes(svg),
    ids: [...svg.querySelectorAll('[id]')].map((e) => e.id),
  };
};

let apiAbsente = false;

async function ouvrir(browser, opt) {
  opt = opt || {};
  const ctx = await browser.newContext({
    viewport: opt.viewport || { width: 1280, height: 900 },
    acceptDownloads: true,
    colorScheme: opt.colorScheme || 'light',
  });
  ctx.setDefaultTimeout(2000);
  ctx.setDefaultNavigationTimeout(8000);
  await ctx.addInitScript(() => {
    window.__blobs = [];
    const B = window.Blob;
    window.Blob = new Proxy(B, { construct(t, a) { try { window.__blobs.push((a[1] && a[1].type) || ''); } catch (e) { /* ignore */ } return Reflect.construct(t, a); } });
  });
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
  A.participants = () => page.evaluate(() => window.GrilleHaptique.participants());
  A.bilan = (code) => page.evaluate((c) => window.GrilleHaptique.bilan(c), code);
  A.go = (k) => page.evaluate((x) => window.GrilleHaptique.allerA(x), k);
  A.corps = () => page.evaluate(() => document.body.innerText);
  A.texte = async (sel) => (await page.locator(sel).first().textContent()).trim();
  A.visible = (sel) => page.locator(sel).first().isVisible();
  A.clic = async (sel) => {
    const l = page.locator(sel).first();
    try { await l.click({ timeout: 1000 }); } catch (e) { await l.evaluate((el) => el.click(), null, { timeout: 1000 }); }
  };
  A.panneauxVisibles = () => page.$$eval('section[data-panel]', (els) => els
    .filter((e) => !e.hidden && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0)
    .map((e) => e.getAttribute('data-panel')));
  A.etapesCourantes = () => page.$$eval('button[data-step][aria-current="step"]', (b) => b.map((x) => x.getAttribute('data-step')));
  A.recharger = async () => { await page.reload(); await A.attendreAPI(); };
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
  /* import par le champ fichier, sans ouvrir le panneau ; attend la presence des ids */
  A.importer = async (contenu, ids) => {
    compteurId += 1;
    const f = path.join(TMP_DATA, 'import-' + compteurId + '.json');
    fs.writeFileSync(f, typeof contenu === 'string' ? contenu : JSON.stringify(contenu));
    await page.setInputFiles('#in-import', f);
    if (ids && ids.length) {
      await page.waitForFunction((l) => { const s = window.GrilleHaptique.sessions().map((x) => x.id); return l.every((i) => s.indexOf(i) >= 0); }, ids, { timeout: 3000 });
    } else await page.waitForTimeout(200);
  };
  A.ref = async () => { await A.importer(REF, REF_IDS); };
  A.ouvrirVue = async () => {
    if (!(await A.visible('#vue-participants'))) await page.click('#btn-participants');
    await page.locator('#vue-participants').waitFor({ state: 'visible' });
  };
  A.liste = async () => {
    await A.ouvrirVue();
    if (await A.visible('#participant-detail')) await page.click('#btn-retour-liste');
    await page.locator('#participants-liste').waitFor({ state: 'visible' });
  };
  A.fiche = async (cle) => {
    await A.liste();
    await page.click('button[data-ouvrir-participant=' + JSON.stringify(cle) + ']');
    await page.locator('#participant-detail').waitFor({ state: 'visible' });
  };
  A.svg = (nom) => page.evaluate(LIRE_SVG, nom);
  A.boutons = (sel) => page.$$eval(sel, (b) => b.map((x) => x.textContent.trim()));
  A.lignesTable = (sel, attr) => page.evaluate((a) => {
    return [...document.querySelectorAll(a.sel)].map((tr) => {
      const o = { attr: tr.getAttribute(a.attr), rang: tr.getAttribute('data-rang'), cellules: {} };
      tr.querySelectorAll('td[data-col]').forEach((td) => { o.cellules[td.getAttribute('data-col')] = td.textContent.trim(); });
      return o;
    });
  }, { sel, attr });
  A.lignesParticipants = () => A.lignesTable('#table-participants tr[data-participant]', 'data-participant');
  A.lignesSessions = () => A.lignesTable('#table-sessions-participant tr[data-session-id]', 'data-session-id');
  A.octets = async (portee) => {
    const r = await page.evaluate((c) => {
      const u = window.GrilleHaptique.xlsxOctets(c);
      if (u === null) return { nul: true };
      let s = '';
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return { nul: false, u8: u instanceof Uint8Array, ctor: u.constructor && u.constructor.name, b64: btoa(s) };
    }, portee);
    if (r.nul) return null;
    assert(r.u8, 'xlsxOctets ne renvoie pas un Uint8Array (' + r.ctor + ')');
    return Buffer.from(r.b64, 'base64');
  };
  A.telecharger = async (sel) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 3000 }), page.click(sel)]);
    const p = await dl.path();
    const buf = fs.readFileSync(p);
    return { name: dl.suggestedFilename(), buf };
  };
  A.courantStocke = () => page.evaluate(() => {
    const v = localStorage.getItem('grilleHaptique.v1.courante');
    try { const j = JSON.parse(v); return typeof j === 'string' ? j : v; } catch (e) { return v; }
  });
  A.sessionsStockees = () => page.evaluate(() => JSON.parse(localStorage.getItem('grilleHaptique.v1.sessions') || '[]'));
  A.clesStockage = () => page.evaluate(() => ({ l: Object.keys(localStorage).sort(), s: Object.keys(sessionStorage).sort() }));
  A.espionPrint = async () => {
    await page.evaluate(() => {
      window.__prints = [];
      window.print = function () {
        const v = document.getElementById('vue-participants');
        window.__prints.push({ attr: document.body.getAttribute('data-impression'), vueCachee: v ? v.hidden : null });
      };
    });
  };
  /* trouve un bouton Ouvrir/Supprimer d'une session dans le panneau Sessions : attributs d'abord, puis texte de la ligne */
  A.boutonPanneau = async (action, id, motifsTexte) => {
    await A.panneau();
    const attr = action === 'ouvrir' ? 'data-ouvrir' : 'data-supprimer';
    const h = await page.evaluateHandle((a) => {
      const pan = document.getElementById('panneau-sessions');
      const essais = ['[' + a.attr + '="' + a.id + '"]', '[' + a.attr + '][data-id="' + a.id + '"]'];
      for (const e of essais) { const x = pan.querySelector(e); if (x) return x; }
      const re = new RegExp(a.action, 'i');
      const bts = [...pan.querySelectorAll('button')].filter((b) => re.test(b.textContent) || re.test(b.getAttribute('aria-label') || ''));
      for (const b of bts) {
        let n = b;
        while (n.parentElement && n.parentElement !== pan) {
          const p = n.parentElement;
          if ([...p.querySelectorAll('button')].filter((x) => re.test(x.textContent) || re.test(x.getAttribute('aria-label') || '')).length > 1) break;
          n = p;
        }
        const t = n.innerText || n.textContent;
        if (a.motifs.every((m) => new RegExp(m).test(t))) return b;
      }
      return null;
    }, { attr, id, action, motifs: motifsTexte });
    const el = h.asElement();
    assert(el, 'bouton ' + action + ' de la session ' + id + ' introuvable dans le panneau Sessions');
    return el;
  };

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
const MOBILE = { viewport: { width: 360, height: 740 } };
const XSS = '<img src=x onerror="window.__xss=1">';


/* ================================================================== */
/* 1. Regroupement par participant (C1.1, C1.3, C1.4, C1.7)            */
/* ================================================================== */

const CLES_PARTICIPANT = ['code', 'cle', 'libelle', 'nb_sessions', 'premiere_date', 'derniere_date', 'conditions', 'sessions'];

check('Regroupement : API participants/bilan/xlsxOctets/ouvrirParticipants exposee, anciennes fonctions conservees', async (A) => {
  const manquantes = await A.page.evaluate(() => ['etat', 'sessions', 'calculerScores', 'versCSV', 'allerA', 'participants', 'bilan', 'xlsxOctets', 'ouvrirParticipants']
    .filter((k) => typeof window.GrilleHaptique[k] !== 'function'));
  eq(manquantes, [], 'fonctions manquantes dans GrilleHaptique');
});

check('Regroupement : ordre des participants, effectifs et groupe (sans code) en dernier (C7.1)', async (A) => {
  await A.ref();
  const P = await A.participants();
  eq(P.map((p) => p.cle), ['p6', 'p7', 'p8', 's01', 'z9', ''], 'cle');
  eq(P.map((p) => p.nb_sessions), [3, 3, 3, 3, 1, 1], 'nb_sessions');
  const d = P[5];
  eq([d.code, d.cle, d.libelle], ['', '', '(sans code)'], 'groupe sans code (code, cle, libelle)');
  P.forEach((p) => eq(Object.keys(p).sort(), CLES_PARTICIPANT.slice().sort(), 'cles de l\'entree ' + p.cle));
});

check('Regroupement : valeurs derivees de S01, sessions en ordre chronologique (C7.2)', async (A) => {
  await A.ref();
  const S = (await A.participants())[3];
  eq(S, { code: 'S01', cle: 's01', libelle: 'S01', nb_sessions: 3, premiere_date: '2026-03-02', derniere_date: '2026-03-16',
    conditions: ['A', 'B', 'C'], sessions: ['s01-a', 's01-b', 's01-c'] }, 'participant S01');
  const P8 = (await A.participants())[2];
  eq([P8.premiere_date, P8.derniere_date, P8.conditions], ['2026-05-01', '2026-05-15', ['A', 'B']], 'P8 (condition vide ignoree, ordre A,B,C)');
});

check('Regroupement : egalite de dates et dates vides (P7, P6) (C7.3)', async (A) => {
  await A.ref();
  const P = await A.participants();
  const p7 = P.find((p) => p.cle === 'p7'); const p6 = P.find((p) => p.cle === 'p6');
  eq(p7.sessions, ['p7-y', 'p7-x', 'p7-z'], 'ordre P7');
  eq(p6.sessions, ['p6-early', 'p6-late', 'p6-nodate'], 'ordre P6');
  eq([p6.premiere_date, p6.derniere_date, p6.conditions], ['2026-04-06', '2026-04-06', []], 'bornes et conditions de P6');
});

check('Regroupement : casse et graphie affichee (jeu CASSE) (C7.4)', async (A) => {
  await A.ref();
  await A.importer(CASSE, ['s01-d']);
  const P = await A.participants();
  eq(P.filter((p) => p.cle === 's01').length, 1, 'nombre de participants s01');
  eq(P.map((p) => p.cle), ['p6', 'p7', 'p8', 's01', 'z9', ''], 'cle apres CASSE');
  const S = P[3];
  eq(S.code, 's01', 'graphie (modifie_le le plus recent)');
  eq(S.nb_sessions, 4, 'nb_sessions');
  eq(S.sessions[3], 's01-d', 'derniere session');
  eq(S.sessions, ['s01-a', 's01-b', 's01-c', 's01-d'], 'ordre');
  const b1 = await A.bilan('S01'); const b2 = await A.bilan('s01');
  eq(b1, b2, 'bilan(S01) et bilan(s01)');
  eq(await A.bilan('inconnu'), null, 'bilan(inconnu)');
  eq((await A.bilan('')).nb_sessions, 1, 'bilan("") (session vierge)');
  eq(b1.code, 's01', 'bilan.code suit la graphie affichee');
});

check('Regroupement : S01, s01 et S01 forment un seul participant ; a egalite de modifie_le la session la plus tard dans le tableau donne la graphie (C1.1)', async (A) => {
  const mk = (id, code, no) => ({ id, cree_le: '2026-02-0' + no + 'T08:00:00.000Z', modifie_le: '2026-02-10T08:00:00.000Z',
    identification: { code_sujet: code, session_no: no, date: '2026-02-0' + no } });
  const jeu = [mk('g1', 'Ab1', 1), mk('g2', 'aB1', 2), mk('g3', 'AB1', 3)];
  await A.importer(sauvegarde(jeu), ['g1', 'g2', 'g3']);
  const tab = (await A.sessions()).filter((s) => /^g[123]$/.test(s.id));
  const P = (await A.participants()).filter((p) => p.cle === 'ab1');
  eq(P.length, 1, 'un seul participant ab1');
  eq(P[0].nb_sessions, 3, 'nb_sessions');
  eq(P[0].code, tab[tab.length - 1].identification.code_sujet, 'graphie = derniere du tableau sessions() a egalite de modifie_le');
});

check('Regroupement : comparaison de modifie_le numerique (Date.parse), pas alphabetique', async (A) => {
  const jeu = [
    { id: 'm1', cree_le: '2026-02-01T08:00:00.000Z', modifie_le: '2026-02-01T10:00:00.000+02:00', identification: { code_sujet: 'Mm', session_no: 1, date: '2026-02-01' } },
    { id: 'm2', cree_le: '2026-02-02T08:00:00.000Z', modifie_le: '2026-02-01T09:00:00.000Z', identification: { code_sujet: 'mM', session_no: 2, date: '2026-02-02' } },
  ];
  await A.importer(sauvegarde(jeu), ['m1', 'm2']);
  const P = (await A.participants()).find((p) => p.cle === 'mm');
  /* m1 = 08:00Z, m2 = 09:00Z : m2 est la plus recente alors que la chaine de m1 est plus grande */
  const tab = await A.sessions();
  const m1 = tab.find((s) => s.id === 'm1'); const m2 = tab.find((s) => s.id === 'm2');
  const attendu = Date.parse(m1.modifie_le) > Date.parse(m2.modifie_le) ? m1 : m2;
  eq(P.code, attendu.identification.code_sujet, 'graphie selon Date.parse(modifie_le) tel que stocke');
});

check('Regroupement : participants() et bilan() renvoient des copies independantes, sans effet de bord', async (A) => {
  await A.ref();
  const avant = await A.sessions();
  const stock = await A.page.evaluate(() => localStorage.getItem('grilleHaptique.v1.sessions'));
  const ok = await A.page.evaluate(() => {
    const G = window.GrilleHaptique;
    const p1 = G.participants(); p1[0].code = 'MUTE'; p1[0].sessions.push('x'); p1.pop();
    const p2 = G.participants();
    const b1 = G.bilan('S01'); b1.scores[0].points[0].valeur = 999; b1.sessions.length = 0; b1.cotations_t1[0].cellules.pop();
    const b2 = G.bilan('S01');
    return { p: p2.length === 6 && p2[0].code !== 'MUTE' && p2[0].sessions.length === 3, b: b2.sessions.length === 3 && b2.scores[0].points[0].valeur === 1 && b2.cotations_t1[0].cellules.length === 3 };
  });
  assert(ok.p, 'participants() partage un etat avec l\'appel precedent');
  assert(ok.b, 'bilan() partage un etat avec l\'appel precedent');
  eq(await A.sessions(), avant, 'sessions() apres lecture');
  eq(await A.page.evaluate(() => localStorage.getItem('grilleHaptique.v1.sessions')), stock, 'localStorage apres lecture');
});

check('Regroupement : la derivation suit le tableau des sessions (code saisi dans #f-code)', async (A) => {
  await A.ref();
  await A.go('session');
  await A.page.fill('#f-code', 'NOUV');
  const P = await A.participants();
  eq(P.map((p) => p.cle), ['nouv', 'p6', 'p7', 'p8', 's01', 'z9'], 'cle (le groupe sans code a disparu)');
  eq(P[0].nb_sessions, 1, 'nb_sessions de NOUV');
  await A.page.fill('#f-code', 's01');
  const Q = await A.participants();
  eq(Q.find((p) => p.cle === 's01').nb_sessions, 4, 'S01 reunit la session vierge (casse differente)');
});

check('Regroupement : participants charges depuis localStorage avant le chargement de la page', async (A) => {
  const sess = [blank({ id: 'ls-1', identification: { code_sujet: 'Ab', session_no: 1, date: '2026-01-01' } }),
    blank({ id: 'ls-2', identification: { code_sujet: 'aB', session_no: 2, date: '2026-01-02' } }),
    blank({ id: 'ls-3', identification: { code_sujet: 'ZZ', session_no: 1, date: '2026-01-03' } })];
  const A2 = await ouvrir(await A.ctx.browser(), { storage: { sessions: sess, courante: 'ls-3' } });
  try {
    const P = await A2.participants();
    eq(P.map((p) => [p.cle, p.nb_sessions]), [['ab', 2], ['zz', 1]], 'participants issus du stockage');
  } finally { await A2.ctx.close(); }
});

check('Regroupement : anciens exports (sauvegarde et session seule) importes sans erreur, schema inchange', async (A) => {
  const a = blank({ id: 'old-1', identification: { code_sujet: 'OLD', session_no: 1, date: '2026-02-01', condition: 'A' } });
  const b = blank({ id: 'old-2', identification: { code_sujet: 'old', session_no: 2, date: '2026-02-08', condition: 'B' } });
  const c = blank({ id: 'old-3', identification: { code_sujet: 'AUTRE', session_no: 1, date: '2026-02-09', condition: 'C' } });
  await A.importer(sauvegarde([a, b]), ['old-1', 'old-2']);
  await A.importer(c, ['old-3']);
  const P = await A.participants();
  eq(P.filter((p) => p.cle === 'old').map((p) => p.nb_sessions), [2], 'participant old');
  eq(P.filter((p) => p.cle === 'autre').map((p) => p.nb_sessions), [1], 'participant autre');
  const cleS = Object.keys(blank()).sort(); const cleI = Object.keys(blank().identification).sort();
  const sess = await A.sessions();
  sess.forEach((s) => {
    eq(Object.keys(s).sort(), cleS, 'cles de la session ' + s.id);
    eq(Object.keys(s.identification).sort(), cleI, 'cles de identification de ' + s.id);
  });
});

check('Regroupement : un export produit par l\'application se reimporte et se regroupe', async (A) => {
  await A.ref();
  await A.panneau();
  const exp = await A.telecharger('#btn-export-tout');
  const j = JSON.parse(exp.buf.toString('utf8'));
  eq(j.sessions.length, 14, 'sessions de la sauvegarde');
  const A2 = await ouvrir(await A.ctx.browser(), {});
  try {
    await A2.importer(j, REF_IDS);
    eq((await A2.participants()).map((p) => p.cle), ['p6', 'p7', 'p8', 's01', 'z9', ''], 'participants reimportes');
  } finally { await A2.ctx.close(); }
});

check('Regroupement : jeu pseudo-aleatoire, participants() et bilan() egaux au modele independant', async (A) => {
  const r = prng(20260512);
  const codes = ['Aa1', 'aA1', 'B_2', 'c-3', 'C-3', 'd4', 'E5', 'e5', ''];
  const sess = [];
  for (let i = 0; i < 40; i++) {
    const cot = {};
    ITEMS.forEach((c) => { const x = r(); if (x < 0.35) return; cot[c] = x < 0.45 ? 'NA' : Math.floor(r() * 4); });
    const t2 = {};
    T2K.forEach((k) => { const x = r(); if (x > 0.4) t2[k] = { evolution: Math.floor(r() * 3) - 1 }; });
    const jour = Math.floor(r() * 12);
    sess.push({ id: 'rnd-' + i, cree_le: '2026-02-' + pad(1 + Math.floor(r() * 28)) + 'T' + pad(Math.floor(r() * 24)) + ':00:00.000Z',
      modifie_le: '2026-03-' + pad(1 + Math.floor(r() * 28)) + 'T' + pad(Math.floor(r() * 24)) + ':00:00.000Z',
      identification: { code_sujet: codes[Math.floor(r() * codes.length)], session_no: r() < 0.15 ? null : 1 + Math.floor(r() * 5),
        date: r() < 0.15 ? '' : '2026-02-' + pad(1 + jour), condition: ['A', 'B', 'C', ''][Math.floor(r() * 4)] },
      cotations: cot, t2 });
  }
  await A.importer(sauvegarde(sess), sess.map((s) => s.id));
  const app = await A.sessions();
  const liste = app.map((s) => norm(s));
  const attendu = modeleParticipants(liste);
  eq(await A.participants(), attendu, 'participants()');
  for (const p of attendu) {
    const b = await A.bilan(p.cle);
    eq(b, modeleBilan(liste, p.cle), 'bilan(' + (p.cle || '(sans code)') + ')');
  }
});

/* ================================================================== */
/* 2. Ordre chronologique (C1.2) et cas limites (C1.7)                 */
/* ================================================================== */

check('Ordre : date, puis session_no (null apres), puis cree_le, puis ordre du tableau ; date vide en dernier', async (A) => {
  const mk = (id, date, no, cree) => ({ id, cree_le: cree, modifie_le: '2026-03-01T00:00:00.000Z', identification: { code_sujet: 'ORD', session_no: no, date } });
  const jeu = [
    mk('o1', '2026-02-01', 5, '2026-01-01T08:00:00.000Z'),
    mk('o2', '2026-01-01', 9, '2026-01-05T08:00:00.000Z'),
    mk('o3', '', 1, '2026-01-01T08:00:00.000Z'),
    mk('o4', '2026-02-01', null, '2026-01-01T07:00:00.000Z'),
    mk('o5', '2026-02-01', 5, '2026-01-02T08:00:00.000Z'),
    mk('o6', '2026-02-01', 5, '2026-01-02T08:00:00.000Z'),
    mk('o7', '2026-02-01', 3, '2026-01-09T08:00:00.000Z'),
  ];
  await A.importer(sauvegarde(jeu), jeu.map((s) => s.id));
  const tab = (await A.sessions()).filter((s) => /^o\d$/.test(s.id)).map((s) => s.id);
  const premier56 = tab.indexOf('o5') < tab.indexOf('o6') ? ['o5', 'o6'] : ['o6', 'o5'];
  const P = (await A.participants()).find((p) => p.cle === 'ord');
  eq(P.sessions, ['o2', 'o7', 'o1'].concat(premier56, ['o4', 'o3']), 'ordre chronologique');
  const b = await A.bilan('ORD');
  eq(b.sessions.map((s) => s.rang), [1, 2, 3, 4, 5, 6, 7], 'rangs');
  eq(b.sessions.map((s) => s.session_no), [9, 3, 5, 5, 5, null, 1], 'session_no dans l\'ordre (le rang ne depend pas du numero)');
  eq([P.premiere_date, P.derniere_date], ['2026-01-01', '2026-02-01'], 'bornes sur les dates renseignees');
});

check('Ordre : deux sessions de meme date departagees par session_no puis cree_le', async (A) => {
  const jeu = [
    { id: 'q1', cree_le: '2026-02-01T09:00:00.000Z', identification: { code_sujet: 'Q', session_no: 2, date: '2026-02-01' } },
    { id: 'q2', cree_le: '2026-02-01T08:00:00.000Z', identification: { code_sujet: 'Q', session_no: 2, date: '2026-02-01' } },
    { id: 'q3', cree_le: '2026-02-01T10:00:00.000Z', identification: { code_sujet: 'Q', session_no: 1, date: '2026-02-01' } },
  ];
  await A.importer(sauvegarde(jeu), ['q1', 'q2', 'q3']);
  eq((await A.participants()).find((p) => p.cle === 'q').sessions, ['q3', 'q2', 'q1'], 'ordre');
});

check('Cas limites : participant sans aucune date (bornes null, ordre par session_no puis cree_le)', async (A) => {
  const jeu = [
    { id: 'nd-1', cree_le: '2026-02-03T08:00:00.000Z', identification: { code_sujet: 'ND', session_no: 2, date: '' } },
    { id: 'nd-2', cree_le: '2026-02-02T08:00:00.000Z', identification: { code_sujet: 'ND', session_no: 1, date: '' } },
    { id: 'nd-3', cree_le: '2026-02-01T08:00:00.000Z', identification: { code_sujet: 'ND', session_no: 2, date: '' } },
  ];
  await A.importer(sauvegarde(jeu), ['nd-1', 'nd-2', 'nd-3']);
  const p = (await A.participants()).find((x) => x.cle === 'nd');
  eq([p.premiere_date, p.derniere_date], [null, null], 'bornes');
  eq(p.sessions, ['nd-2', 'nd-3', 'nd-1'], 'ordre');
  await A.fiche('nd');
  assert(/ \| dates non renseignées \| édité le \d\d\/\d\d\/\d{4}$/.test(await A.texte('#participant-meta')), 'format de la meta : ' + await A.texte('#participant-meta'));
  eq((await A.lignesSessions()).map((l) => l.cellules.date), ['?', '?', '?'], 'dates du tableau');
  const g = await A.svg('axe1');
  eq(g.colonnes.map((c) => c.textes.map((t) => t.t).filter((t) => t === '?').length), [1, 1, 1], 'etiquette de date ? dans chaque colonne');
  await A.page.click('#btn-retour-liste');
  const l = (await A.lignesParticipants()).find((x) => x.attr === 'nd');
  eq([l.cellules.premiere, l.cellules.derniere], ['-', '-'], 'dates de la liste');
});

check('Cas limites : une seule session et aucune cotation (Z9) dans le modele du bilan', async (A) => {
  await A.ref();
  const b = await A.bilan('Z9');
  eq([b.nb_sessions, b.sessions.length, b.conditions], [1, 1, []], 'effectifs');
  eq(b.sessions[0], { rang: 1, id: 'z9-1', session_no: null, date: '2026-06-01', condition: '',
    scores: { axe1: null, axe2: null, axe3: null, axe4: null, total: null }, manquants: { axe1: 4, axe2: 4, axe3: 3, axe4: 3, total: 14 } }, 'session');
  b.scores.forEach((s) => { eq(s.points.length, 1, 'points ' + s.cle); eq(s.points[0].valeur, null, 'valeur ' + s.cle); eq(s.segments, [], 'segments ' + s.cle); });
  b.cotations_t0.concat(b.cotations_t1, b.t2).forEach((l) => { eq(l.cellules.length, 1, 'cellules'); eq(l.cellules[0].valeur, null, 'valeur'); });
});

check('Cas limites : suppression de la derniere session d\'un participant le fait disparaitre (derive)', async (A) => {
  await A.ref();
  await A.fiche('z9');
  await A.page.click('button[data-supprimer-session="z9-1"]');
  await A.page.waitForFunction(() => !document.querySelector('#participant-detail') || document.getElementById('participant-detail').hidden);
  eq((await A.participants()).map((p) => p.cle), ['p6', 'p7', 'p8', 's01', ''], 'participants');
  assert(await A.visible('#participants-liste'), 'retour a la liste attendu');
});

/* ================================================================== */
/* 3. Nouvelle session pour un participant (C1.5, C2.6)                */
/* ================================================================== */

async function nouvellePour(A, cle) {
  await A.fiche(cle);
  await A.page.click('#btn-nouvelle-pour-participant');
}

check('Nouvelle session pour S01 : champs stables de la derniere session, numero 4, vierge pour le reste (C7.14)', async (A) => {
  await A.ref();
  const avant = (await A.sessions()).length;
  await nouvellePour(A, 's01');
  const p = A.page;
  assert(!(await A.visible('#vue-participants')), 'la vue doit etre quittee');
  eq(await A.panneauxVisibles(), ['session'], 'etape affichee');
  eq(await p.inputValue('#f-code'), 'S01', '#f-code');
  eq(await p.inputValue('#f-session'), '4', '#f-session');
  assert(datesAcceptables().includes(await p.inputValue('#f-date')), '#f-date = jour courant, obtenu ' + await p.inputValue('#f-date'));
  eq(await p.inputValue('#f-age'), '15', '#f-age');
  eq(await p.inputValue('#f-diagnostic'), 'Polyhandicap', '#f-diagnostic');
  eq(await p.inputValue('#f-observateur'), 'OBS2', '#f-observateur (derniere session, pas s01-a)');
  eq(await p.inputValue('#f-installation-autre'), 'coussin', '#f-installation-autre');
  eq(await p.locator('input[name="sexe"]:checked').getAttribute('value'), 'F', 'sexe');
  eq(await p.locator('input[name="installation"]:checked').getAttribute('value'), 'autre', 'installation');
  eq(await p.locator('input[name="condition"]:checked').count(), 0, 'condition non cochee');
  eq([await p.inputValue('#f-debut'), await p.inputValue('#f-fin')], ['', ''], 'heures');
  const e = await A.st();
  eq(e.identification.code_sujet, 'S01', 'etat.code_sujet'); eq(e.identification.session_no, 4, 'etat.session_no');
  assert(!e.identification.condition, 'condition vide : ' + e.identification.condition);
  eq(Object.keys(e.cotations).length, 19, 'nombre de cotations');
  eq(Object.values(e.cotations).filter((v) => v !== null).length, 0, 'cotations non nulles');
  eq(e.scores.total, null, 'scores.total');
  eq([e.scores.axe1, e.scores.axe2, e.scores.axe3, e.scores.axe4], [null, null, null, null], 'scores des axes');
  eq(e.scores.manquants, { axe1: 4, axe2: 4, axe3: 3, axe4: 3, total: 14 }, 'manquants');
  eq([e.rupture.surprise, e.rupture.recherche, e.rupture.reprise, e.rupture.indifference, e.rupture.commentaire], [false, false, false, false, ''], 'rupture');
  T2K.forEach((k) => eq([e.t2[k].evolution, e.t2[k].details], [null, ''], 't2.' + k));
  PHYS.forEach((m) => TEMPS.forEach((t) => eq(e.physio[m][t], null, 'physio ' + m + t)));
  eq(e.v31_duree_sec, null, 'v31_duree_sec');
  eq([e.synthese.evenements, e.synthese.conclusion], ['', ''], 'synthese');
  eq((await A.sessions()).length, avant + 1, 'nombre de sessions');
});

check('Nouvelle session : devient courante et est enregistree immediatement (stockage, rechargement), identifiant et dates neufs', async (A) => {
  await A.ref();
  const idsAvant = (await A.sessions()).map((s) => s.id);
  const t0 = await A.page.evaluate(() => Date.now());
  await nouvellePour(A, 's01');
  const e = await A.st();
  assert(idsAvant.indexOf(e.id) < 0 && e.id, 'nouvel identifiant attendu : ' + e.id);
  eq(await A.courantStocke(), e.id, 'cle courante');
  const stock = await A.sessionsStockees();
  assert(stock.some((s) => s.id === e.id), 'session absente de localStorage');
  const t1 = await A.page.evaluate(() => Date.now());
  [e.cree_le, e.modifie_le].forEach((d) => { const t = Date.parse(d); assert(t >= t0 - 1500 && t <= t1 + 1500, 'horodatage non recent : ' + d); });
  await A.recharger();
  eq((await A.st()).id, e.id, 'session courante apres rechargement');
  eq((await A.sessions()).length, idsAvant.length + 1, 'sessions apres rechargement');
});

check('Nouvelle session : une deuxieme session creee sans perdre la premiere (numeros 4 puis 5)', async (A) => {
  await A.ref();
  await nouvellePour(A, 's01');
  const e1 = await A.st();
  await nouvellePour(A, 's01');
  const e2 = await A.st();
  assert(e1.id !== e2.id, 'deux identifiants distincts');
  eq([e1.identification.session_no, e2.identification.session_no], [4, 5], 'numeros');
  const sess = await A.sessions();
  eq(sess.length, 16, 'sessions (14 + 2)');
  assert(sess.some((s) => s.id === e1.id), 'la premiere session a ete perdue');
  eq((await A.participants()).find((p) => p.cle === 's01').nb_sessions, 5, 'sessions de S01');
});

check('Nouvelle session : numero = maximum + 1 (P7 donne 8), 1 si aucun numero (Z9) (C7.15)', async (A) => {
  await A.ref();
  await nouvellePour(A, 'p7');
  eq(await A.page.inputValue('#f-session'), '8', 'P7 (2, 7, 1)');
  eq(await A.page.inputValue('#f-code'), 'P7', 'code P7');
  await nouvellePour(A, 'z9');
  eq(await A.page.inputValue('#f-session'), '1', 'Z9 (session_no null)');
});

check('Nouvelle session : le maximum et non le nombre (numeros 1, 2, 7 -> 8) et ordre chronologique different du numero', async (A) => {
  const jeu = [
    { id: 'k1', cree_le: '2026-02-01T08:00:00.000Z', modifie_le: '2026-06-01T08:00:00.000Z', identification: { code_sujet: 'LAST', session_no: 7, date: '2026-03-01', age: 30, sexe: 'M', diagnostic: 'D-old', observateur: 'O-old', co_evaluateur: 'CO-old', installation: 'fauteuil' } },
    { id: 'k2', cree_le: '2026-02-02T08:00:00.000Z', modifie_le: '2026-01-01T08:00:00.000Z', identification: { code_sujet: 'LAST', session_no: 2, date: '2026-03-08', age: 31, sexe: 'F', diagnostic: 'D-new', observateur: 'O-new', co_evaluateur: 'CO-new', installation: 'corset' } },
    { id: 'k3', cree_le: '2026-02-03T08:00:00.000Z', modifie_le: '2026-02-01T08:00:00.000Z', identification: { code_sujet: 'LAST', session_no: 1, date: '2026-01-01', age: 29, sexe: 'F', diagnostic: 'D-first' } },
  ];
  await A.importer(sauvegarde(jeu), ['k1', 'k2', 'k3']);
  await nouvellePour(A, 'last');
  const p = A.page;
  eq(await p.inputValue('#f-session'), '8', 'max(7,2,1)+1');
  eq(await p.inputValue('#f-diagnostic'), 'D-new', 'copie depuis la derniere au sens chronologique (k2), pas la plus recemment modifiee (k1)');
  eq(await p.inputValue('#f-observateur'), 'O-new', 'observateur');
  eq(await p.inputValue('#f-coeval'), 'CO-new', 'co-evaluateur');
  eq(await p.inputValue('#f-age'), '31', 'age');
  eq(await p.locator('input[name="sexe"]:checked').getAttribute('value'), 'F', 'sexe');
  eq(await p.locator('input[name="installation"]:checked').getAttribute('value'), 'corset', 'installation');
  assert(!(await A.visible('#f-installation-autre')) || (await p.inputValue('#f-installation-autre')) === '', 'precision autre inattendue');
});

check('Nouvelle session : un champ vide de la derniere session est copie tel quel (pas de repli sur une session plus ancienne)', async (A) => {
  const jeu = [
    { id: 'v1', cree_le: '2026-02-01T08:00:00.000Z', identification: { code_sujet: 'VID', session_no: 1, date: '2026-03-01', diagnostic: 'ancien', observateur: 'OBS', sexe: 'M' } },
    { id: 'v2', cree_le: '2026-02-02T08:00:00.000Z', identification: { code_sujet: 'VID', session_no: 2, date: '2026-03-08', diagnostic: '', observateur: 'OBS2' } },
  ];
  await A.importer(sauvegarde(jeu), ['v1', 'v2']);
  await nouvellePour(A, 'vid');
  eq(await A.page.inputValue('#f-diagnostic'), '', 'diagnostic vide de v2');
  eq(await A.page.inputValue('#f-observateur'), 'OBS2', 'observateur de v2');
  eq(await A.page.locator('input[name="sexe"]:checked').count(), 0, 'sexe vide de v2');
});

check('Nouvelle session : fonctionne pour (sans code) (code vide, numero = max + 1)', async (A) => {
  await A.ref();
  const avant = await A.sessions();
  const nos = avant.filter((s) => !s.identification.code_sujet && typeof s.identification.session_no === 'number').map((s) => s.identification.session_no);
  const attendu = nos.length ? Math.max.apply(null, nos) + 1 : 1;
  await nouvellePour(A, '');
  eq(await A.page.inputValue('#f-code'), '', '#f-code');
  eq(await A.page.inputValue('#f-session'), String(attendu), '#f-session');
  eq((await A.sessions()).length, avant.length + 1, 'sessions');
  assert(!(await A.visible('#vue-participants')), 'vue quittee');
});

check('Nouvelle session : etape Session affichee, focus sur le premier bouton radio de condition (C2.6)', async (A) => {
  await A.ref();
  await nouvellePour(A, 's01');
  eq(await A.etapesCourantes(), ['session'], 'aria-current');
  await A.page.waitForFunction(() => { const a = document.activeElement; return a && a.getAttribute('name') === 'condition'; }, null, { timeout: 1500 });
  const premier = await A.page.evaluate(() => document.activeElement === document.querySelector('input[name="condition"]'));
  assert(premier, 'le focus doit etre sur le premier input[name="condition"]');
});

/* ================================================================== */
/* 4. Aide dans l'etape Session (C1.6)                                 */
/* ================================================================== */

async function nouvelleDuPanneau(A) {
  await A.panneau();
  await A.page.click('#btn-nouvelle');
  await A.go('session');
  await A.fermerPanneau();
}

check('Aide : masquee pour S et S0, visible pour s01 avec le nombre d\'autres sessions, masquee quand le code est efface (C7.16)', async (A) => {
  await A.ref();
  await nouvelleDuPanneau(A);
  const p = A.page;
  const etat = () => p.evaluate(() => { const b = document.getElementById('aide-participant'); return { cache: b.hidden || getComputedStyle(b).display === 'none', role: b.getAttribute('role'),
    texte: document.getElementById('aide-participant-texte').textContent.trim() }; });
  eq((await etat()).role, 'status', 'role');
  await p.fill('#f-code', 'S'); assert((await etat()).cache, 'visible pour S');
  await p.fill('#f-code', 'S0'); assert((await etat()).cache, 'visible pour S0');
  await p.fill('#f-code', 's01');
  const e = await etat();
  assert(!e.cache, 'aide masquee pour s01');
  eq(e.texte, 's01 : 3 sessions déjà enregistrées', 'texte');
  await p.fill('#f-code', '');
  assert((await etat()).cache, 'visible apres effacement');
  const ordre = await p.evaluate(() => { const a = document.getElementById('f-code-aide'); const b = document.getElementById('aide-participant');
    return !!a && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); });
  assert(ordre, '#aide-participant doit suivre #f-code-aide dans le document');
});

check('Aide : singulier (1 session), code tel que saisi, bouton et retour presents', async (A) => {
  await A.ref();
  await nouvelleDuPanneau(A);
  await A.page.fill('#f-code', 'Z9');
  eq(await A.texte('#aide-participant-texte'), 'Z9 : 1 session déjà enregistrée', 'texte singulier');
  assert(await A.visible('#btn-reprendre-champs'), 'bouton visible');
  eq(await A.texte('#btn-reprendre-champs'), 'Reprendre les champs de la dernière session', 'libelle du bouton');
  const h = await A.page.evaluate(() => document.getElementById('btn-reprendre-champs').getBoundingClientRect().height);
  assert(h >= 43.9, 'bouton de ' + h + ' px');
  eq(await A.texte('#aide-participant-retour'), '', 'retour vide au depart');
});

check('Aide : la session courante n\'est pas comptee et l\'aide suit le changement de session courante', async (A) => {
  await A.ref();
  await A.fiche('s01');
  await A.page.click('button[data-ouvrir-session="s01-b"]');
  await A.go('session');
  eq(await A.page.inputValue('#f-code'), 'S01', 'code de s01-b');
  eq(await A.texte('#aide-participant-texte'), 'S01 : 2 sessions déjà enregistrées', 'S01 sans la session courante');
  await A.fiche('z9');
  await A.page.click('button[data-ouvrir-session="z9-1"]');
  await A.go('session');
  assert(!(await A.visible('#aide-participant')), 'Z9 n\'a pas d\'autre session : aide masquee');
  await A.fiche('s01');
  await A.page.click('button[data-ouvrir-session="s01-a"]');
  await A.go('session');
  eq(await A.texte('#aide-participant-texte'), 'S01 : 2 sessions déjà enregistrées', 'apres remplir() d\'une autre session');
});

check('Reprise : champs vides remplis depuis la derniere session, champ renseigne conserve, retour 5 champs puis Aucun champ (C7.17)', async (A) => {
  await A.ref();
  await nouvelleDuPanneau(A);
  const p = A.page;
  await p.fill('#f-code', 's01');
  await p.fill('#f-diagnostic', 'Autre');
  const avant = { no: await p.inputValue('#f-session'), date: await p.inputValue('#f-date'), cond: await p.locator('input[name="condition"]:checked').count() };
  await p.click('#btn-reprendre-champs');
  eq(await p.inputValue('#f-diagnostic'), 'Autre', 'diagnostic conserve');
  eq(await p.locator('input[name="sexe"]:checked').getAttribute('value'), 'F', 'sexe');
  eq(await p.inputValue('#f-age'), '15', 'age');
  eq(await p.inputValue('#f-observateur'), 'OBS2', 'observateur');
  eq(await p.locator('input[name="installation"]:checked').getAttribute('value'), 'autre', 'installation');
  eq(await p.inputValue('#f-installation-autre'), 'coussin', 'precision');
  eq(await A.texte('#aide-participant-retour'), '5 champs repris', 'retour');
  eq({ no: await p.inputValue('#f-session'), date: await p.inputValue('#f-date'), cond: await p.locator('input[name="condition"]:checked').count() }, avant, 'session, date, condition inchangees');
  const e = await A.st();
  eq([e.identification.sexe, e.identification.age, e.identification.observateur, e.identification.diagnostic, e.identification.installation, e.identification.installation_autre],
    ['F', 15, 'OBS2', 'Autre', 'autre', 'coussin'], 'etat enregistre');
  await p.click('#btn-reprendre-champs');
  eq(await A.texte('#aide-participant-retour'), 'Aucun champ à reprendre', 'second clic');
  await p.fill('#f-code', 'S01');
  eq(await A.texte('#aide-participant-retour'), '', 'retour vide des que le texte principal change');
});

check('Reprise : installation_autre jamais copiee si l\'installation finale n\'est pas autre ; blancs consideres vides ; 4 champs repris', async (A) => {
  await A.ref();
  await nouvelleDuPanneau(A);
  const p = A.page;
  await p.fill('#f-code', 'S01');
  await A.clic('input[name="installation"][value="corset"]');
  await p.fill('#f-diagnostic', '   ');
  await p.click('#btn-reprendre-champs');
  eq(await p.locator('input[name="installation"]:checked').getAttribute('value'), 'corset', 'installation conservee');
  eq(await p.inputValue('#f-diagnostic'), 'Polyhandicap', 'diagnostic blanc remplace');
  const e = await A.st();
  eq(e.identification.installation_autre, '', 'installation_autre non copiee');
  eq(await A.texte('#aide-participant-retour'), '4 champs repris', 'retour (sexe, age, diagnostic, observateur)');
});

check('Reprise : une valeur vide de la source n\'est jamais copiee ; singulier « 1 champ repris »', async (A) => {
  const jeu = [
    { id: 'r1', cree_le: '2026-02-01T08:00:00.000Z', identification: { code_sujet: 'REP', session_no: 1, date: '2026-03-01', diagnostic: 'ancien', age: 40 } },
    { id: 'r2', cree_le: '2026-02-02T08:00:00.000Z', identification: { code_sujet: 'REP', session_no: 2, date: '2026-03-08', observateur: 'OBS-R', age: null, diagnostic: '' } },
  ];
  await A.importer(sauvegarde(jeu), ['r1', 'r2']);
  await nouvelleDuPanneau(A);
  await A.page.fill('#f-code', 'rep');
  await A.page.click('#btn-reprendre-champs');
  eq(await A.page.inputValue('#f-observateur'), 'OBS-R', 'observateur');
  eq(await A.page.inputValue('#f-diagnostic'), '', 'diagnostic vide de la derniere session non remplace par l\'ancien');
  eq(await A.page.inputValue('#f-age'), '', 'age null non copie');
  eq(await A.texte('#aide-participant-retour'), '1 champ repris', 'retour');
});

/* ================================================================== */
/* 5. Vue « Participants et bilans » (C2)                              */
/* ================================================================== */

check('Vue : ouverture, section[data-panel] inchanges, aria-current, focus, retour a la saisie (C7.8)', async (A) => {
  await A.ref();
  const p = A.page;
  await A.go('t1');
  eq(await p.locator('section[data-panel]').count(), 6, 'section[data-panel] avant');
  assert(!(await A.visible('#vue-participants')), 'vue visible avant ouverture');
  assert(!(await p.evaluate(() => document.getElementById('btn-participants').hasAttribute('aria-current'))), 'aria-current present avant ouverture');
  await p.click('#btn-participants');
  assert(await A.visible('#vue-participants'), 'vue non visible');
  const r = await p.evaluate(() => ({
    h: ['contenu', 'barre-etapes'].map((i) => document.getElementById(i).hidden).concat([document.querySelector('.nav-bas').hidden]),
    cur: document.getElementById('btn-participants').getAttribute('aria-current'),
    focus: document.activeElement && document.activeElement.id,
    panels: document.querySelectorAll('section[data-panel]').length,
    t1: !document.querySelector('section[data-panel="t1"]').hidden,
    dp: document.getElementById('vue-participants').hasAttribute('data-panel'),
    tag: document.getElementById('vue-participants').tagName,
    lab: document.getElementById('vue-participants').getAttribute('aria-labelledby'),
    h2: document.getElementById('titre-participants').tagName + '|' + document.getElementById('titre-participants').getAttribute('tabindex'),
    titre: document.getElementById('titre-participants').textContent.trim(),
  }));
  eq(r.h, [true, true, true], 'hidden sur #contenu, #barre-etapes, .nav-bas');
  eq(r.cur, 'page', 'aria-current');
  eq(r.focus, 'titre-participants', 'focus');
  eq(r.panels, 6, 'section[data-panel] apres'); eq(r.dp, false, 'data-panel sur la vue');
  eq(r.tag, 'SECTION', 'balise de la vue'); eq(r.lab, 'titre-participants', 'aria-labelledby');
  eq(r.h2, 'H2|-1', 'titre H2 tabindex -1'); eq(r.titre, 'Participants et bilans', 'titre');
  assert(r.t1, 'la section t1 doit conserver son etat');
  assert(await A.visible('#btn-retour-saisie'), '#btn-retour-saisie invisible');
  await p.click('#btn-retour-saisie');
  const s = await p.evaluate(() => ({
    h: ['contenu', 'barre-etapes'].map((i) => document.getElementById(i).hidden).concat([document.querySelector('.nav-bas').hidden]),
    vue: document.getElementById('vue-participants').hidden,
    cur: document.getElementById('btn-participants').hasAttribute('aria-current'),
    focus: document.activeElement && document.activeElement.id,
  }));
  eq(s.h, [false, false, false], 'hidden retire'); eq(s.vue, true, 'vue cachee'); eq(s.cur, false, 'aria-current retire'); eq(s.focus, 'btn-participants', 'focus rendu');
  eq(await A.panneauxVisibles(), ['t1'], 'etape inchangee'); eq(await A.etapesCourantes(), ['t1'], 'aria-current de l\'etape');
});

check('Vue : emplacement dans le document (entre header et main), bouton avant #btn-sessions, meme gabarit', async (A) => {
  const r = await A.page.evaluate(() => {
    const vue = document.getElementById('vue-participants'); const h = document.querySelector('header'); const m = document.querySelector('main');
    const bp = document.getElementById('btn-participants'); const bs = document.getElementById('btn-sessions');
    const F = Node.DOCUMENT_POSITION_FOLLOWING;
    return { apresHeader: !!(h.compareDocumentPosition(vue) & F), avantMain: !!(vue.compareDocumentPosition(m) & F), horsHeader: !h.contains(vue), horsMain: !m.contains(vue),
      avantSessions: !!(bp.compareDocumentPosition(bs) & F), memeParent: bp.parentElement === bs.parentElement, texte: bp.textContent.trim(), tag: bp.tagName,
      classes: [...bs.classList].every((c) => bp.classList.contains(c)),
      hp: bp.getBoundingClientRect().height, hs: bs.getBoundingClientRect().height };
  });
  assert(r.apresHeader && r.avantMain && r.horsHeader && r.horsMain, 'la vue doit etre placee entre <header> et <main> : ' + JSON.stringify(r));
  assert(r.avantSessions && r.memeParent, '#btn-participants doit preceder #btn-sessions dans le meme conteneur');
  eq(r.texte, 'Participants et bilans', 'libelle'); eq(r.tag, 'BUTTON', 'balise');
  assert(r.classes, '#btn-participants doit reprendre les classes de #btn-sessions');
  proche(r.hp, r.hs, 1, 'hauteur du bouton d\'en-tete');
});

check('Vue : message, retour, sous-vues exclusives, liste puis fiche (structure et ordre C2.3)', async (A) => {
  await A.ref();
  const p = A.page;
  await A.liste();
  eq(await p.evaluate(() => { const m = document.getElementById('message-participants'); return [m.tagName, m.getAttribute('role'), m.textContent.trim()]; }), ['P', 'status', ''], '#message-participants');
  assert(await A.visible('#btn-retour-saisie'), 'retour a la saisie invisible dans la liste');
  assert(!(await A.visible('#participant-detail')), 'fiche visible dans la liste');
  await A.fiche('s01');
  assert(!(await A.visible('#participants-liste')), 'liste visible dans la fiche');
  assert(await A.visible('#btn-retour-saisie'), 'retour a la saisie invisible dans la fiche');
  const r = await p.evaluate(() => {
    const ids = ['btn-retour-liste', 'participant-titre', 'participant-meta', 'btn-nouvelle-pour-participant', 'btn-xlsx-participant', 'btn-pdf-bilan', 'aide-pdf', 'avertissement-detail', 'table-sessions-participant', 'bilan'];
    const el = ids.map((i) => document.getElementById(i));
    const F = Node.DOCUMENT_POSITION_FOLLOWING;
    return { presents: el.map((e) => !!e), ordre: el.every((e, i) => i === 0 || !e || !el[i - 1] || !!(el[i - 1].compareDocumentPosition(e) & F)),
      titre: el[1].tagName + '|' + el[1].getAttribute('tabindex') + '|' + el[1].textContent.trim(),
      hi: [el[3], el[4], el[5], el[6]].map((e) => e.classList.contains('hors-impression')),
      aide: el[6].textContent.trim(), retour: el[0].textContent.trim(),
      btns: [el[3], el[4], el[5]].map((e) => e.textContent.trim()), dansDetail: el.every((e) => document.getElementById('participant-detail').contains(e)) };
  });
  eq(r.presents, ids10(), 'elements de la fiche');
  assert(r.ordre, 'ordre des elements de la fiche non conforme a C2.3');
  assert(r.dansDetail, 'elements hors de #participant-detail');
  eq(r.titre, 'H3|-1|S01', '#participant-titre');
  eq(r.hi, [true, true, true, true], 'classe hors-impression des 3 actions et de l\'aide');
  eq(r.btns, ['Nouvelle session pour ce participant', 'Exporter les scores (Excel)', 'Exporter le bilan (PDF)'], 'libelles des actions');
  eq(r.retour, 'Tous les participants', 'retour a la liste');
  eq(r.aide, 'Dans la fenêtre d\'impression, choisissez « Enregistrer au format PDF » comme destination.', 'aide PDF');
  await p.click('#btn-retour-liste');
  assert(await A.visible('#participants-liste') && !(await A.visible('#participant-detail')), 'retour a la liste');
});
function ids10() { return [true, true, true, true, true, true, true, true, true, true]; }

check('Vue : liste (6 lignes, cellules, tri, compte, libelles) (C7.9)', async (A) => {
  await A.ref();
  await A.liste();
  const L = await A.lignesParticipants();
  eq(L.map((l) => l.attr), ['p6', 'p7', 'p8', 's01', 'z9', ''], 'tr[data-participant]');
  const s = L.find((l) => l.attr === 's01').cellules;
  eq([s.nb, s.premiere, s.derniere, s.conditions], ['3', '02/03/2026', '16/03/2026', 'A, B, C'], 'ligne s01');
  eq(L.find((l) => l.attr === 'p6').cellules.conditions, '-', 'conditions de p6');
  eq(L.find((l) => l.attr === 'p8').cellules.conditions, 'A, B', 'conditions de p8 (condition vide ignoree)');
  eq(L.map((l) => l.cellules.code), ['P6', 'P7', 'P8', 'S01', 'Z9', '(sans code)'], 'code (libelle)');
  eq(await A.texte('#participants-compte'), '6 participants, 14 sessions', 'compteur');
  const t = await A.page.evaluate(() => {
    const tb = document.getElementById('table-participants');
    return { label: tb.getAttribute('aria-label'), ths: [...tb.querySelectorAll('th')].map((x) => x.textContent.trim()), cls: tb.classList.contains('tableau-cartes'),
      btns: [...tb.querySelectorAll('td[data-col="code"] button')].map((b) => b.getAttribute('data-ouvrir-participant')) };
  });
  eq(t.label, 'Participants', 'aria-label'); eq(t.ths, ['Code', 'Sessions', 'Première date', 'Dernière date', 'Conditions'], 'en-tetes');
  assert(t.cls, 'classe tableau-cartes absente'); eq(t.btns, ['p6', 'p7', 'p8', 's01', 'z9', ''], 'data-ouvrir-participant');
  eq(await A.texte('#btn-xlsx-tous'), 'Exporter tous les participants (Excel)', 'libelle de #btn-xlsx-tous');
});

check('Vue : compteur au singulier (« 1 participant, 1 session ») sur une installation neuve', async (A) => {
  await A.liste();
  eq(await A.texte('#participants-compte'), '1 participant, 1 session', 'compteur');
  const L = await A.lignesParticipants();
  eq(L.length, 1, 'lignes'); eq(L[0].attr, '', 'data-participant du groupe sans code'); eq(L[0].cellules.code, '(sans code)', 'libelle');
});

check('Vue : la liste lit l\'etat courant (code saisi dans la session vierge) et tient compte d\'une graphie differente', async (A) => {
  await A.ref();
  await A.go('session');
  await A.page.fill('#f-code', 'NEWP');
  await A.liste();
  const L = await A.lignesParticipants();
  eq(L.map((l) => l.attr), ['newp', 'p6', 'p7', 'p8', 's01', 'z9'], 'lignes');
  eq(L[0].cellules.code, 'NEWP', 'libelle = graphie');
  eq(await A.texte('#participants-compte'), '6 participants, 14 sessions', 'compteur');
});

check('Vue : fiche S01, titre et meta au format exact, ouvrirParticipants (C7.10)', async (A) => {
  await A.ref();
  await A.fiche('s01');
  eq(await A.texte('#participant-titre'), 'S01', 'titre');
  const m = await A.texte('#participant-meta');
  const ok = datesAcceptables().map((d) => '3 sessions | du 02/03/2026 au 16/03/2026 | édité le ' + fr(d));
  assert(ok.includes(m), 'meta : ' + m + ' (attendu ' + ok[0] + ')');
  await A.fiche('p6');
  const m6 = await A.texte('#participant-meta');
  assert(datesAcceptables().map((d) => '3 sessions | le 06/04/2026 | édité le ' + fr(d)).includes(m6), 'meta P6 : ' + m6);
  await A.fiche('z9');
  const m9 = await A.texte('#participant-meta');
  assert(datesAcceptables().map((d) => '1 session | le 01/06/2026 | édité le ' + fr(d)).includes(m9), 'meta Z9 : ' + m9);
  const r = await A.page.evaluate(() => [window.GrilleHaptique.ouvrirParticipants('s01'), window.GrilleHaptique.ouvrirParticipants('zzz'),
    window.GrilleHaptique.ouvrirParticipants(), window.GrilleHaptique.ouvrirParticipants('S01')]);
  eq(r, [true, false, false, true], 'valeurs de retour de ouvrirParticipants');
});

check('Vue : ouvrirParticipants() liste puis fiche, focus selon la sous-vue, sans effet sur les donnees', async (A) => {
  await A.ref();
  const avant = await A.sessions();
  const foc = () => A.page.evaluate(() => document.activeElement && document.activeElement.id);
  await A.page.evaluate(() => window.GrilleHaptique.ouvrirParticipants());
  assert(await A.visible('#participants-liste') && !(await A.visible('#participant-detail')), 'liste attendue sans argument');
  await A.page.waitForFunction(() => document.activeElement && document.activeElement.id === 'titre-participants', null, { timeout: 1500 });
  assert(await A.page.evaluate(() => window.GrilleHaptique.ouvrirParticipants('zzz')) === false, 'code inconnu');
  assert(await A.visible('#participants-liste'), 'liste affichee pour un code inconnu');
  await A.page.click('#btn-retour-saisie');
  assert(await A.page.evaluate(() => window.GrilleHaptique.ouvrirParticipants('P8')) === true, 'P8');
  assert(await A.visible('#participant-detail'), 'fiche P8');
  await A.page.waitForFunction(() => document.activeElement && document.activeElement.id === 'participant-titre', null, { timeout: 1500 });
  eq(await A.texte('#participant-titre'), 'P8', 'titre'); eq(await foc(), 'participant-titre', 'focus');
  eq(await A.sessions(), avant, 'sessions inchangees');
});

check('Vue : tableau des sessions (ordre, cellules, en-tetes, actions) (C7.11)', async (A) => {
  await A.ref();
  await A.fiche('s01');
  const L = await A.lignesSessions();
  eq(L.map((l) => l.attr), ['s01-a', 's01-b', 's01-c'], 'ordre'); eq(L.map((l) => l.rang), ['1', '2', '3'], 'data-rang');
  const b = L[1].cellules;
  eq([b.no, b.date, b.condition, b.axe1, b.axe2, b.axe3, b.axe4, b.total, b.manquants], ['2', '09/03/2026', 'B', '6', '6', '6', '5', '23', '0'], 'ligne b');
  const c = L[2].cellules;
  eq([c.axe1, c.axe2, c.axe3, c.axe4, c.total, c.manquants], ['-2', '-', '9', '9', '16', '4'], 'ligne c');
  eq(L[0].cellules.manquants, '2', 'manquants de a');
  eq([L[0].cellules.axe1, L[0].cellules.total], ['1', '3'], 'ligne a');
  const t = await A.page.evaluate(() => {
    const tb = document.getElementById('table-sessions-participant');
    const act = tb.querySelector('tr[data-session-id="s01-b"] td[data-col="actions"]');
    return { label: tb.getAttribute('aria-label'), ths: [...tb.querySelectorAll('th')].map((x) => x.textContent.trim()), cls: tb.classList.contains('tableau-cartes'),
      actHi: act.classList.contains('hors-impression'),
      o: [...act.querySelectorAll('button')].map((x) => [x.textContent.trim(), x.getAttribute('data-ouvrir-session'), x.getAttribute('data-supprimer-session'), x.classList.contains('btn-danger')]) };
  });
  eq(t.label, 'Sessions et scores du participant S01', 'aria-label');
  eq(t.ths, ['N°', 'Date', 'Condition', 'Axe 1', 'Axe 2', 'Axe 3', 'Axe 4', 'Indice global', 'Manquants (sur 14)', 'Actions'], 'en-tetes');
  assert(t.cls, 'tableau-cartes'); assert(t.actHi, 'td actions sans hors-impression');
  eq(t.o, [['Ouvrir', 's01-b', null, false], ['Supprimer', null, 's01-b', true]], 'boutons d\'action');
});

check('Vue : tableau des sessions, session sans numero ni condition ni score (Z9) : ?, -, 14', async (A) => {
  await A.ref();
  await A.fiche('z9');
  const L = await A.lignesSessions();
  eq(L.length, 1, 'lignes');
  const c = L[0].cellules;
  eq([c.no, c.date, c.condition, c.axe1, c.axe2, c.axe3, c.axe4, c.total, c.manquants], ['?', '01/06/2026', '?', '-', '-', '-', '-', '-', '14'], 'cellules');
});

check('Vue : les scores du tableau sont recalcules, jamais lus dans le champ scores stocke', async (A) => {
  const s = blank({ id: 'faux-1', identification: { code_sujet: 'FAUX', session_no: 1, date: '2026-02-01', condition: 'A' },
    cotations: { 'V1.1': 1, 'V1.2': 1, 'V1.3': 1, 'V1.4': 2 },
    scores: { axe1: 99, axe2: 99, axe3: 99, axe4: 99, total: 99, manquants: { axe1: 0, axe2: 0, axe3: 0, axe4: 0, total: 0 } } });
  await A.importer(s, ['faux-1']);
  const b = await A.bilan('FAUX');
  eq(b.sessions[0].scores, { axe1: 1, axe2: null, axe3: null, axe4: null, total: 1 }, 'scores du bilan');
  eq(b.sessions[0].manquants, { axe1: 0, axe2: 4, axe3: 3, axe4: 3, total: 10 }, 'manquants du bilan');
  await A.fiche('faux');
  const c = (await A.lignesSessions())[0].cellules;
  eq([c.axe1, c.axe2, c.total, c.manquants], ['1', '-', '1', '10'], 'tableau');
});

check('Vue : Ouvrir une session depuis la fiche (vue fermee, session courante, etape Session) (C7.12)', async (A) => {
  await A.ref();
  await A.go('t1');
  await A.fiche('s01');
  await A.page.click('button[data-ouvrir-session="s01-b"]');
  assert(!(await A.visible('#vue-participants')), 'vue encore visible');
  eq((await A.st()).id, 's01-b', 'etat().id'); eq(await A.page.inputValue('#f-session'), '2', '#f-session');
  eq(await A.page.inputValue('#f-code'), 'S01', '#f-code');
  eq(await A.panneauxVisibles(), ['session'], 'etape'); eq(await A.etapesCourantes(), ['session'], 'aria-current');
  eq(await A.courantStocke(), 's01-b', 'cle courante');
  const h = await A.page.evaluate(() => ['contenu', 'barre-etapes'].map((i) => document.getElementById(i).hidden).concat([document.querySelector('.nav-bas').hidden]));
  eq(h, [false, false, false], 'zones de saisie reaffichees');
});

check('Vue : Supprimer depuis la fiche, confirmation refusee puis acceptee, stockage, retour a la liste (C7.13)', async (A) => {
  await A.ref();
  await A.fiche('s01');
  const avant = await A.sessions();
  A.modeDialogue = 'dismiss';
  await A.page.click('button[data-supprimer-session="s01-b"]');
  await A.page.waitForTimeout(200);
  eq(A.dialogs.length, 1, 'nombre de confirmations');
  assert(A.dialogs[0].includes('Supprimer la session S01 (S2, 09/03/2026)'), 'message : ' + JSON.stringify(A.dialogs[0]));
  assert(/Cette action est définitive\./.test(A.dialogs[0]), 'message sans « Cette action est définitive. » : ' + JSON.stringify(A.dialogs[0]));
  eq(await A.sessions(), avant, 'rien ne change apres refus');
  eq((await A.lignesSessions()).length, 3, 'lignes apres refus');
  A.modeDialogue = 'accept';
  await A.page.click('button[data-supprimer-session="s01-b"]');
  await A.page.waitForFunction(() => document.querySelectorAll('#table-sessions-participant tr[data-session-id]').length === 2);
  const L = await A.lignesSessions();
  eq(L.map((l) => l.attr), ['s01-a', 's01-c'], 'lignes'); eq(L.map((l) => l.rang), ['1', '2'], 'rangs');
  const b = await A.bilan('S01');
  eq([b.nb_sessions, b.sessions.map((s) => s.rang)], [2, [1, 2]], 'bilan');
  assert(!(await A.sessionsStockees()).some((s) => s.id === 's01-b'), 'localStorage non mis a jour');
  eq(await A.texte('#participant-meta').then((t) => t.split(' | ')[0]), '2 sessions', 'meta');
  await A.page.click('button[data-supprimer-session="s01-a"]');
  await A.page.waitForFunction(() => document.querySelectorAll('#table-sessions-participant tr[data-session-id]').length === 1);
  await A.page.click('button[data-supprimer-session="s01-c"]');
  await A.page.waitForFunction(() => document.getElementById('participants-liste') && !document.getElementById('participants-liste').hidden);
  assert(!(await A.visible('#participant-detail')), 'fiche encore visible');
  eq((await A.lignesParticipants()).map((l) => l.attr), ['p6', 'p7', 'p8', 'z9', ''], 'lignes de la liste');
  eq(await A.texte('#participants-compte'), '5 participants, 11 sessions', 'compteur');
  assert(await A.visible('#vue-participants'), 'la vue ne doit pas etre quittee');
});

check('Vue : retour a la saisie depuis la fiche, etape et session inchangees', async (A) => {
  await A.ref();
  await A.go('t2');
  const id = (await A.st()).id;
  await A.fiche('p8');
  await A.page.click('#btn-retour-saisie');
  assert(!(await A.visible('#vue-participants')), 'vue visible');
  eq(await A.panneauxVisibles(), ['t2'], 'etape'); eq((await A.st()).id, id, 'session courante');
});

async function ouvrirVueEtPanneau(A) { await A.fiche('s01'); await A.panneau(); }

check('Sortie de la vue : allerA(cle) quitte la vue avant d\'afficher l\'etape', async (A) => {
  await A.ref();
  await A.fiche('s01');
  await A.page.evaluate(() => window.GrilleHaptique.allerA('t1'));
  assert(!(await A.visible('#vue-participants')), 'vue visible'); eq(await A.panneauxVisibles(), ['t1'], 'etape');
  eq(await A.page.evaluate(() => document.getElementById('btn-participants').hasAttribute('aria-current')), false, 'aria-current');
  assert(await A.visible('#barre-etapes'), 'barre d\'etapes cachee');
});

check('Sortie de la vue : #btn-nouvelle du panneau Sessions', async (A) => {
  await A.ref();
  const n = (await A.sessions()).length;
  await ouvrirVueEtPanneau(A);
  await A.page.click('#btn-nouvelle');
  assert(!(await A.visible('#vue-participants')), 'vue visible');
  eq((await A.sessions()).length, n + 1, 'sessions');
  eq(await A.page.evaluate(() => document.getElementById('contenu').hidden), false, '#contenu');
});

check('Sortie de la vue : « Ouvrir » du panneau Sessions', async (A) => {
  await A.ref();
  await A.fiche('s01');
  const b = await A.boutonPanneau('ouvrir', 's01-b', ['S01']);
  await b.click();
  assert(!(await A.visible('#vue-participants')), 'vue visible');
  assert(['s01-a', 's01-b', 's01-c'].includes((await A.st()).id), 'session courante : ' + (await A.st()).id);
});

check('Sortie de la vue : #btn-imprimer (impression de session) quitte la vue avant window.print()', async (A) => {
  await A.ref();
  await A.espionPrint();
  await ouvrirVueEtPanneau(A);
  await A.page.click('#btn-imprimer');
  await A.page.waitForFunction(() => window.__prints.length >= 1);
  const pr = await A.page.evaluate(() => window.__prints);
  eq(pr.length, 1, 'appels a print');
  eq(pr[0], { attr: null, vueCachee: true }, 'etat de la page pendant print()');
  assert(!(await A.visible('#vue-participants')), 'vue visible apres');
});

check('Sortie de la vue : « Effacer les donnees de ce poste »', async (A) => {
  await A.ref();
  await ouvrirVueEtPanneau(A);
  await A.page.click('#btn-effacer-tout');
  await A.page.waitForFunction(() => window.GrilleHaptique.sessions().length <= 1);
  assert(!(await A.visible('#vue-participants')), 'vue visible apres effacement');
  assert(A.dialogs.length >= 1, 'confirmation attendue');
});

check('Vue ouverte : le panneau Sessions s\'ouvre par-dessus sans fermer la vue ni changer le resume de session', async (A) => {
  await A.ref();
  const avant = await A.texte('#resume-session');
  await A.fiche('s01');
  await A.page.click('#btn-sessions');
  assert(await A.visible('#panneau-sessions'), 'panneau invisible');
  assert(await A.visible('#vue-participants'), 'vue fermee par l\'ouverture du panneau');
  eq(await A.texte('#resume-session'), avant, 'resume de session');
  eq(await A.page.evaluate(() => document.getElementById('btn-participants').getAttribute('aria-current')), 'page', 'aria-current');
});

check('Vue ouverte : suppression depuis le panneau Sessions redessine la fiche sans quitter la vue', async (A) => {
  await A.ref();
  await A.fiche('s01');
  const b = await A.boutonPanneau('supprimer', 's01-b', ['S01', '09/03/2026|2026-03-09|09/03/26']);
  await b.click();
  await A.page.waitForFunction(() => document.querySelectorAll('#table-sessions-participant tr[data-session-id]').length === 2);
  eq((await A.lignesSessions()).map((l) => l.attr), ['s01-a', 's01-c'], 'lignes');
  assert(await A.visible('#vue-participants'), 'vue quittee');
  eq((await A.texte('#participant-meta')).split(' | ')[0], '2 sessions', 'meta');
});

check('Vue ouverte : suppression du dernier session du participant affiche depuis le panneau = retour a la liste', async (A) => {
  await A.ref();
  await A.fiche('z9');
  const b = await A.boutonPanneau('supprimer', 'z9-1', ['Z9']);
  await b.click();
  await A.page.waitForFunction(() => !document.querySelector('#participants-liste').hidden);
  assert(!(await A.visible('#participant-detail')), 'fiche visible');
  eq((await A.lignesParticipants()).map((l) => l.attr), ['p6', 'p7', 'p8', 's01', ''], 'liste');
  assert(await A.visible('#vue-participants'), 'vue quittee');
});

check('Vue ouverte : import depuis le panneau Sessions met a jour la fiche et la liste', async (A) => {
  await A.ref();
  await A.fiche('p8');
  eq((await A.lignesSessions()).length, 3, 'lignes avant');
  await A.importer({ id: 'p8-4', identification: { code_sujet: 'P8', session_no: 4, date: '2026-05-22', condition: 'C' } }, ['p8-4']);
  await A.page.waitForFunction(() => document.querySelectorAll('#table-sessions-participant tr[data-session-id]').length === 4);
  eq((await A.lignesSessions()).map((l) => l.attr), ['p8-1', 'p8-2', 'p8-3', 'p8-4'], 'lignes apres import');
  eq(await A.page.evaluate(() => document.querySelectorAll('svg[data-graphique="axe3"] g[data-point]').length), 4, 'points du graphique');
  assert(await A.visible('#vue-participants'), 'vue quittee');
  await A.page.click('#btn-retour-liste');
  await A.importer({ id: 'nv-1', identification: { code_sujet: 'ZZNEW', session_no: 1, date: '2026-07-01' } }, ['nv-1']);
  await A.page.waitForFunction(() => document.querySelectorAll('#table-participants tr[data-participant]').length === 7);
  eq(await A.texte('#participants-compte'), '7 participants, 16 sessions', 'compteur apres import');
});

check('Vue : un rechargement revient a la saisie ; aucune nouvelle cle de stockage apres un parcours de la vue', async (A) => {
  await A.ref();
  const cles0 = await A.clesStockage();
  await A.fiche('s01');
  await A.page.click('#btn-retour-liste');
  await A.page.click('#btn-xlsx-tous').catch(() => {});
  await A.fiche('s01');
  await A.page.evaluate(() => { window.print = function () {}; });
  await A.page.click('#btn-pdf-bilan');
  await A.page.click('#btn-nouvelle-pour-participant');
  const cles1 = await A.clesStockage();
  eq(cles1, cles0, 'cles localStorage/sessionStorage');
  await A.ouvrirVue();
  await A.recharger();
  assert(!(await A.visible('#vue-participants')), 'vue visible apres rechargement');
  eq(await A.page.evaluate(() => document.getElementById('contenu').hidden), false, '#contenu');
  eq(await A.clesStockage(), cles0, 'cles apres rechargement');
  assert(cles0.l.every((k) => k.indexOf('grilleHaptique.v1.') === 0), 'cles inattendues : ' + cles0.l.join(','));
});

/* ================================================================== */
/* 6. bilan(code) (C3.2, C3.3, C7.5 a C7.7)                            */
/* ================================================================== */

function toutesCles(o, prefixe, sortie) {
  if (o === null || typeof o !== 'object') return sortie;
  Object.keys(o).forEach((k) => { sortie.push(prefixe + k); toutesCles(o[k], prefixe + k + '.', sortie); });
  return sortie;
}

check('bilan : format JSON exact (cles de chaque niveau, JSON pur, schema)', async (A) => {
  await A.ref();
  const b = await A.bilan('S01');
  eq(Object.keys(b).sort(), ['schema', 'code', 'cle', 'libelle', 'nb_sessions', 'premiere_date', 'derniere_date', 'conditions', 'sessions', 'scores', 'cotations_t0', 'cotations_t1', 't2'].sort(), 'cles du bilan');
  eq(b.schema, 'grille-haptique-bilan/1', 'schema');
  eq([b.code, b.cle, b.libelle, b.nb_sessions, b.premiere_date, b.derniere_date, b.conditions], ['S01', 's01', 'S01', 3, '2026-03-02', '2026-03-16', ['A', 'B', 'C']], 'en-tete');
  eq(Object.keys(b.sessions[0]).sort(), ['rang', 'id', 'session_no', 'date', 'condition', 'scores', 'manquants'].sort(), 'cles de sessions[]');
  eq(Object.keys(b.sessions[0].scores).sort(), SCORE_KEYS.slice().sort(), 'cles de sessions[].scores');
  eq(Object.keys(b.sessions[0].manquants).sort(), SCORE_KEYS.slice().sort(), 'cles de sessions[].manquants');
  eq(Object.keys(b.scores[0]).sort(), ['cle', 'nom', 'min', 'max', 'graduations', 'points', 'segments'].sort(), 'cles de scores[]');
  eq(Object.keys(b.scores[0].points[0]).sort(), ['rang', 'session_id', 'session_no', 'date', 'condition', 'valeur', 'manquants'].sort(), 'cles de points[]');
  eq(Object.keys(b.cotations_t1[0]).sort(), ['code', 'intitule', 'axe', 'inverse', 'cellules'].sort(), 'cles de cotations_t1[]');
  eq(Object.keys(b.cotations_t0[0]).sort(), ['code', 'intitule', 'axe', 'inverse', 'cellules'].sort(), 'cles de cotations_t0[]');
  eq(Object.keys(b.cotations_t1[0].cellules[0]).sort(), ['rang', 'session_id', 'valeur'], 'cles de cellules[]');
  eq(Object.keys(b.t2[0]).sort(), ['cle', 'libelle', 'libelle_complet', 'cellules'].sort(), 'cles de t2[]');
  eq(Object.keys(b.t2[0].cellules[0]).sort(), ['rang', 'session_id', 'valeur'], 'cles de t2[].cellules[]');
  const pur = await A.page.evaluate(() => {
    const b = window.GrilleHaptique.bilan('S01'); const pb = [];
    const marche = (x, chemin) => {
      if (x === undefined) pb.push(chemin + ' undefined');
      else if (typeof x === 'function') pb.push(chemin + ' fonction');
      else if (typeof x === 'number' && !isFinite(x)) pb.push(chemin + ' non fini');
      else if (x && typeof x === 'object') {
        if (!(Array.isArray(x) || Object.getPrototypeOf(x) === Object.prototype)) pb.push(chemin + ' objet non simple');
        Object.keys(x).forEach((k) => marche(x[k], chemin + '.' + k));
      }
    };
    marche(b, 'bilan');
    return { pb, egal: JSON.stringify(b) === JSON.stringify(JSON.parse(JSON.stringify(b))) };
  });
  eq(pur.pb, [], 'valeurs non JSON'); assert(pur.egal, 'le bilan n\'est pas invariant par JSON');
  eq(b.scores.length, 5, '5 scores'); eq(b.cotations_t0.length, 5, 'lignes T0'); eq(b.cotations_t1.length, 14, 'lignes T1'); eq(b.t2.length, 4, 'lignes T2');
});

check('bilan : scores et manquants de S01 (C7.5)', async (A) => {
  await A.ref();
  const b = await A.bilan('S01');
  eq(b.scores.map((s) => s.cle), SCORE_KEYS, 'ordre des scores');
  const val = (k) => b.scores.find((s) => s.cle === k).points.map((p) => p.valeur);
  const man = (k) => b.scores.find((s) => s.cle === k).points.map((p) => p.manquants);
  eq(val('axe1'), [1, 6, -2], 'axe1'); eq(val('axe2'), [0, 6, null], 'axe2'); eq(val('axe3'), [1, 6, 9], 'axe3');
  eq(val('axe4'), [1, 5, 9], 'axe4'); eq(val('total'), [3, 23, 16], 'total');
  eq(man('axe3'), [1, 0, 0], 'manquants axe3'); eq(man('axe4'), [1, 0, 0], 'manquants axe4'); eq(man('axe2'), [0, 0, 4], 'manquants axe2');
  eq(man('total'), [2, 0, 4], 'manquants total'); eq(man('axe1'), [0, 0, 0], 'manquants axe1');
  eq(b.scores[0].points.map((p) => p.condition), ['A', 'B', 'C'], 'conditions');
  eq(b.scores[0].points.map((p) => [p.rang, p.session_id, p.session_no, p.date]),
    [[1, 's01-a', 1, '2026-03-02'], [2, 's01-b', 2, '2026-03-09'], [3, 's01-c', 3, '2026-03-16']], 'rang, session, numero, date');
  eq(b.scores.map((s) => [s.min, s.max]), [[-3, 9], [0, 12], [0, 9], [0, 9], [-3, 39]], 'min/max');
  eq(b.sessions, [
    { rang: 1, id: 's01-a', session_no: 1, date: '2026-03-02', condition: 'A', scores: { axe1: 1, axe2: 0, axe3: 1, axe4: 1, total: 3 }, manquants: { axe1: 0, axe2: 0, axe3: 1, axe4: 1, total: 2 } },
    { rang: 2, id: 's01-b', session_no: 2, date: '2026-03-09', condition: 'B', scores: { axe1: 6, axe2: 6, axe3: 6, axe4: 5, total: 23 }, manquants: { axe1: 0, axe2: 0, axe3: 0, axe4: 0, total: 0 } },
    { rang: 3, id: 's01-c', session_no: 3, date: '2026-03-16', condition: 'C', scores: { axe1: -2, axe2: null, axe3: 9, axe4: 9, total: 16 }, manquants: { axe1: 0, axe2: 4, axe3: 0, axe4: 0, total: 4 } },
  ], 'sessions[]');
});

check('bilan : echelles, noms et graduations des 5 scores (C3.3)', async (A) => {
  await A.ref();
  const b = await A.bilan('S01');
  eq(b.scores.map((s) => ({ cle: s.cle, nom: s.nom, min: s.min, max: s.max, graduations: s.graduations })),
    SCORES.map((s) => ({ cle: s.cle, nom: s.nom, min: s.min, max: s.max, graduations: s.grad })), 'echelles');
});

check('bilan : segments, trou (null) interrompt la ligne, 0 est une valeur (C7.6)', async (A) => {
  await A.ref();
  const s = await A.bilan('S01');
  eq(s.scores[0].segments, [[1, 2, 3]], 'S01 axe1'); eq(s.scores[1].segments, [[1, 2]], 'S01 axe2');
  const p8 = await A.bilan('P8');
  const a3 = p8.scores.find((x) => x.cle === 'axe3');
  eq(a3.points.map((p) => p.valeur), [3, null, 2], 'P8 axe3'); eq(a3.segments, [], 'P8 axe3 segments (trou, pas un zero)');
  const tot = p8.scores.find((x) => x.cle === 'total');
  eq(tot.points.map((p) => p.valeur), [3, null, 2], 'P8 total'); eq(tot.segments, [], 'P8 total segments');
  eq(p8.scores.find((x) => x.cle === 'axe1').points.map((p) => p.valeur), [null, null, null], 'P8 axe1');
  eq(p8.scores.map((x) => x.points.length), [3, 3, 3, 3, 3], 'un point par session, y compris null');
  eq(p8.scores[2].points.map((p) => p.condition), ['B', 'A', ''], 'conditions de P8');
  const sess = [];
  const mk = (i, v) => ({ id: 'sg-' + i, identification: { code_sujet: 'SEG', session_no: i, date: '2026-03-' + pad(i) }, cotations: v === null ? {} : { 'V3.1': v } });
  const vals = [1, null, 2, 3, null, null, 0, 0, 2, null, 1];
  vals.forEach((v, i) => sess.push(mk(i + 1, v)));
  await A.importer(sauvegarde(sess), sess.map((x) => x.id));
  const bs = await A.bilan('seg');
  eq(bs.scores.find((x) => x.cle === 'axe3').segments, [[3, 4], [7, 8, 9]], 'segments (suites maximales d\'au moins 2 points adjacents)');
});

check('bilan : grilles T0, T1 et T2 de S01, valeurs brutes (V1.4 non inverse) (C7.7)', async (A) => {
  await A.ref();
  const b = await A.bilan('S01');
  eq(b.cotations_t1.map((l) => l.code), T1, 'codes T1'); eq(b.cotations_t0.map((l) => l.code), T0, 'codes T0');
  eq(b.cotations_t1.map((l) => l.axe), T1.map((c) => AXE_DE[c]), 'axe');
  eq(b.cotations_t0.map((l) => l.axe), [null, null, null, null, null], 'axe T0');
  eq(b.cotations_t1.map((l) => l.inverse), T1.map((c) => c === 'V1.4'), 'inverse T1');
  eq(b.cotations_t0.map((l) => l.inverse), [false, false, false, false, false], 'inverse T0');
  eq(b.cotations_t1.map((l) => l.intitule), T1.map((c) => INTITULES[c]), 'intitules T1');
  eq(b.cotations_t0.map((l) => l.intitule), T0.map((c) => INTITULES[c]), 'intitules T0');
  const v1 = (code) => b.cotations_t1.find((l) => l.code === code).cellules.map((c) => c.valeur);
  eq(v1('V1.4'), [2, 0, 3], 'V1.4'); eq(v1('V4.2'), ['NA', 2, 3], 'V4.2'); eq(v1('V2.1'), [0, 2, null], 'V2.1');
  eq(v1('V1.1'), [1, 2, 0], 'V1.1'); eq(v1('V3.3'), [null, 2, 3], 'V3.3');
  const v0 = (code) => b.cotations_t0.find((l) => l.code === code).cellules.map((c) => c.valeur);
  eq(v0('T0.1'), [3, 2, null], 'T0.1'); eq(v0('T0.2'), [null, 'NA', null], 'T0.2');
  eq(b.cotations_t1[0].cellules.map((c) => [c.rang, c.session_id]), [[1, 's01-a'], [2, 's01-b'], [3, 's01-c']], 'cellules');
  const t = (k) => b.t2.find((l) => l.cle === k).cellules.map((c) => c.valeur);
  eq(t('tonus'), [null, 1, -1], 'tonus'); eq(t('posture'), [null, 0, 1], 'posture'); eq(t('emotion'), [null, 1, 0], 'emotion'); eq(t('relation'), [null, null, 1], 'relation');
  eq(b.t2.map((l) => [l.cle, l.libelle, l.libelle_complet]), T2K.map((k) => [k, T2_LIB[k][0], T2_LIB[k][1]]), 'libelles T2');
  b.cotations_t1.concat(b.cotations_t0).forEach((l) => l.cellules.forEach((c) => assert(c.valeur === null || c.valeur === 'NA' || typeof c.valeur === 'number', 'type de valeur ' + l.code)));
});

check('bilan : code inconnu = null, "" et "(sans code)" = groupe sans code, casse ignoree, bilan sans effet de bord (C7.4, C6)', async (A) => {
  await A.ref();
  eq(await A.bilan('inconnu'), null, 'bilan(inconnu)');
  const v = await A.bilan('');
  eq([v.nb_sessions, v.code, v.cle, v.libelle], [1, '', '', '(sans code)'], 'groupe sans code');
  eq(await A.bilan('(sans code)'), v, 'bilan("(sans code)")');
  eq(await A.bilan('s01'), await A.bilan('S01'), 'casse');
  eq(await A.bilan('P7'), await A.bilan('p7'), 'casse P7');
  eq(v.scores.map((s) => s.points[0].valeur), [null, null, null, null, null], 'valeurs');
  eq(v.sessions[0].manquants, { axe1: 4, axe2: 4, axe3: 3, axe4: 3, total: 14 }, 'manquants de la session vierge');
});

check('bilan : bornes de l\'echelle (axe1 = -3 avec V1.4 seul, maxima 9/12/9/9/39) et valeur 0 distincte de null', async (A) => {
  const mk = (id, no, cot) => ({ id, identification: { code_sujet: 'EXT', session_no: no, date: '2026-04-0' + no, condition: 'A' }, cotations: cot });
  const max = {}; ['V1.1', 'V1.2', 'V1.3', 'V2.1', 'V2.2', 'V2.3', 'V2.4', 'V3.1', 'V3.2', 'V3.3', 'V4.1', 'V4.2', 'V4.3'].forEach((c) => { max[c] = 3; }); max['V1.4'] = 0;
  const jeu = [mk('e1', 1, { 'V1.4': 3 }), mk('e2', 2, max), mk('e3', 3, { 'V1.1': 0 })];
  await A.importer(sauvegarde(jeu), ['e1', 'e2', 'e3']);
  const b = await A.bilan('EXT');
  const val = (k) => b.scores.find((s) => s.cle === k).points.map((p) => p.valeur);
  eq(val('axe1'), [-3, 9, 0], 'axe1'); eq(val('axe2'), [null, 12, null], 'axe2'); eq(val('axe3'), [null, 9, null], 'axe3');
  eq(val('axe4'), [null, 9, null], 'axe4'); eq(val('total'), [-3, 39, 0], 'total');
  eq(b.scores[0].segments, [[1, 2, 3]], 'segments axe1 (0 est une valeur)'); eq(b.scores[1].segments, [], 'segments axe2');
});

/* ================================================================== */
/* 7. Graphiques SVG (C3)                                              */
/* ================================================================== */

const PTS_AXE1 = [{ rang: 1, v: 1, cond: 'A', forme: 'cercle', x: 72 }, { rang: 2, v: 6, cond: 'B', forme: 'carre', x: 128 }, { rang: 3, v: -2, cond: 'C', forme: 'triangle', x: 184 }];

/* controle d'un marqueur par sa boite englobante */
function verifierMarqueur(m, forme, cx, cy, label, rayon) {
  assert(m, label + ' : marqueur absent');
  assert(m.bbox, label + ' : marqueur sans geometrie');
  const t = 0.8; const b = m.bbox;
  if (rayon === 7) {
    proche(b.x + b.w / 2, cx, t, label + ' centre x'); proche(b.y + b.h / 2, cy, t, label + ' centre y');
    assert(b.w >= 11 && b.w <= 20 && b.h >= 11 && b.h <= 20, label + ' taille ' + b.w + 'x' + b.h + ' (rayon 7 attendu)');
    if (forme === 'cercle') { assert(m.tag === 'circle', label + ' balise ' + m.tag); proche(b.w, 14, t, label + ' diametre'); }
    return;
  }
  if (forme === 'cercle') { assert(m.tag === 'circle', label + ' : cercle attendu, balise ' + m.tag); proche(b.x, cx - 9, t, label + ' x'); proche(b.y, cy - 9, t, label + ' y'); proche(b.w, 18, t, label + ' largeur'); proche(b.h, 18, t, label + ' hauteur'); }
  if (forme === 'carre') { assert(m.tag === 'rect', label + ' : carre attendu, balise ' + m.tag); proche(b.x, cx - 9, t, label + ' x'); proche(b.y, cy - 9, t, label + ' y'); proche(b.w, 18, t, label + ' largeur'); proche(b.h, 18, t, label + ' hauteur'); }
  if (forme === 'triangle') { assert(m.tag === 'polygon' || m.tag === 'path', label + ' : triangle attendu, balise ' + m.tag); proche(b.x, cx - 10, t, label + ' x'); proche(b.y, cy - 11, t, label + ' y'); proche(b.w, 20, t, label + ' largeur'); proche(b.h, 19, t, label + ' hauteur'); }
  if (forme === 'losange') { assert(m.tag === 'polygon' || m.tag === 'path', label + ' : losange attendu, balise ' + m.tag); proche(b.x, cx - 10, t, label + ' x'); proche(b.y, cy - 10, t, label + ' y'); proche(b.w, 20, t, label + ' largeur'); proche(b.h, 20, t, label + ' hauteur'); }
}
function marqueurDe(pt, cond) {
  return pt.marq.find((m) => new RegExp('(^|\\s)m-' + (cond || 'X') + '(\\s|$)').test(m.cls));
}

check('SVG score axe1 de S01 : points, coordonnees, ligne de zero, segment, dimensions (C7.18)', async (A) => {
  await A.ref(); await A.fiche('s01');
  const g = await A.svg('axe1');
  assert(g, 'svg[data-graphique="axe1"] absent');
  const a = g.attrs;
  eq([a.width, a.height, a.viewBox, a['data-min'], a['data-max'], a['data-nb-sessions'], a['data-participant'], a.role, a.focusable], ['300', '210', '0 0 300 210', '-3', '9', '3', 's01', 'img', 'false'], 'attributs du svg');
  eq(g.points.length, 3, 'g[data-point]');
  g.points.forEach((p, i) => {
    const e = PTS_AXE1[i]; const q = p.a;
    eq([q['data-score'], q['data-session'], q['data-rang'], q['data-valeur'], q['data-condition'], q['data-forme'], q['data-session-no'], q['data-date']],
      ['axe1', ['s01-a', 's01-b', 's01-c'][i], String(e.rang), String(e.v), e.cond, e.forme, String(i + 1), ['2026-03-02', '2026-03-09', '2026-03-16'][i]], 'attributs du point ' + e.rang);
    proche(Number(q['data-x']), e.x, 0.01, 'data-x ' + e.rang);
    eq(q['data-y'], yScore(SCORES[0], e.v), 'data-y ' + e.rang);
    eq(q['data-manquants'], '0', 'data-manquants ' + e.rang);
  });
  eq(g.points.map((p) => p.a['data-y']), ['115.3', '57', '150.3'], 'data-y litteraux du document');
  eq(g.points.map((p) => Number(p.a['data-x'])), [72, 128, 184], 'data-x litteraux du document');
  eq(g.zero.length, 1, 'line[data-ligne-zero]'); proche(g.zero[0].y1, 127, 0.01, 'y1 de la ligne de zero');
  eq(g.segments.length, 1, 'path[data-segment]'); eq(g.segments[0].a['data-rangs'], '1,2,3', 'data-rangs'); eq(g.segments[0].a['data-score'], 'axe1', 'data-score du segment');
  eq((g.segments[0].d.match(/-?\d+(?:\.\d+)?|[ML]/g) || []).join(' '), 'M 72 115.3 L 128 57 L 184 150.3', 'd du segment');
});

check('SVG score : marqueurs (forme, taille, lettre, valeur au-dessus) pour A, B, C (C3.4, C3.5)', async (A) => {
  await A.ref(); await A.fiche('s01');
  const g = await A.svg('axe1');
  g.points.forEach((p, i) => {
    const e = PTS_AXE1[i]; const cx = e.x; const cy = Number(yScore(SCORES[0], e.v));
    verifierMarqueur(marqueurDe(p, e.cond), e.forme, cx, cy, 'marqueur ' + e.cond);
    const lettre = p.textes.find((t) => t.t === e.cond);
    assert(lettre, 'lettre ' + e.cond + ' absente');
    assert(lettre.bbox && Math.abs(lettre.bbox.x + lettre.bbox.w / 2 - cx) < 6 && Math.abs(lettre.bbox.y + lettre.bbox.h / 2 - cy) < 7, 'lettre ' + e.cond + ' non centree dans le marqueur');
    const val = p.textes.find((t) => t.t === String(e.v));
    assert(val, 'texte de la valeur ' + e.v + ' absent');
    proche(val.y, cy - 13, 0.1, 'baseline de la valeur ' + e.v); proche(val.x, cx, 0.5, 'abscisse de la valeur ' + e.v);
    assert(p.titre, 'titre (infobulle) absent');
  });
  assert(g.points[0].a['data-forme'] === 'cercle' && g.points[1].a['data-forme'] === 'carre' && g.points[2].a['data-forme'] === 'triangle', 'formes');
});

check('SVG score : infobulles <title> des points (format C3.7)', async (A) => {
  await A.ref(); await A.fiche('s01');
  const a1 = await A.svg('axe1'); const a2 = await A.svg('axe2'); const a3 = await A.svg('axe3');
  eq(a1.points.map((p) => p.titre), ['S1 | 02/03/2026 | Cond. A | Axe 1 : 1', 'S2 | 09/03/2026 | Cond. B | Axe 1 : 6', 'S3 | 16/03/2026 | Cond. C | Axe 1 : -2'], 'axe1');
  eq(a2.points[2].titre, 'S3 | 16/03/2026 | Cond. C | Axe 2 : non calculable', 'axe2 null');
  eq(a3.points[0].titre, 'S1 | 02/03/2026 | Cond. A | Axe 3 : 1 (1 item(s) manquant(s))', 'axe3 avec manquant');
  eq(a3.points[1].titre, 'S2 | 09/03/2026 | Cond. B | Axe 3 : 6', 'axe3 sans manquant');
  await A.fiche('z9');
  eq((await A.svg('axe1')).points[0].titre, 'S? | 01/06/2026 | Cond. ? | Axe 1 : non calculable', 'Z9 : S?, Cond. ?');
  await A.fiche('p6');
  eq((await A.svg('axe1')).points[2].titre, 'S1 | date ? | Cond. ? | Axe 1 : non calculable', 'P6 : date ?');
});

check('SVG score : autres echelles (total, axe2, axe3, axe4), point null sans marqueur ni data-y (C7.19)', async (A) => {
  await A.ref(); await A.fiche('s01');
  const exp = { total: ['142', '75.3', '98.7'], axe3: ['146.4', '68.7', '22'], axe4: ['146.4', '84.2', '22'] };
  for (const k of Object.keys(exp)) {
    const g = await A.svg(k);
    eq(g.points.map((p) => p.a['data-y']), exp[k], 'data-y de ' + k);
    const sc = SCORES.find((s) => s.cle === k);
    eq([g.attrs['data-min'], g.attrs['data-max']], [String(sc.min), String(sc.max)], 'data-min/max de ' + k);
  }
  const g2 = await A.svg('axe2');
  eq(g2.points.map((p) => p.a['data-valeur']), ['0', '6', ''], 'data-valeur axe2');
  eq(g2.points.slice(0, 2).map((p) => p.a['data-y']), ['162', '92'], 'data-y axe2');
  assert(!('data-y' in g2.points[2].a), 'data-y present sur un point null');
  eq(g2.points[2].marq.length, 0, 'marqueur present sur un point null');
  eq(g2.points[2].formes.length, 0, 'forme presente sur un point null');
  eq(g2.points[2].a['data-forme'], 'triangle', 'data-forme conserve sur un point null');
  const tx = g2.points[2].textes.map((t) => t.t);
  eq(tx, ['-'], 'seul texte d\'un point null');
  assert(g2.points[0].marq.length >= 1, 'point 0 (valeur 0) sans marqueur : 0 est un point, pas un trou');
  eq(g2.segments.length, 1, 'segments axe2'); eq(g2.segments[0].a['data-rangs'], '1,2', 'data-rangs axe2');
  const zt = await A.svg('total');
  eq(zt.zero.length, 1, 'ligne de zero du total'); proche(zt.zero[0].y1, 152, 0.01, 'y1 zero total');
  eq(g2.zero.length, 0, 'pas de ligne de zero pour axe2');
  eq((await A.svg('axe3')).zero.length + (await A.svg('axe4')).zero.length, 0, 'pas de ligne de zero pour axe3/axe4');
});

check('SVG score : graduations (lignes et etiquettes) pour les 5 scores (C3.3)', async (A) => {
  await A.ref(); await A.fiche('s01');
  for (const sc of SCORES) {
    const g = await A.svg(sc.cle);
    eq(g.grad.map((l) => Number(l.v)), sc.grad, 'graduations de ' + sc.cle);
    g.grad.forEach((l) => {
      const y = 22 + (sc.max - Number(l.v)) * 140 / (sc.max - sc.min);
      proche(l.y1, y, 0.1, sc.cle + ' y1 graduation ' + l.v); proche(l.y2, y, 0.1, sc.cle + ' y2 graduation ' + l.v);
      const et = g.textesSvg.find((t) => t.t === l.v && t.x !== null && t.x < 44);
      assert(et, sc.cle + ' : etiquette de la graduation ' + l.v + ' a gauche absente');
      proche(et.y, y + 4, 6, sc.cle + ' ordonnee de l\'etiquette ' + l.v);
    });
  }
});

check('SVG score : axe x (S<n> y=178, date jj/mm/aa y=191, « m manq. » y=204 si m>0) et g[data-colonne] (C7.20)', async (A) => {
  await A.ref(); await A.fiche('s01');
  const a3 = await A.svg('axe3');
  eq(a3.colonnes.length, 3, 'colonnes');
  a3.colonnes.forEach((c, i) => {
    eq([c.a['data-colonne'], c.a['data-session'], c.a['data-session-no'], c.a['data-date'], c.a['data-condition']],
      [String(i + 1), ['s01-a', 's01-b', 's01-c'][i], String(i + 1), ['2026-03-02', '2026-03-09', '2026-03-16'][i], 'ABC'[i]], 'attributs colonne ' + (i + 1));
    const cx = 44 + 56 * (i + 0.5);
    const s = c.textes.find((t) => t.t === 'S' + (i + 1)); const d = c.textes.find((t) => t.t === court(['2026-03-02', '2026-03-09', '2026-03-16'][i]));
    assert(s && d, 'texte S<n> ou date absent colonne ' + (i + 1));
    proche(s.y, 178, 0.1, 'y de S<n>'); proche(s.x, cx, 0.5, 'x de S<n>'); proche(d.y, 191, 0.1, 'y de la date'); proche(d.x, cx, 0.5, 'x de la date');
    const manq = c.textes.filter((t) => /manq\./.test(t.t));
    if (i === 0) { eq(manq.map((t) => t.t), ['1 manq.'], 'manquants colonne 1'); proche(manq[0].y, 204, 0.1, 'y de manq.'); proche(manq[0].x, cx, 0.5, 'x de manq.'); } else eq(manq.length, 0, 'manq. colonne ' + (i + 1));
  });
  eq((a3.points.map((p) => p.a['data-manquants'])), ['1', '0', '0'], 'data-manquants axe3');
  const a1 = await A.svg('axe1');
  eq(a1.colonnes.reduce((n, c) => n + c.textes.filter((t) => /manq\./.test(t.t)).length, 0), 0, 'axe1 sans manq.');
});

check('SVG score : trou dans la ligne (P8) : valeur vide, aucun segment, formes carre/cercle/losange, axe1 vide (C7.21)', async (A) => {
  await A.ref(); await A.fiche('p8');
  const g = await A.svg('axe3');
  eq(g.points.length, 3, 'points'); eq(g.points.map((p) => p.a['data-valeur']), ['3', '', '2'], 'data-valeur'); eq(g.segments.length, 0, 'segments');
  eq(g.points.map((p) => p.a['data-forme']), ['carre', 'cercle', 'losange'], 'formes');
  eq(g.points.map((p) => p.a['data-condition']), ['B', 'A', ''], 'conditions');
  const y1 = Number(g.points[0].a['data-y']); const y3 = Number(g.points[2].a['data-y']);
  verifierMarqueur(marqueurDe(g.points[0], 'B'), 'carre', Number(g.points[0].a['data-x']), y1, 'carre B');
  const mx = marqueurDe(g.points[2], 'X');
  verifierMarqueur(mx, 'losange', Number(g.points[2].a['data-x']), y3, 'losange');
  assert(g.points[2].textes.some((t) => t.t === '?'), 'lettre ? absente du marqueur sans condition');
  eq(g.points[1].marq.length, 0, 'pas de marqueur pour le point null');
  const a1 = await A.svg('axe1');
  eq(a1.attrs['data-vide'], 'true', 'axe1 de P8 data-vide');
  assert(a1.textesSvg.some((t) => t.t === 'Aucun score calculable'), 'texte « Aucun score calculable » absent');
  assert(g.attrs['data-vide'] !== 'true', 'axe3 de P8 ne doit pas etre vide');
  const leg = await A.page.$$eval('#legende-conditions li', (l) => l.map((x) => x.getAttribute('data-legende')));
  eq(leg, ['A', 'B', 'C', 'X'], 'legende de P8 (X present car une session sans condition)');
});

check('SVG grille T1 de S01 : 42 cellules, valeurs non inversees, hachures, classes, colonnes (C7.22)', async (A) => {
  await A.ref(); await A.fiche('s01');
  const g = await A.svg('cotations-t1');
  eq(g.cellules.length, 42, 'g[data-cellule]');
  const cel = (code, id) => g.cellules.find((c) => c.a['data-code'] === code && c.a['data-session'] === id);
  const v14 = cel('V1.4', 's01-a');
  eq([v14.a['data-valeur'], v14.textes.map((t) => t.t), v14.a['data-bloc']], ['2', ['2'], 't1'], 'V1.4 / s01-a (valeur brute)');
  const lig = g.lignes.find((l) => l.a['data-ligne'] === 'V1.4');
  eq(lig.a['data-inverse'], 'true', 'data-inverse de V1.4'); assert(lig.textes.some((t) => t.t === 'score inversé'), 'texte « score inversé » absent');
  proche(lig.textes.find((t) => t.t === 'score inversé').x, 34, 0.5, 'x de « score inversé »'); proche(lig.textes.find((t) => t.t === 'V1.4').x, 4, 0.5, 'x du code');
  eq(g.lignes.filter((l) => l.a['data-inverse'] === 'true').length, 1, 'une seule ligne inversee');
  eq(g.lignes.length, 14, 'lignes'); eq(g.lignes.every((l) => l.a['data-bloc'] === 't1'), true, 'data-bloc des lignes');
  const na = cel('V4.2', 's01-a');
  eq([na.a['data-valeur'], na.textes.map((t) => t.t)], ['NA', ['NA']], 'V4.2 NA');
  const hach = na.rects.filter((r) => /(^|\s)hachure(\s|$)/.test(r.cls));
  eq(hach.length, 1, 'rect.hachure');
  assert(/url\(#hachure-t1\)/.test((hach[0].fill || '') + (hach[0].style || '')), 'rect.hachure non rempli par url(#hachure-t1) : ' + hach[0].fill);
  assert(na.rects.some((r) => /(^|\s)cot-na(\s|$)/.test(r.cls)), 'rect.cot-na absent');
  assert(g.patterns.indexOf('hachure-t1') >= 0, 'pattern#hachure-t1 absent des defs du svg : ' + g.patterns.join(','));
  const vide = cel('V2.1', 's01-c');
  eq([vide.a['data-valeur'], vide.textes.filter((t) => t.t.trim() !== '').length], ['', 0], 'case vide sans texte');
  eq(vide.rects.length, 1, 'une case vide n\'a qu\'un contour'); assert(/(^|\s)cot-vide(\s|$)/.test(vide.rects[0].cls), 'classe cot-vide');
  eq(['s01-a', 's01-b', 's01-c'].map((id) => (cel('V1.1', id).rects[0].cls.match(/cot-\d/) || [''])[0]), ['cot-1', 'cot-2', 'cot-0'], 'classes de V1.1');
  eq(g.cellules.map((c) => c.a['data-bloc']).filter((x) => x !== 't1').length, 0, 'data-bloc');
  const c1 = g.colonnes[0];
  eq([c1.a['data-colonne'], c1.a['data-session'], c1.a['data-date'], c1.a['data-condition']], ['1', 's01-a', '2026-03-02', 'A'], 'g[data-colonne="1"]');
  assert(c1.textes.some((t) => t.t === 'S1') && c1.textes.some((t) => t.t === '02/03/26'), 'textes S1 et 02/03/26');
  eq(g.colonnes.length, 3, 'colonnes');
  eq([g.attrs.width, g.attrs.height, g.attrs.viewBox, g.attrs['data-nb-sessions'], g.attrs['data-participant']], ['258', '442', '0 0 258 442', '3', 's01'], 'dimensions');
});

check('SVG grille T1 : geometrie des colonnes, lignes et cases (C3.4)', async (A) => {
  await A.ref(); await A.fiche('s01');
  const g = await A.svg('cotations-t1');
  g.cellules.forEach((c) => {
    const rang = Number(c.a['data-rang']); const code = c.a['data-code'];
    const r = c.rects[0];
    const ligne = T1.indexOf(code); const yAttendu = 56 + 26 * ligne + 6 * (AXE_DE[code] - 1);
    proche(r.x, 118 + 44 * (rang - 1) + 1, 0.01, code + ' x de la case'); proche(r.w, 42, 0.01, code + ' largeur de la case');
    assert(r.y >= yAttendu - 0.01 && r.y <= yAttendu + 3, code + ' ordonnee ' + r.y + ' (ligne attendue ' + yAttendu + ')');
    assert(r.h >= 18 && r.h <= 26.01, code + ' hauteur ' + r.h);
  });
  g.colonnes.forEach((c, i) => {
    const cx = 118 + 44 * i + 22;
    const s = c.textes.find((t) => /^S\d$/.test(t.t)); const d = c.textes.find((t) => /^\d\d\/\d\d\/\d\d$/.test(t.t));
    proche(s.y, 15, 0.1, 'y de S<n>'); proche(s.x, cx, 0.5, 'x de S<n>'); proche(d.y, 29, 0.1, 'y de la date'); proche(d.x, cx, 0.5, 'x de la date');
    verifierMarqueur(marqueurDe({ marq: c.marq }, 'ABC'[i]), FORMES['ABC'[i]], cx, 43, 'marqueur d\'en-tete ' + 'ABC'[i], 7);
  });
});

check('SVG grilles T0 et T2 de S01 : cases, hachures, classes, textes (C7.23)', async (A) => {
  await A.ref(); await A.fiche('s01');
  const g0 = await A.svg('cotations-t0');
  eq(g0.cellules.length, 15, 'cases T0'); eq([g0.attrs.width, g0.attrs.height], ['258', '190'], 'dimensions T0');
  const na = g0.cellules.find((c) => c.a['data-code'] === 'T0.2' && c.a['data-session'] === 's01-b');
  eq(na.a['data-valeur'], 'NA', 'T0.2/s01-b'); assert(na.rects.some((r) => /hachure/.test(r.cls) && /url\(#hachure-t0\)/.test((r.fill || '') + (r.style || ''))), 'hachure-t0 absente');
  assert(g0.patterns.indexOf('hachure-t0') >= 0, 'pattern hachure-t0');
  g0.cellules.forEach((c) => {
    const i = T0.indexOf(c.a['data-code']); assert(c.rects[0].y >= 56 + 26 * i - 0.01 && c.rects[0].y <= 56 + 26 * i + 3, c.a['data-code'] + ' ordonnee ' + c.rects[0].y);
    eq(c.a['data-bloc'], 't0', 'data-bloc T0');
  });
  eq(g0.lignes.every((l) => l.a['data-inverse'] === 'false'), true, 'data-inverse false en T0');
  const g2 = await A.svg('t2');
  eq(g2.cellules.length, 12, 'cases T2'); eq([g2.attrs.width, g2.attrs.height], ['258', '180'], 'dimensions T2');
  const t = (dom, id) => g2.cellules.find((c) => c.a['data-domaine'] === dom && c.a['data-session'] === id);
  const cls = (c) => (c.rects[0].cls.match(/t2-(neg|zero|pos|vide)/) || [''])[0];
  eq(['s01-a', 's01-b', 's01-c'].map((id) => t('tonus', id).a['data-valeur']), ['', '1', '-1'], 'data-valeur tonus');
  eq(['s01-a', 's01-b', 's01-c'].map((id) => cls(t('tonus', id))), ['t2-vide', 't2-pos', 't2-neg'], 'classes tonus');
  eq(['s01-a', 's01-b', 's01-c'].map((id) => t('tonus', id).textes.map((x) => x.t).join('')), ['', '+1', '-1'], 'textes tonus');
  eq([t('posture', 's01-b').a['data-valeur'], cls(t('posture', 's01-b')), t('posture', 's01-b').textes.map((x) => x.t)], ['0', 't2-zero', ['0']], 'posture b');
  g2.cellules.forEach((c) => { const i = T2K.indexOf(c.a['data-domaine']); assert(c.rects[0].y >= 56 + 30 * i - 0.01 && c.rects[0].y <= 56 + 30 * i + 3, 'ordonnee T2 ' + c.rects[0].y); eq(c.a['data-bloc'], 't2', 'data-bloc T2'); });
  eq(g2.lignes.map((l) => l.a['data-ligne']), T2K, 'lignes T2');
  T2K.forEach((k, i) => assert(g2.lignes[i].textes.some((x) => x.t === T2_LIB[k][0]), 'libelle court de ' + k));
  eq(g2.patterns.length, 0, 'T2 sans NA : pas de motif');
});

check('SVG : aria-label des 8 graphiques de S01 et role="img" (C7.24)', async (A) => {
  await A.ref(); await A.fiche('s01');
  const noms = ['axe1', 'axe2', 'axe3', 'axe4', 'total', 'cotations-t0', 'cotations-t1', 't2'];
  const r = await A.page.$$eval('#bilan svg[data-graphique]', (s) => s.map((x) => [x.getAttribute('data-graphique'), x.getAttribute('role'), x.getAttribute('aria-label'), x.getAttribute('focusable'), x.getAttribute('aria-describedby'), x.getAttribute('data-participant'), x.getAttribute('data-nb-sessions')]));
  eq(r.map((x) => x[0]), ['axe1', 'axe2', 'axe3', 'axe4', 'total', 'cotations-t0', 'cotations-t1', 't2'], 'les 8 svg dans l\'ordre de l\'ecran');
  const lab = {}; r.forEach((x) => { lab[x[0]] = x[2]; });
  r.forEach((x) => { eq([x[1], x[3], x[4], x[5], x[6]], ['img', 'false', 'table-sessions-participant', 's01', '3'], 'role/focusable/describedby/participant/nb de ' + x[0]); });
  eq(lab.axe1, 'Axe 1 - Régulation Tonique, participant S01 : 3 sessions. S1 (A) 1; S2 (B) 6; S3 (C) -2', 'axe1');
  assert(/ S3 \(C\) non calculable$/.test(lab.axe2), 'axe2 : ' + lab.axe2);
  eq(lab.axe2, 'Axe 2 - Conscience Corporelle et Appuis, participant S01 : 3 sessions. S1 (A) 0; S2 (B) 6; S3 (C) non calculable', 'axe2 complet');
  eq(lab.total, 'Indice global d\'efficience clinique, participant S01 : 3 sessions. S1 (A) 3; S2 (B) 23; S3 (C) 16', 'total');
  eq(lab['cotations-t1'], 'Cotations T1, participant S01 : 14 items, 3 sessions ; 36 cotées, 1 NA, 5 non cotées.', 'cotations-t1');
  eq(lab['cotations-t0'], 'Cotations T0, participant S01 : 5 items, 3 sessions ; 2 cotées, 1 NA, 12 non cotées.', 'cotations-t0');
  eq(lab.t2, 'Évolution T2, participant S01 : 4 domaines, 3 sessions ; 7 renseignés, 5 non renseignés.', 't2');
});

check('SVG : aucun score ni cotation (Z9) : data-vide, un point vide, textes de remplacement, aria-label au singulier (C7.25)', async (A) => {
  await A.ref(); await A.fiche('z9');
  for (const k of SCORE_KEYS) {
    const g = await A.svg(k);
    eq(g.attrs['data-vide'], 'true', 'data-vide de ' + k); eq(g.points.length, 1, 'points de ' + k); eq(g.points[0].a['data-valeur'], '', 'data-valeur de ' + k);
    assert(g.textesSvg.some((t) => t.t === 'Aucun score calculable'), 'texte de ' + k);
  }
  for (const [k, txt] of [['cotations-t0', 'Aucune cotation'], ['cotations-t1', 'Aucune cotation'], ['t2', 'Aucune évolution renseignée']]) {
    const g = await A.svg(k);
    eq(g.attrs['data-vide'], 'true', 'data-vide de ' + k); assert(g.textesSvg.some((t) => t.t === txt), 'texte « ' + txt + ' » de ' + k);
    eq(g.cellules.filter((c) => c.textes.some((t) => t.t.trim() !== '')).length, 0, 'aucun texte de case ' + k);
  }
  const lab = await A.page.$$eval('#bilan svg[data-graphique]', (s) => s.map((x) => [x.getAttribute('data-graphique'), x.getAttribute('aria-label')]));
  const L = {}; lab.forEach((x) => { L[x[0]] = x[1]; });
  eq(L.axe1, 'Axe 1 - Régulation Tonique, participant Z9 : 1 session. S? (?) non calculable', 'axe1 Z9');
  eq(L['cotations-t1'], 'Cotations T1, participant Z9 : 14 items, 1 session ; 0 cotées, 0 NA, 14 non cotées.', 'T1 Z9');
  eq(L['cotations-t0'], 'Cotations T0, participant Z9 : 5 items, 1 session ; 0 cotées, 0 NA, 5 non cotées.', 'T0 Z9');
  eq(L.t2, 'Évolution T2, participant Z9 : 4 domaines, 1 session ; 0 renseignés, 4 non renseignés.', 'T2 Z9');
  const gs = await A.svg('axe1');
  eq(gs.attrs.width, '300', 'largeur minimale');
});

check('SVG : structure du bilan (sections, titres, legendes, note V1.4, legendes de conditions) (C3.1, C3.5)', async (A) => {
  await A.ref(); await A.fiche('s01');
  const r = await A.page.evaluate(() => {
    const q = (s) => document.querySelector(s); const t = (s) => (q(s) ? q(s).textContent.trim() : null);
    const bil = q('#bilan');
    return {
      h4: [...bil.querySelectorAll('h4')].map((x) => x.textContent.trim()),
      sections: [...bil.querySelectorAll('section')].map((s) => s.id), dp: bil.querySelectorAll('section[data-panel]').length,
      secH: ['bilan-scores', 'bilan-cotations', 'bilan-t2'].map((i) => t('#' + i + ' > h4')),
      note: t('#note-v14'), grille: q('.grille-scores') ? q('.grille-scores').querySelectorAll(':scope > figure.graphique').length : -1,
      caps: [...bil.querySelectorAll('figure.graphique > figcaption')].map((c) => c.textContent.trim()),
      defil: [...bil.querySelectorAll('figure.graphique > div.graphique-defil')].map((d) => [d.getAttribute('tabindex'), d.getAttribute('role'), d.getAttribute('aria-label'), d.querySelectorAll(':scope > svg').length]),
      leg: [...document.querySelectorAll('#legende-conditions li')].map((l) => [l.getAttribute('data-legende'), l.textContent.trim(), !!l.querySelector('svg[aria-hidden="true"]')]),
      uls: ['legende-conditions', 'legende-cotations', 'legende-t2'].map((i) => !!q('ul#' + i)),
      ordre: [...bil.querySelectorAll('svg[data-graphique]')].map((s) => s.getAttribute('data-graphique')),
      large: [...bil.querySelectorAll('figure.graphique')].map((f) => f.getAttribute('data-large')),
    };
  });
  eq(r.h4[0], 'Bilan graphique', 'titre du bilan'); eq(r.sections, ['bilan-scores', 'bilan-cotations', 'bilan-t2'], 'sections'); eq(r.dp, 0, 'data-panel dans le bilan');
  eq(r.secH, ['Scores composites', 'Cotations item par item', 'T2 : évolution 10 minutes après le retrait'], 'titres h4 des sections');
  eq(r.note, 'V1.4 est un score inversé : il est affiché tel que coté, et soustrait dans l\'axe 1.', 'note V1.4');
  eq(r.grille, 5, '5 figures dans .grille-scores');
  eq(r.caps, ['Axe 1 - Régulation Tonique - échelle de -3 à 9', 'Axe 2 - Conscience Corporelle et Appuis - échelle de 0 à 12', 'Axe 3 - Disponibilité Attentionnelle - échelle de 0 à 9',
    'Axe 4 - Dialogue Tonico-Émotionnel - échelle de 0 à 9', 'Indice global d\'efficience clinique - échelle de -3 à 39', 'T0 - Ligne de base', 'T1 - Stimulation active', 'T2 - Rémanence et post-effet'], 'figcaption');
  r.defil.forEach((d, i) => { eq([d[0], d[1], d[3]], ['0', 'region', 1], 'zone de defilement ' + i); assert(/^Défilement : .+/.test(d[2]), 'aria-label de defilement : ' + d[2]); });
  eq(r.leg.map((l) => [l[0], l[2]]), [['A', true], ['B', true], ['C', true]], 'legende des conditions (pas de X pour S01)');
  eq(r.leg.map((l) => l[1]), ['A - Témoin', 'B - Gilet actif', 'C - Multisensorielle'], 'textes de la legende');
  eq(r.uls, [true, true, true], 'listes de legende'); eq(r.ordre.length, 8, 'svg du bilan');
  r.large.forEach((v) => assert(v !== 'true', 'data-large="true" pour 3 sessions'));
});

check('SVG : data-large="true" des que le SVG depasse 340 de large (scores : 6 sessions, grilles : 5), largeurs W (C3.1, C3.4)', async (A) => {
  const sess = jeuLong('N5', 5, 'n5-').concat(jeuLong('N6', 6, 'n6-'), jeuLong('N1', 1, 'n1-'));
  await A.importer(sauvegarde(sess), sess.map((s) => s.id));
  for (const [cle, n] of [['n1', 1], ['n5', 5], ['n6', 6]]) {
    await A.fiche(cle);
    const r = await A.page.$$eval('#bilan figure.graphique', (f) => f.map((x) => { const s = x.querySelector('svg'); return [s.getAttribute('data-graphique'), Number(s.getAttribute('width')), Number(s.getAttribute('height')), s.getAttribute('viewBox'), x.getAttribute('data-large')]; }));
    r.forEach((e) => {
      const grille = /^(cotations|t2)/.test(e[0]);
      const W = grille ? 118 + 44 * n + 8 : Math.max(300, 60 + 56 * n);
      const H = grille ? ({ 'cotations-t0': 190, 'cotations-t1': 442, t2: 180 })[e[0]] : 210;
      eq([e[1], e[2], e[3]], [W, H, '0 0 ' + W + ' ' + H], n + ' sessions : ' + e[0]);
      if (W > 340) eq(e[4], 'true', n + ' sessions : data-large de ' + e[0]); else assert(e[4] !== 'true', n + ' sessions : data-large inattendu pour ' + e[0] + ' (' + W + ')');
    });
  }
});

check('SVG : identifiants uniques dans tout le document (motifs de hachures propres a chaque SVG)', async (A) => {
  await A.ref(); await A.fiche('s01');
  const r = await A.page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id); const vus = {}; const dup = [];
    ids.forEach((i) => { if (vus[i]) dup.push(i); vus[i] = 1; });
    const fills = [...document.querySelectorAll('#bilan rect.hachure')].map((r) => {
      const m = /url\(#([^)]+)\)/.exec((r.getAttribute('fill') || '') + (r.getAttribute('style') || '')); const svg = r.closest('svg');
      return { id: m && m[1], dansSvg: !!(m && svg.querySelector('defs pattern[id="' + m[1] + '"]')) };
    });
    return { dup, fills, attrVar: document.querySelectorAll('#bilan [fill*="var("],#bilan [stroke*="var("]').length };
  });
  eq(r.dup, [], 'identifiants en double'); assert(r.fills.length >= 2, 'rect.hachure attendus (T0 et T1)');
  r.fills.forEach((f) => assert(f.dansSvg, 'hachure sans motif dans son propre svg : ' + f.id));
  eq(r.attrVar, 0, 'fill/stroke="var(...)" interdits');
});

check('SVG : 30 sessions (BIG30) : largeurs 1740 et 1446, 30 points, le 0 est un point, defilement dans graphique-defil (C7.26)', async (A) => {
  await A.importer(sauvegarde(BIG30), BIG30.map((s) => s.id));
  await A.fiche('big30');
  const g = await A.svg('axe3');
  eq(g.attrs.width, '1740', 'largeur axe3'); eq(g.points.length, 30, 'points');
  eq(g.points.map((p) => p.a['data-valeur']), BIG30.map((s, i) => String((i + 1) % 4)), 'data-valeur (1,2,3,0,1,...)');
  assert(g.points[3].marq.length >= 1 && 'data-y' in g.points[3].a, 'le point de valeur 0 doit etre un point');
  eq(g.points[0].a['data-forme'], 'cercle', 'cycle des conditions'); eq(g.points[1].a['data-forme'], 'carre', 'cycle B'); eq(g.points[2].a['data-forme'], 'triangle', 'cycle C');
  eq(g.segments.length, 1, 'un segment'); eq(g.segments[0].a['data-rangs'], Array.from({ length: 30 }, (_, i) => i + 1).join(','), 'rangs du segment');
  eq(g.colonnes.length, 30, 'g[data-colonne] axe3');
  const t1 = await A.svg('cotations-t1');
  eq(t1.attrs.width, '1446', 'largeur T1'); eq(t1.colonnes.length, 30, 'colonnes T1'); eq(t1.cellules.length, 14 * 30, 'cellules T1');
  const t0 = await A.svg('cotations-t0'); const t2 = await A.svg('t2');
  eq([t0.attrs.width, t2.attrs.width, t0.colonnes.length, t2.colonnes.length], ['1446', '1446', 30, 30], 'T0 et T2');
  const r = await A.page.evaluate(() => {
    const d = document.querySelector('svg[data-graphique="axe3"]').closest('.graphique-defil');
    return { defil: d.scrollWidth > d.clientWidth, page: document.documentElement.scrollWidth <= window.innerWidth, ox: getComputedStyle(d).overflowX,
      large: [...document.querySelectorAll('#bilan figure')].every((f) => f.getAttribute('data-large') === 'true') };
  });
  assert(r.defil, '.graphique-defil ne defile pas (scrollWidth <= clientWidth)'); assert(r.page, 'la page defile horizontalement');
  assert(r.ox === 'auto' || r.ox === 'scroll', 'overflow-x ' + r.ox); assert(r.large, 'toutes les figures doivent etre data-large pour 30 sessions');
  const L = await A.lignesSessions(); eq(L.length, 30, 'lignes du tableau');
});

check('SVG : texte saisi jamais interprete (code, observateur, observations avec HTML), y compris via import, nouvelle session et reprise (C7.38)', async (A) => {
  const obs = {}; OBS_PHASES.concat(ITEMS).forEach((k) => { obs[k] = XSS; });
  const s = blank({ id: 'xss-1', identification: { code_sujet: XSS, diagnostic: XSS, observateur: XSS, co_evaluateur: XSS, installation: 'autre', installation_autre: XSS, condition: 'A', session_no: 1, date: '2026-05-05' },
    observations: obs, cotations: { 'V1.1': 2, 'V3.1': 1 }, synthese: { evenements: XSS, conclusion: XSS } });
  const t = blank({ id: 'xss-2', identification: { code_sujet: '-1', observateur: '<img src=x onerror=window.__x=1>', session_no: 1, date: '2026-05-06', sexe: 'F' } });
  await A.importer(sauvegarde([s, t]), ['xss-1', 'xss-2']);
  const verif = async (quand) => {
    await A.page.waitForTimeout(150);
    const r = await A.page.evaluate(() => ({ x: window.__xss, y: window.__x, imgs: document.querySelectorAll('img').length, bad: document.querySelectorAll('[onerror]').length }));
    assert(r.x === undefined && r.y === undefined, 'script execute (' + quand + ')'); assert(r.imgs === 0 && r.bad === 0, 'balise injectee (' + quand + ')');
  };
  await verif('apres import');
  const P = await A.participants();
  const px = P.find((p) => p.sessions.indexOf('xss-1') >= 0); const pm = P.find((p) => p.sessions.indexOf('xss-2') >= 0);
  await A.liste(); await verif('liste');
  await A.page.evaluate((c) => window.GrilleHaptique.ouvrirParticipants(c), px.cle);
  await verif('fiche du code HTML');
  const lab = await A.page.$$eval('#bilan svg[data-graphique]', (l) => l.map((x) => x.getAttribute('aria-label')));
  assert(lab.every((l) => l.indexOf('participant ' + px.libelle) >= 0), 'libelle brut attendu dans les aria-label');
  await A.page.evaluate((c) => window.GrilleHaptique.ouvrirParticipants(c), pm.cle);
  await verif('fiche -1');
  await A.page.click('#btn-nouvelle-pour-participant');
  await A.page.click('#btn-reprendre-champs').catch(() => {});
  await verif('nouvelle session');
  eq(await A.page.inputValue('#f-observateur'), '<img src=x onerror=window.__x=1>', 'observateur restitue en texte brut');
  await A.panneau(); await verif('panneau Sessions');
});

/* ================================================================== */
/* 8. Export Excel (C5, C6)                                            */
/* ================================================================== */

const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REF_NORM = () => REF.sessions.map(norm);

/* analyse complete d'une archive : structure ZIP, XML bien forme, feuilles lues */
function analyserXlsx(buf) {
  const z = zipLire(buf);
  eq(z.problemes, [], 'structure ZIP');
  eq(z.entrees.map((e) => e.nom), NOMS_ZIP, 'entrees de l\'archive');
  const parts = {}; z.entrees.forEach((e) => { parts[e.nom] = e.data.toString('utf8'); });
  const f1 = lireFeuille(parts['xl/worksheets/sheet1.xml']); const f2 = lireFeuille(parts['xl/worksheets/sheet2.xml']);
  return { z, parts, scores: f1, cots: f2 };
}

check('Excel : xlsxOctets renvoie un Uint8Array ou null ; code inconnu null ; casse ignoree ; deterministe ; null = tous plus long (C7.32)', async (A) => {
  await A.ref();
  const r = await A.page.evaluate(() => {
    const G = window.GrilleHaptique; const a = G.xlsxOctets('S01'); const b = G.xlsxOctets('s01'); const c = G.xlsxOctets(null);
    return { ctor: [a, b, c].map((x) => Object.prototype.toString.call(x)), inconnu: G.xlsxOctets('inconnu'), la: a.length, lc: c.length };
  });
  eq(r.ctor, ['[object Uint8Array]', '[object Uint8Array]', '[object Uint8Array]'], 'types');
  eq(r.inconnu, null, 'code inconnu'); assert(r.lc > r.la, 'xlsxOctets(null) doit etre plus long (' + r.lc + ' vs ' + r.la + ')');
  const a1 = await A.octets('S01'); await A.page.waitForTimeout(1100); const a2 = await A.octets('S01'); const a3 = await A.octets('s01');
  assert(a1.equals(a2), 'deux appels (1,1 s d\'ecart) donnent des octets differents'); assert(a1.equals(a3), 'xlsxOctets("s01") != xlsxOctets("S01")');
  assert(a1.slice(0, 4).equals(Buffer.from([0x50, 0x4B, 0x03, 0x04])), 'ne commence pas par 50 4B 03 04');
  assert(a1.slice(a1.length - 22, a1.length - 18).equals(Buffer.from([0x50, 0x4B, 0x05, 0x06])), 'enregistrement de fin absent a longueur - 22');
  eq(a1.readUInt16LE(a1.length - 12), 7, 'entrees annoncees');
  eq(await A.page.evaluate(() => window.GrilleHaptique.sessions().length), 14, 'xlsxOctets ne modifie pas les sessions');
  assert(crc32(Buffer.from('123456789')) === 0xCBF43926, 'vecteur de controle CRC-32 de ce test lui-meme');
});

check('Excel : archive ZIP stockee, 7 entrees dans l\'ordre, en-tetes locaux et centraux, CRC-32, pas de ZIP64 (C5.2)', async (A) => {
  await A.ref();
  const buf = await A.octets('S01');
  const z = zipLire(buf);
  eq(z.problemes, [], 'problemes de structure');
  eq(z.entrees.map((e) => e.nom), NOMS_ZIP, 'noms');
  z.entrees.forEach((e) => { assert(e.data.length > 0, e.nom + ' vide'); assert(e.data.toString('utf8').startsWith(DECL), e.nom + ' : declaration XML + saut de ligne attendus en tete'); });
  assert(!buf.toString('latin1').match(/docProps|sharedStrings|calcChain/), 'docProps/sharedStrings/calcChain presents');
  const tous = zipLire(await A.octets(null)); eq(tous.problemes, [], 'structure de l\'archive « tous »');
});

check('Excel : parties XML (types de contenu, relations, classeur, styles) conformes a C5.3, sans trace de generateur', async (A) => {
  await A.ref();
  const { parts } = analyserXlsx(await A.octets('S01'));
  const ct = xmlParse(parts['[Content_Types].xml']);
  eq([ct.nom, ct.attrs.xmlns], ['Types', NS.CT], 'Types');
  eq(xEnf(ct, 'Default').map((d) => [d.attrs.Extension, d.attrs.ContentType]), [['rels', 'application/vnd.openxmlformats-package.relationships+xml'], ['xml', 'application/xml']], 'Default');
  eq(xEnf(ct, 'Override').map((d) => [d.attrs.PartName, d.attrs.ContentType]).sort(), [
    ['/xl/styles.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml'],
    ['/xl/workbook.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'],
    ['/xl/worksheets/sheet1.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'],
    ['/xl/worksheets/sheet2.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml']], 'Override');
  const rr = xmlParse(parts['_rels/.rels']);
  eq([rr.nom, rr.attrs.xmlns], ['Relationships', NS.PR], 'Relationships'); eq(xEnf(rr, 'Relationship').map((r) => [r.attrs.Id, r.attrs.Type, r.attrs.Target]), [['rId1', NS.R + '/officeDocument', 'xl/workbook.xml']], '_rels/.rels');
  const wb = xmlParse(parts['xl/workbook.xml']);
  eq([wb.nom, wb.attrs.xmlns, wb.attrs['xmlns:r']], ['workbook', NS.M, NS.R], 'workbook');
  eq(xEnf(xUn(wb, 'sheets'), 'sheet').map((s) => [s.attrs.name, s.attrs.sheetId, s.attrs['r:id']]), [['Scores', '1', 'rId1'], ['Cotations', '2', 'rId2']], 'feuilles');
  const wr = xmlParse(parts['xl/_rels/workbook.xml.rels']);
  eq(wr.attrs.xmlns, NS.PR, 'xmlns des relations du classeur');
  eq(xEnf(wr, 'Relationship').map((r) => [r.attrs.Id, r.attrs.Type, r.attrs.Target]), [['rId1', NS.R + '/worksheet', 'worksheets/sheet1.xml'], ['rId2', NS.R + '/worksheet', 'worksheets/sheet2.xml'], ['rId3', NS.R + '/styles', 'styles.xml']], 'relations du classeur');
  const st = xmlParse(parts['xl/styles.xml']); eq([st.nom, st.attrs.xmlns], ['styleSheet', NS.M], 'styleSheet');
  const fonts = xUn(st, 'fonts'); eq(fonts.attrs.count, '2', 'fonts count'); const fs2 = xEnf(fonts, 'font');
  eq(fs2.length, 2, 'polices'); eq(xEnf(fs2[0], 'b').length, 0, 'police 0 sans gras'); eq(xEnf(fs2[1], 'b').length, 1, 'police 1 en gras');
  fs2.forEach((f, i) => { eq(xUn(f, 'sz').attrs.val, '11', 'sz police ' + i); eq(xUn(f, 'name').attrs.val, 'Calibri', 'name police ' + i); });
  const fills = xUn(st, 'fills'); eq(fills.attrs.count, '2', 'fills count'); eq(xEnf(fills, 'fill').map((f) => xUn(f, 'patternFill').attrs.patternType), ['none', 'gray125'], 'fills');
  const borders = xUn(st, 'borders'); eq([borders.attrs.count, xEnf(borders, 'border').length], ['1', 1], 'borders');
  const csx = xUn(st, 'cellStyleXfs'); eq([csx.attrs.count, xEnf(csx, 'xf').length], ['1', 1], 'cellStyleXfs');
  const cx = xUn(st, 'cellXfs'); eq(cx.attrs.count, '2', 'cellXfs count'); const xfs = xEnf(cx, 'xf'); eq(xfs.length, 2, 'xf');
  eq([xfs[1].attrs.fontId, xfs[1].attrs.applyFont], ['1', '1'], 'xf 1 : fontId, applyFont'); assert(!xfs[0].attrs.fontId || xfs[0].attrs.fontId === '0', 'xf 0 par defaut');
  const cs = xUn(st, 'cellStyles'); eq(cs.attrs.count, '1', 'cellStyles count'); eq(xEnf(cs, 'cellStyle').map((c) => c.attrs.name), ['Normal'], 'cellStyle');
  Object.keys(parts).forEach((n) => { assert(!/docProps|<Application|AppVersion|<Company|[Gg]enerator|openpyxl|SheetJS|Microsoft Excel|LibreOffice|Claude|Anthropic/.test(parts[n]), 'trace d\'outil dans ' + n); assert(!/<f[ >]/.test(parts[n]) && !/t="s"/.test(parts[n]), 'formule ou chaine partagee dans ' + n); });
});

check('Excel : structure des feuilles (dimension, volets figes, largeurs, en-tetes en gras) (C5.3, C5.5, C5.6)', async (A) => {
  await A.ref();
  const x = analyserXlsx(await A.octets('S01'));
  [[x.scores, 'sheet1.xml', 'A1:N4', [14, 11, 12, 10, 8, 8, 8, 8, 8, 16, 16, 16, 16, 16]],
    [x.cots, 'sheet2.xml', 'A1:AA4', [14, 11, 12, 10].concat(Array.from({ length: 19 }, () => 7), [13, 13, 13, 13])]].forEach(([f, nom, dim, larg]) => {
    eq(f.racine.attrs.xmlns, NS.M, nom + ' xmlns'); eq(f.ordre, ['dimension', 'sheetViews', 'sheetFormatPr', 'cols', 'sheetData'], nom + ' ordre des elements');
    eq(f.dimension, dim, nom + ' dimension');
    const sv = xUn(xUn(f.racine, 'sheetViews'), 'sheetView'); eq(sv.attrs.workbookViewId, '0', nom + ' workbookViewId');
    const pane = xUn(sv, 'pane'); eq([pane.attrs.ySplit, pane.attrs.topLeftCell, pane.attrs.activePane, pane.attrs.state], ['1', 'A2', 'bottomLeft', 'frozen'], nom + ' pane');
    const sel = xUn(sv, 'selection'); eq([sel.attrs.pane, sel.attrs.activeCell, sel.attrs.sqref], ['bottomLeft', 'A2', 'A2'], nom + ' selection');
    eq(xUn(f.racine, 'sheetFormatPr').attrs.defaultRowHeight, '15', nom + ' defaultRowHeight');
    eq(larg.map((_, i) => f.cols[i + 1] && f.cols[i + 1].width), larg, nom + ' largeurs des colonnes');
    eq(larg.every((_, i) => f.cols[i + 1] && f.cols[i + 1].custom === '1'), true, nom + ' customWidth="1"');
    f.lignes.forEach((l, i) => {
      eq(l.r, String(i + 1), nom + ' numero de ligne');
      let prec = -1;
      l.refs.forEach((ref) => { const m = /^([A-Z]+)(\d+)$/.exec(ref); assert(m && m[2] === l.r, nom + ' reference ' + ref + ' hors de la ligne ' + l.r); const col = [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0); assert(col > prec, nom + ' cellules hors ordre en ' + ref); prec = col; });
    });
    f.lignes[0].refs.forEach((ref) => { const c = f.cellules.get(ref); eq([c.t, c.s], ['inlineStr', '1'], nom + ' en-tete ' + ref + ' (inlineStr, s=1)'); });
    f.cellules.forEach((c, ref) => { if (!/^[A-Z]+1$/.test(ref)) assert(c.s === undefined || c.s !== '1', nom + ' ' + ref + ' en gras alors que ce n\'est pas un en-tete'); assert(c.f === 0, nom + ' formule en ' + ref); });
  });
});

check('Excel : feuille Scores de S01 (en-tetes, types, cellules absentes) (C7.34)', async (A) => {
  await A.ref();
  const x = analyserXlsx(await A.octets('S01'));
  const f = x.scores;
  eq([...f.lignes[0].refs].map((r) => f.cellules.get(r).v), ENT_SCORES, 'en-tetes');
  const lignes = [['S01', 1, '2026-03-02', 'A', 1, 0, 1, 1, 3, 0, 0, 1, 1, 2], ['S01', 2, '2026-03-09', 'B', 6, 6, 6, 5, 23, 0, 0, 0, 0, 0], ['S01', 3, '2026-03-16', 'C', -2, undefined, 9, 9, 16, 0, 4, 0, 0, 4]];
  comparerFeuille(f, grilleAttendue(ENT_SCORES, lignes), 'Scores');
  eq(f.cellules.get('E2').k, 'n', 'E2 entier'); eq(f.cellules.get('E2').t, undefined, 'E2 sans attribut t'); eq(f.cellules.get('C2').t, 'inlineStr', 'C2 chaine'); assert(!f.cellules.has('F4'), 'F4 doit etre absente');
  eq(f.cellules.get('E4').v, '-2', 'E4 = -2'); eq(f.cellules.get('J2').v, '0', 'les manquants a 0 sont presents');
});

check('Excel : feuille Cotations de S01 (27 en-tetes, NA en texte, vides absentes, T2 en nombres) (C7.35)', async (A) => {
  await A.ref();
  const f = analyserXlsx(await A.octets('S01')).cots;
  eq([...f.lignes[0].refs].map((r) => f.cellules.get(r).v), ENT_COT, '27 en-tetes'); eq(ENT_COT.length, 27, 'nombre');
  const liste = REF_NORM(); const P = modeleParticipants(liste).filter((p) => p.cle === 's01');
  comparerFeuille(f, grilleAttendue(ENT_COT, lignesExcel(liste, P).cots), 'Cotations');
  const v = (r) => { const c = f.cellules.get(r); return c ? c.k + ':' + c.v : undefined; };
  eq([v('E2'), v('F2'), v('V2')], ['n:3', undefined, 't:NA'], 'E2, F2, V2');
  eq([v('F3'), v('X3'), v('Y3'), v('Z3'), v('AA3')], ['t:NA', 'n:1', 'n:0', 'n:1', undefined], 'ligne 3');
  eq([v('M4'), v('X4'), v('Y4'), v('Z4'), v('AA4'), v('N4'), v('O4'), v('P4'), v('Q4')], ['n:3', 'n:-1', 'n:1', 'n:0', 'n:1', undefined, undefined, undefined, undefined], 'ligne 4');
});

check('Excel : tous les participants, 14 lignes dans l\'ordre participants puis sessions, derniere ligne vierge (C7.36)', async (A) => {
  await A.ref();
  const buf = await A.octets(null); const x = analyserXlsx(buf);
  const app = await A.sessions(); const liste = REF_NORM().concat(app.filter((s) => REF_IDS.indexOf(s.id) < 0).map((s) => norm(s)));
  const P = modeleParticipants(liste); eq(P.map((p) => p.cle), ['p6', 'p7', 'p8', 's01', 'z9', ''], 'participants du modele');
  const L = lignesExcel(liste, P);
  comparerFeuille(x.scores, grilleAttendue(ENT_SCORES, L.scores), 'Scores (tous)'); comparerFeuille(x.cots, grilleAttendue(ENT_COT, L.cots), 'Cotations (tous)');
  eq(x.scores.dimension, 'A1:N15', 'dimension Scores'); eq(x.cots.dimension, 'A1:AA15', 'dimension Cotations');
  const col = (r) => (x.scores.cellules.get(r) || {}).v;
  eq(col('A2'), 'P6', 'A2'); eq([col('B2'), col('C2')], ['1', '2026-04-06'], 'ligne 2 = p6-early');
  const ligne15 = x.scores.lignes[14].refs; assert(ligne15.indexOf('A15') < 0 && ligne15.indexOf('B15') < 0, 'la session vierge a une cellule A ou B');
  eq(['J15', 'K15', 'L15', 'M15', 'N15'].map(col), ['4', '4', '3', '3', '14'], 'manquants de la session vierge');
  eq(['E15', 'F15', 'G15', 'H15', 'I15'].map((r) => x.scores.cellules.has(r)), [false, false, false, false, false], 'scores vides de la session vierge');
});

check('Excel : Z9 (une session, ni numero ni condition ni score) et graphie du code apres CASSE (C7.25, C1.1)', async (A) => {
  await A.ref(); await A.importer(CASSE, ['s01-d']);
  const z = analyserXlsx(await A.octets('z9')).scores;
  eq(z.lignes.length, 2, 'lignes (en-tete + 1)');
  comparerFeuille(z, grilleAttendue(ENT_SCORES, [['Z9', undefined, '2026-06-01', undefined, undefined, undefined, undefined, undefined, undefined, 4, 4, 3, 3, 14]]), 'Scores Z9');
  const s = analyserXlsx(await A.octets('S01')).scores;
  eq([2, 3, 4, 5].map((r) => s.cellules.get('A' + r).v), ['s01', 's01', 's01', 's01'], 'colonne A : graphie affichee du participant (s01) pour toutes les lignes');
  eq([2, 3, 4, 5].map((r) => s.cellules.get('B' + r).v), ['1', '2', '3', '4'], 'numeros');
});

check('Excel : telechargement par #btn-xlsx-participant et #btn-xlsx-tous (noms, octets, type MIME, message) (C7.37)', async (A) => {
  await A.ref();
  await A.fiche('s01');
  const d1 = await A.telecharger('#btn-xlsx-participant');
  const ok1 = datesAcceptables().map((d) => 'grille-haptique_scores_S01_' + d + '.xlsx');
  assert(ok1.includes(d1.name), 'nom ' + d1.name + ' (attendu ' + ok1[0] + ')');
  assert(d1.buf.equals(await A.octets('S01')), 'octets differents de xlsxOctets("S01")');
  const msg = await A.texte('#message-participants');
  assert(msg.indexOf('Fichier Excel exporté : ' + d1.name) >= 0 && /\(3 sessions\)\.$/.test(msg), 'message : ' + msg);
  const types = await A.page.evaluate(() => window.__blobs.slice());
  assert(types.indexOf(MIME_XLSX_PAGE()) >= 0 || types.some((t) => t === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'Blob de type MIME xlsx non cree : ' + JSON.stringify(types));
  await A.page.click('#btn-retour-liste');
  const d2 = await A.telecharger('#btn-xlsx-tous');
  assert(datesAcceptables().map((d) => 'grille-haptique_scores_tous_' + d + '.xlsx').includes(d2.name), 'nom ' + d2.name);
  assert(d2.buf.equals(await A.octets(null)), 'octets differents de xlsxOctets(null)');
  const msg2 = await A.texte('#message-participants'); assert(msg2.indexOf(d2.name) >= 0 && /\(14 sessions\)\.$/.test(msg2), 'message tous : ' + msg2);
  await A.fiche('');
  const d3 = await A.telecharger('#btn-xlsx-participant');
  assert(datesAcceptables().map((d) => 'grille-haptique_scores_x_' + d + '.xlsx').includes(d3.name), 'nom pour (sans code) : ' + d3.name);
  assert((await A.texte('#message-participants')).match(/\(1 session\)\.$/), 'message au singulier');
});
function MIME_XLSX_PAGE() { return MIME_XLSX; }

check('Excel : pas d\'injection (code -1 = chaine, jamais formule), echappement XML, caracteres de controle supprimes (C7.38, C5.4)', async (A) => {
  const mk = (id, code, no, obs) => blank({ id, identification: { code_sujet: code, session_no: no, date: '2026-05-0' + no, observateur: obs || '' } });
  const jeu = [mk('inj-1', '-1', 1, '<img src=x onerror=window.__x=1>'), mk('inj-2', 'A&B<C>"q"\u0001x', 1), mk('inj-3', '=SOMME(A1)', 1), mk('inj-4', '+1', 1), mk('inj-5', '@x', 1)];
  await A.importer(sauvegarde(jeu), jeu.map((s) => s.id));
  const P = await A.participants();
  const bonnes = [];
  for (const id of ['inj-1', 'inj-2', 'inj-3', 'inj-4', 'inj-5']) {
    const p = P.find((x) => x.sessions.indexOf(id) >= 0); assert(p, 'participant de ' + id + ' introuvable');
    const x = analyserXlsx(await A.octets(p.cle)); const c = x.scores.cellules.get('A2');
    assert(c, 'cellule A2 absente pour ' + id); eq([c.t, c.f], ['inlineStr', 0], 'A2 de ' + id + ' : chaine en ligne sans formule');
    assert(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(x.parts['xl/worksheets/sheet1.xml']), 'caractere de controle dans le XML');
    bonnes.push([id, c.v, p.code]);
  }
  bonnes.forEach((b) => eq(b[1], b[2].replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''), 'texte de la cellule ' + b[0] + ' (graphie du participant, controles supprimes)'));
  const tous = analyserXlsx(await A.octets(null)); eq(tous.z.problemes, [], 'archive tous');
  eq(await A.page.evaluate(() => window.__x), undefined, 'window.__x');
});

check('Excel : relecture independante par Python zipfile (testzip, noms, stocke, XML, aucune formule, aucun docProps) (C7.33)', async (A) => {
  const py = trouverPython(); if (!py) ignorer('python3 absent');
  await A.ref();
  const f = path.join(TMP_DATA, 'py-' + (++compteurId) + '.xlsx'); fs.writeFileSync(f, await A.octets('S01'));
  const r = lancerPython(py, f);
  eq(r.testzip, null, 'testzip'); eq(r.namelist, NOMS_ZIP, 'namelist'); eq(r.compress.every((c) => c === 0), true, 'compress_type 0'); eq(r.xml_ok, true, 'XML bien forme'); eq(r.has_f, false, 'balise <f>'); eq(r.docprops, false, 'docProps');
});

check('Excel : relecture independante par openpyxl (feuilles, volets figes, gras, types de cellules, C7.34 et C7.35)', async (A) => {
  const py = trouverPython(); if (!py) ignorer('python3 absent');
  await A.ref();
  const f = path.join(TMP_DATA, 'op-' + (++compteurId) + '.xlsx'); fs.writeFileSync(f, await A.octets('S01'));
  const r = lancerPython(py, f);
  if (r.openpyxl === false) ignorer('module openpyxl absent');
  eq(r.sheetnames, ['Scores', 'Cotations'], 'sheetnames'); eq(r.freeze, ['A2', 'A2'], 'freeze_panes'); eq(r.gras, [true, true], 'A1 en gras');
  const S = r.rows.Scores; const C = r.rows.Cotations;
  eq(S[0], ENT_SCORES.map((h) => ['str', h]), 'en-tetes Scores');
  const num = (v) => (v === null ? ['NoneType', null] : typeof v === 'number' ? ['int', v] : ['str', v]);
  const att = [['S01', 1, '2026-03-02', 'A', 1, 0, 1, 1, 3, 0, 0, 1, 1, 2], ['S01', 2, '2026-03-09', 'B', 6, 6, 6, 5, 23, 0, 0, 0, 0, 0], ['S01', 3, '2026-03-16', 'C', -2, null, 9, 9, 16, 0, 4, 0, 0, 4]];
  att.forEach((l, i) => eq(S[i + 1], l.map(num), 'ligne ' + (i + 2) + ' de Scores'));
  eq(C[0].length, 27, '27 en-tetes'); eq(C[1][4], ['int', 3], 'E2'); eq(C[1][5], ['NoneType', null], 'F2'); eq(C[1][21], ['str', 'NA'], 'V2 = NA');
  eq([C[2][5], C[2][23], C[2][24], C[2][25], C[2][26]], [['str', 'NA'], ['int', 1], ['int', 0], ['int', 1], ['NoneType', null]], 'ligne 3');
  eq([C[3][12], C[3][23], C[3][24], C[3][25], C[3][26]], [['int', 3], ['int', -1], ['int', 1], ['int', 0], ['int', 1]], 'ligne 4');
  eq([13, 14, 15, 16].map((j) => C[3][j]), [['NoneType', null], ['NoneType', null], ['NoneType', null], ['NoneType', null]], 'N4 a Q4 vides');
});

check('Excel : conversion LibreOffice en CSV : en-tete et trois lignes de C7.34 (valeurs vides = ,,)', async (A) => {
  const so = trouverSoffice(); if (!so) ignorer('LibreOffice (soffice) absent');
  await A.ref();
  const dir = fs.mkdtempSync(path.join(TMP_DATA, 'lo-')); const f = path.join(dir, 'S01.xlsx'); fs.writeFileSync(f, await A.octets('S01'));
  const sortie = path.join(dir, 'sortie'); const profil = path.join(dir, 'profil');
  const r = cp.spawnSync(so, ['--headless', '--norestore', '-env:UserInstallation=file://' + profil, '--convert-to', 'csv', '--outdir', sortie, f], { timeout: 80000, encoding: 'utf8' });
  try { cp.spawnSync('pkill', ['-f', profil]); } catch (e) { /* ignore */ }
  const csv = path.join(sortie, 'S01.csv');
  if (!fs.existsSync(csv)) ignorer('conversion LibreOffice impossible dans cet environnement (' + String(r.error || r.stderr || '').slice(0, 80) + ')');
  const l = fs.readFileSync(csv, 'utf8').replace(/^/, '').split(/\r?\n/).filter((x) => x !== '');
  eq(l, [ENT_SCORES.join(','), 'S01,1,2026-03-02,A,1,0,1,1,3,0,0,1,1,2', 'S01,2,2026-03-09,B,6,6,6,5,23,0,0,0,0,0', 'S01,3,2026-03-16,C,-2,,9,9,16,0,4,0,0,4'], 'lignes du CSV');
}, { delai: 100000 });

check('Excel : avertissement « donnees de sante pseudonymisees » a cote des boutons d\'export, liste et fiche (C7.39, C2.2, C5.8)', async (A) => {
  await A.ref();
  await A.liste();
  const l = await A.page.evaluate(() => { const a = document.getElementById('avertissement-liste'); const b = document.getElementById('btn-xlsx-tous');
    return { t: a.textContent.trim(), cls: a.classList.contains('avertissement-sante'), parent: a.parentElement === b.parentElement, visible: a.getClientRects().length > 0 }; });
  eq(l.t, AVERTISSEMENT, 'texte (liste)'); assert(l.cls && l.parent && l.visible, 'liste : classe avertissement-sante, meme parent que #btn-xlsx-tous, visible : ' + JSON.stringify(l));
  await A.fiche('s01');
  const d = await A.page.evaluate(() => { const a = document.getElementById('avertissement-detail'); const b = document.getElementById('btn-xlsx-participant');
    return { t: a.textContent.trim(), cls: a.classList.contains('avertissement-sante'), parent: a.parentElement === b.parentElement, visible: a.getClientRects().length > 0 }; });
  eq(d.t, AVERTISSEMENT, 'texte (fiche)'); assert(d.cls && d.parent && d.visible, 'fiche : ' + JSON.stringify(d));
});

function trouverPython() {
  const r = cp.spawnSync('python3', ['-I', '-c', 'print(1)'], { encoding: 'utf8', timeout: 10000 });
  return r.status === 0 ? 'python3' : null;
}
function trouverSoffice() {
  for (const c of ['soffice', 'libreoffice']) { const r = cp.spawnSync(c, ['--version'], { encoding: 'utf8', timeout: 20000 }); if (r.status === 0) return c; }
  return null;
}
const SCRIPT_PY = [
  'import sys, json, zipfile',
  'import xml.etree.ElementTree as ET',
  'f = sys.argv[1]',
  'z = zipfile.ZipFile(f)',
  'out = {"testzip": z.testzip(), "namelist": z.namelist(), "compress": [i.compress_type for i in z.infolist()], "xml_ok": True}',
  'out["has_f"] = False',
  'for n in z.namelist():',
  '    d = z.read(n)',
  '    ET.fromstring(d)',
  '    if b"<f>" in d or b"<f " in d: out["has_f"] = True',
  'out["docprops"] = any("docProps" in n for n in z.namelist())',
  'try:',
  '    import openpyxl',
  'except ImportError:',
  '    out["openpyxl"] = False',
  'else:',
  '    wb = openpyxl.load_workbook(f)',
  '    out["sheetnames"] = wb.sheetnames',
  '    out["freeze"] = [ws.freeze_panes for ws in wb.worksheets]',
  '    out["gras"] = [bool(ws["A1"].font.b) for ws in wb.worksheets]',
  '    out["rows"] = {}',
  '    for ws in wb.worksheets:',
  '        out["rows"][ws.title] = [[[type(c.value).__name__, c.value] for c in row] for row in ws.iter_rows()]',
  'print(json.dumps(out))',
].join('\n');
function lancerPython(py, fichier) {
  const s = path.join(TMP_OUTILS, 'lire.py'); fs.writeFileSync(s, SCRIPT_PY);
  const r = cp.spawnSync(py, ['-I', s, fichier], { encoding: 'utf8', timeout: 30000, maxBuffer: 1 << 26 });
  if (r.status !== 0) fail('Python a echoue : ' + String(r.stderr).trim().split('\n').slice(-2).join(' | '));
  return JSON.parse(r.stdout);
}

/* ================================================================== */
/* 9. Impression PDF du bilan (C4)                                     */
/* ================================================================== */

check('Impression : #btn-pdf-bilan pose data-impression="bilan", appelle print une fois, retire l\'attribut (C7.29)', async (A) => {
  await A.ref(); await A.fiche('s01');
  await A.espionPrint();
  eq(await A.page.evaluate(() => document.body.hasAttribute('data-impression')), false, 'attribut avant');
  await A.page.click('#btn-pdf-bilan');
  await A.page.waitForFunction(() => window.__prints.length >= 1);
  eq(await A.page.evaluate(() => window.__prints), [{ attr: 'bilan', vueCachee: false }], 'appels a print (attribut pendant l\'appel)');
  eq(await A.page.evaluate(() => document.body.hasAttribute('data-impression')), false, 'attribut apres');
  assert((await A.texte('#aide-pdf')).indexOf('Enregistrer au format PDF') >= 0, '#aide-pdf');
  assert(await A.visible('#vue-participants'), 'la vue doit rester ouverte');
});

check('Impression : l\'attribut est retire meme si window.print() leve une exception (finally)', async (A) => {
  await A.ref(); await A.fiche('s01');
  await A.page.evaluate(() => { window.print = function () { window.__vu = document.body.getAttribute('data-impression'); throw new Error('print refuse'); }; });
  await A.page.click('#btn-pdf-bilan');
  await A.page.waitForFunction(() => window.__vu === 'bilan');
  eq(await A.page.evaluate(() => document.body.hasAttribute('data-impression')), false, 'attribut apres exception');
}, { tolerer: true });

check('Impression : beforeprint / afterprint posent et retirent l\'attribut quand la vue est ouverte seulement (Ctrl+P)', async (A) => {
  await A.ref();
  const lire = () => A.page.evaluate(() => document.body.getAttribute('data-impression'));
  await A.page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  eq(await lire(), null, 'vue fermee : pas d\'attribut');
  await A.page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await A.fiche('s01');
  await A.page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  eq(await lire(), 'bilan', 'vue ouverte : attribut pose');
  await A.page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  eq(await lire(), null, 'afterprint : attribut retire');
});

check('Impression : rendu du bilan en media print (elements masques, avertissement, sauts de page, 2 colonnes) (C7.30)', async (A) => {
  await A.importer(sauvegarde(BIG30), BIG30.map((s) => s.id)); await A.ref();
  await A.fiche('s01');
  await A.page.setViewportSize({ width: 718, height: 1000 });
  await A.page.evaluate(() => document.body.setAttribute('data-impression', 'bilan'));
  await A.page.emulateMedia({ media: 'print' });
  const r = await A.page.evaluate(() => {
    const d = (s) => [...document.querySelectorAll(s)].map((e) => getComputedStyle(e).display);
    const g = document.querySelector('.grille-scores'); const cs = (e, p) => getComputedStyle(e)[p];
    return {
      vue: d('#vue-participants'), contenu: d('#contenu'),
      masques: ['#btn-pdf-bilan', '#btn-xlsx-participant', '#btn-nouvelle-pour-participant', '#aide-pdf', '#resume-session', '#btn-retour-saisie', '#btn-retour-liste', '#message-participants', '#table-sessions-participant td[data-col="actions"]']
        .map((s) => [s, d(s).length ? d(s).every((x) => x === 'none') : 'absent']),
      avert: d('#avertissement-detail'), titre: d('#participant-titre'), meta: d('#participant-meta'),
      figure: cs(document.querySelector('#bilan figure.graphique'), 'breakInside'), tr: cs(document.querySelector('#table-sessions-participant tr[data-session-id]'), 'breakInside'),
      h4: cs(document.querySelector('#bilan h4'), 'breakAfter'), defil: cs(document.querySelector('.graphique-defil'), 'overflowX'),
      colonnes: cs(g, 'gridTemplateColumns').trim().split(/\s+/).length, margeG: cs(document.getElementById('vue-participants'), 'marginLeft'), maxL: cs(document.getElementById('vue-participants'), 'maxWidth'),
      svgMax: cs(document.querySelector('#bilan svg'), 'maxWidth'), svgH: cs(document.querySelector('#bilan svg'), 'height'),
      couleurs: cs(document.querySelector('#bilan svg'), 'printColorAdjust'),
      page: document.documentElement.scrollWidth,
    };
  });
  eq(r.vue, ['block'], '#vue-participants en impression avec l\'attribut'); eq(r.contenu, ['none'], '#contenu');
  r.masques.forEach((m) => eq(m[1], true, m[0] + ' doit etre masque en impression (display:none)'));
  assert(r.avert.length === 1 && r.avert[0] !== 'none', '#avertissement-detail masque');
  assert(r.titre[0] !== 'none' && r.meta[0] !== 'none', 'titre ou meta masque');
  eq(r.figure, 'avoid', 'figure break-inside'); eq(r.tr, 'avoid', 'tr break-inside'); eq(r.h4, 'avoid', 'h4 break-after'); eq(r.defil, 'visible', '.graphique-defil overflow-x');
  eq(r.colonnes, 2, 'colonnes de .grille-scores'); eq(r.margeG, '0px', 'marge gauche de la vue'); eq(r.maxL, 'none', 'largeur maximale de la vue'); eq(r.svgMax, '100%', 'svg max-width');
  eq(r.couleurs, 'exact', 'print-color-adjust');
  await A.page.evaluate(() => document.body.removeAttribute('data-impression'));
  eq(await A.page.evaluate(() => getComputedStyle(document.getElementById('vue-participants')).display), 'none', 'sans l\'attribut, la vue n\'est pas imprimee');
  await A.page.evaluate(() => document.body.removeAttribute('data-impression'));
  await A.page.emulateMedia({ media: 'screen' });
  await A.fiche('big30');
  await A.page.evaluate(() => document.body.setAttribute('data-impression', 'bilan'));
  await A.page.emulateMedia({ media: 'print' });
  const gros = await A.page.evaluate(() => {
    const g = document.querySelector('.grille-scores'); const gw = g.getBoundingClientRect().width;
    return { debord: [...document.querySelectorAll('#vue-participants svg')].filter((s) => s.getBoundingClientRect().right > 719.5).length,
      larges: [...g.querySelectorAll('figure[data-large="true"]')].map((f) => f.getBoundingClientRect().width / gw), n: g.querySelectorAll('figure').length };
  });
  eq(gros.debord, 0, 'svg depassant 719 px en impression (BIG30)'); eq(gros.n, 5, 'figures'); gros.larges.forEach((w) => assert(w > 0.95, 'figure data-large sur toute la largeur : ' + w));
  eq(gros.larges.length, 5, 'figures data-large');
});

check('Impression : sans l\'attribut, #vue-participants n\'est pas imprimee et les 6 etapes s\'impriment a la suite (C7.31)', async (A) => {
  await A.ref(); await A.fiche('s01');
  await A.page.emulateMedia({ media: 'print' });
  eq(await A.page.evaluate(() => getComputedStyle(document.getElementById('vue-participants')).display), 'none', 'vue en impression sans attribut');
  await A.page.emulateMedia({ media: 'screen' });
  await A.page.click('#btn-retour-saisie');
  await A.page.emulateMedia({ media: 'print' });
  const r = await A.page.evaluate(() => ({ p: [...document.querySelectorAll('section[data-panel]')].map((s) => getComputedStyle(s).display !== 'none'), v: getComputedStyle(document.getElementById('vue-participants')).display }));
  eq(r.p, [true, true, true, true, true, true], 'sections d\'etape imprimees'); eq(r.v, 'none', 'vue');
});

check('Impression : page.pdf() du bilan de 12 sessions donne un PDF de plusieurs pages A4', async (A) => {
  const sess = jeuLong('PDF12', 12, 'pdf-');
  await A.importer(sauvegarde(sess), sess.map((s) => s.id));
  await A.fiche('pdf12');
  await A.page.evaluate(() => document.body.setAttribute('data-impression', 'bilan'));
  const buf = await A.page.pdf({ format: 'A4', printBackground: true });
  assert(buf.slice(0, 4).toString() === '%PDF', 'pas un PDF'); assert(buf.length > 5000, 'PDF de ' + buf.length + ' octets');
  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  assert(pages >= 2, 'nombre de pages : ' + pages);
});

function hexVersRgb(h) { h = h.trim().replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
function luminance(rgb) { const f = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; }
function contraste(a, b) { const la = luminance(hexVersRgb(a)); const lb = luminance(hexVersRgb(b)); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
const lireVars = (A) => A.page.evaluate((noms) => { const cs = getComputedStyle(document.documentElement); const o = {}; noms.forEach((n) => { o[n] = cs.getPropertyValue(n).trim(); }); return o; }, Object.keys(VARS));
const normHex = (h) => (h || '').trim().toUpperCase().replace(/^#([0-9A-F])([0-9A-F])([0-9A-F])$/, '#$1$1$2$2$3$3');

check('Themes : variables --bil-* en valeurs claires, sombres, puis claires en impression meme en theme sombre ; couleur d\'une case cot-3 (C7.28)', async (A) => {
  await A.ref(); await A.fiche('s01');
  const noms = Object.keys(VARS);
  const compare = (lu, idx, quand) => noms.forEach((n) => eq(normHex(lu[n]), VARS[n][idx], quand + ' : ' + n));
  const fillCase = () => A.page.evaluate(() => { const r = document.querySelector('g[data-cellule][data-code="V3.1"][data-session="s01-c"] rect.cot-3'); return r ? getComputedStyle(r).fill : null; });
  await A.page.emulateMedia({ colorScheme: 'light' }); compare(await lireVars(A), 0, 'clair'); const fc = await fillCase();
  eq(fc, 'rgb(10, 95, 87)', 'fond d\'une case cot-3 (clair)');
  await A.page.emulateMedia({ colorScheme: 'dark' }); compare(await lireVars(A), 1, 'sombre'); const fd = await fillCase();
  eq(fd, 'rgb(111, 201, 186)', 'fond d\'une case cot-3 (sombre)');
  await A.page.emulateMedia({ colorScheme: 'dark', media: 'print' }); compare(await lireVars(A), 0, 'impression en theme sombre');
  eq(await fillCase(), 'rgb(10, 95, 87)', 'fond d\'une case cot-3 en impression (theme sombre)');
});

check('Themes : contraste texte / fond d\'au moins 4,5 (traits : 3) pour chaque paire de la palette, en clair et en sombre (C3.6)', async (A) => {
  await A.ref(); await A.fiche('s01');
  for (const [schema, idx] of [['light', 0], ['dark', 1]]) {
    await A.page.emulateMedia({ colorScheme: schema });
    const lu = await lireVars(A);
    PAIRES_CONTRASTE.forEach(([fond, txt]) => { const c = contraste(normHex(lu[fond]), normHex(lu[txt])); assert(c >= 4.5, schema + ' : ' + fond + ' / ' + txt + ' = ' + c.toFixed(2)); });
    PAIRES_TRAITS.forEach(([trait, fond]) => { const c = contraste(normHex(lu[trait]), normHex(lu[fond])); assert(c >= 3, schema + ' : trait ' + trait + ' / ' + fond + ' = ' + c.toFixed(2)); });
  }
});

/* ================================================================== */
/* 10. Adaptatif (C2.7, C3.8, C7.27)                                   */
/* ================================================================== */

async function pageSansDebord(A, quand) {
  const r = await A.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, iw: window.innerWidth }));
  assert(r.sw <= r.iw && r.bw <= r.iw, quand + ' : defilement horizontal de la page (scrollWidth ' + r.sw + '/' + r.bw + ' > ' + r.iw + ')');
}
async function parcoursAdaptatif(A) {
  await A.ref(); await A.importer(sauvegarde(BIG30), BIG30.map((s) => s.id));
  await A.liste(); await pageSansDebord(A, 'liste');
  await A.fiche('s01'); await pageSansDebord(A, 'fiche S01');
  await A.fiche('big30'); await pageSansDebord(A, 'fiche BIG30 (30 sessions)');
  await A.page.evaluate(() => window.scrollTo(5000, 0));
  eq(await A.page.evaluate(() => window.scrollX), 0, 'la page ne doit jamais defiler horizontalement');
  const fig = await A.page.evaluate(() => [...document.querySelectorAll('#bilan figure')].filter((f) => f.getBoundingClientRect().right > window.innerWidth + 0.5).length);
  eq(fig, 0, 'figures depassant la fenetre (min-width:0 sur les elements de grille)');
  const defil = await A.page.evaluate(() => [...document.querySelectorAll('#bilan .graphique-defil')].map((d) => [getComputedStyle(d).overflowX, d.getBoundingClientRect().right <= window.innerWidth + 0.5, getComputedStyle(d).maxWidth]));
  defil.forEach((d, i) => { assert(d[0] === 'auto' || d[0] === 'scroll', 'overflow-x du defilement ' + i + ' : ' + d[0]); assert(d[1], 'zone de defilement ' + i + ' hors fenetre'); });
}

check('Adaptatif 360 px : aucun defilement horizontal de la page (liste, fiche S01, fiche 30 sessions) ; defilement confine aux graphiques', parcoursAdaptatif, MOBILE);
check('Adaptatif 768 px : aucun defilement horizontal de la page (liste, fiche, 30 sessions)', parcoursAdaptatif, { viewport: { width: 768, height: 1024 } });
check('Adaptatif 1920 px : aucun defilement horizontal de la page (liste, fiche, 30 sessions)', parcoursAdaptatif, { viewport: { width: 1920, height: 1080 } });

check('Adaptatif 360 px : 30 sessions, zones de defilement des graphiques focalisables et plus larges que la fenetre', async (A) => {
  await A.importer(sauvegarde(BIG30), BIG30.map((s) => s.id)); await A.fiche('big30');
  const r = await A.page.evaluate(() => {
    const d = document.querySelector('svg[data-graphique="axe3"]').closest('.graphique-defil'); d.focus();
    const t1 = document.querySelector('svg[data-graphique="cotations-t1"]').closest('.graphique-defil');
    return { focus: document.activeElement === d, cw: d.clientWidth, sw: d.scrollWidth, sw1: t1.scrollWidth, iw: window.innerWidth };
  });
  assert(r.focus, 'zone de defilement non focalisable'); assert(r.cw <= r.iw && r.sw >= 1740, 'axe3 : clientWidth ' + r.cw + ', scrollWidth ' + r.sw); assert(r.sw1 >= 1446, 'T1 scrollWidth ' + r.sw1);
}, MOBILE);

check('Adaptatif 360 px : boutons de la vue et de l\'en-tete d\'au moins 44 px de haut (liste et fiche) (C7.27)', async (A) => {
  await A.ref();
  const mesure = () => A.page.evaluate(() => [...document.querySelectorAll('#btn-participants, #vue-participants button')].filter((b) => b.getClientRects().length > 0).map((b) => [b.id || b.textContent.trim().slice(0, 25), b.getBoundingClientRect().height]));
  await A.liste(); let m = await mesure(); assert(m.length >= 8, 'boutons mesures (liste) : ' + m.length);
  m.forEach((b) => assert(b[1] >= 43.9, 'bouton « ' + b[0] + ' » de ' + b[1].toFixed(1) + ' px (liste)'));
  await A.fiche('s01'); m = await mesure(); assert(m.length >= 12, 'boutons mesures (fiche) : ' + m.length);
  m.forEach((b) => assert(b[1] >= 43.9, 'bouton « ' + b[0] + ' » de ' + b[1].toFixed(1) + ' px (fiche)'));
}, MOBILE);

check('Adaptatif 360 px : bouton « Reprendre les champs » et zone d\'aide d\'au moins 44 px, sans debordement', async (A) => {
  await A.ref(); await A.panneau(); await A.page.click('#btn-nouvelle'); await A.go('session'); await A.fermerPanneau();
  await A.page.fill('#f-code', 's01');
  const h = await A.page.evaluate(() => document.getElementById('btn-reprendre-champs').getBoundingClientRect().height);
  assert(h >= 43.9, 'bouton de ' + h + ' px'); await pageSansDebord(A, 'etape Session avec aide');
}, MOBILE);

check('Adaptatif : tableaux en cartes jusqu\'a 719 px (data-label, aucun td ne deborde), en tableau a partir de 720 px (C2.7)', async (A) => {
  await A.ref();
  const lire = () => A.page.evaluate(() => {
    const out = {};
    ['table-participants', 'table-sessions-participant'].forEach((id) => {
      const t = document.getElementById(id); if (!t || t.getClientRects().length === 0) return;
      const tds = [...t.querySelectorAll('td')];
      out[id] = { cls: t.classList.contains('tableau-cartes'), cellule: tds.every((td) => getComputedStyle(td).display !== 'table-cell'), tableau: tds.every((td) => getComputedStyle(td).display === 'table-cell'),
        labels: tds.filter((td) => !td.getAttribute('data-label')).length, debord: tds.filter((td) => td.getBoundingClientRect().right > window.innerWidth + 0.5 || td.getBoundingClientRect().left < -0.5).length };
    });
    return out;
  });
  for (const [w, cartes] of [[360, true], [719, true], [720, false], [1280, false]]) {
    await A.page.setViewportSize({ width: w, height: 900 });
    await A.liste(); const l = await lire();
    await A.fiche('s01'); const f = await lire();
    [l, f].forEach((o, k) => {
      eq(Object.keys(o).length, 1, w + ' px : tableau de la ' + (k ? 'fiche' : 'liste') + ' visible');
      Object.keys(o).forEach((id) => {
        assert(o[id].cls, id + ' sans classe tableau-cartes');
        if (cartes) { assert(o[id].cellule, w + ' px : ' + id + ' devrait etre en cartes'); eq(o[id].labels, 0, w + ' px : td sans data-label dans ' + id); eq(o[id].debord, 0, w + ' px : td debordant dans ' + id); } else assert(o[id].tableau, w + ' px : ' + id + ' devrait etre un tableau');
      });
    });
    await pageSansDebord(A, w + ' px');
  }
});

check('Adaptatif : .grille-scores en une colonne a 360 px, en plusieurs colonnes sur grand ecran (C7.27)', async (A) => {
  await A.ref(); await A.fiche('s01');
  const col = () => A.page.evaluate(() => getComputedStyle(document.querySelector('.grille-scores')).gridTemplateColumns.trim().split(/\s+/).length);
  await A.page.setViewportSize({ width: 360, height: 740 }); eq(await col(), 1, 'colonnes a 360 px');
  await A.page.setViewportSize({ width: 1920, height: 1080 }); assert((await col()) >= 2, 'colonnes a 1920 px : ' + await col());
});

/* ================================================================== */
/* 11. Parcours complet hors ligne, poids et hygiene du fichier        */
/* ================================================================== */

check('Hors ligne : parcours complet de la partie C sans requete reseau ni erreur de console', async (A) => {
  const p = A.page;
  await A.ref(); await A.importer(sauvegarde(BIG30), BIG30.map((s) => s.id));
  await A.espionPrint();
  await A.liste(); await A.fiche('s01');
  await A.telecharger('#btn-xlsx-participant'); await p.click('#btn-pdf-bilan');
  await p.click('#btn-retour-liste'); await A.telecharger('#btn-xlsx-tous');
  await A.fiche('big30'); await p.click('#btn-nouvelle-pour-participant');
  await p.fill('#f-code', 's01'); await p.click('#btn-reprendre-champs');
  await A.panneau(); await A.fermerPanneau();
  await A.fiche('p8'); await p.click('button[data-supprimer-session="p8-3"]');
  await p.waitForTimeout(300);
  await p.emulateMedia({ media: 'print' }); await p.emulateMedia({ media: 'screen', colorScheme: 'dark' });
  const externes = A.requests.filter((u) => !/^(file:|data:|blob:|about:)/.test(u));
  eq(externes, [], 'requetes non locales'); eq(A.errors, [], 'erreurs');
});

statique('Fichier (partie C) : moins de 350 Ko (358 400 octets)', async () => {
  const n = fs.statSync(HTML).size;
  assert(n < 358400, 'taille ' + n + ' octets (limite 358400)');
});

statique('Fichier (partie C) : aucune URL http:// ou https:// hors http://www.w3.org/ (espaces de noms OOXML concatenes)', async () => {
  const txt = fs.readFileSync(HTML, 'utf8').split('http://www.w3.org/').join('');
  const hits = []; txt.split('\n').forEach((l, i) => { if (/https?:\/\//i.test(l)) hits.push((i + 1) + ': ' + l.trim().slice(0, 80)); });
  eq(hits, [], 'occurrences');
});

statique('Fichier (partie C) : aucun caractere invisible ni espace exotique (U+00A0, U+200B-200F, U+202F, U+2060, U+FEFF)', async () => {
  const txt = fs.readFileSync(HTML, 'utf8'); const hits = []; let ligne = 1;
  for (const ch of txt) {
    const cp2 = ch.codePointAt(0);
    if (cp2 === 0x0A) { ligne++; continue; }
    if (cp2 === 0xA0 || (cp2 >= 0x200B && cp2 <= 0x200F) || cp2 === 0x202F || cp2 === 0x2060 || cp2 === 0xFEFF) { hits.push('U+' + cp2.toString(16).toUpperCase().padStart(4, '0') + ' ligne ' + ligne); if (hits.length >= 5) break; }
  }
  eq(hits, [], 'caracteres interdits');
});

statique('Fichier (partie C) : apostrophes droites uniquement (pas de U+2018, U+2019)', async () => {
  const hits = []; fs.readFileSync(HTML, 'utf8').split('\n').forEach((l, i) => { if (/[‘’]/.test(l)) hits.push((i + 1) + ': ' + l.trim().slice(0, 60)); });
  eq(hits.slice(0, 5), [], 'apostrophes typographiques');
});

statique('Fichier (partie C) : ni fetch, XMLHttpRequest, @import, script/link externes ; @font-face seulement en data:font/woff2 (quatre)', async () => {
  const h = fs.readFileSync(HTML, 'utf8');
  const motifs = [[/<script[^>]+\bsrc\s*=/i, '<script src>'], [/<link[^>]+\bhref\s*=\s*(?!["']?data:)/i, '<link href>'], [/@import/i, '@import'], [/\bfetch\s*\(/, 'fetch('], [/XMLHttpRequest/, 'XMLHttpRequest'],
    [/sendBeacon/, 'sendBeacon'], [/\bWebSocket\b/, 'WebSocket'], [/\bEventSource\b/, 'EventSource']];
  eq(motifs.filter((m) => m[0].test(h)).map((m) => m[1]), [], 'motifs interdits');
  const faces = h.match(/@font-face\{[^}]*\}/g) || [];
  eq(faces.length, 4, 'nombre de @font-face');
  faces.forEach((f) => assert(/src:url\(data:font\/woff2;base64,[A-Za-z0-9+\/=]+\) format\('woff2'\)/.test(f), '@font-face sans police incorporee en data:font/woff2'));
  eq(h.match(/url\((?!data:|#)/g) || [], [], 'url() autres que data: ou #');
});

statique('Fichier (partie C) : ni innerHTML, outerHTML, insertAdjacentHTML ni document.write dans le source', async () => {
  const h = fs.readFileSync(HTML, 'utf8');
  const motifs = [[/innerHTML/, 'innerHTML'], [/outerHTML/, 'outerHTML'], [/insertAdjacentHTML/, 'insertAdjacentHTML'], [/document\s*\.\s*write/, 'document.write']];
  eq(motifs.filter((m) => m[0].test(h)).map((m) => m[1]), [], 'motifs interdits');
});

statique('Fichier (partie C) : un seul @page (inchange) et pas de commentaire d\'attribution', async () => {
  const h = fs.readFileSync(HTML, 'utf8');
  eq((h.match(/@page/g) || []).length, 1, 'occurrences de @page');
  const hits = []; h.split('\n').forEach((l, i) => { if (/claude|anthropic|generated (with|by)|co-authored|généré (par|avec)/i.test(l)) hits.push((i + 1) + ': ' + l.trim().slice(0, 80)); });
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
          await avecDelai(c.fn(A), c.opts.delai || 30000);
          if (!c.opts.tolerer) {
            const externes = A.requests.filter((u) => !/^(file:|data:|blob:|about:)/.test(u));
            assert(externes.length === 0, 'requete reseau : ' + externes.slice(0, 3).join(', '));
            assert(A.errors.length === 0, 'erreurs : ' + A.errors.slice(0, 3).join(' || '));
          }
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
  console.log('\n' + reussis + '/' + total + ' reussis' + (ignores ? ' (' + ignores + ' ignores : outil externe absent)' : ''));
  process.exit(reussis === total ? 0 : 1);
}

main().catch((e) => { console.error('Erreur fatale : ' + (e && e.stack || e)); process.exit(3); });
