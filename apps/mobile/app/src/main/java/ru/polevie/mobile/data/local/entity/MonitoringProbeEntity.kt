package ru.polevie.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "monitoring_probes",
    foreignKeys = [
        ForeignKey(
            entity = MonitoringEntity::class,
            parentColumns = ["id"],
            childColumns = ["monitoringId"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("monitoringId")],
)
data class MonitoringProbeEntity(
    @PrimaryKey val id: String,
    val monitoringId: String,
    val name: String,
    val type: String,
    val latitude: String?,
    val longitude: String?,
    val status: String,
    val description: String?,
    val container: String?,
    val containerVolume: String?,
    val containerCount: Int,
    val depth: String?,
    val temperature: String?,
    val mass: String?,
    val note: String?,
    val sortOrder: Int,
)
