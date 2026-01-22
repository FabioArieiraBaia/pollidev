const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/vs/workbench/contrib/void/electron-main/llmMessage/sendLLMMessage.impl.ts');

try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Substitui as 3 linhas da condição por uma simples
    const oldCondition = `const isPollinationsGeminiWithReasoning = providerName === 'pollinations' && 
		modelName.startsWith('gemini') && 
		reasoningInfo?.isReasoningEnabled;`;
    
    const newCondition = `const isPollinationsGeminiWithReasoning = false;  // Disabled to fix API errors`;
    
    content = content.replace(oldCondition, newCondition);
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Arquivo corrigido com sucesso!');
} catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
}