package ru.polevie.mobile.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import ru.polevie.mobile.data.remote.dto.LoginRequest
import ru.polevie.mobile.data.remote.dto.LoginResponse
import ru.polevie.mobile.data.remote.dto.RefreshRequest
import ru.polevie.mobile.data.remote.dto.RefreshResponse
import ru.polevie.mobile.data.remote.dto.UserDto

interface AuthApiService {

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("auth/refresh")
    suspend fun refresh(@Body request: RefreshRequest): Response<RefreshResponse>

    @GET("auth/profile")
    suspend fun getProfile(): Response<UserDto>
}
