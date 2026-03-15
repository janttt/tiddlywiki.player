/*\
title: audiocontrollermanager.js
type: application/javascript
module-type: library
\*/

if (!$tw.browser) return

class AudioControllerManager {

  #audioControllers
  currentAudioController

  constructor() {
    this.#audioControllers = new Map()
  }

  register(uuid, audioController) {
    this.#audioControllers.set(uuid, audioController)
  }

  unregister(uuid) {
    this.#audioControllers.delete(uuid)
  }

  makeGoogleCastPlayerCurrentPlayer(googlecastPlayer) {
    this.#audioControllers.forEach((audioController) => {
      audioController.currentPlayer = googlecastPlayer
    })
  }

  makeAudioPlayerCurrentPlayer() {
    this.#audioControllers.forEach((audioController) => {
      audioController.currentPlayer = audioController.audioPlayer
    })
  }

}

module.exports = new AudioControllerManager()
