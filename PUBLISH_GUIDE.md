# Guia de Publicação no GitHub

Este guia explica como publicar o repositório PolliDev no GitHub.

## 📋 Pré-requisitos

- Conta no GitHub
- Git instalado
- Acesso ao terminal/command prompt

## 🚀 Passos para Publicar

### 1. Criar Repositório no GitHub

1. Acesse https://github.com
2. Clique no botão **"+"** no canto superior direito → **"New repository"**
3. Preencha:
   - **Repository name**: `pollidev` (ou outro nome de sua escolha)
   - **Description**: "Editor de código com inteligência artificial - Fork do Void/VSCode"
   - **Visibility**: Público ou Privado (sua escolha)
   - ⚠️ **NÃO** marque "Initialize this repository with a README" (já temos um)
4. Clique em **"Create repository"**

### 2. Inicializar Git (se necessário)

```bash
cd void
git init
```

### 3. Configurar Git (se ainda não configurado)

```bash
git config --global user.name "Fabio Arieira Baia"
git config --global user.email "seu-email@exemplo.com"
```

### 4. Adicionar Arquivos

```bash
# Verificar status
git status

# Adicionar todos os arquivos
git add .

# Fazer commit inicial
git commit -m "Initial commit: PolliDev - Editor de código com IA

- Fork do Void/VSCode
- Sistema RAG para busca semântica
- Suporte para múltiplos modelos de IA
- Automação de navegador integrada
- Desenvolvido por Fabio Arieira Baia"
```

### 5. Conectar ao GitHub

```bash
# Adicionar remote (substitua SEU_USUARIO pelo seu username do GitHub)
git remote add origin https://github.com/SEU_USUARIO/pollidev.git

# Verificar remote
git remote -v
```

### 6. Publicar no GitHub

```bash
# Renomear branch para main (se necessário)
git branch -M main

# Fazer push
git push -u origin main
```

## ⚠️ Importante: Atualizar URLs

Após criar o repositório no GitHub, você precisa atualizar as URLs nos seguintes arquivos:

1. **product.json** - Substitua `SEU_USUARIO` pelo seu username:
   - Linha 10: `licenseUrl`
   - Linha 11: `serverLicenseUrl`
   - Linha 32: `reportIssueUrl`
   - Linha 42: `linkProtectionTrustedDomains`

2. **README.md** - Substitua `SEU_USUARIO` pelo seu username:
   - Links do GitHub

3. **CONTRIBUTING.md** - Substitua `SEU_USUARIO` pelo seu username:
   - Links do GitHub

## 📝 Após Publicar

### Configurar Descrição do Repositório

No GitHub, vá em **Settings** → **General** → **Description**:
```
Editor de código com inteligência artificial baseado em Void/VSCode. Suporta múltiplos modelos de IA, busca semântica RAG, e automação de navegador.
```

### Adicionar Tópicos

No repositório, clique em ⚙️ (Settings) → **Topics** e adicione:
- `code-editor`
- `ai-assistant`
- `vscode-fork`
- `typescript`
- `pollidev`
- `full-stack`

### Criar Primeira Release

1. Vá em **Releases** → **"Create a new release"**
2. **Tag**: `v1.0.0`
3. **Title**: "PolliDev v1.0.0 - Initial Release"
4. **Description**: Copie do CHANGELOG.md

## 🔒 Segurança

Antes de fazer push, verifique:

- [ ] Nenhum arquivo com senhas ou API keys
- [ ] `.gitignore` configurado corretamente
- [ ] Nenhum arquivo sensível no código
- [ ] Pastas de backup excluídas

## 📦 Tamanho do Repositório

O repositório é grande. Se necessário, considere usar Git LFS para arquivos grandes:

```bash
git lfs install
git lfs track "*.png"
git lfs track "*.jpg"
git lfs track "*.ico"
```

## 🆘 Problemas Comuns

### Erro: "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/SEU_USUARIO/pollidev.git
```

### Erro: "failed to push some refs"
```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

### Arquivo muito grande
Verifique arquivos grandes:
```bash
find . -type f -size +50M -not -path "./node_modules/*" -not -path "./.git/*"
```

---

**Desenvolvido por:** Fabio Arieira Baia  
**Website:** https://fabioarieira.com  
**Discord:** fabioarieira8850


