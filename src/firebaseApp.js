import * as constants from './constants.js';
import * as firebase from 'firebase';
debugger;
firebase.initializeApp(constants.firebaseConfig);

export const auth = firebase.auth();
export const database = firebase.database();
