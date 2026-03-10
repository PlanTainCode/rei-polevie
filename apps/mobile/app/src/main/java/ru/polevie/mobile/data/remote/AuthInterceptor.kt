package ru.polevie.mobile.data.remote

import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()

        if (request.url.encodedPath.contains("auth/login") ||
            request.url.encodedPath.contains("auth/refresh")
        ) {
            return chain.proceed(request)
        }

        val token = runBlocking { tokenManager.getAccessToken() }

        val authenticatedRequest = if (token != null) {
            request.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            request
        }

        val response = chain.proceed(authenticatedRequest)

        if (response.code == 401) {
            response.close()
            val newToken = runBlocking { refreshToken() }
            if (newToken != null) {
                val retryRequest = request.newBuilder()
                    .header("Authorization", "Bearer $newToken")
                    .build()
                return chain.proceed(retryRequest)
            }
        }

        return response
    }

    private suspend fun refreshToken(): String? {
        val refreshToken = tokenManager.getRefreshToken() ?: return null
        return try {
            val authApi = AuthApiHolder.authApi ?: return null
            val response = authApi.refresh(
                ru.polevie.mobile.data.remote.dto.RefreshRequest(refreshToken)
            )
            if (response.isSuccessful) {
                val body = response.body() ?: return null
                tokenManager.saveTokens(body.accessToken, body.refreshToken)
                body.accessToken
            } else {
                tokenManager.clear()
                null
            }
        } catch (_: Exception) {
            null
        }
    }
}

object AuthApiHolder {
    var authApi: AuthApiService? = null
}
