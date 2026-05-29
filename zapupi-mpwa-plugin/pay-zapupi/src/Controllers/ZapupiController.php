<?php

namespace Plugins\PayZapupi\Controllers;

use App\Http\Controllers\Controller;
use Plugins\Billing\Models\Order;
use Plugins\Billing\Models\Plans;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class ZapupiController extends Controller
{
    private function apiUrl(): string
    {
        return 'https://pay.zapupi.com/api';
    }

    private function apiKey(): string
    {
        return trim(config('payments.ZapUPI.zap_key', ''));
    }

    // ─────────────────────────────────────────────
    //  Billing / Subscription flow
    // ─────────────────────────────────────────────

    public function process($order, $plan)
    {
        // ZapUPI only accepts A-Za-z0-9_
        // Use $order->id (auto-increment integer) — always clean, always unique
        $orderId = 'ZAP' . $order->id;

        $phone = preg_replace('/\D+/', '', $order->user->phone ?? '9999999999');
        if (strlen($phone) < 10) {
            $phone = '9999999999';
        }

        $cb = route('payments.callback', ['gateway' => 'ZapUPI']);

        $response = Http::withHeaders(['Content-Type' => 'application/json'])
            ->post($this->apiUrl() . '/create-order', [
                'zap_key'         => $this->apiKey(),
                'order_id'        => $orderId,
                'amount'          => (float) number_format($plan->price, 2, '.', ''),
                'customer_mobile' => $phone,
                'remark'          => $plan->title,
                'success_url'     => $cb . (str_contains($cb, '?') ? '&' : '?') . 'order_id=' . $orderId,
                'failed_url'      => $cb . (str_contains($cb, '?') ? '&' : '?') . 'order_id=' . $orderId,
                'timeout_url'     => $cb . (str_contains($cb, '?') ? '&' : '?') . 'order_id=' . $orderId,
            ]);

        if ($response->failed()) {
            return redirect()->route('payments.checkout', ['planId' => $plan->id])
                ->withErrors(__('Failed to initiate payment with ZapUPI.'));
        }

        $result = $response->json();

        // Order ID already exists on ZapUPI — just show QR with same orderId
        if (
            ($result['status'] ?? '') === 'error' &&
            stripos($result['message'] ?? '', 'already exist') !== false
        ) {
            // Use a fresh unique orderId by appending suffix
            $orderId = $orderId . '_' . time();
            // Update mpwaOrderId remains the same — only zapupi orderId changes

            $response2 = Http::withHeaders(['Content-Type' => 'application/json'])
                ->post($this->apiUrl() . '/create-order', [
                    'zap_key'         => $this->apiKey(),
                    'order_id'        => $orderId,
                    'amount'          => (float) number_format($plan->price, 2, '.', ''),
                    'customer_mobile' => $phone,
                    'remark'          => $plan->title,
                    'success_url'     => $cb . (str_contains($cb, '?') ? '&' : '?') . 'order_id=' . $orderId,
                    'failed_url'      => $cb . (str_contains($cb, '?') ? '&' : '?') . 'order_id=' . $orderId,
                    'timeout_url'     => $cb . (str_contains($cb, '?') ? '&' : '?') . 'order_id=' . $orderId,
                ]);

            if ($response2->failed()) {
                return redirect()->route('payments.checkout', ['planId' => $plan->id])
                    ->withErrors(__('Failed to initiate payment with ZapUPI.'));
            }

            $result = $response2->json();
        }

        if (($result['status'] ?? '') !== 'success') {
            return redirect()->route('payments.checkout', ['planId' => $plan->id])
                ->withErrors($result['message'] ?? __('Unable to create ZapUPI order. Please try again.'));
        }

        $paymentUrl  = $result['payment_url'];
        $callbackUrl = $cb;

        return view('pay-zapupi::pay', compact('paymentUrl'));
    }

    // ─────────────────────────────────────────────
    //  Commerce (mp-commerce) flow
    // ─────────────────────────────────────────────

    public function createCommercePayment($order)
    {
        $phone = preg_replace('/\D+/', '', $order->customer_phone ?? '9999999999');
        if (strlen($phone) < 10) {
            $phone = '9999999999';
        }

        $orderId     = 'COM_' . preg_replace('/[^A-Za-z0-9_]/', '_', (string) $order->order_number);
        $callbackUrl = route('mp-commerce.payment.return', ['gateway' => 'ZapUPI'])
                       . '?order_id=' . $orderId;

        $response = Http::withHeaders(['Content-Type' => 'application/json'])
            ->post($this->apiUrl() . '/create-order', [
                'zap_key'         => $this->apiKey(),
                'order_id'        => $orderId,
                'amount'          => (float) number_format((float) $order->total, 2, '.', ''),
                'customer_mobile' => $phone,
                'remark'          => 'Order #' . $order->order_number,
                'success_url'     => $callbackUrl,
                'failed_url'      => $callbackUrl,
                'timeout_url'     => $callbackUrl,
            ]);

        if ($response->failed()) {
            return ['success' => false, 'message' => __('Failed to create ZapUPI payment.')];
        }

        $result = $response->json();

        if (($result['status'] ?? '') !== 'success') {
            return ['success' => false, 'message' => $result['message'] ?? __('Unable to create ZapUPI order.')];
        }

        return ['redirect_url' => $result['payment_url']];
    }

    public function handleCommerceCallback(Request $request)
    {
        // Webhook POST
        if ($request->isMethod('post')) {
            $body       = $request->input();
            $zapOrderId = data_get($body, 'order_id');
            $status     = data_get($body, 'status');

            if (!$zapOrderId || strtolower($status) !== 'success') {
                return null;
            }

            $comOrder = \Plugins\MpCommerce\Models\CommerceOrder::where('order_number', $zapOrderId)->first();
            if (!$comOrder) return null;

            return [
                'order_id'       => $comOrder->id,
                'transaction_id' => data_get($body, 'txn_id') ?? $zapOrderId,
                'redirect_url'   => route('mp-commerce.order.confirmation', $comOrder->order_number),
            ];
        }

        // GET redirect
        $zapOrderId = $request->query('order_id');
        if (!$zapOrderId) return null;

        $statusData = $this->checkOrderStatus($zapOrderId);
        $comOrder   = \Plugins\MpCommerce\Models\CommerceOrder::where('order_number', $zapOrderId)->first();
        if (!$comOrder) return null;

        if (!$statusData || strtolower($statusData['status'] ?? '') !== 'success') {
            return ['redirect_url' => route('mp-commerce.order.confirmation', $comOrder->order_number)];
        }

        return [
            'order_id'       => $comOrder->id,
            'transaction_id' => $statusData['txn_id'] ?? $zapOrderId,
            'redirect_url'   => route('mp-commerce.order.confirmation', $comOrder->order_number),
        ];
    }

    // ─────────────────────────────────────────────
    //  Billing callback
    // ─────────────────────────────────────────────

    public function callback(Request $request)
    {
        // AJAX poll from QR page
        if ($request->has('check')) {
            return $this->handleAjaxCheck($request);
        }

        // Webhook POST from ZapUPI — JSON body, no CSRF token
        if ($request->isMethod('post')) {
            // ZapUPI sends raw JSON — parse from body
            $raw  = $request->getContent();
            $body = json_decode($raw, true) ?? $request->input();

            $zapOrderId = $body['order_id'] ?? null;
            $status     = $body['status']   ?? null;
            $txnId      = $body['txn_id']   ?? null;

            if ($zapOrderId && strtolower((string)$status) === 'success') {
                $numericId = preg_replace('/^ZAP(\d+)(_\d+)?$/', '$1', $zapOrderId);
                $order = Order::where('id', $numericId)->first();
                if ($order && $order->status !== 'completed') {
                    $this->markOrderPaid($order, $txnId ?? $zapOrderId);
                }
            }

            return response()->json(['status' => 'ok']);
        }

        // GET redirect from success_url / failed_url / timeout_url
        $zapOrderId = $request->query('order_id');

        if (!$zapOrderId) {
            return redirect()->route('home')->with('alert', [
                'type' => 'danger',
                'msg'  => __('Payment details are missing.'),
            ]);
        }

        $statusData = $this->checkOrderStatus($zapOrderId);

        if (!$statusData) {
            return redirect()->route('home')->with('alert', [
                'type' => 'danger',
                'msg'  => __('Unable to verify payment status.'),
            ]);
        }

        // Strip ZAP prefix and any _timestamp suffix to get MPWA order_id
        // Extract numeric id from ZAP{id} or ZAP{id}_{timestamp}
        $numericId = preg_replace('/^ZAP(\d+)(_\d+)?$/', '$1', $zapOrderId);
        $order = Order::where('id', $numericId)->first();

        if (!$order) {
            return redirect()->route('home')->with('alert', [
                'type' => 'danger',
                'msg'  => __('Order not found.'),
            ]);
        }

        if (strtolower($statusData['status'] ?? '') === 'success') {
            return $this->markOrderPaid($order, $statusData['txn_id'] ?? $zapOrderId);
        }

        return redirect()->route('home')->with('alert', [
            'type' => 'danger',
            'msg'  => __('Payment not completed.'),
        ]);
    }

    // ─────────────────────────────────────────────
    //  Private helpers
    // ─────────────────────────────────────────────

    private function handleAjaxCheck(Request $request)
    {
        $orderId = $request->query('order_id');

        if (!$orderId) {
            return response()->json(['status' => 'Pending']);
        }

        $statusData = $this->checkOrderStatus($orderId);

        if ($statusData && strtolower($statusData['status'] ?? '') === 'success') {
            try {
                $numericId = preg_replace('/^ZAP(\d+)(_\d+)?$/', '$1', $orderId);
                $order = Order::where('id', $numericId)->first();
                if ($order && $order->status !== 'completed') {
                    $this->markOrderPaid($order, $statusData['txn_id'] ?? $orderId);
                }
            } catch (\Exception $e) {
                return response()->json(['status' => 'Pending', 'error' => $e->getMessage()]);
            }
            return response()->json(['status' => 'Success']);
        }

        return response()->json(['status' => 'Pending']);
    }

    private function checkOrderStatus(string $orderId): ?array
    {
        $response = Http::withHeaders(['Content-Type' => 'application/json'])
            ->post($this->apiUrl() . '/order-status', [
                'zap_key'  => $this->apiKey(),
                'order_id' => $orderId,
            ]);

        if ($response->failed()) return null;

        $json = $response->json();

        if (($json['status'] ?? '') !== 'success') return null;

        return $json['data'] ?? null;
    }

    private function markOrderPaid(Order $order, string $txnId)
    {
        $order->status = 'completed';
        $order->save();

        $plan = Plans::find($order->plan_id);
        $user = User::find($order->user_id);

        if ($user && $plan) {
            $days = (int) $plan->days;
            $user->plan_name            = $plan->title;
            $user->plan_data            = $plan->data;
            $user->limit_device         = $plan->data['device_limit'] ?? null;
            $user->active_subscription  = 'active';
            $user->subscription_expired = now()->addDays($days);
            $user->save();
        }

        return redirect()->route('home')->with('alert', [
            'type' => 'success',
            'msg'  => __('Payment processed successfully.'),
        ]);
    }
}
