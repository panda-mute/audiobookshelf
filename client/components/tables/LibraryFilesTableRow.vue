<template>
  <tr>
    <td class="px-4">
      {{ showFullPath ? file.metadata.path : file.metadata.relPath }}
    </td>
    <td>
      {{ $bytesPretty(file.metadata.size) }}
    </td>
    <td class="text-xs">
      <p v-if="file.audioFile" :class="hasZeroDuration ? 'text-red-400 font-medium' : 'text-gray-300'">{{ $secondsToTimestamp(file.audioFile.duration) }}</p>
      <p v-else class="text-gray-400">-</p>
    </td>
    <td class="text-xs">
      <div class="flex items-center">
        <p>{{ file.fileType }}</p>
        <p v-if="file.audioFile && (file.audioFile.error || (file.audioFile.probeAttempted && !file.audioFile.duration))" class="ml-2 text-red-400 flex items-center" :title="file.audioFile.error || 'Probe returned zero duration'">
          <span class="material-symbols text-sm mr-1">error</span>
          {{ $strings.LabelScanFailed }}
        </p>
      </div>
    </td>
    <td v-if="contextMenuItems.length" class="text-center">
      <ui-context-menu-dropdown :items="contextMenuItems" :menu-width="110" @action="contextMenuAction" />
    </td>
  </tr>
</template>

<script>
export default {
  props: {
    libraryItemId: String,
    showFullPath: Boolean,
    file: {
      type: Object,
      default: () => {}
    },
    inModal: Boolean
  },
  data() {
    return {}
  },
  computed: {
    userToken() {
      return this.$store.getters['user/getToken']
    },
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    userIsAdmin() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    hasZeroDuration() {
      return !!this.file.audioFile && (!this.file.audioFile.duration || isNaN(this.file.audioFile.duration))
    },
    downloadUrl() {
      return `${process.env.serverUrl}/api/items/${this.libraryItemId}/file/${this.file.ino}/download?token=${this.userToken}`
    },
    contextMenuItems() {
      const items = []
      if (this.userCanDownload) {
        items.push({
          text: this.$strings.LabelDownload,
          action: 'download'
        })
      }
      if (this.userCanDelete) {
        items.push({
          text: this.$strings.ButtonDelete,
          action: 'delete'
        })
      }
      // Currently not showing this option in the Files tab modal
      if (this.userIsAdmin && this.file.audioFile && !this.inModal) {
        items.push({
          text: this.$strings.LabelMoreInfo,
          action: 'more'
        })
      }
      // 单文件重新扫描(音轨探测失败后可在此重试)
      if (this.userIsAdmin && this.file.audioFile) {
        items.push({
          text: this.$strings.ButtonReScan,
          action: 'rescan'
        })
      }
      return items
    }
  },
  methods: {
    contextMenuAction({ action }) {
      if (action === 'delete') {
        this.deleteLibraryFile()
      } else if (action === 'download') {
        this.downloadLibraryFile()
      } else if (action === 'more') {
        this.$emit('showMore', this.file.audioFile)
      } else if (action === 'rescan') {
        this.rescanLibraryFile()
      }
    },
    deleteLibraryFile() {
      const payload = {
        message: this.$strings.MessageConfirmDeleteFile,
        callback: (confirmed) => {
          if (confirmed) {
            this.$axios
              .$delete(`/api/items/${this.libraryItemId}/file/${this.file.ino}`)
              .then(() => {
                this.$toast.success(this.$strings.ToastDeleteFileSuccess)
              })
              .catch((error) => {
                console.error('Failed to delete file', error)
                this.$toast.error(this.$strings.ToastDeleteFileFailed)
              })
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    downloadLibraryFile() {
      this.$downloadFile(this.downloadUrl, this.file.metadata.filename)
    },
    rescanLibraryFile() {
      this.$axios
        .$post(`/api/items/${this.libraryItemId}/file/${this.file.ino}/rescan`)
        .then(() => {
          this.$toast.success(this.$strings.ToastRescanUpdated)
        })
        .catch((error) => {
          console.error('Failed to rescan file', error)
          this.$toast.error(this.$strings.ToastRescanFailed)
        })
    }
  },
  mounted() {}
}
</script>
