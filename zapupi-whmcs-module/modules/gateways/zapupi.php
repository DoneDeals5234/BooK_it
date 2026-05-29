<?php

if (!defined("WHMCS")) {
    die("This file cannot be accessed directly");
}

function zapupi_config()
{
    return [
        "FriendlyName" => [
            "Type"  => "System",
            "Value" => "ZapUPI Gateway",
        ],

        "zap_key" => [
            "FriendlyName" => "ZapUPI API Key",
            "Type"         => "text",
            "Size"         => "60",
            "Description"  => "Enter your ZapUPI API Key",
        ],
    ];
}

function zapupi_link($params)
{
    $zap_key  = trim($params['zap_key']);

    $invoiceId = $params['invoiceid'];
    $amount    = $params['amount'];

    $systemUrl = $params['systemurl'];

    $client = $params['clientdetails'];

    $phone = preg_replace('/[^0-9]/', '', $client['phonenumber']);

    if (strlen($phone) < 10) {
        $phone = "9999999999";
    }

    $cacheFile = __DIR__ . "/zapupi_order_" . $invoiceId . ".txt";

    if (file_exists($cacheFile)) {

        $orderId = trim(file_get_contents($cacheFile));

    } else {

        $orderId = "INV" . $invoiceId . time();

        file_put_contents($cacheFile, $orderId);
    }

    $postData = [
        "zap_key"         => $zap_key,
        "order_id"        => $orderId,
        "amount"          => (float)$amount,
        "customer_mobile" => $phone,
    ];

    $ch = curl_init();

    curl_setopt($ch, CURLOPT_URL, "https://pay.zapupi.com/api/create-order");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);

    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Content-Type: application/json"
    ]);

    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));

    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $response = curl_exec($ch);

    if (curl_errno($ch)) {

        $error = curl_error($ch);

        curl_close($ch);

        return '<div style="background:#ffe5e5;color:red;padding:15px;border-radius:10px;font-weight:bold;">cURL Error:<br><br>' . $error . '</div>';
    }

    curl_close($ch);

    $result = json_decode($response, true);

    if (
        isset($result['message']) &&
        stripos($result['message'], 'already exist') !== false
    ) {

        return '<div style="background:#fff3cd;color:#856404;padding:15px;border-radius:10px;font-weight:bold;">Payment already initiated for this invoice.</div>';
    }

    if (
        !$result ||
        !isset($result['status']) ||
        $result['status'] != 'success'
    ) {

        return '<div style="background:#ffe5e5;color:red;padding:15px;border-radius:10px;font-weight:bold;"><pre>' . htmlspecialchars(print_r($result, true)) . '</pre></div>';
    }

    $paymentUrl = $result['payment_url'];
    $qrCode     = $result['payment_image_url'];

    return '

    <div style="max-width:420px;margin:auto;text-align:center;background:#ffffff;border-radius:15px;padding:20px;border:1px solid #eee;">

        <h2>Pay with ZapUPI</h2>

        <img src="' . $qrCode . '" width="250">

        <br><br>

        <div style="font-size:18px;font-weight:bold;">
            Amount: ₹' . $amount . '
        </div>

        <br>

        <a href="' . $paymentUrl . '" target="_blank" style="display:inline-block;background:#0a7cff;color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:18px;font-weight:bold;">
            Pay Now
        </a>

        <br><br>

        <div id="zapupi-status" style="color:#ff6600;font-weight:bold;">
            Waiting for payment...
        </div>

    </div>

    <script>

    setInterval(function(){

        fetch("' . $systemUrl . 'modules/gateways/callback/zapupi.php?check=1&invoiceid=' . $invoiceId . '&order_id=' . $orderId . '")

        .then(response => response.json())

        .then(data => {

            if(data.status === "Success"){

                document.getElementById("zapupi-status").innerHTML =
                "Payment Successful Redirecting...";

                setTimeout(function(){

                    window.location.href =
                    "' . $systemUrl . 'viewinvoice.php?id=' . $invoiceId . '";

                }, 2000);
            }

        });

    }, 5000);

    </script>';
}
