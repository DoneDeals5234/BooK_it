import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Loader2, Eye, Copy, Trash2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { CampaignAnalytics } from './CampaignAnalytics';

interface Campaign {
  id: string;
  title: string;
  message: string;
  status: string;
  scheduled_at?: string;
  sent_at?: string;
  created_at: string;
}

interface CampaignHistoryProps {
  shopId: string;
  onSelectCampaign?: (campaign: Campaign) => void;
}

export const CampaignHistory = ({ shopId, onSelectCampaign }: CampaignHistoryProps) => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const fetchCampaigns = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setCampaigns(data);
      }
      setLoading(false);
    };

    fetchCampaigns();

    // Subscribe to real-time updates for this shop
    const channel = supabase
      .channel(`campaigns-${shopId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns',
          filter: `shop_id=eq.${shopId}`,
        },
        (payload: any) => {
          if (payload.new) {
            setCampaigns((prev) => {
              const updated = prev.filter((c) => c.id !== payload.new.id);
              return [payload.new as Campaign, ...updated];
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.uid]);

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    setDeleting(campaignId);
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;

      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      toast.success('Campaign deleted');
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast.error('Failed to delete campaign');
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'scheduled':
        return <Badge variant="secondary">Scheduled</Badge>;
      case 'sent':
        return <Badge className="bg-green-600">Sent</Badge>;
      case 'completed':
        return <Badge className="bg-blue-600">Completed</Badge>;
      case 'paused':
        return <Badge variant="destructive">Paused</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (selectedCampaign) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setSelectedCampaign(null)}>
            ← Back
          </Button>
          <div>
            <h3 className="text-lg font-semibold">{selectedCampaign.title}</h3>
            <p className="text-sm text-muted-foreground">{getStatusBadge(selectedCampaign.status)}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">MESSAGE</p>
              <p className="text-sm mt-1 whitespace-pre-wrap">{selectedCampaign.message}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">CREATED</p>
                <p className="text-sm mt-1">{new Date(selectedCampaign.created_at).toLocaleDateString()}</p>
              </div>
              {selectedCampaign.sent_at && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">SENT</p>
                  <p className="text-sm mt-1">{new Date(selectedCampaign.sent_at).toLocaleString()}</p>
                </div>
              )}
              {selectedCampaign.scheduled_at && !selectedCampaign.sent_at && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">SCHEDULED FOR</p>
                  <p className="text-sm mt-1">{new Date(selectedCampaign.scheduled_at).toLocaleString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedCampaign.status === 'sent' && (
          <>
            <h3 className="text-lg font-semibold">Analytics</h3>
            <CampaignAnalytics campaignId={selectedCampaign.id} />
          </>
        )}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <p>No campaigns yet. Create your first campaign!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => (
        <Card key={campaign.id} className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold truncate">{campaign.title}</h3>
                  {getStatusBadge(campaign.status)}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{campaign.message}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span>Created {new Date(campaign.created_at).toLocaleDateString()}</span>
                  {campaign.scheduled_at && !campaign.sent_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Scheduled for {new Date(campaign.scheduled_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCampaign(campaign)}
                  title="View details and analytics"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteCampaign(campaign.id)}
                  disabled={deleting === campaign.id}
                  title="Delete campaign"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
