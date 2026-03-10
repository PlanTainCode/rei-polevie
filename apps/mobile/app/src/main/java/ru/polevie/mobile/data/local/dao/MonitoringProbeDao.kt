package ru.polevie.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import ru.polevie.mobile.data.local.entity.MonitoringProbeEntity

@Dao
interface MonitoringProbeDao {

    @Query("SELECT * FROM monitoring_probes WHERE monitoringId = :monitoringId ORDER BY sortOrder ASC")
    fun getByMonitoring(monitoringId: String): Flow<List<MonitoringProbeEntity>>

    @Query("SELECT * FROM monitoring_probes WHERE id = :id")
    fun getById(id: String): Flow<MonitoringProbeEntity?>

    @Query("SELECT * FROM monitoring_probes WHERE id = :id")
    suspend fun getByIdSync(id: String): MonitoringProbeEntity?

    @Query("SELECT DISTINCT name FROM monitoring_probes WHERE monitoringId = :monitoringId ORDER BY name ASC")
    fun getPointNames(monitoringId: String): Flow<List<String>>

    @Query("SELECT * FROM monitoring_probes WHERE monitoringId = :monitoringId AND name = :pointName ORDER BY sortOrder ASC")
    fun getByPoint(monitoringId: String, pointName: String): Flow<List<MonitoringProbeEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(probes: List<MonitoringProbeEntity>)

    @Query("UPDATE monitoring_probes SET status = :status WHERE id = :id")
    suspend fun updateStatus(id: String, status: String)

    @Query("""
        UPDATE monitoring_probes SET 
            description = COALESCE(:description, description),
            containerVolume = COALESCE(:containerVolume, containerVolume),
            containerCount = COALESCE(:containerCount, containerCount),
            depth = COALESCE(:depth, depth),
            temperature = COALESCE(:temperature, temperature),
            mass = COALESCE(:mass, mass),
            note = COALESCE(:note, note),
            latitude = COALESCE(:latitude, latitude),
            longitude = COALESCE(:longitude, longitude)
        WHERE id = :id
    """)
    suspend fun updateProbeFields(
        id: String,
        description: String? = null,
        containerVolume: String? = null,
        containerCount: Int? = null,
        depth: String? = null,
        temperature: String? = null,
        mass: String? = null,
        note: String? = null,
        latitude: String? = null,
        longitude: String? = null,
    )

    @Query("DELETE FROM monitoring_probes WHERE monitoringId = :monitoringId")
    suspend fun deleteByMonitoring(monitoringId: String)

    @Query("DELETE FROM monitoring_probes WHERE monitoringId = :monitoringId AND id NOT IN (:keepIds)")
    suspend fun deleteNotIn(monitoringId: String, keepIds: List<String>)
}
