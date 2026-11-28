export function createQualificationMonitorLifecycle({
  now = () => Date.now(),
  pid = process.pid,
  parentPid = process.ppid,
  onStop = () => {}
} = {}) {
  let termination = null;
  let wake = null;

  function requestStop(signal) {
    if (termination) return termination;
    termination = {
      contract: "observer-qualification-monitor-termination-v1",
      kind: "EXTERNAL_SIGNAL",
      signal,
      received_at: new Date(now()).toISOString(),
      pid,
      parent_pid: parentPid
    };
    onStop(termination);
    wake?.();
    return termination;
  }

  async function wait(milliseconds) {
    if (termination) return false;
    await new Promise(resolve => {
      const timer = setTimeout(() => {
        wake = null;
        resolve();
      }, Math.max(0, milliseconds));
      wake = () => {
        clearTimeout(timer);
        wake = null;
        resolve();
      };
    });
    return termination === null;
  }

  return {
    requestStop,
    wait,
    stopped: () => termination !== null,
    termination: () => termination
  };
}
