package ru.polevie.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "samples",
    foreignKeys = [
        ForeignKey(
            entity = PlatformEntity::class,
            parentColumns = ["id"],
            childColumns = ["platformId"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("platformId"), Index("projectId")],
)
data class SampleEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val platformId: String,
    val cipher: String,
    val depthLabel: String?,
    val mass: String?,
    val description: String?,
    val status: String,
    val latitude: String?,
    val longitude: String?,
)
