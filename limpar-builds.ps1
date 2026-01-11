# Script para limpar pastas de build e cache do projeto Void
# Autor: Sistema de limpeza automática
# Data: 2025-01-06

Write-Host "=== LIMPEZA DE PASTAS DE BUILD E CACHE ===" -ForegroundColor Yellow
Write-Host ""

# Definir pastas a serem removidas
$foldersToRemove = @(
    ".\void\.build",
    ".\void\out",
    ".\void\out-vscode",
    ".\void\build",
    ".\backup_20260106_180733",
    ".\backup_20260106_180722"
)

$totalFreed = 0
$removedFolders = @()

foreach ($folder in $foldersToRemove) {
    if (Test-Path $folder) {
        Write-Host "Calculando tamanho de: $folder" -ForegroundColor Cyan
        $size = (Get-ChildItem -Path $folder -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1GB
        $sizeGB = [math]::Round($size, 2)
        
        Write-Host "  Tamanho: $sizeGB GB" -ForegroundColor White
        
        Write-Host "  Removendo..." -ForegroundColor Yellow
        try {
            Remove-Item -Path $folder -Recurse -Force -ErrorAction Stop
            Write-Host "  ✓ Removido com sucesso!" -ForegroundColor Green
            $totalFreed += $size
            $removedFolders += @{Path = $folder; Size = $sizeGB}
        }
        catch {
            Write-Host "  ✗ Erro ao remover: $_" -ForegroundColor Red
        }
    }
    else {
        Write-Host "  Pasta não encontrada: $folder" -ForegroundColor Gray
    }
    Write-Host ""
}

# Limpar também node_modules de build se existir
if (Test-Path ".\void\build\node_modules") {
    Write-Host "Removendo node_modules do build..." -ForegroundColor Cyan
    $size = (Get-ChildItem -Path ".\void\build\node_modules" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1GB
    $sizeGB = [math]::Round($size, 2)
    Write-Host "  Tamanho: $sizeGB GB" -ForegroundColor White
    try {
        Remove-Item -Path ".\void\build\node_modules" -Recurse -Force -ErrorAction Stop
        Write-Host "  ✓ Removido com sucesso!" -ForegroundColor Green
        $totalFreed += $size
    }
    catch {
        Write-Host "  ✗ Erro ao remover: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# Resumo
Write-Host "=== RESUMO ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Pastas removidas:" -ForegroundColor Cyan
foreach ($item in $removedFolders) {
    Write-Host "  $($item.Path) - $($item.Size) GB" -ForegroundColor White
}
Write-Host ""
$totalFreedGB = [math]::Round($totalFreed, 2)
Write-Host "TOTAL LIBERADO: $totalFreedGB GB" -ForegroundColor Green
Write-Host ""
Write-Host "NOTA: Estas pastas podem ser regeneradas executando:" -ForegroundColor Yellow
Write-Host "  - npm install (para node_modules)" -ForegroundColor White
Write-Host "  - npm run compile (para pastas de build)" -ForegroundColor White
Write-Host ""








