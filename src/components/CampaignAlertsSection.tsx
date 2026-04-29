import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, X, Target } from 'lucide-react';
import type { CampaignAlert, TargetedCampaign } from '@/lib/supabase-campaign-alerts';
import {
  getUserCampaignAlerts,
  getUserTargetedCampaigns,
  deleteCampaignAlert,
  markCampaignAlertAsRead,
  subscribeToUserCampaignAlerts,
  unsubscribeFromCampaignAlerts,
} from '@/lib/supabase-campaign-alerts';
import toast from 'react-hot-toast';

interface CampaignAlertsSectionProps {
  userId: string;
}

export const CampaignAlertsSection = ({ userId }: CampaignAlertsSectionProps) => {
  const [alerts, setAlerts] = useState<CampaignAlert[]>([]);
  const [targetedCampaigns, setTargetedCampaigns] = useState<TargetedCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});

  // Load initial alerts and targeted campaigns
  useEffect(() => {
    const loadCampaignData = async () => {
      setLoading(true);

      // Fetch both alerts and targeted campaigns in parallel
      const [alertsData, campaignsData] = await Promise.all([
        getUserCampaignAlerts(userId),
        getUserTargetedCampaigns(userId),
      ]);

      setAlerts(alertsData);
      setTargetedCampaigns(campaignsData);

      // Initialize countdown timers only for alerts (which have expiration)
      const timers: Record<string, number> = {};
      alertsData.forEach((alert) => {
        const timeLeft = Math.max(0, Math.floor((new Date(alert.expiresAt).getTime() - Date.now()) / 1000));
        timers[alert.id] = timeLeft;
      });
      setCountdowns(timers);
      setLoading(false);
    };

    loadCampaignData();
  }, [userId]);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = subscribeToUserCampaignAlerts(userId, (updatedAlerts) => {
      setAlerts(updatedAlerts);
      
      // Update countdowns for new alerts
      const timers: Record<string, number> = {};
      updatedAlerts.forEach((alert) => {
        const timeLeft = Math.max(0, Math.floor((new Date(alert.expiresAt).getTime() - Date.now()) / 1000));
        timers[alert.id] = timeLeft;
      });
      setCountdowns(timers);
    });

    return () => {
      unsubscribeFromCampaignAlerts(channel);
    };
  }, [userId]);

  // Update countdown timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdowns((prev) => {
        const updated = { ...prev };
        let hasExpired = false;

        Object.keys(updated).forEach((alertId) => {
          updated[alertId] = Math.max(0, updated[alertId] - 1);
          if (updated[alertId] === 0) {
            hasExpired = true;
          }
        });

        // Remove expired alerts
        if (hasExpired) {
          setAlerts((prevAlerts) =>
            prevAlerts.filter((alert) => {
              const isExpired = updated[alert.id] === 0;
              if (isExpired) {
                // Also delete from database
                deleteCampaignAlert(alert.id).catch((error) => {
                  console.error('Error deleting expired alert:', error);
                });
              }
              return !isExpired;
            })
          );

          // Clean up countdowns object
          Object.keys(updated).forEach((alertId) => {
            if (updated[alertId] === 0) {
              delete updated[alertId];
            }
          });
        }

        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleDismissAlert = async (alertId: string) => {
    const success = await deleteCampaignAlert(alertId);
    if (success) {
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      setCountdowns((prev) => {
        const updated = { ...prev };
        delete updated[alertId];
        return updated;
      });
      toast.success('Alert dismissed');
    }
  };

  const handleMarkAsRead = async (alertId: string) => {
    await markCampaignAlertAsRead(alertId);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a))
    );
  };

  const formatTimeLeft = (seconds: number): string => {
    if (seconds <= 0) return 'Expired';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }
    return `${minutes}m left`;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading campaigns...</p>
      </div>
    );
  }

  if (alerts.length === 0 && targetedCampaigns.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground text-lg">No campaigns yet</p>
        <p className="text-sm text-muted-foreground mt-2">
          You haven't been targeted by any campaigns yet. Shop owners can create campaigns to reach you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Campaign Alerts (with expiration) */}
      {alerts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            Active Alerts
          </h3>
          <div className="space-y-3">
            {alerts.map((alert) => {
              const timeLeft = countdowns[alert.id] || 0;
              const isExpiringSoon = timeLeft < 3600; // Less than 1 hour

              return (
                <Card
                  key={alert.id}
                  className={`relative overflow-hidden transition-all ${
                    alert.isRead
                      ? 'bg-muted/30 border-border'
                      : 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
                  } ${isExpiringSoon ? 'border-orange-200 dark:border-orange-800' : ''}`}
                >
                  <CardContent className="pt-6">
                    <div className="flex gap-4">
                      {/* Badge */}
                      <div className="flex-shrink-0 pt-1">
                        <div
                          className={`h-3 w-3 rounded-full ${
                            alert.isRead
                              ? 'bg-muted-foreground/30'
                              : 'bg-blue-500 animate-pulse'
                          }`}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-base mb-1 line-clamp-2">
                          {alert.campaignTitle}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                          {alert.campaignMessage}
                        </p>

                        {/* Time left indicator */}
                        <div className="flex items-center gap-2 text-xs">
                          <Clock className="h-3 w-3" />
                          <span
                            className={`font-medium ${
                              isExpiringSoon ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'
                            }`}
                          >
                            {formatTimeLeft(timeLeft)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {!alert.isRead && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkAsRead(alert.id)}
                            className="text-xs h-8"
                          >
                            Mark Read
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDismissAlert(alert.id)}
                          className="h-8 w-8 p-0"
                          title="Dismiss alert"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Targeted Campaigns (you matched the criteria) */}
      {targetedCampaigns.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-green-500" />
            Available Campaigns
          </h3>
          <div className="space-y-3">
            {targetedCampaigns.map((campaign) => (
              <Card
                key={campaign.campaignId}
                className="relative overflow-hidden transition-all bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700"
              >
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    {/* Badge */}
                    <div className="flex-shrink-0 pt-1">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-base mb-1 line-clamp-2">
                        {campaign.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {campaign.message}
                      </p>
                      {campaign.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                          {campaign.description}
                        </p>
                      )}

                      {/* Status badge */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs font-medium capitalize">
                          {campaign.status === 'sent' ? '✅ Active' : campaign.status}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-shrink-0 text-right text-xs text-muted-foreground">
                      <p>Matched on</p>
                      <p className="font-medium">
                        {campaign.matchedAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
