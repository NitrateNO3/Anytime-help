Add-Type -AssemblyName System.Drawing
$inputPath = "C:\Users\Aman Mirza\Desktop\Anytime Help\app\assets\images\logo.png"
$outputPath = "C:\Users\Aman Mirza\Desktop\Anytime Help\app\assets\images\android-icon-foreground.png"

$bmp = New-Object System.Drawing.Bitmap($inputPath)
$newBmp = New-Object System.Drawing.Bitmap(1080, 1080)
$newBmp.MakeTransparent()
$graphics = [System.Drawing.Graphics]::FromImage($newBmp)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$rect = New-Object System.Drawing.Rectangle(180, 180, 720, 720)
$graphics.DrawImage($bmp, $rect)
$newBmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$newBmp.Dispose()
$bmp.Dispose()
Write-Host "Padding successful!"
