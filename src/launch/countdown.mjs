export function remainingTime(deadline, now = Date.now()) {
  const totalSeconds = Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor(totalSeconds % 3600 / 60),
    seconds: totalSeconds % 60,
    finished: totalSeconds === 0
  };
}

if (typeof document !== 'undefined') {
  const countdown = document.querySelector('[data-launch-at]');
  if (countdown) {
    const fields = ['hours', 'minutes', 'seconds'].map(unit => countdown.querySelector(`[data-${unit}]`));
    const status = document.querySelector('[data-status]');
    let timer;
    const update = () => {
      const time = remainingTime(countdown.dataset.launchAt);
      ['hours', 'minutes', 'seconds'].forEach((unit, index) => {
        fields[index].textContent = String(time[unit]).padStart(2, '0');
      });
      if (time.finished) {
        status.textContent = status.dataset.finished;
        clearInterval(timer);
      }
    };
    timer = setInterval(update, 1000);
    update();
  }
}
