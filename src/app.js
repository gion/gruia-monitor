import { auth, googleProvider } from './firebaseApp.js'
import * as firebase from 'firebase'
import * as helpers from './helpers'
import { MotionDetection } from './motionDetection'
// import * as DiffCamEngine from 'diff-cam-engine'

class App {
  constructor({auth, googleProvider, firebase}) {
    this.auth = auth
    this.googleProvider = googleProvider
    this.firebase = firebase

    this.onRouteChange = this.onRouteChange.bind(this)
    // this.getUserMedia = this.getUserMedia.bind(this)

    this.addEventListeners()
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

    if (newRoute === 'video') {
      if(this.motionDetection) {
        this.motionDetection.start()
      }
    } else {
      if(this.motionDetection) {
        this.motionDetection.stop()
      }
    }

    if (newRoute === 'account') {

      if (!this.motionDetection) {
        this.initMotionDetection()
          .then(() => this.navigate('video'))
      } else {
        this.navigate('video')
      }
    }
  }

  navigate(route) {
    console.debug('[navigate]', `to ${route}`)

    location.hash = route
  }

  initMotionDetection() {
    let timeout = null
    let timeoutDuration = 1000

    this.motionDetection = new MotionDetection()
    this.motionDetection.onMotion(({score}) => {
      clearTimeout(timeout)
      setTimeout(() => {
        document.body.style.background = ''
        document.body.removeAttribute('motion')
      }, timeoutDuration)

      let opacity = score / 1000
      document.body.style.background = `rgba(255, 0, 0, ${opacity})`
      document.body.setAttribute('motion', score)
    })

    return this.motionDetection
      .init()
      .then(stream => this.stream = stream)
      .catch(err => console.error(err))
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