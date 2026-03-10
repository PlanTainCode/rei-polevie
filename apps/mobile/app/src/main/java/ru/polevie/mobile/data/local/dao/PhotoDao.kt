package ru.polevie.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import ru.polevie.mobile.data.local.entity.PhotoEntity

@Dao
interface PhotoDao {

    @Query("SELECT * FROM photos WHERE projectId = :projectId ORDER BY sortOrder ASC")
    fun getByProject(projectId: String): Flow<List<PhotoEntity>>

    @Query("SELECT COUNT(*) FROM photos WHERE projectId = :projectId")
    fun getCountByProject(projectId: String): Flow<Int>

    @Query("SELECT COALESCE(MAX(sortOrder), -1) + 1 FROM photos WHERE projectId = :projectId")
    suspend fun getNextSortOrder(projectId: String): Int

    @Query("SELECT * FROM photos WHERE monitoringId = :monitoringId AND probeId IN (SELECT id FROM monitoring_probes WHERE name = :pointName) ORDER BY sortOrder ASC")
    fun getByMonitoringPoint(monitoringId: String, pointName: String): Flow<List<PhotoEntity>>

    @Query("SELECT * FROM photos WHERE monitoringId = :monitoringId ORDER BY sortOrder ASC")
    fun getByMonitoring(monitoringId: String): Flow<List<PhotoEntity>>

    @Query("SELECT * FROM photos WHERE id = :id")
    fun getById(id: String): Flow<PhotoEntity?>

    @Query("SELECT * FROM photos WHERE localFilePath = :path LIMIT 1")
    suspend fun getByLocalFilePath(path: String): PhotoEntity?

    @Query("DELETE FROM photos WHERE localFilePath = :path")
    suspend fun deleteByLocalFilePath(path: String): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(photos: List<PhotoEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(photo: PhotoEntity)

    @Query("UPDATE photos SET description = :description WHERE id = :id")
    suspend fun updateDescription(id: String, description: String)

    @Query("DELETE FROM photos WHERE projectId = :projectId AND isUploaded = 1")
    suspend fun deleteUploadedByProject(projectId: String)

    @Query("DELETE FROM photos WHERE projectId = :projectId")
    suspend fun deleteByProject(projectId: String)

    @Query("DELETE FROM photos WHERE monitoringId = :monitoringId AND isUploaded = 1")
    suspend fun deleteUploadedByMonitoring(monitoringId: String)

    @Query("DELETE FROM photos WHERE monitoringId = :monitoringId")
    suspend fun deleteByMonitoring(monitoringId: String)

    @Query("SELECT * FROM photos WHERE isUploaded = 1 AND localFilePath IS NULL")
    suspend fun getUncachedPhotos(): List<PhotoEntity>

    @Query("UPDATE photos SET localFilePath = :localPath WHERE id = :id")
    suspend fun updateLocalFilePath(id: String, localPath: String)

    @Query("DELETE FROM photos")
    suspend fun deleteAll()

    @Query("SELECT * FROM photos WHERE isUploaded = 0")
    suspend fun getPendingUploads(): List<PhotoEntity>
}
