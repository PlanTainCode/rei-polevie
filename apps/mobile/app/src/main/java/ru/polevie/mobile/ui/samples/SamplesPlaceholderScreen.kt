package ru.polevie.mobile.ui.samples

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.polevie.mobile.ui.components.BackHeader
import ru.polevie.mobile.ui.theme.BgPrimary
import ru.polevie.mobile.ui.theme.TextPrimary

@Composable
fun SamplesPlaceholderScreen(
    onBack: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
        BackHeader(title = "Пробы", onBack = onBack)
        Text(
            text = "Список проб (Фаза 5)",
            style = MaterialTheme.typography.bodyLarge,
            color = TextPrimary,
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
        )
    }
}
