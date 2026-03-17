package ru.polevie.mobile.util

import android.Manifest
import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import androidx.core.content.ContextCompat
import androidx.exifinterface.media.ExifInterface
import java.io.File
import java.io.InputStream
import java.util.Locale

object LocationUtils {

    fun hasLocationPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED

    fun hasMediaLocationPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_MEDIA_LOCATION) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED

    private fun isMediaStoreUri(uri: Uri): Boolean {
        val authority = uri.authority ?: return false
        return authority == "media" || authority == MediaStore.AUTHORITY
    }

    /** InputStream для чтения файла с сохранением EXIF (GPS). */
    fun openInputStreamWithLocationAccess(context: Context, uri: Uri): InputStream? {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q && isMediaStoreUri(uri)) {
            try {
                val originalUri = MediaStore.setRequireOriginal(uri)
                return context.contentResolver.openInputStream(originalUri)
            } catch (_: Exception) { }
        }
        return context.contentResolver.openInputStream(uri)
    }

    fun getExifCoordinates(context: Context, uri: Uri): Pair<Double, Double>? {
        val file = File(context.cacheDir, "exif_temp_${System.currentTimeMillis()}.jpg")
        try {
            openInputStreamWithLocationAccess(context, uri)?.use { input ->
                file.outputStream().use { output ->
                    input.copyTo(output)
                }
            } ?: return null
            return ExifInterface(file).latLong?.let { (lat, lon) ->
                Pair(lat.toDouble(), lon.toDouble())
            }
        } finally {
            file.delete()
        }
    }

    /** Десятичные градусы с 6 знаками (54.418384). Locale.US для точки. */
    fun formatCoordinate(value: Double): String {
        return String.format(Locale.US, "%.6f", value)
    }

    /** Парсит координату в десятичные градусы для URL карты. Поддерживает "55 50.792", "-55 50.792" и "55.75321" */
    fun parseCoordinateForMap(coord: String?): Double? {
        if (coord.isNullOrBlank()) return null
        val trimmed = coord.trim()
        val dmMatch = Regex("^(-?)(\\d+)\\s+(\\d+\\.?\\d*)$").find(trimmed)
        if (dmMatch != null) {
            val sign = if (dmMatch.groupValues[1] == "-") -1.0 else 1.0
            val deg = dmMatch.groupValues[2].toDouble()
            val min = dmMatch.groupValues[3].toDouble()
            return sign * (deg + min / 60)
        }
        return trimmed.replace(",", ".").toDoubleOrNull()
    }

    fun getYandexMapsUrl(latitude: String?, longitude: String?): String? {
        val lat = parseCoordinateForMap(latitude) ?: return null
        val lon = parseCoordinateForMap(longitude) ?: return null
        return "https://yandex.ru/maps/?pt=$lon,$lat&z=17&l=map"
    }
}
