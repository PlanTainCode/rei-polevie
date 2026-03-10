package ru.polevie.mobile.ui.modeselect

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.polevie.mobile.data.repository.DataSyncRepository
import ru.polevie.mobile.data.remote.TokenManager
import ru.polevie.mobile.data.local.dao.SyncQueueDao
import ru.polevie.mobile.util.NetworkMonitor
import javax.inject.Inject

@HiltViewModel
class ModeSelectViewModel @Inject constructor(
    private val dataSyncRepository: DataSyncRepository,
    private val tokenManager: TokenManager,
    private val syncQueueDao: SyncQueueDao,
    private val networkMonitor: NetworkMonitor,
) : ViewModel() {

    private val _isSyncing = MutableStateFlow(false)
    private val _lastSyncTime = MutableStateFlow<String?>(null)
    private val _syncError = MutableStateFlow<String?>(null)

    val userDisplayName: StateFlow<String> = tokenManager.userDisplayName
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "")

    val pendingSyncCount: StateFlow<Int> = syncQueueDao.getPendingCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val isSyncing: StateFlow<Boolean> = _isSyncing
    val lastSyncTime: StateFlow<String?> = _lastSyncTime
    val syncError: StateFlow<String?> = _syncError

    init {
        viewModelScope.launch {
            runInitialSync()
        }
    }

    private suspend fun runInitialSync() {
        _isSyncing.update { true }
        _syncError.update { null }
        dataSyncRepository.syncAll()
            .onSuccess {
                _lastSyncTime.update { dataSyncRepository.formatLastSyncTime(System.currentTimeMillis()) }
            }
            .onFailure { e ->
                _syncError.update { e.message ?: "Ошибка синхронизации" }
            }
        _isSyncing.update { false }
    }

    fun refreshSync() {
        if (!networkMonitor.isOnline.value) {
            _syncError.update { "Нет подключения к интернету" }
            return
        }
        viewModelScope.launch {
            runInitialSync()
        }
    }

    fun logout() {
        viewModelScope.launch {
            dataSyncRepository.logout()
        }
    }
}
