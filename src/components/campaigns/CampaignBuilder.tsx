import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send, Clock, MessageSquare, Camera, X } from 'lucide-react';
import { CampaignTargetSelector } from './CampaignTargetSelector';
import { ScheduleSelector } from './ScheduleSelector';
import { supabase } from '@/lib/supabase';
import { uploadNotificationImage } from '@/lib/notification-storage';
import { sendCampaignDirectly } from '@/lib/campaign-sender';
import { getLatestPlanForEmail, type ShopOwnerPlan } from '@/lib/supabase-shop-owner-plans';
import { getShopById } from '@/lib/shops-storage';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface CampaignBuilderProps {
  onClose: () => void;
  shopId: string;
  onCampaignCreated?: () => void;
}

interface CampaignTarget {
  country: string;
  state?: string;
  district?: string;
  village?: string;
}

export const CampaignBuilder = ({ onClose, shopId, onCampaignCreated }: CampaignBuilderProps) => {
  const [step, setStep] = useState<'basic' | 'targeting' | 'schedule' | 'review'>('basic');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [target, setTarget] = useState<CampaignTarget>({ country: '' });
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<ShopOwnerPlan | null>(null);
  const [isPlanRestricted, setIsPlanRestricted] = useState(false);
  const [matchedUsersCount, setMatchedUsersCount] = useState<number | null>(null);
  const [calculatingAudience, setCalculatingAudience] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchPlanAndShop = async () => {
      if (!user?.email || !shopId) return;

      try {
        const [plan, shop] = await Promise.all([
          getLatestPlanForEmail(user.email),
          getShopById(shopId)
        ]);

        setCurrentPlan(plan);

        const planName = plan?.plan_name || 'basic';
        if (planName === 'pro' && shop) {
          setIsPlanRestricted(true);
          setTarget({
            country: shop.country || 'India', // Default to India if not set
            state: shop.state || undefined,
            district: shop.district || undefined,
            village: shop.village || undefined,
          });
        }
      } catch (error) {
        console.error('Error fetching plan/shop:', error);
      }
    };

    fetchPlanAndShop();
  }, [user?.email, shopId]);

  useEffect(() => {
    const fetchAudienceCount = async () => {
      // Run on all steps so owner knows reach early
      setCalculatingAudience(true);
      try {
        let query = supabase.from('user_profiles').select('user_id', { count: 'exact', head: true });
        
        if (target.country) query = query.eq('country', target.country);
        if (target.state) query = query.eq('state', target.state);
        if (target.district) query = query.eq('district', target.district);
        if (target.village) query = query.eq('village', target.village);

        const { count, error } = await query;
        if (!error) {
          setMatchedUsersCount(count);
        }
      } catch (err) {
        console.error('Error calculating audience:', err);
      } finally {
        setCalculatingAudience(false);
      }
    };

    const timer = setTimeout(() => {
      fetchAudienceCount();
    }, 500); // Debounce to avoid too many requests

    return () => clearTimeout(timer);
  }, [target, step]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const url = await uploadNotificationImage(file);
      setImageUrl(url);
      toast.success('Image uploaded successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload image';
      console.error('Image upload error:', error);
      toast.error(message);
    } finally {
      setUploadingImage(false);
      // Reset input
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const handleCreateCampaign = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!target.country) {
      toast.error('Please select a target location');
      return;
    }

    setLoading(true);
    try {
      const token = user ? await user.getIdToken() : '';

      if (!token) {
        throw new Error('User not authenticated. Please log in again.');
      }

      console.log('🚀 Creating scheduled campaign:', { title, message, shopId, scheduledAt });

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          shop_id: shopId,
          title,
          message,
          image_url: imageUrl || null,
          status: 'draft',
        })
        .select()
        .single();

      if (campaignError) {
        console.error('❌ Campaign creation error:', campaignError);
        throw new Error(`Failed to create campaign: ${campaignError.message}`);
      }

      console.log('✅ Campaign created:', campaign.id);

      // Add targeting
      if (campaign) {
        const targetData = {
          campaign_id: campaign.id,
          country: target.country,
          state: target.state || null,
          district: target.district || null,
          village: target.village || null,
        };

        console.log('🎯 Adding targeting:', targetData);

        const { error: targetError } = await supabase
          .from('campaign_targets')
          .insert(targetData);

        if (targetError) {
          console.error('❌ Target creation error:', targetError);
          throw new Error(`Failed to set campaign target: ${targetError.message}`);
        }

        console.log('✅ Campaign targeting added');

        // If scheduled, schedule the campaign
        if (scheduledAt) {
          const scheduleUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/schedule-campaign`;
          console.log('⏰ Scheduling campaign for:', scheduledAt.toISOString());
          console.log('⏰ Token received:', token ? `✅ (${token.substring(0, 20)}...)` : '❌ Empty');
          console.log('⏰ Token length:', token.length);

          const response = await fetch(scheduleUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              campaign_id: campaign.id,
              scheduled_at: scheduledAt.toISOString(),
            }),
          });

          const responseText = await response.text();
          console.log('📅 Schedule function response status:', response.status);
          console.log('📅 Schedule function response:', responseText);

          let responseData;
          try {
            responseData = JSON.parse(responseText);
          } catch {
            throw new Error(`Invalid response from schedule function: ${responseText}`);
          }

          if (!response.ok) {
            throw new Error(responseData.error || responseData.details || `Failed to schedule campaign (${response.status})`);
          }

          console.log('✅ Campaign scheduled successfully:', responseData);
        }

        toast.success(scheduledAt ? 'Campaign scheduled successfully' : 'Campaign created successfully');
        onCampaignCreated?.();
        onClose();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error, null, 2));
      console.error('❌ Error creating campaign:', errorMessage);
      console.error('Full error object:', error);
      if (error instanceof Error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSendNow = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!target.country) {
      toast.error('Please select a target location');
      return;
    }

    setLoading(true);
    try {
      console.log('🚀 Creating campaign:', { title, message, shopId });

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          shop_id: shopId,
          title,
          message,
          image_url: imageUrl || null,
          status: 'draft',
        })
        .select()
        .single();

      if (campaignError) {
        console.error('❌ Campaign creation error:', campaignError);
        throw new Error(`Failed to create campaign: ${campaignError.message}`);
      }

      console.log('✅ Campaign created:', campaign.id);

      // Add targeting
      if (campaign) {
        const targetData = {
          campaign_id: campaign.id,
          country: target.country,
          state: target.state || null,
          district: target.district || null,
          village: target.village || null,
        };

        console.log('🎯 Adding targeting:', targetData);

        const { error: targetError } = await supabase
          .from('campaign_targets')
          .insert(targetData);

        if (targetError) {
          console.error('❌ Target creation error:', targetError);
          throw new Error(`Failed to set campaign target: ${targetError.message}`);
        }

        console.log('✅ Campaign targeting added');

        // Send via Hybrid System (Edge Function triggers Realtime + OneSignal backup)
        console.log('📤 Triggering hybrid campaign send (Realtime + OneSignal)...');

        const result = await sendCampaignDirectly(
          {
            id: campaign.id,
            title,
            message,
            image_url: imageUrl || undefined,
          },
          target
        );

        console.log('✅ Campaign sent successfully!');
        console.log('📊 Campaign matched users:', result.matchedCount);
        console.log('📊 Campaign sent to users:', result.sentCount);
        toast.success(`Campaign sent to ${result.sentCount} user(s)`);
        onCampaignCreated?.();
        onClose();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error, null, 2));
      console.error('❌ Error sending campaign:', errorMessage);
      console.error('Full error object:', error);
      if (error instanceof Error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Create Campaign</h2>
          <p className="text-sm text-muted-foreground">Step {step === 'basic' ? '1' : step === 'targeting' ? '2' : step === 'schedule' ? '3' : '4'} of 4</p>
        </div>
      </div>

      {step === 'basic' && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
            <CardDescription>Give your campaign a title and compose your message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-title">Campaign Title</Label>
              <Input
                id="campaign-title"
                placeholder="e.g., Summer Haircut Offer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-message">Message</Label>
              <Textarea
                id="campaign-message"
                placeholder="Write your notification message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">{message.length} characters</p>
            </div>
            <div className="space-y-2">
              <Label>Campaign Image (Optional)</Label>
              <div className="flex items-center gap-4">
                {imageUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={imageUrl}
                      alt="Campaign"
                      className="h-32 w-32 rounded-lg object-cover border-2 border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-muted-foreground rounded-lg hover:border-primary transition-colors disabled:opacity-50"
                  >
                    <Camera className="h-6 w-6 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground">
                      {uploadingImage ? 'Uploading...' : 'Upload Image'}
                    </span>
                  </button>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="hidden"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowPreview(true)}
                variant="outline"
                className="flex-1"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button
                onClick={() => setStep('targeting')}
                className="flex-1"
                disabled={!title.trim() || !message.trim()}
              >
                Next
              </Button>
            </div>

            {/* NEW: Immediate Audience Reach Indicator */}
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Current Reach</p>
                  <p className="text-sm font-bold text-slate-900">Targeting {target.village || target.district || target.state || 'Selected Area'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-primary leading-none">
                  {calculatingAudience ? '...' : (matchedUsersCount || 0)}
                </p>
                <p className="text-[10px] font-bold text-slate-500">Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'targeting' && (
        <Card>
          <CardHeader>
            <CardTitle>Target Audience</CardTitle>
            <CardDescription>
              {isPlanRestricted
                ? 'Your plan restricts targeting to your shop location only'
                : 'Select the geographic area to target'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPlanRestricted ? (
              <div className="bg-muted p-4 rounded-lg space-y-3 border border-dashed border-primary/30">
                <div className="flex items-center gap-2 text-primary">
                  <span className="text-lg">📍</span>
                  <p className="font-semibold text-sm">PRO Plan Restricted Targeting</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Village/Area</p>
                    <p className="font-medium">{target.village || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">District</p>
                    <p className="font-medium">{target.district || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">State</p>
                    <p className="font-medium">{target.state || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Country</p>
                    <p className="font-medium">{target.country || 'N/A'}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pt-2 italic">
                  * Upgrade to PREMIUM to target any custom address.
                </p>
              </div>
            ) : (
              <CampaignTargetSelector target={target} onChange={setTarget} />
            )}

            <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-center justify-between border border-blue-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">👥</span>
                <div>
                  <p className="font-semibold text-sm">Estimated Audience</p>
                  <p className="text-xs text-blue-600">Users matching this location</p>
                </div>
              </div>
              <div className="text-2xl font-bold">
                {calculatingAudience ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  matchedUsersCount !== null ? matchedUsersCount : 'N/A'
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setStep('basic')}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep('schedule')}
                className="flex-1"
                disabled={isPlanRestricted ? false : !target.country}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'schedule' && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule & Send</CardTitle>
            <CardDescription>Choose when to send your campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScheduleSelector value={scheduledAt} onChange={setScheduledAt} />
            <div className="flex gap-2">
              <Button
                onClick={() => setStep('targeting')}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep('review')}
                className="flex-1"
              >
                Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'review' && (
        <Card>
          <CardHeader>
            <CardTitle>Review Campaign</CardTitle>
            <CardDescription>Confirm your campaign details before sending</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">TITLE</p>
                <p className="font-medium">{title}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">MESSAGE</p>
                <p className="text-sm whitespace-pre-wrap">{message}</p>
              </div>
              {imageUrl && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">IMAGE</p>
                  <img src={imageUrl} alt="Campaign" className="h-24 w-24 rounded object-cover mt-2" />
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-muted-foreground">TARGET AREA</p>
                <p className="text-sm">
                  {target.village && `${target.village}, `}
                  {target.district && `${target.district}, `}
                  {target.state && `${target.state}, `}
                  {target.country}
                </p>
              </div>
              {scheduledAt && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">SCHEDULED FOR</p>
                  <p className="text-sm">{scheduledAt.toLocaleString()}</p>
                </div>
              )}
              {matchedUsersCount !== null && (
                <div className="pt-2 border-t border-muted-foreground/20">
                  <p className="text-xs font-semibold text-blue-600">ESTIMATED REACH</p>
                  <p className="text-sm font-bold text-blue-800">{matchedUsersCount} Users</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setStep('schedule')}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              {scheduledAt ? (
                <Button
                  onClick={handleCreateCampaign}
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? 'Scheduling...' : 'Schedule Campaign'}
                  <Clock className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSendNow}
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Now'}
                  <Send className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notification Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gradient-to-b from-blue-500 to-blue-600 text-white p-4 rounded-lg">
              <p className="text-xs font-semibold mb-2">Notification Preview</p>
              <div className="bg-white text-black rounded p-3 space-y-2">
                <p className="font-semibold text-sm">{title || 'Campaign Title'}</p>
                <p className="text-xs">{message || 'Your message will appear here...'}</p>
              </div>
            </div>
            <Button onClick={() => setShowPreview(false)} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
