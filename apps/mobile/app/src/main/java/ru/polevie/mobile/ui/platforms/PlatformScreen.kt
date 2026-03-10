package ru.polevie.mobile.ui.platforms

import android.Manifest
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Camera
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.polevie.mobile.ui.components.BackHeader
import ru.polevie.mobile.ui.theme.BgPrimary
import ru.polevie.mobile.ui.theme.BgSecondary
import ru.polevie.mobile.ui.theme.BgTertiary
import ru.polevie.mobile.ui.theme.BorderColor
import ru.polevie.mobile.ui.theme.Emerald400
import ru.polevie.mobile.ui.theme.Primary400
import ru.polevie.mobile.ui.theme.Primary500
import ru.polevie.mobile.ui.theme.Red400
import ru.polevie.mobile.ui.theme.TextPrimary
import ru.polevie.mobile.ui.theme.TextSecondary
import ru.polevie.mobile.util.LocationUtils

@Composable
fun PlatformScreen(
    onBack: () -> Unit,
    onSamples: () -> Unit,
    viewModel: PlatformViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val platform by viewModel.platform.collectAsState()
    val collectedTotal by viewModel.collectedTotal.collectAsState()
    val geoLoading by viewModel.geoLoading.collectAsState()
    val exifLoading by viewModel.exifLoading.collectAsState()
    val uploadLoading by viewModel.uploadLoading.collectAsState()
    val toastMessage by viewModel.toastMessage.collectAsState()

    var manualMode by remember { mutableStateOf<ManualField?>(null) }
    var manualValue by remember { mutableStateOf("") }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            viewModel.requestLocation()
        } else {
            viewModel.toastMessage.value = "Доступ к геолокации запрещён"
        }
    }

    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val exifPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent(),
    ) { uri: Uri? ->
        uri?.let {
            viewModel.exifLoading.value = true
            scope.launch(Dispatchers.IO) {
                val coords = viewModel.getExifCoordinates(it)
                withContext(Dispatchers.Main) {
                    viewModel.exifLoading.value = false
                    coords?.let { (lat, lon) ->
                        val latStr = ru.polevie.mobile.util.LocationUtils.formatCoordinate(lat)
                        val lonStr = ru.polevie.mobile.util.LocationUtils.formatCoordinate(lon)
                        viewModel.updateCoordinates(latStr, lonStr)
                        viewModel.toastMessage.value = "Координаты из EXIF сохранены"
                    } ?: run {
                        viewModel.toastMessage.value = "GPS-данные не найдены в фото"
                    }
                }
            }
        }
    }

    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent(),
    ) { uri: Uri? ->
        uri?.let { viewModel.preparePhotoUpload(it) }
    }

    var pendingAfterMediaLocation by remember { mutableStateOf<(() -> Unit)?>(null) }
    val mediaLocationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) pendingAfterMediaLocation?.invoke()
        pendingAfterMediaLocation = null
    }

    fun launchWithMediaLocation(action: () -> Unit) {
        if (LocationUtils.hasMediaLocationPermission(context)) action()
        else {
            pendingAfterMediaLocation = action
            mediaLocationLauncher.launch(Manifest.permission.ACCESS_MEDIA_LOCATION)
        }
    }

    LaunchedEffect(toastMessage) {
        toastMessage?.let {
            kotlinx.coroutines.delay(3000)
            viewModel.toastMessage.value = null
        }
    }

    val pendingVoiceDescribe by viewModel.pendingVoiceDescribe.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()

    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
        BackHeader(
            title = platform?.label ?: "Площадка",
            onBack = onBack,
            onSync = { viewModel.refresh() },
            isSyncing = isSyncing,
        )

        when (platform) {
            null -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    CircularProgressIndicator(color = Primary500)
                    Text(
                        text = "Загрузка...",
                        color = TextSecondary,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(top = 16.dp),
                    )
                }
            }
            else -> {
                Box {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        toastMessage?.let { msg ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = Emerald400),
                                shape = RoundedCornerShape(12.dp),
                            ) {
                                Text(
                                    text = msg,
                                    color = TextPrimary,
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.padding(12.dp),
                                )
                            }
                        }

                        val hasCoords = !platform!!.latitude.isNullOrEmpty() && !platform!!.longitude.isNullOrEmpty()
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = BgSecondary),
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .border(1.dp, BorderColor, RoundedCornerShape(12.dp))
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(10.dp)
                                            .clip(RoundedCornerShape(5.dp))
                                            .background(
                                                if (hasCoords) Emerald400 else Red400,
                                            ),
                                    )
                                    Text(
                                        text = "Координаты",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = TextPrimary,
                                    )
                                }
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "Широта",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = TextSecondary,
                                        )
                                        Text(
                                            text = platform!!.latitude ?: "—",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = TextPrimary,
                                        )
                                    }
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "Долгота",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = TextSecondary,
                                        )
                                        Text(
                                            text = platform!!.longitude ?: "—",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = TextPrimary,
                                        )
                                    }
                                }
                                if (hasCoords) {
                                    val url = ru.polevie.mobile.util.LocationUtils.getYandexMapsUrl(
                                        platform!!.latitude,
                                        platform!!.longitude,
                                    )
                                    if (url != null) {
                                        Row(
                                            modifier = Modifier
                                                .clickable {
                                                    context.startActivity(
                                                        Intent(Intent.ACTION_VIEW, Uri.parse(url)),
                                                    )
                                                }
                                            .padding(vertical = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    ) {
                                        Icon(
                                            Icons.Default.Navigation,
                                            contentDescription = null,
                                            modifier = Modifier.size(14.dp),
                                            tint = Primary400,
                                        )
                                        Text(
                                            text = "Открыть на карте",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Primary400,
                                        )
                                    }
                                    }
                                }
                            }
                        }

                        if (manualMode != null) {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = BgSecondary),
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .border(1.dp, BorderColor, RoundedCornerShape(12.dp))
                                        .padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(12.dp),
                                ) {
                                    Text(
                                        text = if (manualMode == ManualField.LAT) "Широта" else "Долгота",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = TextPrimary,
                                    )
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        BasicTextField(
                                            value = manualValue,
                                            onValueChange = { manualValue = it },
                                            modifier = Modifier
                                                .weight(1f)
                                                .padding(12.dp)
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(BgTertiary)
                                                .padding(12.dp),
                                            textStyle = MaterialTheme.typography.bodyMedium,
                                            decorationBox = { inner ->
                                                Box {
                                                    if (manualValue.isEmpty()) {
                                                        Text(
                                                            text = if (manualMode == ManualField.LAT) "55 50.792" else "37 39.277",
                                                            style = MaterialTheme.typography.bodyMedium,
                                                            color = TextSecondary,
                                                        )
                                                    }
                                                    inner()
                                                }
                                            },
                                        )
                                        IconButton(
                                            onClick = {
                                                when (manualMode) {
                                                    ManualField.LAT -> viewModel.updateCoordinateLat(manualValue)
                                                    ManualField.LON -> viewModel.updateCoordinateLon(manualValue)
                                                    null -> {}
                                                }
                                                manualMode = null
                                                manualValue = ""
                                            },
                                        ) {
                                            Icon(Icons.Default.Save, contentDescription = null, tint = Primary400)
                                        }
                                        IconButton(
                                            onClick = {
                                                manualMode = null
                                                manualValue = ""
                                            },
                                        ) {
                                            Icon(Icons.Default.Close, contentDescription = null, tint = TextSecondary)
                                        }
                                    }
                                }
                            }
                        }

                        SectionTitle("Ввод координат")
                        ActionButton(
                            icon = Icons.Default.MyLocation,
                            label = "Моя геолокация",
                            variant = ActionVariant.Primary,
                            onClick = {
                                if (ru.polevie.mobile.util.LocationUtils.hasLocationPermission(context)) {
                                    viewModel.requestLocation()
                                } else {
                                    permissionLauncher.launch(android.Manifest.permission.ACCESS_FINE_LOCATION)
                                }
                            },
                            loading = geoLoading,
                        )
                        ActionButton(
                            icon = Icons.Default.Camera,
                            label = "Определить по фото (EXIF)",
                            variant = ActionVariant.Default,
                            onClick = { launchWithMediaLocation { exifPicker.launch("image/*") } },
                            loading = exifLoading,
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            ActionButton(
                                icon = Icons.Default.Edit,
                                label = "Широта",
                                variant = ActionVariant.Default,
                                onClick = {
                                    manualMode = ManualField.LAT
                                    manualValue = platform?.latitude ?: ""
                                },
                                modifier = Modifier.weight(1f),
                            )
                            ActionButton(
                                icon = Icons.Default.Edit,
                                label = "Долгота",
                                variant = ActionVariant.Default,
                                onClick = {
                                    manualMode = ManualField.LON
                                    manualValue = platform?.longitude ?: ""
                                },
                                modifier = Modifier.weight(1f),
                            )
                        }

                        SectionTitle("Фотоальбом")
                        ActionButton(
                            icon = Icons.Default.Camera,
                            label = "Загрузить фото",
                            variant = ActionVariant.Default,
                            onClick = { launchWithMediaLocation { photoPicker.launch("image/*") } },
                            loading = uploadLoading,
                        )

                        SectionTitle("Пробы")
                        val (collected, total) = collectedTotal
                        val allCollected = total > 0 && collected >= total
                        ActionButton(
                            icon = Icons.Default.Science,
                            label = "Пробы ($collected/$total собрано)",
                            onClick = onSamples,
                            variant = if (allCollected) ActionVariant.Success else ActionVariant.Primary,
                        )
                    }
                }
            }
        }
        }
        if (pendingVoiceDescribe.isNotEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(BgPrimary),
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    BackHeader(
                        title = "Описание фото",
                        onBack = { viewModel.clearPendingVoiceDescribe() },
                    )
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = "Фото загружено",
                            style = MaterialTheme.typography.titleMedium,
                            color = TextPrimary,
                        )
                        Text(
                            text = "Голосовое описание можно добавить в Фотоальбоме",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                        androidx.compose.material3.TextButton(
                            onClick = { viewModel.clearPendingVoiceDescribe() },
                            modifier = Modifier.padding(top = 24.dp),
                        ) {
                            Text("Готово", color = Primary400)
                        }
                    }
                }
            }
        }
    }
}

private enum class ManualField { LAT, LON }

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = TextSecondary,
        modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp),
    )
}

private enum class ActionVariant { Default, Primary, Success }

@Composable
private fun ActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    loading: Boolean = false,
    variant: ActionVariant = ActionVariant.Default,
    modifier: Modifier = Modifier,
) {
    val bgColor = when (variant) {
        ActionVariant.Default -> BgTertiary
        ActionVariant.Primary -> Primary500.copy(alpha = 0.2f)
        ActionVariant.Success -> Emerald400.copy(alpha = 0.2f)
    }
    val tintColor = when (variant) {
        ActionVariant.Default -> TextPrimary
        ActionVariant.Primary -> Primary400
        ActionVariant.Success -> Emerald400
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick, enabled = !loading),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = bgColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = tintColor,
                    strokeWidth = 2.dp,
                )
            } else {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = tintColor,
                )
            }
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary,
            )
        }
    }
}
