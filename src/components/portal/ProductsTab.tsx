import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Package, Plus, Camera, Upload, Sparkles, Eraser, 
  Trash2, Edit, CheckCircle, X, Image as ImageIcon,
  ShoppingBag
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getFeaturedProductsByShopId, 
  addFeaturedProduct, 
  updateFeaturedProduct, 
  deleteFeaturedProduct 
} from '@/lib/supabase-featured-products';
import { useAIImage } from '@/hooks/useAIImage';
import type { FeaturedProduct } from '@/types';
import type { Shop } from '@/lib/shops-storage';

interface ProductsTabProps {
  selectedShop: Shop;
  currentPlan: any;
}

export const ProductsTab = ({ selectedShop, currentPlan }: ProductsTabProps) => {
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [newFeaturedProduct, setNewFeaturedProduct] = useState({ 
    title: '', price: '', originalPrice: '', discountPercentage: '', 
    category: '', imageUrl: '', inventory: '' 
  });
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const {
    isRemovingBackground,
    isGeneratingAIImage,
    aiProgress,
    processRemoveBackground,
    generateAIImage
  } = useAIImage();

  // File upload refs
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const productCameraInputRef = useRef<HTMLInputElement>(null);
  const [uploadMenu, setUploadMenu] = useState<{isOpen: boolean; type: string}>({ isOpen: false, type: 'product' });

  useEffect(() => {
    if (selectedShop?.id) {
      loadProducts();
    }
  }, [selectedShop?.id]);

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const data = await getFeaturedProductsByShopId(selectedShop.id);
      setFeaturedProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewFeaturedProduct({ ...newFeaturedProduct, imageUrl: reader.result as string });
      setUploadMenu({ ...uploadMenu, isOpen: false });
    };
    reader.readAsDataURL(file);
  };

  const handleAddFeaturedProduct = async () => {
    if (!newFeaturedProduct.title || !newFeaturedProduct.price) {
      toast.error('Please fill in required fields');
      return;
    }
    try {
      const product = await addFeaturedProduct({
        shop_id: selectedShop.id,
        ...newFeaturedProduct
      });
      if (product) {
        setFeaturedProducts([product, ...featuredProducts]);
        setNewFeaturedProduct({ title: '', price: '', originalPrice: '', discountPercentage: '', category: '', imageUrl: '', inventory: '' });
        toast.success('Product added successfully');
      }
    } catch (error) {
      toast.error('Failed to add product');
    }
  };

  const handleUpdateFeaturedProduct = async () => {
    if (!editingProduct) return;
    try {
      const updated = await updateFeaturedProduct(editingProduct, newFeaturedProduct);
      if (updated) {
        setFeaturedProducts(featuredProducts.map(p => p.id === editingProduct ? updated : p));
        setEditingProduct(null);
        setNewFeaturedProduct({ title: '', price: '', originalPrice: '', discountPercentage: '', category: '', imageUrl: '', inventory: '' });
        toast.success('Product updated');
      }
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const handleDeleteFeaturedProduct = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteFeaturedProduct(id);
      setFeaturedProducts(featuredProducts.filter(p => p.id !== id));
      toast.success('Product deleted');
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-red-500 p-2.5 rounded-2xl shadow-lg shadow-red-200">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </CardTitle>
                <CardDescription className="text-xs font-medium">Manage your shop inventory</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-tight ml-1">Product Title*</Label>
                  <Input
                    placeholder="Enter product name (e.g. Lays Magic Masala)"
                    value={newFeaturedProduct.title}
                    onChange={(e) => setNewFeaturedProduct({ ...newFeaturedProduct, title: e.target.value })}
                    className="rounded-2xl border-slate-200 focus:ring-red-500 h-12 text-sm font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-tight ml-1">Selling Price*</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={newFeaturedProduct.price}
                        onChange={(e) => setNewFeaturedProduct({ ...newFeaturedProduct, price: e.target.value })}
                        className="rounded-2xl border-slate-200 focus:ring-red-500 h-12 pl-8 text-sm font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-tight ml-1">MRP (Optional)</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={newFeaturedProduct.originalPrice}
                        onChange={(e) => setNewFeaturedProduct({ ...newFeaturedProduct, originalPrice: e.target.value })}
                        className="rounded-2xl border-slate-200 focus:ring-red-500 h-12 pl-8 text-sm font-medium text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-tight ml-1">Inventory/Stock</Label>
                  <Input
                    type="number"
                    placeholder="Quantity in stock"
                    value={newFeaturedProduct.inventory}
                    onChange={(e) => setNewFeaturedProduct({ ...newFeaturedProduct, inventory: e.target.value })}
                    className="rounded-2xl border-slate-200 h-12 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-tight ml-1">Category</Label>
                  <select
                    value={newFeaturedProduct.category}
                    onChange={(e) => setNewFeaturedProduct({ ...newFeaturedProduct, category: e.target.value })}
                    className="w-full rounded-2xl border-slate-200 h-12 text-sm font-medium px-4 focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    <option value="">Select Category</option>
                    <option value="snacks">Snacks & Munchies</option>
                    <option value="beverages">Cold Drinks & Juices</option>
                    <option value="instant">Instant Food</option>
                    <option value="grocery">Atta, Rice & Dal</option>
                    <option value="household">Cleaning & Household</option>
                    <option value="personal">Personal Care</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-tight">Product Image</Label>
                <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                  {newFeaturedProduct.imageUrl ? (
                    <div className="relative">
                      <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-red-500/20 bg-white shadow-lg group">
                        {(isRemovingBackground || isGeneratingAIImage) && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[4px] rounded-2xl z-20 overflow-hidden border border-red-100">
                            <div className="relative mb-3">
                              <svg className="w-16 h-16 transform -rotate-90">
                                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-100" />
                                <circle
                                  cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent"
                                  strokeDasharray={175.9} strokeDashoffset={175.9 - (175.9 * (isRemovingBackground ? aiProgress : 30)) / 100}
                                  strokeLinecap="round" className="text-red-500 transition-all duration-500 ease-out"
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[11px] font-black text-slate-800 tracking-tighter">
                                  {isRemovingBackground ? `${aiProgress}%` : ''}
                                  {isGeneratingAIImage && <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-center px-4 text-center">
                              <span className="text-[9px] font-black text-red-600 uppercase tracking-[0.2em] mb-1 drop-shadow-sm">
                                {isRemovingBackground ? 'Refining AI Vision' : 'Painting with AI'}
                              </span>
                            </div>
                          </div>
                        )}
                        <img
                          src={newFeaturedProduct.imageUrl}
                          alt="Product"
                          className={`h-full w-full object-contain transition-all duration-700 ${
                            (isRemovingBackground || isGeneratingAIImage) ? 'scale-90 opacity-40 blur-[2px]' : 'scale-100 opacity-100'
                          }`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setUploadMenu({ isOpen: true, type: 'product' })}
                        className="absolute -bottom-2 -right-2 bg-red-600 text-white p-2.5 rounded-full shadow-xl hover:scale-110 transition-transform active:scale-95 z-30"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setUploadMenu({ isOpen: true, type: 'product' })}
                      className="w-32 h-32 flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl hover:border-red-500 hover:bg-red-50/30 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Upload className="h-5 w-5 text-slate-400 group-hover:text-red-500" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upload Image</span>
                    </button>
                  )}

                  <div className="flex flex-col gap-2 w-full">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl h-10 border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold"
                      onClick={async () => { const g = await generateAIImage(newFeaturedProduct.title); if (g) setNewFeaturedProduct({ ...newFeaturedProduct, imageUrl: g }); }}
                      disabled={isGeneratingAIImage || !newFeaturedProduct.title}
                    >
                      <Sparkles className="h-4 w-4 mr-2" /> AI GENERATE
                    </Button>
                    {newFeaturedProduct.imageUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl h-10 border-red-200 text-red-600 hover:bg-red-50 font-bold"
                        onClick={async () => { const p = await processRemoveBackground(newFeaturedProduct.imageUrl); if (p) setNewFeaturedProduct({ ...newFeaturedProduct, imageUrl: p }); }}
                        disabled={isRemovingBackground}
                      >
                        <Eraser className="h-4 w-4 mr-2" /> CLEAN BG
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                {editingProduct ? (
                  <>
                    <Button onClick={handleUpdateFeaturedProduct} className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold shadow-xl active:scale-95 transition-transform">
                      <CheckCircle className="mr-2 h-5 w-5" /> Update Changes
                    </Button>
                    <Button variant="outline" onClick={() => { setEditingProduct(null); setNewFeaturedProduct({ title: '', price: '', originalPrice: '', discountPercentage: '', category: '', imageUrl: '', inventory: '' }); }} className="h-12 px-6 rounded-2xl font-bold">
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleAddFeaturedProduct} className="w-full h-12 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold shadow-xl active:scale-95 transition-transform">
                    <Plus className="mr-2 h-5 w-5" /> Add Product to Store
                  </Button>
                )}
              </div>
            </div>

            <div className="hidden md:block bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 border-dashed relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <Badge variant="outline" className="bg-white/80 backdrop-blur-sm border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-400">Live Preview</Badge>
              </div>
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <div className="w-48 h-48 rounded-3xl bg-white shadow-2xl flex items-center justify-center p-4 relative group">
                  {newFeaturedProduct.imageUrl ? (
                    <img src={newFeaturedProduct.imageUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-slate-200" />
                  )}
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">{newFeaturedProduct.title || 'Product Title'}</h3>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl font-black text-red-600">₹{newFeaturedProduct.price || '0.00'}</span>
                    {newFeaturedProduct.originalPrice && (
                      <span className="text-sm font-bold text-slate-400 line-through">₹{newFeaturedProduct.originalPrice}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="bg-red-500 p-1.5 rounded-lg">
              <Package className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Live Inventory ({featuredProducts.length})</h3>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {featuredProducts.map((product) => (
            <Card key={product.id} className="group overflow-hidden rounded-3xl border-none shadow-md hover:shadow-xl transition-all duration-300 bg-white dark:bg-slate-900">
              <div className="aspect-square relative overflow-hidden bg-slate-50 dark:bg-slate-800 flex items-center justify-center p-3">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.title} className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-slate-200" />
                )}
                {product.discountPercentage && (
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-lg rotate-[-5deg]">
                    {product.discountPercentage}% OFF
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                  <button
                    onClick={() => {
                      setEditingProduct(product.id!);
                      setNewFeaturedProduct({ ...product });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="p-2 bg-white text-slate-800 rounded-full hover:bg-red-500 hover:text-white transition-colors shadow-lg"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteFeaturedProduct(product.id!)}
                    className="p-2 bg-white text-red-600 rounded-full hover:bg-red-600 hover:text-white transition-colors shadow-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <CardContent className="p-3 space-y-1">
                <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase truncate tracking-tight">{product.title}</h4>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-black text-red-600">₹{product.price}</span>
                  {product.inventory && (
                    <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0 rounded-md">Qty: {product.inventory}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {uploadMenu.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUploadMenu({ ...uploadMenu, isOpen: false })} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Select Source</h3>
              <button onClick={() => setUploadMenu({ ...uploadMenu, isOpen: false })} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => productCameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-6 rounded-3xl bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 group transition-all"
              >
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-700 shadow-md flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Camera className="h-7 w-7 text-red-600" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">Camera</span>
              </button>
              <button
                onClick={() => productImageInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-6 rounded-3xl bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 group transition-all"
              >
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-700 shadow-md flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="h-7 w-7 text-indigo-600" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">Gallery</span>
              </button>
            </div>
            <input ref={productImageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <input ref={productCameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
          </div>
        </div>
      )}
    </div>
  );
};
