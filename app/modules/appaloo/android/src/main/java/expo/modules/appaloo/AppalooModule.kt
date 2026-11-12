package expo.modules.appaloo

import com.appaloo.AppalooClient
import com.appaloo.AdDetails
import com.appaloo.InterstitialCallbacks
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AppalooModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("Appaloo")

        Function("isAvailable") {
            true
        }

        AsyncFunction("loadInterstitial") { adId: String, promise: Promise ->

            val activity = appContext.currentActivity

            if (activity == null) {
                promise.resolve(
                    mapOf("success" to false, "reason" to "no_activity")
                )
                return@AsyncFunction
            }

            activity.runOnUiThread {
                try {
                    val client = AppalooClient(adId)

                    client.loadInterstitial(
                        activity,
                        object : InterstitialCallbacks {

                            override fun onAdLoaded(adDetails: AdDetails) {
                                promise.resolve(
                                    mapOf(
                                        "success" to true,
                                        "appName" to adDetails.appName,
                                        "adId" to adId
                                    )
                                )
                            }

                            override fun onAdLoadFailed(
                                errorCode: Int,
                                message: String
                            ) {
                                promise.resolve(
                                    mapOf(
                                        "success" to false,
                                        "reason" to "ad_load_failed",
                                        "errorCode" to errorCode,
                                        "message" to message,
                                        "adId" to adId
                                    )
                                )
                            }
                        }
                    )
                } catch (error: Exception) {
                    promise.resolve(
                        mapOf(
                            "success" to false,
                            "reason" to "native_error",
                            "message" to (error.message ?: "Unknown error")
                        )
                    )
                }
            }
        }
    }
}
