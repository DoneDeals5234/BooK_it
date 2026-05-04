import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeSupabaseUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  // Custom domain to use
  const customDomain = 'database.donedeals.shop';
  const oldDomainSuffix = 'supabase.co';
  
  // Replace old supabase.co URLs with the custom domain
  if (url.includes(oldDomainSuffix)) {
    try {
      // Use URL constructor for robust parsing if it's a full URL
      if (url.startsWith('http')) {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname.endsWith(oldDomainSuffix)) {
          parsedUrl.hostname = customDomain;
          return parsedUrl.toString();
        }
      }
      // Regex fallback for non-standard or partial URLs
      return url.replace(/[a-z0-9]+\.supabase\.co/gi, customDomain);
    } catch (e) {
      // Fallback if URL parsing fails
      return url.replace(/[a-z0-9]+\.supabase\.co/gi, customDomain);
    }
  }
  return url;
}
export function formatIST(dateInput: string | Date | number, includeTime: boolean = true): string {
  if (!dateInput) return '';
  
  let date: Date;
  if (typeof dateInput === 'string') {
    // Ensure string is treated as UTC if it doesn't have a timezone
    const safeStr = dateInput.endsWith('Z') || dateInput.includes('+') 
      ? dateInput 
      : `${dateInput}Z`;
    date = new Date(safeStr);
  } else {
    date = new Date(dateInput);
  }
  
  // Add 5:30 hours (330 minutes)
  date.setMinutes(date.getMinutes() + 330);
  
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = true;
  }
  
  return date.toLocaleString('en-IN', options);
}
