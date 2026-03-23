package ru.polevie.mobile.ui.gts

import androidx.lifecycle.SavedStateHandle
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
import ru.polevie.mobile.data.local.dao.GtsElementDao
import ru.polevie.mobile.data.local.dao.GtsMonitoringDao
import ru.polevie.mobile.data.local.dao.GtsObjectDao
import ru.polevie.mobile.data.local.dao.GtsDistrictInfo
import ru.polevie.mobile.data.local.entity.GtsElementEntity
import ru.polevie.mobile.data.local.entity.GtsMonitoringEntity
import ru.polevie.mobile.data.local.entity.GtsObjectEntity
import ru.polevie.mobile.data.repository.DataSyncRepository
import ru.polevie.mobile.util.NetworkMonitor
import javax.inject.Inject

@HiltViewModel
class GtsMonitoringListViewModel @Inject constructor(
    private val gtsMonitoringDao: GtsMonitoringDao,
    private val dataSyncRepository: DataSyncRepository,
    val networkMonitor: NetworkMonitor,
) : ViewModel() {

    val monitorings: StateFlow<List<GtsMonitoringEntity>> = gtsMonitoringDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun refresh() {
        if (!networkMonitor.isOnline.value) return
        viewModelScope.launch {
            _isLoading.update { true }
            dataSyncRepository.fetchAllGtsMonitorings().getOrElse { }
            _isLoading.update { false }
        }
    }
}

@HiltViewModel
class GtsDistrictListViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val gtsObjectDao: GtsObjectDao,
    private val dataSyncRepository: DataSyncRepository,
    val networkMonitor: NetworkMonitor,
) : ViewModel() {

    private val gtsMonitoringId: String = savedStateHandle["gtsMonitoringId"]!!

    val districts: StateFlow<List<GtsDistrictInfo>> = gtsObjectDao.getDistrictNames(gtsMonitoringId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun refresh() {
        if (!networkMonitor.isOnline.value) return
        viewModelScope.launch {
            _isLoading.update { true }
            dataSyncRepository.fetchGtsMonitoringDetails(gtsMonitoringId).getOrElse { }
            _isLoading.update { false }
        }
    }
}

@HiltViewModel
class GtsObjectListViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val gtsObjectDao: GtsObjectDao,
) : ViewModel() {

    private val districtId: String = savedStateHandle["districtId"]!!

    val objects: StateFlow<List<GtsObjectEntity>> = gtsObjectDao.getByDistrict(districtId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
}

@HiltViewModel
class GtsObjectDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val gtsObjectDao: GtsObjectDao,
    private val gtsElementDao: GtsElementDao,
) : ViewModel() {

    private val objectId: String = savedStateHandle["objectId"]!!

    val gtsObject: StateFlow<GtsObjectEntity?> = gtsObjectDao.getById(objectId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val elements: StateFlow<List<GtsElementEntity>> = gtsElementDao.getByObject(objectId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
}
