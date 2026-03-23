package ru.polevie.mobile.ui.gts

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ru.polevie.mobile.ui.components.BackHeader
import ru.polevie.mobile.ui.theme.BgPrimary
import ru.polevie.mobile.ui.theme.BgSecondary
import ru.polevie.mobile.ui.theme.BorderColor
import ru.polevie.mobile.ui.theme.Primary400
import ru.polevie.mobile.ui.theme.Primary500
import ru.polevie.mobile.ui.theme.TextPrimary
import ru.polevie.mobile.ui.theme.TextSecondary

@Composable
fun GtsMonitoringListScreen(
    onBack: () -> Unit,
    onSelect: (String) -> Unit,
    viewModel: GtsMonitoringListViewModel = hiltViewModel(),
) {
    val monitorings by viewModel.monitorings.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.refresh() }

    Column(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
        BackHeader(title = "Мониторинг ГТС", onBack = onBack)

        if (isLoading && monitorings.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary500)
            }
        } else if (monitorings.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Нет мониторингов ГТС", color = TextSecondary)
            }
        } else {
            LazyColumn(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(monitorings, key = { it.id }) { monitoring ->
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable { onSelect(monitoring.id) },
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = BgSecondary),
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(monitoring.name, style = MaterialTheme.typography.titleMedium, color = TextPrimary, fontWeight = FontWeight.SemiBold)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("${monitoring.year} · ${monitoring.districtsCount} районов · ${monitoring.objectsCount} ГТС",
                                style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun GtsDistrictListScreen(
    gtsMonitoringId: String,
    onBack: () -> Unit,
    onDistrictSelect: (String) -> Unit,
    viewModel: GtsDistrictListViewModel = hiltViewModel(),
) {
    val districts by viewModel.districts.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.refresh() }

    Column(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
        BackHeader(title = "Районы", onBack = onBack)

        if (isLoading && districts.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary500)
            }
        } else if (districts.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Нет районов", color = TextSecondary)
            }
        } else {
            LazyColumn(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(districts, key = { it.gtsDistrictId }) { district ->
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable { onDistrictSelect(district.gtsDistrictId) },
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = BgSecondary),
                    ) {
                        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(district.districtName, style = MaterialTheme.typography.titleMedium, color = TextPrimary, fontWeight = FontWeight.SemiBold)
                            }
                            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextSecondary)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun GtsObjectListScreen(
    gtsMonitoringId: String,
    districtId: String,
    onBack: () -> Unit,
    onObjectSelect: (String) -> Unit,
    viewModel: GtsObjectListViewModel = hiltViewModel(),
) {
    val objects by viewModel.objects.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
        BackHeader(title = "Объекты ГТС", onBack = onBack)

        if (objects.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Нет объектов", color = TextSecondary)
            }
        } else {
            LazyColumn(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(objects, key = { it.id }) { obj ->
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable { onObjectSelect(obj.id) },
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = BgSecondary),
                    ) {
                        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier.size(36.dp).clip(CircleShape).background(Primary500.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("#${obj.number}", style = MaterialTheme.typography.labelSmall, color = Primary400, fontWeight = FontWeight.Bold)
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text("${obj.watercourseName} — ${obj.settlement}", style = MaterialTheme.typography.titleSmall, color = TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("${obj.photosCount} фото · ${obj.elementsCount} элементов", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                            }
                            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextSecondary)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun GtsObjectScreen(
    gtsMonitoringId: String,
    objectId: String,
    onBack: () -> Unit,
    viewModel: GtsObjectDetailViewModel = hiltViewModel(),
) {
    val gtsObject by viewModel.gtsObject.collectAsStateWithLifecycle()
    val elements by viewModel.elements.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
        BackHeader(
            title = gtsObject?.let { "#${it.number} ${it.settlement}" } ?: "...",
            onBack = onBack,
        )

        val obj = gtsObject
        if (obj == null) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary500)
            }
        } else {
            LazyColumn(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = BgSecondary)) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            InfoRow("Водоток", obj.watercourseName)
                            InfoRow("Нас. пункт", obj.settlement)
                            obj.ownerName?.let { InfoRow("Собственник", it) }
                            obj.safetyLevel?.let { InfoRow("Безопасность", it) }
                            obj.inspectorName?.let { InfoRow("Обследователь", it) }
                            obj.overallCondition?.let { InfoRow("Состояние", it) }
                        }
                    }
                }

                if (elements.isNotEmpty()) {
                    item {
                        Text("Элементы ГТС", style = MaterialTheme.typography.titleMedium, color = TextPrimary, fontWeight = FontWeight.SemiBold)
                    }
                    items(elements, key = { it.id }) { element ->
                        Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = BgSecondary)) {
                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(element.name, style = MaterialTheme.typography.titleSmall, color = TextPrimary, fontWeight = FontWeight.SemiBold)
                                element.characteristics?.let { InfoRow("Характеристика", it) }
                                element.defects?.let { InfoRow("Дефекты", it) }
                                element.recommendations?.let { InfoRow("Рекомендации", it) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Column {
        Text(label, style = MaterialTheme.typography.labelSmall, color = TextSecondary)
        Text(value, style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
    }
}
