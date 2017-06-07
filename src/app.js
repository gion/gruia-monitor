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

    this.onRouteChange = this.onRouteChange.bind(this)
    this.initChart = this.initChart.bind(this)

    this._motions = []
    this._noises = []

    this.addEventListeners()
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
  }

  onRouteChange(newRoute, oldRoute) {
    this.route = newRoute
    document.body.setAttribute('route', this.route)

    if (newRoute === 'listen') {
      if (this.soundDetection) {
        this.soundDetection.listen()
      }

      if(this.motionDetection) {
        this.motionDetection.start()
      }
    } else {
      if (this.soundDetection) {
        this.soundDetection.stopListening()
      }

      if(this.motionDetection) {
        this.motionDetection.stop()
      }
    }

    if (newRoute === 'account') {

      if (!this.soundDetection) {
        this.initSoundDetection()
      }

      if (!this.motionDetection) {
        this.initMotionDetection()
          .then(() => this.navigate('listen'))
      } else {
        this.navigate('listen')
      }
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
      .then(stream => this.stream = stream)
      .catch(err => console.error(err))
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