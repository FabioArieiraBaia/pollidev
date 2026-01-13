# PolliDev

<div align="center">
	<img
		src="./pollydev-logo-3d.png"
	 	alt="PolliDev Logo"
		width="300"
	 	height="300"
	/>
	
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.96.0-blue.svg)](https://github.com/FabioArieiraBaia/pollidev)
[![Pollinations](https://img.shields.io/badge/Powered%20by-Pollinations-purple.svg)](https://pollinations.ai)
[![Download](https://img.shields.io/badge/Download-fabioarieira.com-green.svg)](https://fabioarieira.com/pollidev)

</div>

**PolliDev** é um editor de código avançado com inteligência artificial integrada, baseado no VS Code.

🌟 **Editor profissional com IA nativa | Integração com Pollinations.ai | Multiplataforma**

Desenvolvido por **[Fabio Arieira Baia](https://github.com/FabioArieiraBaia)** - Full Stack Developer

## 🚀 Características

### 🌸 Integração com Pollinations.ai

- 🎨 **Geração de Imagens** - Crie imagens diretamente no editor usando Pollinations
- 💬 **IA de Texto** - Acesso nativo à API de texto do Pollinations
- 🔄 **Multi-Modelos** - Suporte para GPT, Claude, Llama e mais através do Pollinations
- ⚡ **Streaming em Tempo Real** - Respostas em tempo real com streaming
- 🆓 **API Gratuita** - Aproveite os recursos do Pollinations sem custo

### 🤖 Recursos de IA

- 🤖 **Agentes de IA Integrados** - Use modelos de IA diretamente no editor
- 🔍 **Busca Semântica RAG** - Sistema de busca semântica com Retrieval Augmented Generation
- 💾 **Checkpoint de Mudanças** - Visualize e gerencie alterações no código
- 🔌 **Múltiplos Modelos** - Suporte para OpenAI, Anthropic, Gemini, Ollama, vLLM e mais
- 🏠 **Modelos Locais** - Execute modelos localmente (Ollama, LM Studio, etc.)
- 🌐 **Automação de Navegador** - Ferramentas integradas para automação web
- 🎯 **Indexação Semântica** - Indexe seu workspace para busca inteligente

## 📥 Download

### Versões Pré-Compiladas (Recomendado)

Baixe a versão mais recente do PolliDev para o seu sistema operacional:

**🌐 [Download PolliDev - fabioarieira.com/pollidev](https://fabioarieira.com/pollidev)**

#### Versões Disponíveis:

- **Windows**: PolliDev-Setup-1.96.0.exe
- **macOS**: PolliDev-1.96.0.dmg
- **Linux**: PolliDev-1.96.0.AppImage

### Instalação Rápida

1. Acesse [fabioarieira.com/pollidev](https://fabioarieira.com/pollidev)
2. Baixe a versão para seu sistema operacional
3. Execute o instalador
4. Pronto! PolliDev estará pronto para uso

---

## 📋 Pré-requisitos (Para Desenvolvimento)

- Node.js (versão recomendada: 18+)
- npm ou yarn
- Git

## 🛠️ Instalação (Build do Código Fonte)

Se preferir compilar do código fonte:

```bash
# Clone o repositório
git clone https://github.com/FabioArieiraBaia/pollidev.git
cd pollidev/void

# Instale as dependências
npm install

# Compile o projeto
npm run compile
```

## 🏃 Desenvolvimento

```bash
# Modo watch (recompila automaticamente)
npm run watch

# Compilar React components
npm run buildreact

# Watch React components
npm run watchreact
```

## 📝 Licença e Direitos Autorais

**© 2025 Fabio Arieira Baia. Todos os direitos reservados.**

- **PolliDev**: Licenciado sob [Apache License 2.0](LICENSE.txt) com restrições adicionais
- **Componentes de terceiros**: Inclui código licenciado sob [MIT License](LICENSE-VS-Code.txt)

### ⚠️ Restrições Importantes

**Para Colaboradores:**
- Você **NÃO pode** copiar o código para criar projetos derivados
- Você **NÃO pode** usar o código em produtos concorrentes
- Você **só pode** contribuir com melhorias para este projeto
- Todas as contribuições tornam-se propriedade do autor

**Leia o [Acordo de Contribuidor](CONTRIBUTOR_AGREEMENT.md) e [Copyright](COPYRIGHT.txt) para mais detalhes.**

## 🙏 Agradecimentos e Créditos

Este projeto utiliza a API da [Pollinations.ai](https://pollinations.ai) para suporte a modelos de IA.

- **Pollinations.ai**: Plataforma de geração de IA open-source
- **Website**: https://pollinations.ai
- **API Docs**: https://enter.pollinations.ai/api/docs
- **Repositório**: https://github.com/pollinations/pollinations

O PolliDev integra a API da Pollinations para oferecer acesso a múltiplos modelos de IA, incluindo suporte para visão, áudio, vídeo e function calling.

## 👨‍💻 Autor

**Fabio Arieira Baia** - Full Stack Developer

- 🌐 Website: [fabioarieira.com](https://fabioarieira.com)
- 💬 Discord: fabioarieira8850
- 📧 Email: [Entre em contato via website](https://fabioarieira.com)

## 🤝 Contribuindo

Contribuições são bem-vindas! **Mas leia primeiro o [Acordo de Contribuidor](CONTRIBUTOR_AGREEMENT.md)**.

**⚠️ IMPORTANTE**: Ao contribuir, você concorda que:
- Suas contribuições tornam-se propriedade do autor
- Você **NÃO pode** copiar o código para criar projetos derivados
- Você **só pode** contribuir com melhorias para este projeto

Para contribuir:

1. Leia o [CONTRIBUTING.md](CONTRIBUTING.md) e [CONTRIBUTOR_AGREEMENT.md](CONTRIBUTOR_AGREEMENT.md)
2. Faça fork do projeto (apenas para contribuir)
3. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
4. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
5. Push para a branch (`git push origin feature/AmazingFeature`)
6. Abra um Pull Request


## 🐛 Reportar Bugs

Encontrou um bug? Por favor, abra uma [issue](https://github.com/FabioArieiraBaia/pollidev/issues) descrevendo o problema.

## 📄 Estrutura do Projeto

```
pollidev/
├── src/                    # Código fonte principal
│   └── vs/
│       └── workbench/
│           └── contrib/
│               └── void/    # Modificações do PolliDev
├── extensions/              # Extensões incluídas
├── build/                   # Scripts de build
└── test/                    # Testes
```

## ⚡ Tecnologias

- TypeScript
- React
- Electron
- Node.js
- Extension API

---

<div align="center">
	<p>Desenvolvido com ❤️ por <a href="https://fabioarieira.com">Fabio Arieira Baia</a></p>
	<p>Full Stack Developer</p>
</div>
