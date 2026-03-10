package ru.polevie.mobile.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.polevie.mobile.data.remote.AuthApiService
import ru.polevie.mobile.data.remote.TokenManager
import ru.polevie.mobile.data.remote.dto.LoginRequest
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authApiService: AuthApiService,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val _email = MutableStateFlow("")
    val email: StateFlow<String> = _email.asStateFlow()

    private val _password = MutableStateFlow("")
    val password: StateFlow<String> = _password.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _loginSuccess = MutableStateFlow(false)
    val loginSuccess: StateFlow<Boolean> = _loginSuccess.asStateFlow()

    fun setEmail(value: String) {
        _email.value = value
        _error.value = null
    }

    fun setPassword(value: String) {
        _password.value = value
        _error.value = null
    }

    fun login() {
        val emailVal = _email.value.trim()
        val passwordVal = _password.value

        if (emailVal.isBlank()) {
            _error.value = "Введите email"
            return
        }
        if (passwordVal.isBlank()) {
            _error.value = "Введите пароль"
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null

            try {
                val response = authApiService.login(LoginRequest(emailVal, passwordVal))
                if (response.isSuccessful) {
                    val body = response.body()!!
                    tokenManager.saveTokens(body.accessToken, body.refreshToken)
                    tokenManager.saveUser(
                        id = body.user.id,
                        email = body.user.email,
                        firstName = body.user.firstName,
                        lastName = body.user.lastName,
                    )
                    _loginSuccess.value = true
                } else {
                    _error.value = when (response.code()) {
                        401 -> "Неверный email или пароль"
                        else -> "Ошибка входа (${response.code()})"
                    }
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Ошибка сети"
            } finally {
                _isLoading.value = false
            }
        }
    }
}
