# Check native_devices table for registered OneSignal player IDs
$ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.PKKL6ybphx1DLBXw8xxpLZzEMbumsFJQ23nSnwmrVzE"
$headers = @{
    "apikey"        = $ANON
    "Authorization" = "Bearer $ANON"
}

Write-Host "=== Checking native_devices (OneSignal registrations) ===" -ForegroundColor Cyan

$devices = Invoke-RestMethod `
    -Uri "https://database.donedeals.shop/rest/v1/native_devices?select=player_id,user_id&limit=10" `
    -Method GET `
    -Headers $headers `
    -TimeoutSec 15

if ($devices -and $devices.Count -gt 0) {
    Write-Host "FOUND $($devices.Count) registered device(s):" -ForegroundColor Green
    foreach ($d in $devices) {
        Write-Host "  user_id: $($d.user_id) | player_id: $($d.player_id)" -ForegroundColor White
    }
} else {
    Write-Host "WARNING: NO devices registered! This means no notifications will be delivered." -ForegroundColor Red
    Write-Host "Solution: Shop owner must open the Android app so it can register with OneSignal." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Checking user_profiles (shop owner lookup) ===" -ForegroundColor Cyan
$profiles = Invoke-RestMethod `
    -Uri "https://database.donedeals.shop/rest/v1/user_profiles?select=user_id,email&limit=5" `
    -Method GET `
    -Headers $headers `
    -TimeoutSec 15

if ($profiles -and $profiles.Count -gt 0) {
    Write-Host "FOUND $($profiles.Count) profile(s):" -ForegroundColor Green
    foreach ($p in $profiles) {
        Write-Host "  user_id: $($p.user_id) | email: $($p.email)" -ForegroundColor White
    }
} else {
    Write-Host "No profiles found." -ForegroundColor Red
}
