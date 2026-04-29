// Camera capture using browser Web APIs
// Works on web browsers and mobile browsers (Chrome, Safari, Firefox, Edge)
// For native apps with Capacitor, install @capacitor/camera separately

export const useCameraCapture = () => {
  const capturePhoto = async (): Promise<{ webPath: string; path: string; format: string }> => {
    return await captureWebCamera();
  };

  const captureWebCamera = async (): Promise<{ webPath: string; path: string; format: string }> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const video = document.createElement('video');

      // Request camera access with audio disabled for better performance
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true'); // iOS Safari requirement

          video.onloadedmetadata = () => {
            video.play();

            // Wait for video to start playing before capture
            setTimeout(() => {
              const context = canvas.getContext('2d');
              if (!context) {
                stream.getTracks().forEach((track) => track.stop());
                reject(new Error('Failed to get canvas context'));
                return;
              }

              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              context.drawImage(video, 0, 0);

              // Stop the camera stream immediately after capture
              stream.getTracks().forEach((track) => track.stop());

              // Convert canvas to JPEG blob
              canvas.toBlob(
                (blob) => {
                  if (blob) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      resolve({
                        webPath: reader.result as string,
                        path: '',
                        format: 'jpeg',
                      });
                    };
                    reader.onerror = () => {
                      reject(new Error('Failed to read image data'));
                    };
                    reader.readAsDataURL(blob);
                  } else {
                    reject(new Error('Failed to capture image'));
                  }
                },
                'image/jpeg',
                0.9 // 90% quality
              );
            }, 500);
          };

          video.onerror = () => {
            stream.getTracks().forEach((track) => track.stop());
            reject(new Error('Video element error'));
          };
        })
        .catch((error) => {
          let userMessage = 'Failed to access camera';

          if (error.name === 'NotAllowedError') {
            userMessage = 'Camera permission denied. Please enable camera access in your browser settings.';
          } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            userMessage = 'No camera device found on this device.';
          } else if (error.name === 'NotReadableError') {
            userMessage = 'Camera is being used by another application. Please close it and try again.';
          } else if (error.name === 'SecurityError') {
            userMessage = 'Camera access is not allowed in this context (HTTPS required).';
          }

          reject(new Error(userMessage));
        });
    });
  };

  return { capturePhoto };
};
