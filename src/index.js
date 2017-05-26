import { auth } from './firebaseApp.js'

auth.onAuthStateChanged(user => console.log('user changed', user));

window.auth = auth;