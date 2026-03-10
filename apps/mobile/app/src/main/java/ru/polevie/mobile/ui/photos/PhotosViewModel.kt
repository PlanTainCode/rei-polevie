package ru.polevie.mobile.ui.photos

import android.content.Context
import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import ru.polevie.mobile.BuildConfig
import ru.polevie.mobile.data.local.dao.PhotoDao
import ru.polevie.mobile.data.local.dao.SyncQueueDao
import ru.polevie.mobile.data.local.entity.PhotoEntity
import ru.polevie.mobile.data.remote.ApiService
import ru.polevie.mobile.data.remote.dto.UpdatePhotoRequest
import ru.polevie.mobile.data.repository.DataSyncRepository
import ru.polevie.mobile.sync.SyncManager
import ru.polevie.mobile.util.LocationUtils
import ru.polevie.mobile.util.NetworkUtils
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

@HiltViewModel
class PhotosViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val photoDao: PhotoDao,
    private val syncQueueDao: SyncQueueDao,
    private val syncManager: SyncManager,
    private val dataSyncRepository: DataSyncRepository,
    private val apiService: ApiService,
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val projectId: String = savedStateHandle.get<String>("projectId") ?: ""

    val photos = photoDao.getByProject(projectId).stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList(),
    )

    private val _withoutDescriptionCount = photoDao.getByProject(projectId).map { list ->
        list.count { it.description.isNullOrBlank() }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)
    val withoutDescriptionCount = _withoutDescriptionCount

    private val _uploadLoading = MutableStateFlow(false)
    val uploadLoading = _uploadLoading.asStateFlow()

    private val _toastMessage = MutableStateFlow<String?>(null)
    val toastMessage = _toastMessage.asStateFlow()

    private val _pendingVoiceDescribe = MutableStateFlow<List<String>>(emptyList())
    val pendingVoiceDescribe = _pendingVoiceDescribe.asStateFlow()

    private val _voiceDescribePhotoIds = MutableStateFlow<List<String>>(emptyList())
    val voiceDescribePhotoIds = _voiceDescribePhotoIds.asStateFlow()
    fun setVoiceDescribePhotoIds(ids: List<String>) { _voiceDescribePhotoIds.value = ids }
    fun clearVoiceDescribePhotoIds() { _voiceDescribePhotoIds.value = emptyList() }

    private val _refreshing = MutableStateFlow(false)
    val refreshing = _refreshing.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _refreshing.value = true
            dataSyncRepository.fetchProjectDetails(projectId).onFailure {
                _toastMessage.value = "Ошибка обновления: ${it.message}"
            }
            _refreshing.value = false
        }
    }

    fun addPhotos(uris: List<Uri>) {
        if (uris.isEmpty()) return
        viewModelScope.launch {
            _uploadLoading.value = true
            try {
                if (NetworkUtils.isConnected(context)) {
                    uploadOnline(uris)
                } else {
                    uploadOffline(uris)
                }
            } catch (e: Exception) {
                _toastMessage.value = "Ошибка: ${e.message}"
            }
            _uploadLoading.value = false
        }
    }

    private suspend fun uploadOnline(uris: List<Uri>) = withContext(Dispatchers.IO) {
        val parts = mutableListOf<MultipartBody.Part>()
        val tempFiles = mutableListOf<File>()
        try {
            for (uri in uris) {
                val file = File(context.cacheDir, "upload_${UUID.randomUUID()}.jpg")
                LocationUtils.openInputStreamWithLocationAccess(context, uri)?.use { input ->
                    FileOutputStream(file).use { output -> input.copyTo(output) }
                } ?: continue
                tempFiles.add(file)
                val body = file.asRequestBody("image/jpeg".toMediaType())
                parts.add(MultipartBody.Part.createFormData("photos", file.name, body))
            }
            if (parts.isEmpty()) {
                _toastMessage.value = "Не удалось прочитать файлы"
                return@withContext
            }
            val response = apiService.uploadProjectPhotos(projectId, parts)
            tempFiles.forEach { it.delete() }
            if (response.isSuccessful) {
                val results = response.body() ?: emptyList()
                val successCount = results.count { it.success && it.photo != null }
                val failedCount = results.size - successCount
                if (successCount > 0) {
                    val ids = results.filter { it.success && it.photo != null }.map { it.photo!!.id }
                    _pendingVoiceDescribe.value = ids
                    _voiceDescribePhotoIds.value = ids
                    dataSyncRepository.fetchProjectDetails(projectId).getOrElse { }
                    _toastMessage.value = when {
                        failedCount > 0 -> "Загружено $successCount из ${results.size}"
                        else -> "Загружено $successCount фото"
                    }
                } else {
                    val err = results.firstOrNull()?.error ?: "Ошибка ${response.code()}"
                    _toastMessage.value = err
                }
            } else {
                _toastMessage.value = "Ошибка: ${response.code()}"
            }
        } finally {
            tempFiles.forEach { it.delete() }
        }
    }

    private suspend fun uploadOffline(uris: List<Uri>) = withContext(Dispatchers.IO) {
        var sortOrder = photoDao.getNextSortOrder(projectId)
        for (uri in uris) {
            val file = File(context.cacheDir, "photo_${System.currentTimeMillis()}_${UUID.randomUUID()}.jpg")
            LocationUtils.openInputStreamWithLocationAccess(context, uri)?.use { input ->
                FileOutputStream(file).use { output -> input.copyTo(output) }
            } ?: continue
            val coords = LocationUtils.getExifCoordinates(context, uri)
            val lat = coords?.first?.let { LocationUtils.formatCoordinate(it) }
            val lon = coords?.second?.let { LocationUtils.formatCoordinate(it) }
            val tempId = UUID.randomUUID().toString()
            val entity = PhotoEntity(
                id = tempId,
                projectId = projectId,
                monitoringId = null,
                probeId = null,
                filename = file.name,
                originalName = file.name,
                thumbnailName = null,
                description = null,
                latitude = lat,
                longitude = lon,
                photoDate = null,
                sortOrder = sortOrder++,
                localFilePath = file.absolutePath,
                isUploaded = false,
            )
            photoDao.insert(entity)
            val payload = com.google.gson.Gson().toJson(mapOf(
                "latitude" to lat,
                "longitude" to lon,
                "localPhotoId" to tempId,
            ))
            syncQueueDao.insert(
                ru.polevie.mobile.data.local.entity.SyncQueueEntity(
                    action = "UPLOAD_PROJECT_PHOTO",
                    entityType = "project",
                    entityId = projectId,
                    payload = payload,
                    filePath = file.absolutePath,
                ),
            )
        }
        syncManager.triggerImmediate()
        _toastMessage.value = "Добавлено ${uris.size} фото в очередь (нет сети)"
    }

    fun updateDescription(photoId: String, description: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                photoDao.updateDescription(photoId, description)
                if (NetworkUtils.isConnected(context)) {
                    runCatching {
                        apiService.updateProjectPhoto(projectId, photoId, UpdatePhotoRequest(description = description))
                    }
                } else {
                    val entityId = "$projectId/$photoId"
                    syncQueueDao.deletePendingByActionAndEntity("UPDATE_PROJECT_PHOTO", entityId)
                    syncQueueDao.insert(
                        ru.polevie.mobile.data.local.entity.SyncQueueEntity(
                            action = "UPDATE_PROJECT_PHOTO",
                            entityType = "project",
                            entityId = entityId,
                            payload = com.google.gson.Gson().toJson(UpdatePhotoRequest(description = description)),
                        ),
                    )
                    syncManager.triggerImmediate()
                }
            }
            _toastMessage.value = "Описание сохранено"
        }
    }

    fun voiceDescribe(photoId: String, audioFile: File) {
        viewModelScope.launch {
            voiceDescribeSync(photoId, audioFile)
        }
    }

    suspend fun voiceDescribeSync(photoId: String, audioFile: File): Result<Unit> = withContext(Dispatchers.IO) {
        if (NetworkUtils.isConnected(context)) {
            runCatching {
                val mime = when (audioFile.extension.lowercase()) {
                    "webm" -> "audio/webm"
                    else -> "audio/mp4"
                }
                val body = audioFile.asRequestBody(mime.toMediaType())
                val part = MultipartBody.Part.createFormData("audio", audioFile.name, body)
                apiService.voiceDescribeProjectPhoto(projectId, photoId, part)
                dataSyncRepository.fetchProjectDetails(projectId).getOrThrow()
            }.also { result -> result.onFailure { e -> _toastMessage.value = "Ошибка: ${e.message}" } }
        } else {
            syncQueueDao.insert(
                ru.polevie.mobile.data.local.entity.SyncQueueEntity(
                    action = "VOICE_DESCRIBE_PROJECT_PHOTO",
                    entityType = "project",
                    entityId = "$projectId/$photoId",
                    payload = "{}",
                    filePath = audioFile.absolutePath,
                ),
            )
            syncManager.triggerImmediate()
            _toastMessage.value = "Описание добавлено в очередь"
            Result.success(Unit)
        }
    }

    fun clearToast() {
        _toastMessage.value = null
    }

    fun clearPendingVoiceDescribe() {
        _pendingVoiceDescribe.value = emptyList()
    }

    companion object {
        fun thumbnailUrl(projectId: String, photoId: String): String =
            "${BuildConfig.API_BASE_URL}/projects/$projectId/photos/$photoId/thumbnail"

        fun originalUrl(projectId: String, photoId: String): String =
            "${BuildConfig.API_BASE_URL}/projects/$projectId/photos/$photoId/original"
    }
}
