package ru.polevie.mobile.ui.monitoring

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.polevie.mobile.data.local.dao.MonitoringDao
import ru.polevie.mobile.data.local.entity.MonitoringEntity
import ru.polevie.mobile.data.repository.DataSyncRepository
import ru.polevie.mobile.util.NetworkMonitor
import javax.inject.Inject

@HiltViewModel
class MonitoringListViewModel @Inject constructor(
    private val monitoringDao: MonitoringDao,
    private val dataSyncRepository: DataSyncRepository,
    val networkMonitor: NetworkMonitor,
) : ViewModel() {

    val monitorings: StateFlow<List<MonitoringEntity>> = monitoringDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun refresh() {
        if (!networkMonitor.isOnline.value) return
        viewModelScope.launch {
            _isLoading.update { true }
            dataSyncRepository.fetchAllMonitorings().getOrElse { }
            _isLoading.update { false }
        }
    }
}
