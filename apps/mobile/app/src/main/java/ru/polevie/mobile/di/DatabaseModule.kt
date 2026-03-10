package ru.polevie.mobile.di

import android.content.Context
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import ru.polevie.mobile.data.local.AppDatabase
import ru.polevie.mobile.data.local.dao.MonitoringDao
import ru.polevie.mobile.data.local.dao.MonitoringProbeDao
import ru.polevie.mobile.data.local.dao.PhotoDao
import ru.polevie.mobile.data.local.dao.PlatformDao
import ru.polevie.mobile.data.local.dao.ProjectDao
import ru.polevie.mobile.data.local.dao.SampleDao
import ru.polevie.mobile.data.local.dao.SyncQueueDao
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "polevie.db",
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides fun provideProjectDao(db: AppDatabase): ProjectDao = db.projectDao()
    @Provides fun providePlatformDao(db: AppDatabase): PlatformDao = db.platformDao()
    @Provides fun provideSampleDao(db: AppDatabase): SampleDao = db.sampleDao()
    @Provides fun provideMonitoringDao(db: AppDatabase): MonitoringDao = db.monitoringDao()
    @Provides fun provideMonitoringProbeDao(db: AppDatabase): MonitoringProbeDao = db.monitoringProbeDao()
    @Provides fun providePhotoDao(db: AppDatabase): PhotoDao = db.photoDao()
    @Provides fun provideSyncQueueDao(db: AppDatabase): SyncQueueDao = db.syncQueueDao()
}
