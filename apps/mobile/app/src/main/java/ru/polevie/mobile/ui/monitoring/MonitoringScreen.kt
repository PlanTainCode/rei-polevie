package ru.polevie.mobile.ui.monitoring

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Science
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.material3.Icon
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.polevie.mobile.ui.components.BackHeader
import ru.polevie.mobile.ui.samples.SamplesActionButton
import ru.polevie.mobile.ui.samples.SamplesButtonVariant
import ru.polevie.mobile.ui.theme.BgPrimary
import ru.polevie.mobile.ui.theme.BgSecondary
import ru.polevie.mobile.ui.theme.BgTertiary
import ru.polevie.mobile.ui.theme.BorderColor
import ru.polevie.mobile.ui.theme.Cyan400
import ru.polevie.mobile.ui.theme.Emerald400
import ru.polevie.mobile.ui.theme.Primary400
import ru.polevie.mobile.ui.theme.TextPrimary
import ru.polevie.mobile.ui.theme.TextSecondary

@Composable
fun MonitoringScreen(
    monitoringId: String,
    onBack: () -> Unit,
    onProbes: () -> Unit,
    viewModel: MonitoringViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val scrollState = rememberScrollState()

    Column(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
        BackHeader(
            title = uiState.monitoring?.name ?: "Мониторинг",
            onBack = onBack,
            onSync = { viewModel.refresh() },
        )
        when {
            uiState.isLoading && uiState.monitoring == null -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = Primary400)
                }
            }
            else -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(scrollState)
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = BgSecondary),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(1.dp, BorderColor, RoundedCornerShape(12.dp))
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            uiState.monitoring?.objectName?.let { name ->
                                InfoRow(label = "Объект", value = name)
                            }
                            uiState.monitoring?.objectAddress?.let { address ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.Top,
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Place,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp),
                                        tint = TextSecondary,
                                    )
                                    Text(
                                        text = address,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondary,
                                        modifier = Modifier.padding(start = 8.dp),
                                    )
                                }
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                LinearProgressIndicator(
                                    progress = { uiState.progressPercent / 100f },
                                    modifier = Modifier
                                        .weight(1f)
                                        .padding(end = 12.dp),
                                    color = Cyan400,
                                    trackColor = BgTertiary,
                                )
                                Text(
                                    text = "${uiState.collected}/${uiState.total}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondary,
                                )
                            }
                        }
                    }
                    SamplesActionButton(
                        icon = Icons.Default.Science,
                        label = "Точки наблюдения (${uiState.collected}/${uiState.total} отобрано)",
                        onClick = onProbes,
                        variant = if (uiState.collected == uiState.total && uiState.total > 0) {
                            SamplesButtonVariant.Success
                        } else {
                            SamplesButtonVariant.Primary
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = TextSecondary,
            modifier = Modifier.padding(end = 8.dp),
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = TextPrimary,
        )
    }
}
