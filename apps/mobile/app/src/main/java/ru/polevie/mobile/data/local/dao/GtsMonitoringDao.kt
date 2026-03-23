package ru.polevie.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import ru.polevie.mobile.data.local.entity.GtsMonitoringEntity

@Dao
interface GtsMonitoringDao {

    @Query("SELECT * FROM gts_monitorings ORDER BY name ASC")
    fun getAll(): Flow<List<GtsMonitoringEntity>>

    @Query("SELECT * FROM gts_monitorings WHERE id = :id")
    fun getById(id: String): Flow<GtsMonitoringEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<GtsMonitoringEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: GtsMonitoringEntity)

    @Query("DELETE FROM gts_monitorings")
    suspend fun deleteAll()
}
