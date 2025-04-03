export function migrateState1to2(oldState: any) {
  const state = oldState['right']
  state['accompaniedState'] = oldState['left']
  return state
}
