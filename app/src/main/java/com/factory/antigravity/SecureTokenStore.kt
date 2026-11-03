package com.factory.antigravity

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.net.URI
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import java.security.KeyStore

/**
 * Stores the API URL as a preference and encrypts the bearer token with an
 * AES-GCM key held by Android Keystore. The raw token is never logged.
 */
internal class SecureTokenStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun baseUrl(): String? = preferences.getString(KEY_BASE_URL, null)

    fun hasToken(): Boolean = !preferences.getString(KEY_TOKEN, null).isNullOrBlank()

    fun saveConnection(baseUrl: String, rawToken: String) {
        val normalized = baseUrl.trim().trimEnd('/')
        val uri = runCatching { URI(normalized) }.getOrNull()
        require(uri != null && uri.scheme == "https" && !uri.host.isNullOrBlank() &&
            uri.userInfo == null && uri.query == null && uri.fragment == null) {
            "Enter a valid HTTPS API base URL."
        }
        val editor = preferences.edit().putString(KEY_BASE_URL, normalized)
        if (rawToken.isNotBlank()) {
            val normalizedToken = rawToken.trim()
            require(normalizedToken.length in 32..512 && normalizedToken.matches(Regex("[A-Za-z0-9._~-]+"))) {
                "Bearer token must be 32–512 URL-safe characters."
            }
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
            val encrypted = cipher.iv + cipher.doFinal(normalizedToken.toByteArray(Charsets.UTF_8))
            editor.putString(KEY_TOKEN, Base64.encodeToString(encrypted, Base64.NO_WRAP))
        }
        editor.apply()
    }

    fun readToken(): String? {
        val encoded = preferences.getString(KEY_TOKEN, null) ?: return null
        return runCatching {
            val payload = Base64.decode(encoded, Base64.NO_WRAP)
            require(payload.size > IV_LENGTH)
            val iv = payload.copyOfRange(0, IV_LENGTH)
            val ciphertext = payload.copyOfRange(IV_LENGTH, payload.size)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(TAG_BITS, iv))
            String(cipher.doFinal(ciphertext), Charsets.UTF_8)
        }.getOrNull()
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        val existing = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    private companion object {
        const val PREFS = "antigravity_factory_connection"
        const val KEY_BASE_URL = "base_url"
        const val KEY_TOKEN = "encrypted_bearer_token"
        const val KEY_ALIAS = "antigravity_factory_api_token_v1"
        const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_LENGTH = 12
        const val TAG_BITS = 128
    }
}
