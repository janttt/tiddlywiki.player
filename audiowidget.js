/*\
title: audiowidget.js
type: application/javascript
module-type: widget
\*/

/* eslint-env browser, node */
/* global $tw:false */

/*
AudioWidget

Attributes:

  sources
    a list of one or more tiddler titles
  sourcesType
    cd
    selection
    movement
*/

if (!$tw.browser) return

(function() {

  "use strict"

  const Widget = require("$:/core/modules/widgets/widget.js").widget

  const AudioController = require('audiocontroller.js')
  const TrackFactory = require('trackfactory.js')

  // now playing checkbox and popup

  let topbarRight
  let showNowPlaying
  let nowPlayingBackground
  let nowPlayingCDCover
  let nowPlayingComposer
  let nowPlayingWork
  let nowPlayingMovement
  let nowPlayingPerformers
  let nowPlayingCurrentTime

  document.addEventListener('DOMContentLoaded', function() {
    topbarRight = document.querySelector(".tc-topbar-right")

    // defined in the tiddler $:/tags/SideBarSegment tiddler Menu 
    const showNowPlayingCheckbox = document.querySelector(".nowplaying-checkbox > input")
    showNowPlayingCheckbox.checked = false
    showNowPlaying = false
    showNowPlayingCheckbox.addEventListener('click', () => {
      showNowPlaying = showNowPlayingCheckbox.checked
    })

    nowPlayingBackground = document.createElement("div")
    nowPlayingBackground.className = "nowplaying-background"
    document.body.appendChild(nowPlayingBackground)

    const nowPlayingPopup = document.createElement("button")
    nowPlayingPopup.type = 'button'
    nowPlayingPopup.className = "nowplaying-popup"
    nowPlayingPopup.innerHTML = `
      <img class="nowplaying-cdcover"/>
      <div class="nowplaying-composer"></div>
      <div class="nowplaying-work"></div>
      <div class="nowplaying-movement"></div>
      <div class="nowplaying-performers"></div>
      <div id="nowplaying-currenttime" class="nowplaying-currenttime"></div>
    `
    nowPlayingPopup.addEventListener('click', () => {
      nowPlayingBackground.style.display = "none"
      topbarRight.style.display = "block"
    })
    nowPlayingCDCover     = nowPlayingPopup.querySelector('.nowplaying-cdcover')
    nowPlayingComposer    = nowPlayingPopup.querySelector('.nowplaying-composer')
    nowPlayingWork        = nowPlayingPopup.querySelector('.nowplaying-work')
    nowPlayingMovement    = nowPlayingPopup.querySelector('.nowplaying-movement')
    nowPlayingPerformers  = nowPlayingPopup.querySelector('.nowplaying-performers')
    nowPlayingCurrentTime = nowPlayingPopup.querySelector('#nowplaying-currenttime')
    nowPlayingBackground.appendChild(nowPlayingPopup)
  })
 
  /**
  AudioWidget
  */
  class AudioWidget extends Widget {

    #tracks

    #uuid

    #trackList
    #rows
    #currentRow
    #currentTrackElement

    // styles for highlighting the data used to sort

    #sortByCD              = "text-secondary"
    #sortByWork            = "text-primary"
    #sortByMovement        = "text-primary"
    #sortByMovementNumber  = "text-primary"
    #sortByKey             = "text-primary"
    #sortByComposer        = "text-secondary"
    #sortByPerformers      = "text-secondary"

    #abortController = new AbortController()

    constructor(parseTreeNode, options) {
      super(parseTreeNode, options)
    }

    render(parent, nextSibling) {

      this.computeAttributes()
      const sources = this.getAttribute("sources")
      const sourcesType = this.getAttribute("sourcesType")

      const tiddlerTitles = sources.trim().split(/><|\n/)

      if (tiddlerTitles.length === 1 && tiddlerTitles[0].length === 0) {
        const noSearchResults = document.createElement("span")
        noSearchResults.className = "no-results"
        const noSearchResultsText = document.createTextNode("∅")
        noSearchResults.appendChild(noSearchResultsText)
        parent.insertBefore(noSearchResults,nextSibling)
        this.domNodes.push(noSearchResults)
        return
      }

      this.#tracks = []

      this.#uuid = crypto.randomUUID()

      let row

      // the table that contains the audio controller

      const audioTable = document.createElement("table")
      audioTable.className = "table"

      row = audioTable.insertRow()
      const cell = row.insertCell()
      this.audioController = new AudioController(this.#uuid, nowPlayingCurrentTime)
      cell.appendChild(this.audioController.audioControls)

      parent.insertBefore(audioTable, nextSibling)
      this.domNodes.push(audioTable)

      // the table that contains the radiobuttons for sorting (only for selection sourcesType)

      if (sourcesType === "selection") {
        const sortRadiobuttonsTable = document.createElement("table")
        sortRadiobuttonsTable.className = "table"
        sortRadiobuttonsTable.classList.add("sort")

        row = sortRadiobuttonsTable.insertRow()

        const sort = document.createElement("div")
        sort.className = "display-table"
        sort.classList.add("radiobuttons-margin-top")

        const sortby = document.createElement("div")
        sortby.className = "display-table-cell"
        sort.appendChild(sortby)

        const sortbyText = document.createElement("span")
        sortby.className = "sort-by"
        sortby.appendChild(sortbyText)
        sortby.textContent = "sort by:"

        const radiobuttons = document.createElement("div")
        radiobuttons.className = "display-table-cell"
        radiobuttons.classList.add("radiobuttons")
        sort.appendChild(radiobuttons)

        const firstRow = document.createElement("div")
        radiobuttons.appendChild(firstRow)

        this.#addRadiobutton(radiobuttons, "CD", true)
        this.#addRadiobutton(radiobuttons, "track number")

        const secondRow = document.createElement("div")
        radiobuttons.appendChild(secondRow)

        this.#addRadiobutton(radiobuttons, "composer")
        this.#addRadiobutton(radiobuttons, "work")
        this.#addRadiobutton(radiobuttons, "movement")
        this.#addRadiobutton(radiobuttons, "movement number")
        this.#addRadiobutton(radiobuttons, "performers")
        this.#addRadiobutton(radiobuttons, "key")

        const cell = row.insertCell()
        cell.appendChild(sort)

        parent.insertBefore(sortRadiobuttonsTable, nextSibling)
        this.domNodes.push(sortRadiobuttonsTable)
      }

      // the tables that contain the tracks

      this.#trackList = document.createElement("table")
      this.#trackList.className = "table"
      this.#trackList.classList.add("music")
      this.#trackList.addEventListener('click', (e) => this.#trackListItemClicked(e),
        { signal: this.#abortController.signal })

      parent.insertBefore(this.#trackList, nextSibling)
      this.domNodes.push(this.#trackList)

      if (sourcesType === "selection") {
        this.#trackList.classList.add("movements")
        tiddlerTitles.forEach((tiddlerTitle) => {
          this.#tracks.push(TrackFactory.tiddlerTitleToTrack(tiddlerTitle))
        })

        // default sort: by CD title (title without the album ID) and within each CD by track number
        this.#sortTiddlersByTrackNumber()
        this.#sortTiddlersByCD()
        this.#sortByCD = "sort-data-secondary"
      } else if (sourcesType === "movement") {
        this.#tracks.push(TrackFactory.tiddlerTitleToTrack(tiddlerTitles[0]))
      }

      switch (sourcesType) {
        case "cd":
          this.#trackList.innerHTML = this.#getTracks(tiddlerTitles)
          break
        case "selection":
          this.#trackList.innerHTML = this.#getMovements(tiddlerTitles)
          // used for sorting
          this.#rows = Array.from(this.#trackList.rows).map(row => {
            // i is the track's index in trackTiddlers
            const i = row.querySelector('[id*="t"]').id.match(/\d+$/)[0]
            const track = this.#tracks[i]
            return { row, track }
          })
          break
        case "movement":
          this.#trackList.innerHTML = this.#getMovements(tiddlerTitles)
          break
      }

      this.audioController.addEventListener('ended', () => this.#nextTrack(),
        { signal: this.#abortController.signal })

      // set up for cleanup on close

      const parentTiddler = parent.closest('div.tc-tiddler-frame')

      this.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const removedNode of mutation.removedNodes) {
            if (removedNode === parentTiddler) {
              console.log(`removedNode: ${removedNode.tagName}, data-tiddler-title: ${removedNode.getAttribute? removedNode.getAttribute('data-tiddler-title') : ''}`)
              this.cleanup()
            }
          }
        }
      })

      this.observer.observe(document.querySelector("section.tc-story-river"), {
        childList: true
      })
    }

    cleanup() {
      this.observer.disconnect()
      this.observer = null

      this.#abortController.abort()
      this.#abortController = null

      this.audioController.cleanup()
      this.audioController = null

      this.domNodes = []
    }

    // private methods

    static #getSortCriterion(text) {
      const sortCriteria = {
        "CD":               "_mvt-cd",
        "track number":     "_mvt-filepath",
        "composer":         "_mvt-composer",
        "work":             "_mvt-work",
        "movement":         "_mvt-movement",
        "movement number":  "_mvt-movementNumber",
        "performers":       "_mvt-performers",
        "key":              "_mvt-key"
      }
      return sortCriteria[text]
    }

    #addRadiobutton(radiobuttons, text, checked = false) {
      const label = document.createElement("label")
      const radiobutton = document.createElement("input")
      radiobutton.addEventListener('click', (e) => this.#sortRadiobuttonClicked(e),
        { signal: this.#abortController.signal })
      radiobutton.type = "radio"
      radiobutton.name = "sort"
      radiobutton.checked = checked
      label.appendChild(radiobutton)
      const span = document.createElement("span")
      span.textContent = text
      label.appendChild(span)
      radiobuttons.appendChild(label)
    }

    // constructs the rows with the movements
    #getMovements(tiddlerTitles) {
      let trackListItems = new String()

      if (tiddlerTitles[0] === "MovementTemplate") { return trackListItems }

      this.#tracks.forEach((track, i) => {
        const trackTiddler = track.tiddler
        const cdcoverpath     = trackTiddler.fields['_mvt-dir'] + "/cdcover.jpeg"
        const cd              = trackTiddler.fields['_mvt-cd'].replace(/^[A-Z0-9- ]+: /, "")
        const work            = trackTiddler.fields['_mvt-work']
        const movement        = trackTiddler.fields['_mvt-movement']
        const movementNumber  = trackTiddler.fields['_mvt-movementNumber']
        const key             = trackTiddler.fields['_mvt-key']
        const composer        = trackTiddler.fields['_mvt-composer']
        const performers      = trackTiddler.fields['_mvt-performers']
        trackListItems = trackListItems.concat(
          `<tr>
            <td id="${this.#uuid}+i${i}" class="infoButton">&#9432</td>
            <td><img id="${this.#uuid}+c${i}" src="${cdcoverpath}" width="64"/></td>
            <td>
              <div id="${this.#uuid}+t${i}" class="pointer">
                <span data-type="work" class="${this.#sortByWork}">${work}</span>${movement ? `,
                <span data-type="movementNumber" class="${this.#sortByMovementNumber}">${movementNumber}. </span> <span data-type="movement" class="${this.#sortByMovement}">${movement}</span>` : ""}
                ${key ? `(<span data-type="key" class="${this.#sortByKey}">${key}</span>)` : ""}
              </div>
              <div>
                <span data-type="composer" class="${this.#sortByComposer}">${composer}</span> -- <span data-type="performers" class="${this.#sortByPerformers}">${performers}</span>
              </div>
              <div id="${this.#uuid}+c${i}" data-type="CD" class="${this.#sortByCD} pointer">${cd}</div>
            </td>
          </tr>`
        )
      })

      return trackListItems
    }

    // constructs the rows with CD's tracks
    #getTracks(tiddlerTitles) {
      let trackListItems = new String()

      if (tiddlerTitles[0] === "CDTemplate") return trackListItems

      // Only one tiddler, the CD tiddler
      let cd = $tw.wiki.getTiddler(tiddlerTitles[0])
      let keys = Object.keys(cd.fields)
      keys.forEach((key) => {
        if (key.startsWith('track')) {
          this.#tracks.push(TrackFactory.tiddlerTitleToTrack(cd.fields[key]))
        }
      })

      this.#tracks.forEach((track, i) => {
        const trackTiddler = track.tiddler
        trackListItems = trackListItems.concat(
          `<tr>
          <td id="${this.#uuid}+i${i}" class="infoButton">&#9432</td>
          <td>
          <div id="${this.#uuid}+t${i}" class="pointer">
          ${trackTiddler.fields['_mvt-work']
          ? trackTiddler.fields['_mvt-movement']
            ? `${trackTiddler.fields['_mvt-work']}, ${trackTiddler.fields['_mvt-movement']}`
            : `${trackTiddler.fields['_mvt-work']}`
          : `${trackTiddler.fields['_mvt-movement']}`}
          </div>
          ${trackTiddler.fields['_mvt-partOfACompilation']
          ? `<div class="text-secondary">${trackTiddler.fields['_mvt-composer']}</div>`
          : ""}
          </td>
          </tr>`)
      })

      return trackListItems
    }

    #nowPlaying(trackTiddler) {
      nowPlayingCDCover.src = `${trackTiddler.fields['_mvt-dir']}/cdcover.jpeg`
      nowPlayingComposer.textContent = `${trackTiddler.fields['_mvt-composer']}` 
      nowPlayingWork.textContent = `${trackTiddler.fields['_mvt-work']}`
      const movement = trackTiddler.fields['_mvt-movement']
      if (movement) {
        nowPlayingMovement.textContent = movement
        nowPlayingMovement.style.display = 'block'
      } else {
        nowPlayingMovement.style.display = 'none'
      }
      nowPlayingPerformers.textContent = `${trackTiddler.fields['_mvt-performers']}`

      nowPlayingBackground.style.display = 'block'
      topbarRight.style.display = "none"
    }

    #nextTrack() {
      this.#currentTrackElement.classList.remove("currentTrack")

      if (this.#currentRow.nextElementSibling) {
        this.#currentRow = this.#currentRow.nextElementSibling

        this.#currentTrackElement = this.#currentRow.querySelector('[id*="t"]')
        this.#currentTrackElement.classList.add("currentTrack")

        const i = this.#currentTrackElement.id.match(/\d+$/)[0]
        const track = this.#tracks[i]
        track.currentTime = 0

        if (showNowPlaying) {
          this.#nowPlaying(track.tiddler)
        }

        this.audioController.play(track)
      }
    }

    #sortTiddlersByCD() {
      this.#tracks.sort((t1, t2) => {
        return this.#cdComparator(t1, t2)
      })
    }

    #cdComparator(t1, t2) {
      const re = /^[A-Z0-9- ]+: /
      const cd1 = t1.tiddler.fields["_mvt-cd"].replace(re, "")
      const cd2 = t2.tiddler.fields["_mvt-cd"].replace(re, "")
      return cd1.localeCompare(cd2, "en", { numeric: true })
    }

    #sortTiddlersByTrackNumber() {
      this.#tracks.sort((t1, t2) => {
        return this.#trackNumberComparator(t1, t2)
      })
    }

    #trackNumberComparator(t1, t2) {
      const re = /^.*\/((\d+-)?\d+).*/
      const tn1 = t1.tiddler.fields["_mvt-filepath"].replace(re, "$1")
      const tn2 = t2.tiddler.fields["_mvt-filepath"].replace(re, "$1")
      return tn1.localeCompare(tn2)
    }

    #keyComparator(t1, t2) {
      const k1 = t1.tiddler.fields['_mvt-key']
      const k2 = t2.tiddler.fields['_mvt-key']
      let result
      if (k1 && k2) {
        result = k1.localeCompare(k2)
      } else if (k1) {
        result = -1
      } else if (k2) {
        result = 1
      } else {
        result = 0
      }
      return result
    }

    #movementComparator(t1, t2, sortCriterion) {
      switch (sortCriterion) {
        case '_mvt-cd':
          return this.#cdComparator(t1, t2)
        case '_mvt-filepath':
          return this.#trackNumberComparator(t1, t2)
        case '_mvt-key':
          return this.#keyComparator(t1, t2)
        default:
         return t1.tiddler.fields[sortCriterion].localeCompare(t2.tiddler.fields[sortCriterion], "en", { numeric: true })
      }
    }

    #highlightDataItems(dataType) {
      this.#trackList.querySelectorAll(`[data-type=${dataType}]`).forEach(e => e.className = e.className.replace('text', 'sort-data'))
    }

    #sortRadiobuttonClicked(e) {
      const label = e.target.closest('label')
      const text = label.children[1].textContent
      const sortCriterion = AudioWidget.#getSortCriterion(text)

      // sort and update UI

      this.#rows.sort((r1, r2) =>  this.#movementComparator(r1.track, r2.track, sortCriterion))

      const fragment = document.createDocumentFragment()
      this.#rows.forEach(({ row }) => {
        fragment.appendChild(row)
      })

      this.#trackList.replaceChildren(fragment)

      // Reset the styles, then highlight the relevant data items

      this.#trackList.querySelectorAll('.sort-data-primary, .sort-data-secondary').forEach(e => e.className = e.className.replace('sort-data', 'text'))

      switch (sortCriterion) {
        case '_mvt-cd':             this.#highlightDataItems('CD'); break
        case '_mvt-composer':       this.#highlightDataItems('composer'); break
        case '_mvt-work':           this.#highlightDataItems('work'); break
        case '_mvt-movement':       this.#highlightDataItems('movement'); break
        case '_mvt-movementNumber': this.#highlightDataItems('movementNumber'); break
        case '_mvt-performers':     this.#highlightDataItems('performers'); break
        case '_mvt-key':            this.#highlightDataItems('key'); break
      }
    }

    #trackListItemClicked(e) {

      let target = e.target
      if (target.nodeName === "SPAN") {
        target = target.closest('div')
      }

      const id = target.id
      const match = id.match(/\+[ict]\d+$/)
      if (match === null) {
        return
      }

      const targetType = match[0].at(1)
      const i = match[0].substring(2)

      switch (targetType) {

        case "t":
          if (this.#currentTrackElement) {
            this.#currentTrackElement.classList.remove("currentTrack")
          }
          this.#currentTrackElement = target
          this.#currentTrackElement.classList.add("currentTrack")
          this.#currentRow = this.#currentTrackElement.closest('tr') 

          this.audioController.pause()

          const trackTiddler = this.#tracks[i].tiddler

          if (showNowPlaying) {
            this.#nowPlaying(trackTiddler)
          }

          this.audioController.play(this.#tracks[i])
          break

        case "i":
        case "c":
          const tiddlerTitle = targetType === "i"
          ? this.#tracks[i].tiddler.fields.title
          : this.#tracks[i].tiddler.fields['_mvt-cd']
          // tiddler titels kunnen enkele of dubbele aanhalingstekens bevatten.
          // Het leek logisch om alle aanhalingstekens in de titels te escapen:
          //    tiddler = tiddler.replace(/'|"/g, "\\$&")
          // Hoewel het escapen hiermee correct gebeurt (console.log), is dat voor
          // TW toch niet OK: tiddlers met ge-escapete aanhalingstekens worden niet
          // gevonden, vanwaar de onderstaande code, i.p.v. wat er voorheen stond:
          //   <$action-navigate $to='${tiddler}'/>
          // wat enkel werkte voor tiddlers met dubbele aanhalingstekens in de titel.
          // Mochten er nog titels zijn met zowel enkele als dubbele aanhalingstekens,
          // zal de onderstaande code (of zullen de titels) aangepast moeten worden.
          const quote = tiddlerTitle.indexOf('"') !== -1 ? "'" :  '"'
          const action = `
            <$navigator story="$:/StoryList" history="$:/HistoryList">
            <$action-navigate $to=${quote}${tiddlerTitle}${quote}/>
            </$navigator>
          `
          window.parent.$tw.rootWidget.invokeActionString(action, this)
          break
      }
    }

  }

  exports.audio = AudioWidget

})()
