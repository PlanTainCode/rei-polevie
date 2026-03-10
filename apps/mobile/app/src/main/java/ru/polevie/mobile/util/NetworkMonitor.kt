package ru.polevie.mobile.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NetworkMonitor @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _isOnline = MutableStateFlow(checkCurrentConnectivity())
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private var onNetworkAvailableCallback: (() -> Unit)? = null

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            Log.d(TAG, "onAvailable")
            val wasOffline = !_isOnline.value
            _isOnline.value = true
            if (wasOffline) {
                Log.d(TAG, "Network restored, triggering sync")
                onNetworkAvailableCallback?.invoke()
            }
        }

        override fun onLost(network: Network) {
            Log.d(TAG, "onLost — checking remaining connectivity")
            _isOnline.value = checkCurrentConnectivity()
        }

        override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
            val validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            if (validated && !_isOnline.value) {
                Log.d(TAG, "Network validated, going online")
                _isOnline.value = true
                onNetworkAvailableCallback?.invoke()
            }
        }
    }

    init {
        cm.registerDefaultNetworkCallback(networkCallback)
    }

    fun setOnNetworkAvailable(callback: () -> Unit) {
        onNetworkAvailableCallback = callback
    }

    private fun checkCurrentConnectivity(): Boolean {
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    companion object {
        private const val TAG = "NetworkMonitor"
    }
}
