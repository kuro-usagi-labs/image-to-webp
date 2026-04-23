[CmdletBinding()]
param(
  [ValidateSet("win", "portable")]
  [string]$Target = "portable",

  [string]$EnvFile = "signing.env.local"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedEnvFile = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
  $EnvFile
} else {
  Join-Path $projectRoot $EnvFile
}

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $item = Get-Item -Path "Env:$Name" -ErrorAction SilentlyContinue
  if ($null -eq $item) {
    return ""
  }

  return [string]$item.Value
}

function Set-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  [System.Environment]::SetEnvironmentVariable($Name, $Value, "Process")
}

function Clear-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  [System.Environment]::SetEnvironmentVariable($Name, $null, "Process")
}

function Load-EnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $lineNumber = 0
  foreach ($rawLine in Get-Content -LiteralPath $Path) {
    $lineNumber += 1
    $line = $rawLine.Trim()

    if (-not $line -or $line.StartsWith("#")) {
      continue
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -lt 1) {
      throw "Format env tidak valid di $Path baris $lineNumber."
    }

    $name = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    Set-EnvValue -Name $name -Value $value
  }
}

function Get-SigningValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PrimaryName,

    [Parameter(Mandatory = $true)]
    [string]$SecondaryName
  )

  $primary = Get-EnvValue -Name $PrimaryName
  if ($primary) {
    return $primary
  }

  return Get-EnvValue -Name $SecondaryName
}

function Ensure-CertificateInStore {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PfxPath,

    [Parameter(Mandatory = $true)]
    [securestring]$Password
  )

  $pfxData = Get-PfxData -FilePath $PfxPath -Password $Password
  $leafCertificate = $pfxData.EndEntityCertificates | Select-Object -First 1

  if ($null -eq $leafCertificate) {
    throw "Sertifikat end-entity tidak ditemukan di PFX: $PfxPath"
  }

  $existing = Get-ChildItem -Path "Cert:\CurrentUser\My\$($leafCertificate.Thumbprint)" -ErrorAction SilentlyContinue
  if ($null -eq $existing) {
    $imported = Import-PfxCertificate -FilePath $PfxPath -CertStoreLocation "Cert:\CurrentUser\My" -Password $Password -Exportable
    $existing = $imported | Select-Object -First 1
  }

  if ($null -eq $existing) {
    throw "Gagal mengimpor sertifikat signing ke CurrentUser\\My."
  }

  return $existing
}

function Ensure-TrustedForCurrentUser {
  param(
    [Parameter(Mandatory = $true)]
    [System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate
  )

  foreach ($storeName in @("Root", "TrustedPublisher")) {
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($storeName, "CurrentUser")
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    try {
      $exists = $store.Certificates.Find(
        [System.Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint,
        $Certificate.Thumbprint,
        $false
      )

      if ($exists.Count -eq 0) {
        $store.Add($Certificate)
      }
    }
    finally {
      $store.Close()
    }
  }
}

function Sign-Files {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Paths,

    [Parameter(Mandatory = $true)]
    [System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate
  )

  foreach ($path in $Paths) {
    $signature = Set-AuthenticodeSignature -LiteralPath $path -Certificate $Certificate -HashAlgorithm SHA256
    if ([string]$signature.Status -ne "Valid") {
      throw "Gagal menandatangani $path. Status: $($signature.Status)"
    }
  }
}

function Get-ExeFiles {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Root,

    [switch]$Recurse
  )

  $params = @{
    LiteralPath = $Root
    File = $true
    Filter = "*.exe"
  }

  if ($Recurse) {
    $params.Recurse = $true
  }

  return @(Get-ChildItem @params | Sort-Object FullName | Select-Object -ExpandProperty FullName)
}

if (Test-Path -LiteralPath $resolvedEnvFile) {
  Load-EnvFile -Path $resolvedEnvFile
  Write-Host "Signing env dimuat dari $resolvedEnvFile"
}

$certificateLink = Get-SigningValue -PrimaryName "WIN_CSC_LINK" -SecondaryName "CSC_LINK"
$certificatePassword = Get-SigningValue -PrimaryName "WIN_CSC_KEY_PASSWORD" -SecondaryName "CSC_KEY_PASSWORD"

if (-not $certificateLink) {
  throw "WIN_CSC_LINK atau CSC_LINK belum diisi. Isi file signing.env.local atau set environment variable terlebih dahulu."
}

if (-not $certificatePassword) {
  throw "WIN_CSC_KEY_PASSWORD atau CSC_KEY_PASSWORD belum diisi. Isi file signing.env.local atau set environment variable terlebih dahulu."
}

$isRemoteCertificate = $certificateLink -match '^(https?|file)://'
if ($isRemoteCertificate) {
  throw "Workflow self-signed lokal membutuhkan path file .pfx lokal, bukan URL: $certificateLink"
}

if (-not (Test-Path -LiteralPath $certificateLink)) {
  throw "Path sertifikat tidak ditemukan: $certificateLink"
}

$securePassword = ConvertTo-SecureString -String $certificatePassword -AsPlainText -Force
$certificate = Ensure-CertificateInStore -PfxPath $certificateLink -Password $securePassword
Ensure-TrustedForCurrentUser -Certificate $certificate

foreach ($envName in @("WIN_CSC_LINK", "CSC_LINK", "WIN_CSC_KEY_PASSWORD", "CSC_KEY_PASSWORD")) {
  Clear-EnvValue -Name $envName
}

Push-Location $projectRoot
try {
  & node .\scripts\clean-dist.js
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  & npx.cmd electron-builder --win --dir
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  $unpackedDir = Join-Path $projectRoot "dist-electron\win-unpacked"
  $unpackedExecutables = @(Get-ExeFiles -Root $unpackedDir -Recurse)
  if ($unpackedExecutables.Count -eq 0) {
    throw "Tidak ada file .exe di $unpackedDir untuk ditandatangani."
  }

  Write-Host "Menandatangani binary di $unpackedDir"
  Sign-Files -Paths $unpackedExecutables -Certificate $certificate

  $packageTarget = if ($Target -eq "win") { "nsis" } else { "portable" }
  Write-Host "Memaketkan target $packageTarget dari prepackaged app"
  & npx.cmd electron-builder --prepackaged $unpackedDir --win $packageTarget
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  $topLevelExecutables = @(Get-ExeFiles -Root (Join-Path $projectRoot "dist-electron"))
  if ($topLevelExecutables.Count -gt 0) {
    Write-Host "Menandatangani artifact final di dist-electron"
    Sign-Files -Paths $topLevelExecutables -Certificate $certificate
  }

  $verified = @()
  foreach ($path in ((@($unpackedExecutables) + @($topLevelExecutables)) | Select-Object -Unique)) {
    $signature = Get-AuthenticodeSignature -LiteralPath $path
    if ([string]$signature.Status -ne "Valid") {
      throw "Verifikasi signature gagal untuk $path. Status: $($signature.Status)"
    }

    $verified += [PSCustomObject]@{
      Path = $path
      Status = [string]$signature.Status
      Signer = $signature.SignerCertificate.Subject
    }
  }

  $verified | Format-Table -AutoSize
}
finally {
  Pop-Location
}
