package ru.polevie.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "photos",
    indices = [Index("projectId"), Index("monitoringId"), Index("probeId")],
)
data class PhotoEntity(
    @PrimaryKey val id: String,
    val projectId: String?,
    val monitoringId: String?,
    val probeId: String?,
    val filename: String,
    val originalName: String?,
    val thumbnailName: String?,
    val description: String?,
    val latitude: String?,
    val longitude: String?,
    val photoDate: String?,
    val sortOrder: Int,
    val localFilePath: String?,
    val isUploaded: Boolean = true,
)
