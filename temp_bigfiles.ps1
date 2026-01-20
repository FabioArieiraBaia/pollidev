Get-ChildItem -Recurse -File | Where-Object { .Length -ge 104857600 } | Sort-Object Length -Descending | ForEach-Object { Write-Output (\ 0 MB - \ + .FullName) }
