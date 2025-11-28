import json
import csv
import os

# Chemins des fichiers
input_file = 'public/sante.geojson'
output_file = 'generaliste.csv'

print(f"Lecture de {input_file}...")

try:
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    features = data.get('features', [])
    print(f"Nombre total d'entrées trouvées : {len(features)}")

    # Filtrage et extraction
    medecins = []
    for feature in features:
        props = feature.get('properties', {})
        
        # Vérification de la catégorie (sensible à la casse, on sait jamais)
        categorie = props.get('Categorie', '')
        
        if categorie == "Médecin généraliste":
            coords_str = props.get('Coordonnées', '')
            x = ''
            y = ''
            
            # Traitement des coordonnées (Lat, Lon -> Lon, Lat pour OSRM)
            # Format attendu en entrée : "42.681512, 9.433763" (Lat, Lon)
            if coords_str and ',' in coords_str:
                try:
                    parts = coords_str.split(',')
                    if len(parts) == 2:
                        lat = parts[0].strip()
                        lon = parts[1].strip()
                        # On sépare en X (Lon) et Y (Lat) pour le CSV
                        x = lon
                        y = lat
                except:
                    pass

            medecins.append({
                'Nom': props.get('Nom', ''),
                'Commune': props.get('Commune', ''),
                'X': x, # Longitude
                'Y': y  # Latitude
            })

    print(f"Nombre de médecins généralistes trouvés : {len(medecins)}")

    # Écriture du CSV
    if medecins:
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['Nom', 'Commune', 'X', 'Y']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            writer.writeheader()
            for medecin in medecins:
                writer.writerow(medecin)
        
        print(f"Succès ! Le fichier '{output_file}' a été créé avec les colonnes X (Lon) et Y (Lat).")
    else:
        print("Aucun médecin généraliste trouvé. Vérifiez l'orthographe de la catégorie.")

except Exception as e:
    print(f"Une erreur est survenue : {e}")
