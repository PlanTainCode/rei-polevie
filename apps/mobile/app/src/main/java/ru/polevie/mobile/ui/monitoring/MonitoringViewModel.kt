package ru.polevie.mobile.ui.monitoring

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.polevie.mobile.data.local.dao.MonitoringDao
import ru.polevie.mobile.data.local.dao.MonitoringProbeDao
import ru.polevie.mobile.data.local.entity.MonitoringEntity
import ru.polevie.mobile.data.local.entity.MonitoringProbeEntity
import ru.polevie.mobile.data.repository.DataSyncRepository
import ru.polevie.mobile.util.NetworkMonitor
import javax.inject.Inject

data class MonitoringUiState(
    val monitoring: MonitoringEntity?,
    val probes: List<MonitoringProbeEntity>,
    val isLoading: Boolean,
) {
    val collected = probes.count { it.status == "COLLECTED" }
    val total = probes.size
    val progressPercent = if (total > 0) (collected.toFloat() / total * 100).toInt() else 0
}

@HiltViewModel
class MonitoringViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val monitoringDao: MonitoringDao,
    private val monitoringProbeDao: MonitoringProbeDao,
    private val dataSyncRepository: DataSyncRepository,
    private val networkMonitor: NetworkMonitor,
) : ViewModel() {

    val monitoringId: String = savedStateHandle.get<String>("monitoringId") ?: ""

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    val uiState: StateFlow<MonitoringUiState> = combine(
        monitoringDao.getById(monitoringId),
        monitoringProbeDao.getByMonitoring(monitoringId),
        _isLoading,
    ) { monitoring, probes, isLoading ->
        MonitoringUiState(
            monitoring = monitoring,
            probes = probes,
            isLoading = isLoading,
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = MonitoringUiState(null, emptyList(), true),
    )

    init {
        refresh()
    }

    fun refresh() {
        if (monitoringId.isEmpty() || !networkMonitor.isOnline.value) return
        viewModelScope.launch {
            _isLoading.update { true }
            dataSyncRepository.fetchMonitoringDetails(monitoringId).getOrElse { }
            _isLoading.update { false }
        }
    }
}
