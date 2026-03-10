package ru.polevie.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow
import ru.polevie.mobile.data.local.entity.PlatformEntity

@Dao
interface PlatformDao {

    @Query("SELECT * FROM platforms WHERE projectId = :projectId ORDER BY number ASC")
    fun getByProject(projectId: String): Flow<List<PlatformEntity>>

    @Query("SELECT COUNT(*) FROM platforms WHERE projectId = :projectId")
    fun getCountByProject(projectId: String): Flow<Int>

    @Query("SELECT * FROM platforms WHERE id = :id")
    fun getById(id: String): Flow<PlatformEntity?>

    @Query("SELECT * FROM platforms WHERE projectId = :projectId AND type = :type AND number = :number LIMIT 1")
    suspend fun getByProjectTypeNumber(projectId: String, type: String, number: Int): PlatformEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(platforms: List<PlatformEntity>)

    @Update
    suspend fun update(platform: PlatformEntity)

    @Query("UPDATE platforms SET latitude = :lat, longitude = :lon WHERE id = :id")
    suspend fun updateCoordinates(id: String, lat: String, lon: String)

    @Query("UPDATE platforms SET description = :description WHERE id = :id")
    suspend fun updateDescription(id: String, description: String)

    @Query("DELETE FROM platforms WHERE projectId = :projectId")
    suspend fun deleteByProject(projectId: String)

    @Query("DELETE FROM platforms WHERE projectId = :projectId AND id NOT IN (:keepIds)")
    suspend fun deleteNotIn(projectId: String, keepIds: List<String>)
}
