package ru.polevie.mobile.ui.platforms

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import ru.polevie.mobile.data.local.dao.PlatformDao
import ru.polevie.mobile.data.repository.DataSyncRepository
import ru.polevie.mobile.util.NetworkMonitor
import javax.inject.Inject

@HiltViewModel
class PlatformsViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val platformDao: PlatformDao,
    private val dataSyncRepository: DataSyncRepository,
    private val networkMonitor: NetworkMonitor,
) : ViewModel() {

    val projectId: String = savedStateHandle.get<String>("projectId") ?: ""

    val platforms = platformDao.getByProject(projectId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val isLoading = MutableStateFlow(false)

    fun refresh() {
        if (projectId.isEmpty() || !networkMonitor.isOnline.value) return
        viewModelScope.launch {
            isLoading.value = true
            dataSyncRepository.fetchProjectDetails(projectId).getOrElse { }
            isLoading.value = false
        }
    }

    init {
        if (projectId.isNotEmpty()) {
            viewModelScope.launch {
                val list = platformDao.getByProject(projectId).first()
                if (list.isEmpty() && networkMonitor.isOnline.value) {
                    dataSyncRepository.fetchProjectDetails(projectId).getOrElse { }
                }
            }
        }
    }
}
