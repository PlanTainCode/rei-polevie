package ru.polevie.mobile.sync

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import ru.polevie.mobile.data.local.dao.SyncQueueDao

@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val syncQueueDao: SyncQueueDao,
    private val syncProcessor: SyncProcessor,
) : CoroutineWorker(context, params) {

    companion object {
        const val TAG = "polevie_sync"
        private const val TAG_LOG = "SyncWorker"
    }

    override suspend fun doWork(): Result {
        Log.d(TAG_LOG, "Starting sync...")

        val pending = syncQueueDao.getPending() + syncQueueDao.getRetryable()
        if (pending.isEmpty()) {
            Log.d(TAG_LOG, "Nothing to sync")
            return Result.success()
        }

        Log.d(TAG_LOG, "Syncing ${pending.size} items")
        val failures = syncProcessor.processAllPending()
        return if (failures > 0) Result.retry() else Result.success()
    }
}
