<?php

namespace Plugins\PayZapupi;

use App\Plugins\BasePluginServiceProvider;
use App\Services\PaymentGatewayRegistry;

class PluginServiceProvider extends BasePluginServiceProvider
{
    protected string $pluginSlug = 'pay-zapupi';

    public function register(): void
    {
        $this->syncPaymentsConfig();

        app(PaymentGatewayRegistry::class)->register([
            'slug' => 'ZapUPI',
            'name' => 'ZapUPI Payment',
            'controller_class' => \Plugins\PayZapupi\Controllers\ZapupiController::class,
            'config_fields' => [
                'status'        => 'disable',
                'zap_key'       => 'Replace This With Your ZapKey',
                'is_production' => 'false',
                'webhook_url'   => '',
            ],
            'has_callback' => true,
        ]);
    }

    protected function syncPaymentsConfig(): void
    {
        $configPath = config_path('payments.php');
        if (!file_exists($configPath)) return;

        $all = include $configPath;
        if (!is_array($all)) return;

        $current = $all['ZapUPI'] ?? [];

        try {
            $webhookUrl = route('payments.callback', ['gateway' => 'ZapUPI']);
        } catch (\Exception $e) {
            $webhookUrl = url('/en/payments/callback/zapupi');
        }

        $defaults = [
            'status'        => 'disable',
            'zap_key'       => 'Replace This With Your ZapKey',
            'is_production' => 'false',
            'webhook_url'   => $webhookUrl,
        ];

        // Keep existing values, add missing keys with defaults
        $updated = array_merge($defaults, array_intersect_key($current, $defaults));

        // Always refresh webhook_url to current server URL
        $updated['webhook_url'] = $webhookUrl;

        if ($updated === $current) return;

        $all['ZapUPI'] = $updated;
        file_put_contents($configPath, '<?php return ' . var_export($all, true) . ';' . PHP_EOL);
    }

    public function boot(): void
    {
        $this->loadPluginViews();
        $this->publishIcons();
    }

    protected function publishIcons(): void
    {
        $maps = [
            'public/themes/vuexy/payments/zapupi.png'          => public_path('themes/vuexy/payments/zapupi.png'),
            'public/themes/vuexy/payments/ZapUPI.png'          => public_path('themes/vuexy/payments/ZapUPI.png'),
            'public/index/vuexy/img/icons/payments/zapupi.png' => public_path('index/vuexy/img/icons/payments/zapupi.png'),
            'public/index/vuexy/img/icons/payments/ZapUPI.png' => public_path('index/vuexy/img/icons/payments/ZapUPI.png'),
        ];

        foreach ($maps as $src => $dest) {
            $srcPath = base_path("plugins/pay-zapupi/{$src}");
            if (file_exists($srcPath)) {
                @mkdir(dirname($dest), 0755, true);
                @copy($srcPath, $dest); // Always overwrite
            }
        }
    }

    public function getNavItems(): array
    {
        return [];
    }
}
