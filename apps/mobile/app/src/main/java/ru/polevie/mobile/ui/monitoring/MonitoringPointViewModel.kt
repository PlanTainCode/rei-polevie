package ru.polevie.mobile.ui.monitoring

import android.content.Context
import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import ru.polevie.mobile.BuildConfig
import ru.polevie.mobile.data.local.dao.MonitoringProbeDao
import ru.polevie.mobile.data.local.dao.PhotoDao
import ru.polevie.mobile.data.local.dao.SyncQueueDao
import ru.polevie.mobile.data.local.entity.MonitoringProbeEntity
import ru.polevie.mobile.data.local.entity.PhotoEntity
import ru.polevie.mobile.data.local.entity.SyncQueueEntity
import ru.polevie.mobile.data.remote.ApiService
import ru.polevie.mobile.data.remote.dto.UpdatePhotoRequest
import ru.polevie.mobile.data.remote.dto.UpdateProbeRequest
import ru.polevie.mobile.data.repository.DataSyncRepository
import ru.polevie.mobile.sync.SyncManager
import ru.polevie.mobile.util.LocationUtils
import ru.polevie.mobile.util.NetworkMonitor
import ru.polevie.mobile.util.NetworkUtils
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject
import kotlin.coroutines.resume

@HiltViewModel
class MonitoringPointViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    savedStateHandle: SavedStateHandle,
    private val monitoringProbeDao: MonitoringProbeDao,
    private val photoDao: PhotoDao,
    private val syncQueueDao: SyncQueueDao,
    private val apiService: ApiService,
    private val dataSyncRepository: DataSyncRepository,
    private val syncManager: SyncManager,
    private val fusedLocationClient: FusedLocationProviderClient,
    private val networkMonitor: NetworkMonitor,
) : ViewModel() {

    val monitoringId: String = savedStateHandle.get<String>("monitoringId") ?: ""
    val pointName: String = savedStateHandle.get<String>("pointName") ?: ""

    val probes = monitoringProbeDao.getByPoint(monitoringId, pointName)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    val photos = photoDao.getByMonitoringPoint(monitoringId, pointName)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _toastMessage = MutableStateFlow<String?>(null)
    val toastMessage = _toastMessage.asStateFlow()
    fun clearToast() { _toastMessage.value = null }
    fun showToast(msg: String) { _toastMessage.value = msg }

    private val _geoLoading = MutableStateFlow(false)
    val geoLoading = _geoLoading.asStateFlow()
    private val _exifLoading = MutableStateFlow(false)
    val exifLoading = _exifLoading.asStateFlow()
    private val _uploadLoading = MutableStateFlow(false)
    val uploadLoading = _uploadLoading.asStateFlow()

    fun refresh() {
        if (!networkMonitor.isOnline.value) return
        viewModelScope.launch {
            dataSyncRepository.fetchMonitoringDetails(monitoringId).getOrElse { }
        }
    }

    fun updateCoordinates(lat: String, lon: String) {
        viewModelScope.launch {
            val list = monitoringProbeDao.getByPoint(monitoringId, pointName).first()
            if (list.isEmpty()) return@launch
            withContext(Dispatchers.IO) {
                list.forEach { p ->
                    monitoringProbeDao.updateProbeFields(p.id, latitude = lat, longitude = lon)
                    val probe = monitoringProbeDao.getByIdSync(p.id) ?: return@forEach
                    val fullReq = UpdateProbeRequest(
                        description = probe.description,
                        containerVolume = probe.containerVolume,
                        containerCount = probe.containerCount,
                        depth = probe.depth,
                        temperature = probe.temperature,
                        mass = probe.mass,
                        note = probe.note,
                        latitude = probe.latitude,
                        longitude = probe.longitude,
                    )
                    val payload = com.google.gson.Gson().toJson(fullReq)
                    val entityId = "$monitoringId/${probe.id}"
                    syncQueueDao.deletePendingByActionAndEntity("UPDATE_MONITORING_PROBE", entityId)
                    syncQueueDao.insert(SyncQueueEntity(action = "UPDATE_MONITORING_PROBE", entityType = "probe", entityId = entityId, payload = payload))
                }
            }
            syncManager.triggerImmediate()
            _toastMessage.value = "Координаты сохранены"
        }
    }

    fun updateProbeField(probeId: String, data: UpdateProbeRequest) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                monitoringProbeDao.updateProbeFields(
                    probeId,
                    description = data.description,
                    containerVolume = data.containerVolume,
                    containerCount = data.containerCount,
                    depth = data.depth,
                    temperature = data.temperature,
                    mass = data.mass,
                    note = data.note,
                )
                val probe = monitoringProbeDao.getByIdSync(probeId) ?: return@withContext
                val fullReq = UpdateProbeRequest(
                    description = probe.description,
                    containerVolume = probe.containerVolume,
                    containerCount = probe.containerCount,
                    depth = probe.depth,
                    temperature = probe.temperature,
                    mass = probe.mass,
                    note = probe.note,
                    latitude = probe.latitude,
                    longitude = probe.longitude,
                )
                val payload = com.google.gson.Gson().toJson(fullReq)
                val entityId = "$monitoringId/$probeId"
                syncQueueDao.deletePendingByActionAndEntity("UPDATE_MONITORING_PROBE", entityId)
                syncQueueDao.insert(SyncQueueEntity(action = "UPDATE_MONITORING_PROBE", entityType = "probe", entityId = entityId, payload = payload))
            }
            syncManager.triggerImmediate()
            _toastMessage.value = "Сохранено"
        }
    }

    fun updateCoordinateLat(lat: String) {
        viewModelScope.launch {
            val list = monitoringProbeDao.getByPoint(monitoringId, pointName).first()
            if (list.isEmpty()) return@launch
            val lon = list.first().longitude ?: ""
            withContext(Dispatchers.IO) {
                list.forEach { p ->
                    monitoringProbeDao.updateProbeFields(p.id, latitude = lat, longitude = lon)
                    val probe = monitoringProbeDao.getByIdSync(p.id) ?: return@forEach
                    val fullReq = UpdateProbeRequest(
                        description = probe.description,
                        containerVolume = probe.containerVolume,
                        containerCount = probe.containerCount,
                        depth = probe.depth,
                        temperature = probe.temperature,
                        mass = probe.mass,
                        note = probe.note,
                        latitude = probe.latitude,
                        longitude = probe.longitude,
                    )
                    val payload = com.google.gson.Gson().toJson(fullReq)
                    val entityId = "$monitoringId/${probe.id}"
                    syncQueueDao.deletePendingByActionAndEntity("UPDATE_MONITORING_PROBE", entityId)
                    syncQueueDao.insert(SyncQueueEntity(action = "UPDATE_MONITORING_PROBE", entityType = "probe", entityId = entityId, payload = payload))
                }
            }
            syncManager.triggerImmediate()
            _toastMessage.value = "Широта сохранена"
        }
    }

    fun updateCoordinateLon(lon: String) {
        viewModelScope.launch {
            val list = monitoringProbeDao.getByPoint(monitoringId, pointName).first()
            if (list.isEmpty()) return@launch
            val lat = list.first().latitude ?: ""
            withContext(Dispatchers.IO) {
                list.forEach { p ->
                    monitoringProbeDao.updateProbeFields(p.id, latitude = lat, longitude = lon)
                    val probe = monitoringProbeDao.getByIdSync(p.id) ?: return@forEach
                    val fullReq = UpdateProbeRequest(
                        description = probe.description,
                        containerVolume = probe.containerVolume,
                        containerCount = probe.containerCount,
                        depth = probe.depth,
                        temperature = probe.temperature,
                        mass = probe.mass,
                        note = probe.note,
                        latitude = probe.latitude,
                        longitude = probe.longitude,
                    )
                    val payload = com.google.gson.Gson().toJson(fullReq)
                    val entityId = "$monitoringId/${probe.id}"
                    syncQueueDao.deletePendingByActionAndEntity("UPDATE_MONITORING_PROBE", entityId)
                    syncQueueDao.insert(SyncQueueEntity(action = "UPDATE_MONITORING_PROBE", entityType = "probe", entityId = entityId, payload = payload))
                }
            }
            syncManager.triggerImmediate()
            _toastMessage.value = "Долгота сохранена"
        }
    }

    fun collectProbe(probeId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                monitoringProbeDao.updateStatus(probeId, "COLLECTED")
                syncQueueDao.insert(SyncQueueEntity(action = "COLLECT_MONITORING_PROBE", entityType = "probe", entityId = "$monitoringId/$probeId", payload = "{}"))
            }
            syncManager.triggerImmediate()
            _toastMessage.value = "Проба отмечена как отобранная"
        }
    }

    fun requestLocation() {
        viewModelScope.launch {
            if (!LocationUtils.hasLocationPermission(context)) {
                _toastMessage.value = "Нет разрешения на геолокацию"
                return@launch
            }
            _geoLoading.value = true
            val loc = getCurrentLocation()
            _geoLoading.value = false
            loc?.let { (lat, lon) ->
                val latStr = LocationUtils.formatCoordinate(lat)
                val lonStr = LocationUtils.formatCoordinate(lon)
                updateCoordinates(latStr, lonStr)
                _toastMessage.value = "Координаты определены"
            } ?: run {
                _toastMessage.value = "Не удалось определить местоположение"
            }
        }
    }

    private suspend fun getCurrentLocation(): Pair<Double, Double>? = suspendCancellableCoroutine { cont ->
        val cts = CancellationTokenSource()
        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
            .addOnSuccessListener { location ->
                location?.let { loc -> cont.resume(Pair(loc.latitude, loc.longitude)) } ?: cont.resume(null)
            }
            .addOnFailureListener { cont.resume(null) }
        cont.invokeOnCancellation { cts.cancel() }
    }

    fun getExifCoordinates(uri: Uri): Pair<Double, Double>? = LocationUtils.getExifCoordinates(context, uri)

    fun applyExifCoordinates(uri: Uri) {
        viewModelScope.launch {
            _exifLoading.value = true
            val coords = getExifCoordinates(uri)
            _exifLoading.value = false
            coords?.let { (lat, lon) ->
                val latStr = LocationUtils.formatCoordinate(lat)
                val lonStr = LocationUtils.formatCoordinate(lon)
                updateCoordinates(latStr, lonStr)
                _toastMessage.value = "Координаты из EXIF сохранены"
            } ?: run {
                _toastMessage.value = "GPS-данные не найдены в фото"
            }
        }
    }

    fun uploadPhotos(uris: List<Uri>) {
        viewModelScope.launch {
            val primaryProbe = monitoringProbeDao.getByPoint(monitoringId, pointName).first().firstOrNull() ?: return@launch
            _uploadLoading.value = true
            var uploaded = 0
            for (uri in uris) {
                try {
                    val photoDir = File(context.filesDir, "offline_photos").also { it.mkdirs() }
                    val file = File(photoDir, "photo_${System.currentTimeMillis()}_${uploaded}.jpg")
                    LocationUtils.openInputStreamWithLocationAccess(context, uri)?.use { input ->
                        FileOutputStream(file).use { output -> input.copyTo(output) }
                    } ?: continue
                    if (NetworkUtils.isConnected(context)) {
                        withContext(Dispatchers.IO) {
                            val requestBody = file.asRequestBody("image/jpeg".toMediaType())
                            val photoPart = MultipartBody.Part.createFormData("photos", file.name, requestBody)
                            val response = apiService.uploadMonitoringPhoto(monitoringId, primaryProbe.id, photoPart, null, null)
                            if (response.isSuccessful) {
                                val results = response.body() ?: emptyList()
                                val dto = results.firstOrNull()?.takeIf { it.success }?.photo
                                if (dto != null) {
                                    photoDao.insert(PhotoEntity(
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
                                    ))
                                    uploaded++
                                }
                            }
                        }
                        file.delete()
                    } else {
                        val tempId = "local_${System.currentTimeMillis()}_$uploaded"
                        val nextSort = (photos.value.maxOfOrNull { it.sortOrder } ?: -1) + 1
                        photoDao.insert(PhotoEntity(
                            id = tempId,
                            projectId = null,
                            monitoringId = monitoringId,
                            probeId = primaryProbe.id,
                            filename = file.name,
                            originalName = file.name,
                            thumbnailName = null,
                            description = null,
                            latitude = null,
                            longitude = null,
                            photoDate = null,
                            sortOrder = nextSort,
                            localFilePath = file.absolutePath,
                            isUploaded = false,
                        ))
                        val payload = com.google.gson.Gson().toJson(mapOf("latitude" to null as String?, "longitude" to null as String?))
                        syncQueueDao.insert(SyncQueueEntity(action = "UPLOAD_MONITORING_PHOTO", entityType = "photo", entityId = "$monitoringId/${primaryProbe.id}", payload = payload, filePath = file.absolutePath))
                        uploaded++
                    }
                } catch (_: Exception) { }
            }
            _uploadLoading.value = false
            if (uploaded > 0) {
                _toastMessage.value = "$uploaded фото загружено"
                if (networkMonitor.isOnline.value) {
                    dataSyncRepository.fetchMonitoringDetails(monitoringId).getOrElse { }
                }
            }
        }
    }

    fun updatePhotoDescription(photoId: String, description: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                photoDao.updateDescription(photoId, description)
                if (NetworkUtils.isConnected(context)) {
                    runCatching { apiService.updateMonitoringPhoto(monitoringId, photoId, UpdatePhotoRequest(description = description)) }
                } else {
                    val entityId = "$monitoringId/$photoId"
                    syncQueueDao.deletePendingByActionAndEntity("UPDATE_MONITORING_PHOTO", entityId)
                    syncQueueDao.insert(SyncQueueEntity(action = "UPDATE_MONITORING_PHOTO", entityType = "photo", entityId = entityId, payload = com.google.gson.Gson().toJson(UpdatePhotoRequest(description = description))))
                    syncManager.triggerImmediate()
                }
            }
            _toastMessage.value = "Описание сохранено"
        }
    }

    fun voiceDescribePhoto(photoId: String, audioFile: File) {
        viewModelScope.launch {
            if (NetworkUtils.isConnected(context)) {
                withContext(Dispatchers.IO) {
                    runCatching {
                        val mime = when (audioFile.extension.lowercase()) {
                            "webm" -> "audio/webm"
                            else -> "audio/mp4"
                        }
                        val body = audioFile.asRequestBody(mime.toMediaType())
                        val part = MultipartBody.Part.createFormData("audio", audioFile.name, body)
                        apiService.voiceDescribeMonitoringPhoto(monitoringId, photoId, part)
                        dataSyncRepository.fetchMonitoringDetails(monitoringId).getOrElse { }
                    }.onFailure { _toastMessage.value = "Ошибка голосового описания" }
                }
                _toastMessage.value = "Описание добавлено"
            } else {
                syncQueueDao.insert(SyncQueueEntity(action = "VOICE_DESCRIBE_MONITORING_PHOTO", entityType = "photo", entityId = "$monitoringId/$photoId", payload = "{}", filePath = audioFile.absolutePath))
                syncManager.triggerImmediate()
                _toastMessage.value = "Добавлено в очередь (нет сети)"
            }
        }
    }

    companion object {
        fun photoThumbnailUrl(monitoringId: String, photoId: String): String =
            "${BuildConfig.API_BASE_URL}/monitorings/$monitoringId/photos/$photoId/thumbnail"

        fun photoOriginalUrl(monitoringId: String, photoId: String): String =
            "${BuildConfig.API_BASE_URL}/monitorings/$monitoringId/photos/$photoId/original"
    }
}
