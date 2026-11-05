# Clipora Windows installer, revised 2026-11-01.
# PowerShell 5.1+; Windows 10/11 x64; requires internet and free disk space.
# Downloads verified official yt-dlp / FFmpeg release artifacts into tools\.
# Run: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
param([switch]$Force, [switch]$SkipFFmpeg)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$project = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $project 'tools'
New-Item -ItemType Directory -Path $tools -Force | Out-Null

# Pinned to an immutable upstream release. GitHub published this SHA-256 for
# the official Windows x64 binary (yt-dlp release 2026.10.26).
# Avoids the former fragile parsing of Invoke-WebRequest.Content for SHA2-256SUMS.
$ytVersion = '2026.10.26'
$ytSha256 = 'F5389D3698ECDE4EF06F4E6B1CE0294FE9AC1396228C8990B8D3416D6D177A7D'
$ytUrl = "https://github.com/yt-dlp/yt-dlp/releases/download/$ytVersion/yt-dlp.exe"

function Download-Asset([string]$url, [string]$destination, [long]$minBytes) {
    Write-Host "Downloading $url"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    if (Test-Path $destination) { Remove-Item -LiteralPath $destination -Force }
    Invoke-WebRequest -Uri $url -OutFile $destination -UseBasicParsing -MaximumRedirection 10
    if (!(Test-Path $destination) -or (Get-Item -LiteralPath $destination).Length -lt $minBytes) {
        throw "Incomplete or unexpectedly small download: $destination"
    }
}

function Assert-Sha256([string]$file, [string]$expected) {
    if ($expected -notmatch '^[0-9a-fA-F]{64}$') { throw 'Invalid SHA-256 digest in checksum metadata.' }
    $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
    if ($actual -ine $expected) { throw "SHA-256 mismatch for $(Split-Path -Leaf $file). Expected $expected; downloaded $actual. Installation stopped." }
    Write-Host "Verified SHA-256: $(Split-Path -Leaf $file)" -ForegroundColor Green
}

function Read-GnuChecksum([string]$manifest, [string]$fileName) {
    # Read a downloaded checksum file as UTF-8 TEXT. Invoke-WebRequest.Content
    # can be byte[] on Windows PowerShell 5.1 for application/octet-stream.
    $content = [System.IO.File]::ReadAllText($manifest, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
    foreach ($line in ($content -split "`r?`n")) {
        # GNU sha256sum: <64 hex> <space><space or *> filename
        if ($line -match '^\s*([0-9a-fA-F]{64})\s+\*?(.+?)\s*$') {
            $candidate = $Matches[2].Trim() -replace '\\', '/'
            if ($candidate -eq $fileName -or $candidate -eq "./$fileName") { return $Matches[1] }
        }
        # A couple of other commonly used checksum conventions.
        if ($line -match '^\s*SHA256\s*\(([^)]+)\)\s*=\s*([0-9a-fA-F]{64})\s*$') {
            if ($Matches[1].Trim() -eq $fileName) { return $Matches[2] }
        }
    }
    throw "Could not find a SHA-256 checksum for $fileName in the downloaded manifest. Not skipping verification."
}

try {
    $yt = Join-Path $tools 'yt-dlp.exe'
    $ytTemp = Join-Path $tools '_yt-dlp.download'
    if ($Force -or !(Test-Path $yt)) {
        try {
            Download-Asset $ytUrl $ytTemp 100000
            Assert-Sha256 $ytTemp $ytSha256
            Move-Item -LiteralPath $ytTemp -Destination $yt -Force
        } finally { Remove-Item -LiteralPath $ytTemp -Force -ErrorAction SilentlyContinue }
    } else {
        Write-Host 'yt-dlp.exe already exists; checking its pinned SHA-256...'
        Assert-Sha256 $yt $ytSha256
    }

    if (!$SkipFFmpeg) {
        $ffmpeg = Join-Path $tools 'ffmpeg.exe'
        $ffprobe = Join-Path $tools 'ffprobe.exe'
        if ($Force -or !(Test-Path $ffmpeg) -or !(Test-Path $ffprobe)) {
            $assetName = 'ffmpeg-master-latest-win64-gpl.zip'
            $releaseRoot = 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest'
            $zip = Join-Path $tools '_ffmpeg.zip'
            $checksums = Join-Path $tools '_ffmpeg.sha256'
            $stage = Join-Path $tools '_ffmpeg_unpack'
            try {
                Download-Asset "$releaseRoot/checksums.sha256" $checksums 100
                $sha = Read-GnuChecksum $checksums $assetName
                Download-Asset "$releaseRoot/$assetName" $zip 100000
                Assert-Sha256 $zip $sha
                Write-Host 'Extracting FFmpeg (large archive; requires free space)...'
                if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
                Expand-Archive -LiteralPath $zip -DestinationPath $stage -Force
                $a = Get-ChildItem -Path $stage -Filter 'ffmpeg.exe' -Recurse -File | Select-Object -First 1
                $b = Get-ChildItem -Path $stage -Filter 'ffprobe.exe' -Recurse -File | Select-Object -First 1
                if (!$a -or !$b) { throw 'FFmpeg archive does not contain both ffmpeg.exe and ffprobe.exe.' }
                Copy-Item -LiteralPath $a.FullName -Destination $ffmpeg -Force
                Copy-Item -LiteralPath $b.FullName -Destination $ffprobe -Force
            } finally {
                Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
                Remove-Item -LiteralPath $checksums -Force -ErrorAction SilentlyContinue
                Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
            }
        } else { Write-Host 'ffmpeg.exe and ffprobe.exe already exist; skipping FFmpeg download.' }
    }

    Write-Host "`nTool installation complete." -ForegroundColor Green
    & (Join-Path $tools 'yt-dlp.exe') --version
    if ($LASTEXITCODE -ne 0) { throw 'yt-dlp did not run successfully.' }
    if (!$SkipFFmpeg) {
        & (Join-Path $tools 'ffmpeg.exe') -version | Select-Object -First 1
        if ($LASTEXITCODE -ne 0) { throw 'FFmpeg did not run successfully.' }
    }
    Write-Host 'Next: npm.cmd run doctor; npm.cmd run dev' -ForegroundColor Cyan
} catch {
    Write-Host "`nInstall failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Check GitHub connectivity and free space on the project drive.' -ForegroundColor Yellow
    exit 1
}
