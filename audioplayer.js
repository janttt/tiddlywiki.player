/*\
title: audioplayer.js
type: application/javascript
module-type: library
\*/

if (!$tw.browser) return

class AudioPlayer {

  constructor(uuid) {
    this.audio = document.createElement('audio')
    this.audio.id = `${uuid}-audio}`
  }

  play(track) {
    if (track !== undefined) {
      this.audio.src = track.url
      this.audio.currentTime = track.currentTime
    }
    this.audio.play()
  }

  pause() {
    this.audio.pause()
  }

  playOrPause() {
    if (this.audio.paused) {
      this.audio.play()
    } else {
      this.audio.pause()
    }
  }

  seek(currentTime) {
    this.audio.currentTime = currentTime
  }

  muteOrUnmute() {
    this.audio.muted = !this.audio.muted
  }

  cleanup() {
    this.audio.pause()
    this.audio.src = ''
    this.audio = null
  }

}

module.exports = AudioPlayer
