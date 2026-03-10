package ru.polevie.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.runtime.CompositionLocalProvider
import coil.ImageLoader
import coil.compose.LocalImageLoader
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.compose.foundation.layout.Column
import dagger.hilt.android.AndroidEntryPoint
import ru.polevie.mobile.data.remote.TokenManager
import ru.polevie.mobile.sync.SyncManager
import ru.polevie.mobile.ui.components.NetworkStatusBanner
import ru.polevie.mobile.ui.login.LoginScreen
import ru.polevie.mobile.util.NetworkMonitor
import ru.polevie.mobile.ui.modeselect.ModeSelectScreen
import ru.polevie.mobile.ui.monitoring.MonitoringListScreen
import ru.polevie.mobile.ui.monitoring.MonitoringPointScreen
import ru.polevie.mobile.ui.monitoring.MonitoringPointsScreen
import ru.polevie.mobile.ui.monitoring.MonitoringScreen
import ru.polevie.mobile.ui.navigation.Routes
import ru.polevie.mobile.ui.photos.PhotosScreen
import ru.polevie.mobile.ui.platforms.PlatformScreen
import ru.polevie.mobile.ui.platforms.PlatformsScreen
import ru.polevie.mobile.ui.samples.SampleScreen
import ru.polevie.mobile.ui.samples.SamplesScreen
import ru.polevie.mobile.ui.projects.ProjectScreen
import ru.polevie.mobile.ui.projects.ProjectsScreen
import ru.polevie.mobile.ui.theme.BgPrimary
import ru.polevie.mobile.ui.theme.PolevieTheme
import ru.polevie.mobile.ui.theme.Primary500
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var tokenManager: TokenManager
    @Inject lateinit var syncManager: SyncManager
    @Inject lateinit var imageLoader: ImageLoader
    @Inject lateinit var networkMonitor: NetworkMonitor

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        syncManager.schedulePeriodic()

        setContent {
            PolevieTheme {
                CompositionLocalProvider(LocalImageLoader provides imageLoader) {
                val isLoggedIn by tokenManager.isLoggedIn.collectAsStateWithLifecycle(initialValue = null as Boolean?)
                val navController = rememberNavController()

                Column(modifier = Modifier.fillMaxSize()) {
                    NetworkStatusBanner(networkMonitor)
                when (isLoggedIn) {
                    null -> {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(BgPrimary),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(color = Primary500)
                        }
                    }
                    false -> {
                        Box(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
                            NavHost(
                                navController = navController,
                                startDestination = Routes.LOGIN,
                            ) {
                                composable(Routes.LOGIN) {
                                    LoginScreen(onLoginSuccess = {
                                        navController.navigate(Routes.MODE_SELECT) {
                                            popUpTo(Routes.LOGIN) { inclusive = true }
                                        }
                                    })
                                }
                                composable(Routes.MODE_SELECT) {
                                    ModeSelectScreen(
                                        onNavigateToProjects = {
                                            navController.navigate(Routes.PROJECTS)
                                        },
                                        onNavigateToMonitorings = {
                                            navController.navigate(Routes.MONITORING_LIST)
                                        },
                                        onLogout = {},
                                    )
                                }
                                composable(Routes.PROJECTS) {
                                    ProjectsScreen(
                                        onBack = { navController.popBackStack() },
                                        onProjectSelect = { id ->
                                            navController.navigate(Routes.project(id))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.PROJECT,
                                    arguments = listOf(navArgument("projectId") { type = NavType.StringType }),
                                ) { backStackEntry ->
                                    val projectId = backStackEntry.arguments?.getString("projectId")!!
                                    ProjectScreen(
                                        onBack = { navController.popBackStack() },
                                        onPlatforms = {
                                            navController.navigate(Routes.platforms(projectId))
                                        },
                                        onPhotos = {
                                            navController.navigate(Routes.photos(projectId))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.PLATFORMS,
                                    arguments = listOf(navArgument("projectId") { type = NavType.StringType }),
                                ) { backStackEntry ->
                                    val projectId = backStackEntry.arguments?.getString("projectId")!!
                                    PlatformsScreen(
                                        projectId = projectId,
                                        onBack = { navController.popBackStack() },
                                        onPlatformSelect = { platformId ->
                                            navController.navigate(Routes.platform(projectId, platformId))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.PLATFORM,
                                    arguments = listOf(
                                        navArgument("projectId") { type = NavType.StringType },
                                        navArgument("platformId") { type = NavType.StringType },
                                    ),
                                ) { backStackEntry ->
                                    val projectId = backStackEntry.arguments?.getString("projectId")!!
                                    val platformId = backStackEntry.arguments?.getString("platformId")!!
                                    PlatformScreen(
                                        onBack = { navController.popBackStack() },
                                        onSamples = {
                                            navController.navigate(Routes.samples(projectId, platformId))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.SAMPLES,
                                    arguments = listOf(
                                        navArgument("projectId") { type = NavType.StringType },
                                        navArgument("platformId") { type = NavType.StringType },
                                    ),
                                ) { backStackEntry ->
                                    val projectId = backStackEntry.arguments?.getString("projectId")!!
                                    val platformId = backStackEntry.arguments?.getString("platformId")!!
                                    SamplesScreen(
                                        onBack = { navController.popBackStack() },
                                        onSampleSelect = { sampleId ->
                                            navController.navigate(Routes.sample(projectId, platformId, sampleId))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.SAMPLE,
                                    arguments = listOf(
                                        navArgument("projectId") { type = NavType.StringType },
                                        navArgument("platformId") { type = NavType.StringType },
                                        navArgument("sampleId") { type = NavType.StringType },
                                    ),
                                ) { backStackEntry ->
                                    val sampleId = backStackEntry.arguments?.getString("sampleId")!!
                                    SampleScreen(
                                        sampleId = sampleId,
                                        onBack = { navController.popBackStack() },
                                    )
                                }
                                composable(
                                    route = Routes.PHOTOS,
                                    arguments = listOf(navArgument("projectId") { type = NavType.StringType }),
                                ) { backStackEntry ->
                                    val projectId = backStackEntry.arguments?.getString("projectId")!!
                                    PhotosScreen(
                                        projectId = projectId,
                                        onBack = { navController.popBackStack() },
                                    )
                                }
                                composable(Routes.MONITORING_LIST) {
                                    MonitoringListScreen(
                                        onBack = { navController.popBackStack() },
                                        onMonitoringSelect = { id ->
                                            navController.navigate(Routes.monitoring(id))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.MONITORING,
                                    arguments = listOf(navArgument("monitoringId") { type = NavType.StringType }),
                                ) { backStackEntry ->
                                    val monitoringId = backStackEntry.arguments?.getString("monitoringId")!!
                                    MonitoringScreen(
                                        monitoringId = monitoringId,
                                        onBack = { navController.popBackStack() },
                                        onProbes = {
                                            navController.navigate(Routes.monitoringPoints(monitoringId))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.MONITORING_POINTS,
                                    arguments = listOf(navArgument("monitoringId") { type = NavType.StringType }),
                                ) { backStackEntry ->
                                    val monitoringId = backStackEntry.arguments?.getString("monitoringId")!!
                                    MonitoringPointsScreen(
                                        monitoringId = monitoringId,
                                        onBack = { navController.popBackStack() },
                                        onPointSelect = { pointName ->
                                            navController.navigate(Routes.monitoringPoint(monitoringId, pointName))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.MONITORING_POINT,
                                    arguments = listOf(
                                        navArgument("monitoringId") { type = NavType.StringType },
                                        navArgument("pointName") { type = NavType.StringType },
                                    ),
                                ) { backStackEntry ->
                                    val monitoringId = backStackEntry.arguments?.getString("monitoringId")!!
                                    val pointName = backStackEntry.arguments?.getString("pointName")!!
                                    MonitoringPointScreen(
                                        monitoringId = monitoringId,
                                        pointName = pointName,
                                        onBack = { navController.popBackStack() },
                                    )
                                }
                            }
                        }
                    }
                    true -> {
                        Box(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
                            NavHost(
                                navController = navController,
                                startDestination = Routes.MODE_SELECT,
                            ) {
                                composable(Routes.MODE_SELECT) {
                                    ModeSelectScreen(
                                        onNavigateToProjects = {
                                            navController.navigate(Routes.PROJECTS)
                                        },
                                        onNavigateToMonitorings = {
                                            navController.navigate(Routes.MONITORING_LIST)
                                        },
                                        onLogout = {},
                                    )
                                }
                                composable(Routes.PROJECTS) {
                                    ProjectsScreen(
                                        onBack = { navController.popBackStack() },
                                        onProjectSelect = { id ->
                                            navController.navigate(Routes.project(id))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.PROJECT,
                                    arguments = listOf(navArgument("projectId") { type = NavType.StringType }),
                                ) { backStackEntry ->
                                    val projectId = backStackEntry.arguments?.getString("projectId")!!
                                    ProjectScreen(
                                        onBack = { navController.popBackStack() },
                                        onPlatforms = {
                                            navController.navigate(Routes.platforms(projectId))
                                        },
                                        onPhotos = {
                                            navController.navigate(Routes.photos(projectId))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.PLATFORMS,
                                    arguments = listOf(navArgument("projectId") { type = NavType.StringType }),
                                ) { backStackEntry ->
                                    val projectId = backStackEntry.arguments?.getString("projectId")!!
                                    PlatformsScreen(
                                        projectId = projectId,
                                        onBack = { navController.popBackStack() },
                                        onPlatformSelect = { platformId ->
                                            navController.navigate(Routes.platform(projectId, platformId))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.PLATFORM,
                                    arguments = listOf(
                                        navArgument("projectId") { type = NavType.StringType },
                                        navArgument("platformId") { type = NavType.StringType },
                                    ),
                                ) { backStackEntry ->
                                    val projectId = backStackEntry.arguments?.getString("projectId")!!
                                    val platformId = backStackEntry.arguments?.getString("platformId")!!
                                    PlatformScreen(
                                        onBack = { navController.popBackStack() },
                                        onSamples = {
                                            navController.navigate(Routes.samples(projectId, platformId))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.SAMPLES,
                                    arguments = listOf(
                                        navArgument("projectId") { type = NavType.StringType },
                                        navArgument("platformId") { type = NavType.StringType },
                                    ),
                                ) { backStackEntry ->
                                    val projectId = backStackEntry.arguments?.getString("projectId")!!
                                    val platformId = backStackEntry.arguments?.getString("platformId")!!
                                    SamplesScreen(
                                        onBack = { navController.popBackStack() },
                                        onSampleSelect = { sampleId ->
                                            navController.navigate(Routes.sample(projectId, platformId, sampleId))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.SAMPLE,
                                    arguments = listOf(
                                        navArgument("projectId") { type = NavType.StringType },
                                        navArgument("platformId") { type = NavType.StringType },
                                        navArgument("sampleId") { type = NavType.StringType },
                                    ),
                                ) { backStackEntry ->
                                    val sampleId = backStackEntry.arguments?.getString("sampleId")!!
                                    SampleScreen(
                                        sampleId = sampleId,
                                        onBack = { navController.popBackStack() },
                                    )
                                }
                                composable(
                                    route = Routes.PHOTOS,
                                    arguments = listOf(navArgument("projectId") { type = NavType.StringType }),
                                ) { backStackEntry ->
                                    val projectId = backStackEntry.arguments?.getString("projectId")!!
                                    PhotosScreen(
                                        projectId = projectId,
                                        onBack = { navController.popBackStack() },
                                    )
                                }
                                composable(Routes.MONITORING_LIST) {
                                    MonitoringListScreen(
                                        onBack = { navController.popBackStack() },
                                        onMonitoringSelect = { id ->
                                            navController.navigate(Routes.monitoring(id))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.MONITORING,
                                    arguments = listOf(navArgument("monitoringId") { type = NavType.StringType }),
                                ) { backStackEntry ->
                                    val monitoringId = backStackEntry.arguments?.getString("monitoringId")!!
                                    MonitoringScreen(
                                        monitoringId = monitoringId,
                                        onBack = { navController.popBackStack() },
                                        onProbes = {
                                            navController.navigate(Routes.monitoringPoints(monitoringId))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.MONITORING_POINTS,
                                    arguments = listOf(navArgument("monitoringId") { type = NavType.StringType }),
                                ) { backStackEntry ->
                                    val monitoringId = backStackEntry.arguments?.getString("monitoringId")!!
                                    MonitoringPointsScreen(
                                        monitoringId = monitoringId,
                                        onBack = { navController.popBackStack() },
                                        onPointSelect = { pointName ->
                                            navController.navigate(Routes.monitoringPoint(monitoringId, pointName))
                                        },
                                    )
                                }
                                composable(
                                    route = Routes.MONITORING_POINT,
                                    arguments = listOf(
                                        navArgument("monitoringId") { type = NavType.StringType },
                                        navArgument("pointName") { type = NavType.StringType },
                                    ),
                                ) { backStackEntry ->
                                    val monitoringId = backStackEntry.arguments?.getString("monitoringId")!!
                                    val pointName = backStackEntry.arguments?.getString("pointName")!!
                                    MonitoringPointScreen(
                                        monitoringId = monitoringId,
                                        pointName = pointName,
                                        onBack = { navController.popBackStack() },
                                    )
                                }
                            }
                        }
                    }
                }
                }
                }
            }
        }
    }
}
