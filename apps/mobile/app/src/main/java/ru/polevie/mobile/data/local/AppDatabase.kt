package ru.polevie.mobile.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import ru.polevie.mobile.data.local.dao.GtsElementDao
import ru.polevie.mobile.data.local.dao.GtsMonitoringDao
import ru.polevie.mobile.data.local.dao.GtsObjectDao
import ru.polevie.mobile.data.local.dao.MonitoringDao
import ru.polevie.mobile.data.local.dao.MonitoringProbeDao
import ru.polevie.mobile.data.local.dao.PhotoDao
import ru.polevie.mobile.data.local.dao.PlatformDao
import ru.polevie.mobile.data.local.dao.ProjectDao
import ru.polevie.mobile.data.local.dao.SampleDao
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
import ru.polevie.mobile.data.local.entity.SyncQueueEntity

@Database(
    entities = [
        ProjectEntity::class,
        PlatformEntity::class,
        SampleEntity::class,
        MonitoringEntity::class,
        MonitoringProbeEntity::class,
        PhotoEntity::class,
        SyncQueueEntity::class,
        GtsMonitoringEntity::class,
        GtsObjectEntity::class,
        GtsElementEntity::class,
    ],
    version = 3,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun projectDao(): ProjectDao
    abstract fun platformDao(): PlatformDao
    abstract fun sampleDao(): SampleDao
    abstract fun monitoringDao(): MonitoringDao
    abstract fun monitoringProbeDao(): MonitoringProbeDao
    abstract fun photoDao(): PhotoDao
    abstract fun syncQueueDao(): SyncQueueDao
    abstract fun gtsMonitoringDao(): GtsMonitoringDao
    abstract fun gtsObjectDao(): GtsObjectDao
    abstract fun gtsElementDao(): GtsElementDao
}
