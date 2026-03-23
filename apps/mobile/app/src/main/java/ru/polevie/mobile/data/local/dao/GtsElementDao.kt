package ru.polevie.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow
import ru.polevie.mobile.data.local.entity.GtsElementEntity

@Dao
interface GtsElementDao {

    @Query("SELECT * FROM gts_elements WHERE gtsObjectId = :objectId ORDER BY sortOrder ASC")
    fun getByObject(objectId: String): Flow<List<GtsElementEntity>>

    @Query("SELECT * FROM gts_elements WHERE id = :id")
    suspend fun getById(id: String): GtsElementEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<GtsElementEntity>)

    @Query("UPDATE gts_elements SET defects = :defects WHERE id = :id")
    suspend fun updateDefects(id: String, defects: String?)

    @Query("UPDATE gts_elements SET recommendations = :recommendations WHERE id = :id")
    suspend fun updateRecommendations(id: String, recommendations: String?)

    @Query("UPDATE gts_elements SET characteristics = :characteristics WHERE id = :id")
    suspend fun updateCharacteristics(id: String, characteristics: String?)

    @Query("UPDATE gts_elements SET technicalCondition = :technicalCondition WHERE id = :id")
    suspend fun updateTechnicalCondition(id: String, technicalCondition: String?)

    @Query("DELETE FROM gts_elements WHERE gtsObjectId = :objectId")
    suspend fun deleteByObject(objectId: String)

    @Query("DELETE FROM gts_elements")
    suspend fun deleteAll()
}
