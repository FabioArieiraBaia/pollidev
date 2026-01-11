# Mapeamento de propriedades para seus tipos
$typeMapping = @{
    'start_line' = 'number'
    'end_line' = 'number'
    'page_number' = 'number'
    'uri' = 'string'
    'query' = 'string'
    'include_pattern' = 'string'
    'search_in_folder' = 'string'
    'is_regex' = 'boolean'
    'is_recursive' = 'boolean'
    'search_replace_blocks' = 'string'
    'new_content' = 'string'
    'command' = 'string'
    'cwd' = 'string'
    'persistent_terminal_id' = 'string'
    'url' = 'string'
    'element' = 'string'
    'ref' = 'string'
    'text' = 'string'
    'submit' = 'boolean'
    'full_page' = 'boolean'
    'key' = 'string'
    'values' = 'array'
    'text_gone' = 'string'
    'time' = 'number'
}

$file = 'c:\xampp\htdocs\Void\void\src\vs\workbench\contrib\void\common\prompt\prompts.ts'
$content = Get-Content $file -Raw

$modified = $false

# Padrão para detectar: propriedade: { description: 'texto' }
# E transformar em: propriedade: { type: 'tipo', description: 'texto' }
foreach($prop in $typeMapping.Keys) {
    $type = $typeMapping[$prop]
    
    # Padrão: prop: { description: (inline - sem type:)
    $pattern = "(\s+)($prop):\s*\{\s*description:"
    
    if($content -match $pattern) {
        # Substituir adicionando type: antes de description:
        $content = $content -replace "(\s+)($prop):\s*\{\s*description:", "`$1`$2: { type: '$type', description:"
        Write-Host "Adicionado type: '$type' para propriedade '$prop'"
        $modified = $true
    }
}

if($modified) {
    Set-Content $file $content -NoNewline
    Write-Host "`n=== Correções aplicadas com sucesso! ==="
} else {
    Write-Host "`n=== Nenhuma correção necessária ==="
}
