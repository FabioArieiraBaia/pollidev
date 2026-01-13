# Script para Submeter PolliDev ao Pollinations
# PowerShell Script

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  PolliDev → Pollinations PR Setup  " -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Passo 1: Verificar se o fork do pollinations existe
Write-Host "[1/8] Verificando fork do Pollinations..." -ForegroundColor Yellow
$pollinationsPath = "C:\xampp\htdocs\pollinations"

if (Test-Path $pollinationsPath) {
    Write-Host "✓ Fork encontrado em: $pollinationsPath" -ForegroundColor Green
} else {
    Write-Host "✗ Fork não encontrado. Clonando..." -ForegroundColor Red
    Set-Location "C:\xampp\htdocs"
    git clone https://github.com/FabioArieiraBaia/pollinations.git
}

# Passo 2: Atualizar fork com upstream
Write-Host ""
Write-Host "[2/8] Atualizando fork com upstream..." -ForegroundColor Yellow
Set-Location $pollinationsPath

# Adicionar upstream se não existir
$remotes = git remote
if ($remotes -notcontains "upstream") {
    git remote add upstream https://github.com/pollinations/pollinations.git
    Write-Host "✓ Upstream adicionado" -ForegroundColor Green
}

git fetch upstream
git checkout main
git merge upstream/main
git push origin main
Write-Host "✓ Fork atualizado" -ForegroundColor Green

# Passo 3: Criar branch para o PR
Write-Host ""
Write-Host "[3/8] Criando branch para o PR..." -ForegroundColor Yellow
$branchName = "add-pollidev-to-community-projects"
git checkout -b $branchName
Write-Host "✓ Branch '$branchName' criada" -ForegroundColor Green

# Passo 4: Backup do README original
Write-Host ""
Write-Host "[4/8] Fazendo backup do README..." -ForegroundColor Yellow
Copy-Item "README.md" "README.md.backup"
Write-Host "✓ Backup criado" -ForegroundColor Green

# Passo 5: Mostrar onde adicionar
Write-Host ""
Write-Host "[5/8] Preparando entrada para README.md..." -ForegroundColor Yellow
Write-Host ""
Write-Host "======================================" -ForegroundColor Magenta
Write-Host "ADICIONE A SEGUINTE LINHA AO README.md" -ForegroundColor Magenta
Write-Host "Na seção 'Community Projects' (linha ~240)" -ForegroundColor Magenta
Write-Host "======================================" -ForegroundColor Magenta
Write-Host ""
$entry = @"
| PolliDev 💻 ([⭐ stars](https://github.com/FabioArieiraBaia/pollidev/stargazers)) | [🔗](https://github.com/FabioArieiraBaia/pollidev) | AI-powered development environment with native Pollinations integration. Full-featured IDE built on VS Code with text/image generation, code completion, and multi-model support. | TypeScript, Electron, VS Code |
"@
Write-Host $entry -ForegroundColor White
Write-Host ""

# Salvar entrada em arquivo
$entry | Out-File -FilePath "POLLIDEV_ENTRY.txt" -Encoding UTF8
Write-Host "✓ Entrada salva em: POLLIDEV_ENTRY.txt" -ForegroundColor Green

# Passo 6: Abrir arquivo para edição
Write-Host ""
Write-Host "[6/8] Abrindo README.md para edição..." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  INSTRUÇÕES:" -ForegroundColor Yellow
Write-Host "1. Encontre a seção 'Community Projects'" -ForegroundColor White
Write-Host "2. Localize a linha que começa com '| CatGPT Meme Generator'" -ForegroundColor White
Write-Host "3. Adicione a entrada do PolliDev APÓS essa linha" -ForegroundColor White
Write-Host "4. Salve o arquivo (Ctrl+S)" -ForegroundColor White
Write-Host "5. Feche o editor" -ForegroundColor White
Write-Host ""
Read-Host "Pressione Enter para abrir o editor"

notepad.exe "README.md"

# Passo 7: Verificar se foi editado
Write-Host ""
Write-Host "[7/8] Verificando alterações..." -ForegroundColor Yellow
$gitDiff = git diff README.md
if ($gitDiff) {
    Write-Host "✓ Alterações detectadas no README.md" -ForegroundColor Green
    Write-Host ""
    Write-Host "Diff:" -ForegroundColor Cyan
    git diff README.md
} else {
    Write-Host "✗ Nenhuma alteração detectada!" -ForegroundColor Red
    Write-Host "Por favor, adicione a entrada manualmente e execute novamente" -ForegroundColor Yellow
    exit
}

# Passo 8: Commit e Push
Write-Host ""
Write-Host "[8/8] Fazendo commit e push..." -ForegroundColor Yellow
git add README.md
git commit -m "Add PolliDev to Community Projects

PolliDev is an AI-powered development environment built on VS Code with native Pollinations.ai integration.

Features:
- Native Pollinations text and image API integration
- AI-powered code completion and generation
- Multi-model AI support
- Full VS Code compatibility
- Cross-platform support (Windows, macOS, Linux)

Repository: https://github.com/FabioArieiraBaia/pollidev
License: MIT
Tech Stack: TypeScript, Electron, VS Code
"

git push origin $branchName
Write-Host "✓ Commit e push realizados" -ForegroundColor Green

# Instruções finais
Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  ✓ SETUP COMPLETO!  " -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Acesse: https://github.com/FabioArieiraBaia/pollinations" -ForegroundColor White
Write-Host "2. Clique no botão 'Compare & pull request'" -ForegroundColor White
Write-Host "3. Preencha o template do PR com:" -ForegroundColor White
Write-Host ""
Write-Host "   Título:" -ForegroundColor Cyan
Write-Host "   Add PolliDev to Community Projects" -ForegroundColor White
Write-Host ""
Write-Host "   Descrição:" -ForegroundColor Cyan
$prDescription = @"
## Description

This PR adds **PolliDev** to the Community Projects section.

## What is PolliDev?

PolliDev is an AI-powered integrated development environment built on Visual Studio Code architecture with **native Pollinations.ai API integration**. It provides developers with seamless access to AI models for code generation, completion, and image creation directly within a professional IDE.

## Key Features

- 🤖 Native Pollinations text and image API integration
- 💻 Built on VS Code architecture (full extension compatibility)
- 🎨 AI-powered code completion and generation
- 🖼️ Integrated image generation using Pollinations
- 🌐 Multi-model AI support (GPT, Claude, Llama, etc.)
- 🚀 Cross-platform (Windows, macOS, Linux)

## Why Add to Community Projects?

1. **Professional Tool**: First full-featured IDE with native Pollinations integration
2. **Active Development**: Version 1.96.0, actively maintained
3. **Open Source**: MIT licensed, encouraging community contributions
4. **Showcases Integration**: Demonstrates deep API integration possibilities
5. **Developer Adoption**: Brings Pollinations to professional development workflows

## Project Details

- **Repository**: https://github.com/FabioArieiraBaia/pollidev
- **License**: MIT
- **Tech Stack**: TypeScript, Electron, VS Code
- **Status**: Active Development
- **Version**: 1.96.0

## Checklist

- [x] Added to Community Projects table
- [x] Follows existing format
- [x] All links are functional
- [x] Project is open source
- [x] Project actively uses Pollinations APIs
- [x] Description is clear and concise

## Screenshots

[Add screenshots if requested]

---

Thank you for considering this contribution! PolliDev aims to bring the power of Pollinations.ai to developers worldwide through a familiar and powerful IDE experience.
"@
Write-Host $prDescription -ForegroundColor White
Write-Host ""

# Salvar descrição do PR
$prDescription | Out-File -FilePath "PR_DESCRIPTION.txt" -Encoding UTF8
Write-Host "✓ Descrição do PR salva em: PR_DESCRIPTION.txt" -ForegroundColor Green

Write-Host ""
Write-Host "4. Clique em 'Create pull request'" -ForegroundColor White
Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
