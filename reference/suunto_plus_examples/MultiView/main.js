var currentTemplate = 't1';

var changeView = function(template) {
  currentTemplate = template;
  unload('_cm'); // Unload & reload the screen to rerun getUserInterface
};

function onEvent(_input, _output, eventId) {
  switch (eventId) {
    case 1:
      changeView('t1');
      break;
    case 2:
      changeView('t2');
      break;
  }
}

function getUserInterface() {
  return {
    template: currentTemplate
  };
}
