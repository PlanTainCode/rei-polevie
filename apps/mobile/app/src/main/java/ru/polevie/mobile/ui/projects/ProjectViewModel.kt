package ru.polevie.mobile.ui.projects

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import ru.polevie.mobile.data.local.dao.PlatformDao
import ru.polevie.mobile.data.local.dao.ProjectDao
import ru.polevie.mobile.data.local.dao.SampleDao
import ru.polevie.mobile.data.local.dao.PhotoDao
import ru.polevie.mobile.data.local.entity.ProjectEntity
import ru.polevie.mobile.data.repository.DataSyncRepository
import ru.polevie.mobile.util.NetworkMonitor
import javax.inject.Inject

@HiltViewModel
class ProjectViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val projectDao: ProjectDao,
    private val sampleDao: SampleDao,
    private val platformDao: PlatformDao,
    private val photoDao: PhotoDao,
    private val dataSyncRepository: DataSyncRepository,
    private val networkMonitor: NetworkMonitor,
) : ViewModel() {

    val projectId: String = savedStateHandle.get<String>("projectId") ?: ""

    val project: StateFlow<ProjectEntity?> = projectDao.getById(projectId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val collectedCount: StateFlow<Int> = sampleDao.getCollectedCount(projectId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val totalCount: StateFlow<Int> = sampleDao.getTotalCount(projectId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val platformsCount: StateFlow<Int> = platformDao.getCountByProject(projectId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val photosCount: StateFlow<Int> = photoDao.getCountByProject(projectId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    fun refresh() {
        if (projectId.isEmpty() || !networkMonitor.isOnline.value) return
        viewModelScope.launch {
            _isSyncing.value = true
            dataSyncRepository.fetchProjectDetails(projectId).getOrElse { }
            _isSyncing.value = false
        }
    }

    init {
        if (projectId.isNotEmpty()) {
            viewModelScope.launch {
                if (projectDao.getById(projectId).first() == null && networkMonitor.isOnline.value) {
                    dataSyncRepository.fetchProjectDetails(projectId).getOrElse { }
                }
            }
        }
    }
}
