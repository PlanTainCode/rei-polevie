package ru.polevie.mobile.data.remote.dto

data class MonitoringDto(
    val id: String,
    val name: String,
    val objectName: String?,
    val objectAddress: String?,
    val status: String,
    val _count: MonitoringCounts?,
)

data class MonitoringCounts(
    val probes: Int,
    val photos: Int,
)

data class MonitoringProbeDto(
    val id: String,
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
    val _count: ProbeCounts?,
)

data class ProbeCounts(
    val photos: Int,
)

data class MonitoringPhotoDto(
    val id: String,
    val monitoringId: String,
    val probeId: String,
    val filename: String,
    val originalName: String?,
    val thumbnailName: String?,
    val description: String?,
    val latitude: String?,
    val longitude: String?,
    val photoDate: String?,
    val sortOrder: Int,
)

data class MonitoringPhotoUploadResultDto(
    val success: Boolean,
    val photo: MonitoringPhotoDto?,
    val error: String? = null,
    val filename: String? = null,
)

data class UpdateProbeRequest(
    val description: String? = null,
    val containerVolume: String? = null,
    val containerCount: Int? = null,
    val depth: String? = null,
    val temperature: String? = null,
    val mass: String? = null,
    val note: String? = null,
    val latitude: String? = null,
    val longitude: String? = null,
)
