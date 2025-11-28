# -----------------------------------------------------------------------------
# PowerShell Script: Assign Communes Colors Based on Block Size (45 rows)
# -----------------------------------------------------------------------------

# --- 1. Configuration ---

# **IMPORTANT: REPLACE THESE PLACEHOLDERS WITH YOUR ACTUAL 8 COLOR HEX CODES**
$ColorPalette = @(
    '#66c2a5',  # Color 1 (Example: Vibrant Red)
    '#fc8d62',  # Color 2 (Example: Bright Green)
    '#8da0cb',  # Color 3 (Example: Deep Blue)
    '#e78ac3',  # Color 4 (Example: Hot Pink)
    '#a6d854',  # Color 5 (Example: Cyan)
    '#ffd92f',  # Color 6 (Example: Gold/Yellow)
    '#e5c494',  # Color 7 (Example: Maroon)
    '#b3b3b3'   # Color 8 (Example: Dark Berry)
)

# Define the number of rows per color block
$BlockSize = 45

# Define file paths
$InputFile = "communes_avec_coords.csv"
$OutputFile = "communes_avec_coords_colored.csv"

# Define the column to sort by (e.g., 'CommuneName', 'Name', etc.)
# **UPDATE THIS if your column name is different!**
$SortColumn = "NOM"


# --- 2. Script Logic ---

try {
    # 1. Import the CSV content
    Write-Host "Importing data from $InputFile..."
    $Data = Import-Csv -Path $InputFile

    # Check if the sort column exists
    if (-not ($Data | Get-Member -Name $SortColumn -MemberType NoteProperty)) {
        throw "The sorting column '$SortColumn' was not found in the CSV. Please update the `$SortColumn` variable in the script."
    }

    # 2. Sort the data alphabetically
    Write-Host "Sorting data alphabetically by '$SortColumn'..."
    $SortedData = $Data | Sort-Object -Property $SortColumn

    # 3. Iterate and assign colors
    Write-Host "Assigning colors in blocks of $BlockSize..."
    $TotalRows = $SortedData.Count
    $NewData = @()

    for ($i = 0; $i -lt $TotalRows; $i++) {
        # Calculate the index for the color palette based on the block size
        # [Math]::Floor($i / 45) will return 0 for rows 0-44, 1 for rows 45-89, etc.
        $ColorIndex = [Math]::Floor($i / $BlockSize)

        # Get the color from the palette, ensuring the index wraps around or stops 
        # at the end of the palette (though with 396/45, it uses exactly 8 colors)
        if ($ColorIndex -lt $ColorPalette.Count) {
            $AssignedColor = $ColorPalette[$ColorIndex]
        } else {
            # This should only happen if the row count exceeded the palette capacity
            $AssignedColor = "#b3b3b3" # Fallback color
        }

        # Add the new 'Color' property to the object
        $Row = $SortedData[$i]
        $Row | Add-Member -MemberType NoteProperty -Name "Color" -Value $AssignedColor -Force

        $NewData += $Row
    }

    # 4. Export the resulting data to a new CSV
    Write-Host "Exporting colored data to $OutputFile..."
    $NewData | Export-Csv -Path $OutputFile -NoTypeInformation

    Write-Host "✅ Process complete! The new file '$OutputFile' contains $TotalRows rows with the assigned colors."

} catch {
    Write-Error "An error occurred during script execution: $($_.Exception.Message)"
    Write-Host "Please ensure '$InputFile' exists and is readable, and check the '$SortColumn' name."
}