// Windows���ǂ����𔻒�
export const checkIsWindows = () => {
  const ua = window.navigator.userAgent.toLowerCase();
  if(ua.indexOf('windows') !== -1) {
	return true;
  } else {
	return false;
  }
}
