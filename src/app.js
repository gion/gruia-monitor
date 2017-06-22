import { auth, googleProvider } from './firebaseApp.js'
import * as firebase from 'firebase'
import * as helpers from './helpers'
import moment from 'moment'
import { MotionDetection } from './motionDetection'
// import SoundDetection from 'sound-detection'
import DecibelMeter from 'decibel-meter'
// import * as DiffCamEngine from 'diff-cam-engine'

class App {
  constructor({auth, googleProvider, firebase}) {
    this.auth = auth
    this.googleProvider = googleProvider
    this.firebase = firebase
    this.db = this.firebase.database()

    this.onRouteChange = this.onRouteChange.bind(this)
    this.initChart = this.initChart.bind(this)

    this._motions = []
    this._noises = []

    this.roomId = null

    this.initMessaging()
    this.addEventListeners()
  }

  get roomRef () {
    if (!this.roomId) {
      let roomRef = this.db.ref('rooms').push()

      this.roomId = roomRef.key

      roomRef.set({
        enabled: true
      })

      return roomRef
    }

    return this.db.ref('rooms').child(this.roomId)
  }

  get invitationLink() {
    return `${location.origin}/#/parent/${this.roomId}`
  }

  set noise(value) {

    this._noises = this._noises || []
    this._noises.push({
      value: value,
      timestamp: new Date
    })

    this._noise = value
    this.update()
  }

  get noise() {
    return this._noise
  }

  set motion(value) {

    this._motions = this._motions || []
    this._motions.push({
      value: value,
      timestamp: new Date
    })

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

  update() {
    let now = new Date()

    if (this.lastUpdate) {
      if (now - this.lasUpdate < 1 * 1000) {
        // wait a bit
        return
      }
    }

    this.lastUpdate = now

    if (!this._maxMotionScore) {
      let canvas = document.querySelector('.canvas')
      this._maxMotionScore = canvas.height * canvas.width
    }

    if (!this._maxNoiseScore) {
      // because
      this._maxNoiseScore = 255
    }

    let motion = Math.round(this.motion / this._maxNoiseScore)
    let noise = 100 * Math.round(this.noise / this._maxNoiseScore)

    document.body.setAttribute('motion', motion)
    document.body.setAttribute('noise', noise)
  }

  addEventListeners() {
    this.auth.onAuthStateChanged(user => {
      if (!user) {
        this.navigate('guest')
      } else {
        helpers.setUserName(user.displayName)
        this.navigate('account')
      }
    })

    helpers.onRouteChange(this.onRouteChange)
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

    if (newRoute.indexOf('baby') === 0) {
      if (this.soundDetection) {
        this.soundDetection.listen()
      }

      if(this.motionDetection) {
        this.motionDetection.start()
      }

      document.querySelector('.sharethis-inline-share-buttons').setAttribute('data-url', this.invitationLink)

      this.listenForAnswer(answer => console.log('answer here', answer))

    } else {
      if (this.soundDetection) {
        this.soundDetection.stopListening()
      }

      if(this.motionDetection) {
        this.motionDetection.stop()
      }

      this.stopListeningForAnswers()
      this.stopListeningForCandidates()
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
    } else {
      this.stopListeningForAnswers()
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

    this.motionDetection.onMotion(({score}) => {
      this.motion = score
      // clearTimeout(timeout)
      // setTimeout(() => {
      //   document.body.style.background = ''
      //   document.body.removeAttribute('motion')
      // }, timeoutDuration)

      // let opacity = score / 1000
      // document.body.style.background = `rgba(255, 0, 0, ${opacity})`
      // document.body.setAttribute('motion', score)
    })

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
    this.chart = new google.visualization.LineChart(document.querySelector('.chart'));

    this.charOptions = {
      width: 400,
      height: 240,
      vAxis: {minValue:0, maxValue:100},
      animation: {
        duration: 1000,
        easing: 'in'
      }
    };

    this.chartData = new google.visualization.DataTable();
    this.chartData.addColumn('number', 'x');
    this.chartData.addColumn('number', 'y');

    // var button = document.getElementById('b1');

    // button.onclick = function() {
    //   if (data.getNumberOfRows() > 5) {
    //     data.removeRow(Math.floor(Math.random() * data.getNumberOfRows()));
    //   }
    //   // Generating a random x, y pair and inserting it so rows are sorted.
    //   var x = Math.floor(Math.random() * 1000);
    //   var y = Math.floor(Math.random() * 100);
    //   var where = 0;
    //   while (where < data.getNumberOfRows() && parseInt(data.getValue(where, 0)) < x) {
    //     where++;
    //   }
    //   data.insertRows(where, [[x.toString(), y]]);
    //   drawChart();
    // }

  }

  drawChart() {
    this._motions
      .map(({timestamp, value}) => {
        return [value, moment(timestamp).format('hh:MM:ss')]
      })
      .forEach(data => this.chartData.addRow(data));

    this.chart.draw(this.chartData, this.charOptions);
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