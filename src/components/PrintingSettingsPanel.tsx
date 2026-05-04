import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Printer, Plus, X, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPrintingSettings, savePrintingSettings, type PrintingSettings } from '@/lib/supabase-printing';

interface PrintingSettingsPanelProps {
  shopId: string;
}

export const PrintingSettingsPanel = ({ shopId }: PrintingSettingsPanelProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PrintingSettings>({
    shopId,
    isEnabled: false,
    priceBwSingle: 2,
    priceBwDouble: 3,
    isColorAvailable: false,
    priceColorSingle: 10,
    priceColorDouble: 15,
    paperTypes: ['A4 Standard'],
  });
  const [newPaperType, setNewPaperType] = useState('');

  useEffect(() => {
    loadSettings();
  }, [shopId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getPrintingSettings(shopId);
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading printing settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await savePrintingSettings(settings);
      if (success) {
        toast.success('Printing settings saved successfully!');
      } else {
        toast.error('Failed to save printing settings.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const addPaperType = () => {
    if (!newPaperType.trim()) return;
    if (settings.paperTypes.includes(newPaperType.trim())) {
      toast.error('Paper type already exists');
      return;
    }
    setSettings({
      ...settings,
      paperTypes: [...settings.paperTypes, newPaperType.trim()],
    });
    setNewPaperType('');
  };

  const removePaperType = (type: string) => {
    setSettings({
      ...settings,
      paperTypes: settings.paperTypes.filter((t) => t !== type),
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-red-500" />
            Document Printing Service
          </CardTitle>
          <CardDescription>
            Configure prices and options for your document printing service
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Printing Service</Label>
              <p className="text-sm text-muted-foreground">
                Show the printing section on your shop's page
              </p>
            </div>
            <Switch
              checked={settings.isEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, isEnabled: checked })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Black & White Prices */}
            <div className="space-y-4 p-4 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
              <h4 className="font-bold text-sm uppercase tracking-wider text-slate-500">Black & White Printing</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Price per side (Single Sided)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                    <Input
                      type="number"
                      value={settings.priceBwSingle}
                      onChange={(e) => setSettings({ ...settings, priceBwSingle: parseFloat(e.target.value) || 0 })}
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Price per page (Double Sided)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                    <Input
                      type="number"
                      value={settings.priceBwDouble}
                      onChange={(e) => setSettings({ ...settings, priceBwDouble: parseFloat(e.target.value) || 0 })}
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Color Prices */}
            <div className={`space-y-4 p-4 border rounded-lg ${settings.isColorAvailable ? 'bg-red-50/50 dark:bg-red-950/20' : 'bg-slate-50/50 dark:bg-slate-900/50 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm uppercase tracking-wider text-red-500">Color Printing</h4>
                <Switch
                  checked={settings.isColorAvailable}
                  onCheckedChange={(checked) => setSettings({ ...settings, isColorAvailable: checked })}
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Price per side (Single Sided)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                    <Input
                      type="number"
                      disabled={!settings.isColorAvailable}
                      value={settings.priceColorSingle}
                      onChange={(e) => setSettings({ ...settings, priceColorSingle: parseFloat(e.target.value) || 0 })}
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Price per page (Double Sided)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                    <Input
                      type="number"
                      disabled={!settings.isColorAvailable}
                      value={settings.priceColorDouble}
                      onChange={(e) => setSettings({ ...settings, priceColorDouble: parseFloat(e.target.value) || 0 })}
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Paper Types */}
          <div className="space-y-4 p-4 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
            <h4 className="font-bold text-sm uppercase tracking-wider text-slate-500">Available Paper Types</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {settings.paperTypes.map((type) => (
                <Badge key={type} variant="secondary" className="px-3 py-1 gap-1 text-sm bg-white dark:bg-slate-800 border">
                  {type}
                  <button onClick={() => removePaperType(type)} className="text-muted-foreground hover:text-red-500 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {settings.paperTypes.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No paper types added. Please add at least one.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add paper type (e.g., A4 Sheet, Glossy Paper)"
                value={newPaperType}
                onChange={(e) => setNewPaperType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPaperType()}
              />
              <Button type="button" variant="outline" onClick={addPaperType} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 text-lg font-bold shadow-lg"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                Save Printing Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
