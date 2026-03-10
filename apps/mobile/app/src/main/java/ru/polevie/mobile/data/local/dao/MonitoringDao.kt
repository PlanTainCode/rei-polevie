package ru.polevie.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import ru.polevie.mobile.data.local.entity.MonitoringEntity

@Dao
interface MonitoringDao {

    @Query("SELECT * FROM monitorings ORDER BY name ASC")
    fun getAll(): Flow<List<MonitoringEntity>>

    @Query("SELECT * FROM monitorings WHERE id = :id")
    fun getById(id: String): Flow<MonitoringEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(monitorings: List<MonitoringEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(monitoring: MonitoringEntity)

    @Query("DELETE FROM monitorings")
    suspend fun deleteAll()
}
