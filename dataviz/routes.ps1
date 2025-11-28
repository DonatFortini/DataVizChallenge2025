# OSRM Route Calculator
# Reads a CSV with "Nom", "X", "Y" columns.
# Calculates driving time to a fixed destination (University: 42.3014161, 9.152352).
# Adds "Temps_fac" column (minutes) and updates the file.

param (
    [string]$InputFile = "communes.csv"
)

# -----------------------------------------------------------------------------
# CONFIGURATION
# -----------------------------------------------------------------------------

$OSRM_BASE_URL = "http://router.project-osrm.org/route/v1/driving"
# Fixed Destination: University
# Input format was Lat: 42.3014161, Lon: 9.152352
# OSRM requires Lon,Lat
$DEST_COORDS = "9.152352,42.3014161"

# -----------------------------------------------------------------------------
# PROCESS
# -----------------------------------------------------------------------------

if (-not (Test-Path $InputFile)) {
    Write-Error "Input file '$InputFile' not found."
    exit 1
}

Write-Host "Reading $InputFile..."
# Import CSV. Try default (comma) first.
$data = Import-Csv -Path $InputFile

# Check if columns exist or if we need to try semicolon
if ($data.Count -gt 0 -and ($null -eq $data[0].X -or $null -eq $data[0].Y)) {
    Write-Warning "Columns 'X' or 'Y' appear empty with default delimiter. Retrying with semicolon ';'."
    $data = Import-Csv -Path $InputFile -Delimiter ';'
}

if ($data.Count -gt 0 -and ($null -eq $data[0].X -or $null -eq $data[0].Y)) {
    Write-Error "Could not find columns 'X' and 'Y'. Found columns: $($data[0].PSObject.Properties.Name -join ', ')"
    exit 1
}

# Check for Temps_fac column and ensure it exists on all objects
if ($data.Count -gt 0) {
    if ($null -eq $data[0].PSObject.Properties["Temps_fac"]) {
        Write-Host "Column 'Temps_fac' not found. It will be created." -ForegroundColor Cyan
        # Initialize the column for all rows to ensure Export-Csv works correctly
        foreach ($row in $data) {
            $row | Add-Member -MemberType NoteProperty -Name "Temps_fac" -Value ""
        }
    } else {
        Write-Host "Column 'Temps_fac' found. Values will be updated." -ForegroundColor Cyan
    }
}

$results = @()
$total = $data.Count
$current = 0

foreach ($row in $data) {
    $current++
    $name = $row.Nom
    
    # Handle coordinates: Trim spaces, replace commas
    if ($null -ne $row.X -and $null -ne $row.Y) {
        $x = $row.X.ToString().Trim() -replace ',', '.'
        $y = $row.Y.ToString().Trim() -replace ',', '.'
    } else {
        $x = ""
        $y = ""
    }
    
    if ([string]::IsNullOrWhiteSpace($x) -or [string]::IsNullOrWhiteSpace($y)) {
        Write-Warning "Skipping $name : Invalid coordinates (X='$x', Y='$y')"
        $row | Add-Member -MemberType NoteProperty -Name "Temps_fac" -Value "Error" -Force
        $results += $row
        continue
    }
    
    $origin_coords = "$x,$y"
    
    # Construct URL for 1-to-1 route
    # Use string concatenation to avoid variable interpolation issues with '?'
    $url = $OSRM_BASE_URL + "/" + $origin_coords + ";" + $DEST_COORDS + "?overview=false"
    
    Write-Host "[$current/$total] Processing $name..." -NoNewline
    
    # DEBUG: Print the first URL to verify format
    if ($current -eq 1) {
        Write-Host ""
        Write-Host "DEBUG: First URL generated: $url" -ForegroundColor Cyan
        Write-Host "Processing $name..." -NoNewline
    }
    
    Write-Progress -Activity "Calculating routes" -Status "Processing $name ($current/$total)" -PercentComplete (($current / $total) * 100)
    
    try {
        # Call API
        $response = Invoke-RestMethod -Uri $url -Method Get
        
        # DEBUG: Print response for the first item
        if ($current -eq 1) {
             Write-Host ""
             Write-Host "DEBUG: First Response received:" -ForegroundColor Cyan
             Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor Gray
        }
        
        if ($response.code -eq "Ok") {
            # Duration is in seconds
            $durationSeconds = $response.routes[0].duration
            # Convert to minutes (round to 2 decimals)
            $durationMinutes = [math]::Round($durationSeconds / 60, 2)
            
            Write-Host " OK ($durationMinutes min)" -ForegroundColor Green
            
            # Add the new column
            $row | Add-Member -MemberType NoteProperty -Name "Temps_fac" -Value $durationMinutes -Force
        }
        else {
            Write-Host " ERROR (OSRM Code: $($response.code))" -ForegroundColor Red
            Write-Warning "URL used: $url"
            $row | Add-Member -MemberType NoteProperty -Name "Temps_fac" -Value "Error" -Force
        }
    }
    catch {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Warning "Request failed for ${name}: $_"
        Write-Warning "URL used: $url"
        $row | Add-Member -MemberType NoteProperty -Name "Temps_fac" -Value "Error" -Force
    }
    
    $results += $row
    
    # Be nice to the public demo server (Rate Limiting)
    Start-Sleep -Milliseconds 200
}

Write-Host "Saving results to $InputFile..."
$results | Export-Csv -Path $InputFile -NoTypeInformation -Encoding UTF8

Write-Host "Done."
