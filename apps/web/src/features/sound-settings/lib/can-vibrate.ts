/** iOS Safari has no Vibration API: the «Вібрація» row would be a switch that does nothing. */
export const canVibrate = (): boolean => 'vibrate' in navigator
