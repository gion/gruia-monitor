import * as constants from './constants.js'
import * as firebase from 'firebase'

firebase.initializeApp(constants.firebaseConfig)

export const googleProvider = new firebase.auth.GoogleAuthProvider()
export const auth = firebase.auth()
export const database = firebase.database()
