# DataViz 2025 — Rappel du challenge

## Article 2 — Objet du concours

L’objectif de ce concours est de réaliser, en temps contraint, une visualisation qui mette en valeur un jeu de données en libre accès ou fourni par les organisateurs.

### Thématiques proposées

Les candidats peuvent choisir une des thématiques suivantes :

- Bien-être du territoire (bien‑être environnemental, bien‑être des populations, bien vieillir…)
- Valorisation des politiques publiques
- Portrait de territoires (géographie, population, infrastructures numériques, sports, scolarité, qualité de vie)

Les participants peuvent aussi proposer un sujet libre de leur choix.

### Prix

Le concours attribuera 3 prix :

- EDF
- Qualitair
- CorsicaFibra

### Les jeux de données

Attention: les donnée doivent provenir d'une source ouverte.

### Idée: La corse pour vous

Une carte de la corse avec les déformations, avec comment on vit l'île selon là où on est

Avec un petit texte de présentation,
Une carte de la corse en 3d...
...Qui s'aplatit pour montrer la réalité des distances dans un endroit montagneux

Puis ensuite, par commune (village?) une carte isochrone de la corse pour des "choses de la vie" qu'on trouvait importantes

- Ecoles
- Crèches
- Hopitaux
- Lieux de "sport"
- Peut-être mer/montagne
- Commerce alimentaire ?

### Défis

Générer une carte de la Corse en 3d
L'aplitir
Faire des cartes isochrones "à la volée"

### Ressources

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
