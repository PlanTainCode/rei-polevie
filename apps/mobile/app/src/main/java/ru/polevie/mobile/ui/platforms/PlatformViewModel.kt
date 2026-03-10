package ru.polevie.mobile.ui.platforms

import android.net.Uri
import android.content.Context
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import ru.polevie.mobile.data.local.dao.PhotoDao
import ru.polevie.mobile.data.local.dao.PlatformDao
import ru.polevie.mobile.data.local.dao.SampleDao
import ru.polevie.mobile.data.local.dao.SyncQueueDao
import ru.polevie.mobile.data.local.entity.PhotoEntity
import ru.polevie.mobile.data.remote.ApiService
import ru.polevie.mobile.data.repository.DataSyncRepository
import ru.polevie.mobile.util.NetworkMonitor
import ru.polevie.mobile.util.NetworkUtils
import ru.polevie.mobile.data.remote.dto.UpdateCoordinatesRequest
import ru.polevie.mobile.sync.SyncManager
import ru.polevie.mobile.util.LocationUtils
import java.io.File
import java.io.FileOutputStream
import kotlin.coroutines.resume

@HiltViewModel
class PlatformViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    savedStateHandle: SavedStateHandle,
    private val platformDao: PlatformDao,
    private val sampleDao: SampleDao,
    private val photoDao: PhotoDao,
    private val syncQueueDao: SyncQueueDao,
    private val fusedLocationClient: FusedLocationProviderClient,
    private val syncManager: SyncManager,
    private val dataSyncRepository: DataSyncRepository,
    private val apiService: ApiService,
    private val networkMonitor: NetworkMonitor,
) : ViewModel() {

    private val _pendingVoiceDescribe = MutableStateFlow<List<String>>(emptyList())
    val pendingVoiceDescribe = _pendingVoiceDescribe.asStateFlow()

    val projectId: String = savedStateHandle.get<String>("projectId") ?: ""
    val platformId: String = savedStateHandle.get<String>("platformId") ?: ""

    val platform = platformDao.getById(platformId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val samples = sampleDao.getByPlatform(platformId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _collectedTotal = MutableStateFlow(Pair(0, 0))
    val collectedTotal = _collectedTotal.asStateFlow()

    val geoLoading = MutableStateFlow(false)
    val exifLoading = MutableStateFlow(false)
    val uploadLoading = MutableStateFlow(false)
    val toastMessage = MutableStateFlow<String?>(null)

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing = _isSyncing.asStateFlow()

    fun refresh() {
        if (projectId.isEmpty() || !networkMonitor.isOnline.value) return
        viewModelScope.launch {
            _isSyncing.value = true
            dataSyncRepository.fetchProjectDetails(projectId).getOrElse { }
            _isSyncing.value = false
        }
    }

    init {
        if (projectId.isNotEmpty() && platformId.isNotEmpty()) {
            viewModelScope.launch {
                if (platformDao.getById(platformId).first() == null && networkMonitor.isOnline.value) {
                    dataSyncRepository.fetchProjectDetails(projectId).getOrElse { }
                }
            }
        }
        viewModelScope.launch {
            sampleDao.getByPlatform(platformId).collect { list ->
                _collectedTotal.value = Pair(
                    list.count { it.status == "COLLECTED" },
                    list.size,
                )
            }
        }
    }

    fun updateCoordinates(lat: String, lon: String) {
        viewModelScope.launch {
            val platform = platformDao.getById(platformId).first() ?: return@launch
            platformDao.updateCoordinates(platformId, lat, lon)
            sampleDao.updateCoordinatesByPlatform(platformId, lat, lon)
            val linkedType = when (platform.type) {
                "PP" -> "SK"
                "SK" -> "PP"
                else -> null
            }
            linkedType?.let { type ->
                val linked = platformDao.getByProjectTypeNumber(projectId, type, platform.number)
                linked?.let { sampleDao.updateCoordinatesByPlatform(it.id, lat, lon) }
            }
            val payload = com.google.gson.Gson().toJson(UpdateCoordinatesRequest(latitude = lat, longitude = lon))
            val entityId = "$projectId/$platformId"
            syncQueueDao.deletePendingByActionAndEntity("UPDATE_PLATFORM_COORDINATES", entityId)
            syncQueueDao.insert(
                ru.polevie.mobile.data.local.entity.SyncQueueEntity(
                    action = "UPDATE_PLATFORM_COORDINATES",
                    entityType = "platform",
                    entityId = entityId,
                    payload = payload,
                )
            )
            syncManager.triggerImmediate()
            toastMessage.value = "Координаты сохранены"
        }
    }

    fun updateCoordinateLat(lat: String) {
        viewModelScope.launch {
            val p = platformDao.getById(platformId).first() ?: return@launch
            val lon = p.longitude ?: ""
            platformDao.updateCoordinates(platformId, lat, lon)
            sampleDao.updateCoordinatesByPlatform(platformId, lat, lon)
            val linkedType = when (p.type) { "PP" -> "SK"; "SK" -> "PP"; else -> null }
            linkedType?.let { platformDao.getByProjectTypeNumber(projectId, it, p.number)?.let { linked -> sampleDao.updateCoordinatesByPlatform(linked.id, lat, lon) } }
            val latEntityId = "$projectId/$platformId"
            syncQueueDao.deletePendingByActionAndEntity("UPDATE_PLATFORM_COORDINATES", latEntityId)
            syncQueueDao.insert(
                ru.polevie.mobile.data.local.entity.SyncQueueEntity(
                    action = "UPDATE_PLATFORM_COORDINATES",
                    entityType = "platform",
                    entityId = latEntityId,
                    payload = com.google.gson.Gson().toJson(UpdateCoordinatesRequest(latitude = lat, longitude = lon)),
                )
            )
            syncManager.triggerImmediate()
            toastMessage.value = "Широта сохранена"
        }
    }

    fun updateCoordinateLon(lon: String) {
        viewModelScope.launch {
            val p = platformDao.getById(platformId).first() ?: return@launch
            val lat = p.latitude ?: ""
            platformDao.updateCoordinates(platformId, lat, lon)
            sampleDao.updateCoordinatesByPlatform(platformId, lat, lon)
            val linkedType = when (p.type) { "PP" -> "SK"; "SK" -> "PP"; else -> null }
            linkedType?.let { platformDao.getByProjectTypeNumber(projectId, it, p.number)?.let { linked -> sampleDao.updateCoordinatesByPlatform(linked.id, lat, lon) } }
            val lonEntityId = "$projectId/$platformId"
            syncQueueDao.deletePendingByActionAndEntity("UPDATE_PLATFORM_COORDINATES", lonEntityId)
            syncQueueDao.insert(
                ru.polevie.mobile.data.local.entity.SyncQueueEntity(
                    action = "UPDATE_PLATFORM_COORDINATES",
                    entityType = "platform",
                    entityId = lonEntityId,
                    payload = com.google.gson.Gson().toJson(UpdateCoordinatesRequest(latitude = lat, longitude = lon)),
                )
            )
            syncManager.triggerImmediate()
            toastMessage.value = "Долгота сохранена"
        }
    }

    fun requestLocation() {
        viewModelScope.launch {
            geoLoading.value = true
            val loc = getCurrentLocation()
            geoLoading.value = false
            loc?.let { (lat, lon) ->
                val latStr = LocationUtils.formatCoordinate(lat)
                val lonStr = LocationUtils.formatCoordinate(lon)
                updateCoordinates(latStr, lonStr)
                toastMessage.value = "Координаты определены"
            } ?: run {
                toastMessage.value = "Не удалось определить местоположение"
            }
        }
    }

    suspend fun getCurrentLocation(): Pair<Double, Double>? {
        if (!LocationUtils.hasLocationPermission(context)) return null
        return suspendCancellableCoroutine { cont ->
            val cts = CancellationTokenSource()
            fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
                .addOnSuccessListener { location ->
                    location?.let { loc ->
                        cont.resume(Pair(loc.latitude, loc.longitude))
                    } ?: cont.resume(null)
                }
                .addOnFailureListener { cont.resume(null) }
            cont.invokeOnCancellation { cts.cancel() }
        }
    }

    fun getExifCoordinates(uri: Uri): Pair<Double, Double>? = LocationUtils.getExifCoordinates(context, uri)

    fun preparePhotoUpload(uri: Uri) {
        viewModelScope.launch {
            uploadLoading.value = true
            try {
                val photoDir = File(context.filesDir, "offline_photos").also { it.mkdirs() }
                val fileName = "photo_${System.currentTimeMillis()}.jpg"
                val file = File(photoDir, fileName)
                LocationUtils.openInputStreamWithLocationAccess(context, uri)?.use { input ->
                    FileOutputStream(file).use { output ->
                        input.copyTo(output)
                    }
                } ?: run {
                    toastMessage.value = "Ошибка чтения файла"
                    uploadLoading.value = false
                    return@launch
                }

                if (NetworkUtils.isConnected(context)) {
                    val response = withContext(Dispatchers.IO) {
                        val requestBody = file.asRequestBody("image/jpeg".toMediaType())
                        val photoPart = MultipartBody.Part.createFormData("photos", file.name, requestBody)
                        apiService.uploadProjectPhotos(projectId, listOf(photoPart))
                    }
                    if (response.isSuccessful) {
                        val results = response.body() ?: emptyList()
                        val uploaded = results.filter { it.success && it.photo != null }.map { it.photo!!.id }
                        if (uploaded.isNotEmpty()) {
                            _pendingVoiceDescribe.value = uploaded
                            toastMessage.value = "${uploaded.size} фото загружено"
                        } else {
                            val err = results.firstOrNull()?.error ?: "Ошибка загрузки"
                            toastMessage.value = err
                        }
                    } else {
                        toastMessage.value = "Ошибка: ${response.code()}"
                    }
                    file.delete()
                } else {
                    val tempId = "local_${System.currentTimeMillis()}"
                    photoDao.insert(PhotoEntity(
                        id = tempId,
                        projectId = projectId,
                        monitoringId = null,
                        probeId = null,
                        filename = file.name,
                        originalName = file.name,
                        thumbnailName = null,
                        description = null,
                        latitude = null,
                        longitude = null,
                        photoDate = null,
                        sortOrder = 0,
                        localFilePath = file.absolutePath,
                        isUploaded = false,
                    ))
                    val payload = com.google.gson.Gson().toJson(mapOf<String, String?>())
                    syncQueueDao.insert(
                        ru.polevie.mobile.data.local.entity.SyncQueueEntity(
                            action = "UPLOAD_PROJECT_PHOTO",
                            entityType = "project",
                            entityId = projectId,
                            payload = payload,
                            filePath = file.absolutePath,
                        )
                    )
                    syncManager.triggerImmediate()
                    toastMessage.value = "Фото добавлено в очередь (нет сети)"
                }
            } catch (e: Exception) {
                toastMessage.value = "Ошибка: ${e.message}"
            }
            uploadLoading.value = false
        }
    }

    fun clearPendingVoiceDescribe() {
        _pendingVoiceDescribe.value = emptyList()
    }
}
