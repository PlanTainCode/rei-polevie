package ru.polevie.mobile.data.repository

import android.content.Context
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import ru.polevie.mobile.BuildConfig
import ru.polevie.mobile.data.local.dao.PhotoDao
import ru.polevie.mobile.data.local.entity.PhotoEntity
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PhotoCacheManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val photoDao: PhotoDao,
    private val okHttpClient: OkHttpClient,
) {
    private val cacheDir: File
        get() = File(context.filesDir, "photo_cache").also { it.mkdirs() }

    suspend fun cacheNewPhotos() = withContext(Dispatchers.IO) {
        val uncached = photoDao.getUncachedPhotos()
        if (uncached.isEmpty()) return@withContext

        Log.d(TAG, "Caching ${uncached.size} photo thumbnails")

        coroutineScope {
            uncached.chunked(4).forEach { batch ->
                batch.map { photo ->
                    async { cachePhoto(photo) }
                }.awaitAll()
            }
        }
    }

    private suspend fun cachePhoto(photo: PhotoEntity) {
        try {
            val url = buildThumbnailUrl(photo) ?: return
            val file = File(cacheDir, "thumb_${photo.id}.jpg")
            if (file.exists()) {
                photoDao.updateLocalFilePath(photo.id, file.absolutePath)
                return
            }

            val request = Request.Builder().url(url).build()
            val response = okHttpClient.newCall(request).execute()
            if (!response.isSuccessful) {
                response.close()
                return
            }

            response.body?.byteStream()?.use { input ->
                file.outputStream().use { output -> input.copyTo(output) }
            }
            response.close()

            if (file.exists() && file.length() > 0) {
                photoDao.updateLocalFilePath(photo.id, file.absolutePath)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to cache photo ${photo.id}: ${e.message}")
        }
    }

    private fun buildThumbnailUrl(photo: PhotoEntity): String? {
        val base = BuildConfig.API_BASE_URL
        return when {
            photo.projectId != null -> "$base/projects/${photo.projectId}/photos/${photo.id}/thumbnail"
            photo.monitoringId != null -> "$base/monitorings/${photo.monitoringId}/photos/${photo.id}/thumbnail"
            else -> null
        }
    }

    companion object {
        private const val TAG = "PhotoCacheManager"
    }
}
