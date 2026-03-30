/*\
title: googlecast.js
type: application/javascript
module-type: library
\*/

if (!$tw.browser) return

const secondsToTime = require('anttt-kit.js').secondsToTime
const showToast     = require('anttt-kit.js').showToast

const audioControllerManager = require('audiocontrollermanager.js')

class GoogleCastPlayer extends EventTarget {

  isAvailable = false

  audioController
  nowPlayingCurrentTime

  #session
  #sessionState

  #loading = false

  #mediaSession
  #currentMediaSessionId

  #mediaInfoOnPlayerChange
  #currentTimeOnPlayerChange
  #pausedOnPlayerChange

  constructor() {
    super()

    window['__onGCastApiAvailable'] = (isAvailable) => {
      if (isAvailable) {
        this.initializeCastApi()
        // The Google Cast SDK shows the cast button only after the browser has discovered
        // Cast devices (via mDNS). For security reasons device discovery is managed by the browser
        // (it can be triggered by e.g. View > Cast... in Chrome). It cannot be triggered by applications.
        // Setting display to 'block' here ensures the cast button is visible BEFORE device discovery, which
        // allows the user to trigger device discovery from within the application by clicking it.
        const castbutton = document.getElementById('castbutton')
        castbutton.style.display = 'block'
        this.isAvailable = true
      }
    }

    window.addEventListener('beforeunload', () => {
      if (this.#session) {
        this.#session.endSession(true)
      }
    })

  }

  initializeCastApi() {
    const options = {
      receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
    }
    const context = cast.framework.CastContext.getInstance()
    context.setOptions(options)

    this.remotePlayer = new cast.framework.RemotePlayer()
    this.remotePlayerController = new cast.framework.RemotePlayerController(this.remotePlayer)

    context.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, (e) => {
      this.#sessionState = e.sessionState
      if (e.sessionState === cast.framework.SessionState.SESSION_ENDED) {
        this.#mediaInfoOnPlayerChange   = this.remotePlayer.mediaInfo
        this.#currentTimeOnPlayerChange = this.remotePlayer.currentTime
        this.#pausedOnPlayerChange      = this.remotePlayer.isPaused
      }
    })

    this.remotePlayerController.addEventListener(cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED, () => {
      let playerColor
      if (this.remotePlayer.isConnected) {
        audioControllerManager.makeGoogleCastPlayerCurrentPlayer(this)
        playerColor = getComputedStyle(document.documentElement).getPropertyValue("--google-cast-player-color").trim()
      } else {
        audioControllerManager.makeAudioPlayerCurrentPlayer()
        playerColor = getComputedStyle(document.documentElement).getPropertyValue("--audio-player-color").trim()
      }

      document.documentElement.style.setProperty('--player-color', playerColor)

      this.changePlayer()
    })

    // next track
    this.remotePlayerController.addEventListener(cast.framework.RemotePlayerEventType.IS_MEDIA_LOADED_CHANGED, () => {
        const mediaSession = cast.framework.CastContext.getInstance().getCurrentSession()?.getMediaSession()
        if (!mediaSession || mediaSession.mediaSessionId === this.#currentMediaSessionId) return
        this.#currentMediaSessionId = mediaSession.mediaSessionId
        // play next track
        mediaSession.addUpdateListener(() => {
          if (mediaSession.playerState === 'IDLE' && mediaSession.idleReason === 'FINISHED') {
            this.dispatchEvent(new Event('ended'))
          }
        })
      }
    )

    this.remotePlayerController.addEventListener(cast.framework.RemotePlayerEventType.DURATION_CHANGED, () => {
      if (this.#sessionState === cast.framework.SessionState.SESSION_ENDED) return
      const duration = this.remotePlayer.duration
      this.audioController.durationText.textContent = secondsToTime(duration)
      this.audioController.slider.max = duration
    })

    this.remotePlayerController.addEventListener(cast.framework.RemotePlayerEventType.CURRENT_TIME_CHANGED, () => {
      if (this.#sessionState === cast.framework.SessionState.SESSION_ENDED) return
      // loading a new media resets currentTime of the player to 0
      if (this.#loading) return
      // audioController is null on resetAudioController
      if (!this.audioController) return
      const currentTime = this.remotePlayer.currentTime
      this.audioController.track.currentTime = currentTime
      this.audioController.currentTimeText.textContent = secondsToTime(currentTime)
      this.audioController.slider.value = currentTime
      this.nowPlayingCurrentTime.innerText =
        `${this.audioController.currentTimeText.textContent} / ${this.audioController.durationText.textContent}`
    })

    this.remotePlayerController.addEventListener(cast.framework.RemotePlayerEventType.IS_MUTED_CHANGED, (e) => {
      const muted = e.value
      this.audioController.speakerIcon.style.display = muted ? 'none' : 'block'
      this.audioController.speakerSlashIcon.style.display = muted ? 'block' : 'none'
    })

    this.remotePlayerController.addEventListener(cast.framework.RemotePlayerEventType.IS_PAUSED_CHANGED, (e) => {
      const paused = e.value
      this.audioController.paused = paused
      this.audioController.playIcon.style.display  = paused ? 'block' : 'none'
      this.audioController.pauseIcon.style.display = paused ? 'none' : 'block'
    })

  }

  get isConnected() {
    return this.remotePlayer.isConnected
  }

  setAudioController(audioController) {
    if (audioController === this.audioController) { return }

    // Pause the previously active audio controller (if there is one)
    this.audioController?.pause()

    this.audioController = audioController
    this.track = this.audioController.track
    this.nowPlayingCurrentTime = this.audioController.nowPlayingCurrentTime
    this.audioPlayer = this.audioController.audioPlayer
    this.audio = this.audioPlayer.audio
  }

  resetAudioController() {
    this.pause()
    this.audioController = null
    this.track = null
    this.audioPlayer = null
    this.audio = null
  }

  async changePlayer() {

    // to Google Cast player
    if (this.remotePlayer.isConnected) {

      // There is no audioController yet if casting is started before music is selected.
      // currentPlayer is then GoogleCastPlayer.
      // See audiocontroller.js
      if (this.audioController) {
        this.audioController.currentPlayer = this
      }

      this.#session = cast.framework.CastContext.getInstance().getCurrentSession()
      if (this.audio && this.track) {

        this.pausedOnPlayerChange = this.audio.paused
        this.audio.pause()

        try {
          const track = this.audioController.track
          this.#loading = true
          const mediaSession = await this.load(track.mediaInfo)
          this.#loading = false
          const seekRequest = new chrome.cast.media.SeekRequest()
          seekRequest.currentTime = track.currentTime
          mediaSession.seek(seekRequest)

          // muteUnMute has no effect if no media is loaded
          if ((this.audio.muted && !this.remotePlayer.isMuted) || (!this.audio.muted && this.remotePlayer.isMuted)) {
            this.muteOrUnmute()
          } 

          if (!this.pausedOnPlayerChange) {
            mediaSession.play()
          }
        } catch(err) {
          console.log(`changePlayer error: ${err}`)
        }
      }
    }

    // to current audio player
    else {
      this.audioController.currentPlayer = this.audioController.audioPlayer

      if (this.#mediaInfoOnPlayerChange) {
        this.audio.src = this.audioController.track.mediaInfo.contentId
        this.audio.currentTime = this.#currentTimeOnPlayerChange
        this.audio.muted = this.remotePlayer.isMuted
        if (!this.#pausedOnPlayerChange) {
          this.audio.play()
        }
      }
    }
  }

  load(mediaInfo) {
    return new Promise((resolve, reject) => {
      const request = new chrome.cast.media.LoadRequest(mediaInfo)
      request.autoplay = false
      this.#session.addEventListener(
        cast.framework.SessionEventType.MEDIA_SESSION,
        (e) => {
          resolve(e.mediaSession)
          this.audioController.enable()
        },
        { once: true }
      )
      this.#session.loadMedia(request)
        .catch(reject)
    })
  }

  async play(track) {
    if (track !== undefined) {
      if (!this.#mediaSession || (track.mediaInfo.contentId !== this.#mediaSession.media.contentId)) {
        try {
          this.#loading = true
          this.#mediaSession = await this.load(track.mediaInfo)
          this.#loading = false
          const seekRequest = new chrome.cast.media.SeekRequest()
          seekRequest.currentTime = track.currentTime
          this.#mediaSession.seek(seekRequest)
          this.#mediaSession.play()
        } catch(err) {
          console.log(`play error: ${err}`)

          showToast(
            `De track<br>
            <a href="${this.track.mediaInfo.contentId}" target="_blank">${this.track.mediaInfo.contentId}</a><br>
            kan niet gespeeld worden.`)
        }
      }
    } else {
      if (this.remotePlayer.isPaused) {
        this.remotePlayerController.playOrPause()
      }
    }
  }

  pause() {
    if (!this.remotePlayer.isPaused) {
      this.remotePlayerController.playOrPause()
    }
  }

  playOrPause() {
    this.remotePlayerController.playOrPause()
  }

  seek(currentTime) {
    this.remotePlayer.currentTime = currentTime
    this.remotePlayerController.seek()
  }

  muteOrUnmute() {
    this.remotePlayerController.muteOrUnmute()
  }

}

module.exports = new GoogleCastPlayer()
