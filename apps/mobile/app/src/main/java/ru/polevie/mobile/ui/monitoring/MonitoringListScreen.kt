package ru.polevie.mobile.ui.monitoring

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.polevie.mobile.data.local.entity.MonitoringEntity
import ru.polevie.mobile.ui.components.BackHeader
import ru.polevie.mobile.ui.theme.BgPrimary
import ru.polevie.mobile.ui.theme.BgSecondary
import ru.polevie.mobile.ui.theme.BgTertiary
import ru.polevie.mobile.ui.theme.Cyan400
import ru.polevie.mobile.ui.theme.Emerald400
import ru.polevie.mobile.ui.theme.TextPrimary
import ru.polevie.mobile.ui.theme.TextSecondary

private fun statusLabel(status: String): String = when (status) {
    "COMPLETED" -> "Завершён"
    "IN_PROGRESS" -> "В работе"
    else -> "Новый"
}

@Composable
fun MonitoringListScreen(
    onBack: () -> Unit,
    onMonitoringSelect: (String) -> Unit,
    viewModel: MonitoringListViewModel = hiltViewModel(),
) {
    val monitorings by viewModel.monitorings.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.refresh()
    }

    Column(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
        BackHeader(
            title = "Мониторинги",
            onBack = onBack,
            onSync = { viewModel.refresh() },
        )

        when {
            isLoading && monitorings.isEmpty() -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.padding(24.dp),
                        color = ru.polevie.mobile.ui.theme.Primary400,
                    )
                }
            }
            monitorings.isEmpty() -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = "Нет мониторингов",
                        style = MaterialTheme.typography.bodyLarge,
                        color = TextSecondary,
                    )
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, top = 12.dp, end = 16.dp, bottom = 96.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(monitorings, key = { it.id }) { monitoring ->
                        MonitoringListItem(
                            monitoring = monitoring,
                            onClick = { onMonitoringSelect(monitoring.id) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MonitoringListItem(
    monitoring: MonitoringEntity,
    onClick: () -> Unit,
) {
    val probeCount = monitoring.probesCount
    val statusLabel = statusLabel(monitoring.status)
    val statusBgColor = when (monitoring.status) {
        "COMPLETED" -> Emerald400.copy(alpha = 0.2f)
        "IN_PROGRESS" -> Cyan400.copy(alpha = 0.2f)
        else -> BgTertiary
    }
    val statusTintColor = when (monitoring.status) {
        "COMPLETED" -> Emerald400
        "IN_PROGRESS" -> Cyan400
        else -> TextSecondary
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = BgSecondary),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ShowChart,
                contentDescription = null,
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(statusBgColor)
                    .padding(8.dp),
                tint = statusTintColor,
            )
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 12.dp),
            ) {
                Text(
                    text = monitoring.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = TextPrimary,
                )
                Text(
                    text = "${monitoring.objectName ?: "Объект не указан"} • $statusLabel",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                )
            }
            if (probeCount > 0) {
                Text(
                    text = "$probeCount проб",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                    modifier = Modifier.padding(horizontal = 8.dp),
                )
            }
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                tint = TextSecondary,
            )
        }
    }
}
