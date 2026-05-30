package com.mec.campusone

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

class FilePickerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var pendingPromise: Promise? = null
  private val pickerRequestCode = 9021

  private val activityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != pickerRequestCode) return

      val promise = pendingPromise
      pendingPromise = null

      if (promise == null) return

      if (resultCode != Activity.RESULT_OK || data?.data == null) {
        promise.reject("PICKER_CANCELLED", "File selection was cancelled")
        return
      }

      val uri = data.data!!
      reactContext.contentResolver.takePersistableUriPermission(
        uri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION
      )

      val result = WritableNativeMap().apply {
        putString("uri", uri.toString())
        putString("name", getDisplayName(uri))
        putString("type", reactContext.contentResolver.getType(uri) ?: "application/pdf")
      }

      promise.resolve(result)
    }
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "AndroidFilePicker"

  @ReactMethod
  fun pickPdf(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Current activity is not available")
      return
    }
    if (pendingPromise != null) {
      promise.reject("PICKER_BUSY", "A file picker request is already in progress")
      return
    }

    pendingPromise = promise

    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "application/pdf"
      putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/pdf"))
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
    }

    try {
      activity.startActivityForResult(intent, pickerRequestCode)
    } catch (error: Exception) {
      pendingPromise = null
      promise.reject("PICKER_OPEN_FAILED", error.message, error)
    }
  }

  private fun getDisplayName(uri: Uri): String {
    reactContext.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
      val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
      if (index >= 0 && cursor.moveToFirst()) {
        return cursor.getString(index) ?: "proof.pdf"
      }
    }
    return "proof.pdf"
  }
}
