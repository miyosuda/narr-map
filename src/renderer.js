import {Config} from './config'

import './css/reset.css'
import './css/style-common.css'

const config = new Config()

if(config.darkMode) {
  import('./css/style-dark.css')
} else {
  import('./css/style-light.css')
}

import {MapManager} from './map-manager'

const mapManager = new MapManager(config)

window.onload = () => {
  mapManager.prepare()
}

window.addEventListener( 'resize', () => {
  mapManager.onResize()
}, false)
