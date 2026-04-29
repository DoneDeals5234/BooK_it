# Quick test to verify save-native-device Edge Function works correctly
$SUPABASE_URL = "https://database.donedeals.shop"
$ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.PKKL6ybphx1DLBXw8xxpLZzEMbumsFJQ23nSnwmrVzE"

Write-Host "=== Testing save-native-device Edge Function ===" -ForegroundColor Cyan
Write-Host "(Simulating what Kotlin will send after capturing player_id)" -ForegroundColor Gray
Write-Host ""

# Simulate what the Kotlin OneSignalPlayerIdManager sends
$body = @{
    userId     = "test-kotlin-user-001"
    email      = "test@bookbarber.com"
    playerId   = "kotlin-test-player-id-$(Get-Date -Format 'HHmmss')"
    deviceType = "native_android_kotlin"
} | ConvertTo-Json

Write-Host "Sending payload:" -ForegroundColor Yellow
Write-Host $body -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/save-native-device" `
        -Method POST `
        -Headers @{ "Content-Type"="application/json"; "apikey"=$ANON; "Authorization"="Bearer $ANON" } `
        -Body $body `
        -TimeoutSec 15

    Write-Host "RESPONSE:" -ForegroundColor Green
    $response | ConvertTo-Json | Write-Host -ForegroundColor White

    if ($response.success) {
        Write-Host ""
        Write-Host "[PASS] Edge Function working correctly!" -ForegroundColor Green
        Write-Host "       player_id was saved to native_devices table." -ForegroundColor Green
    }
} catch {
    Write-Host "[FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "       This may mean the Edge Function needs to be redeployed." -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "=== Verifying the saved record ===" -ForegroundColor Cyan
$headers = @{ "apikey"=$ANON; "Authorization"="Bearer $ANON" }
try {
    $devices = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/rest/v1/native_devices?select=user_id,player_id,device_type,last_active&user_id=eq.test-kotlin-user-001&limit=1" `
        -Method GET `
        -Headers $headers `
        -TimeoutSec 10
    if ($devices -and $devices.Count -gt 0) {
        Write-Host "[FOUND] Record in native_devices:" -ForegroundColor Green
        Write-Host "  user_id:     $($devices[0].user_id)" -ForegroundColor White
        Write-Host "  player_id:   $($devices[0].player_id)" -ForegroundColor Green
        Write-Host "  device_type: $($devices[0].device_type)" -ForegroundColor White
        Write-Host "  last_active: $($devices[0].last_active)" -ForegroundColor White
    }
} catch {
    Write-Host "Could not verify: $($_.Exception.Message)" -ForegroundColor DarkYellow
}
