package ru.polevie.mobile.ui.navigation

object Routes {
    const val LOGIN = "login"
    const val MODE_SELECT = "mode_select"

    const val PROJECTS = "projects"
    const val PROJECT = "project/{projectId}"
    const val PLATFORMS = "platforms/{projectId}"
    const val PLATFORM = "platform/{projectId}/{platformId}"
    const val SAMPLES = "samples/{projectId}/{platformId}"
    const val SAMPLE = "sample/{projectId}/{platformId}/{sampleId}"
    const val PHOTOS = "photos/{projectId}"

    const val MONITORING_LIST = "monitoring_list"
    const val MONITORING = "monitoring/{monitoringId}"
    const val MONITORING_POINTS = "monitoring_points/{monitoringId}"
    const val MONITORING_POINT = "monitoring_point/{monitoringId}/{pointName}"

    fun project(id: String) = "project/$id"
    fun platforms(projectId: String) = "platforms/$projectId"
    fun platform(projectId: String, platformId: String) = "platform/$projectId/$platformId"
    fun samples(projectId: String, platformId: String) = "samples/$projectId/$platformId"
    fun sample(projectId: String, platformId: String, sampleId: String) =
        "sample/$projectId/$platformId/$sampleId"
    fun photos(projectId: String) = "photos/$projectId"

    fun monitoring(id: String) = "monitoring/$id"
    fun monitoringPoints(id: String) = "monitoring_points/$id"
    fun monitoringPoint(id: String, pointName: String) =
        "monitoring_point/$id/${java.net.URLEncoder.encode(pointName, "UTF-8").replace("+", "%20")}"

    const val GTS_MONITORING_LIST = "gts_monitoring_list"
    const val GTS_MONITORING = "gts_monitoring/{gtsMonitoringId}"
    const val GTS_DISTRICT = "gts_district/{gtsMonitoringId}/{districtId}"
    const val GTS_OBJECT = "gts_object/{gtsMonitoringId}/{objectId}"

    fun gtsMonitoring(id: String) = "gts_monitoring/$id"
    fun gtsDistrict(monitoringId: String, districtId: String) = "gts_district/$monitoringId/$districtId"
    fun gtsObject(monitoringId: String, objectId: String) = "gts_object/$monitoringId/$objectId"
}
