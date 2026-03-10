package ru.polevie.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "platforms",
    foreignKeys = [
        ForeignKey(
            entity = ProjectEntity::class,
            parentColumns = ["id"],
            childColumns = ["projectId"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("projectId")],
)
data class PlatformEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val number: Int,
    val type: String,
    val label: String?,
    val latitude: String?,
    val longitude: String?,
    val description: String?,
    val samplesTotal: Int = 0,
    val samplesCollected: Int = 0,
)
