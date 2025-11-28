# Script: find_nearest_doctor.ps1
# Objectif: Pour chaque commune, trouver le médecin généraliste le plus proche (en temps de trajet).
# Méthode: Utilise l'API OSRM Table avec découpage par lots (Batching).

param (
    [string]$CommunesFile = "communes.csv",
    [string]$DoctorsFile = "generaliste.csv",
    [string]$OutputFile = "communes_with_doctors.csv",
    [string]$JsonOutputFile = "one_to_many.json"
)

# -----------------------------------------------------------------------------
# CONFIGURATION
# -----------------------------------------------------------------------------

$OSRM_TABLE_URL = "http://router.project-osrm.org/table/v1/driving"
$BATCH_SIZE = 100 # Increased from 40 to 100 to reduce total requests
$SLEEP_MS = 10    # Reduced from 100 to 10 to utilize Keep-Alive connection

# -----------------------------------------------------------------------------
# 1. CHARGEMENT DES DONNÉES
# -----------------------------------------------------------------------------

Write-Host "Chargement des fichiers..." -ForegroundColor Cyan

if (-not (Test-Path $CommunesFile) -or -not (Test-Path $DoctorsFile)) {
    Write-Error "Fichiers d'entrée introuvables."
    exit 1
}

# Charger les communes
$communes = Import-Csv -Path $CommunesFile -Delimiter ','
# Si le délimiteur a échoué (tout dans une colonne), réessayer avec point-virgule
if ($communes.Count -gt 0 -and $null -eq $communes[0].X) {
    $communes = Import-Csv -Path $CommunesFile -Delimiter ';'
}

# Charger les médecins et filtrer ceux sans coordonnées valides
$allDoctors = Import-Csv -Path $DoctorsFile | Where-Object { 
    -not [string]::IsNullOrWhiteSpace($_.X) -and -not [string]::IsNullOrWhiteSpace($_.Y) 
}

Write-Host "Communes à traiter : $($communes.Count)"
Write-Host "Médecins disponibles : $($allDoctors.Count)"

# -----------------------------------------------------------------------------
# 1b. PRÉPARATION DES COLONNES
# -----------------------------------------------------------------------------
# On s'assure que les colonnes existent sur TOUS les objets avant le traitement
$colsToEnsure = @("Medecin_Nom", "Medecin_Commune", "Temps_Medecin")

if ($communes.Count -gt 0) {
    foreach ($col in $colsToEnsure) {
        if ($null -eq $communes[0].PSObject.Properties[$col]) {
            Write-Host "Colonne '$col' introuvable. Elle sera créée." -ForegroundColor Cyan
            foreach ($commune in $communes) {
                $commune | Add-Member -MemberType NoteProperty -Name $col -Value "" -Force
            }
        } else {
            Write-Host "Colonne '$col' trouvée. Les valeurs seront mises à jour." -ForegroundColor Cyan
        }
    }
}

# -----------------------------------------------------------------------------
# 2. TRAITEMENT
# -----------------------------------------------------------------------------

$results = @()
$jsonResults = @()
$totalCommunes = $communes.Count
$currentCommuneIdx = 0

foreach ($commune in $communes) {
    $currentCommuneIdx++
    
    # Validation coordonnées commune
    $cX = $commune.X -replace ',', '.'
    $cY = $commune.Y -replace ',', '.'
    
    if ([string]::IsNullOrWhiteSpace($cX) -or [string]::IsNullOrWhiteSpace($cY)) {
        Write-Warning "Commune $($commune.Nom) ignorée (coords invalides)"
        $results += $commune
        continue
    }

    # Variables pour stocker le meilleur résultat pour CETTE commune
    $bestTime = [double]::PositiveInfinity
    $bestDoctorName = "Inconnu"
    $bestDoctorCommune = "Inconnue"
    $communeDoctorsList = @()

    # --- BOUCLE SUR LES LOTS DE MÉDECINS ---
    # On découpe la liste des médecins en petits paquets
    for ($i = 0; $i -lt $allDoctors.Count; $i += $BATCH_SIZE) {
        
        # Sélectionner le lot courant
        $batch = $allDoctors | Select-Object -Skip $i -First $BATCH_SIZE
        
        # Construire la liste des coordonnées pour l'URL
        # Format: Commune;Doc1;Doc2;Doc3...
        $coordsList = @("$cX,$cY") # L'index 0 est la commune (Source)
        
        foreach ($doc in $batch) {
            $dX = $doc.X -replace ',', '.'
            $dY = $doc.Y -replace ',', '.'
            $coordsList += "$dX,$dY"
        }
        
        $coordsString = $coordsList -join ';'
        
        # Destinations: Tous les index sauf 0 (1, 2, 3 ... N)
        $destIndices = (1..$batch.Count) -join ';'
        
        # URL: sources=0 (Commune vers tous les autres)
        $url = "${OSRM_TABLE_URL}/${coordsString}?sources=0&destinations=${destIndices}"

        try {
            $response = Invoke-RestMethod -Uri $url -Method Get
            
            if ($response.code -eq "Ok") {
                # durations[0] contient la liste des temps depuis la source vers les destinations
                $durations = $response.durations[0]
                
                # Parcourir les résultats de ce lot
                for ($j = 0; $j -lt $durations.Count; $j++) {
                    $durationSeconds = $durations[$j]
                    
                    if ($null -ne $durationSeconds) {
                        # Stocker pour le JSON
                        $min = [math]::Round($durationSeconds / 60, 2)
                        $communeDoctorsList += @{
                            Nom = $batch[$j].Nom
                            Commune = $batch[$j].Commune
                            Temps = $min
                        }

                        # Vérifier si c'est le meilleur
                        if ($durationSeconds -lt $bestTime) {
                            $bestTime = $durationSeconds
                            $bestDoctorName = $batch[$j].Nom
                            $bestDoctorCommune = $batch[$j].Commune
                        }
                    }
                }
            }
        }
        catch {
            Write-Warning "Erreur API sur un lot pour $($commune.Nom)"
        }
        
        # Petite pause pour l'API
        Start-Sleep -Milliseconds $SLEEP_MS
    }

    # Ajout au JSON global
    $jsonResults += @{
        Commune = $commune.Nom
        Medecins = $communeDoctorsList
    }

    # Conversion en minutes
    $finalTimeMin = if ($bestTime -eq [double]::PositiveInfinity) { "N/A" } else { [math]::Round($bestTime / 60, 2) }

    # Affichage progression
    $percent = [math]::Round(($currentCommuneIdx / $totalCommunes) * 100, 1)
    Write-Progress -Activity "Recherche du médecin le plus proche" -Status "$($commune.Nom) -> $bestDoctorName ($finalTimeMin min)" -PercentComplete $percent
    
    # Mise à jour des valeurs (les colonnes existent déjà)
    $commune.Medecin_Nom = $bestDoctorName
    $commune.Medecin_Commune = $bestDoctorCommune
    $commune.Temps_Medecin = $finalTimeMin
    
    $results += $commune
}

# -----------------------------------------------------------------------------
# 3. SAUVEGARDE
# -----------------------------------------------------------------------------

Write-Host ""
Write-Host "Sauvegarde dans $OutputFile..." -ForegroundColor Green
$results | Export-Csv -Path $OutputFile -NoTypeInformation -Encoding UTF8 -Delimiter ','

Write-Host "Sauvegarde du JSON dans $JsonOutputFile..." -ForegroundColor Green
$jsonResults | ConvertTo-Json -Depth 4 | Set-Content -Path $JsonOutputFile -Encoding UTF8

Write-Host "Terminé."
