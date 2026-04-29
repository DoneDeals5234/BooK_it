package com.bookbarber.app

import com.getcapacitor.Plugin

object CapacitorPluginRegistry {
    @JvmStatic
    fun getPlugins(): List<Class<out Plugin>> {
        return listOf(
            AlarmSchedulerPlugin::class.java
        )
    }
}
