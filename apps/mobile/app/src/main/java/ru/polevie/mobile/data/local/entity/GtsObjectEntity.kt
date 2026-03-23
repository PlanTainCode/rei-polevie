package ru.polevie.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "gts_objects",
    foreignKeys = [
        ForeignKey(
            entity = GtsMonitoringEntity::class,
            parentColumns = ["id"],
            childColumns = ["gtsMonitoringId"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("gtsMonitoringId"), Index("gtsDistrictId")],
)
data class GtsObjectEntity(
    @PrimaryKey val id: String,
    val gtsMonitoringId: String,
    val gtsDistrictId: String,
    val districtName: String,
    val number: Int,
    val watercourseName: String,
    val settlement: String,
    val yearBuilt: Int?,
    val volume: String?,
    val area: String?,
    val safetyLevel: String?,
    val ownerName: String?,
    val latitude: String?,
    val longitude: String?,
    val inspectionDate: String?,
    val inspectorName: String?,
    val overallCondition: String?,
    val elementsCount: Int = 0,
    val photosCount: Int = 0,
)
