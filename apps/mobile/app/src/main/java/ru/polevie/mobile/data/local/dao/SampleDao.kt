package ru.polevie.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import ru.polevie.mobile.data.local.entity.SampleEntity

@Dao
interface SampleDao {

    @Query("SELECT * FROM samples WHERE platformId = :platformId ORDER BY cipher ASC")
    fun getByPlatform(platformId: String): Flow<List<SampleEntity>>

    @Query("SELECT * FROM samples WHERE projectId = :projectId ORDER BY cipher ASC")
    fun getByProject(projectId: String): Flow<List<SampleEntity>>

    @Query("SELECT * FROM samples WHERE id = :id")
    fun getById(id: String): Flow<SampleEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(samples: List<SampleEntity>)

    @Query("UPDATE samples SET status = :status WHERE id = :id")
    suspend fun updateStatus(id: String, status: String)

    @Query("UPDATE samples SET description = :description WHERE id = :id")
    suspend fun updateDescription(id: String, description: String)

    @Query("UPDATE samples SET status = 'COLLECTED' WHERE platformId = :platformId")
    suspend fun collectAllByPlatform(platformId: String)

    @Query("UPDATE samples SET latitude = :lat, longitude = :lon WHERE platformId = :platformId")
    suspend fun updateCoordinatesByPlatform(platformId: String, lat: String, lon: String)

    @Query("SELECT COUNT(*) FROM samples WHERE projectId = :projectId AND status = 'COLLECTED'")
    fun getCollectedCount(projectId: String): Flow<Int>

    @Query("SELECT COUNT(*) FROM samples WHERE projectId = :projectId")
    fun getTotalCount(projectId: String): Flow<Int>

    @Query("DELETE FROM samples WHERE projectId = :projectId")
    suspend fun deleteByProject(projectId: String)
}
