import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Loader2, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ReceivedCampaign {
  id: string;
  title: string;
  body: string;
  received_at: string;
}

export const ReceivedCampaignsList = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<ReceivedCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const fetchReceivedCampaigns = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_received_campaigns')
        .select('*')
        .eq('user_id', user.uid)
        .order('received_at', { ascending: false });

      if (!error && data) {
        setCampaigns(data);
      }
      setLoading(false);
    };

    fetchReceivedCampaigns();

    // Subscribe to real-time updates for this user
    const channel = supabase
      .channel(`received-campaigns-${user.uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_received_campaigns',
          filter: `user_id=eq.${user.uid}`,
        },
        (payload: any) => {
          if (payload.new) {
            setCampaigns((prev) => [payload.new as ReceivedCampaign, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <p>No campaigns received yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => (
        <Card key={campaign.id} className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-full text-red-600">
                <Bell className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{campaign.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{campaign.body}</p>
                <div className="text-xs text-muted-foreground mt-2">
                  Received {new Date(campaign.received_at).toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
