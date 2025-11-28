# DataViz Challenge 2025

## règlement du concours

L’objectif de ce concours est de réaliser, en temps contraint, une visualisation qui mette en valeur un jeu de données en libre accès ou fourni par les organisateurs.

### Les jeux de données

Attention: les donnée doivent provenir d'une source ouverte.

## Équipe DT-Viz

- **Théo N'gyuen Van Hoan** — Doctorant en informatique (3ᵉ année), UMR LISA  
    [GitHub](https://github.com/Orsucciu)
- **Donat Fortini** — Doctorant en informatique (1ʳᵉ année), UMR LISA

## Notre proposition

Nous proposons une visualisation interactive des services de santé, d'éducation et des infrastructures sportives en Corse. Cette cartographie intègre des données géographiques et des fonctionnalités de calcul d'itinéraires pour offrir une vue d'ensemble des ressources disponibles et mettre en évidence les disparités territoriales d'accès à ces services.

La géographie montagneuse de la Corse et la répartition dispersée de sa population créent des défis spécifiques d'accessibilité. En visualisant la répartition des services et les temps de transport associés, nous souhaitons illustrer ces enjeux territoriaux.

Dans cette application, vous retrouverez :

- partie introductive expliquant le contexte de la visualisation

- carte interactive affichant les services de santé, d'éducation et les infrastructures sportives selon trois visualisations :
  - heatmap de la répartition des services
  - anamorphose générée en fonction des services sélectionnés par l'utilisateur
  - parcours de vie : visualisation des trajets typiques d'un individu selon son lieu de résidence (accès aux services de santé, d'éducation et aux infrastructures sportives)

## Ressources

- Professionnels de santé — Corse  
    [Annuaire des professionnels de santé (localisation et tarifs) — data.corsica](https://www.data.corsica/explore/dataset/annuaire-sante-liste-localisation-et-tarifs-des-professionnels-de-sante2/information/)  
    Données : localisation, spécialités, tarifs. Vérifier la licence et les métadonnées sur la page du jeu de données.

- Établissements scolaires — Corse (2024)  
    [Liste des établissements scolaires en Corse — data.corsica](https://www.data.corsica/explore/dataset/liste-des-etablissements-scolaire-corse-en-2024/information/?disjunctive.epci&disjunctive.type_etabl)  
    Données : écoles, collèges, lycées, adresses et attributs administratifs.

- Équipements sportifs et lieux de pratique — Corse  
    [Recensement des équipements sportifs et lieux de pratique en Corse — data.corsica](https://www.data.corsica/explore/dataset/data-es-recensement-des-equipements-sportifs-et-lieux-de-pratique-complet/export/?location=10,42.10137,9.13307)
    Données : localisation et types d'équipements sportifs.

- Altimétrie (MNT) — RGE ALTI  
    [RGE ALTI (MNT) — géoservices IGN](https://geoservices.ign.fr/rgealti)  
    Modèle numérique de terrain de référence, utile pour visualisation 3D et calculs de distances / pentes.

- BD TOPO® — Données vectorielles de l'IGN
    [BD TOPO® — géoservices IGN](https://geoservices.ign.fr/bdtopo)
    Données vectorielles détaillées (routes, bâtiments, hydrographie, etc.) pour la Corse.
    Utilisé pour les limites administratives.

- Leaflet.js  
    [Leaflet — Leaflet](https://leafletjs.com/)  
    Bibliothèque JavaScript open-source pour la création de cartes interactives.

- OSRM
    [OSRM](https://project-osrm.org/)  
    Moteur de routage open-source pour calculer des itinéraires et des isochrones.
