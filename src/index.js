import app from './app'
import * as style from './style.scss'

// Load the Visualization API and the corechart package.
google.charts.load('current', {packages: ['corechart']})

// Set a callback to run when the Google Visualization API is loaded.
// google.charts.setOnLoadCallback(app.initChart)

window.app = app