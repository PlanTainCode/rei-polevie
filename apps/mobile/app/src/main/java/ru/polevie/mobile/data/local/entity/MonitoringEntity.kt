package ru.polevie.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "monitorings")
data class MonitoringEntity(
    @PrimaryKey val id: String,
    val name: String,
    val objectName: String?,
    val objectAddress: String?,
    val status: String,
    val probesCount: Int = 0,
    val photosCount: Int = 0,
    val lastSyncedAt: Long = 0L,
)
