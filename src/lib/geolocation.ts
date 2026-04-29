import { isCapacitor } from './capacitor-notifications';

export interface UserLocation {
  latitude: number;
  longitude: number;
  address: string;
  village?: string;
  district?: string;
  state?: string;
  country?: string;
  formattedAddress: string;
}

interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
}

declare global {
  interface Window {
    navigator: Navigator & {
      geolocation: any;
    };
  }
}

export const getCurrentLocation = async (): Promise<GeolocationCoordinates> => {
  // Use Cordova Geolocation API for native apps
  if (isCapacitor()) {
    return new Promise((resolve, reject) => {
      try {
        // Access Cordova's geolocation through navigator
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not available on this device'));
          return;
        }

        console.log('📍 Using Cordova Geolocation API for native app');

        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('✅ Location obtained via Cordova:', position.coords);
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude || undefined,
              altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
              heading: position.coords.heading || undefined,
              speed: position.coords.speed || undefined
            });
          },
          (error: any) => {
            console.error('❌ Cordova Geolocation error:', error);

            // Parse Cordova error
            if (error.code === 1 || error.message?.includes('denied') || error.message?.includes('Permission')) {
              reject(new Error('Location permission denied. Please enable location access in your app settings.'));
            } else if (error.code === 2 || error.message?.includes('unavailable')) {
              reject(new Error('Location information is unavailable. Please try again.'));
            } else if (error.code === 3 || error.message?.includes('timeout')) {
              reject(new Error('Location request timed out. Please try again.'));
            } else {
              reject(new Error(error.message || 'Failed to get location'));
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      } catch (error: any) {
        console.error('❌ Error accessing Cordova Geolocation:', error);
        reject(new Error(error.message || 'Failed to initialize geolocation'));
      }
    });
  }

  // Use browser Geolocation API for web
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    console.log('🌐 Using browser Geolocation API for web');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('✅ Location obtained via browser:', position.coords);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || undefined,
          altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Permission denied. Please enable location access in your browser settings.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location information is unavailable.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Location request timed out. Please try again.'));
            break;
          default:
            reject(new Error('An unknown error occurred while fetching your location.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
};

export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<UserLocation> => {
  try {
    // Using OpenStreetMap Nominatim API for reverse geocoding (free, no key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BookBarber-App'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch address information');
    }

    const data = await response.json();

    // Parse the address components from OpenStreetMap Nominatim API
    const address = data.address || {};
    const formattedAddress = data.display_name || '';

    // Properly map address hierarchy:
    // village < town < city < county/district < state < country
    const village = address.village || address.hamlet || '';
    const district = address.county || address.district || address.city || address.town || '';
    const state = address.state || address.province || '';
    const country = address.country || '';

    return {
      latitude,
      longitude,
      address: formattedAddress,
      village,
      district,
      state,
      country,
      formattedAddress
    };
  } catch (error) {
    throw new Error(`Failed to get address: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const getFullAddress = async (location: UserLocation): Promise<string> => {
  const parts: string[] = [];

  if (location.village) parts.push(location.village);
  if (location.district) parts.push(location.district);
  if (location.state) parts.push(location.state);
  if (location.country) parts.push(location.country);

  return parts.length > 0 ? parts.join(', ') : location.formattedAddress;
};

export const fetchUserLocation = async (): Promise<UserLocation> => {
  try {
    const coordinates = await getCurrentLocation();
    const location = await reverseGeocode(coordinates.latitude, coordinates.longitude);
    return location;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch location');
  }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
