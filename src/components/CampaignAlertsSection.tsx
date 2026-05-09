import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, X, Target, Loader2, Store, ArrowLeft } from 'lucide-react';
import { getShopById } from '@/lib/shops-storage';
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
  const [shopsData, setShopsData] = useState<Record<string, {name: string, id: string}>>({});

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

      // Fetch shop details for all campaigns
      const shopIds = [...new Set([
        ...alertsData.map(a => a.shopId),
        ...campaignsData.map(c => c.shopId)
      ])];

      const shopMap: Record<string, {name: string, id: string}> = {};
      await Promise.all(shopIds.map(async (id) => {
        const shop = await getShopById(id);
        if (shop) {
          shopMap[id] = { name: shop.name, id: shop.id };
        }
      }));
      setShopsData(shopMap);

      // Initialize countdown timers
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
    const channel = subscribeToUserCampaignAlerts(userId, async (updatedAlerts) => {
      setAlerts(updatedAlerts);
      
      // Update shop data if new shop IDs appear
      const newShopIds = updatedAlerts.map(a => a.shopId).filter(id => !shopsData[id]);
      if (newShopIds.length > 0) {
        const newShops = { ...shopsData };
        await Promise.all(newShopIds.map(async (id) => {
          const shop = await getShopById(id);
          if (shop) newShops[id] = { name: shop.name, id: shop.id };
        }));
        setShopsData(newShops);
      }

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
  }, [userId, shopsData]);

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
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto mb-4" />
        <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Loading advertisements...</p>
      </div>
    );
  }

  if (alerts.length === 0 && targetedCampaigns.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-[40px] border border-slate-100 shadow-sm">
        <AlertCircle className="h-12 w-12 mx-auto text-slate-200 mb-4" />
        <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">No campaigns yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Campaign Alerts (with expiration) */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-2">
            Priority Alerts
          </h3>
          <div className="space-y-3">
            {alerts.map((alert) => {
              const timeLeft = countdowns[alert.id] || 0;
              const isExpiringSoon = timeLeft < 3600; // Less than 1 hour
              const shop = shopsData[alert.shopId];

              return (
                <Card
                  key={alert.id}
                  className={`relative overflow-hidden border-none shadow-sm ${
                    alert.isRead ? 'bg-white opacity-80' : 'bg-blue-50 border-l-4 border-blue-500'
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-100 px-2 py-0.5 rounded-full">Alert</span>
                          {shop && (
                             <span className="text-[9px] font-bold text-slate-400">By {shop.name}</span>
                          )}
                        </div>
                        <h4 className="font-black text-slate-900 text-sm italic uppercase tracking-tighter mb-1">
                          {alert.campaignTitle}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium mb-3">
                          {alert.campaignMessage}
                        </p>

                        <div className="flex items-center justify-between">
                          <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${isExpiringSoon ? 'text-red-500' : 'text-slate-400'}`}>
                            <Clock className="h-3 w-3" />
                            {formatTimeLeft(timeLeft)}
                          </div>
                          <div className="flex gap-2">
                            {!alert.isRead && (
                              <button onClick={() => handleMarkAsRead(alert.id)} className="text-[9px] font-black uppercase text-blue-600 hover:underline">Mark Read</button>
                            )}
                            <button onClick={() => handleDismissAlert(alert.id)} className="text-[9px] font-black uppercase text-slate-400 hover:text-red-500">Dismiss</button>
                          </div>
                        </div>
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
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-2">
            Campaigns Advertisement that hits you
          </h3>
          <div className="grid gap-4">
            {targetedCampaigns.map((campaign) => {
              const shop = shopsData[campaign.shopId];
              return (
                <Card
                  key={campaign.campaignId}
                  className="relative overflow-hidden border-none shadow-xl bg-white rounded-[32px] group hover:scale-[1.02] transition-transform"
                >
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                            Matched {new Date(campaign.matchedAt).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <h4 className="font-black text-slate-900 text-lg italic uppercase tracking-tighter mb-1 leading-tight">
                          {campaign.title}
                        </h4>
                        
                        <p className="text-sm text-slate-500 font-medium mb-4">
                          {campaign.message}
                        </p>

                        {shop && (
                          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-2">
                              <Store className="h-4 w-4 text-orange-500" />
                              <p className="text-[10px] font-black text-slate-900 uppercase">
                                From: {shop.name}
                              </p>
                            </div>
                            <button 
                              onClick={() => window.location.href = `/shop/${shop.id}`}
                              className="text-[9px] font-black uppercase text-orange-600 hover:underline flex items-center gap-1"
                            >
                              Visit Shop <ArrowLeft className="h-3 w-3 rotate-180" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  {/* Visual Accent */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/10 to-transparent -mr-16 -mt-16 rounded-full blur-2xl pointer-events-none" />
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
