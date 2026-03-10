package ru.polevie.mobile.sync

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import ru.polevie.mobile.util.NetworkMonitor
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SyncManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val networkMonitor: NetworkMonitor,
) {
    init {
        networkMonitor.setOnNetworkAvailable {
            Log.d(TAG, "Network available — triggering immediate sync")
            triggerImmediate()
        }
    }

    fun schedulePeriodic() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
            .addTag(SyncWorker.TAG)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            SyncWorker.TAG,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    fun triggerImmediate() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .addTag("${SyncWorker.TAG}_immediate")
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "${SyncWorker.TAG}_immediate",
            ExistingWorkPolicy.KEEP,
            request,
        )
    }

    fun cancelAll() {
        WorkManager.getInstance(context).cancelAllWorkByTag(SyncWorker.TAG)
    }

    companion object {
        private const val TAG = "SyncManager"
    }
}
