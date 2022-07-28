import {Config} from './config'

import './css/reset.css'
import './css/style.css'

import {MapManager} from './map-manager'

const config = new Config()
const mapManager = new MapManager(config)

window.onload = () => {
  mapManager.prepare()
}

window.addEventListener( 'resize', () => {
  mapManager.onResize()
}, false)
