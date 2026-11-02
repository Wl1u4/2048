// Wait till the browser is ready to render the game (avoids glitches),
// then paint the planets once before the first tiles appear
window.requestAnimationFrame(function () {
  Planets.paint().then(function () {
    new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);
  });
});
