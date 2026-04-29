# Video Playback Troubleshooting Guide

## Problem: Black Screen When Playing Videos

The video player shows a black screen instead of playing the uploaded video. This can have several causes.

## Diagnosis Steps

### 1. Check Browser Console for Errors
1. Press `F12` to open Developer Tools
2. Go to the **Console** tab
3. Look for any error messages starting with `❌ Video playback error:`
4. Note the error code and message

### 2. Verify Video URLs
1. Open the video tab in the app
2. Right-click → "Inspect" on the video element
3. Check the `src` attribute - it should look like:
   ```
   https://omkrfehuvftntuqjmxqq.supabase.co/storage/v1/object/public/videos/videos/1234567890-filename.mp4
   ```
4. Try opening this URL directly in a new browser tab
   - If it downloads or shows a video player → URL is correct
   - If it shows 404 or error → Video file wasn't uploaded properly

### 3. Check Supabase Storage Configuration

Go to your Supabase dashboard:

1. **Navigate to Storage → Buckets**
2. Click on the **videos** bucket
3. Check these settings:
   - **Public/Private**: Should be **Public** to allow direct URL access
   - **CORS Settings**: Should allow requests from your domain

4. **Check CORS Configuration**:
   - Go to **Storage → Configuration → CORS Allowlist**
   - Make sure your domain is in the allowed list
   - Or add `*` to allow all origins (less secure but simpler for testing)

### 4. Check Video Upload Status

1. Go to Supabase Dashboard → **Storage → videos bucket**
2. Look for your video files in the `videos/` folder
3. Verify file size is reasonable (not 0 bytes)
4. Check if files are being uploaded correctly

## Common Video Errors and Solutions

| Error Code | Meaning | Solution |
|-----------|---------|----------|
| 4 | Video Not Found | Video URL is incorrect or file doesn't exist in storage |
| 3 | Aborted | User stopped loading, network issue, or CORS blocked |
| 2 | Network Error | Can't reach the video server - check URL and storage bucket |
| 1 | Aborted | Browser cancelled the load |
| 0 | No Error | Generic error occurred |

## Solutions to Try

### Solution 1: Enable Public Access to Videos Bucket

In Supabase Dashboard:

1. Go to **Storage → Buckets**
2. Click on **videos** bucket
3. Click the settings icon (⚙️)
4. Make sure **Public** is enabled

### Solution 2: Add CORS Configuration

In Supabase Dashboard:

1. Go to **Storage → Configuration**
2. Under **CORS Allowlist**, add:
   ```
   http://localhost:5173
   http://localhost:3000
   https://yourdomain.com
   ```

Or for development/testing, temporarily add:
```
*
```

### Solution 3: Verify Video Upload Process

Check if videos are being uploaded correctly:

1. Go to Video Upload Modal
2. Select a video file
3. Check the browser console while uploading for any errors
4. Watch for these success messages:
   - `✅ Migrated shops with categories...`
   - Upload confirmation from Supabase

### Solution 4: Re-upload Video with Correct Settings

1. Try uploading a new video
2. In the browser console, watch for:
   ```
   ✅ Video can play
   📹 Video loading started: https://...
   ```

### Solution 5: Try Different Video Formats

Test with different video formats to ensure compatibility:
- MP4 (H.264 codec) - Most compatible
- WebM - Open standard
- OGG - Alternative

## Technical Details for Developers

### Video Element Configuration

The video element now includes:
- `crossOrigin="anonymous"` - Allows CORS requests
- `preload="auto"` - Loads video metadata immediately
- Error handlers that log detailed error information
- Load event handlers for debugging

### Debug Logging

When video issues occur, check the console for:

**Video Loading Started:**
```
📹 Video loading started: https://...
```

**Video Can Play:**
```
✅ Video can play
```

**Video Error:**
```
❌ Video playback error: {
  src: "https://...",
  error: "Error message",
  code: 4  // Error code (see table above)
}
```

## Advanced Troubleshooting

### Check Storage Bucket RLS Policies

If videos aren't accessible:

1. Go to Supabase Dashboard
2. **Storage → Buckets → videos → Policies**
3. Verify there's a policy allowing public read access:
   ```sql
   -- Allow public read access to videos
   CREATE POLICY "Allow public read access"
   ON storage.objects
   FOR SELECT
   TO public
   USING (bucket_id = 'videos');
   ```

### Test Video URL Directly

In browser console, run:
```javascript
fetch('https://omkrfehuvftntuqjmxqq.supabase.co/storage/v1/object/public/videos/videos/YOUR_VIDEO_FILE')
  .then(r => r.blob())
  .then(blob => console.log('✅ Video accessible:', blob.size + ' bytes'))
  .catch(e => console.error('❌ Video not accessible:', e))
```

### Check Video File Integrity

Verify the uploaded video file:
```javascript
// In browser console
const videoElement = document.querySelector('video');
if (videoElement) {
  console.log('Video src:', videoElement.src);
  console.log('Can play type:', videoElement.canPlayType('video/mp4'));
}
```

## Alternative Approaches

If CORS and storage issues persist, consider:

### Approach 1: Use Signed URLs
- Generate time-limited signed URLs instead of public URLs
- More secure, but requires backend configuration

### Approach 2: Use CDN
- Configure a CDN like Cloudflare in front of Supabase Storage
- Can help with CORS and performance

### Approach 3: Stream from Different Service
- Use alternative storage like AWS S3, Google Cloud Storage, or Firebase Storage
- May require minimal code changes

### Approach 4: Proxy Through Backend
- Create a backend endpoint that streams videos
- More server load but easier CORS configuration

## Summary of Fixes Made

1. **Added error handling** to video element with detailed logging
2. **Enhanced video element attributes**:
   - `crossOrigin="anonymous"` for CORS support
   - `preload="auto"` for faster loading
3. **Added event handlers**:
   - `onError` - logs playback errors
   - `onLoadStart` - logs when loading begins
   - `onCanPlay` - confirms video is ready
4. **Created SQL migrations** for database schema fixes

## Next Steps

1. **Immediate Action**: Check browser console (F12) when video doesn't play
2. **Verify Storage**: Confirm videos bucket is public and has proper CORS settings
3. **Test URL**: Try opening the video URL directly in a new tab
4. **Re-upload**: If needed, delete the video and upload a fresh copy
5. **Check Database**: Ensure video records exist in the database

If issues persist after these steps, please check the browser console logs and the Supabase Storage configuration.
