package com.example.app.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun SettingsScreen() {
    val notificationsEnabled = remember { mutableStateOf(true) }

    Column(modifier = Modifier.padding(8.dp)) {
        Text(text = "Settings", fontSize = 24.sp)

        Switch(
            checked = notificationsEnabled.value,
            onCheckedChange = { notificationsEnabled.value = it },
        )

        Text(text = "Edit Profile")
    }
}
