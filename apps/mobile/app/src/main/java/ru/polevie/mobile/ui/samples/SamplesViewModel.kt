package ru.polevie.mobile.ui.samples

import android.content.Context
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import ru.polevie.mobile.data.local.dao.PlatformDao
import ru.polevie.mobile.data.local.dao.SampleDao
import ru.polevie.mobile.data.local.dao.SyncQueueDao
import ru.polevie.mobile.data.remote.ApiService
import ru.polevie.mobile.data.remote.dto.UpdateDescriptionRequest
import ru.polevie.mobile.data.remote.dto.UpdateSampleRequest
import ru.polevie.mobile.data.repository.DataSyncRepository
import ru.polevie.mobile.sync.SyncManager
import ru.polevie.mobile.util.NetworkMonitor
import ru.polevie.mobile.util.NetworkUtils
import javax.inject.Inject

@HiltViewModel
class SamplesViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val sampleDao: SampleDao,
    private val platformDao: PlatformDao,
    private val syncQueueDao: SyncQueueDao,
    private val syncManager: SyncManager,
    private val dataSyncRepository: DataSyncRepository,
    private val apiService: ApiService,
    private val networkMonitor: NetworkMonitor,
) : ViewModel() {

    val projectId: String = savedStateHandle.get<String>("projectId") ?: ""
    val platformId: String = savedStateHandle.get<String>("platformId") ?: ""

    val platform = platformDao.getById(platformId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val samples = sampleDao.getByPlatform(platformId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val isPP: Boolean
        get() = platform.value?.type == "PP"

    private val _toastMessage = MutableStateFlow<String?>(null)
    val toastMessage = _toastMessage.asStateFlow()

    fun clearToast() { _toastMessage.value = null }

    fun refresh() {
        if (projectId.isEmpty() || !networkMonitor.isOnline.value) return
        viewModelScope.launch {
            dataSyncRepository.fetchProjectDetails(projectId).getOrElse { }
        }
    }

    fun collectAllSamples() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                sampleDao.collectAllByPlatform(platformId)
                if (NetworkUtils.isConnected(context)) {
                    runCatching {
                        apiService.collectPlatformSamples(projectId, platformId)
                        dataSyncRepository.fetchProjectDetails(projectId)
                        _toastMessage.value = "Все пробы отмечены"
                    }
                } else {
                    syncQueueDao.insert(
                        ru.polevie.mobile.data.local.entity.SyncQueueEntity(
                            action = "COLLECT_PLATFORM_SAMPLES",
                            entityType = "platform",
                            entityId = "$projectId/$platformId",
                            payload = "{}",
                        ),
                    )
                    syncManager.triggerImmediate()
                    _toastMessage.value = "Добавлено в очередь"
                }
            }
        }
    }

    fun collectSample(sampleId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                if (isPP) {
                    sampleDao.collectAllByPlatform(platformId)
                    if (NetworkUtils.isConnected(context)) {
                        runCatching {
                            apiService.collectPlatformSamples(projectId, platformId)
                            dataSyncRepository.fetchProjectDetails(projectId)
                            _toastMessage.value = "Все пробы площадки отмечены"
                        }
                    } else {
                        syncQueueDao.insert(
                            ru.polevie.mobile.data.local.entity.SyncQueueEntity(
                                action = "COLLECT_PLATFORM_SAMPLES",
                                entityType = "platform",
                                entityId = "$projectId/$platformId",
                                payload = "{}",
                            ),
                        )
                        syncManager.triggerImmediate()
                    }
                } else {
                    sampleDao.updateStatus(sampleId, "COLLECTED")
                    if (NetworkUtils.isConnected(context)) {
                        runCatching {
                            apiService.collectSample(projectId, sampleId)
                            dataSyncRepository.fetchProjectDetails(projectId)
                            _toastMessage.value = "Проба отмечена"
                        }
                    } else {
                        syncQueueDao.insert(
                            ru.polevie.mobile.data.local.entity.SyncQueueEntity(
                                action = "COLLECT_SAMPLE",
                                entityType = "sample",
                                entityId = "$projectId/$sampleId",
                                payload = "{}",
                            ),
                        )
                        syncManager.triggerImmediate()
                        _toastMessage.value = "Добавлено в очередь"
                    }
                }
            }
        }
    }

    fun setPlatformDescription(description: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                samples.value.forEach { sampleDao.updateDescription(it.id, description) }
                if (NetworkUtils.isConnected(context)) {
                    runCatching {
                        apiService.setPlatformDescription(projectId, platformId, UpdateDescriptionRequest(description))
                        dataSyncRepository.fetchProjectDetails(projectId)
                        _toastMessage.value = "Характеристика сохранена"
                    }
                } else {
                    val entityId = "$projectId/$platformId"
                    syncQueueDao.deletePendingByActionAndEntity("SET_PLATFORM_DESCRIPTION", entityId)
                    syncQueueDao.insert(
                        ru.polevie.mobile.data.local.entity.SyncQueueEntity(
                            action = "SET_PLATFORM_DESCRIPTION",
                            entityType = "platform",
                            entityId = entityId,
                            payload = com.google.gson.Gson().toJson(UpdateDescriptionRequest(description)),
                        ),
                    )
                    syncManager.triggerImmediate()
                }
            }
        }
    }

    fun updateSampleDescription(sampleId: String, description: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                if (isPP) {
                    samples.value.forEach { sampleDao.updateDescription(it.id, description) }
                    if (NetworkUtils.isConnected(context)) {
                        runCatching {
                            apiService.setPlatformDescription(projectId, platformId, UpdateDescriptionRequest(description))
                            dataSyncRepository.fetchProjectDetails(projectId)
                            _toastMessage.value = "Характеристика для всей площадки сохранена"
                        }
                    } else {
                        val ppEntityId = "$projectId/$platformId"
                        syncQueueDao.deletePendingByActionAndEntity("SET_PLATFORM_DESCRIPTION", ppEntityId)
                        syncQueueDao.insert(
                            ru.polevie.mobile.data.local.entity.SyncQueueEntity(
                                action = "SET_PLATFORM_DESCRIPTION",
                                entityType = "platform",
                                entityId = ppEntityId,
                                payload = com.google.gson.Gson().toJson(UpdateDescriptionRequest(description)),
                            ),
                        )
                        syncManager.triggerImmediate()
                    }
                } else {
                    sampleDao.updateDescription(sampleId, description)
                    if (NetworkUtils.isConnected(context)) {
                        runCatching {
                            apiService.updateSample(projectId, sampleId, UpdateSampleRequest(description = description))
                            dataSyncRepository.fetchProjectDetails(projectId)
                            _toastMessage.value = "Характеристика сохранена"
                        }
                    } else {
                        val sampleEntityId = "$projectId/$sampleId"
                        syncQueueDao.deletePendingByActionAndEntity("UPDATE_SAMPLE", sampleEntityId)
                        syncQueueDao.insert(
                            ru.polevie.mobile.data.local.entity.SyncQueueEntity(
                                action = "UPDATE_SAMPLE",
                                entityType = "sample",
                                entityId = sampleEntityId,
                                payload = com.google.gson.Gson().toJson(UpdateSampleRequest(description = description)),
                            ),
                        )
                        syncManager.triggerImmediate()
                    }
                }
            }
        }
    }
}
