// Inline HTML records early input, including keys pressed before the JS bundle loads.
export function waitForIntroStart(overlay) {
  if (overlay.dataset.bootSkipped === 'true') return Promise.resolve(false);
  if (overlay.dataset.initialised === 'true') return Promise.resolve(true);
  return new Promise(resolve => {
    const finish = value => {
      overlay.removeEventListener('intro:initialise', initialise);
      overlay.removeEventListener('intro:skip', skip);
      resolve(value);
    };
    const initialise = () => finish(true);
    const skip = () => finish(false);
    overlay.addEventListener('intro:initialise', initialise);
    overlay.addEventListener('intro:skip', skip);
  });
}
