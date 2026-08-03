# regenerate-icons.ps1
# ─────────────────────────────────────────────────────────────────────────────
# Regenerates the Android/iOS launcher icon assets at the sizes Expo's tooling
# expects (1024x1024). It upscales the existing 500px sources with bicubic
# resampling and corrects the adaptive-icon safe zone for the foreground.
#
# Idempotent: originals are backed up once to assets/images/_icon_originals/
# and restored from there on every run, so re-running is safe.
#
# Usage (from the `mobile` directory):
#   powershell -ExecutionPolicy Bypass -File ./scripts/regenerate-icons.ps1

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$outSize  = 1024
$safeZone = 0.66   # adaptive-icon foreground content must sit in central ~66%

$base     = Join-Path $PSScriptRoot '..\assets\images'
$backup   = Join-Path $base '_icon_originals'
$targets  = @(
    'main-app-icon.png',
    'android-icon-foreground.png',
    'android-icon-monochrome.png',
    'android-icon-background.png'
)

# Ensure originals are preserved on first run.
if (-not (Test-Path -LiteralPath $backup)) {
    New-Item -ItemType Directory -Path $backup | Out-Null
    foreach ($name in $targets) {
        $full = Join-Path $base $name
        if (Test-Path -LiteralPath $full) {
            Copy-Item -LiteralPath $full -Destination (Join-Path $backup $name)
        }
    }
    Write-Host "Backed up originals to $backup`n"
}

function Resize-Icon {
    param(
        [string]$Name,
        [int]$Size,
        [double]$Bleed  # 1.0 = fill whole canvas, <1 = centered in safe zone (transparent padding)
    )

    $srcFull = Join-Path $backup $Name
    $dstFull = Join-Path $base $Name

    if (-not (Test-Path -LiteralPath $srcFull)) {
        Write-Host "SKIP (no original): $Name"
        return
    }

    $src = [System.Drawing.Bitmap]::FromFile($srcFull)

    # Content area drawn on the final canvas
    $drawW = [int][math]::Round($Size * $Bleed)
    $drawH = [int][math]::Round($Size * $Bleed)
    $offX  = [int][math]::Round(($Size - $drawW) / 2.0)
    $offY  = [int][math]::Round(($Size - $drawH) / 2.0)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($src, $offX, $offY, $drawW, $drawH)

    $g.Dispose()
    $src.Dispose()

    $bmp.Save($dstFull, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "OK ($($Size)x$($Size), bleed $([int]($Bleed*100))%): $Name"
}

# Legacy app icon (`icon`) - full bleed, 1024x1024
Resize-Icon -Name 'main-app-icon.png' -Size $outSize -Bleed 1.0

# Adaptive icon layers (must share identical dimensions) - 1024x1024.
# Foreground/monochrome keep artwork inside the central safe zone.
Resize-Icon -Name 'android-icon-foreground.png' -Size $outSize -Bleed $safeZone
Resize-Icon -Name 'android-icon-monochrome.png' -Size $outSize -Bleed $safeZone
Resize-Icon -Name 'android-icon-background.png' -Size $outSize -Bleed 1.0

Write-Host "`nDone. Re-run 'npx expo prebuild' / 'eas build' to apply."
