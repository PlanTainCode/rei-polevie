package ru.polevie.mobile.data.remote.dto

data class ProjectDto(
    val id: String,
    val name: String,
    val objectName: String?,
    val objectAddress: String?,
    val status: String,
    val _count: ProjectCounts?,
    val createdAt: String? = null,
)

data class ProjectCounts(
    val samples: Int,
    val platforms: Int,
)

data class PlatformDto(
    val id: String,
    val projectId: String,
    val number: Int,
    val type: String,
    val label: String?,
    val latitude: String?,
    val longitude: String?,
    val description: String?,
    val _count: PlatformCounts?,
    val samples: List<SampleDto>?,
)

data class PlatformCounts(
    val samples: Int,
)

data class SampleDto(
    val id: String,
    val cipher: String,
    val depthLabel: String?,
    val mass: String?,
    val description: String?,
    val status: String,
    val latitude: String?,
    val longitude: String?,
    val platform: SamplePlatformRef?,
)

data class SamplePlatformRef(
    val id: String,
    val number: Int,
    val type: String,
    val label: String?,
)

data class PhotoUploadResultDto(
    val success: Boolean,
    val photo: PhotoDto? = null,
    val error: String? = null,
    val filename: String? = null,
)

data class PhotoDto(
    val id: String,
    val filename: String,
    val originalName: String?,
    val thumbnailName: String?,
    val description: String?,
    val latitude: String?,
    val longitude: String?,
    val photoDate: String?,
    val sortOrder: Int,
)

data class UpdateSampleRequest(
    val description: String? = null,
    val latitude: String? = null,
    val longitude: String? = null,
)

data class UpdateCoordinatesRequest(
    val latitude: String? = null,
    val longitude: String? = null,
)

data class UpdateDescriptionRequest(
    val description: String,
)

data class UpdatePhotoRequest(
    val description: String? = null,
)
