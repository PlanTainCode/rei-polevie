package ru.polevie.mobile.data.remote.dto

data class LoginRequest(
    val email: String,
    val password: String,
)

data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: UserDto,
)

data class RefreshRequest(
    val refreshToken: String,
)

data class RefreshResponse(
    val accessToken: String,
    val refreshToken: String,
)

data class UserDto(
    val id: String,
    val email: String,
    val firstName: String,
    val lastName: String,
    val role: String?,
)
