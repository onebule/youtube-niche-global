$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$appRoot = Split-Path -Parent $PSScriptRoot
function Test-Node([string]$Path) {
  if (-not (Test-Path $Path)) { return $false }
  try { & $Path -e 'if(parseInt(process.versions.node)<22)process.exit(1)' 2>$null; return $LASTEXITCODE -eq 0 } catch { return $false }
}
try {
  $architecture = $env:PROCESSOR_ARCHITECTURE
  if ($env:PROCESSOR_ARCHITEW6432) { $architecture = $env:PROCESSOR_ARCHITEW6432 }
  $arch = if ($architecture -eq 'ARM64') { 'arm64' } elseif ($architecture -eq 'AMD64') { 'x64' } else { throw '64-bit Windows 10 or newer is required.' }
  $runtimeDir = Join-Path $appRoot "runtime\win-$arch"
  $nodePath = Join-Path $runtimeDir 'node.exe'
  if (-not (Test-Node $nodePath)) {
    $systemNode = Get-Command node -ErrorAction SilentlyContinue
    if ($systemNode -and (Test-Node $systemNode.Source)) { $nodePath = $systemNode.Source }
    else {
      Write-Host 'First launch: downloading the official Node.js 22 runtime. No administrator access is required.'
      $runtimeRoot = Join-Path $appRoot 'runtime'
      New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
      $staging = Join-Path $runtimeRoot ('.install-' + [guid]::NewGuid().ToString())
      New-Item -ItemType Directory -Path $staging | Out-Null
      try {
        $manifest = Join-Path $staging 'checksums.txt'
        Invoke-WebRequest -UseBasicParsing -Uri 'https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt' -OutFile $manifest -TimeoutSec 120
        $match = Select-String -Path $manifest -Pattern "^([a-fA-F0-9]{64})\s+(node-(v22\.\d+\.\d+)-win-$arch\.zip)$" | Select-Object -First 1
        if (-not $match) { throw 'No matching official Node.js download was found.' }
        $expected = $match.Matches[0].Groups[1].Value
        $filename = $match.Matches[0].Groups[2].Value
        $version = $match.Matches[0].Groups[3].Value
        $archive = Join-Path $staging 'runtime.zip'
        Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/$version/$filename" -OutFile $archive -TimeoutSec 600
        if ((Get-FileHash -Algorithm SHA256 $archive).Hash -ne $expected) { throw 'Checksum mismatch. Nothing was installed. Please retry.' }
        Expand-Archive -LiteralPath $archive -DestinationPath $staging
        $extracted = Join-Path $staging ([IO.Path]::GetFileNameWithoutExtension($filename))
        if (-not (Test-Node (Join-Path $extracted 'node.exe'))) { throw 'Downloaded Node.js cannot run on this computer.' }
        if (Test-Path $runtimeDir) { Remove-Item -LiteralPath $runtimeDir -Recurse -Force }
        Move-Item -LiteralPath $extracted -Destination $runtimeDir
      } finally { if (Test-Path $staging) { Remove-Item -LiteralPath $staging -Recurse -Force } }
    }
  }
  & $nodePath (Join-Path $appRoot 'launcher.mjs')
  exit $LASTEXITCODE
} catch {
  Write-Host ('Startup failed: ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'Check your Internet connection, extracted folder permissions, or download Node.js 22+ from https://nodejs.org/'
  exit 1
}
