import { Config } from './config';

export class LoadingIcon {
  element : HTMLElement;
  
  constructor() {
    this.element = document.getElementById('loading-icon');
    this.hide();
  }

  applyConfig(config : Config) {
    if(config.darkMode) {
      this.element.setAttribute('class', 'loading-icon dark');
    } else {
      this.element.setAttribute('class', 'loading-icon light');
    }
  }

  show() {
    this.element.style.display = 'inline-block';
  }

  hide() {
    this.element.style.display = 'none';
  }
}
