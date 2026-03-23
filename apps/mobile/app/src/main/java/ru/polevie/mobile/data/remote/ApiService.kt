package ru.polevie.mobile.data.remote

import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import ru.polevie.mobile.data.remote.dto.*

interface ApiService {

    // ============ PROJECTS ============

    @GET("projects")
    suspend fun getProjects(): Response<List<ProjectDto>>

    @GET("projects/{id}")
    suspend fun getProject(@Path("id") id: String): Response<ProjectDto>

    @GET("projects/{id}/platforms")
    suspend fun getPlatforms(@Path("id") projectId: String): Response<List<PlatformDto>>

    @GET("projects/{id}/samples")
    suspend fun getSamples(@Path("id") projectId: String): Response<List<SampleDto>>

    @GET("projects/{id}/photos")
    suspend fun getProjectPhotos(@Path("id") projectId: String): Response<List<PhotoDto>>

    @PATCH("projects/{projectId}/platforms/{platformId}/coordinates")
    suspend fun updatePlatformCoordinates(
        @Path("projectId") projectId: String,
        @Path("platformId") platformId: String,
        @Body request: UpdateCoordinatesRequest,
    ): Response<Unit>

    @POST("projects/{projectId}/platforms/{platformId}/collect")
    suspend fun collectPlatformSamples(
        @Path("projectId") projectId: String,
        @Path("platformId") platformId: String,
    ): Response<Unit>

    @PATCH("projects/{projectId}/platforms/{platformId}/description")
    suspend fun setPlatformDescription(
        @Path("projectId") projectId: String,
        @Path("platformId") platformId: String,
        @Body request: UpdateDescriptionRequest,
    ): Response<Unit>

    @PATCH("projects/{projectId}/samples/{sampleId}")
    suspend fun updateSample(
        @Path("projectId") projectId: String,
        @Path("sampleId") sampleId: String,
        @Body request: UpdateSampleRequest,
    ): Response<Unit>

    @POST("projects/{projectId}/samples/{sampleId}/collect")
    suspend fun collectSample(
        @Path("projectId") projectId: String,
        @Path("sampleId") sampleId: String,
    ): Response<Unit>

    @Multipart
    @POST("projects/{id}/photos")
    suspend fun uploadProjectPhotos(
        @Path("id") projectId: String,
        @Part photos: List<MultipartBody.Part>,
    ): Response<List<PhotoUploadResultDto>>

    @PATCH("projects/{projectId}/photos/{photoId}")
    suspend fun updateProjectPhoto(
        @Path("projectId") projectId: String,
        @Path("photoId") photoId: String,
        @Body request: UpdatePhotoRequest,
    ): Response<Unit>

    @Multipart
    @POST("projects/{projectId}/photos/{photoId}/voice-description")
    suspend fun voiceDescribeProjectPhoto(
        @Path("projectId") projectId: String,
        @Path("photoId") photoId: String,
        @Part audio: MultipartBody.Part,
    ): Response<Unit>

    // ============ MONITORINGS ============

    @GET("monitorings")
    suspend fun getMonitorings(): Response<List<MonitoringDto>>

    @GET("monitorings/{id}")
    suspend fun getMonitoring(@Path("id") id: String): Response<MonitoringDto>

    @GET("monitorings/{id}/probes")
    suspend fun getMonitoringProbes(@Path("id") monitoringId: String): Response<List<MonitoringProbeDto>>

    @GET("monitorings/{id}/photos")
    suspend fun getMonitoringPhotos(@Path("id") monitoringId: String): Response<List<MonitoringPhotoDto>>

    @GET("monitorings/{id}/points/{pointName}/photos")
    suspend fun getMonitoringPointPhotos(
        @Path("id") monitoringId: String,
        @Path("pointName") pointName: String,
    ): Response<List<MonitoringPhotoDto>>

    @PATCH("monitorings/{monitoringId}/probes/{probeId}")
    suspend fun updateMonitoringProbe(
        @Path("monitoringId") monitoringId: String,
        @Path("probeId") probeId: String,
        @Body request: UpdateProbeRequest,
    ): Response<Unit>

    @POST("monitorings/{monitoringId}/probes/{probeId}/collect")
    suspend fun collectMonitoringProbe(
        @Path("monitoringId") monitoringId: String,
        @Path("probeId") probeId: String,
    ): Response<Unit>

    @Multipart
    @POST("monitorings/{monitoringId}/probes/{probeId}/photos")
    suspend fun uploadMonitoringPhoto(
        @Path("monitoringId") monitoringId: String,
        @Path("probeId") probeId: String,
        @Part photos: MultipartBody.Part,
        @Part("latitude") latitude: RequestBody?,
        @Part("longitude") longitude: RequestBody?,
    ): Response<List<ru.polevie.mobile.data.remote.dto.MonitoringPhotoUploadResultDto>>

    @PATCH("monitorings/{monitoringId}/photos/{photoId}")
    suspend fun updateMonitoringPhoto(
        @Path("monitoringId") monitoringId: String,
        @Path("photoId") photoId: String,
        @Body request: UpdatePhotoRequest,
    ): Response<Unit>

    @Multipart
    @POST("monitorings/{monitoringId}/photos/{photoId}/voice-description")
    suspend fun voiceDescribeMonitoringPhoto(
        @Path("monitoringId") monitoringId: String,
        @Path("photoId") photoId: String,
        @Part audio: MultipartBody.Part,
    ): Response<Unit>

    // ============ GTS MONITORINGS ============

    @GET("gts-monitorings")
    suspend fun getGtsMonitorings(): Response<List<GtsMonitoringDto>>

    @GET("gts-monitorings/{id}")
    suspend fun getGtsMonitoring(@Path("id") id: String): Response<GtsMonitoringDto>

    @GET("gts-monitorings/{id}/districts")
    suspend fun getGtsDistricts(@Path("id") monitoringId: String): Response<List<GtsDistrictDto>>

    @GET("gts-monitorings/{id}/objects")
    suspend fun getGtsObjects(@Path("id") monitoringId: String): Response<List<GtsObjectDto>>

    @GET("gts-monitorings/{id}/objects/{objectId}")
    suspend fun getGtsObject(
        @Path("id") monitoringId: String,
        @Path("objectId") objectId: String,
    ): Response<GtsObjectDto>

    @PATCH("gts-monitorings/{id}/objects/{objectId}")
    suspend fun updateGtsObject(
        @Path("id") monitoringId: String,
        @Path("objectId") objectId: String,
        @Body request: UpdateGtsObjectRequest,
    ): Response<Unit>

    @PATCH("gts-monitorings/{id}/objects/{objectId}/elements/{elementId}")
    suspend fun updateGtsElement(
        @Path("id") monitoringId: String,
        @Path("objectId") objectId: String,
        @Path("elementId") elementId: String,
        @Body request: UpdateGtsElementRequest,
    ): Response<Unit>

    @GET("gts-monitorings/{id}/objects/{objectId}/photos")
    suspend fun getGtsObjectPhotos(
        @Path("id") monitoringId: String,
        @Path("objectId") objectId: String,
    ): Response<List<GtsPhotoDto>>

    @Multipart
    @POST("gts-monitorings/{id}/objects/{objectId}/photos")
    suspend fun uploadGtsPhoto(
        @Path("id") monitoringId: String,
        @Path("objectId") objectId: String,
        @Part photos: MultipartBody.Part,
    ): Response<List<GtsPhotoDto>>
}
