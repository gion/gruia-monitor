import { auth, googleProvider } from './firebaseApp.js'
import * as firebase from 'firebase'
import * as helpers from './helpers'
import moment from 'moment'
import { MotionDetection } from './motionDetection'
// import SoundDetection from 'sound-detection'
import DecibelMeter from 'decibel-meter'
import throttle from 'lodash.throttle'

// import * as DiffCamEngine from 'diff-cam-engine'

class App {
  constructor({auth, googleProvider, firebase}) {
    this.auth = auth
    this.googleProvider = googleProvider
    this.firebase = firebase
    this.db = this.firebase.database()

    this.onRouteChange = this.onRouteChange.bind(this)
    this.updateChart = this.updateChart.bind(this)
    this.updateChartData = this.updateChartData.bind(this)
    // this.update = throttle(this.update, 1000, true)
    this.drawChart = throttle(this.drawChart, 1000)

    this._motions = []
    this._motion = 0
    this._noises = []
    this._noise = 0

    this.roomId = null

    this.initMessaging()
    this.addEventListeners()
  }

  get roomRef () {
    if (!this.roomId) {
      let roomRef = this.db.ref('rooms').push()

      this.roomId = roomRef.key

      roomRef.set({
        enabled: true,
        chartData: []
      })

      return roomRef
    }

    return this.db.ref('rooms').child(this.roomId)
  }

  get chartDataRef() {
    return this.roomRef.child('chartData')
  }

  get invitationLink() {
    return `${location.origin}/#/parent/${this.roomId}`
  }

  set noise(value) {

    if (!this._maxNoiseScore) {
      // because
      this._maxNoiseScore = 255
    }

    value = Math.round(value * 100 / this._maxNoiseScore)

    this._noiseDelta = Math.abs(this._noise - value)

    this._noise = value
    this.update()
  }

  get noise() {

    return this._noise
  }

  set motion(value) {
    if (!this._maxMotionScore) {
      let canvas = document.querySelector('.canvas')
      this._maxMotionScore = canvas.height * canvas.width
    }

    value = Math.round(value * 100 / this._maxMotionScore)

    this._motionDelta = Math.abs(this._motion - value)

    this._motion = value
    this.update()
  }

  get motion() {
    return this._motion
  }

  initMessaging() {
    this.messaging = this.firebase.messaging();

    this.messaging.requestPermission()
      .then(function() {
        console.log('Notification permission granted.', arguments);
        // TODO(developer): Retrieve an Instance ID token for use with FCM.
        // ...
      })
      .catch(function(err) {
        console.log('Unable to get permission to notify.', err);
      });
  }

  updateChartData(data) {
    this.chartDataRef.push().set(data)
  }

  update() {
    let now = new Date()

    if (this.lastUpdate) {
      if (now - this.lasUpdate < 2 * 1000 && this._motionDelta < 5 && this._noiseDelta < 5) {
        // wait a bit
        return
      }
    }

    this.lastUpdate = now

    document.body.setAttribute('motion', this.motion)
    document.body.setAttribute('noise', this.noise)

    this.updateChartData({
      motion: this.motion,
      noise: this.noise,
      timestamp:  now.toISOString()
    })
  }

  addEventListeners() {
    this.auth.onAuthStateChanged(user => {
      if (!user) {
        this.navigate('guest')
      } else {
        helpers.setUserName(user.displayName)

        if (!this.route || this.route === 'guest') {
          this.navigate('account')
        }
      }
    })

    helpers.onRouteChange(this.onRouteChange)

    let chartContainer = document.querySelector('[name=chart]')

    window.addEventListener('resize', () => {
      if (!this.chart || !this.chartOptions) {
        return
      }
      this.chartOptions.width = parseInt(getComputedStyle(chartContainer).width)
      this.chart.draw(this.chartData, this.chartOptions)
    }, false)
  }

  login() {
    return this.auth.signInWithPopup(this.googleProvider)
  }

  logout() {
    return this.auth.signOut()
      .then(() => this.roomId = null)
  }

  baby() {
    this.navigate('watch')
  }

  parent(roomId) {
    this.roomId = roomId

    this.roomRef.once('value')
      .then(room => room.val())
      .then(roomValue => {

        if(!roomValue) {
          let groupName = 'invalid group!'

          console.group(groupName)
          console.error('invalid room!', this.roomId)
          console.groupEnd(groupName)

          return this.navigate('account')
        }

        this.parentPeerConnection = this.newPeerConnection()
        this.parentPeerConnection.onicecandidate = (...args) => {
          this._parentCandidate = args
          console.log('[parent] onicecandidate', ...args)
        }
        this.parentPeerConnection.onaddstream = (...args) => {
          this._babyStream = URL.createObjectURL(args[0].stream)

          document.querySelector('.parent-video').src = this._babyStream

          console.log('[parent] onaddstream', ...args)
        }

        this.listenForCandidate(candidate => {
          console.log('parent candidate', candidate)
          this.parentPeerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        })

        this.listenForOffer(offer => {
          console.log('OFFFFFFEEEEERRR', offer)
          this.parentPeerConnection.setRemoteDescription(offer)
          this.parentPeerConnection.createAnswer()
            .then(answer => {
                this.parentPeerConnection.setLocalDescription(answer)
                this.broadcastAnswer(answer)
            })
        })
    })
  }

  onRouteChange(newRoute, oldRoute) {
    this.route = newRoute
    document.body.setAttribute('route', this.route.split('/')[0])

    if (newRoute === 'account') {
      if (this.soundDetection) {
        this.soundDetection.stopListening()
      }

      if(this.motionDetection) {
        this.motionDetection.stop()
      }

      this.stopListeningForAnswers()
      this.stopListeningForCandidates()
      this.stopListeningForChartData()
    }

    if (newRoute.indexOf('baby') === 0) {
      if (this.soundDetection) {
        this.soundDetection.listen()
      }

      if(this.motionDetection) {
        this.motionDetection.start()
      }

      document.querySelector('.sharethis-inline-share-buttons').setAttribute('data-url', this.invitationLink)

      this.listenForAnswer(answer => console.log('answer here', answer))

      this.initChart()
      this.listenForChartData()

    } else {

    }

    if (newRoute === 'watch') {

      // this.roomRef.once('value')
      //   .then(room => room.val())
      //   .then(roomVal => {
      //     if (roomVal) {
      //       let groupName = 'Room already created!'

      //       console.group(groupName)
      //       console.error('this room is already defined:', roomVal)
      //       console.groupEnd(groupName)

      //       this.navigate('account')
      //     } else {
      //       this.roomRef.set({
      //         offer: null,
      //         answer: null
      //       })
      //     }
      //   })

      console.log(this.rooRef)

      if (!this.soundDetection) {
        this.initSoundDetection()
      }

      if (!this.motionDetection) {
        this.initMotionDetection()
          .then(() => {
            this.babyPeerConnection = this.newPeerConnection()
            this.babyPeerConnection.onicecandidate = ev => this.broadcastCandidate(ev.candidate)
            this.babyPeerConnection.onaddstream = (...args) => console.log('[baby] onaddstream', ...args)

            return this.babyPeerConnection.addStream(this.stream)
          })
          .then(() => {
            return this.babyPeerConnection.createOffer()
          })
          .then(offer => {
            this.babyPeerConnection.setLocalDescription(offer)
            return offer
          })
          .then(offer => {
            return this.broadcastOffer(offer)
          })
          .then(() => this.navigate(`baby/${this.roomId}`))
          .catch(err => console.error('something went wrong', err))
      } else {
        this.navigate(`baby/${this.roomId}`)
      }
    }

    if (newRoute.indexOf('parent/') === 0) {
      let roomId = newRoute.replace(/^.*\//, '')

      this.parent(roomId)
      this.initChart()
      this.listenForChartData()

    } else {

    }
  }

  navigate(route) {
    console.debug('[navigate]', `to ${route}`)

    location.hash = route
  }

  initSoundDetection() {
    this.soundDetection = new DecibelMeter('gruia')

    this.soundDetection.on('sample', (db, value, percent) => {

      if (value === 0) {
        return
      }

      this.noise = value
    })

    return this.soundDetection.connectTo(0)
  }

  initMotionDetection() {
    let timeout = null
    let timeoutDuration = 1000

    this.motionDetection = new MotionDetection({
      scoreThreshold: 128,
      captureWidth: 480,
      captureHeight: 480,
      video: document.querySelector('.video'),
      motionCanvas: document.querySelector('.canvas')
    })

    this.motionDetection.onMotion(({score}) => this.motion = score)

    return this.motionDetection
      .init()
      .then(stream => {
        this.stream = stream
      })
      .catch(err => console.error(err))
  }

  broadcastCandidate(candidate) {
    if (!candidate) {
      return
    }

    let roomRef = this.roomRef

    console.log('broadcastCandidate', roomRef.key, candidate)
    console.log(roomRef.key)

    return this.roomRef.update({
      candidate: candidate
    })
  }

  broadcastOffer(offer) {
    console.log('broadcastOffer', offer)

    return this.roomRef.update({
      offer: offer
    })
  }

  broadcastAnswer(answer) {
    console.log('broadcastAnswer', answer)

    return this.roomRef.update({
      answer: answer
    })
  }

  listenForChartData() {
    this.chartDataRef.on('child_added', data => this.updateChart(data.val()))
  }

  listenForCandidate(callback) {
    console.log('listenForCandidate')

    this.stopListeningForCandidates()

    this.roomRef.child('candidate').on('value', result => {
      let candidate = result.val()

      if (candidate) {
        console.log('received offer', candidate)
        callback(candidate)
        this.stopListeningForCandidates()
      }
    })
  }

  listenForOffer(callback) {
    console.log('listenForOffer')

    this.stopListeningForOffers()

    this.roomRef.child('offer').on('value', result => {
      let offer = result.val()

      if (offer) {
        console.log('received offer', offer)
        callback(offer)
        this.stopListeningForOffers()
      }
    })
  }

  listenForAnswer(callback) {
    console.log('listenForAnswer')

    this.stopListeningForAnswers()

    this.roomRef.child('answer').on('value', result => {
      let answer = result.val()

      if (answer) {
        console.log('received answer', answer)
        callback(answer)
        this.stopListeningForAnswers()
      }
    })
  }

  stopListeningForChartData() {
    this.chartDataRef.off('child_added')
  }

  stopListeningForCandidates() {
    this.roomRef.child('candidate').off()
  }

  stopListeningForOffers() {
    this.roomRef.child('offer').off()
  }

  stopListeningForAnswers() {
    this.roomRef.child('answer').off()
  }

  newPeerConnection() {
    const servers = {
      'iceServers': [
        {
          'urls': 'stun:stun.services.mozilla.com'
        },
        {
          'urls': 'stun:stun.l.google.com:19302'
        },
        {
          'urls': 'turn:numb.viagenie.ca',
          'credential': 'webrtc',
          'username': 'websitebeaver@mail.com'
        }
      ]
    }

    return new RTCPeerConnection(servers)
  }

  initChart() {
    let chartContainer = document.querySelector('[name=chart]')

    this.chart = new google.visualization.LineChart(document.querySelector('.chart'));

    this.chartOptions = {
      width: parseInt(getComputedStyle(chartContainer).width),
      height: 240,
      vAxis: {
        minValue: 0,
        maxValue: 1,
        format: '#%'
      },
      hAxis: {
        title: 'time',
        // format: 'hh:MM:ss',
        logscale: true,
        viewWindow: {
          min: new Date(),
          // max: moment().add(10, 'minutes').toDate()
        },
        gridlines: {
          // count: -1,
          units: {
            days: {format: ['MMM dd']},
            hours: {format: ['HH:mm', 'ha']},
          }
        },
        minorGridlines: {
          units: {
            hours: {format: ['hh:mm:ss a', 'ha']},
            minutes: {format: ['HH:mm a Z', ':mm']}
          }
        }
      },
      animation: {
        duration: 300,
        easing: 'in'
      },
      explorer: {
        axis: 'horizontal'
      }
    }

    this.chartData = new google.visualization.DataTable()
    this.chartData.addColumn('datetime', 'time')
    this.chartData.addColumn('number', 'motion')
    this.chartData.addColumn('number', 'noise')

    this.chartDataRef.once('value', data => {
      let values = data.val()
      if (!values) {
        return
      }

      Object.values(values).map(value => [
          new Date(value.timestamp),
          value.motion / 100,
          value.noise / 100
        ])
        .forEach(data => this.chartData.addRow(data))

      this.chart.draw(this.chartData, this.chartOptions);
    })
  }

  updateChart(value) {

    let v = [
      new Date(value.timestamp),
      value.motion / 100,
      value.noise / 100
    ]

    this.chartData.addRow(v)
    this.drawChart()
  }

  drawChart() {
    const maxRows = 800
    let rowCount = this.chartData.getNumberOfRows()

    if (rowCount > maxRows) {
      this.chartData.removeRows(0, rowCount - maxRows)
    }

    this.chart.draw(this.chartData, this.chartOptions);
  }

  // getUserMedia() {
  //   let constraints = {
  //     audio: true,
  //     video: true
  //   }

  //   return navigator.mediaDevices
  //     .getUserMedia(constraints)
  //     .then((stream, ...args) => {
  //       console.log(args)

  //       let video = document.querySelector('.video')
  //       let canvas = document.querySelector('.canvas')
  //       video.srcObject = stream

  //       DiffCamEngine.init({
  //         video: video,
  //         canvas: canvas,
  //         captureCallback: (...args) => console.log(...args),
  //         initSuccessCallback: () => DiffCamEngine.start
  //       })
  //       // this.motionDetection = new MotionDetection(stream)

  //       this.navigate('video')
  //     })
  //     .catch(err => console.error(err))
  // }
}

export default new App({
  auth,
  googleProvider,
  firebase
})