import './css/reset.css'
import './css/style.css'

import {MapManager} from './map-manager2'

const mapManager = new MapManager()

window.onload = () => {
  mapManager.prepare()
}

window.addEventListener( 'resize', () => {
  mapManager.onResize()
}, false)




