Add-Type -AssemblyName System.Drawing
$path = "$PWD\assets\beer branding and names\WhatsApp Image 2026-04-23 at 15.20.49.01.jpeg"
$outPath = "$PWD\assets\beer branding and names\transparent_logo.png"
$img = [System.Drawing.Bitmap]::FromFile($path)
$bgColor = $img.GetPixel(0,0)
$img.MakeTransparent($bgColor)
$img.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
