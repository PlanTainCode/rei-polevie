package ru.polevie.mobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

// Палитра 1в1 с fieldwork на вебе (--bg-primary, --text-primary, primary-500 и т.д.)
private val DarkColorScheme = darkColorScheme(
    primary = Primary500,
    onPrimary = androidx.compose.ui.graphics.Color.White,
    primaryContainer = BgTertiary,
    onPrimaryContainer = Primary400,
    secondary = Primary400,
    onSecondary = BgPrimary,
    secondaryContainer = BgTertiary,
    onSecondaryContainer = Primary200,
    tertiary = Emerald500,
    tertiaryContainer = BgTertiary,
    background = BgPrimary,
    onBackground = TextPrimary,
    surface = BgPrimary,
    onSurface = TextPrimary,
    surfaceVariant = BgTertiary,
    onSurfaceVariant = TextSecondary,
    outline = BorderColor,
    outlineVariant = BorderColor,
    error = Red400,
    errorContainer = Red500.copy(alpha = 0.2f),
)

@Composable
fun PolevieTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        content = content,
    )
}
