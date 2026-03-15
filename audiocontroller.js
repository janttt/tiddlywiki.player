/*\
title: audiocontroller.js
type: application/javascript
module-type: library
\*/

if (!$tw.browser) return

const secondsToTime = require('anttt-kit.js').secondsToTime
const showToast     = require('anttt-kit.js').showToast

const AudioPlayer             = require('audioplayer.js')
const googlecastPlayer        = require('googlecast.js')
const audioControllerManager = require('audiocontrollermanager.js')


class AudioController extends EventTarget {

  track

  currentPlayer
  #paused = true

  #sliderInputEventCount = 0
  #resumePlaying

  #abortController = new AbortController()

  constructor(uuid, nowPlayingCurrentTime) {
    super()

    this.uuid = uuid
    this.nowPlayingCurrentTime = nowPlayingCurrentTime

    this.audioPlayer = new AudioPlayer(uuid)

    this.audioControls = document.createElement('span')
    this.audioControls.id = `${uuid}-audiocontrols`
    this.audioControls.className = 'audiocontrols'
    this.audioControls.innerHTML = `
      <button class="audiocontrols-play-pause-button" disabled>
        <svg class="audiocontrols-play-icon" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 9.8625 10.1681">
          <g>
            <rect height="10.1681" opacity="0" width="9.8625" x="0" y="0"/>
            <path d="M0.871563 9.32774C0.871563 9.89625 1.20242 10.1603 1.59258 10.1603C1.76125 10.1603 1.94313 10.1075 2.10992 10.0151L9.24274 5.82844C9.6968 5.56031 9.8625 5.38086 9.8625 5.08016C9.8625 4.77945 9.6968 4.6 9.24274 4.33187L2.10992 0.145235C1.94313 0.0528126 1.76125 0 1.59258 0C1.20242 0 0.871563 0.264063 0.871563 0.832579ZM1.73985 8.97328L1.73985 1.18703C1.73985 1.05992 1.85 1.00578 1.95961 1.06664L8.61422 4.97484C8.66836 4.99774 8.68883 5.04164 8.68883 5.08016C8.68883 5.11867 8.66836 5.15719 8.61422 5.18547L1.95961 9.09367C1.85 9.15453 1.73985 9.10039 1.73985 8.97328Z" fill-opacity="0.85"/>
          </g>
        </svg>
        <svg class="audiocontrols-pause-icon" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 6.56235 12.6342">
          <g>
            <rect height="12.6342" opacity="0" width="6.56235" x="0" y="0"/>
            <path d="M0.506642 12.624C0.792033 12.624 1.01867 12.4027 1.01867 12.1227L1.01867 0.495861C1.01867 0.21586 0.792033 0 0.506642 0C0.226641 0 0 0.21586 0 0.495861L0 12.1227C0 12.4027 0.226641 12.624 0.506642 12.624ZM5.64406 12.624C5.92406 12.624 6.1561 12.4027 6.1561 12.1227L6.1561 0.495861C6.1561 0.21586 5.92406 0 5.64406 0C5.36406 0 5.13742 0.21586 5.13742 0.495861L5.13742 12.1227C5.13742 12.4027 5.36406 12.624 5.64406 12.624Z" fill-opacity="0.85"/>
          </g>
        </svg>
      </button>

      <span class="audiocontrols-current-time" style="width: 2.7rem; text-align: end;margin-left: 1rem; margin-right: 4px">00:00</span>/
      <span class="audiocontrols-duration" style="margin-left: 4px; margin-right: 1rem">00:00</span>

      <input class="audiocontrols-slider" style="margin-right: 1rem" type="range" value="0" disabled/>

      <button class="audiocontrols-mute-unmute-button" disabled>
        <svg class="audiocontrols-speaker-icon" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 16.6086 11.7915">
          <g>
            <rect height="11.7915" opacity="0" width="16.6086" x="0" y="0"/>
            <path d="M13.8784 11.706C14.0697 11.8445 14.3335 11.7912 14.475 11.5729C15.5324 10.0169 16.2023 8.09812 16.2023 5.89187C16.2023 3.68562 15.5163 1.77226 14.475 0.210851C14.3335-0.0128213 14.0697-0.0607901 13.8784 0.0777258C13.6811 0.216242 13.6493 0.471711 13.7986 0.697805C14.7439 2.1207 15.3718 3.86132 15.3718 5.89187C15.3718 7.91702 14.7439 9.66843 13.7986 11.0859C13.6493 11.312 13.6811 11.5675 13.8784 11.706Z" fill-opacity="0.85"/>
            <path d="M11.642 10.0816C11.8441 10.2147 12.0893 10.1745 12.2356 9.96405C13.0193 8.90234 13.4918 7.40882 13.4918 5.89187C13.4918 4.37491 13.0247 2.87062 12.2356 1.81968C12.0893 1.60921 11.8441 1.56905 11.642 1.70218C11.4423 1.83773 11.4075 2.08835 11.567 2.31445C12.2615 3.27749 12.6505 4.55843 12.6505 5.89187C12.6505 7.2253 12.2507 8.50085 11.567 9.46929C11.4129 9.69538 11.4423 9.94601 11.642 10.0816Z" fill-opacity="0.85"/>
            <path d="M9.43383 8.48351C9.61977 8.60585 9.87039 8.56866 10.0167 8.36062C10.4855 7.74288 10.7783 6.84523 10.7783 5.89187C10.7783 4.93851 10.4855 4.04624 10.0167 3.42312C9.87039 3.21507 9.61977 3.17788 9.43383 3.30562C9.22039 3.45734 9.1832 3.72116 9.35109 3.94726C9.73492 4.46765 9.93695 5.14491 9.93695 5.89187C9.93695 6.63882 9.72953 7.31069 9.35109 7.83647C9.18859 8.06796 9.22039 8.3264 9.43383 8.48351Z" fill-opacity="0.85"/>
            <path d="M1.16024 8.32171L2.94141 8.32171C3.00766 8.32171 3.0618 8.34218 3.10516 8.38312L5.90867 10.886C6.16656 11.1194 6.38266 11.2376 6.65453 11.2376C7.01828 11.2376 7.28883 10.9663 7.28883 10.5966L7.28883 1.22484C7.28883 0.860538 7.01828 0.554444 6.64375 0.554444C6.37188 0.554444 6.19055 0.682959 5.90867 0.938429L3.10516 3.43562C3.0618 3.47655 3.00766 3.49218 2.94141 3.49218L1.16024 3.49218C0.377501 3.49218 0 3.89015 0 4.71359L0 7.11296C0 7.93101 0.385313 8.32171 1.16024 8.32171ZM1.19258 7.53132C0.950705 7.53132 0.84133 7.42491 0.84133 7.17523L0.84133 4.64351C0.84133 4.39679 0.950705 4.28499 1.19258 4.28499L3.1468 4.28499C3.30977 4.28499 3.42938 4.26155 3.57242 4.12632L6.24711 1.69624C6.28266 1.66554 6.31633 1.64023 6.35969 1.64023C6.40602 1.64023 6.44211 1.6739 6.44211 1.73046L6.44211 10.0538C6.44211 10.1182 6.40602 10.1519 6.36211 10.1519C6.32602 10.1519 6.29234 10.1362 6.24953 10.0929L3.57242 7.68999C3.4318 7.56499 3.30977 7.53132 3.1468 7.53132Z" fill-opacity="0.85"/>
          </g>
        </svg>
        <svg class="audiocontrols-speaker-slash-icon" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 12.7209 13.5587">
          <g>
            <rect height="13.5587" opacity="0" width="12.7209" x="0" y="0"/>
            <path d="M2.7543 5.35144C2.73681 5.3995 2.72866 5.45799 2.72866 5.52707L2.72866 8.05878C2.72866 8.30847 2.83264 8.41488 3.0799 8.41488L5.02873 8.41488C5.19709 8.41488 5.31912 8.44855 5.45975 8.57355L8.13147 10.9764C8.17428 11.0198 8.20795 11.0354 8.24943 11.0354C8.29334 11.0354 8.32943 11.0018 8.32943 10.9374L8.32943 10.9237L9.12681 11.7206C9.0398 11.9618 8.81938 12.1212 8.53647 12.1212C8.26459 12.1212 8.05389 12.0029 7.79061 11.7696L4.99248 9.26668C4.94373 9.22574 4.88959 9.20527 4.82873 9.20527L3.04217 9.20527C2.26725 9.20527 1.88193 8.81457 1.88193 7.99652L1.88193 5.59714C1.88193 5.21674 1.96365 4.92713 2.12931 4.72677ZM9.16834 2.10839L9.16834 8.67794L8.32943 7.83947L8.32943 2.61402C8.32943 2.55746 8.29334 2.52379 8.24162 2.52379C8.19584 2.52379 8.16217 2.5491 8.12904 2.5798L5.47996 4.99148L4.862 4.37384C4.90959 4.36903 4.95282 4.35248 4.99248 4.31917L7.79061 1.82199C8.07787 1.56652 8.25381 1.438 8.52569 1.438C8.90561 1.438 9.16834 1.7441 9.16834 2.10839Z" fill-opacity="0.85"/>
            <path d="M11.1269 12.7643C11.2894 12.9268 11.5581 12.9268 11.7152 12.7643C11.8772 12.5969 11.8801 12.3385 11.7152 12.1735L1.3824 1.84613C1.22233 1.69144 0.953654 1.6812 0.788731 1.84613C0.6292 2.00566 0.6292 2.28269 0.788731 2.44222Z" fill-opacity="0.85"/>
          </g>
        </svg>
      </button>
    `

    this.playOrPauseButton   = this.audioControls.querySelector('.audiocontrols-play-pause-button')
    this.playIcon            = this.audioControls.querySelector('.audiocontrols-play-icon')
    this.pauseIcon           = this.audioControls.querySelector('.audiocontrols-pause-icon')
    this.currentTimeText     = this.audioControls.querySelector('.audiocontrols-current-time')
    this.durationText        = this.audioControls.querySelector('.audiocontrols-duration')
    this.slider              = this.audioControls.querySelector('.audiocontrols-slider')
    this.muteOrUnmuteButton  = this.audioControls.querySelector('.audiocontrols-mute-unmute-button')
    this.speakerIcon         = this.audioControls.querySelector('.audiocontrols-speaker-icon')
    this.speakerSlashIcon    = this.audioControls.querySelector('.audiocontrols-speaker-slash-icon')

    this.playOrPauseButton.addEventListener('click', () => {
      if (audioControllerManager.currentAudioController !== this) {
        if (audioControllerManager.currentAudioController !== null) {
          audioControllerManager.currentAudioController.pause()
        }
        audioControllerManager.currentAudioController = this
        if (googlecastPlayer.isAvailable) {
          googlecastPlayer.setAudioController(this)
        }
        this.currentPlayer.play(this.track)
      } else {
        this.currentPlayer.playOrPause()
      }
    }, { signal: this.#abortController.signal })

    this.slider.addEventListener('input', () => {
      if (this.#sliderInputEventCount === 0) {
        this.#resumePlaying = !this.#paused
        this.currentPlayer.pause()
      }
      this.currentTimeText.textContent = secondsToTime(this.slider.value)
      this.#sliderInputEventCount++    
    }, { signal: this.#abortController.signal })

    this.slider.addEventListener('change', () => {
      this.currentPlayer.seek(this.slider.value)
      if (this.#resumePlaying) {
        this.play()
      }
      this.#sliderInputEventCount = 0  
    }, { signal: this.#abortController.signal })

    this.muteOrUnmuteButton.addEventListener('click', () => {
      this.currentPlayer.muteOrUnmute()
    }, { signal: this.#abortController.signal })

    this.audio = this.audioPlayer.audio

    this.audio.addEventListener('loadedmetadata', () => {
      this.durationText.textContent = secondsToTime(this.audio.duration)
      this.slider.max = this.audio.duration
      this.currentTimeText.textContent = secondsToTime(this.audio.currentTime)
      this.slider.value = this.audio.currentTime
    }, { signal: this.#abortController.signal })

    // canplay is also triggered after a slider change
    this.audio.addEventListener('canplay', () => {
      this.enable()
    }, { signal: this.#abortController.signal })

    this.audio.addEventListener('play', () => {
      document.querySelectorAll('audio').forEach((audio) => {
        if (audio !== this.audio) {
          audio.pause()
        }
      })
      this.playIcon.style.display  = 'none'
      this.pauseIcon.style.display = 'block'
      this.#paused = false
    }, { signal: this.#abortController.signal })

    this.audio.addEventListener('pause', () => {
      this.playIcon.style.display  = 'block'
      this.pauseIcon.style.display = 'none'
      this.#paused = true
    }, { signal: this.#abortController.signal })

    this.audio.addEventListener('timeupdate', () => {
      const currentTime = this.audio.currentTime
      this.track.currentTime = currentTime
      this.currentTimeText.textContent = secondsToTime(currentTime)
      this.slider.value = currentTime
      // De eerste timeupdate komt voor het loadedmetadata event.
      // audio.duration is op dat moment nog niet beschikbaar (isNaN),
      if (!Number.isNaN(this.audio.duration)) {
        this.nowPlayingCurrentTime.innerText = `${this.currentTimeText.textContent} / ${this.durationText.textContent}`
      }
    }, { signal: this.#abortController.signal })

    this.audio.addEventListener('volumechange', () => {
      this.speakerIcon.style.display = this.audio.muted ? 'none' : 'block'
      this.speakerSlashIcon.style.display = this.audio.muted ? 'block' : 'none'
    }, { signal: this.#abortController.signal })

    this.audio.addEventListener('ended', () => {
      this.track.currentTime = 0
      this.dispatchEvent(new Event('ended'))
    }, { signal: this.#abortController.signal })

    this.audio.addEventListener('error', () => {
      console.log(`Audio error: ${this.audio.error}`)

      showToast(
        `De track<br>
        <a href="${this.track.url}" target="_blank">${this.track.url}</a><br>
        kan niet gespeeld worden.`)

      this.playIcon.style.display  = 'block'
      this.pauseIcon.style.display = 'none'
      this.durationText.textContent = secondsToTime(0)
      this.currentTimeText.textContent = secondsToTime(0)
      this.slider.value = 0
      this.disable()
    }, { signal: this.#abortController.signal })

    if (googlecastPlayer.isAvailable) {
      googlecastPlayer.addEventListener('ended', () => {
        this.track.currentTime = 0
        this.dispatchEvent(new Event('ended'))
      }, { signal: this.#abortController.signal })
    }

    audioControllerManager.register(uuid, this)

    this.currentPlayer = googlecastPlayer.isAvailable && googlecastPlayer.isConnected ? googlecastPlayer : this.audioPlayer
  }

  disable() {
    this.#disableOrEnable(true)
  }

  enable() {
    this.#disableOrEnable(false)
  }

  #disableOrEnable(value) {
    this.playOrPauseButton.disabled  = value
    this.slider.disabled             = value
    this.muteOrUnmuteButton.disabled = value
  }

  play(track) {
    if (track !== undefined) {
      this.track = track
      audioControllerManager.currentAudioController = this
      if (googlecastPlayer.isAvailable) {
        googlecastPlayer.setAudioController(this)
      }

      this.currentPlayer.play(this.track)
    } else {
      this.currentPlayer.play()
    } 
  }

  pause() {
    this.currentPlayer.pause()
  }

  cleanup() {
    audioControllerManager.unregister(this.uuid)
    if (audioControllerManager.currentAudioController === this) {
      audioControllerManager.currentAudioController = null
    }

    if (googlecastPlayer.isAvailable) {
      googlecastPlayer.resetAudioController()
    }

    this.#abortController.abort()
    this.#abortController = null

    this.audio = null
    this.audioPlayer.cleanup()
    this.audioPlayer = null
    this.currentPlayer = null
    this.audioControls = null
  }

}

module.exports = AudioController
