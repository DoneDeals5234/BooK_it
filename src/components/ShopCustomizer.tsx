import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, Save, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getShopCustomization,
  saveShopCustomization,
  getDefaultCustomization,
  type ShopCustomization,
} from '@/lib/shop-customization-db';

interface ShopCustomizerProps {
  shopId: string;
  shopOwnerEmail: string;
}

export const ShopCustomizer = ({
  shopId,
  shopOwnerEmail,
}: ShopCustomizerProps) => {
  const [customization, setCustomization] =
    useState<ShopCustomization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('colors');
  const [swipeX, setSwipeX] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const tabOrder = ['colors', 'layout', 'buttons', 'features'];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartXRef.current || !touchStartYRef.current) return;

    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = touchStartXRef.current - touchX;
    const deltaY = touchStartYRef.current - touchY;

    // If horizontal swipe is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setSwipeX(deltaX);
      if (Math.abs(deltaX) > 50) {
        const currentIndex = tabOrder.indexOf(activeTab);
        if (deltaX > 0 && currentIndex < tabOrder.length - 1) {
          // Swipe left -> Next tab
          setActiveTab(tabOrder[currentIndex + 1]);
          touchStartXRef.current = null;
          touchStartYRef.current = null;
          setSwipeX(0);
        } else if (deltaX < 0 && currentIndex > 0) {
          // Swipe right -> Previous tab
          setActiveTab(tabOrder[currentIndex - 1]);
          touchStartXRef.current = null;
          touchStartYRef.current = null;
          setSwipeX(0);
        }
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    setSwipeX(0);
  };

  useEffect(() => {
    loadCustomization();
  }, [shopId]);

  const loadCustomization = async () => {
    try {
      let existing = await getShopCustomization(shopId);
      if (!existing) {
        existing = getDefaultCustomization(shopId);
      }
      setCustomization(existing);
    } catch (error) {
      console.error('Error loading customization:', error);
      setCustomization(getDefaultCustomization(shopId));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!customization) return;

    setSaving(true);
    try {
      const success = await saveShopCustomization(customization);
      if (success) {
        toast.success('Customizations saved successfully! Changes will appear for all customers.');
      } else {
        toast.error('Failed to save customizations. Please try again.');
      }
    } catch (error) {
      console.error('Error saving customization:', error);
      toast.error('An error occurred while saving customizations.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const defaultCustomization = getDefaultCustomization(shopId);
    setCustomization(defaultCustomization);
    try {
      const success = await saveShopCustomization(defaultCustomization);
      if (success) {
        toast.success('Customizations reset to default.');
      } else {
        toast.error('Failed to reset customizations.');
      }
    } catch (error) {
      console.error('Error resetting customization:', error);
      toast.error('An error occurred while resetting customizations.');
    }
  };

  if (loading || !customization) {
    return <div className="p-4 text-center">Loading customization...</div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Shop View Page Customization</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Customize the appearance of your shop's view page. Changes are saved to the cloud
          and will be visible to all customers instantly.
        </p>
      </CardHeader>

      <CardContent
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="colors">Colors</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="buttons">Buttons</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: swipeX > 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: swipeX > 0 ? 20 : -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Colors Tab */}
              <TabsContent value="colors" className="space-y-4">
                <div className="space-y-4">
                  {/* Background Color */}
                  <div className="flex items-center gap-4">
                    <Label className="w-32">Background Color</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={customization.backgroundColor}
                        onChange={(e) =>
                          setCustomization({
                            ...customization,
                            backgroundColor: e.target.value,
                          })
                        }
                        className="h-10 w-20 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={customization.backgroundColor}
                        onChange={(e) =>
                          setCustomization({
                            ...customization,
                            backgroundColor: e.target.value,
                          })
                        }
                        placeholder="#ffffff"
                        className="flex-1 text-sm font-mono"
                      />
                    </div>
                  </div>

                  {/* Primary Color (Accent) */}
                  <div className="flex items-center gap-4">
                    <Label className="w-32">Primary Color</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={customization.primaryColor}
                        onChange={(e) =>
                          setCustomization({
                            ...customization,
                            primaryColor: e.target.value,
                          })
                        }
                        className="h-10 w-20 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={customization.primaryColor}
                        onChange={(e) =>
                          setCustomization({
                            ...customization,
                            primaryColor: e.target.value,
                          })
                        }
                        placeholder="#3b82f6"
                        className="flex-1 text-sm font-mono"
                      />
                    </div>
                  </div>

                  {/* Text Color */}
                  <div className="flex items-center gap-4">
                    <Label className="w-32">Text Color</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={customization.textColor}
                        onChange={(e) =>
                          setCustomization({
                            ...customization,
                            textColor: e.target.value,
                          })
                        }
                        className="h-10 w-20 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={customization.textColor}
                        onChange={(e) =>
                          setCustomization({
                            ...customization,
                            textColor: e.target.value,
                          })
                        }
                        placeholder="#1f2937"
                        className="flex-1 text-sm font-mono"
                      />
                    </div>
                  </div>

                  {/* Border Radius */}
                  <div className="flex items-center gap-4">
                    <Label className="w-32">Border Radius</Label>
                    <Select
                      value={customization.borderRadius}
                      onValueChange={(value: any) =>
                        setCustomization({
                          ...customization,
                          borderRadius: value,
                        })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Sharp)</SelectItem>
                        <SelectItem value="sm">Small</SelectItem>
                        <SelectItem value="md">Medium</SelectItem>
                        <SelectItem value="lg">Large</SelectItem>
                        <SelectItem value="full">Full (Pill)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* Layout Tab */}
              <TabsContent value="layout" className="space-y-4">
                <div className="space-y-4">
                  {/* Layout Style */}
                  <div className="flex items-center gap-4">
                    <Label className="w-32">Layout Style</Label>
                    <Select
                      value={customization.layoutStyle}
                      onValueChange={(value: any) =>
                        setCustomization({
                          ...customization,
                          layoutStyle: value,
                        })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">Compact</SelectItem>
                        <SelectItem value="spacious">Spacious</SelectItem>
                        <SelectItem value="card-grid">Card Grid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Card Style */}
                  <div className="flex items-center gap-4">
                    <Label className="w-32">Card Style</Label>
                    <Select
                      value={customization.cardStyle}
                      onValueChange={(value: any) =>
                        setCustomization({
                          ...customization,
                          cardStyle: value,
                        })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat</SelectItem>
                        <SelectItem value="elevated">Elevated</SelectItem>
                        <SelectItem value="outlined">Outlined</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* Buttons Tab */}
              <TabsContent value="buttons" className="space-y-4">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Customize the appearance and position of buttons
                  </p>

                  {/* Button Shape */}
                  <div className="flex items-center gap-4">
                    <Label className="w-32">Button Shape</Label>
                    <Select
                      value={customization.buttonCustomization?.shape || 'rounded'}
                      onValueChange={(value: any) =>
                        setCustomization({
                          ...customization,
                          buttonCustomization: {
                            ...(customization.buttonCustomization || {
                              color: '#3b82f6',
                              textColor: '#ffffff',
                              size: 'md',
                              position: 'bottom',
                            }),
                            shape: value,
                          },
                        })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="square">Square</SelectItem>
                        <SelectItem value="rounded">Rounded</SelectItem>
                        <SelectItem value="pill">Pill (Full Round)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Button Color */}
                  <div className="flex items-center gap-4">
                    <Label className="w-32">Button Color</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={customization.buttonCustomization?.color || '#3b82f6'}
                        onChange={(e) =>
                          setCustomization({
                            ...customization,
                            buttonCustomization: {
                              ...(customization.buttonCustomization || {
                                shape: 'rounded',
                                textColor: '#ffffff',
                                size: 'md',
                                position: 'bottom',
                              }),
                              color: e.target.value,
                            },
                          })
                        }
                        className="h-10 w-20 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={customization.buttonCustomization?.color || '#3b82f6'}
                        onChange={(e) =>
                          setCustomization({
                            ...customization,
                            buttonCustomization: {
                              ...(customization.buttonCustomization || {
                                shape: 'rounded',
                                textColor: '#ffffff',
                                size: 'md',
                                position: 'bottom',
                              }),
                              color: e.target.value,
                            },
                          })
                        }
                        placeholder="#3b82f6"
                        className="flex-1 text-sm font-mono"
                      />
                    </div>
                  </div>

                  {/* Button Text Color */}
                  <div className="flex items-center gap-4">
                    <Label className="w-32">Button Text</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={customization.buttonCustomization?.textColor || '#ffffff'}
                        onChange={(e) =>
                          setCustomization({
                            ...customization,
                            buttonCustomization: {
                              ...(customization.buttonCustomization || {
                                shape: 'rounded',
                                color: '#3b82f6',
                                size: 'md',
                                position: 'bottom',
                              }),
                              textColor: e.target.value,
                            },
                          })
                        }
                        className="h-10 w-20 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={customization.buttonCustomization?.textColor || '#ffffff'}
                        onChange={(e) =>
                          setCustomization({
                            ...customization,
                            buttonCustomization: {
                              ...(customization.buttonCustomization || {
                                shape: 'rounded',
                                color: '#3b82f6',
                                size: 'md',
                                position: 'bottom',
                              }),
                              textColor: e.target.value,
                            },
                          })
                        }
                        placeholder="#ffffff"
                        className="flex-1 text-sm font-mono"
                      />
                    </div>
                  </div>

                  {/* Button Size */}
                  <div className="flex items-center gap-4">
                    <Label className="w-32">Button Size</Label>
                    <Select
                      value={customization.buttonCustomization?.size || 'md'}
                      onValueChange={(value: any) =>
                        setCustomization({
                          ...customization,
                          buttonCustomization: {
                            ...(customization.buttonCustomization || {
                              shape: 'rounded',
                              color: '#3b82f6',
                              textColor: '#ffffff',
                              position: 'bottom',
                            }),
                            size: value,
                          },
                        })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sm">Small</SelectItem>
                        <SelectItem value="md">Medium</SelectItem>
                        <SelectItem value="lg">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Button Position */}
                  <div className="flex items-center gap-4">
                    <Label className="w-32">Button Position</Label>
                    <Select
                      value={customization.buttonCustomization?.position || 'bottom'}
                      onValueChange={(value: any) =>
                        setCustomization({
                          ...customization,
                          buttonCustomization: {
                            ...(customization.buttonCustomization || {
                              shape: 'rounded',
                              color: '#3b82f6',
                              textColor: '#ffffff',
                              size: 'md',
                            }),
                            position: value,
                          },
                        })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top">Top of Page</SelectItem>
                        <SelectItem value="bottom">Bottom of Page</SelectItem>
                        <SelectItem value="floating">Floating (Fixed)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Button Preview */}
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-muted-foreground mb-3">Preview</p>
                    <button
                      style={{
                        backgroundColor: customization.buttonCustomization?.color || '#3b82f6',
                        color: customization.buttonCustomization?.textColor || '#ffffff',
                        borderRadius: {
                          square: '0px',
                          rounded: '0.375rem',
                          pill: '9999px',
                        }[customization.buttonCustomization?.shape || 'rounded'],
                        padding: {
                          sm: '0.5rem 0.75rem',
                          md: '0.75rem 1.25rem',
                          lg: '1rem 1.5rem',
                        }[customization.buttonCustomization?.size || 'md'],
                      }}
                      className="font-medium text-sm"
                    >
                      Book Appointment
                    </button>
                  </div>
                </div>
              </TabsContent>

              {/* Features Tab */}
              <TabsContent value="features" className="space-y-4">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Show or hide sections on your shop view page
                  </p>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="showTeam"
                      checked={customization.enabledFeatures.showTeam}
                      onCheckedChange={(checked) =>
                        setCustomization({
                          ...customization,
                          enabledFeatures: {
                            ...customization.enabledFeatures,
                            showTeam: checked as boolean,
                          },
                        })
                      }
                    />
                    <Label htmlFor="showTeam" className="cursor-pointer">
                      Show Team Section
                    </Label>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="showAbout"
                      checked={customization.enabledFeatures.showAbout}
                      onCheckedChange={(checked) =>
                        setCustomization({
                          ...customization,
                          enabledFeatures: {
                            ...customization.enabledFeatures,
                            showAbout: checked as boolean,
                          },
                        })
                      }
                    />
                    <Label htmlFor="showAbout" className="cursor-pointer">
                      Show About Section
                    </Label>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="showChats"
                      checked={customization.enabledFeatures.showChats}
                      onCheckedChange={(checked) =>
                        setCustomization({
                          ...customization,
                          enabledFeatures: {
                            ...customization.enabledFeatures,
                            showChats: checked as boolean,
                          },
                        })
                      }
                    />
                    <Label htmlFor="showChats" className="cursor-pointer">
                      Show Chat Section
                    </Label>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="showReviews"
                      checked={customization.enabledFeatures.showReviews}
                      onCheckedChange={(checked) =>
                        setCustomization({
                          ...customization,
                          enabledFeatures: {
                            ...customization.enabledFeatures,
                            showReviews: checked as boolean,
                          },
                        })
                      }
                    />
                    <Label htmlFor="showReviews" className="cursor-pointer">
                      Show Reviews Section
                    </Label>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="showFeaturedProducts"
                      checked={customization.enabledFeatures.showFeaturedProducts}
                      onCheckedChange={(checked) =>
                        setCustomization({
                          ...customization,
                          enabledFeatures: {
                            ...customization.enabledFeatures,
                            showFeaturedProducts: checked as boolean,
                          },
                        })
                      }
                    />
                    <Label htmlFor="showFeaturedProducts" className="cursor-pointer">
                      Show Featured Products Section
                    </Label>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="showPrinting"
                      checked={customization.enabledFeatures.showPrinting}
                      onCheckedChange={(checked) =>
                        setCustomization({
                          ...customization,
                          enabledFeatures: {
                            ...customization.enabledFeatures,
                            showPrinting: checked as boolean,
                          },
                        })
                      }
                    />
                    <Label htmlFor="showPrinting" className="cursor-pointer font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                      Show Printing Section (Premium)
                    </Label>
                  </div>
                </div>
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>

        {/* Actions */}
        <div className="flex gap-2 mt-6 border-t pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 flex-1"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            disabled={saving}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Default
          </Button>
        </div>

        {/* Last Updated */}
        {customization.lastUpdated && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Last updated:{' '}
            {new Date(customization.lastUpdated).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
