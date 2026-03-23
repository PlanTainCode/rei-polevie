package ru.polevie.mobile.data.remote.dto

data class GtsMonitoringDto(
    val id: String,
    val name: String,
    val year: Int,
    val status: String,
    val _count: GtsMonitoringCounts?,
)

data class GtsMonitoringCounts(
    val districts: Int,
    val objects: Int,
    val photos: Int,
)

data class GtsDistrictDto(
    val id: String,
    val gtsMonitoringId: String,
    val name: String,
    val numberRange: String?,
    val sortOrder: Int,
    val _count: GtsDistrictCounts?,
)

data class GtsDistrictCounts(
    val objects: Int,
)

data class GtsObjectDto(
    val id: String,
    val gtsMonitoringId: String,
    val gtsDistrictId: String,
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
    val hasTechnicalDoc: Boolean?,
    val district: GtsDistrictRef?,
    val elements: List<GtsElementDto>?,
    val _count: GtsObjectCounts?,
)

data class GtsDistrictRef(
    val id: String,
    val name: String,
)

data class GtsObjectCounts(
    val elements: Int,
    val photos: Int,
)

data class GtsElementDto(
    val id: String,
    val gtsObjectId: String,
    val name: String,
    val characteristics: String?,
    val technicalCondition: String?,
    val defects: String?,
    val recommendations: String?,
    val sortOrder: Int,
)

data class GtsPhotoDto(
    val id: String,
    val gtsObjectId: String,
    val gtsMonitoringId: String,
    val filename: String,
    val originalName: String?,
    val thumbnailName: String?,
    val description: String?,
    val latitude: String?,
    val longitude: String?,
    val photoDate: String?,
    val sortOrder: Int,
)

data class UpdateGtsObjectRequest(
    val inspectionDate: String? = null,
    val inspectorName: String? = null,
    val overallCondition: String? = null,
)

data class UpdateGtsElementRequest(
    val characteristics: String? = null,
    val technicalCondition: String? = null,
    val defects: String? = null,
    val recommendations: String? = null,
)
