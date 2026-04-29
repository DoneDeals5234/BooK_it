export interface ShareVideoOptions {
  videoUrl: string;
  title: string;
  text: string;
}

/**
 * Open deep link for Instagram
 * This opens Instagram app or Play Store if not installed
 */
const openInstagramDeepLink = (): void => {
  // Try opening Instagram via deep link
  const instagramUrl = 'instagram://';
  const playStoreUrl =
    'https://play.google.com/store/apps/details?id=com.instagram.android';

  // Create invisible iframe to try opening Instagram
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = instagramUrl;

  document.body.appendChild(iframe);

  // If Instagram doesn't open in 2 seconds, redirect to Play Store
  setTimeout(() => {
    document.body.removeChild(iframe);
    window.location.href = playStoreUrl;
  }, 2000);
};

/**
 * Share video to Instagram using Web Share API or fallback
 * For native app (Capacitor), this will attempt to open Instagram
 * Users can then paste the video link
 */
export const shareToInstagram = async (options: ShareVideoOptions): Promise<void> => {
  try {
    const shareData = {
      title: options.title,
      text: options.text,
    };

    // Check if running in Capacitor
    const isCapacitor = (window as any).Capacitor?.isNativePlatform?.() === true;

    if (isCapacitor) {
      // On native (Android/iOS), try Web Share API first
      if (navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.warn('Web Share API failed:', error);
          }
        }
      }

      // Fallback: Copy link and open Instagram
      try {
        await navigator.clipboard.writeText(options.videoUrl);
        openInstagramDeepLink();
        alert(
          '✓ Video link copied!\n\nInstagram is opening...\n\nYou can now paste and share the video to Story, Feed, or DM.'
        );
      } catch (err) {
        alert(
          `Open Instagram and share this:\n\n${shareData.title}\n${shareData.text}`
        );
      }
    } else {
      // On web, use Web Share API or clipboard
      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.error('Error sharing:', error);
          }
        }
      } else {
        // Copy to clipboard fallback
        try {
          await navigator.clipboard.writeText(
            `${shareData.title}\n${shareData.text}\n${options.videoUrl}`
          );
          alert(
            '✓ Video details copied to clipboard!\n\nOpen Instagram and paste to share.'
          );
        } catch (err) {
          alert(`Share this on Instagram:\n\n${shareData.title}\n${shareData.text}`);
        }
      }
    }
  } catch (error) {
    console.error('Error in shareToInstagram:', error);
    alert('Error sharing to Instagram. Please try again.');
  }
};

/**
 * Share video to WhatsApp
 * Opens WhatsApp with pre-filled message
 */
export const shareToWhatsApp = async (options: ShareVideoOptions): Promise<void> => {
  try {
    const text = `${options.title}\n${options.text}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  } catch (error) {
    console.error('Error sharing to WhatsApp:', error);
    alert('Error sharing to WhatsApp. Please try again.');
  }
};
