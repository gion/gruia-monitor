import { auth, googleProvider } from './firebaseApp.js'
import * as firebase from 'firebase'
import * as helpers from './helpers'


class App {
  constructor({auth, googleProvider, firebase}) {
    this.auth = auth
    this.googleProvider = googleProvider
    this.firebase = firebase

    this.addEventListeners()
  }

  addEventListeners() {
    this.auth.onAuthStateChanged(helpers.onAuthStateChanged);
  }

  login() {
    return this.auth.signInWithPopup(this.googleProvider)
  }

  logout() {
    return this.auth.signOut()
  }
}

export default new App({
  auth,
  googleProvider,
  firebase
})