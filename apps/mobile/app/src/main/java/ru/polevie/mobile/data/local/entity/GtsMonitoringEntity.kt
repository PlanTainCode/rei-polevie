package ru.polevie.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "gts_monitorings")
data class GtsMonitoringEntity(
    @PrimaryKey val id: String,
    val name: String,
    val year: Int,
    val status: String,
    val districtsCount: Int = 0,
    val objectsCount: Int = 0,
    val photosCount: Int = 0,
    val lastSyncedAt: Long = 0L,
)
