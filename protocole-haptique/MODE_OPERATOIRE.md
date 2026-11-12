# Grille haptique - mode opératoire et cahier des charges

Saisie numérique du « Protocole d'observation clinique expérimentale : dispositif
haptique » (recherche clinique en psychomotricité). Une fiche par session
d'expérimentation, remplie sur le poste pendant ou juste après la séance.

Livrable : `protocole-haptique/grille-haptique.html`, **un seul fichier**, sans
serveur, sans installation, sans aucune requête réseau. Il s'ouvre par double-clic
(`file://`) sur ordinateur, tablette ou téléphone, et se copie tel quel sur clé USB
ou partage réseau.

---

## A. Mode opératoire en séance

### Avant la séance
1. Ouvrir `grille-haptique.html` dans le navigateur du poste (Chrome, Edge, Firefox, Safari).
2. « Nouvelle session ». Saisir le **code sujet** (code d'anonymat, jamais un nom, un
   prénom ni des initiales), le numéro de session, la condition expérimentale (A, B ou C),
   l'installation posturale. La date est préremplie.
3. Vérifier que la table de correspondance code / identité reste **hors de l'outil**,
   sous la responsabilité de l'investigateur.

### Pendant la séance
4. Étape **T0** (10 min avant équipement) : coter les 5 items, bouton « Maintenant » pour l'heure de début.
5. Étape **T1** (stimulation active) : coter les 4 axes, puis l'épreuve de rupture (arrêt 2 min).
6. Étape **T2** (10 min après retrait) : une évolution par domaine (-1, 0, +1).
7. Étape **Mesures** : reporter les biomarqueurs s'ils sont relevés.

Chaque saisie est enregistrée immédiatement sur le poste. On peut naviguer librement
entre les étapes et revenir corriger.

Aides en séance (aucune ne cote à la place de l'observateur) :
- **Minuteur de phase** dans l'en-tête : T0 10:00, rupture 02:00, T2 10:00 (comptes à
  rebours) ou chronomètre libre. Il propose la phase de l'étape, se choisit à la main, ne
  fait ni son, ni cotation, ni changement d'étape, et reste juste après un rechargement.
- **Annuler** : `Ctrl+Z` (ou `Cmd+Z`) hors champ de texte, ou bouton « Annuler » du message
  qui suit un effacement ou un remplacement (6 s). 20 modifications gardées en mémoire.
  Sur écran tactile, un second toucher dans les 400 ms n'efface pas.
- **Clavier** : `0 1 2 3` (sans Maj sur un clavier AZERTY) et `N` cotent ; flèches pour se
  déplacer, `Retour arrière` ou `Suppr` pour effacer ; « Prochain item non coté » place le
  focus sur le premier item vide.
- **Plusieurs onglets** : les sessions des autres fenêtres sont fusionnées (la plus
  récente gagne) et un bandeau le signale. Si l'enregistrement échoue, « Sauvegarder
  maintenant » exporte la session en JSON et la fermeture de la page demande confirmation.

### Après la séance
8. Étape **Synthèse** : vérifier la liste des items non cotés, lire les scores
   calculés, compléter événements intercurrents et conclusion.
9. « Exporter la session » (fichier `.json`) ou « Imprimer / PDF » pour l'archive.
10. En fin de journée ou de série : « Exporter toutes les sessions (CSV) » pour le
    traitement statistique, puis, sur un poste partagé, « Effacer les données de ce poste ».

### Plusieurs séances pour un même participant
11. À la 2e séance et aux suivantes, saisir le **même code sujet** (la casse n'a pas
    d'importance) : l'étape Session affiche « <code> : n sessions déjà enregistrées ».
12. « Reprendre les champs de la dernière session » remplit sexe, âge, diagnostic,
    installation, observateur et co-évaluateur, **uniquement s'ils sont encore vides**.
13. Autre voie : « Participants et bilans » (en-tête), ouvrir le participant, puis
    « Nouvelle session pour ce participant » : le numéro (dernier + 1) et la date du jour
    sont préremplis. La condition, les heures et les cotations repartent toujours vides.

### Bilan en fin de série
14. « Participants et bilans », choisir le participant : tableau de ses sessions, graphiques
    des scores (condition A cercle, B carré, C triangle), grilles de cotations T0 et T1, T2.
15. « Exporter le bilan (PDF) » ouvre l'impression : choisir « Enregistrer au format PDF »
    comme destination.
16. « Exporter les scores (Excel) » produit un fichier `.xlsx` à deux feuilles (Scores,
    Cotations) pour ce participant ; le même bouton dans la liste exporte tous les participants.
17. Ces fichiers contiennent des données de santé pseudonymisées : les ranger et les
    transmettre comme les exports JSON et CSV. « Retour à la saisie » revient à la grille.

### Où sont les résultats quand l'appli est fermée
- Dans le **stockage du navigateur de ce poste** : les sessions y sont enregistrées à chaque
  modification et y restent à la fermeture de l'onglet ou du navigateur. Elles sont effacées si
  l'on vide les données du navigateur, et elles sont propres à un navigateur et à un poste (un
  autre navigateur, ou le même navigateur sur un autre poste, ne les voit pas). Le panneau
  Sessions indique si le navigateur a accordé un stockage durable.
- Et, si la **sauvegarde dans un dossier** est activée (panneau Sessions, « Choisir un dossier de
  sauvegarde », Chrome ou Edge sur ordinateur), dans ce dossier local : une sauvegarde complète
  et un fichier `.json` par session, rangé dans un sous-dossier par participant.

### Récupérer les résultats
- L'appli n'a ni serveur, ni compte, ni envoi de données, et aucune consultation à distance.
- Pour retrouver des résultats, importer le fichier `.json` (« Importer un fichier JSON »)
  ou le dossier de sauvegarde (« Importer depuis le dossier ») dans l'appli, sur le poste de travail.
- Ces fichiers contiennent des données de santé pseudonymisées : ne pas les partager ni les
  placer dans un stockage en ligne.

### Retrouver, reprendre, afficher en grand
- **Rechercher** : dans « Participants et bilans », le champ « Rechercher un code » filtre la
  liste (tri par code ou par activité récente) ; le panneau Sessions a sa propre recherche
  (code, date jj/mm/aaaa, condition).
- **Reprise rapide** : en tête de l'étape Session, « Sessions récentes » (5 autres sessions)
  ouvre une session à l'étape où il reste à saisir ; « Nouvelle session pour <code> »
  apparaît quand la session courante est vierge.
- **Numéro proposé** : si le code correspond à un participant ayant d'autres sessions et que
  le numéro est vide, le numéro suivant est proposé (jamais d'écrasement).
- **Affichage grand** (bouton d'en-tête, pour tablette) : texte et boutons de cotation
  agrandis, items sur une colonne ; l'impression n'est pas modifiée.

### Ce que l'outil ne fait pas
- Il n'envoie rien : pas de serveur, pas de compte, pas de synchronisation. Le
  transfert entre postes passe par les fichiers exportés (import JSON possible).
- Il n'anonymise pas : âge + sexe + diagnostic + date restent des données de santé
  pseudonymisées. Les fichiers exportés se rangent et se transmettent comme tels.
- Il n'impute pas les valeurs manquantes : un item « NA » ou non coté est compté
  manquant et signalé, le score de l'axe est la somme des items cotés.

---

## B. Cahier des charges de l'application

### B1. Contraintes
- Un seul fichier HTML, CSS et JS en ligne, JavaScript sans bibliothèque ni framework.
- **Aucune ressource externe** : pas de CDN, pas d'image distante, aucun `fetch`. Les polices
  sont incorporées en `data:font/woff2;base64` (quatre `@font-face`). Doit fonctionner hors
  ligne en `file://`.
- Poids inférieur à **300 Ko (307 200 octets)**. Polices : IBM Plex Sans (corps, 15 px), IBM Plex
  Mono (500 et 600 : étiquettes, valeurs) et Newsreader (titres), repli `system-ui`.
- Interface entièrement en français, `<html lang="fr">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Adaptatif de 360 px à l'écran large, sans défilement horizontal. Cibles tactiles d'au moins 44 px.
- Accessible : libellés associés, focus visible, contraste AA, `prefers-reduced-motion` respecté, thème clair et sombre (`prefers-color-scheme`).
- Tout texte saisi est inséré par `textContent` ou `value`, jamais par `innerHTML` (pas de XSS, y compris à l'import).
- Hygiène du dépôt : pas d'Unicode invisible ni d'espaces exotiques, pas de bannière ni de commentaire d'attribution dans le code.
- Identité visuelle : charte de l'application de pilotage. Jetons sur `:root` (clair), redéfinis
  en sombre (`prefers-color-scheme`, `data-theme="dark"`) : fond `--ground #eef1f0`, encre
  `--ink #14201f`, pétrole `--teal #0e6b62` (actions, acquis), `--teal-deep #0a4a44`,
  `--teal-soft #d5e6e3`, ocre `--ochre #b3741b` (partiel, mentions), bleu marine `--marine #2f2c62`
  (logo, conditions B et C). La rouille n'est jamais utilisée pour les données de l'étude.
  Rayons 5 / 9 / 14 px. Marque : « J-B Thiéry », étiquette mono « HAPTIQUE », titre Newsreader ;
  mention de confidentialité en bas de la vue (et à l'impression) ; titres d'étape en Newsreader
  sous une étiquette mono capitales.
- Ces contraintes valent aussi pour la partie C (participants, bilans, exports), qui
  s'ajoute à B sans en modifier aucun contrat. Limite de poids inchangée : voir l'introduction de C.

### B2. Parcours
Six étapes, navigation libre (aucune étape verrouillée) :

| Clé | Libellé | Contenu |
|---|---|---|
| `session` | Session | Identification et contexte expérimental |
| `t0` | T0 | Ligne de base, 5 items |
| `t1` | T1 | Axes 1 à 4 (14 items) + épreuve de rupture |
| `t2` | T2 | Rémanence et post-effet, 4 domaines |
| `physio` | Mesures | Biomarqueurs, 4 mesures x 4 temps |
| `synthese` | Synthèse | Scores, items manquants, commentaires, exports |

- En-tête compact et fixe, sur une ligne (72 px au plus à 1280 px, 104 px à 390 px) : marque,
  résumé de la session courante (code, n° de session, date, condition), minuteur de phase,
  état « Enregistré à hh:mm », boutons « Participants et bilans » et « Sessions ».
- Barre d'étapes avec compteur d'avancement pour `t0`, `t1`, `t2` (ex. « T1 9/14 » ;
  un item coté NA compte comme renseigné).
- Boutons « Précédent » / « Suivant » en bas de page.
- Rappel de l'échelle de cotation (les 5 ancres) visible en tête des étapes `t0` et `t1`.
- Une seule étape affichée à la fois ; changer d'étape remonte en haut de page et place le
  focus sur le titre de l'étape. Sous 720 px, la barre d'étapes est fixée en bas de l'écran.

### B3. Champs de l'étape Session

| Champ | Sélecteur | Type et règles |
|---|---|---|
| Code sujet | `#f-code` | texte, obligatoire, 12 caractères max, `[A-Za-z0-9_-]` uniquement ; aide : « Code d'anonymat, jamais de nom ni d'initiales » |
| Session n° | `#f-session` | entier >= 1 |
| Date | `#f-date` | `type="date"`, préremplie à la date du jour |
| Âge | `#f-age` | entier 0 à 120, suffixe « ans » |
| Sexe | `input[name="sexe"]` | radio, valeurs `F`, `M` |
| Heure de début | `#f-debut` | `type="time"`, bouton « Maintenant » `#btn-debut-maintenant` |
| Heure de fin | `#f-fin` | `type="time"`, bouton « Maintenant » `#btn-fin-maintenant` |
| Diagnostic / étiologie | `#f-diagnostic` | texte libre |
| Observateur principal | `#f-observateur` | texte court ; aide : « code ou fonction » |
| Co-évaluateur (fidélité) | `#f-coeval` | texte court |
| Installation posturale | `input[name="installation"]` | radio, valeurs `corset` (Corset-siège), `fauteuil` (Fauteuil roulant confort), `matelas` (Matelas positionnement / Sol), `autre` (Autre) |
| Précision « autre » | `#f-installation-autre` | texte, affiché seulement si `autre` |
| Condition expérimentale | `input[name="condition"]` | radio, obligatoire, valeurs `A`, `B`, `C` (libellés ci-dessous) |

Conditions :
- **Cond. A (Témoin)** : Sans stimulation (gilet éteint/absent)
- **Cond. B (Gilet actif)** : Stimulation vibrotactile et proprioceptive seule
- **Cond. C (Multisensorielle)** : Gilet actif + immersion sensorielle (Snoezelen)

« Obligatoire » ne bloque jamais la navigation ni l'enregistrement : le manque est
signalé dans l'étape Synthèse.

### B4. Échelle de cotation
- **0** : Absence / Non observé (aucune manifestation)
- **1** : Faible / Transitoire (< 25 % du temps, fugitive)
- **2** : Modéré / Intermittent (25 % à 75 %, nette/reproductible)
- **3** : Majeur / Soutenu (> 75 %, réponse dominante)
- **NA** : Non applicable / Non évaluable

Contrôle de cotation d'un item : groupe de 5 boutons `0 1 2 3 NA`,
`button[data-rate="<code>"][data-val="0|1|2|3|NA"]`, `aria-pressed="true"` sur le
bouton choisi, conteneur `role="group"` avec libellé. Un clic choisit ; un second clic
sur le bouton déjà choisi efface la cotation. Au clavier, quand le focus est dans un
item : touches `0`, `1`, `2`, `3`, `N` cotent, et le focus passe à l'item suivant.

Chaque item affiche : code, intitulé (gras), marqueurs (petit, atténué), les 5 boutons,
et une zone d'observation `textarea[data-obs="<code>"]` (une ligne, s'agrandit à la saisie).
Conteneur d'item : `[data-item="<code>"]`.

### B5. Items

**T0 - Ligne de base (10 min pré-équipement)** - observation libre de phase : `textarea[data-obs="T0"]` (« Observations cliniques qualitatives T0 »)

| Code | Intitulé | Marqueurs |
|---|---|---|
| T0.1 | Hypertonie & spasticité | Résistance passive, poings fermés, rétractions |
| T0.2 | Effondrement axial & hypotonie | Perte de l'axe médian, tassement postural |
| T0.3 | Signes neurovégétatifs de stress | Respiration rapide/saccadée, sueurs, pâleur |
| T0.4 | Vigilance & ouverture spontanée | Balayage visuel, poursuite, orientation tête |
| T0.5 | Réceptivité au toucher thérapeutique | Accueil passif, tolérance sans recul ni crispation |

**T1 - Axe 1 : Régulation Tonico-Émotionnelle et Axe Corporel** - `textarea[data-obs="AXE1"]`

| Code | Intitulé | Marqueurs |
|---|---|---|
| V1.1 | Détente neuromusculaire périphérique | Ouverture des mains, relâchement des fléchisseurs, diminution de l'agrippement |
| V1.2 | Organisation & redressement de l'axe médian | Réinvestissement de l'axe vertical, alignement tête-tronc, diminution du tassement |
| V1.3 | Modulation respiratoire | Passage en respiration abdomino-diaphragmatique, ralentissement et régularité |
| V1.4 | Intolérance sensorielle ou défense tactile | Schèmes d'évitement, sursauts, mise en tension corporelle, gémissements |

V1.4 porte une étiquette visible « Score inversé ».

**T1 - Axe 2 : Intégration Somatosensorielle et Conscience Corporelle** - `textarea[data-obs="AXE2"]`

| Code | Intitulé | Marqueurs |
|---|---|---|
| V2.1 | Investissement des appuis postérieurs | Relâchement sur dossier/fond d'assise, abandon des tensions de posture |
| V2.2 | Gestes autocentrés & auto-contacts | Mains portées vers le buste, exploration tactile du gilet ou du tronc |
| V2.3 | Orientation attentionnelle vers l'éprouvé corporel | Regard dirigé vers le tronc, ralentissement moteur d'écoute interne |
| V2.4 | Manifestation de causalité & recherche du stimulus | Réaction orientée vers la source vibratoire, proactivité motrice |

**T1 - Axe 3 : Disponibilité Cognitive et Attentionnelle** - `textarea[data-obs="AXE3"]`

| Code | Intitulé | Marqueurs |
|---|---|---|
| V3.1 | Maintien de la fixation visuelle | Fixation continue vers le thérapeute, l'objet médiateur ou un stimulus |
| V3.2 | Inhibition motrice des décharges parasites | Réduction des stéréotypies motrices, myoclonies, agitation motrice non finalisée |
| V3.3 | Stabilité de l'état d'éveil | Maintien éveil calme, absence de bascule vers hyperexcitabilité / somnolence |

V3.1 a en plus un champ « Durée max continue » `#f-v31-duree` (nombre, secondes).

**T1 - Axe 4 : Dialogue Tonico-Émotionnel et Intersubjectivité** - `textarea[data-obs="AXE4"]`

| Code | Intitulé | Marqueurs |
|---|---|---|
| V4.1 | Accrochage et maintien du regard | Regard soutenu et signifiant vers le thérapeute en lien avec l'éprouvé corporel |
| V4.2 | Ajustement tonique à la mobilisation | Corps malléable, disponibilité à la manipulation sans résistance d'opposition |
| V4.3 | Synchronie émotionnelle et expressivité | Mimiques d'apaisement, sourires-réponses, vocalisations modulées |

**T1 - Épreuve de Rupture (arrêt inopiné du dispositif pendant 2 minutes)**
Cases à cocher, plusieurs possibles, `input[type="checkbox"][data-rupture="<clé>"]` :

| Clé | Libellé |
|---|---|
| `surprise` | Réaction de surprise / orientation vers le corps |
| `recherche` | Recherche active ou posture d'attente motrice |
| `reprise` | Reprise immédiate des décharges ou de la désorganisation motrice |
| `indifference` | Indifférence / absence de modification observable |

Commentaire `#f-rupture-commentaire` : « Commentaires cliniques & chronologie (délai de
réaction, réapparition des signes initiaux, vocalises, etc.) ».

**T2 - Rémanence et post-effet (10 minutes post-retrait)** - évolution par rapport à T0.
Radios `input[name="t2-<clé>"]` de valeurs `-1`, `0`, `1` ; détails `textarea[data-t2="<clé>"]`.
Comme pour les cotations, re-cliquer le choix actif l'efface.

| Clé | Domaine | -1 | 0 | +1 |
|---|---|---|---|---|
| `tonus` | 1. Tonus de fond | Spasticité / Hypertonie accrue | Inchangé | Relâchement persistant |
| `posture` | 2. Organisation posturale & appuis | Effondrement / perte des appuis | Inchangé | Maintien de l'alignement & tenue |
| `emotion` | 3. État émotionnel global | Insécurité, agitation, pleurs | Neutre, retour état habituel | Apaisé, sécurisé, détendu |
| `relation` | 4. Disponibilité relationnelle | Repli sur soi, rupture contact | Identique à T0 | Facilitée (regard accrocheur) |

**Mesures physiologiques** - `input[data-physio="<mesure>"][data-temps="<temps>"]`,
`inputmode="decimal"`, virgule ou point acceptés, valeur vide autorisée.

| Mesure | Libellé | Unité |
|---|---|---|
| `fc` | Fréquence Cardiaque Moyenne (FC) | bpm |
| `vfc` | Variabilité FC (VFC / RMSSD) | ms |
| `ced` | Conductance Cutanée (Électrodermale) | µS |
| `spo2` | Saturation en Oxygène (SpO2) | % |

Temps : `t0` (T0 Baseline), `t1` (T1 Stimulation), `rupture` (T1-Rupture 2 min), `t2` (T2 +10 min post).
Sur écran étroit le tableau devient une suite de cartes (une par mesure), pas un tableau qui déborde.

**Synthèse**
- `#f-evenements` : « Événements intercurrents et biais expérimentaux (bruits parasites,
  manipulation extérieure, inconfort thermique, artefact...) »
- `#f-conclusion` : « Conclusion clinique et verbatim équipe / proches (retours des
  accompagnants, état général de sortie, ressenti global...) »
- Liste « À compléter » : champs obligatoires vides et items **non cotés** (pas les NA),
  chaque ligne ramène à l'étape et à l'item concernés.

### B6. Scores composites T1
Valeur d'un item : 0 à 3 s'il est coté ; **manquant** s'il est NA ou non coté.

| Score | Sélecteur | Formule | Maximum |
|---|---|---|---|
| Axe 1 - Régulation Tonique | `#score-axe1` | V1.1 + V1.2 + V1.3 - V1.4 | 9 |
| Axe 2 - Conscience Corporelle et Appuis | `#score-axe2` | V2.1 + V2.2 + V2.3 + V2.4 | 12 |
| Axe 3 - Disponibilité Attentionnelle | `#score-axe3` | V3.1 + V3.2 + V3.3 | 9 |
| Axe 4 - Dialogue Tonico-Émotionnel | `#score-axe4` | V4.1 + V4.2 + V4.3 | 9 |
| Indice global d'efficience clinique | `#score-total` | somme des 4 axes | 39 |

- Un terme manquant est ignoré (ni ajouté, ni soustrait). Aucune imputation, aucun prorata.
- Axe dont tous les items sont manquants : score `null`, affiché « - ».
- Total : somme des axes non nuls ; `null` si les quatre le sont.
- Chaque élément de score contient **uniquement le nombre** (ou « - ») en `textContent`,
  le « / 9 » est dans un élément voisin. Attribut `data-manquants="<n>"` sur l'élément ;
  si n > 0, mention visible « incomplet : n item(s) non coté(s) ou NA ».
- Les items T0 n'entrent dans aucun score.
- Recalcul immédiat à chaque cotation.

### B7. Données, enregistrement, sessions
- Enregistrement automatique à chaque modification dans `localStorage` :
  `grilleHaptique.v1.sessions` (tableau JSON des sessions) et `grilleHaptique.v1.courante` (id).
- Si `localStorage` est indisponible : bandeau permanent « Enregistrement automatique
  indisponible sur ce navigateur : exportez la session avant de fermer », l'outil reste utilisable en mémoire.
- Au premier lancement, une session vide est créée et l'étape Session s'affiche.
  Au rechargement, la session courante et l'étape affichée sont restaurées.
- Panneau « Sessions » (`#btn-sessions`, panneau `#panneau-sessions`) : liste triée par
  date décroissante (code, n°, date, condition, total), ouvrir, supprimer (avec confirmation), et :

| Action | Sélecteur |
|---|---|
| Nouvelle session | `#btn-nouvelle` |
| Exporter la session courante (JSON) | `#btn-export-json` |
| Exporter toutes les sessions (CSV) | `#btn-export-csv` |
| Sauvegarde complète (JSON, toutes les sessions) | `#btn-export-tout` |
| Importer un fichier JSON | `#btn-import-json` + `input[type="file"]#in-import` |
| Imprimer / PDF | `#btn-imprimer` |
| Effacer les données de ce poste | `#btn-effacer-tout` (confirmation explicite) |

Les actions `#btn-export-json`, `#btn-export-csv` et `#btn-imprimer` sont aussi présentes
dans l'étape Synthèse (mêmes fonctions ; les identifiants ci-dessus restent uniques,
ceux de la Synthèse portent le suffixe `-synthese`).

- Import : accepte une session seule ou une sauvegarde complète ; fusion par `id`
  (la plus récente `modifie_le` l'emporte) ; fichier invalide = message d'erreur, rien n'est modifié.
- Confirmations par `window.confirm`.

Session (schéma `grille-haptique/1`) :

```json
{
  "schema": "grille-haptique/1",
  "id": "identifiant unique",
  "cree_le": "2026-11-12T09:30:00.000Z",
  "modifie_le": "2026-11-12T10:05:00.000Z",
  "identification": {
    "code_sujet": "S01", "session_no": 3, "date": "2026-11-12",
    "age": 14, "sexe": "F", "heure_debut": "09:30", "heure_fin": "10:15",
    "diagnostic": "", "observateur": "", "co_evaluateur": "",
    "installation": "corset", "installation_autre": "", "condition": "B"
  },
  "cotations": { "T0.1": 2, "T0.2": "NA", "V1.1": null },
  "observations": { "T0.1": "", "T0": "", "AXE1": "" },
  "v31_duree_sec": null,
  "rupture": { "surprise": false, "recherche": false, "reprise": false, "indifference": false, "commentaire": "" },
  "t2": {
    "tonus": { "evolution": 1, "details": "" }, "posture": { "evolution": null, "details": "" },
    "emotion": { "evolution": null, "details": "" }, "relation": { "evolution": null, "details": "" }
  },
  "physio": {
    "fc": { "t0": 92, "t1": null, "rupture": null, "t2": null },
    "vfc": { "t0": null, "t1": null, "rupture": null, "t2": null },
    "ced": { "t0": null, "t1": null, "rupture": null, "t2": null },
    "spo2": { "t0": null, "t1": null, "rupture": null, "t2": null }
  },
  "synthese": { "evenements": "", "conclusion": "" },
  "scores": {
    "axe1": null, "axe2": null, "axe3": null, "axe4": null, "total": null,
    "manquants": { "axe1": 4, "axe2": 4, "axe3": 3, "axe4": 3, "total": 14 }
  }
}
```

`cotations` contient les 19 codes (5 T0 + 14 T1), chacun valant `0`, `1`, `2`, `3`, `"NA"` ou `null`.
Sauvegarde complète : `{ "schema": "grille-haptique/1", "exporte_le": "...", "sessions": [ ... ] }`.

### B8. Exports
Noms de fichiers :
- session : `grille-haptique_<code>_S<n>_<date>.json` (parties vides remplacées par `x`)
- CSV : `grille-haptique_sessions_<AAAA-MM-JJ>.csv`
- sauvegarde : `grille-haptique_sauvegarde_<AAAA-MM-JJ>.json`

**CSV** (une ligne par session, pour tableur français) : séparateur `;`, BOM UTF-8,
fins de ligne CRLF, décimales avec virgule, champ entre guillemets s'il contient `;`,
`"` ou un saut de ligne (guillemets doublés). Cotation NA = `NA`, non cotée = vide,
case cochée = `1` sinon `0`. Un champ **texte libre** commençant par `=`, `+`, `-` ou `@`
est préfixé d'une apostrophe (pas d'injection de formule). Colonnes, dans cet ordre :

```
id;cree_le;modifie_le;code_sujet;session_no;date;age;sexe;heure_debut;heure_fin;
diagnostic;observateur;co_evaluateur;installation;installation_autre;condition;
T0.1;T0.2;T0.3;T0.4;T0.5;
V1.1;V1.2;V1.3;V1.4;V2.1;V2.2;V2.3;V2.4;V3.1;V3.2;V3.3;v31_duree_sec;V4.1;V4.2;V4.3;
rupture_surprise;rupture_recherche;rupture_reprise;rupture_indifference;
t2_tonus;t2_posture;t2_emotion;t2_relation;
fc_t0;fc_t1;fc_rupture;fc_t2;vfc_t0;vfc_t1;vfc_rupture;vfc_t2;
ced_t0;ced_t1;ced_rupture;ced_t2;spo2_t0;spo2_t1;spo2_rupture;spo2_t2;
score_axe1;score_axe2;score_axe3;score_axe4;score_total;
manquants_axe1;manquants_axe2;manquants_axe3;manquants_axe4;manquants_total;
obs_T0;obs_AXE1;obs_AXE2;obs_AXE3;obs_AXE4;rupture_commentaire;
t2_tonus_details;t2_posture_details;t2_emotion_details;t2_relation_details;
evenements;conclusion;
obs_T0.1;obs_T0.2;obs_T0.3;obs_T0.4;obs_T0.5;
obs_V1.1;obs_V1.2;obs_V1.3;obs_V1.4;obs_V2.1;obs_V2.2;obs_V2.3;obs_V2.4;
obs_V3.1;obs_V3.2;obs_V3.3;obs_V4.1;obs_V4.2;obs_V4.3
```

(les retours à la ligne ci-dessus sont de présentation : l'en-tête tient sur une ligne, sans `;` final).

**Impression / PDF** : `@media print` affiche **toutes** les étapes de la session
courante à la suite, format A4, mise en page de la grille papier (bandeaux sarcelle,
tableaux, cotation choisie bien visible), sans barre d'étapes ni boutons.

### B9. Interface de test
L'application expose `window.GrilleHaptique` :
- `etat()` : copie de la session courante (objet du schéma, scores à jour)
- `sessions()` : copie du tableau des sessions
- `calculerScores(session)` : renvoie l'objet `scores` sans modifier la session
- `versCSV(sessions)` : chaîne CSV complète (BOM inclus)
- `allerA(cleEtape)` : affiche l'étape

Boutons d'étape : `button[data-step="session|t0|t1|t2|physio|synthese"]`, `aria-current="step"` sur l'étape active.
Sections d'étape : `section[data-panel="<clé>"]`, l'attribut `hidden` sur celles qui ne sont pas affichées.
Navigation : `#btn-precedent`, `#btn-suivant`. État d'enregistrement : `#etat-enregistrement`.

Extensions de la partie C, sans rien modifier de ce qui précède : `participants()`,
`bilan(code)`, `xlsxOctets(portee)` et `ouvrirParticipants(code?)` (spécification en C6).

### B10. Vérification
`node protocole-haptique/tests/grille.test.js` (Playwright, Chromium) ouvre le fichier
en `file://` et contrôle : aucune requête réseau, parcours complet, calcul des scores
(dont score inversé, NA, tout manquant), persistance après rechargement, exports JSON
et CSV, import, absence de défilement horizontal à 360 px, non-exécution d'un texte
saisi contenant du HTML.

La partie C ajoute ses propres vérifications (regroupement par participant, modèle du
bilan, SVG, impression, fichier `.xlsx`) : cas chiffrés en C7. La suite existante doit
rester entièrement verte, sans modification.

---

## C. Participants, bilans et exports

Un **participant** est l'ensemble des sessions portant le même code sujet. La partie C
ajoute : la notion de participant (dérivée, jamais stockée), la reprise des champs stables
d'une session à la suivante, une vue « Participants et bilans », un bilan graphique en
SVG écrit à la main, une sortie PDF (impression) et un export Excel `.xlsx` sans
bibliothèque. Elle **ajoute sans rien modifier** : sélecteurs, schéma `grille-haptique/1`,
colonnes CSV, clés `localStorage` (aucune nouvelle clé) et panneau Sessions des parties A
et B restent identiques. Les suites de tests existantes doivent rester vertes.

### Contraintes de la partie C

| Sujet | Règle |
|---|---|
| Fichier | Toujours un seul fichier `grille-haptique.html`, hors ligne, sans requête réseau (seuls `Blob` et `URL.createObjectURL` pour les téléchargements). |
| Poids | Limite commune de l'application : **300 Ko (307 200 octets)**, polices incorporées comprises (voir B1). |
| Construction du DOM | `createElement` / `createElementNS` avec `setAttribute` et `textContent`. Interdits, y compris pour le SVG : `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`. Le XML du `.xlsx` est assemblé en chaînes puis encodé par `TextEncoder` ; il n'entre jamais dans le DOM. |
| URL dans le source | Un test existant interdit toute sous-chaîne `http://` ou `https://` hors `http://www.w3.org/` (espace de noms SVG, autorisé). Les espaces de noms OOXML (`schemas.openxmlformats.org`) doivent donc être **assemblés par concaténation** (par exemple `"http:" + "//schemas.openxmlformats.org/..."`), jamais écrits d'un bloc. Idem pour toute autre URL. |
| Pas de `fetch`, `XMLHttpRequest`, `@import`, `<script src>`, `<link href>` ; `@font-face` seulement en `data:font/woff2` (quatre) | Contrôlé par un test existant. |
| Identifiants réservés | Ne créer aucun `section[data-panel]` ni aucun `button[data-step]`. Ne pas employer comme noms d'attribut : `data-rate`, `data-val`, `data-item`, `data-obs`, `data-t2`, `data-ouvrir`, `data-supprimer`, `data-id`, `data-etape`, `data-champ`, `data-physio`, `data-temps`, `data-rupture`. Les attributs de la partie C sont tous listés ci-dessous. |
| Accessibilité | Boutons de la vue d'au moins 44 px de haut (le bouton d'en-tête reprend le gabarit de `#btn-sessions`), libellés, focus visible, contraste AA, thèmes clair et sombre, aucune animation nouvelle. Tout champ `input`, `textarea` ou `select` ajouté a un libellé (aucun n'est prévu). |
| Texte | Pas d'Unicode invisible ni d'espace insécable ; apostrophes droites ; pas de commentaire d'attribution. |
| Classes CSS | Libres, sauf celles citées explicitement comme contrat (`cot-0` à `cot-3`, `cot-na`, `cot-vide`, `t2-neg`, `t2-zero`, `t2-pos`, `t2-vide`, `hachure`, `m-A`, `m-B`, `m-C`, `m-X`, `hors-impression`, `avertissement-sante`, `graphique-defil`, `graphique`, `grille-scores`, `tableau-cartes`). |

### C1. Modèle et règles

**C1.1 Définitions**

| Notion | Règle |
|---|---|
| Participant | Sessions dont `identification.code_sujet` est identique après `toLowerCase()`. Dérivé à chaque appel à partir du tableau plat `sessions` ; rien n'est ajouté au schéma ni au stockage. Les anciens exports s'importent inchangés. |
| Clé (`cle`) | `code_sujet.toLowerCase()`. Les codes sont limités à `[A-Za-z0-9_-]` (B3) : aucune normalisation d'accents. |
| Groupe « (sans code) » | Sessions dont le code est vide : `cle` = `""`, `code` = `""`, `libelle` = `(sans code)`. Aucun code réel ne peut valoir « (sans code) » (espace et parenthèses sont filtrés). |
| Graphie affichée (`code`) | Graphie (casse) du `code_sujet` de la session du groupe dont `modifie_le` est la plus récente (comparaison numérique par `Date.parse`) ; à égalité, la session la plus tard dans le tableau `sessions`. |
| Libellé (`libelle`) | `code` s'il est non vide, sinon `(sans code)`. Texte employé partout à l'écran. |

**C1.2 Ordre chronologique des sessions d'un participant** (tri stable, clés successives) :
1. `date` croissante (chaînes `AAAA-MM-JJ`) ; une date vide passe **après** toute date renseignée ;
2. `session_no` croissant ; un numéro `null` passe après tout numéro ;
3. `cree_le` croissant (comparaison numérique par `Date.parse`) ;
4. à égalité complète, l'ordre du tableau `sessions`.

Le **rang** d'une session est sa position 1, 2, 3... dans cet ordre. Il ne dépend jamais de `session_no`.

**C1.3 Ordre des participants** : `cle` croissante par comparaison d'unités de code
(opérateur `<`, pas de `localeCompare`, pour un résultat indépendant de la langue du
navigateur) ; le groupe « (sans code) » toujours en dernier.

**C1.4 Valeurs dérivées d'un participant**

| Valeur | Règle |
|---|---|
| `nb_sessions` | nombre de sessions du groupe |
| `premiere_date`, `derniere_date` | plus petite et plus grande `date` **non vide** (chaîne `AAAA-MM-JJ`), `null` si toutes sont vides |
| `conditions` | conditions rencontrées, sans doublon, **dans l'ordre A, B, C**, condition vide ignorée ; tableau vide possible |

**C1.5 Nouvelle session pour un participant** (bouton `#btn-nouvelle-pour-participant`, C2) crée
une session `vierge()` puis y écrit :

| Champ | Valeur |
|---|---|
| `code_sujet` | la graphie affichée du participant (`code`) |
| `session_no` | maximum des `session_no` non nuls du groupe + 1 ; `1` si aucun (le maximum, pas le nombre de sessions : numéros 1, 2, 7 donnent 8) |
| `date` | date du jour, locale du poste (`aujourdhui()`) |
| `sexe`, `diagnostic`, `installation`, `installation_autre`, `observateur`, `co_evaluateur`, `age` | copie telle quelle de la **dernière session au sens de C1.2** (et non de la plus récemment modifiée) |
| tout le reste | vierge : `condition` vide, heures vides, 19 cotations `null`, observations vides, `v31_duree_sec` `null`, rupture décochée, T2 vide, physio `null`, synthèse vide, scores recalculés (tous `null`) |

Nouvel `id`, `cree_le` et `modifie_le` à l'instant présent. La session devient la courante
et est enregistrée immédiatement (comme `#btn-nouvelle`, B7), même si on l'abandonne ensuite.

**C1.6 Aide à la reprise dans l'étape Session.** Quand le code saisi dans `#f-code` correspond
à un participant ayant **d'autres sessions que la session courante**, l'étape Session
affiche l'aide ci-dessous, mise à jour à chaque frappe, à chaque changement de session
courante et à chaque `remplir()`.

| Élément | Sélecteur | Règle |
|---|---|---|
| Bloc | `#aide-participant` | `role="status"`, placé sous l'aide du champ code (`#f-code-aide`), attribut `hidden` quand n = 0 ou code vide. |
| Texte | `#aide-participant-texte` | `<code> : n sessions déjà enregistrées` (singulier : `<code> : 1 session déjà enregistrée`). `<code>` est le texte du champ `#f-code`. n = nombre de sessions du groupe **sans compter la session courante**. |
| Bouton | `#btn-reprendre-champs` | « Reprendre les champs de la dernière session » (44 px). Source : dernière session au sens de C1.2 parmi les autres sessions du groupe. |
| Retour | `#aide-participant-retour` | Après clic : « 5 champs repris », « 1 champ repris » ou « Aucun champ à reprendre ». Vidé dès que le texte principal change. |

Le clic ne remplit que les champs **encore vides** de la session courante : `sexe` vide,
`diagnostic` / `observateur` / `co_evaluateur` vides ou blancs (après `trim`), `installation`
vide, `age` `null`, et `installation_autre` vide **seulement si** l'installation finale est
`autre`. Il ne touche jamais `code_sujet`, `session_no`, `date`, `condition`, les heures ni
les cotations. Une valeur vide dans la session source n'est jamais copiée. Le compteur du
retour est le nombre de champs effectivement écrits (au plus 7).

**C1.7 Cas limites**

| Situation | Comportement attendu |
|---|---|
| Participant sans aucune date | `premiere_date` et `derniere_date` `null` ; ordre par `session_no` puis `cree_le` ; étiquette de date « ? » dans les graphiques ; méta « dates non renseignées » (C2) |
| Quelques dates vides | Ces sessions en dernier (C1.2) ; période calculée sur les dates renseignées |
| Deux sessions à la même date | Départagées par `session_no`, puis `cree_le`, puis ordre du tableau |
| Une seule session | Bilan complet : graphiques à un point sans segment, une colonne par grille, une ligne au tableau |
| Aucune cotation | Scores `null`, points sans marqueur, cases vides, `data-vide="true"` (C3.7), ligne Excel avec cellules de score vides |
| Code vide | Groupe « (sans code) » ; il existe toujours au premier lancement (session vierge) |
| Casse | `S01`, `s01` et `S01` forment un seul participant ; graphie selon C1.1 |
| `session_no` en double ou `null` | Accepté ; l'identité d'une session est son `id`, jamais son numéro. Étiquette `S?` si `null` |
| Condition vide | Marqueur « losange » gris avec la lettre `?` (C3.5) |
| Suppression de la dernière session d'un participant | Le participant disparaît (dérivé) ; si sa fiche était ouverte, retour à la liste |
| Plus de 30 sessions | Aucune limite codée ; la lisibilité est exigée jusqu'à 30 (C3.8) |
| État de la vue | Non persistée : un rechargement revient à la saisie ; aucune clé `localStorage` nouvelle |

### C2. Vue « Participants et bilans »

**C2.1 Emplacement et ouverture**

| Élément | Sélecteur | Règle |
|---|---|---|
| Bouton d'en-tête | `#btn-participants` | « Participants et bilans », juste avant `#btn-sessions`, même classe et même gabarit. `aria-current="page"` tant que la vue est ouverte, sinon l'attribut est absent. |
| Vue | `#vue-participants` | `<section aria-labelledby="titre-participants" hidden>`, placée entre `<header>` et `<main>`, avec la même largeur maximale et les mêmes marges que `main`. **Sans attribut `data-panel`.** |
| Titre | `#titre-participants` | `<h2 tabindex="-1">` « Participants et bilans », toujours visible dans la vue. |
| Retour à la saisie | `#btn-retour-saisie` | « Retour à la saisie », toujours visible dans la vue (liste et fiche). |
| Message | `#message-participants` | `<p role="status">`, vide par défaut ; reçoit les confirmations d'export. |
| Liste | `#participants-liste` | sous-vue « liste » (C2.2) |
| Fiche | `#participant-detail` | sous-vue « fiche d'un participant » (C2.3) ; une seule des deux sous-vues est visible (l'autre porte `hidden`). |

Ouvrir la vue (clic sur `#btn-participants` ou `ouvrirParticipants()`) : l'attribut `hidden`
est posé sur `#contenu`, `#barre-etapes` et `.nav-bas` ; il est retiré de `#vue-participants` ;
la page remonte en haut ; le focus va sur `#titre-participants` (liste) ou `#participant-titre`
(fiche). L'en-tête reste affiché, avec `#btn-sessions` et le panneau Sessions (qui s'ouvre
par-dessus la vue, piège de focus inchangé). Le résumé de la session courante de l'en-tête
(`#resume-session`) est inchangé. Les sections `section[data-panel]` conservent leur état.

Quitter la vue (clic sur `#btn-retour-saisie`) : l'attribut `hidden` est retiré de
`#contenu`, `#barre-etapes` et `.nav-bas`, posé sur `#vue-participants` ; `aria-current` est
retiré de `#btn-participants` ; le focus revient sur `#btn-participants`. L'étape et la
session courante sont inchangées. La vue est aussi quittée, sans autre effet, par :
`window.GrilleHaptique.allerA(cle)` (avant d'afficher l'étape), `#btn-nouvelle` et « Ouvrir »
dans le panneau Sessions, `#btn-imprimer` (impression de session, avant `window.print()`) et
« Effacer les données de ce poste ». Une suppression ou un import depuis le panneau Sessions
alors que la vue est ouverte la **met à jour** (C2.4) sans la quitter.

**C2.2 Sous-vue liste (`#participants-liste`)**

| Élément | Sélecteur | Contenu |
|---|---|---|
| Compteur | `#participants-compte` | `<p>` : « 6 participants, 12 sessions » (singulier « 1 participant », « 1 session ») |
| Tableau | `#table-participants` | `aria-label="Participants"`. Colonnes : Code, Sessions, Première date, Dernière date, Conditions. Une ligne `tr[data-participant="<cle>"]` par participant, dans l'ordre C1.3 (`data-participant=""` pour « (sans code) »). |
| Cellules | `td[data-col="code"]`, `"nb"`, `"premiere"`, `"derniere"`, `"conditions"` | `code` : un bouton `button[data-ouvrir-participant="<cle>"]` dont le texte est le `libelle` (zone tactile 44 px) ; `nb` : entier ; dates : `jj/mm/aaaa` ou `-` ; `conditions` : lettres jointes par « , » (« A, B, C ») ou `-`. |
| Export global | `#btn-xlsx-tous` | « Exporter tous les participants (Excel) » (C5, portée tous) |
| Avertissement | `#avertissement-liste` | classe `avertissement-sante`, texte exact : « Ces fichiers contiennent des données de santé pseudonymisées : à ranger et à transmettre comme telles. » Même texte, pas de variante. |

Clic sur un bouton `data-ouvrir-participant` : affiche la fiche de ce participant.

**C2.3 Sous-vue fiche (`#participant-detail`)**, dans cet ordre :

| Élément | Sélecteur | Contenu |
|---|---|---|
| Retour à la liste | `#btn-retour-liste` | « Tous les participants » |
| Titre | `#participant-titre` | `<h3 tabindex="-1">` : le `libelle` |
| Méta | `#participant-meta` | une ligne, format exact donné sous ce tableau |
| Actions | `#btn-nouvelle-pour-participant`, `#btn-xlsx-participant`, `#btn-pdf-bilan` | « Nouvelle session pour ce participant », « Exporter les scores (Excel) », « Exporter le bilan (PDF) ». Les trois portent la classe `hors-impression`. |
| Aide PDF | `#aide-pdf` | « Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF » comme destination. » (classe `hors-impression`) |
| Avertissement | `#avertissement-detail` | même texte et même classe que `#avertissement-liste` |
| Tableau des sessions | `#table-sessions-participant` | tableau récapitulatif **et** alternative textuelle des graphiques (C2.5) |
| Bilan | `#bilan` | C3 |

Format de `#participant-meta` (séparateur : une espace, une barre verticale, une espace) :

```
<n> session(s) | <période> | édité le <jj/mm/aaaa>
```

`<n> session(s)` : « 1 session », « 3 sessions ». Période : « du jj/mm/aaaa au jj/mm/aaaa »,
« le jj/mm/aaaa » si les deux dates sont égales, « dates non renseignées » si `premiere_date`
est `null`. Date d'édition : jour courant. Exemple :
`3 sessions | du 02/03/2026 au 16/03/2026 | édité le 12/11/2026`.

**C2.4 Mise à jour.** Toute modification de `sessions` pendant que la vue est ouverte
(suppression depuis la fiche ou le panneau, import, effacement) redessine la sous-vue
affichée. Si le participant affiché n'existe plus : retour à la liste. La vue lit toujours
l'état courant (`sessions`), jamais une copie ancienne.

**C2.5 Tableau des sessions (`#table-sessions-participant`)**
`aria-label="Sessions et scores du participant <libelle>"`. Une ligne `tr[data-session-id="<id>"]`
par session, dans l'ordre C1.2, avec `data-rang="<rang>"`. En-têtes : N°, Date, Condition,
Axe 1, Axe 2, Axe 3, Axe 4, Indice global, Manquants (sur 14), Actions.

| Cellule | Contenu |
|---|---|
| `td[data-col="no"]` | `session_no` ou `?` |
| `td[data-col="date"]` | `jj/mm/aaaa` ou `?` |
| `td[data-col="condition"]` | `A`, `B`, `C` ou `?` |
| `td[data-col="axe1"]` à `"axe4"`, `"total"` | le score (entier, négatif possible) ou `-` si `null` ; recalculé par `calculerScores`, jamais lu dans `scores` stocké |
| `td[data-col="manquants"]` | `manquants.total` (0 à 14) |
| `td[data-col="actions"]` (classe `hors-impression`) | `button[data-ouvrir-session="<id>"]` « Ouvrir » ; `button[data-supprimer-session="<id>"]` « Supprimer » (classe `btn-danger`) |

« Ouvrir » : la session devient courante, est enregistrée, le formulaire est rempli,
la vue est quittée, l'étape `session` est affichée. « Supprimer » : même confirmation
`window.confirm` et mêmes effets que dans le panneau Sessions (réutiliser la même fonction ;
message « Supprimer la session S01 (S2, 09/03/2026) ?\nCette action est définitive. »).

**C2.6 « Nouvelle session pour ce participant »** : applique C1.5, quitte la vue, affiche
l'étape `session`, met le focus sur le premier bouton radio `input[name="condition"]`.

**C2.7 Adaptation.** Jusqu'à 719 px, `#table-participants` et `#table-sessions-participant`
(classe commune `tableau-cartes`) deviennent une suite de cartes, une par ligne, chaque `td`
précédé de son libellé (`data-label`, même technique que le tableau des mesures `.physio`).
À 360 px, aucun défilement horizontal de la page dans aucune sous-vue ; seuls les conteneurs
de graphiques (`graphique-defil`) peuvent défiler.

### C3. Bilan graphique

**C3.1 Structure du bilan (`#bilan`)**

```
#bilan                      <div> contenant h4 titre "Bilan graphique"
  section#bilan-scores      h4 "Scores composites"
     ul#legende-conditions  (C3.5)
     div.grille-scores      5 x figure.graphique > figcaption + div.graphique-defil > svg
  section#bilan-cotations   h4 "Cotations item par item"
     p#note-v14             "V1.4 est un score inversé : il est affiché tel que coté, et soustrait dans l'axe 1."
     ul#legende-cotations
     figure.graphique (svg cotations-t0) puis figure.graphique (svg cotations-t1)
  section#bilan-t2          h4 "T2 : évolution 10 minutes après le retrait"
     ul#legende-t2
     figure.graphique (svg t2)
```

Ces `section` n'ont pas d'attribut `data-panel`. Chaque `div.graphique-defil` est focusable
(`tabindex="0"`, `role="region"`, `aria-label="Défilement : <titre du graphique>"`), a
`overflow-x:auto` et `max-width:100%` à l'écran. Les éléments d'une grille CSS portent
`min-width:0` (sinon un SVG large élargit la page). Un `figure` dont le SVG fait plus de
340 de large (6 sessions ou plus pour un score) porte `data-large="true"` et occupe toute
la largeur de la grille ; les autres se rangent en colonnes (`repeat(auto-fit,minmax(min(100%,340px),1fr))`).
Chaque `figcaption` : pour un score, `<nom> - échelle de <min> à <max>` (ex. « Axe 1 - Régulation Tonique - échelle de -3 à 9 ») ; pour les grilles : « T0 - Ligne de base », « T1 - Stimulation active », « T2 - Rémanence et post-effet ». Chaque SVG est décrit par le tableau `#table-sessions-participant` (`aria-describedby` vers lui).

**C3.2 Format de `bilan(code)`** (objet JSON pur, aucune référence au DOM ; copie fraîche à chaque appel)

```json
{
  "schema": "grille-haptique-bilan/1",
  "code": "S01", "cle": "s01", "libelle": "S01",
  "nb_sessions": 3,
  "premiere_date": "2026-03-02", "derniere_date": "2026-03-16",
  "conditions": ["A", "B", "C"],
  "sessions": [
    { "rang": 1, "id": "s01-a", "session_no": 1, "date": "2026-03-02", "condition": "A",
      "scores": { "axe1": 1, "axe2": 0, "axe3": 1, "axe4": 1, "total": 3 },
      "manquants": { "axe1": 0, "axe2": 0, "axe3": 1, "axe4": 1, "total": 2 } }
  ],
  "scores": [
    { "cle": "axe1", "nom": "Axe 1 - Régulation Tonique", "min": -3, "max": 9,
      "graduations": [-3, 0, 3, 6, 9],
      "points": [
        { "rang": 1, "session_id": "s01-a", "session_no": 1, "date": "2026-03-02",
          "condition": "A", "valeur": 1, "manquants": 0 }
      ],
      "segments": [[1, 2, 3]] }
  ],
  "cotations_t0": [
    { "code": "T0.1", "intitule": "Hypertonie & spasticité", "axe": null, "inverse": false,
      "cellules": [ { "rang": 1, "session_id": "s01-a", "valeur": 3 } ] }
  ],
  "cotations_t1": [
    { "code": "V1.4", "intitule": "Intolérance sensorielle ou défense tactile", "axe": 1, "inverse": true,
      "cellules": [ { "rang": 1, "session_id": "s01-a", "valeur": 2 } ] }
  ],
  "t2": [
    { "cle": "tonus", "libelle": "Tonus de fond", "libelle_complet": "1. Tonus de fond",
      "cellules": [ { "rang": 1, "session_id": "s01-a", "valeur": null } ] }
  ]
}
```

| Champ | Type et règle |
|---|---|
| `schema` | chaîne constante `grille-haptique-bilan/1` |
| `code`, `cle`, `libelle`, `nb_sessions`, `premiere_date`, `derniere_date`, `conditions` | C1.1 et C1.4 |
| `sessions[]` | dans l'ordre C1.2, toutes les sessions du groupe. `session_no` entier ou `null`, `date` chaîne `AAAA-MM-JJ` ou `""`, `condition` `"A"`, `"B"`, `"C"` ou `""`. `scores` et `manquants` : résultat de `calculerScores(session)` (mêmes clés et mêmes règles que B6). |
| `scores[]` | **toujours 5 entrées, dans l'ordre** `axe1`, `axe2`, `axe3`, `axe4`, `total`. `nom` : « Axe 1 - Régulation Tonique », « Axe 2 - Conscience Corporelle et Appuis », « Axe 3 - Disponibilité Attentionnelle », « Axe 4 - Dialogue Tonico-Émotionnel », « Indice global d'efficience clinique ». `min`, `max`, `graduations` : tableau C3.3. |
| `scores[].points[]` | **une entrée par session**, même ordre que `sessions`, y compris pour une valeur `null`. `valeur` : entier (négatif possible, `0` est une valeur, pas un trou) ou `null`. `manquants` : `sessions[i].manquants[cle]`. |
| `scores[].segments` | tableau de tableaux de rangs : les suites maximales d'**au moins 2** points consécutifs (rangs adjacents) de `valeur` non `null`. `[[1,2,3]]` = une ligne continue ; `[]` = aucun trait. Un `null` interrompt la ligne. |
| `cotations_t0` | 5 lignes `T0.1` à `T0.5`, `axe` `null`, `inverse` `false` |
| `cotations_t1` | 14 lignes `V1.1` à `V4.3` dans l'ordre de B5 ; `axe` 1 à 4 ; `inverse` `true` pour `V1.4` seulement. `intitule` : intitulé de B5. |
| `cotations_*[].cellules[]` | une par session, même ordre. `valeur` : `0`, `1`, `2`, `3` (nombre), `"NA"` ou `null` (non coté). Valeur **brute** : `V1.4` n'est jamais inversé. |
| `t2[]` | 4 lignes, dans l'ordre `tonus`, `posture`, `emotion`, `relation`. `libelle` court : « Tonus de fond », « Posture et appuis », « Émotion », « Relation ». `libelle_complet` : domaine de B5 (« 1. Tonus de fond », « 2. Organisation posturale & appuis », « 3. État émotionnel global », « 4. Disponibilité relationnelle »). `valeur` : `-1`, `0`, `1` ou `null`. |

`bilan(code)` vaut `null` si aucun participant ne correspond ; `code` est comparé sans
tenir compte de la casse ; `""` (ou la chaîne `(sans code)`) désigne le groupe sans code.

**C3.3 Échelles des scores**

| Score | `min` | `max` | `graduations` (lignes et étiquettes de l'axe y) |
|---|---|---|---|
| `axe1` | -3 | 9 | -3, 0, 3, 6, 9 |
| `axe2` | 0 | 12 | 0, 3, 6, 9, 12 |
| `axe3` | 0 | 9 | 0, 3, 6, 9 |
| `axe4` | 0 | 9 | 0, 3, 6, 9 |
| `total` | -3 | 39 | 0, 10, 20, 30, 39 |

(`axe1` = V1.1 + V1.2 + V1.3 - V1.4 vaut au minimum -3 ; `total` vaut au minimum -3 quand
seul l'axe 1 est calculable.) Pour `axe1` et `total`, une ligne de zéro supplémentaire,
`line[data-ligne-zero]`, est tracée en trait plein plus marqué que les graduations.

**C3.4 Géométrie (unités du `viewBox`, 1 unité = 1 px à l'écran)**

*Graphique de score* (`svg[data-graphique="axe1"|"axe2"|"axe3"|"axe4"|"total"]`) :

| Constante | Valeur |
|---|---|
| Largeur `W` (attributs `width` et `viewBox`) | `max(300, 60 + 56 x n)`, n = nombre de sessions |
| Hauteur `H` | 210 |
| Marges : gauche, droite, haute | 44, 16, 22 ; hauteur de tracé : 140 (de y = 22 à y = 162) |
| Abscisse du point de rang i | `44 + 56 x (i - 0.5)` |
| Ordonnée d'une valeur v | `22 + (max - v) x 140 / (max - min)`, arrondie au dixième : `Math.round(y * 10) / 10`, écrite par `String()` |
| Étiquettes de l'axe x (centrées sur l'abscisse) | `S<n>` baseline y = 178 (11, gras) ; date `jj/mm/aa` y = 191 (9) ; `m manq.` y = 204 (9), seulement si m > 0 |
| Valeur au-dessus du point | texte gras 11, baseline `y - 13` |
| Marqueur | environ 20 de côté : cercle r = 9 ; carré 18 x 18 ; triangle de sommets (cx, cy-11), (cx+10, cy+8), (cx-10, cy+8) ; losange de sommets (cx, cy-10), (cx+10, cy), (cx, cy+10), (cx-10, cy). La lettre de condition est centrée dans le marqueur (gras 10). |

*Grilles* (`svg[data-graphique="cotations-t0"|"cotations-t1"|"t2"]`) :

| Constante | Valeur |
|---|---|
| Largeur `W` | `118 + 44 x n + 8` |
| Colonne d'étiquettes | x de 0 à 118 : code en gras 11 à x = 4 ; pour `V1.4`, le texte « score inversé » (9) à x = 34 sur la même ligne ; pour T2, le `libelle` court |
| En-tête de colonne | hauteur 56, centré sur `cx = 118 + 44 x (rang - 1) + 22` : `S<n>` baseline y = 15 (gras 11) ; date `jj/mm/aa` y = 29 (9) ; marqueur de condition de rayon 7 centré en y = 43 |
| Case | rectangle de 42 de large, retrait de 1 par côté : `x = 118 + 44 x (rang - 1) + 1` |
| Hauteur de ligne | 26 (T0, T1) ; 30 (T2) |
| Position verticale d'une ligne | T0 : `56 + 26 x r` (r = 0 à 4). T1 : `56 + 26 x r + 6 x (axe - 1)` (r = 0 à 13) : un écart de 6 sépare les axes. T2 : `56 + 30 x r` (r = 0 à 3). |
| Hauteur `H` | T0 : 190 ; T1 : 442 ; T2 : 180 |

La date courte est `jj/mm/aa` (`"2026-03-02"` donne `02/03/26`) ; `?` si la date est vide ; le numéro est
`S<session_no>` ou `S?`. La date complète figure dans l'infobulle (`<title>`) et dans le tableau.

**C3.5 Condition : forme, couleur, lettre** (jamais la couleur seule)

| Condition | Forme (`data-forme`) | Lettre | Classe |
|---|---|---|---|
| A (Témoin) | `cercle`, **creux** : fond du panneau, trait 2 px `--bil-cond-a-trait` | A | `m-A` |
| B (Gilet actif) | `carre`, **plein** `--bil-cond-b` (bleu marine) | B | `m-B` |
| C (Multisensorielle) | `triangle`, **plein** `--bil-cond-c` (bleu marine), bord `--panel` 1,5 px | C | `m-C` |
| vide | `losange`, fond `--bil-cond-x`, trait `--bil-cond-x-trait` | ? | `m-X` |

La forme porte la condition ; la couleur ne porte que « gilet actif oui / non ». B et C ne se
distinguent que par la forme et la lettre.

`ul#legende-conditions` : un `li[data-legende="A"|"B"|"C"]` par condition, contenant un petit
SVG décoratif (`aria-hidden="true"`) du marqueur puis le texte « A - Témoin », « B - Gilet actif »,
« C - Multisensorielle » ; un `li[data-legende="X"]` « ? - Condition non renseignée » seulement si une
session du participant n'a pas de condition.

**C3.6 Couleurs : variables CSS** définies sur `:root` (clair), redéfinies dans
`@media (prefers-color-scheme:dark)` (et `:root[data-theme="dark"]`) ; le bloc `@media print`
redéfinit **toutes** les variables de couleur (jetons de la charte, `--bil-*`, cotation à l'écran,
NA, pastille) avec leurs valeurs claires, quel que soit le thème. Les éléments SVG se colorent par
classes CSS qui lisent les variables (pas d'attribut `fill="var(...)"`). Rouille jamais utilisée.

| Variable | Clair | Sombre | Usage |
|---|---|---|---|
| `--bil-cond-a` / `-a-trait` / `-a-lettre` | `#FFFFFF` / `#41524F` / `#14201F` | `#17211F` / `#ABBBB7` / `#E8EFED` | marqueur A (creux) : fond, trait, lettre |
| `--bil-cond-b`, `--bil-cond-c` | `#2F2C62` | `#A9A6EA` | marqueurs B et C (pleins) |
| `--bil-cond-lettre` | `#FFFFFF` | `#14123A` | lettre dans B et C |
| `--bil-cond-x` / `-x-trait` / `-x-lettre` | `#E9EEEC` / `#72837F` / `#14201F` | `#22302D` / `#7E908C` / `#E8EFED` | marqueur sans condition |
| `--bil-cot-0` / `--bil-cot-txt-0` | `#DCE9E6` / `#14201F` | `#1C3A35` / `#E8EFED` | case cotée 0 (`--m1`) |
| `--bil-cot-1` / `--bil-cot-txt-1` | `#A7CCC5` / `#14201F` | `#2C6058` / `#E8EFED` | case cotée 1 (`--m2`) |
| `--bil-cot-2` / `--bil-cot-txt-2` | `#4D9A90` / `#14201F` | `#3F9184` / `#081816` | case cotée 2 (`--m3`) |
| `--bil-cot-3` / `--bil-cot-txt-3` | `#0A5F57` / `#FFFFFF` | `#6FC9BA` / `#081816` | case cotée 3 (`--m4`) |
| `--bil-cot-na` / `-na-trait` / `--bil-cot-txt-na` | `#E4E9E7` / `#9AA8A5` / `#41524F` | `#1F2B29` / `#5A6B68` / `#ABBBB7` | NA : fond gris + hachures |
| `--bil-t2-neg` / `-neg-trait` / `-neg-txt` | `#F4E5C8` / `#B3741B` / `#14201F` | `#3A2C13` / `#D9A24D` / `#E8EFED` | T2 = -1 (ocre doux, trait 2 px) |
| `--bil-t2-zero` / `--bil-t2-zero-txt` | `#E4E9E7` / `#14201F` | `#1F2B29` / `#E8EFED` | T2 = 0 |
| `--bil-t2-pos` / `--bil-t2-pos-txt` | `#0E6B62` / `#FFFFFF` | `#41B3A4` / `#081816` | T2 = +1 |

La rampe 0 à 3 est une gradation d'une seule teinte (`--m1` à `--m4` de la charte), monotone en
luminance ; la valeur est de plus écrite dans chaque case. Le rapport de contraste texte / fond de
chaque paire est d'au moins 4,5 (AA), et d'au moins 3 pour les traits (trait de A, de la condition
vide et du T2 = -1 contre leur fond). Les autres traits reprennent `--line`, `--line-3`, `--ink-2`.

**C3.7 Cases et points : contenu et attributs `data-*`** (contrat de test)

| Élément | Attributs et contenu |
|---|---|
| `svg` (les 8) | `role="img"`, `aria-label` (C3.9), `focusable="false"`, `data-graphique` (`axe1` à `axe4`, `total`, `cotations-t0`, `cotations-t1`, `t2`), `data-nb-sessions`, `data-participant` (la `cle`), `width`, `height`, `viewBox`. `data-vide="true"` si aucune valeur n'est exploitable (tous les points `null`, ou aucune case renseignée), avec un texte centré « Aucun score calculable », « Aucune cotation » ou « Aucune évolution renseignée ». Score : `data-min`, `data-max`. |
| `g[data-colonne="<rang>"]` | Un par session et par SVG : `data-session` (id), `data-session-no` (entier ou vide), `data-date` (`AAAA-MM-JJ` ou vide), `data-condition` (A, B, C ou vide) ; contient les textes d'en-tête (C3.4) et, dans les grilles, le marqueur de condition. |
| `g[data-point]` (scores) | **Un par session** : `data-score` (clé du score), `data-session`, `data-rang`, `data-session-no`, `data-date`, `data-condition`, `data-valeur` (entier en chaîne, **chaîne vide si `null`**), `data-manquants`, `data-forme` (C3.5, présent même si la valeur est `null`), `data-x`, `data-y` (nombres décimaux, **absents si `null`**). Contient un `<title>` et, si `valeur` non `null`, le marqueur (forme + lettre) et le texte de la valeur ; si `null`, rien d'autre qu'un petit texte « - » au pied du tracé. |
| `path[data-segment]` | Un par entrée de `segments` : `data-score`, `data-rangs` (rangs séparés par des virgules, ex. `1,2,3`), `d` = `M x y L x y ...` passant par les centres des points. Aucun trait pour un point isolé. |
| `line[data-graduation]` | Une par graduation : `data-graduation="<v>"`, accompagnée d'une étiquette `text` à gauche. |
| `line[data-ligne-zero]` | `axe1` et `total` seulement ; son `y1` est l'ordonnée de 0 par la formule C3.4 (127 pour `axe1`). |
| `g[data-ligne="<code>"]` (grilles) | `data-bloc` (`t0`, `t1`, `t2`), `data-inverse` (`true`/`false`, T0 et T1), étiquettes de ligne, cases. Pour T2 la clé est le domaine (`tonus`...). |
| `g[data-cellule]` | `data-bloc`, `data-code` (code d'item) ou `data-domaine` (T2), `data-session`, `data-rang`, `data-valeur` (`0`-`3`, `NA`, `-1`, `0`, `1`, ou chaîne vide), un `<title>`, un `rect` de classe `cot-0` à `cot-3`, `cot-na`, `cot-vide` (T0, T1) ou `t2-neg`, `t2-zero`, `t2-pos`, `t2-vide` (T2). Texte de la case : `0`-`3`, `NA`, `-1`, `0`, `+1` ; **aucun texte pour une case vide**. Pour NA : un second `rect.hachure` rempli par `url(#hachure-t0)` ou `url(#hachure-t1)`, motif `<pattern>` défini dans le `<defs>` du même SVG (identifiants uniques par SVG), traits en `--bil-cot-na-trait`. Une case vide n'a qu'un contour. |

Format des infobulles `<title>` :
- point : `S2 | 09/03/2026 | Cond. B | Axe 1 : 6` suivi de ` (m item(s) manquant(s))` si m > 0 ; si `null` : `... : non calculable` ; `S?`, `date ?`, `Cond. ?` si l'information manque (comme le panneau Sessions) ;
- case : `V1.1 | S2 | 09/03/2026 | Cond. B : 2` (`NA`, ou `non coté`).

**C3.8 Lisibilité et adaptation.** Jusqu'à 30 sessions : à l'écran, le SVG garde sa largeur
`W` (aucune réduction), le conteneur `graphique-defil` défile horizontalement (`W` = 1740
pour un score, 1446 pour une grille à 30 sessions) et la page ne défile jamais
horizontalement, de 360 px à l'écran large. En impression, le SVG est réduit à la largeur
utile (C4). L'impression reste lisible jusqu'à environ 15 à 20 sessions ; au-delà, le
tableau des sessions fait foi.

**C3.9 Alternatives textuelles.** Le tableau `#table-sessions-participant` est l'alternative
complète. Chaque SVG porte un `aria-label` de la forme suivante (n = nombre de sessions, « 1 session » au singulier) :

| SVG | `aria-label` |
|---|---|
| score | `<nom>, participant <libelle> : n sessions. S1 (A) 1; S2 (B) 6; S3 (C) non calculable` (une entrée par session, séparées par « ; », condition vide notée `?`) |
| `cotations-t1` | `Cotations T1, participant <libelle> : 14 items, n sessions ; x cotées, y NA, z non cotées.` |
| `cotations-t0` | `Cotations T0, participant <libelle> : 5 items, n sessions ; x cotées, y NA, z non cotées.` |
| `t2` | `Évolution T2, participant <libelle> : 4 domaines, n sessions ; x renseignés, y non renseignés.` |

Les comptes portent sur toutes les cases de la grille (x + y + z = items x sessions).

### C4. Impression PDF du bilan

1. `#btn-pdf-bilan` appelle `imprimerBilan()` : pose `data-impression="bilan"` sur
   `<body>`, appelle `window.print()` dans un `try`, et retire l'attribut dans le `finally`.
   Les écouteurs `beforeprint` / `afterprint` font de même (pose si la vue Participants est
   ouverte, retrait à `afterprint`) afin que Ctrl+P donne le même résultat.
2. L'aide `#aide-pdf` explique le choix « Enregistrer au format PDF ». Aucun appel réseau.
3. Règles `@media print`, **ajoutées** au bloc existant, sans changer ses règles actuelles :

| Règle | Effet |
|---|---|
| `#vue-participants{display:none}` sans l'attribut, `display:block` avec `body[data-impression="bilan"]` | l'impression d'une session seule (`#btn-imprimer`) reste strictement inchangée : toutes les étapes à la suite, la vue n'apparaît jamais |
| `body[data-impression="bilan"] .hors-impression`, `#resume-session`, `#btn-retour-saisie`, `#btn-retour-liste`, `#message-participants` | `display:none` |
| `@page` | inchangé (`size:A4`, marge 10 mm, portrait) ; ne pas en ajouter d'autre |
| Couleurs | `print-color-adjust:exact` déjà global ; variables `--bil-*` en valeurs claires (C3.6) |
| `figure.graphique`, `#table-sessions-participant tr`, `#bilan h4` | `break-inside:avoid` pour les deux premiers, `break-after:avoid` pour les titres : aucun graphique n'est coupé par un saut de page |
| `.graphique-defil` | `overflow:visible` ; `svg{max-width:100%;height:auto}` (réduit les larges, n'agrandit pas les petits) |
| `#vue-participants` | marges latérales à 0, largeur maximale supprimée (le contenu occupe les 190 mm utiles, soit environ 718 px) |
| `.grille-scores` | 2 colonnes égales ; `figure[data-large]` sur toute la largeur |
| Avertissement `.avertissement-sante` | reste imprimé |

4. Contenu et ordre imprimés : en-tête de page existant (titre et protocole), `#participant-titre`,
   `#participant-meta` (code, nombre de sessions, période, date d'édition), avertissement,
   tableau des sessions (sans colonne Actions), scores (5 graphiques), grilles T0 puis T1, T2.
   Dans l'écran, l'ordre des sections de `#bilan` est le même.

### C5. Export Excel (`.xlsx`) sans bibliothèque

**C5.1 Boutons et noms de fichiers**

| Portée | Bouton | Nom de fichier |
|---|---|---|
| un participant | `#btn-xlsx-participant` (fiche) | `grille-haptique_scores_<code>_<AAAA-MM-JJ>.xlsx` |
| tous | `#btn-xlsx-tous` (liste) | `grille-haptique_scores_tous_<AAAA-MM-JJ>.xlsx` |

`<code>` : graphie affichée du participant, `x` pour « (sans code) » (même règle que
`partie()` de B8). `<AAAA-MM-JJ>` : jour courant. Type MIME du `Blob` :
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Après le téléchargement,
`#message-participants` affiche « Fichier Excel exporté : <nom> (n session(s)). ». Le
téléchargement passe par la fonction `telecharger` existante.

**C5.2 Archive.** ZIP **non compressé** (méthode 0, « stocké »), **exactement 7 entrées, dans cet ordre**, noms ASCII :

| N° | Nom |
|---|---|
| 1 | `[Content_Types].xml` |
| 2 | `_rels/.rels` |
| 3 | `xl/workbook.xml` |
| 4 | `xl/_rels/workbook.xml.rels` |
| 5 | `xl/styles.xml` |
| 6 | `xl/worksheets/sheet1.xml` (feuille « Scores ») |
| 7 | `xl/worksheets/sheet2.xml` (feuille « Cotations ») |

Ni `docProps/`, ni `sharedStrings.xml`, ni `calcChain.xml`, ni métadonnée d'outil : aucune
trace de générateur. Pour chaque entrée : en-tête local (signature `0x04034B50`, version
requise 20, drapeaux 0, méthode 0, heure DOS 0, date DOS `0x0021` = 1980-01-01, CRC-32,
taille compressée = taille réelle, longueur du nom, extra 0), le nom, les octets ; puis le
répertoire central (signature `0x02014B50`, version créatrice 20, mêmes champs, commentaire 0,
disque 0, attributs 0, décalage de l'en-tête local) ; puis l'enregistrement de fin
(`0x06054B50`, disques 0, 7 entrées sur le disque et au total, taille et décalage du
répertoire central, commentaire 0). Entiers en petit-boutiste, pas de ZIP64, pas de
descripteur de données. Le CRC-32 est celui de l'IEEE (polynôme réfléchi `0xEDB88320`,
valeur initiale et finale `0xFFFFFFFF`, table de 256 entrées calculée au chargement) :
`CRC-32("123456789") = 0xCBF43926`. Sortie **déterministe** : deux appels sur les mêmes
données donnent les mêmes octets (aucune heure dans l'archive). Contenus textuels encodés en
UTF-8 par `TextEncoder`, déclaration `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` suivie d'un saut de ligne en tête de chaque partie.

**C5.3 Parties XML.** `M` = `http:` + `//schemas.openxmlformats.org/spreadsheetml/2006/main`,
`R` = `http:` + `//schemas.openxmlformats.org/officeDocument/2006/relationships`,
`PR` = `http:` + `//schemas.openxmlformats.org/package/2006/relationships`,
`CT` = `http:` + `//schemas.openxmlformats.org/package/2006/content-types`
(toujours concaténés dans le source, voir les contraintes).

| Partie | Contenu (éléments et attributs significatifs) |
|---|---|
| `[Content_Types].xml` | `<Types xmlns=CT>` avec `Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"`, `Default Extension="xml" ContentType="application/xml"`, et un `Override` par partie : `/xl/workbook.xml` en `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml`, `/xl/worksheets/sheet1.xml` et `sheet2.xml` en `application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml`, `/xl/styles.xml` en `application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml` |
| `_rels/.rels` | `<Relationships xmlns=PR>` : `Relationship Id="rId1" Type=R+"/officeDocument" Target="xl/workbook.xml"` |
| `xl/workbook.xml` | `<workbook xmlns=M xmlns:r=R><sheets><sheet name="Scores" sheetId="1" r:id="rId1"/><sheet name="Cotations" sheetId="2" r:id="rId2"/></sheets></workbook>` |
| `xl/_rels/workbook.xml.rels` | `rId1` -> `worksheets/sheet1.xml` (Type `R+"/worksheet"`), `rId2` -> `worksheets/sheet2.xml` (idem), `rId3` -> `styles.xml` (Type `R+"/styles"`) |
| `xl/styles.xml` | `<styleSheet xmlns=M>` : `fonts count="2"` (police 0 : `sz 11`, `name Calibri` ; police 1 : idem avec `<b/>`), `fills count="2"` (`none`, `gray125`), `borders count="1"` (un bordure vide), `cellStyleXfs count="1"`, `cellXfs count="2"` : `xf 0` par défaut, `xf 1` avec `fontId="1" applyFont="1"` (en-tête gras), `cellStyles count="1"` (`Normal`) |
| `sheetN.xml` | `<worksheet xmlns=M>` avec, dans cet ordre : `<dimension ref="A1:<dernière colonne><dernière ligne>"/>` ; `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>` ; `<sheetFormatPr defaultRowHeight="15"/>` ; `<cols>` (largeurs ci-dessous, `customWidth="1"`) ; `<sheetData>` |

**C5.4 Cellules.** Ligne 1 = en-tête, chaque cellule `s="1"` (gras), texte en chaîne en ligne.

| Type de valeur | XML |
|---|---|
| Texte (code, date, condition, `NA`, en-têtes) | `<c r="A2" t="inlineStr"><is><t>S01</t></is></c>` (jamais de `t="s"`, jamais de `<f>`) |
| Nombre (entier, négatif possible) | `<c r="E2"><v>-2</v></c>` (sans attribut `t`) |
| Vide ou `null` | **aucune cellule** pour cette colonne |

Échappement des textes : `&` en `&amp;`, `<` en `&lt;`, `>` en `&gt;`, `"` en `&quot;` ; caractères de contrôle interdits en XML 1.0 (sauf tabulation, saut de ligne) supprimés. Un texte commençant par `=`, `+`, `-` ou `@` reste une chaîne en ligne : pas d'apostrophe à ajouter, pas de formule possible. Les dates sont écrites en **texte** `AAAA-MM-JJ` (pas de numéro de série).

**C5.5 Feuille « Scores »** : une ligne par session. Colonnes (en-têtes exacts) :

| Col. | En-tête | Valeur |
|---|---|---|
| A | `code_sujet` | graphie affichée du participant (cellule absente pour « (sans code) ») |
| B | `session_no` | nombre, absent si `null` |
| C | `date` | texte, absent si vide |
| D | `condition` | texte `A`, `B`, `C`, absent si vide |
| E à H | `axe1`, `axe2`, `axe3`, `axe4` | nombres, absents si `null` |
| I | `total` | nombre, absent si `null` |
| J à N | `manquants_axe1`, `manquants_axe2`, `manquants_axe3`, `manquants_axe4`, `manquants_total` | nombres, toujours présents |

Largeurs (`<col>`) : A 14, B 11, C 12, D 10, E à I 8, J à N 16. Ordre des lignes : participants
dans l'ordre C1.3, sessions de chacun dans l'ordre C1.2.

**C5.6 Feuille « Cotations »** : une ligne par session, mêmes colonnes A à D, puis :

| Colonnes | En-têtes | Valeur |
|---|---|---|
| E à I | `T0.1` à `T0.5` | 0 à 3 en nombre ; `NA` en texte ; absent si non coté |
| J à W | `V1.1`, `V1.2`, `V1.3`, `V1.4`, `V2.1`, `V2.2`, `V2.3`, `V2.4`, `V3.1`, `V3.2`, `V3.3`, `V4.1`, `V4.2`, `V4.3` | idem (valeur brute, `V1.4` non inversé) |
| X à AA | `t2_tonus`, `t2_posture`, `t2_emotion`, `t2_relation` | -1, 0, 1 en nombre ; absent si non renseigné |

Largeurs : A 14, B 11, C 12, D 10, E à W 7, X à AA 13. Même ordre de lignes que « Scores ».

**C5.7 Portées.** `xlsxOctets("S01")` : les sessions de ce participant uniquement (code
insensible à la casse) ; `xlsxOctets(null)` : toutes les sessions de tous les participants ;
code inconnu : `null`.

**C5.8 Avertissement.** `#avertissement-liste` et `#avertissement-detail` (C2) sont affichés
juste à côté des boutons d'export, en permanence.

### C6. Interface de test (ajouts à `window.GrilleHaptique`)

| Fonction | Retour |
|---|---|
| `participants()` | Tableau de copies, ordre C1.3 : `{ "code": "S01", "cle": "s01", "libelle": "S01", "nb_sessions": 3, "premiere_date": "2026-03-02", "derniere_date": "2026-03-16", "conditions": ["A","B","C"], "sessions": ["s01-a","s01-b","s01-c"] }`. `sessions` : identifiants dans l'ordre C1.2. Le groupe sans code a `code` = `""`, `cle` = `""`, `libelle` = `"(sans code)"`. |
| `bilan(code)` | Objet C3.2, ou `null` si le participant n'existe pas. `code` : insensible à la casse ; `""` ou `"(sans code)"` pour le groupe sans code. Ne modifie rien. |
| `xlsxOctets(portee)` | `Uint8Array` de l'archive C5 ; `portee` = un code (insensible à la casse) ou `null` pour tous ; `null` renvoyé si le code est inconnu. Ne déclenche aucun téléchargement. |
| `ouvrirParticipants(code?)` | Ouvre la vue (C2.1). Sans argument : liste. Avec un code existant : fiche de ce participant. Renvoie `true` si une fiche est affichée, `false` sinon (liste affichée, code inconnu). Sans effet de bord sur les données. |

Les fonctions existantes (`etat`, `sessions`, `calculerScores`, `versCSV`, `allerA`) sont inchangées, à une réserve près : `allerA` quitte la vue Participants si elle est ouverte (C2.1).

### C7. Vérifications attendues

**Jeu de données de référence.** Un test part d'un contexte neuf (une session vierge « (sans code) »
datée du jour), puis importe le fichier ci-dessous par `input#in-import` (`setInputFiles`).
Les clés absentes sont complétées par la normalisation d'import (B7) ; l'ordre du tableau est volontairement mélangé.

```json
{ "schema": "grille-haptique/1", "sessions": [
 { "id": "s01-b", "cree_le": "2026-03-09T09:00:00.000Z", "modifie_le": "2026-03-09T10:00:00.000Z",
   "identification": { "code_sujet": "S01", "session_no": 2, "date": "2026-03-09", "age": 14, "sexe": "F",
     "diagnostic": "Polyhandicap", "observateur": "OBS1", "installation": "corset", "condition": "B" },
   "cotations": { "T0.1": 2, "T0.2": "NA", "V1.1": 2, "V1.2": 2, "V1.3": 2, "V1.4": 0, "V2.1": 2, "V2.2": 2,
     "V2.3": 1, "V2.4": 1, "V3.1": 2, "V3.2": 2, "V3.3": 2, "V4.1": 2, "V4.2": 2, "V4.3": 1 },
   "t2": { "tonus": { "evolution": 1 }, "posture": { "evolution": 0 }, "emotion": { "evolution": 1 } } },
 { "id": "s01-c", "cree_le": "2026-03-16T09:00:00.000Z", "modifie_le": "2026-03-16T10:00:00.000Z",
   "identification": { "code_sujet": "S01", "session_no": 3, "date": "2026-03-16", "age": 15, "sexe": "F",
     "diagnostic": "Polyhandicap", "observateur": "OBS2", "installation": "autre",
     "installation_autre": "coussin", "condition": "C" },
   "cotations": { "V1.1": 0, "V1.2": 1, "V1.3": 0, "V1.4": 3, "V3.1": 3, "V3.2": 3, "V3.3": 3,
     "V4.1": 3, "V4.2": 3, "V4.3": 3 },
   "t2": { "tonus": { "evolution": -1 }, "posture": { "evolution": 1 }, "emotion": { "evolution": 0 },
     "relation": { "evolution": 1 } } },
 { "id": "s01-a", "cree_le": "2026-03-02T09:00:00.000Z", "modifie_le": "2026-03-02T10:00:00.000Z",
   "identification": { "code_sujet": "S01", "session_no": 1, "date": "2026-03-02", "age": 14, "sexe": "F",
     "diagnostic": "Polyhandicap", "observateur": "OBS1", "installation": "corset", "condition": "A" },
   "cotations": { "T0.1": 3, "V1.1": 1, "V1.2": 1, "V1.3": 1, "V1.4": 2, "V2.1": 0, "V2.2": 0, "V2.3": 0,
     "V2.4": 0, "V3.1": 1, "V3.2": 0, "V4.1": 1, "V4.2": "NA", "V4.3": 0 } },
 { "id": "p7-x", "identification": { "code_sujet": "P7", "session_no": 2, "date": "2026-04-06" } },
 { "id": "p7-z", "identification": { "code_sujet": "P7", "session_no": 7, "date": "2026-04-13" } },
 { "id": "p7-y", "identification": { "code_sujet": "P7", "session_no": 1, "date": "2026-04-06" } },
 { "id": "p6-late", "cree_le": "2026-04-06T12:00:00.000Z",
   "identification": { "code_sujet": "P6", "session_no": 1, "date": "2026-04-06" } },
 { "id": "p6-nodate", "cree_le": "2026-04-01T08:00:00.000Z",
   "identification": { "code_sujet": "P6", "session_no": 1, "date": "" } },
 { "id": "p6-early", "cree_le": "2026-04-06T08:00:00.000Z",
   "identification": { "code_sujet": "P6", "session_no": 1, "date": "2026-04-06" } },
 { "id": "p8-1", "identification": { "code_sujet": "P8", "session_no": 1, "date": "2026-05-01", "condition": "B" },
   "cotations": { "V3.1": 3 } },
 { "id": "p8-2", "identification": { "code_sujet": "P8", "session_no": 2, "date": "2026-05-08", "condition": "A" } },
 { "id": "p8-3", "identification": { "code_sujet": "P8", "session_no": 3, "date": "2026-05-15", "condition": "" },
   "cotations": { "V3.1": 2 } },
 { "id": "z9-1", "identification": { "code_sujet": "Z9", "date": "2026-06-01" } }
] }
```

Jeu `BIG30` (généré par le test, ajouté dans un contexte à part) : 30 sessions de code `BIG30`,
`id` `big-1` à `big-30`, `session_no` i, `date` `2026-01-01` + (i - 1) jours (donc du
`2026-01-01` au `2026-01-30`), condition `A`, `B`, `C` en cycle (i = 1 donne `A`), seule cotation
`V3.1` = i modulo 4 (valeurs 1, 2, 3, 0, 1, 2, ...).

Jeu `CASSE` (ajouté après l'import de référence) :
`{ "id": "s01-d", "modifie_le": "2026-04-01T10:00:00.000Z", "identification": { "code_sujet": "s01", "session_no": 4, "date": "2026-03-23", "condition": "A" } }`.

**Valeurs calculées à la main pour S01** (axe 1 = V1.1 + V1.2 + V1.3 - V1.4) :

| Session | Axe 1 | Axe 2 | Axe 3 | Axe 4 | Total | Manquants (axe1, axe2, axe3, axe4, total) |
|---|---|---|---|---|---|---|
| s01-a (rang 1, A) | 1+1+1-2 = 1 | 0 | 1+0 = 1 | 1+0 = 1 (NA ignoré) | 3 | 0, 0, 1, 1, 2 |
| s01-b (rang 2, B) | 2+2+2-0 = 6 | 2+2+1+1 = 6 | 6 | 2+2+1 = 5 | 23 | 0, 0, 0, 0, 0 |
| s01-c (rang 3, C) | 0+1+0-3 = -2 | `null` | 9 | 9 | -2+9+9 = 16 | 0, 4, 0, 0, 4 |

| # | Cas | Procédure | Résultat attendu |
|---|---|---|---|
| C7.1 | Regroupement et ordre des participants | import de référence, `participants()` | `cle` = `["p6","p7","p8","s01","z9",""]` ; `nb_sessions` = `[3,3,3,3,1,1]` ; le dernier a `libelle` `(sans code)` |
| C7.2 | Valeurs dérivées de S01 | `participants()[3]` | `code` `S01`, `premiere_date` `2026-03-02`, `derniere_date` `2026-03-16`, `conditions` `["A","B","C"]`, `sessions` `["s01-a","s01-b","s01-c"]` (alors que l'import les a donnés dans l'ordre b, c, a) |
| C7.3 | Égalité de dates et dates vides | `participants()` pour P7, P6 | P7 : `["p7-y","p7-x","p7-z"]` (même date, `session_no` 1 puis 2 ; puis le 13). P6 : `["p6-early","p6-late","p6-nodate"]` (même date et même `session_no` : `cree_le` ; date vide en dernier) ; `premiere_date` = `derniere_date` = `2026-04-06` ; `conditions` `[]` |
| C7.4 | Casse et graphie | importer le jeu `CASSE` | un seul participant ; `code` `s01` (modifie_le le plus récent), `nb_sessions` 4, `sessions` se terminant par `s01-d` ; `bilan("S01")` et `bilan("s01")` identiques ; `bilan("inconnu")` est `null` ; `bilan("")` a `nb_sessions` 1 |
| C7.5 | Modèle du bilan, scores | `bilan("S01").scores` | `axe1.points[].valeur` = `[1,6,-2]` ; `axe2` = `[0,6,null]` ; `axe3` = `[1,6,9]` ; `axe4` = `[1,5,9]` ; `total` = `[3,23,16]` ; `manquants` : `axe3` = `[1,0,0]`, `axe4` = `[1,0,0]`, `axe2` = `[0,0,4]`, `total` = `[2,0,4]` ; conditions des points `["A","B","C"]` ; `min`/`max` : -3/9, 0/12, 0/9, 0/9, -3/39 |
| C7.6 | Segments | `bilan("S01").scores` ; `bilan("P8").scores` | S01 : `axe1.segments` = `[[1,2,3]]`, `axe2.segments` = `[[1,2]]`. P8, `axe3` : valeurs `[3,null,2]`, `segments` = `[]` (trou, pas un zéro) ; `total` : `[3,null,2]` |
| C7.7 | Grilles et T2 dans le modèle | `bilan("S01")` | `cotations_t1` a 14 lignes, `V1.4` : `inverse` true, valeurs brutes `[2,0,3]` ; `V4.2` : `["NA",2,3]` ; `V2.1` : `[0,2,null]` ; `cotations_t0` : `T0.1` `[3,2,null]`, `T0.2` `[null,"NA",null]` ; `t2.tonus` `[null,1,-1]`, `posture` `[null,0,1]`, `emotion` `[null,1,0]`, `relation` `[null,null,1]` |
| C7.8 | Vue : ouverture | clic `#btn-participants` | `#vue-participants` visible ; `#contenu`, `#barre-etapes`, `.nav-bas` ont `hidden` ; `#btn-participants[aria-current="page"]` ; focus sur `#titre-participants` ; `section[data-panel]` toujours au nombre de 6 ; `#btn-retour-saisie` rétablit tout et rend le focus à `#btn-participants` |
| C7.9 | Liste | vue ouverte après l'import | 6 lignes `tr[data-participant]` dans l'ordre C7.1 ; ligne `s01` : `nb` 3, `premiere` `02/03/2026`, `derniere` `16/03/2026`, `conditions` `A, B, C` ; ligne `p6` : `conditions` `-` ; `#participants-compte` : « 6 participants, 14 sessions » (13 importées + la session vierge initiale) |
| C7.10 | Fiche | clic sur `button[data-ouvrir-participant="s01"]` | `#participant-titre` = `S01` ; `#participant-meta` = `3 sessions` + ` | ` + `du 02/03/2026 au 16/03/2026` + ` | ` + `édité le <jj/mm/aaaa du jour>` (format de C2.3) ; P6 : `le 06/04/2026` ; `ouvrirParticipants("s01")` renvoie `true`, `ouvrirParticipants("zzz")` renvoie `false` |
| C7.11 | Tableau des sessions | fiche S01 | 3 lignes `tr[data-session-id]` ordre a, b, c ; ligne b : `no` 2, `date` `09/03/2026`, `condition` B, `axe1` 6, `axe2` 6, `axe3` 6, `axe4` 5, `total` 23, `manquants` 0 ; ligne c : `axe2` `-`, `total` 16, `manquants` 4 ; ligne a : `manquants` 2 |
| C7.12 | Ouvrir une session | clic `button[data-ouvrir-session="s01-b"]` | vue fermée ; `etat().id` = `s01-b` ; `#f-session` = 2 ; étape `session` affichée |
| C7.13 | Supprimer | clic `button[data-supprimer-session="s01-b"]` | boîte de confirmation contenant « Supprimer la session S01 (S2, 09/03/2026) » ; refus : rien ne change ; acceptation : 2 lignes, `bilan("S01").nb_sessions` = 2, rangs 1 et 2, `localStorage` mis à jour ; supprimer les deux dernières ramène à la liste sans S01 |
| C7.14 | Nouvelle session pour S01 | clic `#btn-nouvelle-pour-participant` | vue fermée, étape `session` ; `#f-code` `S01`, `#f-session` 4, `#f-date` = jour courant ; sexe F, `#f-age` 15, `#f-diagnostic` `Polyhandicap`, `#f-observateur` `OBS2`, installation `autre` avec `#f-installation-autre` `coussin` (dernière session = s01-c, pas s01-a) ; condition non cochée, heures vides, 19 cotations `null`, `scores.total` `null` ; nombre de sessions + 1 |
| C7.15 | Numérotation | idem pour P7, Z9, un groupe sans numéro | P7 (numéros 2, 7, 1) : `#f-session` 8 ; Z9 (`session_no` `null`) : 1 |
| C7.16 | Aide dans l'étape Session | « Nouvelle session » du panneau, saisir `S`, `S0`, puis `s01` dans `#f-code` | `S` et `S0` : `#aide-participant` caché ; `s01` : visible, texte `s01 : 3 sessions déjà enregistrées` (la session courante n'est pas comptée) ; effacer le code la cache |
| C7.17 | Reprise des champs vides | à la suite : saisir `Autre` dans `#f-diagnostic`, clic `#btn-reprendre-champs` | `#f-diagnostic` reste `Autre` ; sexe F, âge 15, observateur `OBS2`, installation `autre`, précision `coussin` remplis ; `#aide-participant-retour` = `5 champs repris` ; `#f-session`, `#f-date` et la condition inchangés ; second clic : `Aucun champ à reprendre` |
| C7.18 | Graphiques de score (S01) | fiche S01, `svg[data-graphique="axe1"]` | 3 `g[data-point]` : `data-valeur` `1`,`6`,`-2` ; `data-condition` A,B,C ; `data-forme` `cercle`,`carre`,`triangle` ; `data-x` 72, 128, 184 ; `data-y` 115.3, 57, 150.3 ; `line[data-ligne-zero]` à `y1` = 127 ; 1 `path[data-segment]` de `data-rangs` `1,2,3` ; `width` 300, `height` 210, `data-min` -3, `data-max` 9 |
| C7.19 | Autres échelles | idem | `total` : `data-y` 142, 75.3, 98.7 ; `axe2` : 162 (valeur 0, point présent), 92 ; point 3 `data-valeur=""` sans `data-y`, sans marqueur, 1 segment `1,2` ; `axe3` : 146.4, 68.7, 22 ; `axe4` : 146.4, 84.2, 22 |
| C7.20 | Manquants dans le graphique | `axe3` S01 | `data-manquants` `1`,`0`,`0` ; texte `1 manq.` présent dans la colonne de rang 1 et absent des deux autres ; `axe1` n'a aucun texte `manq.` |
| C7.21 | Trou dans la ligne (P8) | fiche P8, `svg[data-graphique="axe3"]` | 3 `g[data-point]` dont le 2e a `data-valeur=""` ; 0 `path[data-segment]` ; formes `carre` (B) et `losange` (condition vide, lettre `?`) ; `axe1` de P8 : `data-vide="true"` |
| C7.22 | Grille T1 | `svg[data-graphique="cotations-t1"]` | 42 `g[data-cellule]` (14 x 3) ; `[data-code="V1.4"][data-session="s01-a"]` : `data-valeur` `2` et texte `2` (non inversé) ; `[data-ligne="V1.4"]` : `data-inverse="true"` et texte « score inversé » ; `[data-code="V4.2"][data-session="s01-a"]` : `NA`, un `rect.hachure` ; `[data-code="V2.1"][data-session="s01-c"]` : `data-valeur=""`, aucun texte, `rect.cot-vide` ; les classes des cases cotées `V1.1` = `cot-1`, `cot-2`, `cot-0` pour a, b, c ; `g[data-colonne="1"]` : `data-session="s01-a"`, `data-date="2026-03-02"`, `data-condition="A"`, textes `S1` et `02/03/26` |
| C7.23 | Grille T0 et T2 | `cotations-t0`, `t2` | T0 : 15 cases, `T0.2` de s01-b = `NA` (hachuré) ; T2 : 12 cases, `tonus` : `""`, `1`, `-1` avec classes `t2-vide`, `t2-pos`, `t2-neg` et textes `+1`, `-1` ; `posture` b : `0` classe `t2-zero` |
| C7.24 | `aria-label` | les 8 SVG de S01 | `role="img"` partout ; `axe1` : `Axe 1 - Régulation Tonique, participant S01 : 3 sessions. S1 (A) 1; S2 (B) 6; S3 (C) -2` ; `axe2` se termine par `S3 (C) non calculable` ; `cotations-t1` : `Cotations T1, participant S01 : 14 items, 3 sessions ; 36 cotées, 1 NA, 5 non cotées.` ; `cotations-t0` : `... 5 items, 3 sessions ; 2 cotées, 1 NA, 12 non cotées.` ; `t2` : `... 4 domaines, 3 sessions ; 7 renseignés, 5 non renseignés.` |
| C7.25 | Aucune cotation, une session (Z9) | fiche Z9 | 1 ligne au tableau, scores `-` et manquants 14 ; chaque SVG de score `data-vide="true"`, 1 `g[data-point]` à `data-valeur=""` ; xlsx : 1 ligne sans cellule de score |
| C7.26 | 30 sessions (BIG30) | fiche BIG30, viewport 1280 | `svg[data-graphique="axe3"]` : `width` 1740, 30 points de `data-valeur` 1,2,3,0,1,... (le `0` est un point, pas un trou) ; `cotations-t1` `width` 1446 ; `.graphique-defil` : `scrollWidth` > `clientWidth` ; `document.documentElement.scrollWidth` <= `innerWidth` ; 30 `g[data-colonne]` par SVG |
| C7.27 | Adaptation | viewports 360x740, 768x1024, 1920x1080, vues liste, fiche S01 et fiche BIG30 | jamais de défilement horizontal de la page ; boutons de la vue >= 44 px de haut ; à 360 px les tableaux sont en cartes (aucun `td` ne déborde) ; `.grille-scores` en une colonne à 360 px |
| C7.28 | Thèmes | `emulateMedia({colorScheme})` clair puis sombre | `getComputedStyle(document.documentElement).getPropertyValue('--bil-cond-a')` = `#0A5C99` (clair) puis `#7DB9EC` (sombre) (casse ignorée) ; idem `--bil-cot-3`, `--bil-t2-neg` ; la couleur de remplissage calculée d'une case `cot-3` change entre les thèmes ; en impression, valeurs claires même avec `colorScheme: dark` |
| C7.29 | Impression : déclenchement | remplacer `window.print` par un espion, clic `#btn-pdf-bilan` | 1 appel ; `document.body.getAttribute('data-impression')` valait `bilan` pendant l'appel et l'attribut est retiré ensuite ; `#aide-pdf` contient « Enregistrer au format PDF » |
| C7.30 | Impression : rendu | poser `data-impression="bilan"`, `emulateMedia({media:'print'})`, viewport 718 px de large | `#vue-participants` affichée ; `#contenu` masqué ; `#btn-pdf-bilan`, `#btn-xlsx-participant`, `#resume-session`, `td[data-col="actions"]` non affichés ; `#avertissement-detail` affiché ; `getComputedStyle(figure).breakInside` = `avoid` ; pour BIG30 chaque `svg` a `getBoundingClientRect().right` <= 719 ; `page.pdf({format:'A4'})` renvoie un PDF (`%PDF`) ; sans l'attribut, en impression, `#vue-participants` n'est pas affichée |
| C7.31 | Impression d'une session inchangée | vue fermée, `emulateMedia({media:'print'})` | les 6 `section[data-panel]` sont affichées, `#vue-participants` non ; comme avant (test existant) |
| C7.32 | Archive `.xlsx` | `xlsxOctets("S01")` | commence par `50 4B 03 04` ; enregistrement de fin `50 4B 05 06` à `longueur - 22`, 7 entrées ; deux appels donnent des octets identiques ; `xlsxOctets("s01")` identique ; `xlsxOctets("inconnu")` est `null` ; `xlsxOctets(null)` plus long |
| C7.33 | Ouverture du fichier | écrire les octets dans un fichier ; Python : `zipfile.ZipFile(f).testzip()` est `None`, `namelist()` = les 7 noms de C5.2 dans l'ordre, tous `compress_type == 0` ; chaque partie lue par `xml.etree.ElementTree` sans erreur ; aucune balise `<f>` ; aucun `docProps` | voir le script ci-dessous |
| C7.34 | Feuille Scores | `openpyxl.load_workbook` | `sheetnames` = `["Scores","Cotations"]` ; `ws.freeze_panes` = `A2` ; en-têtes de la ligne 1 = C5.5, en gras (`ws["A1"].font.b`) ; ligne 2 : `S01,1,2026-03-02,A,1,0,1,1,3,0,0,1,1,2` ; ligne 3 : `S01,2,2026-03-09,B,6,6,6,5,23,0,0,0,0,0` ; ligne 4 : `S01,3,2026-03-16,C,-2,(vide),9,9,16,0,4,0,0,4` ; `E2` est un entier (pas du texte) ; `F4` vaut `None` ; `C2` est une chaîne |
| C7.35 | Feuille Cotations | idem | 27 en-têtes (C5.6) ; `E2` = 3 (entier), `F2` = `None` ; `V2` (V4.2, session a) = `NA` de type chaîne ; ligne 3 : `F3` = `NA`, `X3` = 1, `Y3` = 0, `Z3` = 1, `AA3` = `None` ; ligne 4 : `M4` (V1.4) = 3, `X4` = -1, `Y4` = 1, `Z4` = 0, `AA4` = 1 ; `N4` à `Q4` = `None` |
| C7.36 | Tous les participants | `xlsxOctets(null)` | feuille Scores : 14 lignes de données (3 + 3 + 3 + 3 + 1 + 1) dans l'ordre participants C1.3 (P6, P7, P8, S01, Z9, puis sans code) puis sessions C1.2 ; la dernière ligne (session vierge) n'a pas de cellule A, ni B, et a `manquants_*` = 4, 4, 3, 3, 14 ; la ligne 2 est `p6-early` |
| C7.37 | Téléchargements | clics sur `#btn-xlsx-participant` puis `#btn-xlsx-tous` (`waitForEvent('download')`) | noms `grille-haptique_scores_S01_<AAAA-MM-JJ>.xlsx` et `grille-haptique_scores_tous_<AAAA-MM-JJ>.xlsx` ; octets du premier = `xlsxOctets("S01")` ; `#message-participants` mentionne le nom ; aucune requête réseau |
| C7.38 | Pas d'injection | importer une session de code `-1` (autorisé par B3) dont l'observateur est `<img src=x onerror=window.__x=1>`, puis ouvrir la fiche `-1` | `openpyxl` : cellule du code de type chaîne `-1`, aucune formule ; après « Nouvelle session pour ce participant » et reprise, `window.__x` est `undefined` et `#f-observateur` contient le texte brut ; aucun `<img>` dans la vue |
| C7.39 | Avertissement | listes et fiche | `#avertissement-liste` et `#avertissement-detail` contiennent « données de santé pseudonymisées » et sont à côté (même bloc parent que) des boutons d'export |
| C7.40 | Non-régression | exécuter `node protocole-haptique/tests/grille.test.js` | les tests existants restent OK ; fichier < 300 Ko ; aucune URL hors `http://www.w3.org/` ; pas de `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` (recherche dans le source) ; aucune requête réseau pendant les parcours de la partie C |

*Effectifs de référence (C7.9 et C7.36).* L'import compte 13 sessions (S01 : 3, P7 : 3, P6 : 3,
P8 : 3, Z9 : 1). Avec la session vierge initiale : **14 sessions** et **6 participants**.

Script de contrôle du fichier (C7.33 à C7.35), à exécuter avec `python3 -I` :

```python
import sys, zipfile, xml.etree.ElementTree as ET
f = sys.argv[1]
z = zipfile.ZipFile(f)
assert z.testzip() is None
assert z.namelist() == ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']
assert all(i.compress_type == 0 for i in z.infolist())
for n in z.namelist():
    ET.fromstring(z.read(n))            # XML bien formé
    assert b'<f>' not in z.read(n) and b'<f ' not in z.read(n)
import openpyxl
wb = openpyxl.load_workbook(f)
assert wb.sheetnames == ['Scores', 'Cotations']
assert wb['Scores'].freeze_panes == 'A2' and wb['Scores']['A1'].font.b
print([c.value for c in wb['Scores'][2]])
```

Avec LibreOffice, si disponible : `soffice --headless --convert-to csv --outdir <dossier> <fichier.xlsx>`
convertit la première feuille ; la sortie pour `xlsxOctets("S01")` doit comporter la ligne
d'en-tête de C5.5 puis exactement les trois lignes de C7.34 (valeurs vides représentées par `,,`).

---

## D. Ergonomie en séance (contrat de la version 3)

Cette partie s'ajoute à A, B et C. Aucune cotation, aucune navigation, aucune valeur n'est jamais
proposée ou écrite automatiquement ; aucun son. Tests : `tests/ergonomie.test.js`.

### D1. Clavier
- Dans un `[data-item]`, hors `textarea`, `input` et `select`, la valeur se pose avec `ev.code`
  `Digit0` à `Digit3` ou `Numpad0` à `Numpad3`, **ou** `ev.key` `0` à `3`, `n` ou `N` pour NA, quelle
  que soit la disposition (AZERTY : `key` `&` avec `code` `Digit1` cote 1). Après la cotation, le
  focus passe au bouton à `tabindex="0"` de l'item suivant. La répétition automatique d'une touche
  est ignorée. Précision : un code `Numpad0` à `Numpad3` cote même si `key` est une touche de
  navigation (pavé numérique sans verrouillage numérique).
- Tabulation en « roving tabindex » : dans chaque `[data-item]`, un seul `button[data-rate]` a
  `tabindex="0"` (le bouton choisi, sinon le premier), les autres `-1`.
- Sur un bouton de cotation : flèches haut / bas = focus sur le bouton à `tabindex="0"` de l'item
  précédent / suivant (sans effet aux extrémités) ; flèches gauche / droite = bouton de valeur voisin
  de l'item ; aucune de ces touches ne cote. `Retour arrière` ou `Suppr` efface la cotation.
- `data-etat` sur chaque `[data-item]` : `vide`, `cote` (0 à 3) ou `na`.
- `#btn-prochain-non-cote`, visible dans `t0` et `t1`, donne le focus au bouton à `tabindex="0"` du
  premier item `data-etat="vide"` de l'étape, sans rien écrire ; s'il n'y en a plus, `#annonce`
  reçoit « Tous les items de cette étape sont cotés » (un message bref l'affiche aussi à l'écran).
- À chaque changement d'étape (boutons, `#btn-suivant`, `#btn-precedent`, `GrilleHaptique.allerA`),
  `document.activeElement` est le `h2` du titre (`tabindex="-1"`) et la page remonte en haut. Au
  chargement de la page, le focus est aussi placé sur ce titre.

### D2. Annuler
- Pile en mémoire de 20 modifications de cotation (items, cases de rupture, T2, durée de V3.1),
  vidée au changement de session. `Ctrl+Z` ou `Cmd+Z` hors champ de texte restaure l'état d'avant la
  dernière modification (les textes d'observation ne sont pas concernés).
- Après un effacement ou un remplacement d'une valeur déjà posée (pas après une première
  cotation), `#toast` affiche `#btn-annuler` pendant 6 s ; le clic annule comme `Ctrl+Z`. Le toast
  disparaît seul (attribut `hidden`).
- Si `(pointer:coarse)` est vrai, re-toucher le bouton déjà choisi dans les 400 ms qui suivent son
  choix ne l'efface pas.

### D3. Minuteur de phase
- `#minuteur` (`role="timer"`, dans l'en-tête, `data-etat` = `arret`, `marche`, `pause`, `termine`),
  `#minuteur-phase` (`select` : `t0` 10:00, `rupture` 02:00, `t2` 10:00 en compte à rebours, `libre`
  chronomètre à partir de 00:00), `#minuteur-valeur` (`mm:ss`), `#btn-minuteur-demarrer`,
  `#btn-minuteur-pause`, `#btn-minuteur-raz` (44 px). Un libellé d'état (En cours, Pause, Phase
  terminée) double la couleur.
- L'entrée dans l'étape `t0`, `t1`, `t2` propose la phase `t0`, `libre`, `t2`, seulement si le
  minuteur est à l'arrêt ou terminé ; le choix reste manuel (changer de phase remet le minuteur à
  l'arrêt). Pas de proposition au chargement de la page.
- État dans `sessionStorage`, clé `grilleHaptique.v1.minuteur`, objet `{phase, etat, debut,
  ecoule}` : `debut` est l'horodatage absolu `Date.now()` du début de la marche (ramené à
  `maintenant - ecoule` à la reprise), `ecoule` l'écoulé figé (arrêt, pause, fin). L'affichage se
  recalcule toutes les 250 ms, au rechargement, au retour d'onglet (`visibilitychange`) et à
  `pageshow`. Aucune clé `localStorage`, aucune écriture dans les sessions.
- Fin d'un compte à rebours : `data-etat="termine"`, valeur `00:00`, « Phase terminée » dans
  `#annonce`. `navigator.wakeLock` demandé au démarrage (absence sans effet), relâché à la pause, à
  la remise à zéro et à la fin.

### D4. Plusieurs onglets
- Avant chaque écriture, `grilleHaptique.v1.sessions` est relue et fusionnée par `id` (la plus récente
  `modifie_le` l'emporte, les sessions inconnues sont conservées) ; une session supprimée dans la
  fenêtre courante n'est pas recréée. L'évènement `storage` déclenche la même fusion, applique les
  suppressions faites ailleurs, redessine l'étape affichée et montre `#bandeau-autre-onglet`
  (« Une autre fenêtre a modifié les sessions : données fusionnées. ») avec un bouton « Masquer ».
  Au retour d'onglet, une relecture rattrape un évènement manqué. La fusion se fait à la
  granularité de la session : deux fenêtres qui modifient la même session sans avoir reçu
  l'évènement conservent la plus récente.

### D5. Échec d'écriture
- Le drapeau d'échec n'est jamais définitif : chaque saisie retente l'écriture. Dès qu'elle
  réussit, le bandeau disparaît et `#etat-enregistrement` indique « Enregistré à hh:mm ».
- Tant qu'elle échoue : `#bandeau-stockage` (texte B7 inchangé), `#btn-sauvegarder-maintenant`
  (export JSON de la session courante, comme `#btn-export-json`) et un écouteur `beforeunload`
  (`preventDefault`, `returnValue`). Sinon aucun `beforeunload`.

### D6. Affichage et accessibilité
- Plus de score pendant la cotation : aucun élément de score dans `section[data-panel="t1"]`
  (seuls des compteurs « 2/4 » d'items cotés par axe). Les scores restent dans la Synthèse et la
  vue Participants.
- `#annonce` (`aria-live="polite"`, masquée visuellement) reçoit « V1.2 coté 3. T1 : 9 sur 14 »,
  « V1.2 effacé. T1 : 8 sur 14 », « Modification annulée », « Phase terminée » et les messages de D1.

### D7. En-tête et gabarit
- En-tête `header` sticky d'une ligne : 72 px au plus à 1280 px, 104 px au plus à 390 px (marque,
  `#resume-session`, `#minuteur`, `#etat-enregistrement`, `#btn-participants`, `#btn-sessions` ; à
  390 px la marque et les boutons se réduisent). La barre `button[data-step]` est collée sous
  l'en-tête, et fixée en bas de l'écran sous 720 px. `scroll-padding-top` et `scroll-padding-bottom`
  suivent la hauteur mesurée des barres (variables `--h-haut`, `--h-bas`).
- Boutons d'en-tête et de navigation d'au moins 44 px.

### D8. Charte
- `:root` définit `--marine:#2f2c62` et les jetons de la charte ; `body` en IBM Plex Sans 15 px ; quatre
  `@font-face` en `data:font/woff2;base64` ; repli `system-ui`. Poids inférieur à 307 200 octets, aucune
  URL externe. `@media print` redéfinit tous les jetons de couleur en clair. Les caractères
  non-caractères U+FFFE et U+FFFF de `esc()` sont écrits en séquences d'échappement.
- Barre d'étapes : compteur mono, barre de progression de 3 px et coche (SVG) pour `t0`, `t1`, `t2`.

---

## E. Bilan visuel de session, sauvegarde dans un dossier, stockage durable

Cette partie s'ajoute à A, B, C et D. Elle ne modifie aucun contrat existant. Aucune donnée de
santé réelle dans les tests et les captures (jeux fictifs seulement). Aucune requête réseau,
aucune ressource externe, aucune clé `localStorage` nouvelle. Les nouveaux éléments n'emploient
pas les `data-*` existants (`data-rate`, `data-item`, `data-obs`, `data-step`, `data-panel`,
`data-etat`, `data-cellule`, `data-point`, `data-x`, `data-y`, etc.) : ils emploient `data-vis`,
`data-cle`, `data-valeur`, `data-ratio`, `data-temps`, `data-code`, `data-delta`.

### E1. Bilan visuel de session (étape Synthèse)
Conteneur `#bilan-visuel`, premier bloc de `section[data-panel="synthese"]` (les `#score-*`,
`[data-manquants]`, la liste « À compléter » et les exports restent). Il est redessiné à chaque
affichage de l'étape, à chaque modification de données tant qu'elle est affichée, et avant
l'impression (il s'imprime avec la session). Les SVG sont créés par `createElementNS`,
`setAttribute` et `textContent` (jamais `innerHTML`). Les couleurs viennent des jetons `--bil-*`
existants (cotation 0 à 3, NA hachuré, T2, conditions) et de la charte, en clair, en sombre, et
en clair à l'impression. Chaque `svg` porte `role="img"` et un `aria-label` résumant son contenu.
Le bilan est lisible de 360 px à l'écran large, sans défilement horizontal de la page.

`GrilleHaptique.bilanVisuel()` renvoie, pour la session courante (modèle pur, sans DOM) :

```
{ total:{valeur,min:-3,max:39,manquants},
  axes:[{cle:"axe1"|"axe2"|"axe3"|"axe4",libelle,valeur,min,max,manquants} x4],
        // min/max : axe1 -3/9, axe2 0/12, axe3 0/9, axe4 0/9 ; valeur = scores existants (null si non calculable)
  items:[{code,groupe:"T0"|"AXE1"|"AXE2"|"AXE3"|"AXE4",valeur:0|1|2|3|"NA"|null} x19],
  t2:[{cle:"tonus"|"posture"|"emotion"|"relation",libelle,valeur:-1|0|1|null} x4],
  physio:[{cle:"fc"|"vfc"|"ced"|"spo2",libelle,unite,points:[{temps:"t0"|"t1"|"rupture"|"t2",valeur:number|null} x4]} x4],
  precedente:null | {id,session_no,date,deltas:{axe1,axe2,axe3,axe4,total}} }
```

`precedente` est la session précédente du même participant (C1 : même code non vide, casse
ignorée), dans l'ordre chronologique C1.2, avant la session courante ; `null` s'il n'y en a pas
ou si le code est vide. `deltas` = courante moins précédente, `null` si l'un des deux est `null`.
Les libellés de `t2` sont courts (Tonus, Posture, Émotion, Relation).

Éléments, tous dans `#bilan-visuel` :
1. `#vis-jauge` : jauge en demi-cercle de l'indice global (conteneur `role="img"` portant
   l'`aria-label`, qui contient le `svg`). `[data-vis="jauge-arc"]` porte `data-ratio` =
   (valeur - min) / (max - min) borné à [0, 1], arrondi à 3 décimales ; l'attribut est absent si la
   valeur est `null`. Le texte central est la valeur ou « - ». `aria-label` : « Indice global :
   20 sur 39 » ou « Indice global : non calculable ».
2. `#vis-radar` : radar des 4 axes (axe 1 en haut, 2 à droite, 3 en bas, 4 à gauche). Un
   `[data-vis="radar-sommet"][data-cle="axeN"]` par axe, avec `data-valeur` (vide si `null`) et
   `data-ratio` (même formule, avec min et max de l'axe ; absent si `null`) ; un polygone
   `[data-vis="radar-forme"]` (le sommet d'un axe `null` est placé au centre) ; 4 anneaux de
   référence `[data-vis="radar-anneau"]` (25, 50, 75, 100 %) ; étiquettes des axes avec la valeur.
3. `#vis-bande-items` : une cellule `[data-vis="cellule"][data-code="T0.1"]` par item (19 ; ordre
   T0.1 à T0.5 puis V1.1 à V4.3), disposées en une ligne par groupe (T0, Axe 1 à Axe 4), avec
   `data-valeur` (« 0 » à « 3 », « NA », vide si non coté), colorée comme les grilles du bilan
   participant (C3). `#vis-legende-items` : légende des 5 états (0, 1, 2, 3, NA) ; une case vide
   signifie « non coté ».
4. `#vis-t2` : 4 repères `[data-vis="t2"][data-cle="tonus|posture|emotion|relation"]` avec
   `data-valeur` (« -1 », « 0 », « 1 », vide) : triangle haut (+1), carré (0), triangle bas (-1),
   couleur de la palette T2, valeur et libellé court.
5. `#vis-physio` : pour chaque mesure ayant au moins une valeur, un mini graphique `svg`
   `[data-vis="physio"][data-cle="fc"]` à 4 positions fixes en abscisse (T0, T1, Rupture, T2).
   `[data-vis="physio-point"][data-cle="fc"][data-temps="t1"]` porte `data-valeur` pour chaque
   valeur non nulle ; une polyligne `[data-vis="physio-ligne"]` relie les points consécutifs non
   nuls (une valeur absente interrompt la ligne). L'ordonnée est mise à l'échelle sur [min, max]
   de la série ; une seule valeur, ou une série constante, est placée au centre. Les valeurs sont
   écrites près des points, l'unité en légende. Une mesure sans aucune valeur est omise ; sans
   aucune valeur du tout, `#vis-physio` contient le texte « Aucune mesure saisie ».
6. `#vis-comparaison` : si `precedente`, 5 repères `[data-vis="delta"][data-cle="axe1|axe2|axe3|axe4|total"]`
   avec `data-delta` (« +3 », « -2 », « 0 », vide si non calculable), flèche (haut, bas, égal) et
   texte, puis la mention « par rapport à S<n> (jj/mm/aaaa) ». Sinon, si le code est non vide :
   « Première session de ce participant ». Si le code est vide : élément vide (son bloc est masqué).

### E2. Sauvegarde automatique dans un dossier (Chromium : Chrome, Edge)
Le panneau Sessions (`#panneau-sessions`) contient un bloc de sauvegarde :
`#btn-dossier-sauvegarde` (« Choisir un dossier de sauvegarde »), `#etat-dossier` (texte d'état,
attribut `data-etat-dossier`), `#aide-dossier`, `#btn-dossier-reautoriser` (« Réactiver la
sauvegarde dans le dossier », visible seulement à l'état `a-reautoriser`) et `#btn-lire-dossier`
(« Importer depuis le dossier », visible si un dossier est actif). Texte exact de `#aide-dossier` :
« Sauvegarde locale en fichiers sur ce poste, un dossier par participant. Ce sont des données de
santé pseudonymisées : ne les placez pas dans un stockage partagé ou en ligne. Pour retrouver des
résultats, importez les fichiers .json dans l'appli sur ce poste. »

- **Détection** : sans `window.showDirectoryPicker`, `#btn-dossier-sauvegarde` est désactivé,
  `#aide-dossier` dit « Disponible dans Chrome et Edge sur ordinateur » et l'état est `indisponible`.
- **Choix** : `showDirectoryPicker({mode:"readwrite"})`, sur geste utilisateur. Annulation
  (`AbortError`) : état inchangé, aucun message d'erreur.
- **API de fichiers utilisées, et seulement celles-ci** (un faux dossier en mémoire suffit aux
  tests) : `name`, `kind`, `getDirectoryHandle(nom,{create})`, `getFileHandle(nom,{create})`,
  `removeEntry(nom)`, `values()` (itérateur asynchrone), `queryPermission({mode:"readwrite"})`,
  `requestPermission({mode:"readwrite"})`, `createWritable()` puis `write(chaine)` et `close()`,
  `getFile()` puis `text()`.
- **Écritures** : après chaque enregistrement local réussi, avec anti-rebond de 1,5 s
  (`GrilleHaptique.ecrireDossier()` force l'écriture immédiate et renvoie une promesse), et à
  l'activation du dossier : (a) `grille-haptique_sauvegarde.json` à la racine = sauvegarde
  complète (même contenu que `#btn-export-tout`) ; (b) pour chaque session, un fichier dans un
  sous-dossier par participant : `<code>/grille-haptique_<code>_S<n>_<date>_<id>.json`, contenu =
  la session (schéma `grille-haptique/1`, même JSON que `#btn-export-json`). `<code>` est le code
  affiché ; sous-dossier `sans-code` s'il est vide ; les parties vides du nom sont remplacées par
  `x` (B8). Un fichier n'est réécrit que si la session a changé depuis sa dernière écriture
  (comparaison de `modifie_le`) ; la sauvegarde complète n'est réécrite que si l'ensemble a changé.
  Dans le nom, les caractères de `<id>` autres que lettres, chiffres, `_` et `-` sont remplacés par `-`.
- **Suppression d'une session** (panneau Sessions, vue Participants, effacement total) :
  suppression au mieux de son fichier (recherche, dans le sous-dossier de son ancien code, des
  fichiers finissant par `_<id>.json`), pour qu'une lecture ultérieure ne la ressuscite pas ; la
  sauvegarde complète est réécrite. Les sous-dossiers devenus vides ne sont pas supprimés.
- **Changement de code, de numéro ou de date** d'une session : l'ancien fichier (même `<id>`)
  est supprimé et le nouveau écrit.
- **Lecture** : `#btn-lire-dossier` (et `GrilleHaptique.lireDossier()`, promesse du nombre de
  sessions importées) lit récursivement tous les `*.json` du dossier choisi, ignore sans message
  ceux qui ne sont pas au schéma `grille-haptique/1`, accepte une session seule ou une sauvegarde
  complète, fusionne par `id` comme l'import (la plus récente `modifie_le` l'emporte), affiche
  « n session(s) importée(s) depuis le dossier » dans le message du panneau et redessine la vue ouverte.
- **Mémorisation** : le handle du dossier est mémorisé dans IndexedDB (base
  `grilleHaptique.v1.dossier`). Un échec de mémorisation (IndexedDB absent, objet non clonable)
  est toléré : l'état est `actif` pour cette page seulement, sans erreur bloquante. Au chargement,
  si un handle est retrouvé, `queryPermission` donne : `granted` : état `actif` (écriture reprise) ;
  `prompt` : état `a-reautoriser` (le bouton appelle `requestPermission` sur geste utilisateur) ;
  `denied` ou erreur : état `inactif`.
- **Erreurs d'écriture** : jamais bloquantes ; état `erreur` avec message dans `#etat-dossier`,
  nouvelle tentative à la modification suivante ; l'enregistrement `localStorage` n'est jamais affecté.
- **États** de `#etat-dossier` (`data-etat-dossier`) : `indisponible`, `inactif`, `actif`,
  `a-reautoriser`, `erreur`. Texte à l'état actif : « Sauvegarde dans le dossier <nom> : dernière
  écriture à hh:mm ».
- `GrilleHaptique.dossier()` renvoie `{etat, nom, derniereEcriture}` (`nom` vaut `""` sans dossier ;
  `derniereEcriture` en ISO ou `null`).
- Aucune requête réseau, aucune clé `localStorage` nouvelle.

### E3. Stockage durable
Au chargement, l'appli appelle `navigator.storage.persist()` si l'API existe (sans geste).
`#etat-stockage`, dans le panneau Sessions, affiche « Stockage durable : oui », « Stockage durable :
non (le navigateur peut l'effacer ; utilisez la sauvegarde dans un dossier) » ou « Stockage durable :
inconnu ». `GrilleHaptique.stockageDurable()` renvoie `true`, `false` ou `null`. Aucune erreur si
l'API est absente.

### E4. Documentation
Ce document : la présente partie E, et dans la partie A les paragraphes « Où sont les résultats
quand l'appli est fermée » et « Récupérer les résultats ».

### E5. Poids et hygiène
Fichier de moins de 307 200 octets. Aucun caractère invisible ni espace exotique, aucune
attribution ni commentaire de génération.

---

## F. Ergonomie globale (retrouver, remplir l'en-tête, affichage Grand)

### F0. Activation du dossier sans écrasement
À l'activation du dossier (choix, ou réactivation après autorisation à renouveler) et avant
toute écriture, l'appli lit le dossier, fusionne par `id` (la plus récente `modifie_le`
l'emporte, sessions inconnues conservées), puis écrit. Message « n session(s) retrouvée(s)
dans le dossier » quand n > 0. Un fichier de session n'est pas réécrit par une version plus
ancienne que celle lue dans le dossier.

### F1. Retrouver
- `#recherche-participant` (type search, « Rechercher un code »), `#compte-participants`,
  `#aucun-resultat` (« Aucun participant ne correspond »), `#tri-participants` (`code` par
  défaut, `recent`). Filtre conservé fiche -> liste, vidé à la fermeture de la vue.
- `#recents-details` (ouvert) et `#recents` : jusqu'à 5 autres sessions par `modifie_le`
  décroissant, `button[data-ouvrir-recent]`, « code | S<n> | jj/mm/aaaa | Cond. X | étape ».
- `GrilleHaptique.etapeReprise(session)` : `session`, `t0`, `t1`, `t2` ou `synthese`.
- `#recherche-session` et `#aucune-session` (« Aucune session ne correspond »).
- `#btn-reprendre-dernier` : session courante vierge et autre session avec code.

### F2. En-tête
Listes `#liste-codes`, `#liste-observateurs`, `#liste-diagnostics` ; « Numéro proposé : n » ;
`data-complet` sur l'étape Session ; heure de début renseignée au démarrage du minuteur en
T0 ou T1 si `#f-debut` est vide.

### F3. Affichage
`#btn-affichage` (`aria-pressed`), `document.documentElement.dataset.affichage` =
`standard` (défaut) ou `grand`, mémorisé dans `grilleHaptique.v1.affichage`,
`GrilleHaptique.affichage()`. Grand : base 18 px, boutons de cotation 60 px et 1,4 rem,
items sur une colonne, boutons d'étape et de navigation 52 px, sans défilement horizontal.

### F4. Ancre d'échelle
`.ancre` dans chaque item, visible quand l'item contient le focus, avec la définition de la
valeur du bouton focalisé (`data-ancre-valeur`). Informatif : n'écrit rien.

### F5. Rappel T0
`#rappel-t0` en tête de l'étape T2 : cinq cellules `[data-rappel-t0]` en lecture seule,
`data-valeur`, mises à jour en direct.
