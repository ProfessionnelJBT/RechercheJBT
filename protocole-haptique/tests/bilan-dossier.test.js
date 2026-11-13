#!/usr/bin/env node
'use strict';

/*
 * Suite de tests de bout en bout : bilan visuel de session (E1), sauvegarde dans un dossier (E2),
 * stockage durable (E3), poids et hygiene.
 * Ecrite uniquement a partir du contrat E (sections E1 a E3) ; le code de grille-haptique.html n'a pas ete lu.
 * Donnees : jeux fictifs uniquement, aucune donnee de sante reelle.
 *
 * Usage : node protocole-haptique/tests/bilan-dossier.test.js
 * Variables d'environnement facultatives : GRILLE_HTML (autre fichier HTML a tester),
 * GRILLE_FILTRE (expression reguliere : ne lance que les controles dont le nom correspond).
 * Sortie : une ligne "OK  nom" ou "ECHEC  nom : raison" par controle, "IGNORE  nom : raison" pour un controle
 * non automatisable (non compte dans le total), puis "n/N reussis".
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
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bilan-dossier-test-'));

process.on('unhandledRejection', () => {});

/* ------------------------------------------------------------------ */
/* Donnees du contrat                                                  */
/* ------------------------------------------------------------------ */

const T0 = ['T0.1', 'T0.2', 'T0.3', 'T0.4', 'T0.5'];
const T1 = ['V1.1', 'V1.2', 'V1.3', 'V1.4', 'V2.1', 'V2.2', 'V2.3', 'V2.4', 'V3.1', 'V3.2', 'V3.3', 'V4.1', 'V4.2', 'V4.3'];
const ITEMS = T0.concat(T1);
const OBS_PHASES = ['T0', 'AXE1', 'AXE2', 'AXE3', 'AXE4'];
const T2K = ['tonus', 'posture', 'emotion', 'relation'];
const PHYS = ['fc', 'vfc', 'ced', 'spo2'];
const TEMPS = ['t0', 't1', 'rupture', 't2'];
const AXES = ['axe1', 'axe2', 'axe3', 'axe4'];
const BORNES = { axe1: [-3, 9], axe2: [0, 12], axe3: [0, 9], axe4: [0, 9], total: [-3, 39] };
const GROUPE_DE = (c) => (c.charAt(0) === 'T' ? 'T0' : 'AXE' + c.charAt(1));
const MSG_AIDE = 'Sauvegarde locale en fichiers sur ce poste, un dossier par participant. Ce sont des données de santé pseudonymisées : ne les placez pas dans un stockage partagé ou en ligne. Pour retrouver des résultats, importez les fichiers .json dans l\'appli sur ce poste.';
const XSS = '<img src=x onerror="window.__xss=1">';

/* variables CSS : [clair, sombre] (memes valeurs que la suite participants) */
const VARS = {
  '--bil-cot-0': ['#DCE9E6', '#1C3A35'], '--bil-cot-txt-0': ['#14201F', '#E8EFED'],
  '--bil-cot-1': ['#A7CCC5', '#2C6058'], '--bil-cot-txt-1': ['#14201F', '#E8EFED'],
  '--bil-cot-2': ['#4D9A90', '#3F9184'], '--bil-cot-txt-2': ['#14201F', '#081816'],
  '--bil-cot-3': ['#0A5F57', '#6FC9BA'], '--bil-cot-txt-3': ['#FFFFFF', '#081816'],
  '--bil-cot-na': ['#E4E9E7', '#1F2B29'], '--bil-cot-na-trait': ['#9AA8A5', '#5A6B68'], '--bil-cot-txt-na': ['#41524F', '#ABBBB7'],
  '--bil-t2-neg': ['#F4E5C8', '#3A2C13'], '--bil-t2-neg-trait': ['#B3741B', '#D9A24D'], '--bil-t2-neg-txt': ['#14201F', '#E8EFED'],
  '--bil-t2-zero': ['#E4E9E7', '#1F2B29'], '--bil-t2-zero-txt': ['#14201F', '#E8EFED'],
  '--bil-t2-pos': ['#0E6B62', '#41B3A4'], '--bil-t2-pos-txt': ['#FFFFFF', '#081816'],
};

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
function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
function raison(e) {
  const lignes = String((e && e.message) || e).split('\n').map((l) => l.trim()).filter(Boolean);
  let r = lignes[0] || 'erreur inconnue';
  const loc = lignes.find((l) => /waiting for|locator\(|selector/.test(l) && l !== lignes[0]);
  if (loc) r += ' | ' + loc;
  return r.length > 420 ? r.slice(0, 417) + '...' : r;
}
function arrondi3(x) { return Math.round(x * 1000) / 1000; }
function ratio(v, min, max) { return v === null ? null : arrondi3(Math.min(1, Math.max(0, (v - min) / (max - min)))); }

/* ------------------------------------------------------------------ */
/* Jeux de donnees et modele independant                               */
/* ------------------------------------------------------------------ */

function blank(over) {
  const cotations = {}; ITEMS.forEach((c) => { cotations[c] = null; });
  const observations = {}; OBS_PHASES.concat(ITEMS).forEach((c) => { observations[c] = ''; });
  const t2 = {}; T2K.forEach((k) => { t2[k] = { evolution: null, details: '' }; });
  const physio = {}; PHYS.forEach((m) => { physio[m] = {}; TEMPS.forEach((t) => { physio[m][t] = null; }); });
  const s = {
    schema: 'grille-haptique/1', id: 'fixture', cree_le: '2026-11-12T09:30:00.000Z', modifie_le: '2026-11-12T10:05:00.000Z',
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
/* session complete, scores coherents avec les cotations */
function sess(over) {
  const s = blank(over); const c = calcScores(s.cotations);
  s.scores = Object.assign({}, c.scores, { manquants: c.manquants });
  return s;
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

/* modele bilanVisuel(), sans libelle ni unite (verifies a part) */
function modeleVis(liste, idCourant) {
  const cur = liste.find((s) => s.id === idCourant);
  const sc = calcScores(cur.cotations);
  const nul = (x) => (x === undefined ? null : x);
  let precedente = null;
  const code = (cur.identification.code_sujet || '').toLowerCase();
  if (code !== '') {
    const ord = ordreSessions(liste.filter((s) => (s.identification.code_sujet || '').toLowerCase() === code));
    const i = ord.findIndex((s) => s.id === idCourant);
    if (i > 0) {
      const p = ord[i - 1]; const pc = calcScores(p.cotations);
      const d = {}; AXES.concat(['total']).forEach((k) => { d[k] = (sc.scores[k] === null || pc.scores[k] === null) ? null : sc.scores[k] - pc.scores[k]; });
      precedente = { id: p.id, session_no: nul(p.identification.session_no), date: p.identification.date, deltas: d };
    }
  }
  return {
    total: { valeur: sc.scores.total, min: -3, max: 39, manquants: sc.manquants.total },
    axes: AXES.map((k) => ({ cle: k, valeur: sc.scores[k], min: BORNES[k][0], max: BORNES[k][1], manquants: sc.manquants[k] })),
    items: ITEMS.map((c) => ({ code: c, groupe: GROUPE_DE(c), valeur: nul(cur.cotations[c]) })),
    t2: T2K.map((k) => ({ cle: k, valeur: nul(cur.t2[k] && cur.t2[k].evolution) })),
    physio: PHYS.map((m) => ({ cle: m, points: TEMPS.map((t) => ({ temps: t, valeur: nul(cur.physio[m] && cur.physio[m][t]) })) })),
    precedente,
  };
}
/* retire libelle et unite d'un resultat de bilanVisuel() pour la comparaison de forme */
function sansLibelles(b) {
  const o = JSON.parse(JSON.stringify(b));
  if (o.axes) o.axes.forEach((x) => { delete x.libelle; });
  if (o.t2) o.t2.forEach((x) => { delete x.libelle; });
  if (o.physio) o.physio.forEach((x) => { delete x.libelle; delete x.unite; });
  return o;
}

/* jeu de reference fait main : J1 et ses precedentes */
const J1 = sess({ id: 'j1', identification: { code_sujet: 'E01', session_no: 2, date: '2026-05-12', condition: 'B' },
  cotations: { 'T0.1': 3, 'T0.2': 'NA', 'T0.3': 0, 'T0.5': 1, 'V1.1': 2, 'V1.2': 3, 'V1.3': 1, 'V1.4': 2, 'V2.1': 1, 'V2.2': 2, 'V2.3': 'NA', 'V3.1': 3 },
  t2: { tonus: { evolution: 1 }, posture: { evolution: 0 }, emotion: { evolution: -1 } },
  physio: { fc: { t0: 80, t1: 90, t2: 70 }, ced: { t1: 5.5 }, spo2: { t0: 98, t1: 98, t2: 98 } } });
const P1 = sess({ id: 'p1', identification: { code_sujet: 'e01', session_no: 1, date: '2026-05-05' },
  cotations: { 'V1.1': 1, 'V1.2': 1, 'V1.3': 1, 'V1.4': 2, 'V2.1': 2, 'V2.2': 1, 'V2.3': 1, 'V2.4': 1, 'V4.1': 1, 'V4.2': 1, 'V4.3': 0 } });
const P2 = sess({ id: 'p2', identification: { code_sujet: 'E01', session_no: 1, date: '2026-05-05' },
  cotations: { 'V1.1': 1, 'V1.2': 1, 'V1.3': 1, 'V1.4': 2, 'V2.1': 2, 'V2.2': 1, 'V2.3': 1, 'V2.4': 1, 'V3.1': 1, 'V3.2': 1, 'V3.3': 1, 'V4.1': 1, 'V4.2': 1, 'V4.3': 0 } });
/* distracteurs : plus ancienne, plus tardive, autre participant entre les deux, session sans code entre les deux */
const DIST = [
  sess({ id: 'f1', identification: { code_sujet: 'E01', session_no: 3, date: '2026-06-01' } }),
  sess({ id: 'p0', identification: { code_sujet: 'E01', session_no: 0, date: '2026-04-01' } }),
  sess({ id: 'o1', identification: { code_sujet: 'E02', session_no: 1, date: '2026-05-10' } }),
  sess({ id: 'v1', identification: { code_sujet: '', session_no: 1, date: '2026-05-11' } }),
];
const JEU_A = [DIST[0], DIST[1], DIST[2], J1, P1, DIST[3]];
const JEU_B = [DIST[0], DIST[1], DIST[2], J1, P2, DIST[3]];
const JEU_PREMIERE = [DIST[0], DIST[2], J1, DIST[3]];
const J1_SANS_CODE = sess(merge(J1, { id: 'j1s', identification: { code_sujet: '' } }));
const JEU_SANS_CODE = [DIST[3], J1_SANS_CODE];

/* tout rempli : toutes les cotations, tous les points physio, T2 complet */
const PLEIN = sess({ id: 'plein', identification: { code_sujet: 'PL1', session_no: 4, date: '2026-07-07', condition: 'C' },
  cotations: (() => { const o = {}; ITEMS.forEach((c, i) => { o[c] = i % 4; }); return o; })(),
  t2: { tonus: { evolution: -1 }, posture: { evolution: 0 }, emotion: { evolution: 1 }, relation: { evolution: 1 } },
  physio: { fc: { t0: 90, t1: 100, rupture: 120, t2: 85 }, vfc: { t0: 40, t1: 38.5, rupture: 30, t2: 45 }, ced: { t0: 2, t1: 3, rupture: 4, t2: 2.5 }, spo2: { t0: 97, t1: 98, rupture: 96, t2: 99 } } });
const PLEIN_PREC = sess({ id: 'plein0', identification: { code_sujet: 'PL1', session_no: 3, date: '2026-07-01' },
  cotations: (() => { const o = {}; ITEMS.forEach((c, i) => { o[c] = (i + 1) % 4; }); return o; })() });
const VIDE = sess({ id: 'vide', identification: { code_sujet: 'VV1', session_no: 1, date: '2026-08-01' } });
const MAXI = sess({ id: 'maxi', identification: { code_sujet: 'MX1', session_no: 1, date: '2026-08-02' },
  cotations: (() => { const o = {}; T1.forEach((c) => { o[c] = c === 'V1.4' ? 0 : 3; }); return o; })() });
const MINI = sess({ id: 'mini', identification: { code_sujet: 'MN1', session_no: 1, date: '2026-08-03' }, cotations: { 'V1.4': 3 } });

/* sauvegarde complete */
function sauvegarde(sessions) { return { schema: 'grille-haptique/1', exporte_le: '2026-11-12T10:00:00.000Z', sessions }; }

/* jeu pour le dossier */
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
const SAUV = 'grille-haptique_sauvegarde.json';

/* ------------------------------------------------------------------ */
/* Faux dossier en memoire (injecte avant le chargement de la page)    */
/* N'implemente que les API listees en E2 ; tout autre appel echoue.   */
/* ------------------------------------------------------------------ */

function installerFauxDossier(cfg0) {
  const C = Object.assign({ nom: 'Dossier-Test', permission: 'granted', apresDemande: 'granted', annuler: false, erreurEcriture: null, sansMemoire: false }, cfg0 || {});
  const J = []; const violations = []; let seq = 0;
  const log = (op, d) => { J.push(Object.assign({ n: ++seq, op }, d || {})); };
  const dom = (nom, msg) => new DOMException(msg || nom, nom);
  const verif = (op, o) => { if (!o || o.mode !== 'readwrite') violations.push(op + ' appele sans {mode:"readwrite"}'); };
  const noeud = (type, nom) => ({ type, nom, enfants: new Map(), contenu: '' });
  const racine = noeud('dir', C.nom);
  const chem = (c, n) => c.concat(n === undefined ? [] : [n]).join('/');
  function poignee(n, c) {
    const h = { kind: n.type === 'dir' ? 'directory' : 'file', name: n.nom };
    h.queryPermission = async (o) => { verif('queryPermission', o); log('queryPermission'); return C.permission; };
    h.requestPermission = async (o) => { verif('requestPermission', o); log('requestPermission'); C.permission = C.apresDemande; return C.apresDemande; };
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
        if (C.erreurEcriture === 'createWritable' || C.permission === 'denied') throw dom('NotAllowedError', 'ecriture simulee refusee');
        let tampon = '';
        return {
          write: async (d) => {
            if (typeof d !== 'string') violations.push('write() appele avec autre chose qu\'une chaine');
            log('write', { chemin: chem(c), taille: String(d).length });
            if (C.erreurEcriture === 'write') throw dom('QuotaExceededError', 'ecriture simulee en echec');
            tampon += d;
          },
          close: async () => {
            log('close', { chemin: chem(c) });
            if (C.erreurEcriture === 'close') throw dom('InvalidStateError', 'fermeture simulee en echec');
            n.contenu = tampon;
          },
        };
      };
    }
    return h;
  }
  const hRacine = poignee(racine, []);
  /* un handle dont la permission est refusee echoue sur toute operation de fichier */
  const refus = () => { if (C.permission === 'denied') throw dom('NotAllowedError', 'permission refusee'); };
  ['getDirectoryHandle', 'getFileHandle', 'removeEntry', 'values'].forEach((m) => { const f = hRacine[m]; hRacine[m] = function () { refus(); return f.apply(this, arguments); }; });
  window.showDirectoryPicker = async (o) => {
    log('showDirectoryPicker', { mode: o && o.mode });
    verif('showDirectoryPicker', o);
    if (C.annuler) throw dom('AbortError', 'The user aborted a request.');
    return hRacine;
  };
  const parcours = (n, c, out) => { n.enfants.forEach((e, nom) => { if (e.type === 'file') out[chem(c, nom)] = e.contenu; else parcours(e, c.concat(nom), out); }); return out; };
  const dossiers = (n, c, out) => { n.enfants.forEach((e, nom) => { if (e.type === 'dir') { out.push(chem(c, nom)); dossiers(e, c.concat(nom), out); } }); return out; };
  window.__fd = {
    cfg: C, journal: J, violations,
    arbre: () => parcours(racine, [], {}),
    dossiers: () => dossiers(racine, [], []),
    poser: (chemin, contenu) => {
      const p = chemin.split('/'); let n = racine;
      p.slice(0, -1).forEach((d) => { let e = n.enfants.get(d); if (!e) { e = noeud('dir', d); n.enfants.set(d, e); } n = e; });
      const f = noeud('file', p[p.length - 1]); f.contenu = contenu; n.enfants.set(f.nom, f);
    },
    vider: () => { racine.enfants.clear(); },
    raz: () => { J.length = 0; },
    ecritures: () => J.filter((e) => e.op === 'createWritable').map((e) => e.chemin),
  };
}

function installerStockage(mode) {
  window.__persistAppels = 0;
  const orig = navigator.storage;
  if (mode === 'absent') { Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true }); return; }
  const faux = {};
  if (orig && orig.estimate) faux.estimate = orig.estimate.bind(orig);
  if (mode !== 'sans-persist') {
    faux.persist = async () => { window.__persistAppels += 1; return mode === 'true'; };
    faux.persisted = async () => mode === 'true';
  }
  Object.defineProperty(navigator, 'storage', { value: faux, configurable: true });
}

/* ------------------------------------------------------------------ */
/* Application sous test                                               */
/* ------------------------------------------------------------------ */

let apiAbsente = false;
const MOBILE = { viewport: { width: 360, height: 740 } };

async function ouvrir(browser, opt) {
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: opt.viewport || { width: 1280, height: 900 }, acceptDownloads: true, colorScheme: opt.colorScheme || 'light' });
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
  if (opt.dossier === false) {
    await ctx.addInitScript(() => {
      try { delete window.showDirectoryPicker; } catch (e) { /* ignore */ }
      try { delete Window.prototype.showDirectoryPicker; } catch (e) { /* ignore */ }
      try { Object.defineProperty(window, 'showDirectoryPicker', { value: undefined, configurable: true }); delete window.showDirectoryPicker; } catch (e) { /* ignore */ }
    });
  } else if (opt.dossier) await ctx.addInitScript(installerFauxDossier, opt.dossier === true ? {} : opt.dossier);
  if (opt.sansIndexedDB) await ctx.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); });
  if (opt.persist) await ctx.addInitScript(installerStockage, opt.persist);
  const page = await ctx.newPage();
  if (opt.horloge) await page.clock.install({ time: new Date('2026-11-12T10:00:00Z') });
  const A = { ctx, page, errors: [], requests: [], dialogs: [] };
  page.on('console', (m) => { if (m.type() === 'error') A.errors.push('console.error : ' + m.text()); });
  page.on('pageerror', (e) => A.errors.push('pageerror : ' + e.message));
  page.on('request', (r) => A.requests.push(r.url()));
  page.on('dialog', async (d) => { A.dialogs.push(d.message()); try { await d.accept(); } catch (e) { /* ignore */ } });

  A.attendreAPI = async () => {
    try { await page.waitForFunction(() => window.GrilleHaptique && typeof window.GrilleHaptique.etat === 'function', null, { timeout: apiAbsente ? 300 : 3000 }); } catch (e) { apiAbsente = true; }
  };
  /* attente active en temps reel (independante d'une horloge simulee) */
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
  A.go = (k) => page.evaluate((x) => window.GrilleHaptique.allerA(x), k);
  A.bv = async () => { await A.api('bilanVisuel'); return page.evaluate(() => window.GrilleHaptique.bilanVisuel()); };
  A.visible = (sel) => page.locator(sel).first().isVisible();
  A.texte = async (sel) => { if (!(await page.locator(sel).count())) fail(sel + ' absent'); return norm(await page.locator(sel).first().textContent()); };
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
  A.importer = async (contenu, ids) => {
    const f = path.join(TMP, 'import-' + Math.random().toString(36).slice(2) + '.json');
    fs.writeFileSync(f, typeof contenu === 'string' ? contenu : JSON.stringify(contenu));
    await page.setInputFiles('#in-import', f);
    if (ids && ids.length) await page.waitForFunction((l) => { const s = window.GrilleHaptique.sessions().map((x) => x.id); return l.every((i) => s.indexOf(i) >= 0); }, ids, { timeout: 3000 });
    else await page.waitForTimeout(200);
  };
  A.telecharger = async (sel) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 3000 }), page.click(sel)]);
    return { name: dl.suggestedFilename(), buf: fs.readFileSync(await dl.path()) };
  };
  A.stockees = () => page.evaluate(() => JSON.parse(localStorage.getItem('grilleHaptique.v1.sessions') || '[]'));
  A.cles = () => page.evaluate(() => ({ l: Object.keys(localStorage).sort(), s: Object.keys(sessionStorage).sort() }));
  A.boutonPanneau = async (action, id) => {
    await A.panneau();
    const attr = action === 'ouvrir' ? 'data-ouvrir' : 'data-supprimer';
    const h = await page.evaluateHandle((a) => {
      const pan = document.getElementById('panneau-sessions');
      for (const e of ['[' + a.attr + '="' + a.id + '"]', '[' + a.attr + '][data-id="' + a.id + '"]']) { const x = pan.querySelector(e); if (x) return x; }
      return null;
    }, { attr, id });
    const el = h.asElement();
    assert(el, 'bouton ' + action + ' de la session ' + id + ' introuvable dans le panneau Sessions (attribut ' + attr + ')');
    return el;
  };
  /* dossier */
  A.fd = (fn, arg) => page.evaluate(fn, arg);
  A.arbre = () => page.evaluate(() => window.__fd.arbre());
  A.dossierApi = () => page.evaluate(() => window.GrilleHaptique.dossier());
  A.etatDossier = async () => page.evaluate(() => {
    const e = document.getElementById('etat-dossier');
    return { attr: e ? e.getAttribute('data-etat-dossier') : null, texte: e ? e.textContent.replace(/\s+/g, ' ').trim() : null };
  });
  A.attendreEtat = async (etat, ms) => {
    try { await page.waitForFunction((x) => { const e = document.getElementById('etat-dossier'); return e && e.getAttribute('data-etat-dossier') === x; }, etat, { timeout: ms || 1500 }); } catch (e) {
      fail('#etat-dossier[data-etat-dossier] devrait valoir "' + etat + '", valeur : ' + JSON.stringify(await A.etatDossier()));
    }
  };
  A.choisir = async () => { await A.panneau(); if (!(await page.locator('#btn-dossier-sauvegarde').count())) fail('#btn-dossier-sauvegarde absent'); await page.click('#btn-dossier-sauvegarde'); };
  A.activer = async () => { await A.choisir(); await A.attendreEtat('actif'); await A.attendreTree(); };
  /* attend la sauvegarde complete puis la fin des ecritures (journal stable) */
  A.attendreTree = async () => {
    await A.attendre(() => window.__fd.arbre()['grille-haptique_sauvegarde.json'] !== undefined, null, 2500, 'ecriture de grille-haptique_sauvegarde.json');
    let n = -1;
    for (let i = 0; i < 40; i++) { const m = await page.evaluate(() => window.__fd.journal.length); if (m === n) return; n = m; await dort(120); }
  };
  A.editer = async (champ, valeur) => { await A.fermerPanneau(); await A.go('session'); await page.fill(champ, valeur); };

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

/* ================================================================== */
/* E1. Lecture du DOM du bilan visuel (executee dans la page)          */
/* ================================================================== */

const SNAP = () => {
  const R = document.getElementById('bilan-visuel');
  if (!R) return null;
  const SH = 'circle,rect,polygon,path,ellipse,polyline,line';
  const att = (e, n) => (e.hasAttribute(n) ? e.getAttribute(n) : null);
  const svgDe = (e) => (e ? (e.localName === 'svg' ? e : e.querySelector('svg')) : null);
  const infoSvg = (s) => (s ? { role: att(s, 'role'), label: att(s, 'aria-label'), cache: att(s, 'aria-hidden') } : null);
  const rc = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 }; };
  const feuilles = (r) => [...r.querySelectorAll('*')].filter((e) => e.children.length === 0 && !/^(title|desc|style|script)$/.test(e.localName) && e.textContent.trim() !== '').map((e) => e.textContent.trim());
  const chemin = (d) => {
    const pts = []; let x = 0; let y = 0; let dx = 0; let dy = 0; let cmd = 'M';
    const t = String(d || '').match(/[MmLlHhVvZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
    for (let i = 0; i < t.length;) {
      if (/[A-Za-z]/.test(t[i])) { cmd = t[i]; i++; if (/[Zz]/.test(cmd)) continue; }
      const n = (k) => Number(t[i + k]);
      if (cmd === 'M' || cmd === 'L') { x = n(0); y = n(1); i += 2; } else if (cmd === 'm' || cmd === 'l') { x += n(0); y += n(1); i += 2; } else if (cmd === 'H') { x = n(0); i += 1; } else if (cmd === 'h') { x += n(0); i += 1; } else if (cmd === 'V') { y = n(0); i += 1; } else if (cmd === 'v') { y += n(0); i += 1; } else i += 1;
      pts.push([x, y]); dx = x; dy = y;
    }
    return pts.length ? pts : [[dx, dy]];
  };
  const sommets = (el) => {
    let l = [];
    const n = el.localName;
    if (n === 'polygon' || n === 'polyline') l = [...el.points].map((p) => [p.x, p.y]);
    else if (n === 'path') l = chemin(el.getAttribute('d'));
    else if (n === 'rect') { const x = +el.getAttribute('x') || 0; const y = +el.getAttribute('y') || 0; const w = +el.getAttribute('width'); const h = +el.getAttribute('height'); l = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; } else if (n === 'line') l = [[+el.getAttribute('x1'), +el.getAttribute('y1')], [+el.getAttribute('x2'), +el.getAttribute('y2')]];
    const svg = el.ownerSVGElement; const m = el.getScreenCTM();
    if (!svg || !m) return [];
    return l.map((c) => { const p = svg.createSVGPoint(); p.x = c[0]; p.y = c[1]; const q = p.matrixTransform(m); return { x: q.x, y: q.y }; });
  };
  const forme = (e) => { const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return { tag: e.localName, fill: cs.fill, stroke: cs.stroke, sw: parseFloat(cs.strokeWidth) || 0, pts: ['polygon', 'path', 'polyline'].indexOf(e.localName) >= 0 ? sommets(e) : [], w: b.width, h: b.height }; };
  const fond = (e) => { for (let n = e; n; n = n.parentElement) { if (n instanceof SVGElement && n.localName !== 'svg') continue; const c = getComputedStyle(n).backgroundColor; const m = /rgba?\(([^)]+)\)/.exec(c); if (m) { const v = m[1].split(',').map(Number); if (v.length < 4 || v[3] >= 0.99) return c; } } return 'rgb(255, 255, 255)'; };
  const out = { racine: { dansSynthese: !!R.closest('section[data-panel="synthese"]'), visible: R.getClientRects().length > 0 && getComputedStyle(R).display !== 'none' && !R.closest('[hidden]'),
    avantScores: !!document.getElementById('score-axe1') && !!(R.compareDocumentPosition(document.getElementById('score-axe1')) & Node.DOCUMENT_POSITION_FOLLOWING), rect: rc(R) } };
  /* tous les svg */
  out.svgs = [...R.querySelectorAll('svg')].map((s) => Object.assign(infoSvg(s), { w: s.getBoundingClientRect().width, h: s.getBoundingClientRect().height, droite: s.getBoundingClientRect().right, nbEnfants: s.children.length }));
  /* jauge */
  const J = document.getElementById('vis-jauge');
  out.jauge = J && { svg: infoSvg(svgDe(J)), arcs: [...J.querySelectorAll('[data-vis="jauge-arc"]')].map((a) => ({ ratio: att(a, 'data-ratio'), tag: a.localName, fill: getComputedStyle(a).fill, stroke: getComputedStyle(a).stroke, sw: parseFloat(getComputedStyle(a).strokeWidth) || 0 })), textes: feuilles(J), fond: fond(J) };
  /* radar */
  const D = document.getElementById('vis-radar');
  if (D) {
    const formes = [...D.querySelectorAll('[data-vis="radar-forme"]')];
    const anneaux = [...D.querySelectorAll('[data-vis*="anneau"]')];
    out.radar = { svg: infoSvg(svgDe(D)), textes: feuilles(D), fond: fond(D),
      sommets: [...D.querySelectorAll('[data-vis="radar-sommet"]')].map((e) => ({ cle: att(e, 'data-cle'), valeur: att(e, 'data-valeur'), ratio: att(e, 'data-ratio'), tag: e.localName, cx: rc(e).cx, cy: rc(e).cy })),
      formes: formes.map((f) => ({ tag: f.localName, pts: sommets(f), stroke: getComputedStyle(f).stroke, sw: parseFloat(getComputedStyle(f).strokeWidth) || 0, fill: getComputedStyle(f).fill })),
      anneaux: anneaux.map((a) => ({ vis: att(a, 'data-vis'), tag: a.localName, rect: rc(a), ratio: att(a, 'data-ratio') })) };
  } else out.radar = null;
  /* bande des items */
  const B = document.getElementById('vis-bande-items');
  if (B) {
    out.bande = { svg: infoSvg(svgDe(B)), textes: feuilles(B), legende: feuilles(B.closest('section,figure') || B.parentElement),
      cellules: [...B.querySelectorAll('[data-vis="cellule"]')].map((c) => {
        const r = c.localName === 'rect' ? c : c.querySelector('rect');
        const cible = r || c; const cs = getComputedStyle(cible);
        const tous = [c].concat([...c.querySelectorAll('*')]);
        return { code: att(c, 'data-code'), valeur: att(c, 'data-valeur'), fill: c instanceof SVGElement ? cs.fill : cs.backgroundColor,
          hachure: tous.some((x) => /url\(/.test(getComputedStyle(x).fill)) || !!c.querySelector('.hachure,[class*="hachure"]'), rect: rc(c) };
      }) };
  } else out.bande = null;
  /* T2 */
  const T = document.getElementById('vis-t2');
  out.t2 = T && { svg: infoSvg(svgDe(T)), textes: feuilles(T), reperes: [...T.querySelectorAll('[data-vis="t2"]')].map((e) => ({ cle: att(e, 'data-cle'), valeur: att(e, 'data-valeur'),
    formes: (e.matches(SH) ? [e] : [...e.querySelectorAll(SH)]).map(forme), texte: e.textContent.replace(/\s+/g, ' ').trim() })) };
  /* physio */
  const P = document.getElementById('vis-physio');
  out.physio = P && { texte: P.textContent.replace(/\s+/g, ' ').trim(), charts: [...P.querySelectorAll('[data-vis="physio"]')].map((g) => {
    const svg = svgDe(g); const sr = svg ? svg.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 };
    return { cle: att(g, 'data-cle'), svg: infoSvg(svg), sr: { l: sr.left, t: sr.top, w: sr.width, h: sr.height }, textes: feuilles(g),
      points: [...g.querySelectorAll('[data-vis="physio-point"]')].map((p) => ({ cle: att(p, 'data-cle'), temps: att(p, 'data-temps'), valeur: att(p, 'data-valeur'), cx: rc(p).cx, cy: rc(p).cy })),
      lignes: [...g.querySelectorAll('polyline,path')].filter((l) => !l.closest('[data-vis="physio-point"]')).map((l) => ({ tag: l.localName, pts: sommets(l), stroke: getComputedStyle(l).stroke, sw: parseFloat(getComputedStyle(l).strokeWidth) || 0, fond: fond(l) })),
      etiquettes: [...g.querySelectorAll('text')].map((t) => ({ t: t.textContent.trim(), cx: rc(t).cx, cy: rc(t).cy })) };
  }) };
  /* comparaison */
  const C = document.getElementById('vis-comparaison');
  out.comparaison = C && { texte: C.textContent.replace(/\s+/g, ' ').trim(), enfants: C.children.length, nbVis: C.querySelectorAll('[data-vis]').length,
    deltas: [...C.querySelectorAll('[data-vis="delta"]')].map((e) => ({ cle: att(e, 'data-cle'), delta: att(e, 'data-delta'), texte: e.textContent.replace(/\s+/g, ' ').trim(), svg: !!(e.localName === 'svg' || e.querySelector('svg')) })) };
  return out;
};

/* textes et traits : couleurs calculees et fonds, executee dans la page */
const COULEURS = () => {
  const R = document.getElementById('bilan-visuel');
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const v = m[1].split(',').map(Number); return v.length < 4 ? v.concat([1]) : v; };
  const forme = (e) => e instanceof SVGElement && /^(rect|circle|ellipse|polygon|path|polyline)$/.test(e.localName);
  const fondAt = (el, x, y) => {
    for (const e of document.elementsFromPoint(x, y)) {
      if (e === el ? (el instanceof SVGElement) : el.contains(e)) continue;
      const cs = getComputedStyle(e);
      if (e instanceof SVGElement) {
        if (!forme(e)) continue;
        const f = parse(cs.fill); if (f && f[3] * parseFloat(cs.fillOpacity || 1) >= 0.99) return f;
      } else { const b = parse(cs.backgroundColor); if (b && b[3] >= 0.99) return b; }
    }
    return [255, 255, 255, 1];
  };
  const fondAncetre = (el) => { for (let n = el; n; n = n.parentElement) { if (n instanceof SVGElement && n.localName !== 'svg') continue; const b = parse(getComputedStyle(n).backgroundColor); if (b && b[3] >= 0.99) return b; } return [255, 255, 255, 1]; };
  const textes = [];
  const cand = [...R.querySelectorAll('text, tspan')].filter((e) => e.localName === 'text' || !e.closest('text')).concat([...R.querySelectorAll('*')].filter((e) => !(e instanceof SVGElement) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())));
  cand.forEach((t) => {
    if (!t.textContent.trim()) return;
    const cs = getComputedStyle(t);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    t.scrollIntoView({ block: 'center', inline: 'center' });
    const r = t.getBoundingClientRect(); if (!r.width || !r.height) return;
    const couleur = parse(t instanceof SVGElement ? cs.fill : cs.color);
    if (!couleur) return;
    textes.push({ t: t.textContent.trim().slice(0, 30), couleur, fond: fondAt(t, (r.left + r.right) / 2, (r.top + r.bottom) / 2) });
  });
  const traits = [];
  [...R.querySelectorAll('[data-vis="radar-forme"],[data-vis="jauge-arc"],[data-vis="physio"] polyline,[data-vis="physio"] path')].forEach((e) => {
    const cs = getComputedStyle(e);
    const sw = parseFloat(cs.strokeWidth) || 0;
    const c = (cs.stroke !== 'none' && sw > 0) ? parse(cs.stroke) : parse(cs.fill);
    if (!c) return;
    e.scrollIntoView({ block: 'center' });
    traits.push({ vis: e.getAttribute('data-vis') || (e.closest('[data-vis]') || e).getAttribute('data-vis'), couleur: c, fond: fondAncetre(e) });
  });
  return { textes, traits };
};

/* ------------------------------------------------------------------ */
/* E1. Verifications du DOM contre le modele                           */
/* ------------------------------------------------------------------ */

const lum = (c) => { const f = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
const contraste = (a, b) => { const la = lum(a); const lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
const rgbDe = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); return m ? m[1].split(',').map(Number).slice(0, 3) : null; };
const hexRgb = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const memeCouleur = (computed, hex) => { const a = rgbDe(computed); const b = hexRgb(hex); return !!a && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; };
const lireVars = (A) => A.page.evaluate((noms) => { const cs = getComputedStyle(document.documentElement); const o = {}; noms.forEach((n) => { o[n] = cs.getPropertyValue(n).trim(); }); return o; }, Object.keys(VARS));
const normHex = (h) => (h || '').trim().toUpperCase().replace(/^#([0-9A-F])([0-9A-F])([0-9A-F])$/, '#$1$1$2$2$3$3');
const signe = (n) => (n === null ? '' : (n > 0 ? '+' : '') + n);
const fmtFr = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

function verifierSvgRole(snap) {
  snap.svgs.forEach((s, i) => {
    if (s.cache === 'true') return;
    assert(s.role === 'img', 'svg n' + (i + 1) + ' de #bilan-visuel : role="' + s.role + '" au lieu de "img"');
    assert(s.label && s.label.trim().length >= 5, 'svg n' + (i + 1) + ' de #bilan-visuel : aria-label absent ou vide');
  });
}

function verifierJauge(snap, m) {
  assert(snap.jauge, '#vis-jauge absent');
  const j = snap.jauge; const v = m.total.valeur;
  assert(j.svg, '#vis-jauge ne contient aucun svg');
  eq(j.svg.label, v === null ? 'Indice global : non calculable' : 'Indice global : ' + v + ' sur 39', 'aria-label de la jauge');
  eq(j.arcs.length, 1, 'nombre de [data-vis="jauge-arc"]');
  const r = j.arcs[0].ratio;
  if (v === null) assert(r === null, 'data-ratio de la jauge present alors que la valeur est null : ' + r);
  else {
    assert(r !== null && /^\d(\.\d{1,3})?$/.test(r), 'data-ratio de la jauge absent ou a plus de 3 decimales : ' + r);
    proche(Number(r), ratio(v, -3, 39), 1e-9, 'data-ratio de la jauge (valeur ' + v + ')');
  }
  assert(j.textes.some((t) => t === (v === null ? '-' : String(v))), 'texte central de la jauge : "' + (v === null ? '-' : v) + '" absent des textes ' + JSON.stringify(j.textes));
}

function verifierRadar(snap, m) {
  assert(snap.radar, '#vis-radar absent');
  const d = snap.radar;
  assert(d.svg, '#vis-radar ne contient aucun svg');
  eq(d.sommets.map((s) => s.cle), AXES, 'cles des [data-vis="radar-sommet"]');
  d.sommets.forEach((s, i) => {
    const a = m.axes[i];
    eq(s.valeur, a.valeur === null ? '' : String(a.valeur), 'data-valeur du sommet ' + a.cle);
    const r = ratio(a.valeur, a.min, a.max);
    if (r === null) assert(s.ratio === null, 'data-ratio du sommet ' + a.cle + ' present alors que la valeur est null');
    else proche(Number(s.ratio), r, 1e-9, 'data-ratio du sommet ' + a.cle);
  });
  eq(d.formes.length, 1, 'nombre de [data-vis="radar-forme"]');
  assert(d.formes[0].tag === 'polygon' || d.formes[0].tag === 'path', 'radar-forme n\'est ni un polygon ni un path : ' + d.formes[0].tag);
  const pts = d.formes[0].pts;
  eq(pts.length, 4, 'nombre de sommets du polygone radar');
  assert(d.anneaux.length === 4, '4 anneaux de reference attendus ([data-vis*="anneau"], 25/50/75/100 %), trouves : ' + d.anneaux.length + ' (le contrat ne nomme pas l\'attribut : interpretation data-vis contenant "anneau")');
  const ext = d.anneaux.slice().sort((a, b) => b.rect.w - a.rect.w);
  const R0 = ext[0].rect; const cx = R0.cx; const cy = R0.cy;
  [0.75, 0.5, 0.25].forEach((q, i) => proche(ext[i + 1].rect.w / R0.w, q, 0.03, 'largeur de l\'anneau ' + (q * 100) + ' % / anneau 100 %'));
  const dist = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const rayon = R0.w / 2;
  m.axes.forEach((a, i) => {
    const r = ratio(a.valeur, a.min, a.max);
    if (r === null || r === 0) assert(dist[i] <= 1.5, 'sommet ' + a.cle + ' (valeur ' + a.valeur + ') devrait etre au centre : distance ' + dist[i].toFixed(1) + ' px');
    else {
      proche(dist[i] / rayon, r, 0.04, 'distance au centre du sommet ' + a.cle + ' / rayon de l\'anneau 100 %');
    }
  });
  m.axes.forEach((a, i) => {
    if (a.valeur === null) return;
    assert(d.textes.some((t) => new RegExp('(^|[^0-9.-])' + String(a.valeur).replace('-', '\\-') + '($|[^0-9.])').test(t)), 'etiquette de l\'axe ' + a.cle + ' avec sa valeur ' + a.valeur + ' absente : ' + JSON.stringify(d.textes));
  });
}

function verifierBande(snap, m) {
  assert(snap.bande, '#vis-bande-items absent');
  const b = snap.bande;
  eq(b.cellules.map((c) => c.code), ITEMS, 'codes des cellules (ordre T0.1 a V4.3)');
  m.items.forEach((it, i) => {
    const c = b.cellules[i];
    eq(c.valeur, it.valeur === null ? '' : String(it.valeur), 'data-valeur de la cellule ' + it.code);
  });
  /* groupes separes : ecart plus grand aux frontieres de groupe (sur une meme ligne) */
  const ec = []; const fr = [];
  for (let i = 1; i < b.cellules.length; i++) {
    const a = b.cellules[i - 1].rect; const c = b.cellules[i].rect;
    if (Math.abs(a.t - c.t) > 2) continue;
    const g = c.l - a.r;
    if (GROUPE_DE(ITEMS[i]) !== GROUPE_DE(ITEMS[i - 1])) fr.push(g); else ec.push(g);
  }
  if (fr.length && ec.length) {
    const med = ec.slice().sort((x, y) => x - y)[Math.floor(ec.length / 2)];
    fr.forEach((g) => assert(g > med + 2, 'groupes non separes visuellement : ecart de frontiere ' + g.toFixed(1) + ' px contre ' + med.toFixed(1) + ' px entre cellules d\'un meme groupe'));
  }
}
function couleursBande(snap, m, idx) {
  const attendu = (v) => (v === null ? null : v === 'NA' ? VARS['--bil-cot-na'][idx] : VARS['--bil-cot-' + v][idx]);
  m.items.forEach((it, i) => {
    const c = snap.bande.cellules[i]; const a = attendu(it.valeur);
    if (a) assert(memeCouleur(c.fill, a), 'couleur de la cellule ' + it.code + ' (valeur ' + it.valeur + ') : ' + c.fill + ' au lieu du jeton ' + a);
    if (it.valeur === 'NA') assert(c.hachure, 'cellule NA ' + it.code + ' non hachuree (aucun remplissage url(#...) ni .hachure)');
    if (it.valeur !== 'NA') assert(!c.hachure || it.valeur === null, 'cellule ' + it.code + ' hachuree alors que sa valeur est ' + it.valeur);
  });
}
function legendeBande(snap) {
  ['0', '1', '2', '3', 'NA'].forEach((s) => assert(snap.bande.legende.some((t) => t === s || t.indexOf(s + ' ') === 0 || t.indexOf(s + ':') === 0 || t.indexOf(s + ' -') === 0), 'legende : etat "' + s + '" absent de la legende (textes du bloc de #vis-bande-items : ' + JSON.stringify(snap.bande.legende.slice(0, 12)) + ')'));
}

function formeT2(f) {
  if (f.tag === 'rect') return Math.abs(f.w - f.h) <= 1.5 ? 'carre' : 'rectangle';
  if (f.tag === 'circle' || f.tag === 'ellipse') return 'cercle';
  const p = f.pts;
  if (p.length === 4 || (p.length === 5 && Math.hypot(p[0].x - p[4].x, p[0].y - p[4].y) < 0.5)) return Math.abs(f.w - f.h) <= 1.5 ? 'carre' : 'quadrilatere';
  if (p.length === 3 || (p.length === 4 && Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y) < 0.5)) {
    const ys = p.slice(0, 3).map((q) => q.y); const mn = Math.min.apply(null, ys); const mx = Math.max.apply(null, ys);
    const bas = ys.filter((y) => Math.abs(y - mx) < 0.6).length; const haut = ys.filter((y) => Math.abs(y - mn) < 0.6).length;
    if (bas === 2 && haut === 1) return 'triangle-haut';
    if (haut === 2 && bas === 1) return 'triangle-bas';
    return 'triangle-autre';
  }
  return 'inconnue(' + f.tag + ',' + p.length + ' sommets)';
}
function verifierT2(snap, m, idx, bv) {
  assert(snap.t2, '#vis-t2 absent');
  eq(snap.t2.reperes.map((r) => r.cle), T2K, 'cles des [data-vis="t2"]');
  const noms = { '-1': 'neg', '0': 'zero', '1': 'pos' };
  const attendu = { '-1': 'triangle-bas', '0': 'carre', '1': 'triangle-haut' };
  m.t2.forEach((t, i) => {
    const r = snap.t2.reperes[i];
    eq(r.valeur, t.valeur === null ? '' : String(t.valeur), 'data-valeur du repere T2 ' + t.cle);
    const lib = (bv && bv.t2[i].libelle) || ''; const mot = (lib.split(/\s+/)[0] || '').toLowerCase();
    assert(mot.length >= 3 && snap.t2.textes.some((x) => x.toLowerCase().indexOf(mot) >= 0), 'libelle court de ' + t.cle + ' (mot "' + mot + '") absent des textes de #vis-t2 : ' + JSON.stringify(snap.t2.textes));
    if (t.valeur === null) return;
    const nom = noms[String(t.valeur)];
    assert(r.formes.length > 0, 'repere T2 ' + t.cle + ' sans forme');
    const types = r.formes.map(formeT2);
    assert(types.indexOf(attendu[String(t.valeur)]) >= 0, 'forme du repere T2 ' + t.cle + ' (valeur ' + t.valeur + ') : ' + JSON.stringify(types) + ', attendu ' + attendu[String(t.valeur)] + ' (+1 triangle haut, 0 carre, -1 triangle bas)');
    const jetons = [VARS['--bil-t2-' + nom][idx]]; if (VARS['--bil-t2-' + nom + '-trait']) jetons.push(VARS['--bil-t2-' + nom + '-trait'][idx]);
    assert(r.formes.some((f) => jetons.some((h) => memeCouleur(f.fill, h) || memeCouleur(f.stroke, h))), 'couleur du repere T2 ' + t.cle + ' : fill/stroke ' + JSON.stringify(r.formes.map((f) => [f.fill, f.stroke])) + ' ne correspondent pas aux jetons --bil-t2-' + nom);
  });
}

function formatsValeur(v) { const s = String(v); return [s, s.replace('.', ',')]; }
function verifierPhysio(snap, m, bv) {
  assert(snap.physio, '#vis-physio absent');
  const ph = snap.physio;
  const avec = m.physio.filter((x) => x.points.some((p) => p.valeur !== null));
  eq(ph.charts.map((c) => c.cle), avec.map((x) => x.cle), 'mesures presentees dans #vis-physio (mesure sans valeur omise)');
  if (!avec.length) { assert(/Aucune mesure saisie/.test(ph.texte), '#vis-physio devrait contenir « Aucune mesure saisie » : "' + ph.texte + '"'); return; }
  assert(!/Aucune mesure saisie/.test(ph.texte), '#vis-physio contient « Aucune mesure saisie » alors que des mesures existent');
  const refX = {}; let centre = null; let nonCst = null;
  avec.forEach((mesure) => {
    const ch = ph.charts.find((c) => c.cle === mesure.cle);
    assert(ch.svg, 'mini-graphique ' + mesure.cle + ' sans svg');
    const notNull = mesure.points.filter((p) => p.valeur !== null);
    eq(ch.points.map((p) => p.temps + '=' + Number(p.valeur)), notNull.map((p) => p.temps + '=' + p.valeur), 'points de ' + mesure.cle + ' (un par valeur non nulle, dans l\'ordre)');
    ch.points.forEach((p) => assert(p.cle === mesure.cle, 'physio-point de ' + mesure.cle + ' avec data-cle="' + p.cle + '"'));
    const xn = (p) => (p.cx - ch.sr.l) / ch.sr.w; const yn = (p) => (p.cy - ch.sr.t) / ch.sr.h;
    ch.points.forEach((p) => { if (refX[p.temps] === undefined) refX[p.temps] = xn(p); else proche(xn(p), refX[p.temps], 0.01, 'abscisse fixe du temps ' + p.temps + ' (' + mesure.cle + ')'); });
    const ordre = ch.points.map((p) => TEMPS.indexOf(p.temps)); assert(ordre.every((v, i) => i === 0 || v > ordre[i - 1]), 'abscisses des points de ' + mesure.cle + ' non croissantes dans l\'ordre T0, T1, Rupture, T2');
    const valeurs = notNull.map((p) => p.valeur); const mn = Math.min.apply(null, valeurs); const mx = Math.max.apply(null, valeurs);
    if (mx > mn) {
      const ys = ch.points.map(yn);
      ch.points.forEach((p, i) => { const t = (Number(p.valeur) - mn) / (mx - mn); const yMin = Math.max.apply(null, ys); const yMax = Math.min.apply(null, ys); proche(ys[i], yMin - t * (yMin - yMax), 0.012, 'ordonnee lineaire de ' + mesure.cle + '/' + p.temps); });
      const imin = ch.points.findIndex((p) => Number(p.valeur) === mn); const imax = ch.points.findIndex((p) => Number(p.valeur) === mx);
      assert(ys[imax] < ys[imin], 'la valeur max de ' + mesure.cle + ' devrait etre plus haute que la valeur min');
      if (!nonCst) nonCst = { mn: Math.min.apply(null, ys), mx: Math.max.apply(null, ys) };
    } else { centre = centre || []; centre.push({ cle: mesure.cle, y: yn(ch.points[0]), n: ch.points.length, ys: ch.points.map(yn) }); }
    /* polyligne : segments entre points non nuls consecutifs */
    const centres = ch.points.map((p) => ({ x: p.cx, y: p.cy, temps: p.temps }));
    const proches = (v) => { let k = -1; let d = 1e9; centres.forEach((c, i) => { const e = Math.hypot(c.x - v.x, c.y - v.y); if (e < d) { d = e; k = i; } }); return d <= 3 ? k : -1; };
    const paires = new Set();
    ch.lignes.forEach((l) => { for (let i = 1; i < l.pts.length; i++) { const a = proches(l.pts[i - 1]); const b = proches(l.pts[i]); if (a < 0 || b < 0) fail('segment de ' + mesure.cle + ' dont une extremite n\'est sur aucun point'); paires.add(a + '-' + b); } });
    for (let i = 1; i < centres.length; i++) {
      const adj = TEMPS.indexOf(centres[i].temps) - TEMPS.indexOf(centres[i - 1].temps) === 1;
      if (adj) assert(paires.has((i - 1) + '-' + i), 'segment manquant entre ' + centres[i - 1].temps + ' et ' + centres[i].temps + ' de ' + mesure.cle);
    }
    paires.forEach((p) => { const [a, b] = p.split('-').map(Number); assert(b === a + 1, 'segment non consecutif (' + centres[a].temps + ' -> ' + centres[b].temps + ') dans ' + mesure.cle); });
    if (centres.length === 1) assert(paires.size === 0, 'segment pour une seule valeur dans ' + mesure.cle);
    /* valeurs ecrites pres des points, unite en legende, abscisses */
    ch.points.forEach((p) => assert(ch.etiquettes.some((e) => formatsValeur(p.valeur).some((f) => new RegExp('^[^0-9-]*' + f.replace('.', '\\.') + '[^0-9]*$').test(e.t)) && Math.hypot(e.cx - p.cx, e.cy - p.cy) <= 34), 'valeur ' + p.valeur + ' de ' + mesure.cle + '/' + p.temps + ' non ecrite pres du point : ' + JSON.stringify(ch.etiquettes.map((e) => e.t))));
    const unite = bv && bv.physio.find((x) => x.cle === mesure.cle).unite;
    assert(unite && ch.textes.some((t) => t.indexOf(unite) >= 0), 'unite "' + unite + '" absente de la legende de ' + mesure.cle + ' : ' + JSON.stringify(ch.textes));
    ['T0', 'T1', 'Rupture', 'T2'].forEach((t) => assert(ch.textes.some((x) => x.toLowerCase() === t.toLowerCase()), 'repere d\'abscisse « ' + t + ' » absent de ' + mesure.cle));
  });
  if (centre && nonCst) {
    const mil = (nonCst.mn + nonCst.mx) / 2;
    centre.forEach((c) => c.ys.forEach((y) => proche(y, mil, 0.03, 'point de ' + c.cle + ' (valeur unique ou serie constante) au centre de l\'echelle')));
  }
}

function verifierComparaison(snap, m) {
  assert(snap.comparaison, '#vis-comparaison absent');
  const c = snap.comparaison;
  if (m.precedente) {
    eq(c.deltas.map((d) => d.cle), AXES.concat(['total']), 'cles des [data-vis="delta"]');
    AXES.concat(['total']).forEach((k, i) => {
      const dl = m.precedente.deltas[k]; const e = c.deltas[i];
      eq(e.delta, signe(dl), 'data-delta de ' + k);
      if (dl !== null) {
        assert(e.texte.indexOf(String(Math.abs(dl))) >= 0, 'texte du delta ' + k + ' : "' + e.texte + '" ne montre pas ' + Math.abs(dl));
        const g = /[▲▼↑↓⬆⬇▴▾↗↘=→↔≈▬−-]/.test(e.texte);
        assert(e.svg || g, 'delta ' + k + ' sans fleche (ni svg ni glyphe) : "' + e.texte + '"');
        if (!e.svg) {
          if (dl > 0) assert(/[▲↑⬆▴↗]/.test(e.texte), 'fleche du delta ' + k + ' (+) non orientee vers le haut : "' + e.texte + '"');
          if (dl < 0) assert(/[▼↓⬇▾↘]/.test(e.texte), 'fleche du delta ' + k + ' (-) non orientee vers le bas : "' + e.texte + '"');
        }
      }
    });
    const p = m.precedente;
    const attendu = 'par rapport à S' + (p.session_no === null ? '?' : p.session_no) + ' (' + fmtFr(p.date) + ')';
    assert(c.texte.indexOf(attendu) >= 0, 'mention « ' + attendu + ' » absente de #vis-comparaison : "' + c.texte + '"');
  } else {
    eq(c.deltas.length, 0, 'nombre de [data-vis="delta"] sans session precedente');
  }
}

function verifierVide(snap) {
  assert(snap.comparaison, '#vis-comparaison absent');
  eq(snap.comparaison.texte, '', 'texte de #vis-comparaison (code vide)');
  eq(snap.comparaison.nbVis, 0, 'elements [data-vis] dans #vis-comparaison (code vide)');
}
async function snapSynthese(A, sel) {
  await A.api('bilanVisuel');
  await A.go('synthese');
  const s = await A.page.evaluate(SNAP);
  assert(s, '#bilan-visuel absent de la Synthese');
  return s;
}
async function verifierTout(A, jeu, id, idxTheme) {
  const m = modeleVis(jeu, id);
  const snap = await snapSynthese(A);
  const bv = await A.page.evaluate(() => window.GrilleHaptique.bilanVisuel());
  eq(sansLibelles(bv), m, 'bilanVisuel()');
  verifierSvgRole(snap); verifierJauge(snap, m); verifierRadar(snap, m); verifierBande(snap, m); couleursBande(snap, m, idxTheme || 0);
  verifierT2(snap, m, idxTheme || 0, bv); verifierPhysio(snap, m, bv);
  if (m.precedente) verifierComparaison(snap, m);
  else if ((jeu.find((s) => s.id === id).identification.code_sujet) === '') verifierVide(snap);
  else assert(/Première session de ce participant/.test(snap.comparaison.texte), 'texte « Première session de ce participant » absent : "' + snap.comparaison.texte + '"');
  return { snap, m, bv };
}
const stockage = (jeu, id) => ({ sessions: jeu, courante: id });

/* recharge la page avec un autre jeu de sessions et une autre session courante */
async function charger(A, jeu, id) {
  /* script d'initialisation inconditionnel : l'application peut reecrire son etat en quittant la page */
  await A.ctx.addInitScript((st) => { try { localStorage.setItem('grilleHaptique.v1.sessions', JSON.stringify(st.sessions)); localStorage.setItem('grilleHaptique.v1.courante', st.courante); } catch (e) { /* ignore */ } }, stockage(jeu, id));
  await A.page.reload(); await A.attendreAPI();
  const e = await A.st();
  assert(e && e.id === id, 'la session courante apres rechargement est "' + (e && e.id) + '" au lieu de "' + id + '"');
}
const CAS = [
  ['J1 + precedente P1 (score null)', JEU_A, 'j1'], ['J1 + precedente P2', JEU_B, 'j1'], ['premiere session', JEU_PREMIERE, 'j1'], ['sans code', JEU_SANS_CODE, 'j1s'],
  ['tout rempli', [PLEIN, PLEIN_PREC], 'plein'], ['vide', [VIDE], 'vide'], ['maximum', [MAXI], 'maxi'], ['minimum', [MINI], 'mini'],
];
const OPT_JEU = (jeu, id) => ({ storage: stockage(jeu, id) });
function parCas(nom, verif, opts) {
  check(nom, async (A) => {
    await A.api('bilanVisuel');
    for (const [lib, jeu, id] of CAS) {
      await charger(A, jeu, id);
      const m = modeleVis(jeu, id);
      try { const snap = await snapSynthese(A); const bv = await A.page.evaluate(() => window.GrilleHaptique.bilanVisuel()); await verif(snap, m, bv, A); } catch (e) { e.message = '[cas ' + lib + '] ' + e.message; throw e; }
    }
  }, Object.assign({ storage: stockage(JEU_A, 'j1') }, opts || {}));
}

/* ================================================================== */
/* E1. Modele pur bilanVisuel()                                        */
/* ================================================================== */

check('E1 modele : API GrilleHaptique.bilanVisuel exposee, anciennes fonctions conservees', async (A) => {
  const manquantes = await A.page.evaluate(() => ['etat', 'sessions', 'calculerScores', 'versCSV', 'allerA', 'participants', 'bilan', 'xlsxOctets', 'ouvrirParticipants', 'bilanVisuel']
    .filter((k) => typeof window.GrilleHaptique[k] !== 'function'));
  eq(manquantes, [], 'fonctions manquantes dans GrilleHaptique');
}, OPT_JEU(JEU_A, 'j1'));

check('E1 modele : formes exactes et valeurs chiffrees a la main (J1 avec precedente P1 dont un score est null)', async (A) => {
  const bv = await A.bv();
  eq(Object.keys(bv).sort(), ['axes', 'items', 'physio', 'precedente', 't2', 'total'], 'cles de premier niveau');
  eq(bv.total, { valeur: 10, min: -3, max: 39, manquants: 7 }, 'total');
  eq(bv.axes.map((a) => Object.keys(a).sort()), [0, 1, 2, 3].map(() => ['cle', 'libelle', 'manquants', 'max', 'min', 'valeur']), 'cles de chaque axe');
  eq(bv.axes.map((a) => [a.cle, a.valeur, a.min, a.max, a.manquants]), [['axe1', 4, -3, 9, 0], ['axe2', 3, 0, 12, 2], ['axe3', 3, 0, 9, 2], ['axe4', null, 0, 9, 3]], 'axes (cle, valeur, min, max, manquants)');
  eq(bv.items.map((i) => i.code + ':' + i.groupe + ':' + i.valeur).join(' '),
    'T0.1:T0:3 T0.2:T0:NA T0.3:T0:0 T0.4:T0:null T0.5:T0:1 V1.1:AXE1:2 V1.2:AXE1:3 V1.3:AXE1:1 V1.4:AXE1:2 V2.1:AXE2:1 V2.2:AXE2:2 V2.3:AXE2:NA V2.4:AXE2:null V3.1:AXE3:3 V3.2:AXE3:null V3.3:AXE3:null V4.1:AXE4:null V4.2:AXE4:null V4.3:AXE4:null', 'items');
  eq(bv.items.map((i) => Object.keys(i).sort().join()), ITEMS.map(() => 'code,groupe,valeur'), 'cles de chaque item');
  eq(bv.t2.map((t) => [t.cle, t.valeur]), [['tonus', 1], ['posture', 0], ['emotion', -1], ['relation', null]], 't2');
  eq(bv.t2.map((t) => Object.keys(t).sort().join()), T2K.map(() => 'cle,libelle,valeur'), 'cles de chaque T2');
  eq(bv.physio.map((x) => x.cle), PHYS, 'mesures physio');
  eq(bv.physio.map((x) => Object.keys(x).sort().join()), PHYS.map(() => 'cle,libelle,points,unite'), 'cles de chaque mesure');
  eq(bv.physio.map((x) => x.points.map((p) => p.temps + '=' + p.valeur).join(' ')), ['t0=80 t1=90 rupture=null t2=70', 't0=null t1=null rupture=null t2=null', 't0=null t1=5.5 rupture=null t2=null', 't0=98 t1=98 rupture=null t2=98'], 'points physio');
  bv.physio.forEach((x) => x.points.forEach((p) => eq(Object.keys(p).sort(), ['temps', 'valeur'], 'cles d\'un point physio')));
  eq(bv.precedente, { id: 'p1', session_no: 1, date: '2026-05-05', deltas: { axe1: 3, axe2: -2, axe3: null, axe4: null, total: 2 } }, 'precedente (code e01 en minuscules, casse ignoree)');
}, OPT_JEU(JEU_A, 'j1'));

check('E1 modele : precedente P2, delta nul, et session precedente immediate (ni la plus ancienne, ni une autre personne, ni sans code)', async (A) => {
  const bv = await A.bv();
  eq(bv.precedente, { id: 'p2', session_no: 1, date: '2026-05-05', deltas: { axe1: 3, axe2: -2, axe3: 0, axe4: null, total: -1 } }, 'precedente');
}, OPT_JEU(JEU_B, 'j1'));

check('E1 modele : premiere session (aucune precedente) et code vide : precedente null', async (A) => {
  eq((await A.bv()).precedente, null, 'premiere session avec code');
  await charger(A, JEU_SANS_CODE, 'j1s');
  eq((await A.bv()).precedente, null, 'code vide (une autre session sans code existe plus tot)');
}, OPT_JEU(JEU_PREMIERE, 'j1'));

check('E1 modele : bornes des axes et du total (maximum 9/12/9/9/39, minimum -3), scores null, forme sur plusieurs jeux', async (A) => {
  for (const [lib, jeu, id] of CAS) {
    await charger(A, jeu, id);
    const bv = await A.bv(); const m = modeleVis(jeu, id);
    try { eq(sansLibelles(bv), m, 'bilanVisuel()'); } catch (e) { e.message = '[cas ' + lib + '] ' + e.message; throw e; }
  }
  await charger(A, [MAXI], 'maxi'); let bv = await A.bv();
  eq([bv.total.valeur].concat(bv.axes.map((a) => a.valeur)), [39, 9, 12, 9, 9], 'maximum');
  await charger(A, [MINI], 'mini'); bv = await A.bv();
  eq([bv.total.valeur].concat(bv.axes.map((a) => a.valeur)), [-3, -3, null, null, null], 'minimum (V1.4 = 3 seul)');
  await charger(A, [VIDE], 'vide'); bv = await A.bv();
  eq([bv.total.valeur, bv.total.manquants].concat(bv.axes.map((a) => a.valeur)), [null, 14, null, null, null, null], 'session vide');
}, OPT_JEU(JEU_A, 'j1'));

check('E1 modele : libelles et unites non vides, ordre des 19 items et des mesures, resultat sans DOM, JSON, independant a chaque appel', async (A) => {
  const bv = await A.bv();
  bv.axes.forEach((a) => assert(typeof a.libelle === 'string' && a.libelle.trim(), 'libelle de l\'axe ' + a.cle + ' vide'));
  bv.t2.forEach((a) => assert(typeof a.libelle === 'string' && a.libelle.trim(), 'libelle T2 ' + a.cle + ' vide'));
  bv.physio.forEach((a) => { assert(typeof a.libelle === 'string' && a.libelle.trim(), 'libelle physio ' + a.cle + ' vide'); assert(typeof a.unite === 'string' && a.unite.trim(), 'unite physio ' + a.cle + ' vide'); });
  eq(bv.items.map((i) => i.code), ITEMS, 'ordre des items');
  const avant = JSON.stringify([await A.st(), await A.sessions(), await A.stockees()]);
  const r = await A.page.evaluate(() => {
    const a = window.GrilleHaptique.bilanVisuel(); a.total.valeur = 'MUTE'; a.items.length = 0; a.axes[0].valeur = 'MUTE';
    const b = window.GrilleHaptique.bilanVisuel();
    let json = true; try { JSON.parse(JSON.stringify(b)); } catch (e) { json = false; }
    return { total: b.total.valeur, nb: b.items.length, a1: b.axes[0].valeur, json, dom: JSON.stringify(b).indexOf('[object') >= 0 };
  });
  eq([r.total, r.nb, r.a1, r.json, r.dom], [10, 19, 4, true, false], 'bilanVisuel() renvoie un objet independant, serialisable');
  eq(JSON.stringify([await A.st(), await A.sessions(), await A.stockees()]), avant, 'bilanVisuel() ne modifie ni la session, ni la liste, ni localStorage');
  await A.go('t1'); eq((await A.bv()).total.valeur, 10, 'bilanVisuel() hors de l\'etape Synthese (modele sans DOM)');
}, OPT_JEU(JEU_A, 'j1'));

check('E1 modele : precedente selon l\'ordre chronologique C1.2 (dates egales, numeros, dates vides, casse) pour chaque session', async (A) => {
  const mk = (id, code, no, date, cree) => sess({ id, cree_le: cree || '2026-02-01T08:00:00.000Z', identification: { code_sujet: code, session_no: no, date } });
  const jeu = [
    mk('t1', 'T1', 1, '2026-03-02'), mk('t2', 't1', 3, '2026-03-09'), mk('t3', 'T1', 2, '2026-03-09'), mk('t4', 'T1', null, '2026-03-09'), mk('t5', 'T1', 4, ''),
    mk('t6', 'T1', 4, '', '2026-02-02T08:00:00.000Z'), mk('u1', 'U1', 1, '2026-04-06', '2026-04-06T12:00:00.000Z'), mk('u2', 'U1', 1, '2026-04-06', '2026-04-06T08:00:00.000Z'),
    mk('u3', 'U1', 1, '2026-04-06', '2026-04-06T08:00:00.000Z'), mk('w1', '', 1, '2026-01-01'), mk('w2', '', 2, '2026-01-02'),
  ];
  for (const s of jeu) {
    await charger(A, jeu, s.id);
    const bv = await A.bv(); const m = modeleVis(jeu, s.id);
    eq(bv.precedente && bv.precedente.id, m.precedente && m.precedente.id, 'precedente.id de la session ' + s.id);
  }
}, OPT_JEU(JEU_A, 'j1'));

/* ================================================================== */
/* E1. Elements du bilan visuel                                        */
/* ================================================================== */

check('E1 DOM : #bilan-visuel en tete de la section Synthese, avant les scores ; absent des autres etapes', async (A) => {
  const snap = await snapSynthese(A);
  assert(snap.racine.dansSynthese, '#bilan-visuel n\'est pas dans section[data-panel="synthese"]');
  assert(snap.racine.avantScores, '#bilan-visuel n\'est pas place avant #score-axe1');
  assert(snap.racine.visible, '#bilan-visuel non visible dans la Synthese');
  const premier = await A.page.evaluate(() => { const s = document.querySelector('section[data-panel="synthese"]'); const b = document.getElementById('bilan-visuel'); const avant = [...s.querySelectorAll('*')].filter((e) => !!(e.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) && !e.contains(b) && /^(section|div|table|ul|ol|form|svg|p)$/i.test(e.localName) && e.textContent.trim()); return avant.map((e) => e.localName + '#' + e.id).slice(0, 5); });
  assert(premier.length <= 3, '#bilan-visuel n\'est pas en tete : precede par ' + JSON.stringify(premier));
}, OPT_JEU(JEU_A, 'j1'));

parCas('E1 jauge : #vis-jauge, data-ratio calcule (3 decimales, absent si null), texte central, aria-label', (snap, m) => { verifierJauge(snap, m); });
parCas('E1 radar : sommets, data-valeur et data-ratio, polygone, 4 anneaux, sommet null au centre, etiquettes', (snap, m) => { verifierRadar(snap, m); });
parCas('E1 bande des items : 19 cellules ordonnees, valeurs, NA, vide, groupes separes, couleurs des jetons, hachure NA', (snap, m) => { verifierBande(snap, m); couleursBande(snap, m, 0); });
check('E1 bande des items : legende des 5 etats (0, 1, 2, 3, NA)', async (A) => { const snap = await snapSynthese(A); legendeBande(snap); }, OPT_JEU([VIDE], 'vide'));
parCas('E1 T2 : 4 reperes, data-valeur, forme (triangle haut / carre / triangle bas), couleur de la palette, libelle', (snap, m, bv) => { verifierT2(snap, m, 0, bv); });
parCas('E1 physio : points, polyligne, mesure omise, « Aucune mesure saisie », serie constante et valeur unique', (snap, m, bv) => { verifierPhysio(snap, m, bv); });
parCas('E1 comparaison : 5 deltas avec signe et fleche, mention « par rapport a S<n> (jj/mm/aaaa) », premiere session, code vide', (snap, m) => {
  if (m.precedente) verifierComparaison(snap, m);
  else if (snap.comparaison && snap.comparaison.texte === '' && snap.comparaison.nbVis === 0) { /* code vide : element vide */ } else assert(/Première session de ce participant/.test(snap.comparaison.texte), 'texte « Première session de ce participant » absent : "' + snap.comparaison.texte + '"');
});
check('E1 comparaison : code vide donne un element vide, code non vide sans precedente donne « Premiere session de ce participant »', async (A) => {
  let snap = await snapSynthese(A); verifierVide(snap);
  await charger(A, JEU_PREMIERE, 'j1'); snap = await snapSynthese(A);
  assert(/Première session de ce participant/.test(snap.comparaison.texte), 'texte absent : "' + snap.comparaison.texte + '"');
  eq(snap.comparaison.deltas.length, 0, 'deltas sans precedente');
}, OPT_JEU(JEU_SANS_CODE, 'j1s'));
check('E1 comparaison : delta vide (non calculable) et deltas a 0 / signes exacts (« +3 », « -2 », « 0 », vide)', async (A) => {
  const snap = await snapSynthese(A);
  eq(snap.comparaison.deltas.map((d) => d.delta), ['+3', '-2', '0', '', '-1'], 'data-delta');
  await charger(A, JEU_A, 'j1');
  eq((await snapSynthese(A)).comparaison.deltas.map((d) => d.delta), ['+3', '-2', '', '', '+2'], 'data-delta (precedente avec un score null)');
}, OPT_JEU(JEU_B, 'j1'));

parCas('E1 accessibilite : chaque svg a role="img" et un aria-label ; jauge, radar, bande, T2 et chaque mini graphique physio ont un svg', (snap, m) => {
  verifierSvgRole(snap);
  ['jauge', 'radar', 'bande', 't2'].forEach((k) => assert(snap[k] && snap[k].svg, 'aucun svg dans le bloc ' + k));
  assert(snap.svgs.length >= 4, 'moins de 4 svg dans #bilan-visuel');
  snap.physio.charts.forEach((c) => assert(c.svg, 'mini graphique ' + c.cle + ' sans svg'));
  const labels = [snap.jauge.svg, snap.radar.svg, snap.bande.svg, snap.t2.svg].concat(snap.physio.charts.map((c) => c.svg)).map((x) => x.label); eq(new Set(labels).size, labels.length, 'aria-label des blocs principaux tous distincts (labels : ' + JSON.stringify(labels) + ')');
});

check('E1 aria-label : la jauge annonce « Indice global : 10 sur 39 » ; les etiquettes changent avec les donnees', async (A) => {
  let s = await snapSynthese(A); eq(s.jauge.svg.label, 'Indice global : 10 sur 39', 'aria-label jauge');
  const l1 = s.radar.svg.label; await charger(A, [MAXI], 'maxi'); s = await snapSynthese(A);
  eq(s.jauge.svg.label, 'Indice global : 39 sur 39', 'aria-label jauge (maximum)'); assert(s.radar.svg.label !== l1, 'aria-label du radar inchange alors que les valeurs different');
  await charger(A, [VIDE], 'vide'); s = await snapSynthese(A); eq(s.jauge.svg.label, 'Indice global : non calculable', 'aria-label jauge (vide)');
}, OPT_JEU(JEU_A, 'j1'));

/* ------------------------------------------------------------------ */
/* E1. Redessin a chaque modification, scores existants inchanges      */
/* ------------------------------------------------------------------ */

const AGIR = {
  coter: (c, v) => (A) => A.page.evaluate((a) => { const b = document.querySelector('button[data-rate="' + a.c + '"][data-val="' + a.v + '"]'); if (!b) throw new Error('bouton de cotation introuvable'); b.click(); }, { c, v }),
  t2: (k, v) => (A) => A.page.evaluate((a) => { const r = document.querySelector('input[name="t2-' + a.k + '"][value="' + a.v + '"]'); if (!r) throw new Error('radio T2 introuvable'); r.click(); }, { k, v }),
  physio: (m, t, v) => (A) => A.page.evaluate((a) => { const i = document.querySelector('input[data-physio="' + a.m + '"][data-temps="' + a.t + '"]'); if (!i) throw new Error('champ physio introuvable'); i.value = a.v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, { m, t, v }),
  code: (v) => (A) => A.page.evaluate((x) => { const i = document.getElementById('f-code'); i.value = x; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, v),
};
check('E1 redessin : tant que la Synthese est affichee, chaque modification (cotation, T2, physio, code) redessine le bilan', async (A) => {
  await A.api('bilanVisuel'); await A.go('synthese');
  const attendre = async (lib, f) => { try { await A.attendre(f, null, 1200, lib); } catch (e) { fail('bilan visuel non redessine apres ' + lib); } };
  await AGIR.coter('V4.1', 3)(A);
  await attendre('la cotation de V4.1 = 3', () => document.querySelector('#vis-bande-items [data-code="V4.1"]').getAttribute('data-valeur') === '3' && document.querySelector('#vis-radar [data-cle="axe4"]').getAttribute('data-valeur') === '3');
  eq((await A.bv()).axes[3].valeur, 3, 'bilanVisuel() apres cotation');
  await AGIR.coter('V4.1', 'NA')(A);
  await attendre('la cotation de V4.1 = NA', () => document.querySelector('#vis-bande-items [data-code="V4.1"]').getAttribute('data-valeur') === 'NA' && document.querySelector('#vis-radar [data-cle="axe4"]').getAttribute('data-valeur') === '');
  await AGIR.t2('relation', 1)(A);
  await attendre('le choix T2 relation = 1', () => document.querySelector('#vis-t2 [data-cle="relation"]').getAttribute('data-valeur') === '1');
  await AGIR.physio('vfc', 't1', '41,5')(A);
  await attendre('la saisie physio vfc/t1', () => { const p = document.querySelector('#vis-physio [data-vis="physio-point"][data-cle="vfc"][data-temps="t1"]'); return !!p && Number(p.getAttribute('data-valeur')) === 41.5; });
  await AGIR.code('ZZ9')(A);
  await attendre('le changement de code', () => /Première session/.test(document.getElementById('vis-comparaison').textContent) && document.querySelectorAll('#vis-comparaison [data-vis="delta"]').length === 0);
  await AGIR.code('E01')(A);
  await attendre('le retour au code E01', () => document.querySelectorAll('#vis-comparaison [data-vis="delta"]').length === 5);
  const m = modeleVis(JEU_B.map((s) => (s.id === 'j1' ? sess(merge(J1, { cotations: { 'V4.1': 'NA' }, t2: { relation: { evolution: 1 } }, physio: { vfc: { t1: 41.5 } } })) : s)), 'j1');
  eq(sansLibelles(await A.bv()), m, 'bilanVisuel() apres toutes les modifications');
}, OPT_JEU(JEU_B, 'j1'));

check('E1 redessin : a chaque affichage de l\'etape (modification faite sur une autre etape, puis retour a la Synthese)', async (A) => {
  await A.api('bilanVisuel'); await A.go('synthese'); await A.go('t1');
  await AGIR.coter('V3.2', 2)(A); await AGIR.physio('fc', 'rupture', '120')(A); await A.go('synthese');
  const snap = await A.page.evaluate(SNAP);
  eq(snap.bande.cellules.find((c) => c.code === 'V3.2').valeur, '2', 'cellule V3.2 apres retour');
  assert(snap.physio.charts.find((c) => c.cle === 'fc').points.some((p) => p.temps === 'rupture' && Number(p.valeur) === 120), 'point fc/rupture absent apres retour');
  eq((await A.page.evaluate(SNAP)).jauge.svg.label, 'Indice global : ' + (await A.bv()).total.valeur + ' sur 39', 'jauge apres retour');
}, OPT_JEU(JEU_B, 'j1'));

check('E1 existant : #score-*, data-manquants et liste « A completer » toujours presents et coherents avec les cotations', async (A) => {
  await A.go('synthese');
  const lu = await A.page.evaluate(() => { const o = {}; ['axe1', 'axe2', 'axe3', 'axe4', 'total'].forEach((k) => { const e = document.getElementById('score-' + k); o[k] = e ? { t: e.textContent.trim(), m: e.getAttribute('data-manquants') } : null; }); return { o, texte: document.querySelector('section[data-panel="synthese"]').innerText, manq: document.querySelectorAll('section[data-panel="synthese"] [data-manquants]').length }; });
  const c = calcScores(J1.cotations);
  ['axe1', 'axe2', 'axe3', 'axe4', 'total'].forEach((k) => { assert(lu.o[k], '#score-' + k + ' absent'); eq(lu.o[k].t, c.scores[k] === null ? '-' : String(c.scores[k]), '#score-' + k + ' texte'); eq(lu.o[k].m, String(c.manquants[k]), '#score-' + k + ' data-manquants'); });
  assert(lu.manq >= 5, '[data-manquants] : ' + lu.manq + ' element(s)');
  assert(/compl/i.test(lu.texte), 'rubrique « A completer » absente');
  assert(/T0\.4(?!\d)/.test(lu.texte) && /V4\.1(?!\d)/.test(lu.texte), 'items non cotes (T0.4, V4.1) absents de la liste « A completer »');
  const dedans = await A.page.evaluate(() => { const b = document.getElementById('bilan-visuel'); return ['score-axe1', 'score-total'].filter((i) => b.contains(document.getElementById(i))); });
  eq(dedans, [], 'les #score-* ne doivent pas etre deplaces dans #bilan-visuel');
  await A.go('t0'); await AGIR.coter('T0.4', 2)(A); await A.go('synthese');
  assert(!/T0\.4(?!\d)/.test(await A.page.evaluate(() => { const s = document.querySelector('section[data-panel="synthese"]').innerText; return s.slice(s.search(/compl/i)); })), 'T0.4 (cote) encore dans la liste « A completer »');
}, OPT_JEU(JEU_A, 'j1'));

/* ------------------------------------------------------------------ */
/* E1. Defilement horizontal, themes, impression, securite             */
/* ------------------------------------------------------------------ */

for (const [largeur, hauteur] of [[360, 740], [390, 844], [1280, 900]]) {
  check('E1 mise en page : aucun defilement horizontal de la page a ' + largeur + ' px (Synthese avec bilan complet), svg entiers et lisibles', async (A) => {
    for (const [lib, jeu, id] of [['tout rempli', [PLEIN, PLEIN_PREC], 'plein'], ['vide', [VIDE], 'vide']]) {
      await charger(A, jeu, id); await A.api('bilanVisuel'); await A.go('synthese');
      const r = await A.page.evaluate(() => {
        const b = document.getElementById('bilan-visuel'); if (!b) return null;
        const de = document.documentElement; const w = window.innerWidth;
        return { page: de.scrollWidth, corps: document.body.scrollWidth, w, droite: b.getBoundingClientRect().right, gauche: b.getBoundingClientRect().left,
          svgs: [...b.querySelectorAll('svg')].map((s) => { const q = s.getBoundingClientRect(); return { l: q.left, r: q.right, w: q.width, h: q.height, principal: !!s.closest('#vis-jauge,#vis-radar,#vis-bande-items,#vis-t2,[data-vis="physio"]') }; }),
          deborde: [...b.querySelectorAll('*')].filter((e) => !(e instanceof SVGElement) && e.getBoundingClientRect().right > w + 0.5).map((e) => e.localName + '#' + e.id).slice(0, 3) };
      });
      assert(r, '#bilan-visuel absent');
      const L = '[' + lib + '] ';
      assert(r.page <= r.w, L + 'defilement horizontal de la page : scrollWidth ' + r.page + ' > ' + r.w);
      assert(r.corps <= r.w, L + 'defilement horizontal du corps : ' + r.corps + ' > ' + r.w);
      assert(r.droite <= r.w + 0.5 && r.gauche >= -0.5, L + '#bilan-visuel deborde de l\'ecran (' + r.gauche.toFixed(0) + ' a ' + r.droite.toFixed(0) + ')');
      eq(r.deborde, [], L + 'elements HTML du bilan hors ecran');
      assert(r.svgs.length >= 4, L + 'au moins 4 svg attendus');
      r.svgs.forEach((s, i) => { assert(s.l >= -0.5 && s.r <= r.w + 0.5, L + 'svg n' + (i + 1) + ' hors ecran (' + s.l.toFixed(0) + ' a ' + s.r.toFixed(0) + ')'); assert(!s.principal || (s.w >= 60 && s.h >= 20), L + 'svg n' + (i + 1) + ' trop petit : ' + s.w.toFixed(0) + 'x' + s.h.toFixed(0)); });
    }
  }, { viewport: { width: largeur, height: hauteur }, storage: stockage([PLEIN, PLEIN_PREC], 'plein') });
}

check('E1 themes : jetons --bil-* clairs et sombres, couleurs du bilan issues des jetons dans les deux themes', async (A) => {
  await A.api('bilanVisuel'); await A.go('synthese');
  const m = modeleVis([PLEIN, PLEIN_PREC], 'plein'); const bv = await A.page.evaluate(() => window.GrilleHaptique.bilanVisuel());
  for (const [schema, idx] of [['light', 0], ['dark', 1]]) {
    await A.page.emulateMedia({ colorScheme: schema });
    const lu = await lireVars(A);
    Object.keys(VARS).forEach((n) => eq(normHex(lu[n]), VARS[n][idx], schema + ' : ' + n));
    const snap = await A.page.evaluate(SNAP);
    try { couleursBande(snap, m, idx); verifierT2(snap, m, idx, bv); } catch (e) { e.message = '[' + schema + '] ' + e.message; throw e; }
  }
}, { storage: stockage([PLEIN, PLEIN_PREC], 'plein') });

for (const schema of ['light', 'dark']) {
  check('E1 themes : contraste >= 4,5 du texte et >= 3 des traits, theme ' + (schema === 'dark' ? 'sombre' : 'clair') + ' (calcul sur les couleurs calculees)', async (A) => {
    await A.api('bilanVisuel'); await A.go('synthese');
    await A.page.emulateMedia({ colorScheme: schema });
    const c = await A.page.evaluate(COULEURS);
    assert(c.textes.length >= 20, 'trop peu de textes dans #bilan-visuel (' + c.textes.length + ')');
    const mauvais = c.textes.map((t) => ({ t: t.t, c: contraste(t.couleur, t.fond) })).filter((x) => x.c < 4.5);
    assert(!mauvais.length, mauvais.length + ' texte(s) sous 4,5 de contraste : ' + mauvais.slice(0, 4).map((x) => '"' + x.t + '" ' + x.c.toFixed(2)).join(' ; '));
    assert(c.traits.length >= 3, 'trop peu de traits (arc de jauge, forme du radar, polylignes) : ' + c.traits.length);
    const faibles = c.traits.map((t) => ({ v: t.vis, c: contraste(t.couleur, t.fond) })).filter((x) => x.c < 3);
    assert(!faibles.length, faibles.length + ' trait(s) sous 3 de contraste : ' + faibles.slice(0, 4).map((x) => x.v + ' ' + x.c.toFixed(2)).join(' ; '));
  }, { storage: stockage([PLEIN, PLEIN_PREC], 'plein') });
}

check('E1 impression : le bilan visuel est visible en media print, en clair meme en theme sombre, sur une autre etape que la Synthese', async (A) => {
  await A.api('bilanVisuel'); await A.go('synthese'); await A.go('t1');
  await A.page.emulateMedia({ colorScheme: 'dark', media: 'print' });
  const r = await A.page.evaluate(() => { const b = document.getElementById('bilan-visuel'); const cs = b && getComputedStyle(b); return b && { aff: cs.display !== 'none' && cs.visibility !== 'hidden' && b.getClientRects().length > 0, nb: b.querySelectorAll('svg').length, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height,
    svgs: [...b.querySelectorAll('svg')].map((s) => s.getBoundingClientRect().width > 0 && getComputedStyle(s).display !== 'none') }; });
  assert(r, '#bilan-visuel absent'); assert(r.aff, '#bilan-visuel non visible en impression'); assert(r.nb >= 4 && r.svgs.every(Boolean), 'svg du bilan non affiches en impression');
  const lu = await lireVars(A);
  Object.keys(VARS).forEach((n) => eq(normHex(lu[n]), VARS[n][0], 'impression en theme sombre : ' + n));
  const m = modeleVis([PLEIN, PLEIN_PREC], 'plein'); const snap = await A.page.evaluate(SNAP);
  couleursBande(snap, m, 0);
  const c = await A.page.evaluate(COULEURS);
  const mauvais = c.textes.map((t) => ({ t: t.t, c: contraste(t.couleur, t.fond) })).filter((x) => x.c < 4.5);
  assert(!mauvais.length, 'impression : ' + mauvais.length + ' texte(s) sous 4,5 : ' + mauvais.slice(0, 3).map((x) => '"' + x.t + '" ' + x.c.toFixed(2)).join(' ; '));
  assert(c.textes.length >= 20, 'impression : trop peu de textes (' + c.textes.length + ')');
  const fonds = await A.page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.documentElement).backgroundColor]);
  fonds.forEach((f) => { const v = rgbDe(f); assert(!v || lum(v) > 0.6 || /rgba\(0, 0, 0, 0\)/.test(f), 'fond sombre en impression : ' + f); });
}, { storage: stockage([PLEIN, PLEIN_PREC], 'plein') });

check('E1 securite : code, observations et date contenant du HTML ne s\'executent pas ; aucune balise injectee dans le bilan', async (A) => {
  await A.api('bilanVisuel');
  const mal = (id, no, date) => sess({ id, identification: { code_sujet: XSS, session_no: no, date, diagnostic: XSS, observateur: XSS }, observations: { 'T0.1': XSS, AXE1: XSS, 'V1.1': XSS }, synthese: { evenements: XSS, conclusion: XSS },
    cotations: { 'V1.1': 2 }, rupture: { commentaire: XSS }, t2: { tonus: { evolution: 1, details: XSS } } });
  const jeu = [mal('x1', 1, XSS), mal('x2', 2, '')];
  await A.importer(sauvegarde(jeu), ['x1', 'x2']);
  await charger(A, jeu, 'x2');
  await A.go('synthese'); await A.page.waitForTimeout(250);
  const r = await A.page.evaluate(() => ({ xss: window.__xss, imgs: document.querySelectorAll('#bilan-visuel img, #bilan-visuel script, #bilan-visuel iframe').length, bv: !!document.getElementById('bilan-visuel'), html: document.getElementById('bilan-visuel').innerHTML.indexOf('onerror') }));
  assert(r.bv, '#bilan-visuel absent'); eq(r.xss, 0, 'window.__xss (le HTML saisi s\'est execute)'); eq(r.imgs, 0, 'balises img/script/iframe injectees dans le bilan');
  eq(r.html, -1, 'attribut onerror present dans le DOM du bilan');
  eq((await A.bv()).precedente.id, 'x1', 'precedente.id avec un code et une date contenant du HTML');
}, { storage: stockage([sess({ id: 'init', identification: { code_sujet: 'AB1' } })], 'init') });

/* ================================================================== */
/* E2. Sauvegarde automatique dans un dossier (faux dossier en memoire) */
/* ================================================================== */

const STO_D = () => stockage(jeuDossier(), 'd2');
const OPT_D = (extra) => Object.assign({ storage: STO_D(), dossier: {} }, extra || {});
const SANS_CONSOLE = { tolererConsole: true };
const pauser = async (A) => { const t = await A.page.evaluate(() => Date.now()); await A.page.clock.pauseAt(new Date(t + 20)); };
const ecritures = (A) => A.page.evaluate(() => window.__fd.ecritures());
const trie = (o) => Object.keys(o).sort();

/* le dossier est le miroir exact des sessions de l'appli */
async function verifierMiroir(A, lib) {
  const ss = await A.sessions(); const arbre = await A.arbre();
  eq(trie(arbre), [SAUV].concat(ss.map(nomFichier)).sort(), lib + ' : fichiers du dossier');
  ss.forEach((s) => eq(JSON.parse(arbre[nomFichier(s)]), s, lib + ' : contenu de ' + nomFichier(s)));
  const sv = JSON.parse(arbre[SAUV]);
  eq(sv.schema, 'grille-haptique/1', lib + ' : schema de la sauvegarde complete'); assert(typeof sv.exporte_le === 'string' && sv.exporte_le, lib + ' : exporte_le absent de la sauvegarde complete');
  const par = (l) => l.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  eq(par(sv.sessions), par(ss), lib + ' : sessions de la sauvegarde complete');
}
const violations = async (A) => { eq(await A.page.evaluate(() => window.__fd.violations), [], 'usage d\'une API de fichiers hors contrat'); };

check('E2 API : dossier(), ecrireDossier(), lireDossier(), stockageDurable() exposees ; elements du bloc de sauvegarde dans #panneau-sessions', async (A) => {
  const manquantes = await A.page.evaluate(() => ['dossier', 'ecrireDossier', 'lireDossier', 'stockageDurable'].filter((k) => typeof window.GrilleHaptique[k] !== 'function'));
  eq(manquantes, [], 'fonctions manquantes dans GrilleHaptique');
  const hors = await A.page.evaluate(() => ['btn-dossier-sauvegarde', 'etat-dossier', 'aide-dossier', 'btn-dossier-reautoriser', 'btn-lire-dossier', 'etat-stockage'].filter((i) => { const e = document.getElementById(i); return !e || !document.getElementById('panneau-sessions').contains(e); }));
  eq(hors, [], 'elements absents de #panneau-sessions');
  await A.panneau();
  eq(await A.texte('#btn-dossier-sauvegarde'), 'Choisir un dossier de sauvegarde', 'libelle de #btn-dossier-sauvegarde');
  eq(await A.page.evaluate(() => [document.getElementById('btn-dossier-reautoriser').textContent.trim(), document.getElementById('btn-lire-dossier').textContent.trim()]), ['Réactiver la sauvegarde dans le dossier', 'Importer depuis le dossier'], 'libelles des boutons du dossier');
}, OPT_D());

check('E2 etat initial : « inactif » avec un dossier disponible, boutons de reprise et de lecture masques, dossier() = {etat, nom, derniereEcriture}', async (A) => {
  await A.panneau();
  const e = await A.etatDossier(); eq(e.attr, 'inactif', 'data-etat-dossier');
  const d = await A.dossierApi(); eq(Object.keys(d).sort(), ['derniereEcriture', 'etat', 'nom'], 'cles de dossier()');
  eq([d.etat, d.derniereEcriture], ['inactif', null], 'dossier()'); assert(d.nom === null || d.nom === '', 'dossier().nom devrait etre null ou vide a l\'etat inactif : ' + JSON.stringify(d.nom));
  eq(await A.visible('#btn-dossier-reautoriser'), false, '#btn-dossier-reautoriser visible a l\'etat inactif');
  eq(await A.visible('#btn-lire-dossier'), false, '#btn-lire-dossier visible sans dossier actif');
  eq(await A.page.evaluate(() => document.getElementById('btn-dossier-sauvegarde').disabled), false, '#btn-dossier-sauvegarde desactive alors que showDirectoryPicker existe');
  eq(await A.page.evaluate(() => window.__fd.journal.length), 0, 'appels au faux dossier avant tout choix');
}, OPT_D());

check('E2 indisponible : sans showDirectoryPicker, bouton desactive, aide « Disponible dans Chrome et Edge sur ordinateur », etat indisponible', async (A) => {
  eq(await A.page.evaluate(() => 'showDirectoryPicker' in window), false, 'precondition : showDirectoryPicker supprime');
  await A.panneau();
  eq((await A.etatDossier()).attr, 'indisponible', 'data-etat-dossier');
  eq((await A.dossierApi()).etat, 'indisponible', 'dossier().etat');
  eq(await A.page.evaluate(() => document.getElementById('btn-dossier-sauvegarde').disabled), true, '#btn-dossier-sauvegarde desactive');
  assert(/Disponible dans Chrome et Edge sur ordinateur/.test(await A.texte('#aide-dossier')), '#aide-dossier : "' + await A.texte('#aide-dossier') + '"');
  eq(await A.visible('#btn-lire-dossier'), false, '#btn-lire-dossier visible'); eq(await A.visible('#btn-dossier-reautoriser'), false, '#btn-dossier-reautoriser visible');
  eq((await A.dossierApi()).derniereEcriture, null, 'derniereEcriture');
}, { storage: STO_D(), dossier: false });

check('E2 aide : texte exact de #aide-dossier quand le dossier est disponible ; aucune mention de distance, synchronisation ou partage ailleurs dans le panneau', async (A) => {
  await A.panneau();
  eq(await A.texte('#aide-dossier'), MSG_AIDE, 'texte de #aide-dossier');
  const r = await A.page.evaluate(() => { const p = document.getElementById('panneau-sessions'); const a = document.getElementById('aide-dossier'); const brut = p.outerHTML; return { tout: brut, sans: brut.split(a.outerHTML).join(''), texte: p.textContent }; });
  eq(/distance|synchronis/i.exec(r.tout), null, 'mention de « distance » ou « synchronis » dans le panneau Sessions (texte et attributs)');
  eq(/partag|cloud|nuage|a distance|en ligne|sur le reseau|reseau/i.exec(r.sans.normalize('NFD').replace(/[̀-ͯ]/g, '')), null, 'mention de partage, d\'acces distant ou en ligne hors de #aide-dossier');
}, OPT_D());

check('E2 choix : showDirectoryPicker({mode:"readwrite"}), etat actif, texte « Sauvegarde dans le dossier <nom> : derniere ecriture a hh:mm », dossier(), boutons', async (A) => {
  await A.activer();
  eq(await A.page.evaluate(() => window.__fd.journal.filter((e) => e.op === 'showDirectoryPicker').map((e) => e.mode)), ['readwrite'], 'appels de showDirectoryPicker (mode)');
  await violations(A);
  const e = await A.etatDossier(); eq(e.attr, 'actif', 'data-etat-dossier');
  assert(/^Sauvegarde dans le dossier Dossier-Test : dernière écriture à \d{2}:\d{2}$/.test(e.texte), 'texte de #etat-dossier : "' + e.texte + '"');
  const d = await A.dossierApi();
  eq([d.etat, d.nom], ['actif', 'Dossier-Test'], 'dossier()'); assert(typeof d.derniereEcriture === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(d.derniereEcriture) && !isNaN(Date.parse(d.derniereEcriture)), 'derniereEcriture n\'est pas une date ISO : ' + d.derniereEcriture);
  const dt = new Date(d.derniereEcriture); assert(Math.abs(Date.now() - dt.getTime()) < 120000, 'derniereEcriture trop eloignee de maintenant : ' + d.derniereEcriture);
  const hhmm = (x) => String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0');
  const t = /(\d{2}):(\d{2})$/.exec(e.texte); const m1 = new Date(dt); const m2 = new Date(dt.getTime() + 60000); const m0 = new Date(dt.getTime() - 60000);
  assert([hhmm(m0), hhmm(dt), hhmm(m2)].indexOf(t[0]) >= 0, 'heure du texte (' + t[0] + ') differente de derniereEcriture en heure locale (' + hhmm(dt) + ')');
  eq(await A.visible('#btn-lire-dossier'), true, '#btn-lire-dossier non visible avec un dossier actif'); eq(await A.visible('#btn-dossier-reautoriser'), false, '#btn-dossier-reautoriser visible a l\'etat actif');
}, OPT_D());

check('E2 ecritures a l\'activation : sauvegarde complete a la racine et un fichier par session dans <code>/, noms exacts, x pour les parties vides, sans-code', async (A) => {
  await A.activer();
  const arbre = await A.arbre();
  eq(trie(arbre), [SAUV].concat(jeuDossier().map(nomFichier)).sort(), 'fichiers du dossier');
  eq(trie(arbre), [
    'AA1/grille-haptique_AA1_S1_2026-03-02_d1.json', 'AA1/grille-haptique_AA1_S2_2026-03-09_d2.json', 'BB2/grille-haptique_BB2_S1_2026-03-03_d3.json',
    'CC3/grille-haptique_CC3_Sx_x_d5.json', 'grille-haptique_sauvegarde.json', 'sans-code/grille-haptique_x_S5_2026-03-04_d4.json'], 'noms litteraux');
  eq(await A.page.evaluate(() => window.__fd.dossiers().sort()), ['AA1', 'BB2', 'CC3', 'sans-code'], 'sous-dossiers');
  await verifierMiroir(A, 'activation'); await violations(A);
  const d2 = JSON.parse(arbre['AA1/grille-haptique_AA1_S2_2026-03-09_d2.json']); eq([d2.schema, d2.id, d2.identification.session_no], ['grille-haptique/1', 'd2', 2], 'contenu de la session d2');
}, OPT_D());

check('E2 contenus : sauvegarde = #btn-export-tout, fichier de session = #btn-export-json (memes JSON)', async (A) => {
  await A.activer(); await A.panneau();
  const arbre = await A.arbre();
  const tout = JSON.parse((await A.telecharger('#btn-export-tout')).buf.toString('utf8')); const fich = JSON.parse(arbre[SAUV]);
  eq(Object.keys(fich).sort(), Object.keys(tout).sort(), 'cles de la sauvegarde complete'); eq(fich.sessions, tout.sessions, 'sessions de la sauvegarde complete');
  const un = JSON.parse((await A.telecharger('#btn-export-json')).buf.toString('utf8'));
  eq(JSON.parse(arbre['AA1/grille-haptique_AA1_S2_2026-03-09_d2.json']), un, 'fichier de session d2 vs #btn-export-json');
}, OPT_D());

check('E2 anti-rebond : aucune ecriture avant 1,5 s apres la modification, une seule ensuite meme apres deux modifications rapprochees', async (A) => {
  await A.activer(); await pauser(A);
  await A.fd(() => window.__fd.raz());
  await A.editer('#f-diagnostic', 'un');
  await A.page.clock.runFor(1400);
  eq(await ecritures(A), [], 'ecritures 1,4 s apres la modification');
  await A.page.clock.runFor(3000);
  await A.attendre(() => window.__fd.ecritures().length > 0, null, 1500, 'ecriture apres l\'anti-rebond');
  await A.attendreTree();
  const e1 = await ecritures(A);
  assert(e1.indexOf('AA1/grille-haptique_AA1_S2_2026-03-09_d2.json') >= 0, 'fichier de la session modifiee non reecrit : ' + JSON.stringify(e1));
  eq(JSON.parse((await A.arbre())['AA1/grille-haptique_AA1_S2_2026-03-09_d2.json']).identification.diagnostic, 'un', 'diagnostic dans le fichier');
  /* deux modifications a 1 s d'ecart : une seule ecriture, 1,5 s apres la derniere */
  await A.fd(() => window.__fd.raz());
  await A.page.fill('#f-diagnostic', 'deux'); await A.page.clock.runFor(1000);
  await A.page.fill('#f-diagnostic', 'trois'); await A.page.clock.runFor(1000);
  eq(await ecritures(A), [], 'ecritures 1 s apres la derniere de deux modifications (anti-rebond non relance)');
  await A.page.clock.runFor(3000); await A.attendre(() => window.__fd.ecritures().length > 0, null, 1500, 'ecriture apres la derniere modification'); await A.attendreTree();
  eq((await ecritures(A)).filter((x) => /_d2\.json$/.test(x)).length, 1, 'nombre d\'ecritures du fichier de d2');
  eq(JSON.parse((await A.arbre())['AA1/grille-haptique_AA1_S2_2026-03-09_d2.json']).identification.diagnostic, 'trois', 'diagnostic final dans le fichier');
  await verifierMiroir(A, 'apres anti-rebond');
}, OPT_D({ horloge: true }));

check('E2 ecrireDossier() : promesse, ecriture immediate sans attendre l\'anti-rebond (horloge figee)', async (A) => {
  await A.activer(); await pauser(A);
  await A.fd(() => window.__fd.raz());
  await A.editer('#f-diagnostic', 'immediat');
  eq(await ecritures(A), [], 'ecritures avant ecrireDossier()');
  const estPromesse = await A.page.evaluate(async () => { const p = window.GrilleHaptique.ecrireDossier(); const ok = !!(p && typeof p.then === 'function'); await p; return ok; });
  eq(estPromesse, true, 'ecrireDossier() renvoie une promesse');
  eq(JSON.parse((await A.arbre())['AA1/grille-haptique_AA1_S2_2026-03-09_d2.json']).identification.diagnostic, 'immediat', 'diagnostic dans le fichier juste apres ecrireDossier()');
  await verifierMiroir(A, 'apres ecrireDossier'); await violations(A);
}, OPT_D({ horloge: true }));

check('E2 reecriture : un fichier de session inchange n\'est pas reecrit ; seule la session modifiee l\'est', async (A) => {
  await A.activer(); await A.fd(() => window.__fd.raz());
  await A.page.evaluate(() => window.GrilleHaptique.ecrireDossier());
  eq((await ecritures(A)).filter((x) => x !== SAUV), [], 'fichiers de session reecrits alors que rien n\'a change');
  await A.editer('#f-observateur', 'OBS'); await A.page.evaluate(() => window.GrilleHaptique.ecrireDossier());
  eq((await ecritures(A)).filter((x) => x !== SAUV), ['AA1/grille-haptique_AA1_S2_2026-03-09_d2.json'], 'fichiers de session reecrits apres modification de d2 seule');
  eq(JSON.parse((await A.arbre())['AA1/grille-haptique_AA1_S2_2026-03-09_d2.json']).identification.observateur, 'OBS', 'observateur dans le fichier');
}, OPT_D());

check('E2 suppression (panneau Sessions) : le fichier de la session disparait, la sauvegarde est reecrite, lireDossier() ne la ressuscite pas', async (A) => {
  await A.activer();
  await (await A.boutonPanneau('supprimer', 'd3')).click();
  await A.page.waitForFunction(() => window.GrilleHaptique.sessions().every((s) => s.id !== 'd3'), null, { timeout: 2000 });
  await A.page.evaluate(() => window.GrilleHaptique.ecrireDossier());
  const arbre = await A.arbre();
  eq(trie(arbre).filter((x) => /_d3\.json$/.test(x)), [], 'fichier de d3 encore present');
  eq(JSON.parse(arbre[SAUV]).sessions.map((s) => s.id).sort(), ['d1', 'd2', 'd4', 'd5'], 'sessions de la sauvegarde complete');
  await verifierMiroir(A, 'apres suppression');
  await A.page.evaluate(() => window.GrilleHaptique.lireDossier());
  eq((await A.sessions()).map((s) => s.id).sort(), ['d1', 'd2', 'd4', 'd5'], 'sessions apres lireDossier()');
}, OPT_D());

check('E2 suppression (vue Participants) : le fichier de la session disparait du sous-dossier du participant', async (A) => {
  await A.activer(); await A.fermerPanneau();
  await A.page.click('#btn-participants'); await A.page.locator('#vue-participants').waitFor({ state: 'visible' });
  await A.page.click('button[data-ouvrir-participant="aa1"]'); await A.page.locator('#participant-detail').waitFor({ state: 'visible' });
  await A.page.click('button[data-supprimer-session="d1"]');
  await A.page.waitForFunction(() => window.GrilleHaptique.sessions().every((s) => s.id !== 'd1'), null, { timeout: 2000 });
  await A.page.evaluate(() => window.GrilleHaptique.ecrireDossier());
  eq(trie(await A.arbre()).filter((x) => /_d1\.json$/.test(x)), [], 'fichier de d1 encore present');
  await verifierMiroir(A, 'apres suppression depuis la vue Participants');
}, OPT_D());

check('E2 suppression (effacement total) : tous les fichiers de session disparaissent, la sauvegarde complete est reecrite', async (A) => {
  await A.activer(); await A.panneau();
  await A.clic('#btn-effacer-tout');
  await A.page.waitForFunction(() => window.GrilleHaptique.sessions().every((s) => /^d\d$/.test(s.id) === false), null, { timeout: 2500 });
  await A.page.evaluate(() => window.GrilleHaptique.ecrireDossier());
  const arbre = await A.arbre();
  eq(trie(arbre).filter((x) => /_d[1-5]\.json$/.test(x)), [], 'fichiers de session encore presents apres l\'effacement total');
  assert(arbre[SAUV] !== undefined, 'sauvegarde complete absente apres l\'effacement total');
  eq(JSON.parse(arbre[SAUV]).sessions.filter((s) => /^d\d$/.test(s.id)).length, 0, 'sessions effacees encore dans la sauvegarde complete');
  await verifierMiroir(A, 'apres effacement total');
}, OPT_D());

check('E2 changement de numero, de date puis de code : ancien fichier supprime, nouveau ecrit, un seul fichier par session', async (A) => {
  await A.activer();
  const etapes = [
    ['numero 2 -> 7', '#f-session', '7', 'AA1/grille-haptique_AA1_S7_2026-03-09_d2.json'],
    ['date -> 2026-04-01', '#f-date', '2026-04-01', 'AA1/grille-haptique_AA1_S7_2026-04-01_d2.json'],
    ['code AA1 -> ZZ9', '#f-code', 'ZZ9', 'ZZ9/grille-haptique_ZZ9_S7_2026-04-01_d2.json'],
  ];
  for (const [lib, sel, val, nom] of etapes) {
    await A.editer(sel, val); await A.page.evaluate(() => window.GrilleHaptique.ecrireDossier());
    const arbre = await A.arbre();
    eq(trie(arbre).filter((x) => /_d2\.json$/.test(x)), [nom], 'fichiers de d2 apres ' + lib);
    await verifierMiroir(A, lib);
  }
}, OPT_D());

/* ------------------------------------------------------------------ */
/* E2. Lecture du dossier                                              */
/* ------------------------------------------------------------------ */

const sL = (id, code, no, mod, diag) => sess({ id, modifie_le: mod, identification: { code_sujet: code, session_no: no, date: '2026-01-0' + no, diagnostic: diag || '' } });
const STO_LECTURE = () => stockage([sL('ex1', 'EX1', 1, '2026-01-01T10:00:00.000Z', 'local'), sL('ex2', 'EX2', 1, '2026-09-01T10:00:00.000Z', 'local')], 'ex1');
const RE_MSG = /(\d+) session\(?s?\)? importée\(?s?\)? depuis le dossier/;
function poserFichiers(A) {
  const dossier = {
    'lot1/r1.json': JSON.stringify(sL('r1', 'RR1', 1, '2026-02-01T10:00:00.000Z')),
    'sauv-ext.json': JSON.stringify(sauvegarde([sL('r2', 'RR2', 1, '2026-02-01T10:00:00.000Z'), sL('r3', 'RR2', 2, '2026-02-01T10:00:00.000Z')])),
    'a/ancien/dup-ancien.json': JSON.stringify(sL('dup', 'DD1', 1, '2026-02-01T10:00:00.000Z', 'ancien')),
    'z/dup-recent.json': JSON.stringify(sL('dup', 'DD1', 1, '2026-03-01T10:00:00.000Z', 'recent')),
    'a/b/c/profond.json': JSON.stringify(sL('r4', 'RR4', 1, '2026-02-01T10:00:00.000Z')),
    'ex1-dossier.json': JSON.stringify(sL('ex1', 'EX1', 1, '2026-02-01T10:00:00.000Z', 'dossier')),
    'ex2-vieux.json': JSON.stringify(sL('ex2', 'EX2', 1, '2026-02-01T10:00:00.000Z', 'dossier')),
    'bruit.txt': JSON.stringify(sL('bruit-txt', 'BR1', 1, '2026-02-01T10:00:00.000Z')),
    'casse.json': '{ pas du json', 'autre-schema.json': JSON.stringify({ schema: 'autre/1', id: 'autre-1', identification: { code_sujet: 'ZZ' } }),
    'tableau.json': '[1,2,3]', 'vide.json': '',
  };
  return A.page.evaluate((d) => { Object.keys(d).forEach((k) => window.__fd.poser(k, d[k])); }, dossier);
}
check('E2 lecture : #btn-lire-dossier lit recursivement, fusionne par id (la plus recente modifie_le l\'emporte), ignore les fichiers non conformes, message « n session(s) importee(s) depuis le dossier »', async (A) => {
  await A.activer(); await poserFichiers(A);
  await A.panneau(); await A.page.click('#btn-lire-dossier');
  const msg = await A.attendre(() => { const t = document.getElementById('panneau-sessions').innerText.replace(/\s+/g, ' '); const m = /(\d+) session\(?s?\)? importée\(?s?\)? depuis le dossier/.exec(t); return m ? m[0] : null; }, null, 2500, 'message « n session(s) importée(s) depuis le dossier » dans le panneau Sessions');
  const n = Number(RE_MSG.exec(msg)[1]);
  assert(n >= 6 && n <= 8, 'n = ' + n + ' : attendu entre 6 (sessions nouvelles ou plus recentes : r1, r2, r3, r4, dup, ex1) et 8 (sessions lues dans les fichiers valides)');
  const ss = await A.sessions(); const par = (id) => ss.find((s) => s.id === id);
  ['r1', 'r2', 'r3', 'r4', 'dup', 'ex1', 'ex2'].forEach((id) => assert(par(id), 'session ' + id + ' absente apres la lecture du dossier'));
  eq([par('dup').identification.diagnostic, par('ex1').identification.diagnostic, par('ex2').identification.diagnostic], ['recent', 'dossier', 'local'], 'fusion par modifie_le (dup, ex1, ex2)');
  eq(ss.filter((s) => s.id === 'dup').length, 1, 'doublons de dup');
  eq(ss.filter((s) => ['bruit-txt', 'autre-1'].indexOf(s.id) >= 0).length, 0, 'fichiers non conformes importes');
  eq((await A.etatDossier()).attr, 'actif', 'etat du dossier apres la lecture');
  const txt = await A.page.evaluate(() => document.getElementById('panneau-sessions').innerText);
  eq(/erreur|invalide|illisible|ignor/i.exec(txt), null, 'message d\'erreur pour des fichiers ignores silencieusement');
  eq((await A.stockees()).filter((s) => s.id === 'r4').length, 1, 'localStorage mis a jour par la lecture');
  await violations(A);
}, OPT_D({ storage: STO_LECTURE() }));

check('E2 lecture : lireDossier() (promesse) redessine la vue Participants ouverte', async (A) => {
  await A.activer(); await poserFichiers(A); await A.fermerPanneau();
  await A.page.click('#btn-participants'); await A.page.locator('#vue-participants').waitFor({ state: 'visible' });
  eq(await A.page.evaluate(() => document.querySelectorAll('tr[data-participant="rr1"]').length), 0, 'precondition : rr1 absent');
  const p = await A.page.evaluate(async () => { const r = window.GrilleHaptique.lireDossier(); const ok = !!(r && typeof r.then === 'function'); await r; return ok; });
  eq(p, true, 'lireDossier() renvoie une promesse');
  eq(await A.page.evaluate(() => ['rr1', 'rr2', 'rr4', 'dd1'].filter((c) => document.querySelectorAll('tr[data-participant="' + c + '"]').length === 1)), ['rr1', 'rr2', 'rr4', 'dd1'], 'lignes de participants apres lireDossier()');
}, OPT_D({ storage: STO_LECTURE() }));

check('E2 lecture : message exact pour deux sessions nouvelles dans deux fichiers (« 2 sessions importees depuis le dossier »)', async (A) => {
  await A.activer(); await A.fd(() => window.__fd.vider());
  await A.fd(() => { window.__fd.poser('n1/a.json', JSON.stringify({ schema: 'grille-haptique/1', id: 'n-1', cree_le: '2026-02-01T10:00:00.000Z', modifie_le: '2026-02-01T10:00:00.000Z', identification: { code_sujet: 'NN1', session_no: 1, date: '2026-02-01' } })); window.__fd.poser('n2/b.json', JSON.stringify({ schema: 'grille-haptique/1', id: 'n-2', cree_le: '2026-02-01T10:00:00.000Z', modifie_le: '2026-02-01T10:00:00.000Z', identification: { code_sujet: 'NN2', session_no: 1, date: '2026-02-02' } })); });
  await A.panneau(); await A.page.click('#btn-lire-dossier');
  const msg = await A.attendre(() => { const m = /(\d+) session\(?s?\)? importée\(?s?\)? depuis le dossier/.exec(document.getElementById('panneau-sessions').innerText.replace(/\s+/g, ' ')); return m ? m[0] : null; }, null, 2500, 'message d\'import');
  eq(Number(RE_MSG.exec(msg)[1]), 2, 'n du message');
}, OPT_D({ storage: STO_LECTURE() }));

/* ------------------------------------------------------------------ */
/* E2. Erreurs, permission, annulation, memorisation                   */
/* ------------------------------------------------------------------ */

check('E2 erreur d\'ecriture : etat erreur avec message, enregistrement local intact, application utilisable, nouvelle tentative a la modification suivante', async (A) => {
  await A.activer(); await pauser(A);
  for (const mode of ['write', 'createWritable']) {
    await A.fd((m) => { window.__fd.cfg.erreurEcriture = m; }, mode);
    await A.editer('#f-diagnostic', 'echec-' + mode);
    await A.page.evaluate(() => window.GrilleHaptique.ecrireDossier().then(() => 'ok', () => 'rejet'));
    await A.attendreEtat('erreur');
    eq((await A.dossierApi()).etat, 'erreur', 'dossier().etat (' + mode + ')');
    assert((await A.etatDossier()).texte.length > 5, 'message absent dans #etat-dossier a l\'etat erreur');
    eq((await A.stockees()).find((s) => s.id === 'd2').identification.diagnostic, 'echec-' + mode, 'localStorage apres echec d\'ecriture (' + mode + ')');
    eq(await A.visible('#bandeau-stockage'), false, '#bandeau-stockage (echec localStorage) visible alors que seul le dossier echoue');
    await A.fd(() => { window.__fd.cfg.erreurEcriture = null; });
    await A.page.fill('#f-diagnostic', 'reprise-' + mode); await A.page.clock.runFor(3000);
    await A.attendreEtat('actif', 2500);
    eq(JSON.parse((await A.arbre())['AA1/grille-haptique_AA1_S2_2026-03-09_d2.json']).identification.diagnostic, 'reprise-' + mode, 'fichier apres la nouvelle tentative (' + mode + ')');
  }
}, OPT_D({ horloge: true, tolererConsole: true }));

check('E2 permission refusee : pas de sauvegarde, pas d\'erreur bloquante, enregistrement local intact', async (A) => {
  await A.fd(() => { window.__fd.cfg.permission = 'denied'; window.__fd.cfg.apresDemande = 'denied'; });
  await A.choisir(); await A.page.waitForTimeout(500);
  const e = await A.etatDossier(); assert(['inactif', 'erreur', 'a-reautoriser'].indexOf(e.attr) >= 0, 'etat apres refus de permission : ' + e.attr + ' (attendu inactif, a-reautoriser ou erreur, jamais actif)');
  eq(await A.arbre(), {}, 'fichiers ecrits malgre le refus');
  await A.editer('#f-diagnostic', 'local-seul'); await A.page.evaluate(() => window.GrilleHaptique.ecrireDossier().then(() => 0, () => 0));
  eq((await A.stockees()).find((s) => s.id === 'd2').identification.diagnostic, 'local-seul', 'localStorage');
  eq(await A.visible('#bandeau-stockage'), false, '#bandeau-stockage visible');
}, OPT_D({ tolererConsole: true }));

check('E2 annulation du selecteur (AbortError) : etat inchange, aucun message d\'erreur, choix possible ensuite', async (A) => {
  await A.fd(() => { window.__fd.cfg.annuler = true; });
  await A.panneau();
  const avant = await A.etatDossier(); await A.page.click('#btn-dossier-sauvegarde'); await A.page.waitForTimeout(400);
  eq(await A.etatDossier(), avant, '#etat-dossier apres annulation');
  eq(avant.attr, 'inactif', 'etat initial');
  eq(/erreur|abort|echec|échec|annul/i.exec(await A.page.evaluate(() => document.getElementById('panneau-sessions').innerText)), null, 'message d\'erreur dans le panneau apres annulation');
  eq(await A.visible('[role="alert"]'), false, 'element role=alert visible apres annulation');
  await A.fd(() => { window.__fd.cfg.annuler = false; }); await A.page.click('#btn-dossier-sauvegarde'); await A.attendreEtat('actif');
  /* annulation depuis l'etat actif : l'etat actif est conserve */
  await A.fd(() => { window.__fd.cfg.annuler = true; }); await A.page.click('#btn-dossier-sauvegarde'); await A.page.waitForTimeout(400);
  eq((await A.etatDossier()).attr, 'actif', 'etat apres annulation depuis l\'etat actif'); eq((await A.dossierApi()).nom, 'Dossier-Test', 'nom apres annulation');
}, OPT_D());

check('E2 memorisation : objet non clonable (IndexedDB refuse) toleree, etat actif pour cette page, sans erreur', async (A) => {
  await A.activer();
  eq((await A.etatDossier()).attr, 'actif', 'etat'); await A.page.waitForTimeout(300);
}, OPT_D());
check('E2 memorisation : IndexedDB absent toleree, etat actif', async (A) => {
  eq(await A.page.evaluate(() => typeof window.indexedDB), 'undefined', 'precondition');
  await A.activer(); eq((await A.etatDossier()).attr, 'actif', 'etat'); await verifierMiroir(A, 'sans IndexedDB');
}, OPT_D({ sansIndexedDB: true }));

check('E2 rechargement sans handle memorise (faux dossier non clonable) : etat inactif, aucune ecriture, enregistrement local conserve', async (A) => {
  await A.activer(); await A.page.reload(); await A.attendreAPI(); await A.panneau();
  eq((await A.etatDossier()).attr, 'inactif', 'etat apres rechargement');
  eq((await A.dossierApi()).etat, 'inactif', 'dossier().etat'); eq(await A.page.evaluate(() => window.__fd.journal.filter((e) => e.op !== 'showDirectoryPicker').length), 0, 'appels au faux dossier apres rechargement');
  eq((await A.stockees()).length, 5, 'sessions locales');
}, OPT_D());

check('E2 aucune cle localStorage ni sessionStorage nouvelle, aucune requete reseau, pendant activation, ecriture et lecture', async (A) => {
  const avant = await A.cles();
  await A.activer(); await A.editer('#f-diagnostic', 'k'); await A.page.evaluate(() => window.GrilleHaptique.ecrireDossier());
  await poserFichiers(A); await A.page.evaluate(() => window.GrilleHaptique.lireDossier());
  eq(await A.cles(), avant, 'cles de stockage');
  assert(A.requests.every((u) => /^(file:|data:|blob:|about:)/.test(u)), 'requete reseau : ' + A.requests.filter((u) => !/^(file:|data:|blob:|about:)/.test(u)).slice(0, 3).join(', '));
}, OPT_D({ storage: STO_LECTURE() }));

check('E2 reprise apres rechargement avec un vrai handle (queryPermission granted / prompt / denied)', async () => {
  ignorer('non automatisable : un handle de dossier reel ne survit au rechargement que via IndexedDB, et un faux dossier en memoire n\'est pas clonable ; a verifier a la main dans Chrome ou Edge (granted : actif ; prompt : a-reautoriser puis bouton ; denied : inactif)');
});

/* ================================================================== */
/* E3. Stockage durable                                                */
/* ================================================================== */

const DUR = (mode, attendu, texteRe) => check('E3 stockage durable : navigator.storage.persist ' + (mode === 'true' ? 'simule a true' : mode === 'false' ? 'simule a false' : mode === 'absent' ? 'absent (navigator.storage indefini)' : 'absent (storage sans persist)') + ' : stockageDurable() = ' + attendu + ' et #etat-stockage', async (A) => {
  await A.api('stockageDurable');
  if (mode === 'true' || mode === 'false') {
    await A.attendre(() => window.__persistAppels >= 1, null, 2000, 'appel de navigator.storage.persist() au chargement');
    eq(await A.page.evaluate(() => window.__persistAppels), 1, 'nombre d\'appels de persist() au chargement');
  }
  if (attendu !== null) await A.attendre((v) => window.GrilleHaptique.stockageDurable() === v, attendu, 2000, 'stockageDurable() = ' + attendu);
  else await A.page.waitForTimeout(300);
  eq(await A.page.evaluate(() => window.GrilleHaptique.stockageDurable()), attendu, 'stockageDurable()');
  const t = norm(await A.page.evaluate(() => document.getElementById('etat-stockage').textContent));
  assert(/Stockage durable/.test(t) && texteRe.test(t), '#etat-stockage : "' + t + '"');
  eq(await A.page.evaluate(() => document.getElementById('panneau-sessions').contains(document.getElementById('etat-stockage'))), true, '#etat-stockage dans #panneau-sessions');
}, { persist: mode, storage: stockage(jeuDossier(), 'd2') });
DUR('true', true, /oui/); DUR('false', false, /non \(le navigateur peut l'effacer ; utilisez la sauvegarde dans un dossier\)/);
DUR('absent', null, /inconnu/); DUR('sans-persist', null, /inconnu/);

/* ================================================================== */
/* Poids, hygiene, parcours complet                                    */
/* ================================================================== */

statique('Fichier : moins de 350 Ko (358 400 octets)', async () => { const n = fs.statSync(HTML).size; assert(n < 358400, 'taille ' + n + ' octets (limite 358400)'); });
statique('Fichier : aucune URL http:// ou https:// hors http://www.w3.org/', async () => {
  const txt = fs.readFileSync(HTML, 'utf8').split('http://www.w3.org/').join(''); const hits = [];
  txt.split('\n').forEach((l, i) => { if (/https?:\/\//i.test(l)) hits.push((i + 1) + ': ' + l.trim().slice(0, 80)); });
  eq(hits, [], 'occurrences');
});
statique('Fichier : aucun caractere invisible litteral (U+00A0, U+200B a U+200F, U+202F, U+2060, U+FEFF, U+FFFE, U+FFFF)', async () => {
  const txt = fs.readFileSync(HTML, 'utf8'); const hits = []; let ligne = 1;
  for (const ch of txt) {
    const c = ch.codePointAt(0);
    if (c === 0x0A) { ligne++; continue; }
    if (c === 0xA0 || (c >= 0x200B && c <= 0x200F) || c === 0x202F || c === 0x2060 || c === 0xFEFF || c === 0xFFFE || c === 0xFFFF) { hits.push('U+' + c.toString(16).toUpperCase().padStart(4, '0') + ' ligne ' + ligne); if (hits.length >= 5) break; }
  }
  eq(hits, [], 'caracteres interdits');
});
statique('Fichier : ni innerHTML, outerHTML, insertAdjacentHTML ni document.write dans le source (donnees inserees par textContent)', async () => {
  const h = fs.readFileSync(HTML, 'utf8');
  eq([[/innerHTML/, 'innerHTML'], [/outerHTML/, 'outerHTML'], [/insertAdjacentHTML/, 'insertAdjacentHTML'], [/document\s*\.\s*write/, 'document.write']].filter((m) => m[0].test(h)).map((m) => m[1]), [], 'motifs interdits');
});

check('Parcours complet : bilan visuel, dossier, lecture, stockage, themes, impression, vue Participants : aucune erreur console, aucune requete reseau', async (A) => {
  const p = A.page;
  await A.api('bilanVisuel');
  await A.go('session'); await p.fill('#f-code', 'PC1'); await p.fill('#f-session', '3');
  for (const [c, v] of [['T0.1', 2], ['V1.1', 3], ['V2.2', 'NA'], ['V3.1', 1], ['V4.3', 0]]) await AGIR.coter(c, v)(A);
  await AGIR.t2('tonus', 1)(A); await AGIR.physio('fc', 't0', '88')(A); await AGIR.physio('fc', 't1', '95')(A);
  await A.activer(); await A.go('synthese'); await A.fermerPanneau();
  await p.emulateMedia({ colorScheme: 'dark' }); await A.go('synthese'); await p.emulateMedia({ media: 'print' }); await p.emulateMedia({ media: 'screen', colorScheme: 'light' });
  await A.page.evaluate(() => window.GrilleHaptique.ecrireDossier()); await poserFichiers(A); await A.page.evaluate(() => window.GrilleHaptique.lireDossier());
  await A.page.evaluate(() => window.GrilleHaptique.stockageDurable());
  await p.click('#btn-participants'); await p.locator('#vue-participants').waitFor({ state: 'visible' });
  await A.go('synthese'); await A.panneau(); await A.fermerPanneau(); await p.setViewportSize({ width: 360, height: 740 }); await A.go('synthese'); await p.waitForTimeout(200);
}, OPT_D({ persist: 'true', storage: STO_LECTURE() }));

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
        if (c.opts.page === false) await avecDelai(Promise.resolve(c.fn(null)), 30000);
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
