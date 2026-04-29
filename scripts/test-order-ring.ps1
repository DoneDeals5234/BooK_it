
# =========================================================
# TEST SCRIPT: Simulate a new order to test phone ringing
# =========================================================

$SUPABASE_URL = "https://database.donedeals.shop"
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.PKKL6ybphx1DLBXw8xxpLZzEMbumsFJQ23nSnwmrVzE"

$headers = @{
    "Content-Type"  = "application/json"
    "apikey"        = $ANON_KEY
    "Authorization" = "Bearer $ANON_KEY"
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  BOOK-IT: Order Ring Test" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# ---- STEP 1: Get a real shop ID ----
Write-Host "`n[STEP 1] Fetching a real shop from database..." -ForegroundColor Yellow
try {
    $shopResponse = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/rest/v1/shops?select=id,name,owner_email&limit=3" `
        -Method GET `
        -Headers $headers `
        -TimeoutSec 15

    if (-not $shopResponse -or $shopResponse.Count -eq 0) {
        Write-Host "  ERROR: No shops found in database!" -ForegroundColor Red
        exit 1
    }

    Write-Host "  Found $($shopResponse.Count) shop(s):" -ForegroundColor Green
    foreach ($s in $shopResponse) {
        Write-Host "    - [$($s.id)] $($s.name) (owner: $($s.owner_email))" -ForegroundColor White
    }

    $shop = $shopResponse[0]
    Write-Host "`n  Using shop: $($shop.name) ($($shop.id))" -ForegroundColor Cyan

} catch {
    Write-Host "  ERROR fetching shops: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ---- STEP 2: Get owner user_id ----
Write-Host "`n[STEP 2] Looking up shop owner in user_profiles..." -ForegroundColor Yellow
try {
    $ownerEmail = [System.Uri]::EscapeDataString($shop.owner_email)
    $profileResponse = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/rest/v1/user_profiles?select=user_id,email&email=eq.$ownerEmail&limit=1" `
        -Method GET `
        -Headers $headers `
        -TimeoutSec 15

    if ($profileResponse -and $profileResponse.Count -gt 0) {
        Write-Host "  Owner user_id: $($profileResponse[0].user_id)" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Owner not found in user_profiles. Notification may not reach device." -ForegroundColor DarkYellow
    }
} catch {
    Write-Host "  WARNING: Could not look up owner profile: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

# ---- STEP 3: Get owner OneSignal player_id ----
Write-Host "`n[STEP 3] Checking native_devices for owner's OneSignal player_id..." -ForegroundColor Yellow
try {
    if ($profileResponse -and $profileResponse[0].user_id) {
        $ownerId = $profileResponse[0].user_id
        $deviceResponse = Invoke-RestMethod `
            -Uri "$SUPABASE_URL/rest/v1/native_devices?select=player_id,user_id&user_id=eq.$ownerId&limit=1" `
            -Method GET `
            -Headers $headers `
            -TimeoutSec 15

        if ($deviceResponse -and $deviceResponse.Count -gt 0) {
            Write-Host "  Player ID found: $($deviceResponse[0].player_id)" -ForegroundColor Green
            Write-Host "  Owner is registered. Phone WILL receive notifications." -ForegroundColor Green
        } else {
            Write-Host "  WARNING: No player_id found. Owner may not be logged in on the Android app!" -ForegroundColor Red
            Write-Host "  Make sure owner has logged into the app at least once on their Android device." -ForegroundColor DarkYellow
        }
    }
} catch {
    Write-Host "  Could not check devices: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

# ---- STEP 4: Fire a real test order ----
Write-Host "`n[STEP 4] Firing a REAL test order via create-customer-order Edge Function..." -ForegroundColor Yellow

$orderBody = @{
    shopId       = $shop.id
    customerId   = "test-customer-00000000-0000-0000-0000-000000000001"
    customerName = "Test Customer (Ring Test)"
    customerPhone = "9999999999"
    amount       = 99
    description  = "TEST ORDER - Phone should ring NOW!"
    quantity     = 1
    deliveryType = "pickup"
    productName  = "Test Product"
} | ConvertTo-Json

Write-Host "  Calling Edge Function: $SUPABASE_URL/functions/v1/create-customer-order" -ForegroundColor Gray

try {
    $orderResult = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/create-customer-order" `
        -Method POST `
        -Headers @{ "Content-Type"="application/json"; "apikey"=$ANON_KEY; "Authorization"="Bearer $ANON_KEY" } `
        -Body $orderBody `
        -TimeoutSec 30

    Write-Host "`n  ORDER RESULT:" -ForegroundColor Cyan
    if ($orderResult.success -eq $true) {
        Write-Host "  [OK] Order created! ID: $($orderResult.order.id)" -ForegroundColor Green
        Write-Host "`n  ============================================" -ForegroundColor Green
        Write-Host "  If everything is connected:" -ForegroundColor Green
        Write-Host "  -> OneSignal push sent to owner's device" -ForegroundColor Green
        Write-Host "  -> OrderNotificationExtension.kt caught it" -ForegroundColor Green
        Write-Host "  -> OrderAlarmService.kt started ringing!" -ForegroundColor Green
        Write-Host "  ============================================" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Order creation failed:" -ForegroundColor Red
        $orderResult | ConvertTo-Json | Write-Host
    }
} catch {
    Write-Host "  ERROR calling Edge Function: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Full error: $_" -ForegroundColor DarkRed
}

Write-Host "`n  Test completed. Check owner's phone for ringing!" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
