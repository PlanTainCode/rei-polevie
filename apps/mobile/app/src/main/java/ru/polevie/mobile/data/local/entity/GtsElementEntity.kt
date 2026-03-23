package ru.polevie.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "gts_elements",
    foreignKeys = [
        ForeignKey(
            entity = GtsObjectEntity::class,
            parentColumns = ["id"],
            childColumns = ["gtsObjectId"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("gtsObjectId")],
)
data class GtsElementEntity(
    @PrimaryKey val id: String,
    val gtsObjectId: String,
    val name: String,
    val characteristics: String?,
    val technicalCondition: String?,
    val defects: String?,
    val recommendations: String?,
    val sortOrder: Int,
)
