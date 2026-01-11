$file = 'c:\xampp\htdocs\Void\void\src\vs\workbench\contrib\void\common\prompt\prompts.ts'
$lines = Get-Content $file

$inParams = $false
$currentTool = ''
$missingTypes = @()

for($i=0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    
    # Detectar nome da ferramenta
    if($line -match '^\t(\w+):\s+\{$') {
        $currentTool = $matches[1]
    }
    
    # Detectar início de params
    if($line -match '^\s+params:\s+\{$') {
        $inParams = $true
    }
    
    # Detectar propriedades dentro de params que só têm description
    if($inParams -and $line -match '^\s+(\w+):\s+\{\s*description:') {
        $prop = $matches[1]
        # Verificar se a próxima linha não tem 'type:'
        $nextLine = $lines[$i+1]
        if($nextLine -notmatch 'type:') {
            $missingTypes += [PSCustomObject]@{
                Tool = $currentTool
                Property = $prop
                Line = $i + 1
            }
        }
    }
    
    # Detectar fim de params
    if($line -match '^\s+\},?\s*$' -and $inParams) {
        $inParams = $false
    }
}

Write-Host "=== Propriedades sem campo 'type' ==="
$missingTypes | Format-Table -AutoSize
