package ru.polevie.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import ru.polevie.mobile.data.local.entity.SyncQueueEntity

@Dao
interface SyncQueueDao {

    @Query("SELECT * FROM sync_queue WHERE status = 'PENDING' ORDER BY createdAt ASC")
    suspend fun getPending(): List<SyncQueueEntity>

    @Query("SELECT COUNT(*) FROM sync_queue WHERE status = 'PENDING'")
    fun getPendingCount(): Flow<Int>

    @Insert
    suspend fun insert(entry: SyncQueueEntity): Long

    @Query("UPDATE sync_queue SET status = 'COMPLETED' WHERE id = :id")
    suspend fun markCompleted(id: Long)

    @Query("UPDATE sync_queue SET status = 'FAILED', retryCount = retryCount + 1, lastError = :error WHERE id = :id")
    suspend fun markFailed(id: Long, error: String)

    @Query("UPDATE sync_queue SET status = 'PENDING' WHERE id = :id")
    suspend fun markPending(id: Long)

    @Query("DELETE FROM sync_queue WHERE status = 'COMPLETED'")
    suspend fun deleteCompleted()

    @Query("DELETE FROM sync_queue")
    suspend fun deleteAll()

    @Query("SELECT * FROM sync_queue WHERE status = 'FAILED' AND retryCount < 5 ORDER BY createdAt ASC")
    suspend fun getRetryable(): List<SyncQueueEntity>

    @Query("DELETE FROM sync_queue WHERE action = :action AND entityId = :entityId AND status = 'PENDING'")
    suspend fun deletePendingByActionAndEntity(action: String, entityId: String)
}
