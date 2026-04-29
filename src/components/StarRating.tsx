import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  reviewCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const sizeMap = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  reviewCount = 0,
  size = 'md',
  showText = true,
}) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;
  const emptyStars = 5 - Math.ceil(rating);

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <div className="flex gap-0.5">
        {/* Full stars */}
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star
            key={`full-${i}`}
            className={`${sizeMap[size]} fill-yellow-400 text-yellow-400`}
          />
        ))}

        {/* Half star */}
        {hasHalfStar && (
          <div className="relative">
            <Star className={`${sizeMap[size]} text-gray-300`} />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <Star className={`${sizeMap[size]} fill-yellow-400 text-yellow-400`} />
            </div>
          </div>
        )}

        {/* Empty stars */}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star
            key={`empty-${i}`}
            className={`${sizeMap[size]} text-gray-300`}
          />
        ))}
      </div>

      {showText && (
        <span className="text-xs sm:text-sm font-medium text-muted-foreground">
          {rating > 0 ? `${rating.toFixed(1)}` : 'No'} {reviewCount > 0 && `(${reviewCount})`}
        </span>
      )}
    </div>
  );
};
