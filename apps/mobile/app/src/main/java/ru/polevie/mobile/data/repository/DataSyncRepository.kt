package ru.polevie.mobile.data.repository

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ru.polevie.mobile.data.local.dao.MonitoringDao
import ru.polevie.mobile.data.local.dao.MonitoringProbeDao
import ru.polevie.mobile.data.local.dao.PhotoDao
import ru.polevie.mobile.data.local.dao.PlatformDao
import ru.polevie.mobile.data.local.dao.ProjectDao
import ru.polevie.mobile.data.local.dao.SampleDao
import ru.polevie.mobile.data.local.dao.GtsElementDao
import ru.polevie.mobile.data.local.dao.GtsMonitoringDao
import ru.polevie.mobile.data.local.dao.GtsObjectDao
import ru.polevie.mobile.data.local.dao.SyncQueueDao
import ru.polevie.mobile.data.local.entity.GtsElementEntity
import ru.polevie.mobile.data.local.entity.GtsMonitoringEntity
import ru.polevie.mobile.data.local.entity.GtsObjectEntity
import ru.polevie.mobile.data.local.entity.MonitoringEntity
import ru.polevie.mobile.data.local.entity.MonitoringProbeEntity
import ru.polevie.mobile.data.local.entity.PhotoEntity
import ru.polevie.mobile.data.local.entity.PlatformEntity
import ru.polevie.mobile.data.local.entity.ProjectEntity
import ru.polevie.mobile.data.local.entity.SampleEntity
import ru.polevie.mobile.data.remote.ApiService
import ru.polevie.mobile.data.remote.TokenManager
import ru.polevie.mobile.data.remote.dto.MonitoringPhotoDto
import ru.polevie.mobile.data.remote.dto.MonitoringProbeDto
import ru.polevie.mobile.data.remote.dto.MonitoringDto
import ru.polevie.mobile.data.remote.dto.PhotoDto
import ru.polevie.mobile.data.remote.dto.PlatformDto
import ru.polevie.mobile.data.remote.dto.ProjectDto
import ru.polevie.mobile.data.remote.dto.SampleDto
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DataSyncRepository @Inject constructor(
    private val apiService: ApiService,
    private val tokenManager: TokenManager,
    private val projectDao: ProjectDao,
    private val platformDao: PlatformDao,
    private val sampleDao: SampleDao,
    private val monitoringDao: MonitoringDao,
    private val monitoringProbeDao: MonitoringProbeDao,
    private val photoDao: PhotoDao,
    private val syncQueueDao: SyncQueueDao,
    private val gtsMonitoringDao: GtsMonitoringDao,
    private val gtsObjectDao: GtsObjectDao,
    private val gtsElementDao: GtsElementDao,
    private val syncProcessor: ru.polevie.mobile.sync.SyncProcessor,
    private val photoCacheManager: PhotoCacheManager,
) {

    private val dateFormat = SimpleDateFormat("HH:mm", Locale.getDefault())

    suspend fun fetchAllProjects(): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val response = apiService.getProjects()
            if (!response.isSuccessful) throw Exception("Ошибка загрузки проектов: ${response.code()}")
            val list = response.body() ?: emptyList()
            val entities = list.map { mapProjectDto(it) }
            projectDao.insertAll(entities)
        }
    }

    suspend fun fetchAllMonitorings(): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val response = apiService.getMonitorings()
            if (!response.isSuccessful) throw Exception("Ошибка загрузки мониторингов: ${response.code()}")
            val list = response.body() ?: emptyList()
            val entities = list.map { mapMonitoringDto(it) }
            monitoringDao.insertAll(entities)
        }
    }

    suspend fun fetchProjectDetails(projectId: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val failures = syncProcessor.processAllPending()
            if (failures > 0) throw Exception("$failures операций не синхронизировано")
            fetchProjectDetailsInternal(projectId)
        }
    }

    suspend fun fetchMonitoringDetails(monitoringId: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val failures = syncProcessor.processAllPending()
            if (failures > 0) throw Exception("$failures операций не синхронизировано")
            fetchMonitoringDetailsInternal(monitoringId)
        }
    }

    private suspend fun fetchProjectDetailsInternal(projectId: String) {
        val projectRes = apiService.getProject(projectId)
        if (!projectRes.isSuccessful) throw Exception("Ошибка загрузки проекта: ${projectRes.code()}")
        val project = projectRes.body() ?: throw Exception("Проект не найден")

        val platformsRes = apiService.getPlatforms(projectId)
        val platforms = if (platformsRes.isSuccessful) platformsRes.body() ?: emptyList() else emptyList()
        val samplesRes = apiService.getSamples(projectId)
        val samples = if (samplesRes.isSuccessful) (samplesRes.body() ?: emptyList()).filter { it.platform != null } else emptyList()

        projectDao.insert(
            mapProjectDto(project, samplesCountOverride = samples.size, platformsCountOverride = platforms.size),
        )

        if (platforms.isNotEmpty()) {
            val entities = platforms.map { mapPlatformDto(it, projectId) }
            platformDao.insertAll(entities)
            platformDao.deleteNotIn(projectId, entities.map { it.id })
        }
        if (samples.isNotEmpty()) {
            val entities = samples.map { mapSampleDto(it, projectId) }
            sampleDao.insertAll(entities)
        }

        val photosRes = apiService.getProjectPhotos(projectId)
        if (photosRes.isSuccessful) {
            photoDao.deleteUploadedByProject(projectId)
            val photos = photosRes.body() ?: emptyList()
            val entities = photos.map { mapProjectPhotoDto(it, projectId) }
            photoDao.insertAll(entities)
        }
    }

    private suspend fun fetchMonitoringDetailsInternal(monitoringId: String) {
        val probesRes = apiService.getMonitoringProbes(monitoringId)
        if (probesRes.isSuccessful) {
            val probes = probesRes.body() ?: emptyList()
            val entities = probes.map { mapMonitoringProbeDto(it) }
            monitoringProbeDao.insertAll(entities)
            if (entities.isNotEmpty()) {
                monitoringProbeDao.deleteNotIn(monitoringId, entities.map { it.id })
            }
        }

        val photosRes = apiService.getMonitoringPhotos(monitoringId)
        if (photosRes.isSuccessful) {
            photoDao.deleteUploadedByMonitoring(monitoringId)
            val photos = photosRes.body() ?: emptyList()
            val entities = photos.map { mapMonitoringPhotoDto(it, monitoringId) }
            photoDao.insertAll(entities)
        }
    }

    suspend fun syncAll(): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val failures = syncProcessor.processAllPending()
            if (failures > 0) {
                throw Exception("$failures операций не удалось синхронизировать — пропускаем обновление данных")
            }

            val projectsRes = apiService.getProjects()
            if (projectsRes.isSuccessful) {
                val projects = projectsRes.body() ?: emptyList()
                projectDao.insertAll(projects.map { mapProjectDto(it) })
                projects.forEach { p ->
                    try { fetchProjectDetailsInternal(p.id) } catch (_: Exception) { }
                }
            }

            val monitoringsRes = apiService.getMonitorings()
            if (monitoringsRes.isSuccessful) {
                val monitorings = monitoringsRes.body() ?: emptyList()
                monitoringDao.insertAll(monitorings.map { mapMonitoringDto(it) })
                monitorings.forEach { m ->
                    try { fetchMonitoringDetailsInternal(m.id) } catch (_: Exception) { }
                }
            }

            val gtsRes = apiService.getGtsMonitorings()
            if (gtsRes.isSuccessful) {
                val gtsMonitorings = gtsRes.body() ?: emptyList()
                gtsMonitoringDao.insertAll(gtsMonitorings.map { mapGtsMonitoringDto(it) })
                gtsMonitorings.forEach { gm ->
                    try { fetchGtsMonitoringDetails(gm.id) } catch (_: Exception) { }
                }
            }

            try { photoCacheManager.cacheNewPhotos() } catch (_: Exception) { }
        }
    }

    // ============ GTS ============

    suspend fun fetchAllGtsMonitorings(): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val response = apiService.getGtsMonitorings()
            if (!response.isSuccessful) throw Exception("Ошибка загрузки ГТС мониторингов: ${response.code()}")
            val list = response.body() ?: emptyList()
            gtsMonitoringDao.insertAll(list.map { mapGtsMonitoringDto(it) })
        }
    }

    suspend fun fetchGtsMonitoringDetails(monitoringId: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val failures = syncProcessor.processAllPending()
            if (failures > 0) throw Exception("$failures операций не синхронизировано")

            val objectsRes = apiService.getGtsObjects(monitoringId)
            if (objectsRes.isSuccessful) {
                val objects = objectsRes.body() ?: emptyList()
                val entities = objects.map { mapGtsObjectDto(it) }
                gtsObjectDao.insertAll(entities)

                for (obj in objects) {
                    if (!obj.elements.isNullOrEmpty()) {
                        val elements = obj.elements.map { mapGtsElementDto(it) }
                        gtsElementDao.insertAll(elements)
                    }
                }
            }
        }
    }

    private fun mapGtsMonitoringDto(dto: ru.polevie.mobile.data.remote.dto.GtsMonitoringDto): GtsMonitoringEntity =
        GtsMonitoringEntity(
            id = dto.id,
            name = dto.name,
            year = dto.year,
            status = dto.status,
            districtsCount = dto._count?.districts ?: 0,
            objectsCount = dto._count?.objects ?: 0,
            photosCount = dto._count?.photos ?: 0,
            lastSyncedAt = System.currentTimeMillis(),
        )

    private fun mapGtsObjectDto(dto: ru.polevie.mobile.data.remote.dto.GtsObjectDto): GtsObjectEntity =
        GtsObjectEntity(
            id = dto.id,
            gtsMonitoringId = dto.gtsMonitoringId,
            gtsDistrictId = dto.gtsDistrictId,
            districtName = dto.district?.name ?: "",
            number = dto.number,
            watercourseName = dto.watercourseName,
            settlement = dto.settlement,
            yearBuilt = dto.yearBuilt,
            volume = dto.volume,
            area = dto.area,
            safetyLevel = dto.safetyLevel,
            ownerName = dto.ownerName,
            latitude = dto.latitude,
            longitude = dto.longitude,
            inspectionDate = dto.inspectionDate,
            inspectorName = dto.inspectorName,
            overallCondition = dto.overallCondition,
            elementsCount = dto._count?.elements ?: 0,
            photosCount = dto._count?.photos ?: 0,
        )

    private fun mapGtsElementDto(dto: ru.polevie.mobile.data.remote.dto.GtsElementDto): GtsElementEntity =
        GtsElementEntity(
            id = dto.id,
            gtsObjectId = dto.gtsObjectId,
            name = dto.name,
            characteristics = dto.characteristics,
            technicalCondition = dto.technicalCondition,
            defects = dto.defects,
            recommendations = dto.recommendations,
            sortOrder = dto.sortOrder,
        )

    suspend fun logout() = withContext(Dispatchers.IO) {
        tokenManager.clear()
        syncQueueDao.deleteAll()
        photoDao.deleteAll()
        projectDao.deleteAll()
        monitoringDao.deleteAll()
        gtsMonitoringDao.deleteAll()
        gtsObjectDao.deleteAll()
        gtsElementDao.deleteAll()
    }

    private fun mapProjectDto(
        dto: ProjectDto,
        samplesCountOverride: Int? = null,
        platformsCountOverride: Int? = null,
    ): ProjectEntity {
        val createdAtMs = dto.createdAt?.let { str ->
            try {
                java.time.Instant.parse(str).toEpochMilli()
            } catch (_: Exception) {
                0L
            }
        } ?: 0L
        return ProjectEntity(
            id = dto.id,
            name = dto.name,
            objectName = dto.objectName,
            objectAddress = dto.objectAddress,
            status = dto.status,
            samplesCount = samplesCountOverride ?: dto._count?.samples ?: 0,
            platformsCount = platformsCountOverride ?: dto._count?.platforms ?: 0,
            lastSyncedAt = System.currentTimeMillis(),
            createdAt = createdAtMs,
        )
    }

    private fun mapPlatformDto(dto: PlatformDto, projectId: String): PlatformEntity = PlatformEntity(
        id = dto.id,
        projectId = projectId,
        number = dto.number,
        type = dto.type,
        label = dto.label,
        latitude = dto.latitude,
        longitude = dto.longitude,
        description = dto.description,
        samplesTotal = dto._count?.samples ?: dto.samples?.size ?: 0,
        samplesCollected = dto.samples?.count { it.status == "COLLECTED" } ?: 0,
    )

    private fun mapSampleDto(dto: SampleDto, projectId: String): SampleEntity = SampleEntity(
        id = dto.id,
        projectId = projectId,
        platformId = dto.platform!!.id,
        cipher = dto.cipher,
        depthLabel = dto.depthLabel,
        mass = dto.mass,
        description = dto.description,
        status = dto.status,
        latitude = dto.latitude,
        longitude = dto.longitude,
    )

    private fun mapMonitoringDto(dto: MonitoringDto): MonitoringEntity = MonitoringEntity(
        id = dto.id,
        name = dto.name,
        objectName = dto.objectName,
        objectAddress = dto.objectAddress,
        status = dto.status,
        probesCount = dto._count?.probes ?: 0,
        photosCount = dto._count?.photos ?: 0,
        lastSyncedAt = System.currentTimeMillis(),
    )

    private fun mapMonitoringProbeDto(dto: MonitoringProbeDto): MonitoringProbeEntity = MonitoringProbeEntity(
        id = dto.id,
        monitoringId = dto.monitoringId,
        name = dto.name,
        type = dto.type,
        latitude = dto.latitude,
        longitude = dto.longitude,
        status = dto.status,
        description = dto.description,
        container = dto.container,
        containerVolume = dto.containerVolume,
        containerCount = dto.containerCount,
        depth = dto.depth,
        temperature = dto.temperature,
        mass = dto.mass,
        note = dto.note,
        sortOrder = dto.sortOrder,
    )

    private fun mapProjectPhotoDto(dto: PhotoDto, projectId: String): PhotoEntity =
        PhotoEntity(
            id = dto.id,
            projectId = projectId,
            monitoringId = null,
            probeId = null,
            filename = dto.filename,
            originalName = dto.originalName,
            thumbnailName = dto.thumbnailName,
            description = dto.description,
            latitude = dto.latitude,
            longitude = dto.longitude,
            photoDate = dto.photoDate,
            sortOrder = dto.sortOrder,
            localFilePath = null,
            isUploaded = true,
        )

    private fun mapMonitoringPhotoDto(dto: MonitoringPhotoDto, monitoringId: String): PhotoEntity = PhotoEntity(
        id = dto.id,
        projectId = null,
        monitoringId = monitoringId,
        probeId = dto.probeId,
        filename = dto.filename,
        originalName = dto.originalName,
        thumbnailName = dto.thumbnailName,
        description = dto.description,
        latitude = dto.latitude,
        longitude = dto.longitude,
        photoDate = dto.photoDate,
        sortOrder = dto.sortOrder,
        localFilePath = null,
        isUploaded = true,
    )

    fun formatLastSyncTime(timestamp: Long): String = dateFormat.format(Date(timestamp))
}
