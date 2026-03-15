/*\
title: trackfactory.js
type: application/javascript
module-type: library
\*/

if (!$tw.browser) return

const googlecastPlayer = require('googlecast.js')

class TrackFactory {

  static #baseurl = $tw.wiki.getTiddlerText('audiobaseurl', 'audiobaseurl not found') 

  static tiddlerTitleToTrack(tiddlerTitle) {

    const tiddler = $tw.wiki.getTiddler(tiddlerTitle)
    const fields = tiddler.fields
    const url = `${TrackFactory.#baseurl}/${fields['_mvt-filepath']}`

    if (googlecastPlayer.isAvailable) {
      // Google cast mediaInfo
      const mediaInfo = new chrome.cast.media.MediaInfo(url, 'audio/flac')
      const metadata = new chrome.cast.media.MusicTrackMediaMetadata()
      metadata.artist = tiddler.fields['_mvt-composer']
      let title = tiddler.fields['_mvt-work']
      const movement = tiddler.fields['_mvt-movement']
      if (movement) {
        title = title.concat(`, ${movement}`)
      }
      metadata.title = title
      metadata.images = [
        // query string for cache busting
        { url: `${TrackFactory.#baseurl}/${fields['_mvt-dir']}/cdcover.jpeg?ts=${Date.now()}` }
      ]
      mediaInfo.metadata = metadata

      return { tiddler, url, mediaInfo, currentTime: 0 }
    }

    else {
      return { tiddler, url, currentTime: 0 }
    }

  }

}

module.exports = TrackFactory
