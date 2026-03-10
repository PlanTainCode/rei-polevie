package ru.polevie.mobile.sync

import com.google.gson.Gson
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import ru.polevie.mobile.data.local.dao.PhotoDao
import ru.polevie.mobile.data.local.dao.SyncQueueDao
import ru.polevie.mobile.data.local.entity.SyncQueueEntity
import ru.polevie.mobile.data.remote.ApiService
import ru.polevie.mobile.data.remote.dto.UpdateCoordinatesRequest
import ru.polevie.mobile.data.remote.dto.UpdateDescriptionRequest
import ru.polevie.mobile.data.remote.dto.UpdatePhotoRequest
import ru.polevie.mobile.data.remote.dto.UpdateProbeRequest
import ru.polevie.mobile.data.remote.dto.UpdateSampleRequest
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Обрабатывает очередь синхронизации — отправляет локальные изменения на API.
 * Используется перед fetch, чтобы сервер получил наши изменения до загрузки.
 */
@Singleton
class SyncProcessor @Inject constructor(
    private val syncQueueDao: SyncQueueDao,
    private val photoDao: PhotoDao,
    private val apiService: ApiService,
    private val gson: Gson,
) {
    private val mutex = Mutex()

    /**
     * @return количество неудачных операций
     */
    suspend fun processAllPending(): Int = mutex.withLock {
        val pending = syncQueueDao.getPending() + syncQueueDao.getRetryable()
        var failures = 0
        for (entry in pending) {
            try {
                processEntry(entry)
                syncQueueDao.markCompleted(entry.id)
            } catch (e: Exception) {
                syncQueueDao.markFailed(entry.id, e.message ?: "Unknown error")
                failures++
            }
        }
        syncQueueDao.deleteCompleted()
        failures
    }

    private suspend fun processEntry(entry: SyncQueueEntity) {
        when (entry.action) {
            "UPDATE_PLATFORM_COORDINATES" -> {
                val req = gson.fromJson(entry.payload, UpdateCoordinatesRequest::class.java)
                val parts = entry.entityId.split("/")
                apiService.updatePlatformCoordinates(parts[0], parts[1], req)
            }
            "SET_PLATFORM_DESCRIPTION" -> {
                val req = gson.fromJson(entry.payload, UpdateDescriptionRequest::class.java)
                val parts = entry.entityId.split("/")
                apiService.setPlatformDescription(parts[0], parts[1], req)
            }
            "COLLECT_PLATFORM_SAMPLES" -> {
                val parts = entry.entityId.split("/")
                apiService.collectPlatformSamples(parts[0], parts[1])
            }
            "UPDATE_SAMPLE" -> {
                val req = gson.fromJson(entry.payload, UpdateSampleRequest::class.java)
                val parts = entry.entityId.split("/")
                apiService.updateSample(parts[0], parts[1], req)
            }
            "COLLECT_SAMPLE" -> {
                val parts = entry.entityId.split("/")
                apiService.collectSample(parts[0], parts[1])
            }
            "UPLOAD_PROJECT_PHOTO" -> {
                val filePath = entry.filePath ?: throw Exception("Нет пути к файлу")
                val file = File(filePath)
                if (!file.exists()) throw Exception("Файл не найден: $filePath")
                val projectId = entry.entityId.split("/")[0]
                val requestBody = file.asRequestBody("image/jpeg".toMediaType())
                val photoPart = MultipartBody.Part.createFormData("photos", file.name, requestBody)
                val response = apiService.uploadProjectPhotos(projectId, listOf(photoPart))
                if (response.isSuccessful) {
                    val results = response.body() ?: emptyList()
                    val success = results.firstOrNull { it.success && it.photo != null }
                    if (success != null) {
                        photoDao.deleteByLocalFilePath(filePath)
                        val dto = success.photo!!
                        photoDao.insert(
                            ru.polevie.mobile.data.local.entity.PhotoEntity(
                                id = dto.id,
                                projectId = projectId,
                                monitoringId = null,
                                probeId = null,
                                filename = dto.filename,
                                originalName = dto.originalName,
                                thumbnailName = dto.thumbnailName,
                                description = dto.description,
                                latitude = dto.latitude,
                                longitude = dto.longitude,
                                photoDate = dto.photoDate,
                                sortOrder = dto.sortOrder,
                                localFilePath = null,
                                isUploaded = true,
                            ),
                        )
                    }
                    file.delete()
                } else {
                    throw Exception("Upload failed: ${response.code()}")
                }
            }
            "UPDATE_PROJECT_PHOTO" -> {
                val req = gson.fromJson(entry.payload, UpdatePhotoRequest::class.java)
                val parts = entry.entityId.split("/")
                apiService.updateProjectPhoto(parts[0], parts[1], req)
            }
            "UPDATE_MONITORING_PROBE" -> {
                val req = gson.fromJson(entry.payload, UpdateProbeRequest::class.java)
                val parts = entry.entityId.split("/")
                apiService.updateMonitoringProbe(parts[0], parts[1], req)
            }
            "COLLECT_MONITORING_PROBE" -> {
                val parts = entry.entityId.split("/")
                apiService.collectMonitoringProbe(parts[0], parts[1])
            }
            "UPLOAD_MONITORING_PHOTO" -> {
                val filePath = entry.filePath ?: throw Exception("Нет пути к файлу")
                val file = File(filePath)
                if (!file.exists()) throw Exception("Файл не найден: $filePath")
                val parts = entry.entityId.split("/")
                val monitoringId = parts[0]
                val probeId = parts[1]
                val requestBody = file.asRequestBody("image/jpeg".toMediaType())
                val photoPart = MultipartBody.Part.createFormData("photos", file.name, requestBody)
                val payload = gson.fromJson(entry.payload, Map::class.java)
                val lat = (payload["latitude"] as? String)?.toRequestBody("text/plain".toMediaType())
                val lon = (payload["longitude"] as? String)?.toRequestBody("text/plain".toMediaType())
                val response = apiService.uploadMonitoringPhoto(monitoringId, probeId, photoPart, lat, lon)
                if (response.isSuccessful) {
                    photoDao.deleteByLocalFilePath(filePath)
                    val results = response.body() ?: emptyList()
                    val dto = results.firstOrNull()?.takeIf { it.success }?.photo
                    if (dto != null) {
                        photoDao.insert(
                            ru.polevie.mobile.data.local.entity.PhotoEntity(
                                id = dto.id,
                                projectId = null,
                                monitoringId = monitoringId,
                                probeId = dto.probeId,
                                filename = dto.filename,
                                originalName = dto.originalName,
                                thumbnailName = dto.thumbnailName,
                                description = dto.description,
                                latitude = dto.latitude,
                                longitude = dto.longitude,
                                photoDate = dto.photoDate,
                                sortOrder = dto.sortOrder,
                                localFilePath = null,
                                isUploaded = true,
                            ),
                        )
                    }
                    file.delete()
                } else {
                    throw Exception("Upload failed: ${response.code()}")
                }
            }
            "UPDATE_MONITORING_PHOTO" -> {
                val req = gson.fromJson(entry.payload, UpdatePhotoRequest::class.java)
                val parts = entry.entityId.split("/")
                apiService.updateMonitoringPhoto(parts[0], parts[1], req)
            }
            "VOICE_DESCRIBE_PROJECT_PHOTO" -> {
                val filePath = entry.filePath ?: throw Exception("Нет пути к файлу")
                val file = File(filePath)
                if (!file.exists()) throw Exception("Файл не найден: $filePath")
                val parts = entry.entityId.split("/")
                val mime = when (file.extension.lowercase()) {
                    "webm" -> "audio/webm"
                    "m4a", "mp4" -> "audio/mp4"
                    else -> "audio/mp4"
                }
                val requestBody = file.asRequestBody(mime.toMediaType())
                val audioPart = MultipartBody.Part.createFormData("audio", file.name, requestBody)
                apiService.voiceDescribeProjectPhoto(parts[0], parts[1], audioPart)
            }
            "VOICE_DESCRIBE_MONITORING_PHOTO" -> {
                val filePath = entry.filePath ?: throw Exception("Нет пути к файлу")
                val file = File(filePath)
                if (!file.exists()) throw Exception("Файл не найден: $filePath")
                val parts = entry.entityId.split("/")
                val requestBody = file.asRequestBody("audio/webm".toMediaType())
                val audioPart = MultipartBody.Part.createFormData("audio", file.name, requestBody)
                apiService.voiceDescribeMonitoringPhoto(parts[0], parts[1], audioPart)
            }
        }
    }
}
