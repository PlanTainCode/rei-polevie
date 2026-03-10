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
import ru.polevie.mobile.data.local.dao.MonitoringProbeDao
import ru.polevie.mobile.data.local.dao.PhotoDao
import ru.polevie.mobile.data.local.entity.MonitoringProbeEntity
import ru.polevie.mobile.data.repository.DataSyncRepository
import ru.polevie.mobile.util.NetworkMonitor
import javax.inject.Inject

data class MonitoringPointItem(
    val name: String,
    val probes: List<MonitoringProbeEntity>,
    val allCollected: Boolean,
    val anyCollected: Boolean,
    val typesLabel: String,
    val totalPhotos: Int,
) {
    val subtitle: String
        get() {
            var s = typesLabel
            if (totalPhotos > 0) s += " • $totalPhotos фото"
            if (anyCollected && !allCollected) s += " • частично отобрана"
            return s
        }
}

@HiltViewModel
class MonitoringPointsViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val monitoringProbeDao: MonitoringProbeDao,
    private val photoDao: PhotoDao,
    private val dataSyncRepository: DataSyncRepository,
    private val networkMonitor: NetworkMonitor,
) : ViewModel() {

    private val monitoringId: String = savedStateHandle.get<String>("monitoringId") ?: ""

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    val points: StateFlow<List<MonitoringPointItem>> = combine(
        monitoringProbeDao.getByMonitoring(monitoringId),
        photoDao.getByMonitoring(monitoringId),
        _isLoading,
    ) { probes, photos, isLoading ->
        if (isLoading) emptyList() else buildPointList(probes, photos)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList(),
    )

    private fun buildPointList(
        probes: List<MonitoringProbeEntity>,
        photos: List<ru.polevie.mobile.data.local.entity.PhotoEntity>,
    ): List<MonitoringPointItem> {
        val grouped = probes.groupBy { it.name }
        return grouped.map { (name, pointProbes) ->
            val allCollected = pointProbes.all { it.status == "COLLECTED" }
            val anyCollected = pointProbes.any { it.status == "COLLECTED" }
            val typesLabel = pointProbes
                .map { if (it.type == "WATER") "Вода" else "ДО" }
                .joinToString(" + ")
            val probeIds = pointProbes.map { it.id }.toSet()
            val totalPhotos = photos.count { it.probeId != null && it.probeId in probeIds }
            MonitoringPointItem(
                name = name,
                probes = pointProbes,
                allCollected = allCollected,
                anyCollected = anyCollected,
                typesLabel = typesLabel,
                totalPhotos = totalPhotos,
            )
        }.sortedBy { it.probes.minOfOrNull { p -> p.sortOrder } ?: Int.MAX_VALUE }
    }

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
