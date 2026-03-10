package ru.polevie.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "projects")
data class ProjectEntity(
    @PrimaryKey val id: String,
    val name: String,
    val objectName: String?,
    val objectAddress: String?,
    val status: String,
    val samplesCount: Int = 0,
    val platformsCount: Int = 0,
    val lastSyncedAt: Long = 0L,
    val createdAt: Long = 0L,
)
