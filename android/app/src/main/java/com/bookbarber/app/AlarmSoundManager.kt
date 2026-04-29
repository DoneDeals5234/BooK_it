package com.bookbarber.app

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log

class AlarmSoundManager private constructor(context: Context) {
    private val context: Context = context.applicationContext
    private var mediaPlayer: MediaPlayer? = null
    private val audioManager: AudioManager? = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    private val vibrator: Vibrator? = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    var isPlaying: Boolean = false
        private set

    private var audioFocusRequest: AudioFocusRequest? = null
    private val afChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        Log.d(TAG, "Audio focus changed: $focusChange")
    }

    companion object {
        private const val TAG = "AlarmSoundManager"
        @Volatile
        private var instance: AlarmSoundManager? = null
        private val VIBRATION_PATTERN = longArrayOf(0, 500, 200, 500)

        @JvmStatic
        fun getInstance(context: Context): AlarmSoundManager {
            return instance ?: synchronized(this) {
                instance ?: AlarmSoundManager(context).also { instance = it }
            }
        }
    }

    fun startAlarmSound() {
        try {
            if (isPlaying) return

            requestAudioFocus()
            audioManager?.let {
                val max = it.getStreamMaxVolume(AudioManager.STREAM_ALARM)
                it.setStreamVolume(AudioManager.STREAM_ALARM, max, 0)
            }

            val alarmUri = getAlarmSoundUri()
            if (alarmUri == null) {
                startVibration()
                isPlaying = true
                return
            }

            mediaPlayer = MediaPlayer().apply {
                setOnErrorListener { _, _, _ -> true }
                setDataSource(context, alarmUri)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    setAudioAttributes(AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build())
                } else {
                    @Suppress("DEPRECATION")
                    setAudioStreamType(AudioManager.STREAM_ALARM)
                }
                isLooping = true
                prepare()
                start()
            }

            isPlaying = true
            startVibration()
        } catch (e: Exception) {
            Log.e(TAG, "Error starting alarm sound", e)
            startVibration()
            isPlaying = true
        }
    }

    private fun getAlarmSoundUri(): Uri? {
        return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
    }

    private fun startVibration() {
        try {
            vibrator?.takeIf { it.hasVibrator() }?.let {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    it.vibrate(VibrationEffect.createWaveform(VIBRATION_PATTERN, 0))
                } else {
                    @Suppress("DEPRECATION")
                    it.vibrate(VIBRATION_PATTERN, 0)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting vibration", e)
        }
    }

    fun stopAlarmSound() {
        try {
            mediaPlayer?.run {
                if (isPlaying) stop()
                release()
            }
            mediaPlayer = null
            vibrator?.cancel()
            isPlaying = false
            releaseAudioFocus()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping sound", e)
        }
    }

    private fun requestAudioFocus() {
        try {
            audioManager?.let {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val attributes = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                    audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                        .setAudioAttributes(attributes)
                        .setAcceptsDelayedFocusGain(false)
                        .setOnAudioFocusChangeListener(afChangeListener)
                        .build()
                    it.requestAudioFocus(audioFocusRequest!!)
                } else {
                    @Suppress("DEPRECATION")
                    it.requestAudioFocus(afChangeListener, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error requesting focus", e)
        }
    }

    private fun releaseAudioFocus() {
        try {
            audioManager?.let {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    audioFocusRequest?.let { req -> it.abandonAudioFocusRequest(req) }
                    audioFocusRequest = null
                } else {
                    @Suppress("DEPRECATION")
                    it.abandonAudioFocus(afChangeListener)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing focus", e)
        }
    }
}
