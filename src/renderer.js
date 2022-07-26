import {Config} from './config'

import './css/reset.css'
import './css/style-common.css'
import './css/style.css'


const config = new Config()

import {MapManager} from './map-manager'

const mapManager = new MapManager(config)

window.onload = () => {
  mapManager.prepare()
}

window.addEventListener( 'resize', () => {
  mapManager.onResize()
}, false)
