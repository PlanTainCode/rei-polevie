package ru.polevie.mobile.util

import android.media.MediaRecorder
import android.os.Build
import java.io.File

class AudioRecorderUtil {

    private var mediaRecorder: MediaRecorder? = null

    fun start(outputFile: File): Boolean = try {
        mediaRecorder?.release()
        mediaRecorder = MediaRecorder().apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                setOutputFile(outputFile)
            } else {
                @Suppress("DEPRECATION")
                setOutputFile(outputFile.absolutePath)
            }
            prepare()
            start()
        }
        true
    } catch (e: Exception) {
        false
    }

    fun stop() {
        try {
            mediaRecorder?.stop()
        } catch (_: Exception) { }
    }

    fun release() {
        try {
            mediaRecorder?.release()
        } catch (_: Exception) { }
        mediaRecorder = null
    }

    companion object {
        fun getMimeTypeForFile(file: File): String =
            when (file.extension.lowercase()) {
                "webm" -> "audio/webm"
                "m4a", "mp4" -> "audio/mp4"
                else -> "audio/mp4"
            }
    }
}
