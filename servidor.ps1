# =============================================================
#  MINI-SERVIDOR LOCAL para El Periquete
# -------------------------------------------------------------
#  Sirve los archivos del proyecto por HTTP para poder usar
#  los módulos de JavaScript (no funciona con doble clic).
#
#  CÓMO USARLO:
#   1. Clic derecho sobre este archivo > "Ejecutar con PowerShell"
#      (o abrí PowerShell en esta carpeta y escribí:  .\servidor.ps1 )
#   2. Abrí el navegador en:  http://localhost:5500
#   3. Para apagarlo, cerrá la ventana o apretá Ctrl + C.
# =============================================================

$puerto = 5500
$raiz = $PSScriptRoot

$mime = @{
  ".html" = "text/html; charset=utf-8";
  ".js"   = "text/javascript; charset=utf-8";
  ".mjs"  = "text/javascript; charset=utf-8";
  ".css"  = "text/css; charset=utf-8";
  ".json" = "application/json; charset=utf-8";
  ".png"  = "image/png";
  ".jpg"  = "image/jpeg";
  ".jpeg" = "image/jpeg";
  ".svg"  = "image/svg+xml";
  ".ico"  = "image/x-icon";
  ".woff" = "font/woff";
  ".woff2"= "font/woff2";
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$puerto/")
$listener.Start()

Write-Host ""
Write-Host "  El Periquete corriendo en:  http://localhost:$puerto" -ForegroundColor Green
Write-Host "  (Para apagarlo: Ctrl + C o cerrar esta ventana)" -ForegroundColor DarkGray
Write-Host ""

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $ruta = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($ruta -eq "/") { $ruta = "/index.html" }

    $archivo = Join-Path $raiz ($ruta.TrimStart("/") -replace "/", "\")

    if (Test-Path $archivo -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($archivo).ToLower()
      $tipo = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($archivo)
      $ctx.Response.ContentType = $tipo
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - No encontrado: $ruta")
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.OutputStream.Close()
  }
} finally {
  $listener.Stop()
}
