import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Printer, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Navigation, ShoppingBag, MapPin, CheckCircle, XCircle, User } from 'lucide-react';
import { getPrintingSettings, createPrintingOrder, type PrintingSettings } from '@/lib/supabase-printing';
import { fetchUserLocation } from '@/lib/geolocation';
import { uploadFile } from '@/lib/supabase-storage';
import { createOrder } from '@/lib/supabase-orders';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface DocumentPrintingSectionProps {
  shopId: string;
  shopName: string;
  shopLat?: number;
  shopLng?: number;
  shopMapLink?: string;
}

export const DocumentPrintingSection = ({ shopId, shopName, shopLat, shopLng, shopMapLink }: DocumentPrintingSectionProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<PrintingSettings | null>(null);
  
  // Selection state
  const [files, setFiles] = useState<File[]>([]);
  const [printType, setPrintType] = useState<'bw' | 'color'>('bw');
  const [sideType, setSideType] = useState<'single' | 'double'>('single');
  const [paperType, setPaperType] = useState<string>('');
  const [note, setNote] = useState('');
  const [totalPrice, setTotalPrice] = useState(0);

  // Delivery state
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [address, setAddress] = useState('');
  const [locationLink, setLocationLink] = useState<string | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [customerCoords, setCustomerCoords] = useState<{lat: number, lng: number} | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Fetch user profile on mount
  useEffect(() => {
    if (user) {
      import('@/lib/supabase-user-profiles').then(({ getUserProfile }) => {
        getUserProfile(user.uid).then(profile => {
          if (profile) setUserProfile(profile);
        }).catch(err => console.error('Error fetching user profile for order:', err));
      });
    }
  }, [user]);

  const extractCoordsFromMapLink = (link: string): { lat: number; lng: number } | null => {
    if (!link) return null;
    try {
      const qMatch = link.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
      const atMatch = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
      return null;
    } catch {
      return null;
    }
  };

  const handleUseProfileLocation = async () => {
    if (!user) {
      toast.error('You must be logged in to use profile location');
      return;
    }

    try {
      toast.loading('Fetching profile location...', { id: 'fetch-profile' });
      // Fetch directly from database since it's not in AuthContext
      const { getUserProfile } = await import('@/lib/supabase-user-profiles');
      const profileData = await getUserProfile(user.uid);
      
      if (profileData && (profileData.address || profileData.google_map_link || (profileData.latitude && profileData.longitude))) {
        if (profileData.address) setAddress(profileData.address);
        if (profileData.google_map_link) setLocationLink(profileData.google_map_link);
        if (profileData.latitude && profileData.longitude) {
          setCustomerCoords({ lat: profileData.latitude, lng: profileData.longitude });
        } else if (profileData.google_map_link) {
          const parsed = extractCoordsFromMapLink(profileData.google_map_link);
          if (parsed) setCustomerCoords(parsed);
        }
        toast.success('Profile location applied', { id: 'fetch-profile' });
      } else {
        toast.error('No location found in your profile', { id: 'fetch-profile' });
      }
    } catch (error) {
      console.error('Error fetching profile location:', error);
      toast.error('Failed to fetch profile location', { id: 'fetch-profile' });
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    const effectiveShopLat = shopLat || (shopMapLink ? extractCoordsFromMapLink(shopMapLink)?.lat : undefined);
    const effectiveShopLng = shopLng || (shopMapLink ? extractCoordsFromMapLink(shopMapLink)?.lng : undefined);

    if (deliveryType === 'delivery' && customerCoords && effectiveShopLat && effectiveShopLng) {
      const dist = calculateDistance(effectiveShopLat, effectiveShopLng, customerCoords.lat, customerCoords.lng);
      setDistance(dist);
      let cost = 30;
      if (dist > 2) cost += Math.ceil((dist - 2) / 2) * 20;
      setDeliveryCost(cost);
    } else {
      setDistance(null);
      setDeliveryCost(0);
    }
  }, [deliveryType, customerCoords, shopLat, shopLng, shopMapLink]);

  // Fetch profile on initial mount if delivery is selected
  useEffect(() => {
    if (deliveryType === 'delivery' && !address && !locationLink && !customerCoords) {
      handleUseProfileLocation();
    }
  }, [deliveryType]);

  const fetchLocation = useCallback(async () => {
    setIsFetchingLocation(true);
    try {
      const location = await fetchUserLocation();
      setAddress(location.formattedAddress);
      const link = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
      setLocationLink(link);
      setCustomerCoords({ lat: location.latitude, lng: location.longitude });
      toast.success('Location detected successfully! 📍');
    } catch (error) {
      console.error('Error getting location:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get your location');
    } finally {
      setIsFetchingLocation(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [shopId]);

  useEffect(() => {
    if (settings) {
      calculatePrice();
    }
  }, [settings, printType, sideType]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getPrintingSettings(shopId);
      if (data && data.isEnabled) {
        setSettings(data);
        if (data.paperTypes.length > 0) {
          setPaperType(data.paperTypes[0]);
        }
      }
    } catch (error) {
      console.error('Error loading printing settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = () => {
    if (!settings) return;
    let price = 0;
    if (printType === 'bw') {
      price = sideType === 'single' ? settings.priceBwSingle : settings.priceBwDouble;
    } else {
      price = sideType === 'single' ? settings.priceColorSingle : settings.priceColorDouble;
    }
    setTotalPrice(price);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const validFiles = selectedFiles.filter(f => {
        if (f.size > 10 * 1024 * 1024) {
          toast.error(`${f.name} is too large (max 10MB)`);
          return false;
        }
        return true;
      });
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (deliveryType === 'delivery') {
      fetchLocation();
    }
  }, [deliveryType, fetchLocation]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please login to place an order');
      return;
    }
    if (files.length === 0) {
      toast.error('Please upload at least one document');
      return;
    }
    if (!paperType) {
      toast.error('Please select a paper type');
      return;
    }
    if (totalPrice <= 0) {
      toast.error('Invalid price calculation. Please try again.');
      return;
    }

    if (deliveryType === 'delivery' && (!address || address.length < 5)) {
      toast.error('Please enter a valid delivery address');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Convert all files to Base64
      const base64Files = await Promise.all(files.map(f => fileToBase64(f)));

      // 2. Create main order
      const description = `Printing Order: ${files.length} document(s) (${printType === 'bw' ? 'B&W' : 'Color'}, ${sideType === 'single' ? 'Single' : 'Double'} Sided, ${paperType})${note ? '\nNote: ' + note : ''}`;
      
      const finalAmount = totalPrice + (deliveryType === 'delivery' ? deliveryCost : 0);
      const customerName = userProfile?.name || user.displayName || user.email?.split('@')[0] || 'Customer';
      const customerPhone = userProfile?.phone || user.email || 'unknown';

      console.log('🚀 Submitting printing order with deliveryType:', deliveryType);

      const mainOrder = await createOrder(
        shopId,
        user.uid,
        customerName,
        customerPhone,
        totalPrice, // amount
        description,
        1, // quantity
        deliveryType === 'delivery' ? address : 'PICKUP FROM SHOP', // address
        locationLink || undefined, // locationLink
        'Document Printing', // productName
        undefined, // productImage
        totalPrice, // unitPrice
        deliveryType,
        deliveryCost,
        finalAmount, // totalAmount
        distance || 0,
        customerCoords?.lat,
        customerCoords?.lng,
        shopLat,
        shopLng
      );
      if (!mainOrder) throw new Error('Order creation failed');

      // 3. Create printing extension record (Storing Base64 directly in documentUrl)
      const printingOrder = {
        orderId: mainOrder.id,
        documentUrls: base64Files,
        paperType,
        isDoubleSided: sideType === 'double',
        isColor: printType === 'color',
        customerNote: note,
      };

      const success = await createPrintingOrder(printingOrder);
      if (success) {
        toast.success('Printing order placed successfully!');
        setFiles([]);
        setNote('');
      } else {
        toast.error('Order placed but document details failed to save. Please contact the shop.');
      }
    } catch (error) {
      console.error('Error submitting printing order:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (!settings || !settings.isEnabled) return null;

  return (
    <Card className="border-2 border-red-100 shadow-xl overflow-hidden mb-8">
      <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
        <Printer className="h-6 w-6 text-white" />
        <h2 className="text-xl font-bold text-white uppercase tracking-tight">Quick Print Service</h2>
      </div>
      <CardContent className="p-6 space-y-8">
        {/* Step 1: Upload */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center border-red-200 text-red-600 font-bold">1</Badge>
            <h3 className="font-bold text-slate-800 uppercase tracking-wide">Upload Document</h3>
          </div>
          
          <label className={`flex flex-col items-center justify-center w-full min-h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all bg-slate-50 border-slate-200 hover:border-red-400 hover:bg-red-50/30`}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
              <Upload className="h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-600">Click or Drag to Upload Documents</p>
              <p className="text-[10px] text-slate-400 mt-1">PDF, DOCX, Images (Max 10MB each)</p>
            </div>
            <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" multiple />
          </label>

          {/* File List */}
          {files.length > 0 && (
            <div className="grid grid-cols-1 gap-2 mt-4">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-xl">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-sm font-bold text-green-700 truncate">{f.name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeFile(i)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0">
                    <XCircle className="h-5 w-5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center border-red-200 text-red-600 font-bold">2</Badge>
                <h3 className="font-bold text-slate-800 uppercase tracking-wide">Print Options</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400">Color Mode</Label>
                  <RadioGroup value={printType} onValueChange={(v: any) => setPrintType(v)} className="flex gap-4">
                    <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg border shadow-sm flex-1">
                      <RadioGroupItem value="bw" id="bw" />
                      <Label htmlFor="bw" className="font-bold">B&W</Label>
                    </div>
                    {settings.isColorAvailable && (
                      <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg border shadow-sm flex-1 border-red-100">
                        <RadioGroupItem value="color" id="color" />
                        <Label htmlFor="color" className="font-bold text-red-600">Color</Label>
                      </div>
                    )}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400">Side Mode</Label>
                  <RadioGroup value={sideType} onValueChange={(v: any) => setSideType(v)} className="flex gap-4">
                    <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg border shadow-sm flex-1">
                      <RadioGroupItem value="single" id="single" />
                      <Label htmlFor="single" className="font-bold">Single</Label>
                    </div>
                    <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg border shadow-sm flex-1">
                      <RadioGroupItem value="double" id="double" />
                      <Label htmlFor="double" className="font-bold">Double</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400">Paper Type</Label>
                  <Select value={paperType} onValueChange={setPaperType}>
                    <SelectTrigger className="w-full h-11 font-bold">
                      <SelectValue placeholder="Select paper" />
                    </SelectTrigger>
                    <SelectContent>
                      {settings.paperTypes.map(t => (
                        <SelectItem key={t} value={t} className="font-medium">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Summary */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center border-red-200 text-red-600 font-bold">3</Badge>
              <h3 className="font-bold text-slate-800 uppercase tracking-wide">Pricing Summary</h3>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 space-y-4 shadow-inner">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">B&W Single Sided</span>
                <span className="font-bold">₹{settings.priceBwSingle}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">B&W Double Sided</span>
                <span className="font-bold">₹{settings.priceBwDouble}</span>
              </div>
              {settings.isColorAvailable && (
                <>
                  <div className="flex justify-between items-center text-sm text-red-600">
                    <span className="font-medium">Color Single Sided</span>
                    <span className="font-bold">₹{settings.priceColorSingle}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-red-600">
                    <span className="font-medium">Color Double Sided</span>
                    <span className="font-bold">₹{settings.priceColorDouble}</span>
                  </div>
                </>
              )}
              
              {deliveryType === 'delivery' && (
                <div className="flex justify-between items-center text-sm text-blue-600">
                  <span className="font-medium">Delivery Fee ({distance?.toFixed(1) || 0} km)</span>
                  <span className="font-bold">₹{deliveryCost}</span>
                </div>
              )}
              
              <div className="pt-4 border-t border-slate-200 mt-4 flex justify-between items-center">
                <span className="font-black text-slate-900 uppercase">Estimated Total</span>
                <span className="text-2xl font-black text-red-600">₹{totalPrice + (deliveryType === 'delivery' ? deliveryCost : 0)}</span>
              </div>
              <p className="text-[10px] text-slate-400 italic text-center">*Final price may vary based on page count</p>
            </div>
          </div>
        </div>

        {/* Step 3: Delivery Options */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center border-red-200 text-red-600 font-bold">4</Badge>
            <h3 className="font-bold text-slate-800 uppercase tracking-wide">Delivery Options</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setDeliveryType('pickup')}
              className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl transition-all duration-300 ${
                deliveryType === 'pickup' 
                  ? 'bg-white dark:bg-slate-800 shadow-sm shadow-slate-200 dark:shadow-black/40 scale-100 border border-slate-200 dark:border-slate-700' 
                  : 'bg-transparent text-slate-500 opacity-60 hover:opacity-100'
              }`}
            >
              <div className={`p-2 rounded-lg ${deliveryType === 'pickup' ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-400'}`}>
                <ShoppingBag className="h-5 w-5" />
              </div>
              <span className={`text-xs font-black uppercase tracking-tight ${deliveryType === 'pickup' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>Pick from Shop</span>
            </button>

            <button
              type="button"
              onClick={() => setDeliveryType('delivery')}
              className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl transition-all duration-300 ${
                deliveryType === 'delivery' 
                  ? 'bg-white dark:bg-slate-800 shadow-sm shadow-slate-200 dark:shadow-black/40 scale-100 border border-slate-200 dark:border-slate-700' 
                  : 'bg-transparent text-slate-500 opacity-60 hover:opacity-100'
              }`}
            >
              <div className={`p-2 rounded-lg ${deliveryType === 'delivery' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                <Navigation className="h-5 w-5" />
              </div>
              <span className={`text-xs font-black uppercase tracking-tight ${deliveryType === 'delivery' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>Home Delivery</span>
            </button>
          </div>

          {deliveryType === 'delivery' && (
            <div className="space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <Label htmlFor="address" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Delivery Address</Label>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-slate-600 bg-slate-100 hover:bg-slate-200 h-8 px-2 text-[10px] font-bold rounded-lg"
                    onClick={handleUseProfileLocation}
                  >
                    <User className="h-3 w-3 mr-1" />
                    PROFILE LOCATION
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-blue-600 bg-blue-50 hover:bg-blue-100 h-8 px-2 text-[10px] font-bold rounded-lg"
                    onClick={fetchLocation}
                    disabled={isFetchingLocation || !!locationLink}
                  >
                    {isFetchingLocation ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : locationLink ? (
                      <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                    ) : (
                      <MapPin className="h-3 w-3 mr-1" />
                    )}
                    {isFetchingLocation ? 'FETCHING...' : locationLink ? 'GPS ATTACHED' : 'CURRENT GPS'}
                  </Button>
                </div>
              </div>
              <Textarea
                id="address"
                placeholder="Enter your full home address for delivery..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="min-h-[80px] rounded-xl border-blue-200 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-black uppercase text-slate-400">Additional Instructions</Label>
          <Input 
            placeholder="e.g. 5 copies, specific pages only..." 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-11"
          />
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={submitting || files.length === 0}
          className="w-full h-14 text-xl font-black shadow-2xl shadow-red-500/30 transition-transform active:scale-95 bg-red-600 hover:bg-red-700"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-3 h-6 w-6 animate-spin" />
              PLACING ORDER...
            </>
          ) : (
            <>
              PROCEED ORDER <FileText className="ml-3 h-6 w-6" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
