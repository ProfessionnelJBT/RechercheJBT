#!/usr/bin/env node
'use strict';

/*
 * Controle de l'habillage (MODE_OPERATOIRE.md, partie Habillage) : styles calcules de tous les
 * elements HTML visibles sur chaque vue, themes clair et sombre.
 *
 * Usage : node protocole-haptique/tests/direction-artistique.test.js
 * Variable facultative : GRILLE_HTML (autre fichier HTML a tester).
 * Codes de sortie : 0 tout passe, 1 au moins un echec, 2 fichier HTML absent,
 * 3 Playwright ou Chromium inutilisable.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HTML = process.env.GRILLE_HTML
  ? path.resolve(process.env.GRILLE_HTML)
  : path.resolve(__dirname, '..', 'grille-haptique.html');
if (!fs.existsSync(HTML)) { console.error('Fichier HTML introuvable : ' + HTML); process.exit(2); }

const VUES = ['session', 't0', 't1', 't2', 'physio', 'synthese', 'participants', 'fiche', 'sessions'];
const THEMES = ['light', 'dark'];

/* jeu fictif : deux participants, quelques cotations */
const COT = ['T0.1', 'T0.2', 'V1.1', 'V1.2', 'V2.1', 'V3.1', 'V4.1'];
function fictive(id, code, no, date, cond, vals) {
  const cotations = {}; COT.forEach((c, i) => { cotations[c] = vals[i % vals.length]; });
  return { id, cree_le: date + 'T09:00:00.000Z', modifie_le: date + 'T10:00:00.000Z',
    identification: { code_sujet: code, session_no: no, date, condition: cond }, cotations,
    t2: { tonus: { evolution: 1 }, posture: { evolution: 0 }, emotion: { evolution: -1 } } };
}
const SEED = { sessions: [fictive('a1', 'S01', 1, '2026-10-05', 'A', [1, 2, 3, 'NA']), fictive('a2', 'S01', 2, '2026-10-12', 'B', [3, 2, 0, 1]), fictive('b1', 'P7', 1, '2026-10-06', 'C', [2, 3])], courante: 'a2' };

/* balayage dans la page : renvoie les ecarts relevés */
function balayer() {
  const ACCENT = 'rgb(229, 72, 77)';
  const px = (v) => (/%/.test(v) ? 99 : parseFloat(v) || 0);
  const out = { ombre: [], degrade: [], coin: [], accent: [], prim: 0, eyebrow: document.querySelectorAll('.eyebrow').length, fond: '', texte: '', pictos: '', exclam: false };
  const nom = (e) => e.localName + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : '');
  document.querySelectorAll('body *').forEach((e) => {
    if (e instanceof SVGElement || e.getClientRects().length === 0) return;
    const cs = getComputedStyle(e);
    if (cs.boxShadow !== 'none') out.ombre.push(nom(e) + ' ' + cs.boxShadow);
    if (/gradient\(/.test(cs.backgroundImage)) out.degrade.push(nom(e));
    ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].forEach((k) => { if (px(cs[k]) > 2) out.coin.push(nom(e) + ' ' + cs[k]); });
    const prim = e.classList.contains('btn-prim');
    if (prim) out.prim++;
    ['color', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'textDecorationColor'].forEach((k) => { if (cs[k] === ACCENT) out.accent.push(nom(e) + ' ' + k); });
    if (cs.backgroundColor === ACCENT && !prim) out.accent.push(nom(e) + ' backgroundColor');
  });
  out.fond = getComputedStyle(document.body).backgroundColor;
  out.texte = getComputedStyle(document.body).color;
  const t = document.body.innerText;
  out.pictos = (t.match(/\p{Extended_Pictographic}/gu) || []).join('');
  out.exclam = t.indexOf('!') >= 0;
  return out;
}

const mesures = {};
async function mesurer(browser, theme) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
  await ctx.addInitScript((st) => { try { if (!localStorage.getItem('grilleHaptique.v1.sessions')) { localStorage.setItem('grilleHaptique.v1.sessions', JSON.stringify(st.sessions)); localStorage.setItem('grilleHaptique.v1.courante', st.courante); } } catch (e) { /* ignore */ } }, SEED);
  const p = await ctx.newPage();
  for (const v of VUES) {
    await p.goto(pathToFileURL(HTML).href);
    await p.waitForFunction(() => window.GrilleHaptique && typeof window.GrilleHaptique.allerA === 'function');
    if (['participants', 'fiche'].includes(v)) await p.click('#btn-participants');
    else if (v === 'sessions') await p.click('#btn-sessions');
    else await p.evaluate((k) => window.GrilleHaptique.allerA(k), v);
    if (v === 'fiche') await p.click('#table-participants tbody tr button');
    await p.waitForTimeout(150);
    mesures[theme + '/' + v] = await p.evaluate(balayer);
  }
  await ctx.close();
}

const checks = [];
const check = (name, fn) => checks.push({ name, fn });
const parVue = (fn) => () => {
  const mauvais = [];
  Object.keys(mesures).forEach((k) => { const r = fn(mesures[k], k); if (r) mauvais.push(k + ' : ' + r); });
  if (mauvais.length) throw new Error(mauvais.slice(0, 3).join(' | ') + (mauvais.length > 3 ? ' (+' + (mauvais.length - 3) + ')' : ''));
};
const liste = (a) => (a.length ? a.length + ' element(s) : ' + a.slice(0, 3).join(', ') : '');

check('Aucun box-shadow sur les elements visibles (9 vues, 2 themes)', parVue((m) => liste(m.ombre)));
check('Aucun degrade en background-image (9 vues, 2 themes)', parVue((m) => liste(m.degrade)));
check('Coins de 2 px au plus (9 vues, 2 themes)', parVue((m) => liste(m.coin)));
check('Accent #E5484D seulement en fond de .btn-prim (9 vues, 2 themes)', parVue((m) => liste(m.accent)));
check('Au plus un .btn-prim visible par vue', parVue((m) => (m.prim > 1 ? m.prim + ' boutons principaux' : '')));
check('Un .btn-prim par etape et sur la fiche participant, aucun sur la liste Participants', () => {
  VUES.filter((v) => v !== 'sessions').forEach((v) => {
    const attendu = v === 'participants' ? 0 : 1;
    THEMES.forEach((t) => { if (mesures[t + '/' + v].prim !== attendu) throw new Error(t + '/' + v + ' : ' + mesures[t + '/' + v].prim + ' bouton(s) principal(aux), attendu ' + attendu); });
  });
});
check('Aucun element .eyebrow', parVue((m) => (m.eyebrow ? m.eyebrow + ' element(s)' : '')));
check('Theme clair : fond de page #F8F7F4 et texte #141413', () => {
  VUES.forEach((v) => { const m = mesures['light/' + v]; if (m.fond !== 'rgb(248, 247, 244)' || m.texte !== 'rgb(20, 20, 19)') throw new Error(v + ' : ' + m.fond + ' / ' + m.texte); });
});
check('Theme sombre : fond de page #141413 et texte #F8F7F4', () => {
  VUES.forEach((v) => { const m = mesures['dark/' + v]; if (m.fond !== 'rgb(20, 20, 19)' || m.texte !== 'rgb(248, 247, 244)') throw new Error(v + ' : ' + m.fond + ' / ' + m.texte); });
});
check('Aucun emoji ni pictogramme dans le texte visible', parVue((m) => (m.pictos ? 'pictogramme ' + m.pictos : '')));
check('Aucun point d\'exclamation dans le texte visible', parVue((m) => (m.exclam ? 'point d\'exclamation' : '')));

async function main() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { console.error('Playwright introuvable : ' + e.message); process.exit(3); }
  let browser;
  try { browser = await chromium.launch(); } catch (e) { console.error('Chromium ne demarre pas : ' + e.message); process.exit(3); }
  let reussis = 0;
  try {
    for (const t of THEMES) await mesurer(browser, t);
    for (const c of checks) {
      try { c.fn(); reussis++; console.log('OK  ' + c.name); } catch (e) { console.log('ECHEC  ' + c.name + ' : ' + (e && e.message || e)); }
    }
  } catch (e) {
    console.error('Erreur fatale : ' + (e && e.stack || e)); await browser.close(); process.exit(3);
  }
  await browser.close();
  console.log('\n' + reussis + '/' + checks.length + ' reussis');
  process.exit(reussis === checks.length ? 0 : 1);
}
main();
