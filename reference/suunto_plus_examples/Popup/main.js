var currentTemplate = 't';

var changeView = function(template) {
  currentTemplate = template;
  unload('_cm'); // Unload & reload the screen to run getUserInterface
};

function onEvent(_input, _output, eventId) {
  switch (eventId) {
    case 1:
      // Open first popup
      changeView('p1');
      break;
    case 2:
      // Open second popup
      changeView('p2');
      break;
    case 3:
      // Open main view
      changeView('t');
      break;
  }
}

function getUserInterface() {
  return {
    template: currentTemplate
  };
}
