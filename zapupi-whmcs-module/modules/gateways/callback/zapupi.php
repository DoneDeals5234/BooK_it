<?php

require_once __DIR__ . '/../../../init.php';
require_once __DIR__ . '/../../../includes/gatewayfunctions.php';
require_once __DIR__ . '/../../../includes/invoicefunctions.php';

$gatewayModuleName = 'zapupi';

$gatewayParams = getGatewayVariables($gatewayModuleName);

if (!$gatewayParams['type']) {
    die("Module Not Activated");
}

$zap_key = trim($gatewayParams['zap_key']);

if (isset($_GET['check'])) {

    header('Content-Type: application/json');

    $invoiceId = $_GET['invoiceid'];
    $orderId   = $_GET['order_id'];

    $postData = [
        "zap_key"  => $zap_key,
        "order_id" => $orderId,
    ];

    $ch = curl_init();

    curl_setopt($ch, CURLOPT_URL, "https://pay.zapupi.com/api/order-status");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);

    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Content-Type: application/json"
    ]);

    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));

    $response = curl_exec($ch);

    curl_close($ch);

    $result = json_decode($response, true);

    if (
        isset($result['data']['status']) &&
        strtolower($result['data']['status']) == "success"
    ) {

        $transactionId = $result['data']['txn_id'];

        $invoice = localAPI("GetInvoice", [
            "invoiceid" => $invoiceId
        ]);

        if ($invoice['status'] != "Paid") {

            addInvoicePayment(
                $invoiceId,
                $transactionId,
                $result['data']['pay_amount'],
                0,
                $gatewayModuleName
            );
        }

        echo json_encode([
            "status" => "Success"
        ]);

        exit;
    }

    echo json_encode([
        "status" => "Pending"
    ]);

    exit;
}

header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);

echo json_encode([
    "status" => "ok"
]);
