import { useNavigate } from 'react-router-dom';
import { OffersTab } from '@/components/OffersTab';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const OffersListPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col relative overflow-hidden">
      {/* Luxury Header Banner */}
      <div className="relative h-[180px] sm:h-[220px] w-full overflow-hidden shadow-lg rounded-b-[40px]">
        <img 
          src="/offers-banner.png" 
          className="absolute inset-0 w-full h-full object-cover"
          alt="Offers Banner"
        />
        
        {/* Header Overlay Content */}
        <div className="relative h-full p-6 sm:p-8 flex items-center z-10">
          <div className="flex items-center gap-4 w-full">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/')}
              className="bg-white/80 backdrop-blur-md hover:bg-white rounded-xl h-10 w-10 flex-shrink-0 shadow-sm text-slate-900"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 truncate leading-tight tracking-tight uppercase">
                Exclusive Offers
              </h1>
              <p className="text-xs sm:text-sm text-red-500 font-bold tracking-widest uppercase opacity-80 mt-1">
                Best deals from local shops
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 overflow-hidden z-10">
        <div className="h-full overflow-y-auto no-scrollbar">
          <OffersTab onShopClick={(shopId) => navigate(`/shop/${shopId}`)} />
        </div>
      </div>
    </div>
  );
};
