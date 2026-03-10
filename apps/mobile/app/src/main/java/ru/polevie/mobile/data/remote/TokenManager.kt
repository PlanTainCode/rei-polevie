package ru.polevie.mobile.data.remote

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.tokenDataStore: DataStore<Preferences> by preferencesDataStore(name = "auth_tokens")

@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    companion object {
        private val ACCESS_TOKEN = stringPreferencesKey("access_token")
        private val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        private val USER_ID = stringPreferencesKey("user_id")
        private val USER_EMAIL = stringPreferencesKey("user_email")
        private val USER_FIRST_NAME = stringPreferencesKey("user_first_name")
        private val USER_LAST_NAME = stringPreferencesKey("user_last_name")
    }

    val accessToken: Flow<String?> = context.tokenDataStore.data.map { it[ACCESS_TOKEN] }
    val refreshToken: Flow<String?> = context.tokenDataStore.data.map { it[REFRESH_TOKEN] }

    val isLoggedIn: Flow<Boolean> = context.tokenDataStore.data.map {
        it[ACCESS_TOKEN] != null
    }

    val userName: Flow<String?> = context.tokenDataStore.data.map { prefs ->
        val first = prefs[USER_FIRST_NAME] ?: return@map null
        val last = prefs[USER_LAST_NAME] ?: ""
        "$first $last".trim()
    }

    /** Имя для отображения: "Имя Фамилия" или email как fallback */
    val userDisplayName: Flow<String> = context.tokenDataStore.data.map { prefs ->
        val first = prefs[USER_FIRST_NAME]?.trim()
        val last = prefs[USER_LAST_NAME]?.trim()
        val fullName = if (!first.isNullOrEmpty()) "$first ${last.orEmpty()}".trim() else null
        fullName ?: prefs[USER_EMAIL].orEmpty()
    }

    suspend fun getAccessToken(): String? = context.tokenDataStore.data.first()[ACCESS_TOKEN]
    suspend fun getRefreshToken(): String? = context.tokenDataStore.data.first()[REFRESH_TOKEN]
    suspend fun getUserId(): String? = context.tokenDataStore.data.first()[USER_ID]

    suspend fun saveTokens(accessToken: String, refreshToken: String) {
        context.tokenDataStore.edit { prefs ->
            prefs[ACCESS_TOKEN] = accessToken
            prefs[REFRESH_TOKEN] = refreshToken
        }
    }

    suspend fun saveUser(id: String, email: String, firstName: String, lastName: String) {
        context.tokenDataStore.edit { prefs ->
            prefs[USER_ID] = id
            prefs[USER_EMAIL] = email
            prefs[USER_FIRST_NAME] = firstName
            prefs[USER_LAST_NAME] = lastName
        }
    }

    suspend fun clear() {
        context.tokenDataStore.edit { it.clear() }
    }
}
