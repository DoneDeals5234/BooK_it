import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Loader2, TrendingUp, CheckCircle2, Eye, AlertCircle } from 'lucide-react';

interface CampaignAnalytic {
  id: string;
  campaign_id: string;
  total_recipients: number;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_failed: number;
  delivery_rate: number;
  open_rate: number;
}

interface CampaignAnalyticsProps {
  campaignId: string;
}

export const CampaignAnalytics = ({ campaignId }: CampaignAnalyticsProps) => {
  const [analytics, setAnalytics] = useState<CampaignAnalytic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('campaign_analytics')
        .select('*')
        .eq('campaign_id', campaignId)
        .single();

      if (!error && data) {
        setAnalytics(data);
      }
      setLoading(false);
    };

    fetchAnalytics();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`campaign-analytics-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_analytics',
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload: any) => {
          if (payload.new) {
            setAnalytics(payload.new as CampaignAnalytic);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [campaignId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <p>No analytics data available yet</p>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    {
      label: 'Total Sent',
      value: analytics.total_sent,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      label: 'Delivered',
      value: analytics.total_delivered,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
      subtext: `${analytics.delivery_rate.toFixed(1)}% delivery rate`,
    },
    {
      label: 'Opened',
      value: analytics.total_opened,
      icon: Eye,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
      subtext: `${analytics.open_rate.toFixed(1)}% open rate`,
    },
    {
      label: 'Failed',
      value: analytics.total_failed,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className={`p-3 rounded-lg ${stat.bgColor} w-fit mb-2`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                {stat.subtext && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.subtext}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Progress bars */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Delivery Rate</span>
              <span className="text-sm font-semibold">{analytics.delivery_rate.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${Math.min(analytics.delivery_rate, 100)}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Open Rate</span>
              <span className="text-sm font-semibold">{analytics.open_rate.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full"
                style={{ width: `${Math.min(analytics.open_rate, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
