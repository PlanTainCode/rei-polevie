package ru.polevie.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import ru.polevie.mobile.data.local.entity.GtsObjectEntity

@Dao
interface GtsObjectDao {

    @Query("SELECT * FROM gts_objects WHERE gtsMonitoringId = :monitoringId ORDER BY number ASC")
    fun getByMonitoring(monitoringId: String): Flow<List<GtsObjectEntity>>

    @Query("SELECT * FROM gts_objects WHERE gtsDistrictId = :districtId ORDER BY number ASC")
    fun getByDistrict(districtId: String): Flow<List<GtsObjectEntity>>

    @Query("SELECT * FROM gts_objects WHERE id = :id")
    fun getById(id: String): Flow<GtsObjectEntity?>

    @Query("SELECT DISTINCT districtName, gtsDistrictId FROM gts_objects WHERE gtsMonitoringId = :monitoringId ORDER BY districtName ASC")
    fun getDistrictNames(monitoringId: String): Flow<List<GtsDistrictInfo>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<GtsObjectEntity>)

    @Query("DELETE FROM gts_objects WHERE gtsMonitoringId = :monitoringId")
    suspend fun deleteByMonitoring(monitoringId: String)

    @Query("DELETE FROM gts_objects")
    suspend fun deleteAll()
}

data class GtsDistrictInfo(
    val districtName: String,
    val gtsDistrictId: String,
)
