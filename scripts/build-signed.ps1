[CmdletBinding()]
param(
  [ValidateSet("win", "portable")]
  [string]$Target = "win",

  [string]$EnvFile = "signing.env.local",

  [switch]$ValidateOnly
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

$hasEnvFile = Test-Path -LiteralPath $resolvedEnvFile
if ($hasEnvFile) {
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
if (-not $isRemoteCertificate -and -not (Test-Path -LiteralPath $certificateLink)) {
  throw "Path sertifikat tidak ditemukan: $certificateLink"
}

if ($ValidateOnly) {
  Write-Host "Validasi signing environment berhasil untuk target '$Target'."
  exit 0
}

$npmScript = if ($Target -eq "portable") {
  "build:portable:signed"
} else {
  "build:win:signed"
}

Write-Host "Menjalankan npm run $npmScript"
& npm.cmd run $npmScript
exit $LASTEXITCODE
